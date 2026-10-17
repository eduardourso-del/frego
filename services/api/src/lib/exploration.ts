import { prisma } from '@frego/db';
import { groupCities, type CityRef } from './city.js';
import { sameCity } from './city.js';

export const EXPLORATION_STATUSES = ['trial', 'active'] as const;

export async function listCatalogCities(): Promise<CityRef[]> {
  const rows = await prisma.location.findMany({
    where: {
      business: {
        explorationVisible: true,
        status: { in: [...EXPLORATION_STATUSES] },
      },
    },
    select: { city: true, state: true },
  });
  return groupCities(rows);
}

export type ExplorationCampaign = {
  id: string;
  type: string;
  cashbackPercent: number | null;
  rewardTitle: string | null;
  createdAt: Date;
  locationIds: string[];
};

export type ExplorationLocation = {
  id: string;
  city: string | null;
  state: string | null;
};

export function locationInCity(
  location: ExplorationLocation,
  city: CityRef,
): boolean {
  if (!location.city || !location.state) return false;
  return sameCity(location.city, location.state, city.city, city.state);
}

export function campaignAppliesToCity(
  campaign: Pick<ExplorationCampaign, 'locationIds'>,
  locations: ExplorationLocation[],
  city: CityRef,
): boolean {
  if (campaign.locationIds.length === 0) return true;
  return campaign.locationIds.some((locationId) => {
    const location = locations.find((item) => item.id === locationId);
    return location ? locationInCity(location, city) : false;
  });
}

export function orderLocationsForCity<T extends ExplorationLocation>(
  locations: T[],
  city: CityRef,
): T[] {
  return [...locations].sort((a, b) => {
    const aIn = locationInCity(a, city);
    const bIn = locationInCity(b, city);
    if (aIn !== bIn) return aIn ? -1 : 1;
    return 0;
  });
}

/**
 * Public line on an Exploração card. Highest cashback percent, otherwise
 * the first Prêmio in creation order that is not aniversário.
 */
export function leadLine(campaigns: ExplorationCampaign[]): string | null {
  const ordered = [...campaigns].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  ordered.sort((a, b) => {
    const aCash = a.type === 'cashback' ? 0 : 1;
    const bCash = b.type === 'cashback' ? 0 : 1;
    if (aCash !== bCash) return aCash - bCash;
    if (a.type === 'cashback' && b.type === 'cashback') {
      return (b.cashbackPercent ?? 0) - (a.cashbackPercent ?? 0);
    }
    return 0;
  });
  const first = ordered[0];
  if (!first) return null;
  if (first.type === 'cashback' && (first.cashbackPercent ?? 0) > 0) {
    return `${first.cashbackPercent}% de cashback`;
  }
  const prize = ordered.find(
    (campaign) =>
      campaign.type !== 'birthday' &&
      (campaign.rewardTitle?.trim().length ?? 0) > 0,
  );
  return prize?.rewardTitle?.trim() ?? null;
}

export function browsingCity(customer: {
  city: string | null;
  state: string | null;
  browseCity: string | null;
  browseState: string | null;
  browseCityChosen: boolean;
}): CityRef | null {
  if (
    customer.browseCityChosen &&
    customer.browseCity &&
    customer.browseState
  ) {
    return { city: customer.browseCity, state: customer.browseState };
  }
  if (customer.city && customer.state) {
    return { city: customer.city, state: customer.state };
  }
  return null;
}
