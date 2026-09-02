import { prisma } from '@frego/db';
import { deleteFirebaseUser } from './firebase.js';

const DELETED_PHONE_PREFIX = 'deleted:';

export function tombstonePhone(customerId: string): string {
  return `${DELETED_PHONE_PREFIX}${customerId}`;
}

export function isTombstonePhone(phoneE164: string): boolean {
  return phoneE164.startsWith(DELETED_PHONE_PREFIX);
}

/**
 * App Store 5.1.1(v) / LGPD erasure for the customer app.
 *
 * Deletes the Firebase Auth user first so the same session cannot recreate
 * the row, then strips PII. Memberships and the append-only ledger stay
 * under an anonymous tombstone so shops keep operational history.
 */
export async function deleteCustomerAccount(input: {
  customerId: string;
  firebaseUid: string | null;
}): Promise<void> {
  const existing = await prisma.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true, deletedAt: true, firebaseUid: true },
  });
  if (!existing || existing.deletedAt) return;

  const firebaseUid = input.firebaseUid ?? existing.firebaseUid;
  if (firebaseUid) {
    await deleteFirebaseUser(firebaseUid);
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.updateMany({
      where: { actorCustomerId: input.customerId },
      data: { actorCustomerId: null },
    });
    await tx.deviceToken.deleteMany({
      where: { customerId: input.customerId },
    });
    await tx.customer.update({
      where: { id: input.customerId },
      data: {
        phoneE164: tombstonePhone(input.customerId),
        phoneLast4: null,
        displayName: null,
        birthday: null,
        firebaseUid: null,
        notificationsEnabled: false,
        deletedAt: new Date(),
      },
    });
  });
}
