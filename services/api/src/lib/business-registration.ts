import { Prisma, prisma } from '@frego/db';
import {
  locationAddressData,
  parseOperatingAddress,
  operatingAddressSchema,
} from './operating-address.js';

/** A Cadastro that sits this long without a confirmed inbox is discarded. */
export const BUSINESS_APPLICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function cadastroAwaitsEmail(emailVerified: boolean) {
  return !emailVerified;
}

export function businessApplicationExpired(updatedAt: Date, now = new Date()) {
  return now.getTime() - updatedAt.getTime() > BUSINESS_APPLICATION_TTL_MS;
}

export type CadastroInput = {
  ownerName: string;
  businessName: string;
  type: string;
  slogan: string | null;
  cnpj: string | null;
  primaryColor: string;
  primaryColorDark: string;
  locationName: string;
  slug?: string;
  address: {
    postalCode: string;
    street: string;
    streetNumber: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
    timeZone: string;
    line: string;
  };
};

export type RegistrationBody = {
  business: {
    id: string;
    name: string;
    status: string;
    slug: string | null;
    type: string;
  };
  location: { id: string; name: string };
  message: string;
};

type Fail = { ok: false; status: number; error: string };
type Ok = { ok: true; status: 201; body: RegistrationBody };

const CREATED_MESSAGE =
  'Cadastro enviado. A equipe Frego vai revisar e aprovar seu estabelecimento.';

function slugify(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function addressFromStored(
  value: unknown,
):
  | { ok: true; address: CadastroInput['address'] }
  | { ok: false; error: 'INVALID_CEP' | 'INVALID_STATE' } {
  if (!value || typeof value !== 'object') {
    return { ok: false, error: 'INVALID_STATE' };
  }
  const raw = value as Record<string, unknown>;
  const parsed = operatingAddressSchema.safeParse({
    ...raw,
    complement: typeof raw.complement === 'string' ? raw.complement : undefined,
  });
  if (!parsed.success) return { ok: false, error: 'INVALID_STATE' };
  const address = parseOperatingAddress(parsed.data);
  if (!address.ok) return address;
  return { ok: true, address: address.address };
}

function storedAddress(address: CadastroInput['address']) {
  return {
    postalCode: address.postalCode,
    street: address.street,
    streetNumber: address.streetNumber,
    complement: address.complement ?? '',
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
  };
}

export async function registrationBlock(user: { uid: string; email: string }) {
  const existingMember = await prisma.teamMember.findFirst({
    where: {
      status: { in: ['active', 'pending'] },
      OR: [{ firebaseUid: user.uid }, { email: user.email }],
    },
  });
  if (existingMember) {
    return { status: 409, error: 'ALREADY_HAS_BUSINESS' as const };
  }

  const existingAdmin = await prisma.platformAdmin.findFirst({
    where: {
      OR: [{ firebaseUid: user.uid }, { email: user.email }],
    },
  });
  if (existingAdmin) {
    return { status: 403, error: 'PLATFORM_ADMIN_CANNOT_REGISTER' as const };
  }

  return null;
}

export async function cnpjAlreadyUsed(cnpj: string) {
  const taken = await prisma.business.findUnique({ where: { cnpj } });
  return Boolean(taken);
}

export async function holdCadastro(
  user: { uid: string; email: string },
  input: CadastroInput,
) {
  const data = {
    email: user.email,
    ownerName: input.ownerName,
    businessName: input.businessName,
    type: input.type,
    slogan: input.slogan,
    cnpj: input.cnpj,
    primaryColor: input.primaryColor,
    primaryColorDark: input.primaryColorDark,
    locationName: input.locationName,
    address: storedAddress(input.address),
  };
  await prisma.businessApplication.upsert({
    where: { firebaseUid: user.uid },
    create: { firebaseUid: user.uid, ...data },
    update: data,
  });
}

export async function loadCadastro(uid: string) {
  const application = await prisma.businessApplication.findUnique({
    where: { firebaseUid: uid },
  });
  if (!application) return null;
  return {
    email: application.email,
    businessName: application.businessName,
    ownerName: application.ownerName,
    expired: businessApplicationExpired(application.updatedAt),
  };
}

async function insertEstablishment(
  tx: Prisma.TransactionClient,
  user: { uid: string; email: string },
  input: CadastroInput,
  planId: string,
): Promise<RegistrationBody> {
  let slug = input.slug || slugify(input.businessName);
  if (!slug) slug = `loja-${Date.now().toString(36)}`;
  const slugTaken = await tx.business.findUnique({ where: { slug } });
  if (slugTaken) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const business = await tx.business.create({
    data: {
      name: input.businessName,
      type: input.type,
      status: 'pending',
      slogan: input.slogan,
      cnpj: input.cnpj,
      primaryColor: input.primaryColor,
      primaryColorDark: input.primaryColorDark,
      slug,
      timeZone: input.address.timeZone,
    },
  });

  await tx.billingAccount.create({
    data: {
      businessId: business.id,
      planId,
      status: 'pending',
      mrrCents: 0,
    },
  });

  const location = await tx.location.create({
    data: {
      businessId: business.id,
      name: input.locationName,
      ...locationAddressData(input.address),
      isOpen: true,
    },
  });

  await tx.teamMember.create({
    data: {
      businessId: business.id,
      locationId: location.id,
      firebaseUid: user.uid,
      email: user.email,
      displayName: input.ownerName,
      role: 'owner',
      status: 'active',
    },
  });

  return {
    business: {
      id: business.id,
      name: business.name,
      status: business.status,
      slug: business.slug,
      type: business.type,
    },
    location: { id: location.id, name: location.name },
    message: CREATED_MESSAGE,
  };
}

async function openInside(
  tx: Prisma.TransactionClient,
  user: { uid: string; email: string },
  input: CadastroInput,
): Promise<Ok | Fail> {
  const trialPlan = await tx.plan.findUnique({ where: { tier: 'trial' } });
  if (!trialPlan) {
    return { ok: false, status: 500, error: 'TRIAL_PLAN_MISSING' };
  }
  if (input.cnpj) {
    const taken = await tx.business.findUnique({ where: { cnpj: input.cnpj } });
    if (taken) return { ok: false, status: 409, error: 'CNPJ_TAKEN' };
  }
  await tx.businessApplication.deleteMany({ where: { firebaseUid: user.uid } });
  const body = await insertEstablishment(tx, user, input, trialPlan.id);
  return { ok: true, status: 201, body };
}

export async function openCadastro(
  user: { uid: string; email: string },
  input: CadastroInput,
): Promise<Ok | Fail> {
  const block = await registrationBlock(user);
  if (block?.error === 'ALREADY_HAS_BUSINESS') {
    await prisma.businessApplication.deleteMany({
      where: { firebaseUid: user.uid },
    });
  }
  if (block) return { ok: false, ...block };

  return prisma.$transaction((tx) => openInside(tx, user, input));
}

function isMissingRow(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025'
  );
}

export async function confirmCadastro(user: {
  uid: string;
  email: string;
  emailVerified: boolean;
}): Promise<Ok | Fail> {
  if (!user.emailVerified) {
    return { ok: false, status: 403, error: 'EMAIL_NOT_VERIFIED' };
  }

  const block = await registrationBlock(user);
  if (block?.error === 'ALREADY_HAS_BUSINESS') {
    await prisma.businessApplication.deleteMany({
      where: { firebaseUid: user.uid },
    });
  }
  if (block) return { ok: false, ...block };

  try {
    return await prisma.$transaction(async (tx) => {
      const application = await tx.businessApplication.findUnique({
        where: { firebaseUid: user.uid },
      });
      if (!application) {
        return { ok: false, status: 404, error: 'APPLICATION_NOT_FOUND' };
      }
      if (businessApplicationExpired(application.updatedAt)) {
        await tx.businessApplication.delete({ where: { id: application.id } });
        return { ok: false, status: 410, error: 'APPLICATION_EXPIRED' };
      }

      const parsed = addressFromStored(application.address);
      if (!parsed.ok) {
        return { ok: false, status: 400, error: parsed.error };
      }

      const input: CadastroInput = {
        ownerName: application.ownerName,
        businessName: application.businessName,
        type: application.type,
        slogan: application.slogan,
        cnpj: application.cnpj,
        primaryColor: application.primaryColor,
        primaryColorDark: application.primaryColorDark,
        locationName: application.locationName,
        address: parsed.address,
      };

      const trialPlan = await tx.plan.findUnique({ where: { tier: 'trial' } });
      if (!trialPlan) {
        return { ok: false, status: 500, error: 'TRIAL_PLAN_MISSING' };
      }
      if (input.cnpj) {
        const taken = await tx.business.findUnique({ where: { cnpj: input.cnpj } });
        if (taken) return { ok: false, status: 409, error: 'CNPJ_TAKEN' };
      }

      await tx.businessApplication.delete({ where: { id: application.id } });
      const body = await insertEstablishment(tx, user, input, trialPlan.id);
      return { ok: true, status: 201, body };
    });
  } catch (err) {
    if (!isMissingRow(err)) throw err;
    const again = await registrationBlock(user);
    if (again) return { ok: false, ...again };
    return { ok: false, status: 404, error: 'APPLICATION_NOT_FOUND' };
  }
}
