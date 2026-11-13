import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cityKey, type CityRef } from './city.js';
import { haversineKm, type LatLng } from './geo.js';
import { listMunicipalities } from './municipalities.js';

let cached: Record<string, [number, number]> | null = null;

function load(): Record<string, [number, number]> {
  if (cached) return cached;
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    '../data/municipio-centroids.json',
  );
  cached = JSON.parse(readFileSync(path, 'utf8')) as Record<string, [number, number]>;
  return cached;
}

/** Center of a Brazilian municipality. Null when the city is not in the catalog. */
export function cityCenter(city: string, state: string): LatLng | null {
  const key = cityKey(city, state);
  if (!key) return null;
  const point = load()[key];
  if (!point) return null;
  return { latitude: point[0], longitude: point[1] };
}

/** The municipality whose center is closest to this point. */
export function nearestMunicipality(point: LatLng): CityRef | null {
  const centers = load();
  let bestKey: string | null = null;
  let bestKm = Infinity;
  for (const [key, coords] of Object.entries(centers)) {
    const km = haversineKm(point, { latitude: coords[0], longitude: coords[1] });
    if (km < bestKm) {
      bestKm = km;
      bestKey = key;
    }
  }
  if (!bestKey) return null;
  return (
    listMunicipalities().find((city) => cityKey(city.city, city.state) === bestKey) ??
    null
  );
}
