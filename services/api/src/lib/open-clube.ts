import { prisma } from '@frego/db';
import { phoneLast4, toE164 } from './phone.js';
import { queueWelcomeWhatsAppForBusiness } from './whatsapp/welcome-notify.js';

export type OpenClubeLog = (msg: string, extra?: Record<string, unknown>) => void;

/**
 * Find the Cliente by phone, or create them and the Clube.
 * An empty name or birthday is filled. A name the Cliente already has stays.
 * A new Clube gets the welcome message.
 */
export async function openClube(input: {
  businessId: string;
  phone: string;
  displayName?: string | null;
  birthday?: Date | null;
  log?: OpenClubeLog;
}) {
  const phoneE164 = toE164(input.phone);
  const last4 = phoneLast4(phoneE164);
  const displayName = input.displayName?.trim() || null;
  const birthday =
    input.birthday && !Number.isNaN(input.birthday.getTime())
      ? input.birthday
      : null;

  let customer = await prisma.customer.upsert({
    where: { phoneE164 },
    create: {
      phoneE164,
      phoneLast4: last4,
      displayName,
      birthday: birthday ?? undefined,
    },
    update: {
      phoneLast4: last4,
    },
  });

  const patch: { displayName?: string; birthday?: Date } = {};
  if (!customer.displayName && displayName) patch.displayName = displayName;
  if (!customer.birthday && birthday) patch.birthday = birthday;
  if (Object.keys(patch).length > 0) {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: patch,
    });
  }

  const priorMembership = await prisma.membership.findUnique({
    where: {
      customerId_businessId: {
        customerId: customer.id,
        businessId: input.businessId,
      },
    },
    select: { id: true },
  });
  const created = !priorMembership;

  const existingFavorite = await prisma.favorite.findUnique({
    where: {
      customerId_businessId: {
        customerId: customer.id,
        businessId: input.businessId,
      },
    },
    select: { customerId: true },
  });

  const membership = await prisma.membership.upsert({
    where: {
      customerId_businessId: {
        customerId: customer.id,
        businessId: input.businessId,
      },
    },
    create: {
      customerId: customer.id,
      businessId: input.businessId,
      isFavorite: existingFavorite != null,
    },
    update: {},
  });

  if (created) {
    const business = await prisma.business.findUnique({
      where: { id: input.businessId },
      select: { name: true },
    });
    queueWelcomeWhatsAppForBusiness({
      businessId: input.businessId,
      businessName: business?.name ?? 'Frego',
      toE164: customer.phoneE164,
      customerName: customer.displayName,
      log: input.log,
    });
  }

  return { customer, membership, created };
}
