import { prisma } from '@frego/db';
import type { LatLng } from './geo.js';

const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

export type GeocodeTarget = {
  address?: string | null;
  postalCode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
};

export function geocodeQuery(location: GeocodeTarget): string | null {
  const structured = [
    location.street,
    location.streetNumber,
    location.neighborhood,
    location.city,
    location.state,
    location.postalCode,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  if (structured.length >= 2) return `${structured.join(', ')}, Brasil`;
  const line = location.address?.trim();
  if (!line) return null;
  return /brasil/i.test(line) ? line : `${line}, Brasil`;
}

export function geocodingKey(): string | null {
  const key = process.env.GOOGLE_GEOCODING_API_KEY?.trim();
  return key ? key : null;
}

export async function geocodeAddress(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LatLng | null> {
  const key = geocodingKey();
  if (!key) return null;
  const url = new URL(ENDPOINT);
  url.searchParams.set('address', query);
  url.searchParams.set('components', 'country:BR');
  url.searchParams.set('region', 'br');
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('key', key);
  let response: Response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
  } catch {
    console.error('geocode request failed');
    return null;
  }
  if (!response.ok) {
    console.error(`geocode http ${response.status}`);
    return null;
  }
  const body = (await response.json()) as {
    status?: string;
    results?: Array<{ geometry?: { location?: { lat?: unknown; lng?: unknown } } }>;
  };
  if (body.status !== 'OK') {
    if (body.status && body.status !== 'ZERO_RESULTS') {
      console.error(`geocode ${body.status}`);
    }
    return null;
  }
  const loc = body.results?.[0]?.geometry?.location;
  if (typeof loc?.lat !== 'number' || typeof loc.lng !== 'number') return null;
  return { latitude: loc.lat, longitude: loc.lng };
}

/**
 * Fill the unidade point from its address. Callers clear the old point when
 * the address changes, so a miss leaves Distância on the city center.
 */
export async function storeLocationPoint(locationId: string): Promise<boolean> {
  try {
    return await writeLocationPoint(locationId);
  } catch {
    console.error('geocode store failed');
    return false;
  }
}

async function writeLocationPoint(locationId: string): Promise<boolean> {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: {
      id: true,
      address: true,
      postalCode: true,
      street: true,
      streetNumber: true,
      neighborhood: true,
      city: true,
      state: true,
    },
  });
  if (!location) return false;
  const query = geocodeQuery(location);
  if (!query) return false;
  const point = await geocodeAddress(query);
  if (!point) return false;
  const written = await prisma.location.updateMany({
    where: {
      id: locationId,
      address: location.address,
      postalCode: location.postalCode,
      street: location.street,
      streetNumber: location.streetNumber,
      neighborhood: location.neighborhood,
      city: location.city,
      state: location.state,
    },
    data: { latitude: point.latitude, longitude: point.longitude },
  });
  return written.count > 0;
}
