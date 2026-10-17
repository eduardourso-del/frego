export type CityRef = {
  city: string;
  state: string;
};

/** Compare city names ignoring case, accents, and repeated spaces. */
export function foldCity(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizeUf(value: string): string | null {
  const uf = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(uf) ? uf : null;
}

export function sameCity(
  aCity: string,
  aState: string,
  bCity: string,
  bState: string,
): boolean {
  const aUf = normalizeUf(aState);
  const bUf = normalizeUf(bState);
  if (!aUf || !bUf || aUf !== bUf) return false;
  if (!foldCity(aCity) || !foldCity(bCity)) return false;
  return foldCity(aCity) === foldCity(bCity);
}

export function cityKey(city: string, state: string): string | null {
  const uf = normalizeUf(state);
  const folded = foldCity(city);
  if (!uf || !folded) return null;
  return `${folded}|${uf}`;
}

/** One label per city+UF. Prefer the accented spelling when both exist. */
export function pickCityLabel(spellings: string[]): string {
  const counts = new Map<string, number>();
  for (const raw of spellings) {
    const label = raw.trim().replace(/\s+/g, ' ');
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const aAccent = /[^\u0000-\u007f]/.test(a[0]) ? 1 : 0;
    const bAccent = /[^\u0000-\u007f]/.test(b[0]) ? 1 : 0;
    if (aAccent !== bAccent) return bAccent - aAccent;
    return a[0].localeCompare(b[0], 'pt-BR');
  });
  return ranked[0]?.[0] ?? '';
}

export function groupCities(
  rows: Array<{ city: string | null; state: string | null }>,
): CityRef[] {
  const groups = new Map<string, { state: string; spellings: string[] }>();
  for (const row of rows) {
    if (!row.city || !row.state) continue;
    const key = cityKey(row.city, row.state);
    if (!key) continue;
    const uf = normalizeUf(row.state)!;
    const current = groups.get(key) ?? { state: uf, spellings: [] };
    current.spellings.push(row.city);
    groups.set(key, current);
  }
  const cities = [...groups.values()]
    .map((group) => ({
      city: pickCityLabel(group.spellings),
      state: group.state,
    }))
    .filter((city) => city.city.length > 0);
  cities.sort((a, b) => {
    const byCity = a.city.localeCompare(b.city, 'pt-BR');
    if (byCity !== 0) return byCity;
    return a.state.localeCompare(b.state);
  });
  return cities;
}

export function findCity(cities: CityRef[], city: string, state: string): CityRef | null {
  return (
    cities.find((candidate) => sameCity(candidate.city, candidate.state, city, state)) ??
    null
  );
}
