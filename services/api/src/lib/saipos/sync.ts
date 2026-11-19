import { Prisma, prisma } from '@frego/db';
import { decryptToken } from '../whatsapp/crypto.js';
import { openClube } from '../open-clube.js';
import { recordSaleEarn } from '../record-sale.js';
import { reverseLedgerSale } from '../reverse-sale.js';
import { applySaiposSale, type SaiposImportRow, type SaiposSave } from './apply.js';
import { fetchSaiposSales } from './client.js';
import { saiposErrorForHouse } from './house-error.js';
import { saiposSaleId } from './sale.js';
import { saiposQueryWindow } from './window.js';

const SYNC_HOURS = [5, 13, 21];
/** 15 days of backlog at one day per slice, with the 6-hour overlap. */
const MAX_SLICES = 32;

type SyncLog = (msg: string, extra?: Record<string, unknown>) => void;

export { saiposQueryWindow };

/** Next 05:00, 13:00, or 21:00 in America/Sao_Paulo. */
export function msUntilNextSaiposSync(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  const year = n('year');
  const month = n('month');
  const day = n('day');
  const candidates: number[] = [];
  for (let offset = 0; offset <= 1; offset++) {
    for (const hour of SYNC_HOURS) {
      // 05:00 in São Paulo is 08:00 UTC while the zone stays at UTC−3.
      candidates.push(Date.UTC(year, month - 1, day + offset, hour + 3, 0, 0));
    }
  }
  const next = candidates.filter((time) => time > now.getTime() + 1000).sort((a, b) => a - b)[0];
  return Math.max(1000, (next ?? now.getTime() + 8 * 60 * 60 * 1000) - now.getTime());
}

function isUniqueConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

async function operatingLocationId(businessId: string): Promise<string | null> {
  const locations = await prisma.location.findMany({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, state: true },
  });
  return (locations.find((location) => location.state) ?? locations[0])?.id ?? null;
}

async function actorId(
  businessId: string,
  connectedByTeamMemberId: string | null,
): Promise<string | null> {
  if (connectedByTeamMemberId) {
    const member = await prisma.teamMember.findFirst({
      where: {
        id: connectedByTeamMemberId,
        businessId,
        status: 'active',
      },
      select: { id: true },
    });
    if (member) return member.id;
  }
  const fallback = await prisma.teamMember.findFirst({
    where: {
      businessId,
      status: 'active',
      role: { in: ['owner', 'manager'] },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return fallback?.id ?? null;
}

async function saveImport(businessId: string, row: SaiposSave): Promise<void> {
  await prisma.saiposSale.upsert({
    where: {
      businessId_saiposSaleId: {
        businessId,
        saiposSaleId: row.saiposSaleId,
      },
    },
    create: {
      businessId,
      saiposSaleId: row.saiposSaleId,
      status: row.status,
      skipReason: row.skipReason,
      saleId: row.saleId,
      membershipId: row.membershipId,
      amountCents: row.amountCents,
    },
    update: {
      status: row.status,
      skipReason: row.skipReason,
      saleId: row.saleId,
      membershipId: row.membershipId,
      amountCents: row.amountCents,
    },
  });
}

export async function syncSaiposConnection(
  connectionId: string,
  log?: SyncLog,
): Promise<{ ok: boolean; sales: number }> {
  const connection = await prisma.businessSaiposConnection.findUnique({
    where: { id: connectionId },
    include: { business: { select: { status: true, name: true } } },
  });
  if (!connection || connection.status === 'error') {
    return { ok: false, sales: 0 };
  }
  if (
    connection.business.status === 'pending' ||
    connection.business.status === 'suspended'
  ) {
    return { ok: false, sales: 0 };
  }

  const locationId = await operatingLocationId(connection.businessId);
  const actor = await actorId(
    connection.businessId,
    connection.connectedByTeamMemberId,
  );
  if (!locationId || !actor) {
    await prisma.businessSaiposConnection.update({
      where: { id: connection.id },
      data: {
        lastError: !locationId
          ? 'Cadastre o endereço da unidade antes de sincronizar.'
          : 'Nenhum responsável ativo para lançar a compra.',
        lastSyncAt: new Date(),
      },
    });
    return { ok: false, sales: 0 };
  }

  const now = new Date();
  let token: string;
  try {
    token = decryptToken(connection.tokenCiphertext, connection.tokenKeyVersion);
  } catch {
    await prisma.businessSaiposConnection.update({
      where: { id: connection.id },
      data: { status: 'error', lastError: 'Não foi possível ler o token.' },
    });
    return { ok: false, sales: 0 };
  }

  const businessId = connection.businessId;
  const connectedAt = connection.connectedAt;
  const saleLocationId = locationId;
  const saleActorId = actor;
  let cursor = connection.cursorUpdatedAt;
  let applied = 0;
  for (let slice = 0; slice < MAX_SLICES; slice++) {
    const window = saiposQueryWindow({
      connectedAt: connection.connectedAt,
      cursorUpdatedAt: cursor,
      now,
    });
    const pulled = await fetchSaiposSales(token, window.start, window.end);
    if (!pulled.ok) {
      const authFailed = pulled.status === 401 || pulled.status === 403;
      await prisma.businessSaiposConnection.update({
        where: { id: connection.id },
        data: {
          status: authFailed ? 'error' : connection.status,
          lastError: saiposErrorForHouse(pulled.message.slice(0, 400), connection.status),
          lastSyncAt: new Date(),
        },
      });
      log?.('saipos_sync_failed', {
        businessId: connection.businessId,
        status: pulled.status,
        sales: applied,
      });
      return { ok: false, sales: applied };
    }

    applied += await applyPulledSales(pulled.sales);
    await prisma.businessSaiposConnection.update({
      where: { id: connection.id },
      data: {
        status: 'connected',
        lastError: null,
        lastSyncAt: new Date(),
        cursorUpdatedAt: window.cursorNext,
      },
    });
    const advanced = window.cursorNext.getTime() > (cursor?.getTime() ?? 0);
    cursor = window.cursorNext;
    if (window.caughtUp || !advanced) break;
  }

  log?.('saipos_sync_done', {
    businessId: connection.businessId,
    sales: applied,
  });
  return { ok: true, sales: applied };

  async function applyPulledSales(sales: unknown[]): Promise<number> {
    let count = 0;
    for (const sale of sales) {
      const id = saiposSaleId(sale);
      if (!id) continue;
      count += 1;
      await applySaiposSale(
        { sale, connectedAt },
        {
        findImport: async (saiposSaleId) => {
          const row = await prisma.saiposSale.findUnique({
            where: {
              businessId_saiposSaleId: {
                businessId,
                saiposSaleId,
              },
            },
          });
          if (!row) return null;
          const found: SaiposImportRow = {
            status: row.status,
            saleId: row.saleId,
            membershipId: row.membershipId,
            updatedAt: row.updatedAt,
          };
          return found;
        },
        claim: async (saiposSaleId) => {
          const current = await prisma.saiposSale.findUnique({
            where: {
              businessId_saiposSaleId: {
                businessId,
                saiposSaleId,
              },
            },
          });
          if (
            current &&
            (current.status === 'credited' ||
              current.status === 'reversed' ||
              current.status === 'reverse_blocked')
          ) {
            return 'busy';
          }
          if (current?.status === 'processing') {
            const stale = Date.now() - current.updatedAt.getTime() > 30 * 60 * 1000;
            if (!stale) return 'busy';
            await prisma.saiposSale.update({
              where: { id: current.id },
              data: { updatedAt: new Date() },
            });
            return 'claimed';
          }
          if (current) {
            await prisma.saiposSale.update({
              where: { id: current.id },
              data: { status: 'processing', skipReason: null },
            });
            return 'claimed';
          }
          try {
            await prisma.saiposSale.create({
              data: {
                businessId,
                saiposSaleId,
                status: 'processing',
              },
            });
            return 'claimed';
          } catch (err) {
            if (isUniqueConflict(err)) return 'busy';
            throw err;
          }
        },
        save: (row) => saveImport(businessId, row),
        openClube: async (opened) => {
          const clube = await openClube({
            businessId,
            phone: opened.phone,
            displayName: opened.displayName,
            birthday: opened.birthday,
            log,
          });
          return { membershipId: clube.membership.id };
        },
        recordEarn: async (earn) => {
          const result = await recordSaleEarn({
            businessId,
            membershipId: earn.membershipId,
            locationId: saleLocationId,
            actorTeamMemberId: saleActorId,
            mode: {
              kind: 'amount',
              amountCents: earn.amountCents,
              saiposSaleId: earn.saiposSaleId,
            },
            log,
          });
          if (!result.ok) return { ok: false, error: result.error };
          return { ok: true, saleId: result.saleId };
        },
        reverse: async (undo) => {
          const result = await reverseLedgerSale({
            businessId,
            membershipId: undo.membershipId,
            saleId: undo.saleId,
            actorTeamMemberId: saleActorId,
            log,
          });
          if (result.ok) return 'reversed';
          if (result.error === 'ALREADY_REVERSED') return 'already';
          return 'blocked';
        },
      },
    );
    }
    return count;
  }
}

export async function runSaiposSync(log?: SyncLog): Promise<void> {
  const connections = await prisma.businessSaiposConnection.findMany({
    where: { status: 'connected' },
    select: { id: true },
  });
  for (const connection of connections) {
    try {
      await syncSaiposConnection(connection.id, log);
    } catch (err) {
      log?.('saipos_sync_connection_failed', {
        connectionId: connection.id,
        err: err instanceof Error ? err.message : 'failed',
      });
    }
  }
}

export function startSaiposSyncSchedule(log: {
  info: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}): void {
  if (process.env.SAIPOS_SYNC === '0') return;
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.SAIPOS_SYNC !== '1'
  ) {
    return;
  }
  const tick = () => {
    const wait = msUntilNextSaiposSync();
    const timer = setTimeout(() => {
      void runSaiposSync((msg, extra) => log.info(extra ?? {}, msg))
        .catch((err: unknown) => {
          log.error({ err }, 'saipos_sync_failed');
        })
        .finally(tick);
    }, wait);
    timer.unref?.();
    log.info({ waitMs: wait }, 'saipos_sync_scheduled');
  };
  tick();
}
