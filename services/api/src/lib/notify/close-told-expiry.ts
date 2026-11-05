import { prisma } from '@frego/db';

/**
 * Turning Antecedência off closes a channel that has not landed
 * when the other channel already delivered that vencimento.
 */
export async function closeToldExpiryNotices(businessId: string): Promise<void> {
  await prisma.accountNotice.updateMany({
    where: {
      kind: 'expiry',
      pushState: 'sent',
      whatsappState: null,
      membership: { businessId },
    },
    data: { whatsappState: 'skipped' },
  });
  await prisma.accountNotice.updateMany({
    where: {
      kind: 'expiry',
      whatsappState: 'sent',
      pushState: null,
      membership: { businessId },
    },
    data: { pushState: 'skipped' },
  });
}
