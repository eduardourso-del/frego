import { z } from 'zod';
import { prisma } from '@frego/db';
import {
  formatOperatingAddress,
  normalizePostalCode,
  timeZoneForUf,
  type OperatingAddressInput,
} from './br-fuso.js';

export const operatingAddressSchema = z.object({
  postalCode: z.string().trim().max(12),
  street: z.string().trim().min(1).max(120),
  streetNumber: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(80).optional(),
  neighborhood: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().length(2),
});

export type ParsedOperatingAddress = OperatingAddressInput & {
  postalCode: string;
  complement: string | null;
  timeZone: string;
  line: string;
};

export function parseOperatingAddress(
  raw: z.infer<typeof operatingAddressSchema>,
): { ok: true; address: ParsedOperatingAddress } | { ok: false; error: 'INVALID_CEP' | 'INVALID_STATE' } {
  const postalCode = normalizePostalCode(raw.postalCode);
  if (!postalCode) return { ok: false, error: 'INVALID_CEP' };
  const state = raw.state.toUpperCase();
  const timeZone = timeZoneForUf(state);
  if (!timeZone) return { ok: false, error: 'INVALID_STATE' };
  const address: OperatingAddressInput = {
    postalCode,
    street: raw.street,
    streetNumber: raw.streetNumber,
    complement: raw.complement?.trim() || null,
    neighborhood: raw.neighborhood,
    city: raw.city,
    state,
  };
  return {
    ok: true,
    address: {
      ...address,
      complement: address.complement ?? null,
      timeZone,
      line: formatOperatingAddress(address),
    },
  };
}

export function locationAddressData(address: ParsedOperatingAddress) {
  return {
    postalCode: address.postalCode,
    street: address.street,
    streetNumber: address.streetNumber,
    complement: address.complement,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    address: address.line,
  };
}

/** Oldest unidade that has a UF. That is the one the till uses when a Membro has none. */
export function pickOperatingLocation(
  locations: Array<{ id: string; state: string | null }>,
): string | null {
  return (locations.find((location) => location.state) ?? locations[0])?.id ?? null;
}

export function pickStaffLocation(input: {
  requested?: string | null;
  memberLocationId?: string | null;
  operatingLocationId?: string | null;
}): string | null {
  return input.requested || input.memberLocationId || input.operatingLocationId || null;
}

export async function operatingLocationId(businessId: string): Promise<string | null> {
  const locations = await prisma.location.findMany({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, state: true },
  });
  return pickOperatingLocation(locations);
}

/**
 * The live till reads the unidade stored on the Membro and does not send one.
 * Fill it from the operating unidade once, and leave an existing assignment alone.
 */
export async function attachStaffLocation(member: {
  id: string;
  businessId: string;
  locationId: string | null;
}): Promise<string | null> {
  if (member.locationId) return member.locationId;
  const locationId = await operatingLocationId(member.businessId);
  if (!locationId) return null;
  await prisma.teamMember.updateMany({
    where: { id: member.id, locationId: null },
    data: { locationId },
  });
  return locationId;
}

/** Oldest unidade that has a UF sets the Estabelecimento Fuso. */
export async function syncBusinessFuso(businessId: string) {
  const locations = await prisma.location.findMany({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
    select: { state: true },
  });
  const timeZone = timeZoneForUf(locations.find((loc) => loc.state)?.state);
  await prisma.business.update({
    where: { id: businessId },
    data: { timeZone },
  });
  return timeZone;
}
