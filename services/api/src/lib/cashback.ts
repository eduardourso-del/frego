import { prisma } from '@frego/db';
import { membershipMatchesAudience, parseAudienceRules } from './audience.js';

export type CashbackEarnTarget = {
  campaignId: string;
  percent: number;
  audienceSegmentId: string | null;
};

/**
 * Campanha de cashback que vale nesta compra: elegível na audiência,
 * com a maior %. Empate: a mais específica (com audiência).
 */
export async function resolveCashbackEarn(
  membershipId: string,
  businessId: string,
): Promise<CashbackEarnTarget | null> {
  const campaigns = await prisma.campaign.findMany({
    where: { businessId, status: 'active', type: 'cashback' },
    select: {
      id: true,
      cashbackPercent: true,
      audienceSegmentId: true,
      audienceSegment: { select: { rules: true } },
    },
  });

  const eligible: CashbackEarnTarget[] = [];
  for (const c of campaigns) {
    const percent = c.cashbackPercent ?? 0;
    if (percent <= 0) continue;
    if (c.audienceSegment) {
      const ok = await membershipMatchesAudience(
        membershipId,
        businessId,
        parseAudienceRules(c.audienceSegment.rules),
      );
      if (!ok) continue;
    }
    eligible.push({
      campaignId: c.id,
      percent,
      audienceSegmentId: c.audienceSegmentId,
    });
  }

  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    if (b.percent !== a.percent) return b.percent - a.percent;
    const aSpecific = a.audienceSegmentId ? 1 : 0;
    const bSpecific = b.audienceSegmentId ? 1 : 0;
    return bSpecific - aSpecific;
  });
  return eligible[0] ?? null;
}
