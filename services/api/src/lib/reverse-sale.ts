import { prisma, type Prisma } from '@frego/db';
import { mergeLedgerMeta, isReversalMarker, isReversedTx, saleIdFromMeta } from './ledger-meta.js';
import { closeConvitesForSale } from './pesquisa-flow.js';
import {
  earnLotStateFromPools,
  reverseBlockForEarn,
  reverseBlockMessage,
} from './tx-reverse.js';
import { voucherFromMetadata } from './voucher.js';
import { deriveWallet, ledgerPoolEvents, poolLotsFifo, type WalletSnapshot } from './wallet.js';
import { releaseEarnNotifyHold } from './whatsapp/earn-notify-hold.js';

export type ReverseLog = (msg: string, extra?: Record<string, unknown>) => void;

export type ReverseSaleResult =
  | {
      ok: true;
      reversedIds: string[];
      saleId: string;
      wallet: WalletSnapshot;
      pools: WalletSnapshot['pools'];
      cashback: { balanceCents: number };
      message: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
      message?: string;
    };

function fail(
  status: number,
  error: string,
  message?: string,
): ReverseSaleResult {
  return { ok: false, status, error, message };
}

/**
 * Undo a staff compra. Saipos cancellations use the same rules: a used or
 * expired credit stays, and the original rows remain marked reversed.
 */
export async function reverseLedgerSale(input: {
  businessId: string;
  actorTeamMemberId: string;
  transactionId?: string;
  membershipId?: string;
  saleId?: string;
  log?: ReverseLog;
}): Promise<ReverseSaleResult> {
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: {
      status: true,
      stampsExpireDays: true,
      pointsExpireDays: true,
      cashbackExpireDays: true,
    },
  });
  if (
    !business ||
    business.status === 'pending' ||
    business.status === 'suspended'
  ) {
    return fail(403, 'BUSINESS_NOT_ACTIVE');
  }

  const target = input.transactionId
    ? await prisma.transaction.findFirst({
        where: { id: input.transactionId, businessId: input.businessId },
      })
    : null;
  if (input.transactionId && !target) {
    return fail(404, 'TRANSACTION_NOT_FOUND');
  }

  const membershipId = target?.membershipId ?? input.membershipId;
  if (!membershipId) return fail(404, 'TRANSACTION_NOT_FOUND');

  if (target && (isReversalMarker(target.metadata) || isReversedTx(target.metadata))) {
    return fail(409, 'ALREADY_REVERSED', 'Este lançamento já foi desfeito.');
  }

  const allTxs = await prisma.transaction.findMany({
    where: { membershipId, businessId: input.businessId },
    orderBy: { createdAt: 'asc' },
  });

  const saleId = target
    ? saleIdFromMeta(target.metadata)
    : (input.saleId ?? null);
  const siblings = saleId
    ? allTxs.filter(
        (tx) =>
          saleIdFromMeta(tx.metadata) === saleId &&
          !isReversalMarker(tx.metadata),
      )
    : target
      ? [target]
      : [];
  if (siblings.length === 0) return fail(404, 'TRANSACTION_NOT_FOUND');

  const toReverse = siblings.filter((tx) => !isReversedTx(tx.metadata));
  if (toReverse.length === 0) {
    return fail(409, 'ALREADY_REVERSED', 'Este lançamento já foi desfeito.');
  }

  for (const tx of toReverse) {
    if (voucherFromMetadata(tx.metadata, { createdAt: tx.createdAt })) {
      return fail(400, 'REVERSE_VOUCHER', reverseBlockMessage('voucher'));
    }
    if (!tx.actorTeamMemberId) {
      return fail(400, 'REVERSE_NOT_STAFF', reverseBlockMessage('not_staff'));
    }
  }

  const campaigns = await prisma.campaign.findMany({
    where: { businessId: input.businessId },
    select: {
      id: true,
      name: true,
      type: true,
      cartela: true,
      stampsNeeded: true,
    },
  });
  const metaById = new Map(campaigns.map((c) => [c.id, c]));
  const events = ledgerPoolEvents(allTxs, metaById);
  const stampPool = poolLotsFifo(events.stamps, business.stampsExpireDays);
  const pointPool = poolLotsFifo(events.points, business.pointsExpireDays);
  const cashbackPool = poolLotsFifo(
    events.cashback,
    business.cashbackExpireDays,
  );
  const cartelaPools = [...events.cartelas.values()].map((cartelaEvents) =>
    poolLotsFifo(cartelaEvents, business.stampsExpireDays),
  );

  for (const tx of toReverse) {
    if (tx.type !== 'stamp') continue;
    const state = earnLotStateFromPools(
      [stampPool, pointPool, cashbackPool, ...cartelaPools],
      tx.id,
    );
    const block = reverseBlockForEarn(state, tx.quantity);
    if (block) {
      return fail(
        409,
        block === 'expired' ? 'REVERSE_EXPIRED' : 'REVERSE_USED',
        reverseBlockMessage(block),
      );
    }
  }

  const now = new Date();
  const anchor = toReverse[0]!;
  await prisma.$transaction(async (db) => {
    const marker = await db.transaction.create({
      data: {
        businessId: input.businessId,
        membershipId,
        campaignId: null,
        locationId: anchor.locationId,
        actorTeamMemberId: input.actorTeamMemberId,
        type: 'stamp',
        quantity: 0,
        unitKind: anchor.unitKind ?? 'stamps',
        metadata: {
          reversalOf: toReverse.map((tx) => tx.id),
          saleId: saleId ?? anchor.id,
          ...(isSaipos(anchor.metadata) ? { source: 'saipos' } : {}),
          ...(saiposId(anchor.metadata)
            ? { saiposSaleId: saiposId(anchor.metadata) }
            : {}),
        },
      },
    });
    for (const tx of toReverse) {
      await db.transaction.update({
        where: { id: tx.id },
        data: {
          metadata: mergeLedgerMeta(tx.metadata, {
            reversedAt: now.toISOString(),
            reversedByTeamMemberId: input.actorTeamMemberId,
            reversedByTxId: marker.id,
          }) as Prisma.InputJsonValue,
        },
      });
    }
  });

  await closeConvitesForSale(saleId ?? anchor.id);

  const wallet = await deriveWallet(membershipId, input.businessId);
  try {
    const owner = await prisma.membership.findUnique({
      where: { id: membershipId },
      select: { customerId: true },
    });
    if (owner) {
      await releaseEarnNotifyHold({
        businessId: input.businessId,
        customerId: owner.customerId,
        saleId,
        transactionIds: toReverse.map((tx) => tx.id),
        wallet,
      });
    }
  } catch (err) {
    input.log?.('earn_notify_release_failed', { err: String(err) });
  }

  return {
    ok: true,
    reversedIds: toReverse.map((tx) => tx.id),
    saleId: saleId ?? anchor.id,
    wallet,
    pools: wallet.pools,
    cashback: { balanceCents: wallet.pools.cashbackCents },
    message: 'Lançamento desfeito.',
  };
}

function isSaipos(metadata: unknown): boolean {
  return (
    !!metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    (metadata as { source?: string }).source === 'saipos'
  );
}

function saiposId(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }
  const value = (metadata as { saiposSaleId?: unknown }).saiposSaleId;
  return typeof value === 'string' ? value : undefined;
}
