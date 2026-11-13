import { prisma } from '@frego/db';
import { BUSINESS_TYPE_VALUES } from './business-type.js';
import { cityCenter } from './centroids.js';
import { groupCities, sameCity, type CityRef } from './city.js';
import { displayDistanceKm, EXPLORATION_RADIUS_KM, haversineKm, type LatLng } from './geo.js';

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
  latitude?: number | null;
  longitude?: number | null;
};

export function locationInCity(
  location: ExplorationLocation,
  city: CityRef,
): boolean {
  if (!location.city || !location.state) return false;
  return sameCity(location.city, location.state, city.city, city.state);
}

function locationPoint(location: ExplorationLocation): LatLng | null {
  if (
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number' &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  ) {
    return { latitude: location.latitude, longitude: location.longitude };
  }
  if (!location.city || !location.state) return null;
  return cityCenter(location.city, location.state);
}

function distanceKmBetween(
  location: ExplorationLocation,
  origin: LatLng,
): number | null {
  const point = locationPoint(location);
  if (!point) return null;
  return haversineKm(origin, point);
}

/** Kilometers from the browsed city's center to this unidade. Null when either point is missing. */
export function distanceKmFromCity(
  location: ExplorationLocation,
  city: CityRef,
): number | null {
  const origin = cityCenter(city.city, city.state);
  if (!origin) return null;
  return distanceKmBetween(location, origin);
}

/** Whole kilometers from a phone position to this unidade. Null when the unidade has no point. */
export function displayKmFrom(
  location: ExplorationLocation,
  origin: LatLng,
): number | null {
  const km = distanceKmBetween(location, origin);
  if (km == null) return null;
  return displayDistanceKm(km);
}

/**
 * A unidade in the browsed city always counts. Any other unidade counts when
 * it sits within 15 km of that city's center.
 */
export function locationInExploration(
  location: ExplorationLocation,
  city: CityRef,
): boolean {
  if (locationInCity(location, city)) return true;
  const km = distanceKmFromCity(location, city);
  return km != null && km <= EXPLORATION_RADIUS_KM;
}

/**
 * Card label for the nearest unidade inside the ring.
 * From the phone, every unidade has kilometers, and a unidade in the browsed
 * city omits its name. From the city center, a nearest unidade in that city
 * has no label. Whole kilometers, and never 0.
 */
export function explorationDistanceLabel(
  locations: ExplorationLocation[],
  city: CityRef,
  origin?: LatLng | null,
): { city: string | null; distanceKm: number } | null {
  const inside = locations
    .filter((location) => locationInExploration(location, city))
    .map((location) => ({
      location,
      km: origin
        ? distanceKmBetween(location, origin)
        : distanceKmFromCity(location, city),
    }))
    .sort((a, b) => {
      if (a.km == null && b.km == null) return 0;
      if (a.km == null) return 1;
      if (b.km == null) return -1;
      return a.km - b.km;
    });
  const nearest = inside[0];
  if (!nearest || nearest.km == null) return null;
  const same = locationInCity(nearest.location, city);
  if (same && !origin) return null;
  if (same) return { city: null, distanceKm: displayDistanceKm(nearest.km) };
  const name = nearest.location.city?.trim();
  if (!name) return null;
  return { city: name, distanceKm: displayDistanceKm(nearest.km) };
}

/**
 * Place-page kilometers. From the phone, a unidade in the browsed city still
 * has them. From the city center, that unidade has none.
 */
export function locationDistanceLabelKm(
  location: ExplorationLocation,
  city: CityRef,
  origin?: LatLng | null,
): number | null {
  if (!origin && locationInCity(location, city)) return null;
  const km = origin
    ? distanceKmBetween(location, origin)
    : distanceKmFromCity(location, city);
  if (km == null) return null;
  return displayDistanceKm(km);
}

export function campaignAppliesToCity(
  campaign: Pick<ExplorationCampaign, 'locationIds'>,
  locations: ExplorationLocation[],
  city: CityRef,
): boolean {
  if (campaign.locationIds.length === 0) return true;
  return campaign.locationIds.some((locationId) => {
    const location = locations.find((item) => item.id === locationId);
    return location ? locationInExploration(location, city) : false;
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
    const aKm = distanceKmFromCity(a, city);
    const bKm = distanceKmFromCity(b, city);
    if (aKm == null && bKm == null) return 0;
    if (aKm == null) return 1;
    if (bKm == null) return -1;
    return aKm - bKm;
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
