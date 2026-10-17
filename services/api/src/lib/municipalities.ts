import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CityRef } from './city.js';

let cached: CityRef[] | null = null;

/** Every Brazilian municipality. Where a Cliente lives, not where a place is Visível. */
export function listMunicipalities(): CityRef[] {
  if (cached) return cached;
  const path = join(dirname(fileURLToPath(import.meta.url)), '../data/municipios.json');
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!Array.isArray(raw)) throw new Error('municipios.json is not a list');
  cached = raw.map((row) => {
    if (!row || typeof row !== 'object') throw new Error('bad municipio');
    const city = (row as { city?: unknown }).city;
    const state = (row as { state?: unknown }).state;
    if (typeof city !== 'string' || typeof state !== 'string' || !city || state.length !== 2) {
      throw new Error('bad municipio');
    }
    return { city, state };
  });
  return cached;
}
