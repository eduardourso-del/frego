export const EXPLORATION_RADIUS_KM = 15;

export type LatLng = {
  latitude: number;
  longitude: number;
};

export function haversineKm(a: LatLng, b: LatLng): number {
  const earthKm = 6371;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Whole kilometers. A distance that would round to 0 is shown as 1 km. */
export function displayDistanceKm(km: number): number {
  return Math.max(1, Math.round(km));
}

/** A phone position from a query. Null when either coordinate is missing or out of range. */
export function parseOrigin(lat: unknown, lng: unknown): LatLng | null {
  if (lat == null || lng == null || lat === '' || lng === '') return null;
  const latitude = typeof lat === 'number' ? lat : Number(lat);
  const longitude = typeof lng === 'number' ? lng : Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}
