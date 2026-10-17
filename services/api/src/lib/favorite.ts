import { prisma } from '@frego/db';

/** One Favorito. Mirrors onto the Clube when she already belongs there. */
export async function setCustomerFavorite(
  customerId: string,
  businessId: string,
  isFavorite: boolean,
): Promise<{ businessId: string; isFavorite: boolean } | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  if (!business) return null;

  if (isFavorite) {
    await prisma.favorite.upsert({
      where: {
        customerId_businessId: { customerId, businessId },
      },
      create: { customerId, businessId },
      update: {},
    });
  } else {
    await prisma.favorite.deleteMany({
      where: { customerId, businessId },
    });
  }

  await prisma.membership.updateMany({
    where: { customerId, businessId },
    data: { isFavorite },
  });

  return { businessId, isFavorite };
}
