import { prisma } from '@frego/db';
import { BUSINESS_TYPE_VALUES } from './business-type.js';
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

export type FeedPlace = {
  businessId: string;
  name: string;
  type: string;
  isFavorite: boolean;
};

export type FeedCampaign = {
  campaignId: string;
  businessId: string;
  businessName: string;
  name: string;
  type: string;
  canRedeem: boolean;
  isFavorite: boolean;
};

export type ExplorationFeedSection<P, C> = {
  type: string;
  places: P[];
  campaigns: C[];
};

export function explorationType(type: string | null | undefined): string {
  const value = type?.trim();
  return value ? value : 'outros';
}

export function typeSortIndex(type: string): number {
  const index = (BUSINESS_TYPE_VALUES as readonly string[]).indexOf(type);
  return index < 0 ? BUSINESS_TYPE_VALUES.length : index;
}

/** Cashback is Usar at the till, so it never counts as Resgatar-now. */
export function canRedeemNow(campaign: Pick<FeedCampaign, 'canRedeem' | 'type'>): boolean {
  return campaign.canRedeem && campaign.type !== 'cashback';
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR');
}

export function compareFeedPlaces(a: FeedPlace, b: FeedPlace): number {
  if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
  return compareNames(a.name, b.name);
}

export function compareFeedCampaigns(a: FeedCampaign, b: FeedCampaign): number {
  const aRedeem = canRedeemNow(a);
  const bRedeem = canRedeemNow(b);
  if (aRedeem !== bRedeem) return aRedeem ? -1 : 1;
  if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
  const aPromo = a.type === 'promo' ? 0 : 1;
  const bPromo = b.type === 'promo' ? 0 : 1;
  if (aPromo !== bPromo) return aPromo - bPromo;
  const byBusiness = compareNames(a.businessName, b.businessName);
  if (byBusiness !== 0) return byBusiness;
  return compareNames(a.name, b.name);
}

function sectionBucket(section: {
  places: FeedPlace[];
  campaigns: FeedCampaign[];
}): number {
  if (section.campaigns.some((campaign) => canRedeemNow(campaign))) return 0;
  if (section.places.some((place) => place.isFavorite)) return 1;
  return 2;
}

export function compareFeedSections(
  a: { type: string; places: FeedPlace[]; campaigns: FeedCampaign[] },
  b: { type: string; places: FeedPlace[]; campaigns: FeedCampaign[] },
): number {
  const byBucket = sectionBucket(a) - sectionBucket(b);
  if (byBucket !== 0) return byBucket;
  const byType = typeSortIndex(a.type) - typeSortIndex(b.type);
  if (byType !== 0) return byType;
  return compareNames(a.type, b.type);
}

/**
 * Relevância for one Cliente: Tipo sections, then the rows inside them.
 * A Tipo she can Resgatar comes first, then a Tipo with a Favorito, then
 * the fixed Tipo order. A Tipo that qualifies twice appears once.
 */
export function buildExplorationFeed<P extends FeedPlace, C extends FeedCampaign>(
  places: readonly P[],
  campaigns: readonly C[],
): ExplorationFeedSection<P, C>[] {
  const placeById = new Map(places.map((place) => [place.businessId, place]));
  const types = new Set(places.map((place) => explorationType(place.type)));
  const sections = [...types].map((type) => {
    const sectionPlaces = places
      .filter((place) => explorationType(place.type) === type)
      .sort(compareFeedPlaces);
    const sectionCampaigns = campaigns
      .filter((campaign) => {
        const place = placeById.get(campaign.businessId);
        return place != null && explorationType(place.type) === type;
      })
      .sort(compareFeedCampaigns);
    return { type, places: sectionPlaces, campaigns: sectionCampaigns };
  });
  sections.sort(compareFeedSections);
  return sections;
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
