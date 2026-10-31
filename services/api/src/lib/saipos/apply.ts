import { planSaiposSale, saiposSaleId, type SaiposImportStatus } from './sale.js';

export type SaiposImportRow = {
  status: SaiposImportStatus;
  saleId: string | null;
  membershipId: string | null;
  updatedAt: Date;
};

export type SaiposSave = {
  saiposSaleId: string;
  status: Exclude<SaiposImportStatus, 'processing'>;
  skipReason: string | null;
  saleId: string | null;
  membershipId: string | null;
  amountCents: number | null;
};

export type SaiposPorts = {
  findImport(saiposSaleId: string): Promise<SaiposImportRow | null>;
  /** Winner of a concurrent pull. Absent in tests. */
  claim?(saiposSaleId: string): Promise<'claimed' | 'busy'>;
  save(row: SaiposSave): Promise<void>;
  openClube(input: {
    phone: string;
    displayName: string | null;
    birthday: Date | null;
  }): Promise<{ membershipId: string }>;
  recordEarn(input: {
    membershipId: string;
    amountCents: number;
    saiposSaleId: string;
  }): Promise<{ ok: true; saleId: string } | { ok: false; error: string }>;
  reverse(input: {
    membershipId: string;
    saleId: string;
  }): Promise<'reversed' | 'blocked' | 'already'>;
};

export type ApplyResult = {
  action: 'ignore' | 'noop' | 'skip' | 'credit' | 'reverse' | 'reverse_blocked';
  reason?: string;
};

const PROCESSING_STALE_MS = 30 * 60 * 1000;

/**
 * One closed Saipos sale. A second pull of a credited sale does nothing.
 * A sale opened before the token was saved is ignored, unless we already
 * credited it and Saipos later canceled it.
 */
export async function applySaiposSale(
  input: { sale: unknown; connectedAt: Date },
  ports: SaiposPorts,
): Promise<ApplyResult> {
  const id = saiposSaleId(input.sale);
  const existing = id ? await ports.findImport(id) : null;
  if (
    existing?.status === 'processing' &&
    Date.now() - existing.updatedAt.getTime() < PROCESSING_STALE_MS
  ) {
    return { action: 'noop' };
  }

  const plan = planSaiposSale({
    sale: input.sale,
    connectedAt: input.connectedAt,
    existing,
  });

  if (plan.action === 'ignore' || plan.action === 'noop') {
    return { action: plan.action };
  }

  if (plan.action === 'skip') {
    if (id) {
      await ports.save({
        saiposSaleId: id,
        status: 'skipped',
        skipReason: plan.reason,
        saleId: existing?.saleId ?? null,
        membershipId: existing?.membershipId ?? null,
        amountCents: null,
      });
    }
    return { action: 'skip', reason: plan.reason };
  }

  if (plan.action === 'reverse') {
    if (!existing?.saleId || !existing.membershipId || !id) {
      return { action: 'noop' };
    }
    const outcome = await ports.reverse({
      membershipId: existing.membershipId,
      saleId: existing.saleId,
    });
    const blocked = outcome === 'blocked';
    await ports.save({
      saiposSaleId: id,
      status: blocked ? 'reverse_blocked' : 'reversed',
      skipReason: blocked ? 'used' : null,
      saleId: existing.saleId,
      membershipId: existing.membershipId,
      amountCents: null,
    });
    return { action: blocked ? 'reverse_blocked' : 'reverse' };
  }

  if (ports.claim && id) {
    const claim = await ports.claim(id);
    if (claim !== 'claimed') return { action: 'noop' };
  }

  const opened = await ports.openClube({
    phone: plan.phone,
    displayName: plan.displayName,
    birthday: plan.birthday ? new Date(`${plan.birthday}T00:00:00.000Z`) : null,
  });
  const earned = await ports.recordEarn({
    membershipId: opened.membershipId,
    amountCents: plan.amountCents,
    saiposSaleId: plan.saiposSaleId,
  });
  if (!earned.ok) {
    await ports.save({
      saiposSaleId: plan.saiposSaleId,
      status: 'skipped',
      skipReason: earned.error,
      saleId: null,
      membershipId: opened.membershipId,
      amountCents: plan.amountCents,
    });
    return { action: 'skip', reason: earned.error };
  }

  await ports.save({
    saiposSaleId: plan.saiposSaleId,
    status: 'credited',
    skipReason: null,
    saleId: earned.saleId,
    membershipId: opened.membershipId,
    amountCents: plan.amountCents,
  });
  return { action: 'credit' };
}
