import { prisma } from '@frego/db';
import { geocodingKey, storeLocationPoint } from '../lib/geocode.js';

const key = geocodingKey();
if (!key) {
  console.error('Set GOOGLE_GEOCODING_API_KEY to geocode unidades.');
  process.exit(1);
}

const locations = await prisma.location.findMany({
  where: { OR: [{ latitude: null }, { longitude: null }] },
  select: { id: true, name: true, city: true },
  orderBy: { createdAt: 'asc' },
});

let stored = 0;
let missed = 0;
for (const location of locations) {
  const ok = await storeLocationPoint(location.id);
  if (ok) stored += 1;
  else {
    missed += 1;
    console.error(`no point for ${location.name} (${location.city ?? 'sem cidade'})`);
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}

console.log(`Geocoded ${stored} unidades. ${missed} kept the city center.`);
await prisma.$disconnect();
