import { randomBytes } from 'node:crypto';
import { Prisma, prisma } from '@frego/db';
import { membershipMatchesAudience, parseAudienceRules } from './audience.js';
import { shouldOmitFromLedger } from './ledger-meta.js';
import {
  answersMatchSnapshot,
  audienceAllowsConvite,
  buildSnapshot,
  convitePublicUrl,
  destinationActive,
  parsePesquisaWrite,
  creditsFromEarnRows,
  parseSnapshot,
  purchaseLine,
  resolveConviteBonus,
  salePaysBonus,
  shouldOpenConvite,
  submitGate,
  walletBonusLabel,
  type ConviteSnapshot,
  type DestinationCampaign,
  type PesquisaWrite,
  type Polegar,
} from './pesquisa.js';

function newToken(): string {
  return randomBytes(18).toString('base64url');
}

async function loadDestinations(businessId: string): Promise<DestinationCampaign[]> {
  const rows = await prisma.campaign.findMany({
    where: { businessId },
    select: { id: true, name: true, type: true, status: true, cartela: true },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    cartela: row.cartela,
  }));
}

export async function listPesquisaDestinations(businessId: string) {
  const campaigns = await loadDestinations(businessId);
  const active = campaigns.filter((c) => c.status === 'active');
  return {
    sharedStamps: active.some(
      (c) => (c.type === 'stamps' || c.type === 'visits') && !c.cartela,
    ),
    cartelas: active
      .filter((c) => c.type === 'stamps' && c.cartela)
      .map((c) => ({ id: c.id, name: c.name })),
    points: active.some((c) => c.type === 'spend'),
    cashback: active.some((c) => c.type === 'cashback'),
  };
}

export async function listPesquisas(businessId: string) {
  const [rows, destinations] = await Promise.all([
    prisma.pesquisa.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: {
        questions: { orderBy: { position: 'asc' } },
        bonusCampaign: { select: { id: true, name: true } },
        audienceSegment: { select: { id: true, name: true } },
        _count: { select: { respostas: true } },
      },
    }),
    listPesquisaDestinations(businessId),
  ]);
  return {
    destinations,
    pesquisas: rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      notePrompt: row.notePrompt,
      bonusEnabled: row.bonusEnabled,
      bonusKind: row.bonusKind,
      bonusMode: row.bonusMode,
      bonusQuantity: row.bonusQuantity,
      bonusCampaignId: row.bonusCampaignId,
      bonusCampaignName: row.bonusCampaign?.name ?? null,
      audienceSegmentId: row.audienceSegmentId,
      audienceSegmentName: row.audienceSegment?.name ?? null,
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      questions: row.questions.map((q) => ({
        position: q.position,
        prompt: q.prompt,
      })),
      respostaCount: row._count.respostas,
    })),
  };
}

export async function getPesquisaDetail(businessId: string, pesquisaId: string) {
  const row = await prisma.pesquisa.findFirst({
    where: { id: pesquisaId, businessId },
    include: {
      questions: { orderBy: { position: 'asc' } },
      bonusCampaign: { select: { name: true } },
      audienceSegment: { select: { name: true } },
      respostas: {
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { displayName: true, phoneE164: true } },
          answers: { orderBy: { position: 'asc' } },
        },
      },
    },
  });
  if (!row) return null;

  const counts = row.questions.map((q) => {
    const answers = row.respostas.flatMap((r) =>
      r.answers.filter((a) => a.position === q.position),
    );
    return {
      position: q.position,
      prompt: q.prompt,
      up: answers.filter((a) => a.value === 'up').length,
      down: answers.filter((a) => a.value === 'down').length,
    };
  });

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    notePrompt: row.notePrompt,
    bonusEnabled: row.bonusEnabled,
    bonusKind: row.bonusKind,
    bonusMode: row.bonusMode,
    bonusQuantity: row.bonusQuantity,
    bonusCampaignId: row.bonusCampaignId,
    bonusCampaignName: row.bonusCampaign?.name ?? null,
    audienceSegmentId: row.audienceSegmentId,
    audienceSegmentName: row.audienceSegment?.name ?? null,
    questions: row.questions.map((q) => ({ position: q.position, prompt: q.prompt })),
    counts,
    respostas: row.respostas.map((r) => ({
      id: r.id,
      note: r.note,
      createdAt: r.createdAt,
      customerName: r.customer.displayName,
      phoneE164: r.customer.phoneE164,
      bonusLanded: r.bonusTransactionId != null,
      answers: r.answers.map((a) => ({
        position: a.position,
        prompt: a.prompt,
        value: a.value,
      })),
    })),
  };
}

async function replaceQuestions(
  tx: Prisma.TransactionClient,
  pesquisaId: string,
  questions: { prompt: string }[],
) {
  await tx.pesquisaQuestion.deleteMany({ where: { pesquisaId } });
  if (questions.length === 0) return;
  await tx.pesquisaQuestion.createMany({
    data: questions.map((q, position) => ({
      pesquisaId,
      position,
      prompt: q.prompt,
    })),
  });
}

async function closeUnanswered(tx: Prisma.TransactionClient, pesquisaId: string) {
  await tx.convite.updateMany({
    where: { pesquisaId, status: { in: ['open', 'replaced'] } },
    data: { status: 'closed', closedAt: new Date() },
  });
}

export async function savePesquisa(input: {
  businessId: string;
  pesquisaId?: string | null;
  write: PesquisaWrite;
}) {
  const campaigns = await loadDestinations(input.businessId);
  const parsed = parsePesquisaWrite(input.write, campaigns);
  if (!parsed.ok) return parsed;

  const value = parsed.value;
  if (value.audienceSegmentId) {
    const segment = await prisma.audienceSegment.findFirst({
      where: { id: value.audienceSegmentId, businessId: input.businessId },
      select: { id: true },
    });
    if (!segment) {
      return {
        ok: false as const,
        error: 'AUDIENCE',
        message: 'Escolha uma audiência desta casa.',
      };
    }
  }
  if (value.status === 'active') {
    const other = await prisma.pesquisa.findFirst({
      where: {
        businessId: input.businessId,
        status: 'active',
        ...(input.pesquisaId ? { NOT: { id: input.pesquisaId } } : {}),
      },
      select: { id: true },
    });
    if (other) {
      return {
        ok: false as const,
        error: 'ONE_ACTIVE',
        message: 'Arquive a Pesquisa ativa antes de ligar outra.',
      };
    }
  }

  const openOther = await prisma.pesquisa.findFirst({
    where: {
      businessId: input.businessId,
      status: { in: ['draft', 'active'] },
      ...(input.pesquisaId ? { NOT: { id: input.pesquisaId } } : {}),
    },
    select: { id: true },
  });
  if (!input.pesquisaId && openOther) {
    return {
      ok: false as const,
      error: 'ONE_OPEN',
      message: 'Arquive a Pesquisa atual antes de criar outra.',
    };
  }

  try {
    const saved = await prisma.$transaction(async (tx) => {
      if (!input.pesquisaId) {
        const created = await tx.pesquisa.create({
          data: {
            businessId: input.businessId,
            name: value.name,
            status: value.status,
            notePrompt: value.notePrompt,
            bonusEnabled: value.bonusEnabled,
            bonusKind: value.bonusKind,
            bonusMode: value.bonusMode,
            bonusQuantity: value.bonusQuantity,
            bonusCampaignId: value.bonusCampaignId,
            audienceSegmentId: value.audienceSegmentId,
          },
        });
        await replaceQuestions(tx, created.id, value.questions);
        return created;
      }

      const existing = await tx.pesquisa.findFirst({
        where: { id: input.pesquisaId, businessId: input.businessId },
      });
      if (!existing || existing.status === 'archived') return null;

      const turningOff =
        existing.status === 'active' && value.status === 'draft';
      const updated = await tx.pesquisa.update({
        where: { id: existing.id },
        data: {
          name: value.name,
          status: value.status,
          notePrompt: value.notePrompt,
          bonusEnabled: value.bonusEnabled,
          bonusKind: value.bonusKind,
          bonusMode: value.bonusMode,
          bonusQuantity: value.bonusQuantity,
          bonusCampaignId: value.bonusCampaignId,
          audienceSegmentId: value.audienceSegmentId,
        },
      });
      await replaceQuestions(tx, updated.id, value.questions);
      if (turningOff) await closeUnanswered(tx, updated.id);
      return updated;
    });
    if (!saved) {
      return { ok: false as const, error: 'NOT_FOUND', message: 'Pesquisa não encontrada.' };
    }
    return { ok: true as const, id: saved.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return {
        ok: false as const,
        error: 'ONE_OPEN',
        message: 'Arquive a Pesquisa atual antes de criar outra.',
      };
    }
    throw err;
  }
}

export async function archivePesquisa(businessId: string, pesquisaId: string) {
  const existing = await prisma.pesquisa.findFirst({
    where: { id: pesquisaId, businessId },
  });
  if (!existing) return { ok: false as const, error: 'NOT_FOUND', message: 'Pesquisa não encontrada.' };
  if (existing.status === 'archived') return { ok: true as const, id: existing.id };
  await prisma.$transaction(async (tx) => {
    await closeUnanswered(tx, existing.id);
    await tx.pesquisa.update({
      where: { id: existing.id },
      data: { status: 'archived', archivedAt: new Date() },
    });
  });
  return { ok: true as const, id: existing.id };
}

export async function openConviteForEarn(input: {
  businessId: string;
  membershipId: string;
  customerId: string;
  earnTransactionId: string;
  saleId: string;
  earnedStamps: number;
  earnedPoints: number;
  earnedCashbackCents: number;
}): Promise<{ sentence: string; url: string; conviteId: string } | null> {
  const pesquisa = await prisma.pesquisa.findFirst({
    where: { businessId: input.businessId, status: 'active' },
    include: {
      questions: { orderBy: { position: 'asc' } },
      bonusCampaign: { select: { name: true } },
    },
  });
  if (!pesquisa || pesquisa.questions.length < 1) return null;

  const answered = await prisma.resposta.findUnique({
    where: {
      pesquisaId_customerId: {
        pesquisaId: pesquisa.id,
        customerId: input.customerId,
      },
    },
    select: { id: true },
  });
  if (answered) return null;

  if (pesquisa.audienceSegmentId) {
    const segment = await prisma.audienceSegment.findFirst({
      where: { id: pesquisa.audienceSegmentId, businessId: input.businessId },
      select: { rules: true },
    });
    const matches = segment
      ? await membershipMatchesAudience(
          input.membershipId,
          input.businessId,
          parseAudienceRules(segment.rules),
        )
      : true;
    if (!audienceAllowsConvite({ audienceSegmentId: pesquisa.audienceSegmentId, matches })) {
      return null;
    }
  }

  const bonus = resolveConviteBonus({
    enabled: pesquisa.bonusEnabled,
    kind: pesquisa.bonusKind,
    mode: pesquisa.bonusMode,
    quantity: pesquisa.bonusQuantity,
    campaignId: pesquisa.bonusCampaignId,
    cartelaLabel: pesquisa.bonusKind === 'stamps' ? pesquisa.bonusCampaign?.name ?? null : null,
    earnedStamps: input.earnedStamps,
    earnedPoints: input.earnedPoints,
    earnedCashbackCents: input.earnedCashbackCents,
  });
  if (!shouldOpenConvite({ bonusEnabled: pesquisa.bonusEnabled, bonus })) return null;
  const snapshot = buildSnapshot({
    notePrompt: pesquisa.notePrompt,
    questions: pesquisa.questions,
    bonus,
  });

  const convite = await prisma.$transaction(async (tx) => {
    await tx.convite.updateMany({
      where: {
        pesquisaId: pesquisa.id,
        customerId: input.customerId,
        status: 'open',
      },
      data: { status: 'replaced' },
    });
    return tx.convite.create({
      data: {
        pesquisaId: pesquisa.id,
        membershipId: input.membershipId,
        customerId: input.customerId,
        earnTransactionId: input.earnTransactionId,
        saleId: input.saleId,
        status: 'open',
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        token: newToken(),
      },
    });
  });

  return {
    sentence: snapshot.inviteLine,
    url: convitePublicUrl(convite.token),
    conviteId: convite.id,
  };
}

async function earnPaysSnapshotBonus(input: {
  membershipId: string;
  saleId: string | null;
  bonus: { kind: 'stamps' | 'points' | 'cashback' } | null;
}): Promise<boolean> {
  if (!input.bonus) return true;
  if (!input.saleId) return false;
  const rows = await prisma.transaction.findMany({
    where: {
      membershipId: input.membershipId,
      metadata: { path: ['saleId'], equals: input.saleId },
    },
    select: { type: true, unitKind: true, quantity: true },
  });
  return salePaysBonus(input.bonus.kind, rows);
}

async function presentPayable(convite: {
  id: string;
  token: string;
  snapshot: unknown;
  membershipId: string;
  saleId: string | null;
  pesquisa: { name: string; business: BusinessBrandRow };
}) {
  const snapshot = parseSnapshot(convite.snapshot);
  if (snapshot?.bonus) {
    const pays = await earnPaysSnapshotBonus({
      membershipId: convite.membershipId,
      saleId: convite.saleId,
      bonus: snapshot.bonus,
    });
    if (!pays) return null;
  }
  const purchase = await loadPurchaseLine({
    membershipId: convite.membershipId,
    saleId: convite.saleId,
  });
  return presentConvite(convite, purchase);
}

async function loadPurchaseLine(input: {
  membershipId: string;
  saleId: string | null;
}): Promise<string | null> {
  if (!input.saleId) return null;
  const rows = await prisma.transaction.findMany({
    where: {
      membershipId: input.membershipId,
      metadata: { path: ['saleId'], equals: input.saleId },
    },
    select: {
      type: true,
      unitKind: true,
      quantity: true,
      amountCents: true,
      createdAt: true,
      metadata: true,
    },
  });
  const sale = rows.filter((row) => !shouldOmitFromLedger(row.metadata));
  if (sale.length === 0) return null;
  const credits = creditsFromEarnRows(sale);
  const amountCents = sale.reduce((max, row) => Math.max(max, row.amountCents ?? 0), 0);
  const at = sale.reduce(
    (earliest, row) => (row.createdAt < earliest ? row.createdAt : earliest),
    sale[0]!.createdAt,
  );
  return purchaseLine({
    at,
    amountCents: amountCents > 0 ? amountCents : null,
    ...credits,
  });
}

export async function closeConvitesForSale(saleId: string) {
  await prisma.convite.updateMany({
    where: {
      saleId,
      status: { in: ['open', 'replaced'] },
      resposta: { is: null },
    },
    data: { status: 'closed', closedAt: new Date() },
  });
}

const businessBrandSelect = {
  name: true,
  type: true,
  slogan: true,
  logoUrl: true,
  heroImageUrl: true,
  primaryColor: true,
  primaryColorDark: true,
  locations: {
    orderBy: { createdAt: 'asc' as const },
    select: { name: true, address: true, isOpen: true },
  },
} as const;

type BusinessBrandRow = {
  name: string;
  type: string;
  slogan: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  primaryColorDark: string;
  locations: { name: string; address: string | null; isOpen: boolean }[];
};

function brandFields(business: BusinessBrandRow) {
  const withAddress = business.locations.filter((location) => location.address?.trim());
  const location = withAddress[0] ?? null;
  const address = location?.address?.trim()
    ? withAddress.length > 1 && location.name.trim()
      ? `${location.name.trim()} · ${location.address.trim()}`
      : location.address.trim()
    : null;
  return {
    businessName: business.name,
    businessType: business.type,
    slogan: business.slogan,
    logoUrl: business.logoUrl,
    heroImageUrl: business.heroImageUrl,
    primaryColor: business.primaryColor,
    primaryColorDark: business.primaryColorDark,
    address,
    locationOpen: location?.isOpen ?? true,
  };
}

function presentConvite(
  convite: {
    id: string;
    token: string;
    snapshot: unknown;
    pesquisa: { name: string; business: BusinessBrandRow };
  },
  purchase: string | null,
) {
  const snapshot = parseSnapshot(convite.snapshot);
  if (!snapshot) {
    return { state: 'closed' as const, ...brandFields(convite.pesquisa.business) };
  }
  return {
    state: 'open' as const,
    conviteId: convite.id,
    token: convite.token,
    pesquisaName: convite.pesquisa.name,
    purchase,
    ...brandFields(convite.pesquisa.business),
    snapshot,
  };
}

export async function resolveConviteByToken(token: string) {
  const convite = await prisma.convite.findUnique({
    where: { token },
    include: {
      pesquisa: { include: { business: { select: businessBrandSelect } } },
    },
  });
  if (!convite) return null;
  return resolveConviteRecord(convite);
}

export async function resolveOpenConviteForCustomer(
  customerId: string,
  businessId: string,
) {
  const convite = await prisma.convite.findFirst({
    where: {
      customerId,
      status: 'open',
      pesquisa: { businessId, status: 'active' },
    },
    include: {
      pesquisa: { include: { business: { select: businessBrandSelect } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!convite) return { state: 'closed' as const };
  return resolveConviteRecord(convite);
}

async function resolveConviteRecord(convite: {
  id: string;
  token: string;
  status: 'open' | 'replaced' | 'closed' | 'answered';
  snapshot: unknown;
  membershipId: string;
  saleId: string | null;
  pesquisaId: string;
  customerId: string;
  pesquisa: { name: string; business: BusinessBrandRow };
}) {
  const brand = brandFields(convite.pesquisa.business);
  const resposta = await prisma.resposta.findUnique({
    where: {
      pesquisaId_customerId: {
        pesquisaId: convite.pesquisaId,
        customerId: convite.customerId,
      },
    },
    select: {
      id: true,
      bonusTransaction: { select: { metadata: true } },
    },
  });
  if (resposta || convite.status === 'answered') {
    const meta = resposta?.bonusTransaction?.metadata;
    const raw =
      meta && typeof meta === 'object' && !Array.isArray(meta) && 'label' in meta
        ? meta.label
        : null;
    const benefit =
      typeof raw === 'string' ? raw.replace(/^Pesquisa · /, '').trim() : '';
    return {
      state: 'answered' as const,
      benefit: benefit || null,
      ...brand,
    };
  }
  if (convite.status === 'open') {
    const presented = await presentPayable(convite);
    if (presented) return presented;
    return { state: 'closed' as const, ...brand };
  }

  const open = await prisma.convite.findFirst({
    where: {
      pesquisaId: convite.pesquisaId,
      customerId: convite.customerId,
      status: 'open',
    },
    include: {
      pesquisa: { include: { business: { select: businessBrandSelect } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (open) {
    const presented = await presentPayable(open);
    if (presented) return presented;
  }
  return { state: 'closed' as const, ...brand };
}

export async function submitConvite(input: {
  conviteId: string;
  customerId: string;
  answers: { position: number; value: Polegar }[];
  note: string | null;
}) {
  const convite = await prisma.convite.findFirst({
    where: { id: input.conviteId, customerId: input.customerId },
    include: {
      pesquisa: { include: { business: { select: { id: true } } } },
    },
  });
  if (!convite) {
    return { ok: false as const, error: 'NOT_FOUND', message: 'Convite não encontrado.' };
  }
  const snapshot = parseSnapshot(convite.snapshot);
  if (!snapshot) {
    return { ok: false as const, error: 'CLOSED', message: 'Esta Pesquisa está encerrada.' };
  }
  if (!answersMatchSnapshot(snapshot, input.answers)) {
    return {
      ok: false as const,
      error: 'ANSWERS_REQUIRED',
      message: 'Responda todas as perguntas.',
    };
  }

  const hasResposta = await prisma.resposta.findUnique({
    where: {
      pesquisaId_customerId: {
        pesquisaId: convite.pesquisaId,
        customerId: input.customerId,
      },
    },
    select: { id: true },
  });
  const campaigns = await loadDestinations(convite.pesquisa.business.id);
  const earnPaysBonus = await earnPaysSnapshotBonus({
    membershipId: convite.membershipId,
    saleId: convite.saleId,
    bonus: snapshot.bonus,
  });
  const gate = submitGate({
    status: convite.status,
    hasResposta: hasResposta != null,
    bonus: snapshot.bonus,
    destinationActive: snapshot.bonus
      ? destinationActive(snapshot.bonus, campaigns)
      : true,
    earnPaysBonus,
  });
  if (gate === 'already') {
    return { ok: false as const, error: 'ALREADY_ANSWERED', message: 'Você já respondeu esta Pesquisa.' };
  }
  if (gate === 'closed') {
    return { ok: false as const, error: 'CLOSED', message: 'Esta Pesquisa está encerrada.' };
  }
  if (gate === 'bonus_wallet') {
    return {
      ok: false as const,
      error: 'BONUS_WALLET',
      message: 'Esta compra não creditou a carteira deste benefício.',
    };
  }
  if (gate === 'bonus_unavailable') {
    return {
      ok: false as const,
      error: 'BONUS_UNAVAILABLE',
      message: 'O benefício não pôde ser creditado. Tente de novo mais tarde.',
    };
  }

  const note = snapshot.notePrompt ? input.note?.trim() || null : null;
  const earn = convite.earnTransactionId
    ? await prisma.transaction.findUnique({
        where: { id: convite.earnTransactionId },
        select: { locationId: true },
      })
    : null;
  if (!earn) {
    return { ok: false as const, error: 'CLOSED', message: 'Esta Pesquisa está encerrada.' };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const again = await tx.resposta.findUnique({
        where: {
          pesquisaId_customerId: {
            pesquisaId: convite.pesquisaId,
            customerId: input.customerId,
          },
        },
        select: { id: true },
      });
      if (again) return { kind: 'already' as const };

      let bonusTransactionId: string | null = null;
      if (snapshot.bonus) {
        const still = destinationActive(snapshot.bonus, campaigns);
        if (!still) return { kind: 'bonus' as const };
        const unitKind =
          snapshot.bonus.kind === 'cashback'
            ? 'cashback_cents'
            : snapshot.bonus.kind;
        const created = await tx.transaction.create({
          data: {
            businessId: convite.pesquisa.business.id,
            membershipId: convite.membershipId,
            campaignId: snapshot.bonus.campaignId,
            locationId: earn.locationId,
            actorCustomerId: input.customerId,
            type: 'stamp',
            quantity: snapshot.bonus.quantity,
            unitKind,
            metadata: {
              role: 'pesquisa',
              pesquisaId: convite.pesquisaId,
              cartelaLabel: snapshot.bonus.cartelaLabel,
              label: walletBonusLabel(snapshot.bonus),
            },
          },
        });
        bonusTransactionId = created.id;
      }

      await tx.resposta.create({
        data: {
          pesquisaId: convite.pesquisaId,
          conviteId: convite.id,
          membershipId: convite.membershipId,
          customerId: input.customerId,
          note,
          bonusTransactionId,
          answers: {
            create: snapshot.questions.map((q) => ({
              position: q.position,
              prompt: q.prompt,
              value: input.answers.find((a) => a.position === q.position)!.value,
            })),
          },
        },
      });
      await tx.convite.update({
        where: { id: convite.id },
        data: { status: 'answered', closedAt: new Date() },
      });
      await tx.convite.updateMany({
        where: {
          pesquisaId: convite.pesquisaId,
          customerId: input.customerId,
          status: { in: ['open', 'replaced'] },
        },
        data: { status: 'closed', closedAt: new Date() },
      });
      return {
        kind: 'ok' as const,
        bonus: snapshot.bonus
          ? { landed: true, sentence: snapshot.bonus.sentence, label: walletBonusLabel(snapshot.bonus) }
          : { landed: false, sentence: null, label: null },
      };
    });

    if (result.kind === 'already') {
      return { ok: false as const, error: 'ALREADY_ANSWERED', message: 'Você já respondeu esta Pesquisa.' };
    }
    if (result.kind === 'bonus') {
      return {
        ok: false as const,
        error: 'BONUS_UNAVAILABLE',
        message: 'O benefício não pôde ser creditado. Tente de novo mais tarde.',
      };
    }
    return { ok: true as const, bonus: result.bonus };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false as const, error: 'ALREADY_ANSWERED', message: 'Você já respondeu esta Pesquisa.' };
    }
    throw err;
  }
}

export type { ConviteSnapshot };
