import { prisma } from '@frego/db';

export const EARN_KINDS = ['stamps', 'points', 'cashback'] as const;
export type EarnKind = (typeof EARN_KINDS)[number];

const EARN_CAMPAIGN_TYPES = ['stamps', 'spend', 'cashback', 'visits'] as const;

export function earnKindFromCampaignType(type: string): EarnKind | null {
  if (type === 'stamps' || type === 'visits') return 'stamps';
  if (type === 'spend') return 'points';
  if (type === 'cashback') return 'cashback';
  return null;
}

export function earnKindsFromCampaignTypes(types: Iterable<string>): EarnKind[] {
  const set = new Set<EarnKind>();
  for (const type of types) {
    const kind = earnKindFromCampaignType(type);
    if (kind) set.add(kind);
  }
  return EARN_KINDS.filter((kind) => set.has(kind));
}

export async function activeEarnKindsForBusiness(
  businessId: string,
): Promise<EarnKind[]> {
  const rows = await prisma.campaign.findMany({
    where: {
      businessId,
      status: 'active',
      type: { in: [...EARN_CAMPAIGN_TYPES] },
    },
    select: { type: true },
  });
  return earnKindsFromCampaignTypes(rows.map((row) => row.type));
}

export async function activeEarnKindsByBusinessIds(
  businessIds: string[],
): Promise<Map<string, EarnKind[]>> {
  const map = new Map<string, EarnKind[]>();
  for (const id of businessIds) map.set(id, []);
  if (businessIds.length === 0) return map;

  const rows = await prisma.campaign.findMany({
    where: {
      businessId: { in: businessIds },
      status: 'active',
      type: { in: [...EARN_CAMPAIGN_TYPES] },
    },
    select: { businessId: true, type: true },
  });

  const sets = new Map<string, Set<EarnKind>>();
  for (const id of businessIds) sets.set(id, new Set());
  for (const row of rows) {
    const kind = earnKindFromCampaignType(row.type);
    if (kind) sets.get(row.businessId)?.add(kind);
  }
  for (const id of businessIds) {
    const set = sets.get(id) ?? new Set<EarnKind>();
    map.set(id, EARN_KINDS.filter((kind) => set.has(kind)));
  }
  return map;
}
