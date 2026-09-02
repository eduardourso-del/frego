import { prisma } from '@frego/db';

export async function replaceCustomerDeviceToken(input: {
  customerId: string;
  token: string;
  platform: string;
}): Promise<{ id: string; platform: string; updatedAt: Date }> {
  return prisma.$transaction(async (tx) => {
    await tx.deviceToken.deleteMany({
      where: {
        token: input.token,
        NOT: {
          customerId: input.customerId,
          platform: input.platform,
        },
      },
    });
    return tx.deviceToken.upsert({
      where: {
        customerId_platform: {
          customerId: input.customerId,
          platform: input.platform,
        },
      },
      create: {
        customerId: input.customerId,
        token: input.token,
        platform: input.platform,
      },
      update: { token: input.token },
      select: {
        id: true,
        platform: true,
        updatedAt: true,
      },
    });
  });
}

export async function deleteCustomerDeviceTokens(customerId: string) {
  await prisma.deviceToken.deleteMany({ where: { customerId } });
}
