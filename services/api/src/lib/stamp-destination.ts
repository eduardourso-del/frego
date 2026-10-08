import { prisma } from '@frego/db';

export type StampDestination = {
  /** Null on the shared pile. A Cartela uses its Campanha id. */
  campaignId: string | null;
  label: string;
  balance: number;
  cartela: boolean;
  /** Staff can stamp this row. A shared balance can wait with no active Campanha. */
  earnable: boolean;
};

export type StampCampaignRow = {
  id: string;
  name: string;
  type: string;
  cartela: boolean;
};

const SHARED_LABEL = 'Carimbos';

export function isCartelaCampaign(row: {
  type: string;
  cartela: boolean;
}): boolean {
  return row.type === 'stamps' && row.cartela;
}

/** Earn rows for the till, balances filled in by the wallet when a customer is loaded. */
export function earnStampDestinations(
  campaigns: StampCampaignRow[],
): StampDestination[] {
  return buildStampDestinations({
    sharedBalance: 0,
    activeShared: campaigns
      .filter((c) => c.type === 'stamps' || c.type === 'visits')
      .filter((c) => !isCartelaCampaign(c))
      .map((c) => ({ id: c.id, name: c.name })),
    activeCartelas: campaigns
      .filter((c) => isCartelaCampaign(c))
      .map((c) => ({ id: c.id, name: c.name, balance: 0 })),
  });
}

export function buildStampDestinations(input: {
  sharedBalance: number;
  activeShared: Array<{ id: string; name: string }>;
  activeCartelas: Array<{ id: string; name: string; balance: number }>;
}): StampDestination[] {
  const rows: StampDestination[] = [];
  const sharedActive = input.activeShared.length > 0;
  if (sharedActive || input.sharedBalance > 0) {
    rows.push({
      campaignId: null,
      label:
        input.activeShared.length === 1
          ? input.activeShared[0]!.name
          : SHARED_LABEL,
      balance: input.sharedBalance,
      cartela: false,
      earnable: sharedActive,
    });
  }
  for (const cartela of input.activeCartelas) {
    rows.push({
      campaignId: cartela.id,
      label: cartela.name,
      balance: cartela.balance,
      cartela: true,
      earnable: true,
    });
  }
  return rows;
}

export type StampEarnResolution =
  | { ok: true; campaignId: string | null }
  | { ok: false; error: string; message: string };

/**
 * `requested` is a Cartela id, or `'shared'` for the shared pile.
 * Omitted only when the business has a single earnable destination.
 */
export function resolveStampEarnCampaignId(
  destinations: StampDestination[],
  requested: string | null | undefined,
): StampEarnResolution {
  const earnable = destinations.filter((d) => d.earnable);
  if (earnable.length === 0) {
    return {
      ok: false,
      error: 'EARN_KIND_INACTIVE',
      message: 'Esta loja não tem campanha de carimbos ativa.',
    };
  }

  if (requested == null || requested === '') {
    if (earnable.length === 1) {
      return { ok: true, campaignId: earnable[0]!.campaignId };
    }
    return {
      ok: false,
      error: 'STAMP_DESTINATION_REQUIRED',
      message: 'Escolha onde o carimbo entra.',
    };
  }

  if (requested === 'shared') {
    const shared = earnable.find((d) => !d.cartela);
    if (!shared) {
      return {
        ok: false,
        error: 'STAMP_DESTINATION_INVALID',
        message: 'Essa campanha não recebe carimbos.',
      };
    }
    return { ok: true, campaignId: null };
  }

  const cartela = earnable.find(
    (d) => d.cartela && d.campaignId === requested,
  );
  if (!cartela) {
    return {
      ok: false,
      error: 'STAMP_DESTINATION_INVALID',
      message: 'Essa campanha não recebe carimbos.',
    };
  }
  return { ok: true, campaignId: cartela.campaignId };
}

export function resolveCartelaWrite(input: {
  nextType: string;
  requested: boolean | undefined;
  existing: { type: string; cartela: boolean; activatedAt: Date | null } | null;
}): { ok: true; cartela: boolean } | { ok: false; error: string; message: string } {
  const locked = input.existing?.activatedAt != null;
  const current = input.existing?.cartela ?? false;

  if (locked) {
    if (input.requested !== undefined && input.requested !== current) {
      return {
        ok: false,
        error: 'CARTELA_LOCKED',
        message: 'A cartela não muda depois que a campanha foi ativada.',
      };
    }
    if (input.nextType !== 'stamps' && current) {
      return {
        ok: false,
        error: 'CARTELA_LOCKED',
        message: 'A cartela não muda depois que a campanha foi ativada.',
      };
    }
    return { ok: true, cartela: current && input.nextType === 'stamps' };
  }

  if (input.nextType !== 'stamps') {
    if (input.requested) {
      return {
        ok: false,
        error: 'CARTELA_STAMPS_ONLY',
        message: 'Cartela é só para campanha de carimbos.',
      };
    }
    return { ok: true, cartela: false };
  }

  return { ok: true, cartela: input.requested ?? current };
}

export async function loadEarnStampDestinations(businessId: string) {
  const rows = await prisma.campaign.findMany({
    where: {
      businessId,
      status: 'active',
      type: { in: ['stamps', 'visits'] },
    },
    select: { id: true, name: true, type: true, cartela: true },
    orderBy: { createdAt: 'asc' },
  });
  return earnStampDestinations(rows);
}

export function nextActivatedAt(
  existing: Date | null | undefined,
  nextStatus: string,
  now = new Date(),
): Date | null {
  if (existing) return existing;
  if (nextStatus === 'active') return now;
  return null;
}
