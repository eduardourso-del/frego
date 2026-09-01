/**
 * Showcase tenant for landing-page screenshots.
 * Padaria Bela Vista — neighborhood bakery with 45 days of realistic activity.
 *
 * Re-runnable. Owner is eduardourso+test@gmail.com (not the main Gmail).
 * Logo, capa e fotos de campanha não são seedados: sobem pelo Firebase
 * (Configurações e Campanhas), o mesmo fluxo do estabelecimento.
 *
 *   cd db && DATABASE_URL=... pnpm exec tsx prisma/seed-showcase.ts
 */
import {
  CampaignStatus,
  CampaignType,
  InviteStatus,
  PlanTier,
  PrismaClient,
  TeamRole,
  TransactionType,
} from '@prisma/client';

const prisma = new PrismaClient();

const BIZ_ID = 'seed_padaria_bela_vista';
const LOC_ID = 'seed_bv_consolacao';
const CAMP_STAMPS = 'seed_bv_stamps';
const CAMP_POINTS = 'seed_bv_points';
const CAMP_BDAY = 'seed_bv_birthday';
const CAMP_CASHBACK = 'seed_bv_cashback';
const CASHBACK_PERCENT = 15;
const OWNER_UID = 'oj2JQ0Qo8FdSjvfV9OOvwSXhSzH3';
const OWNER_EMAIL = 'eduardourso+test@gmail.com';
const STAFF_UID = 'seed_bv_bruno_uid';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function voucherMeta(used: boolean, at: Date, staffId: string) {
  const n = Math.floor(at.getTime() / 1000)
    .toString(36)
    .slice(-6)
    .toUpperCase()
    .padStart(6, 'K');
  const code = n.replace(/[^0-9A-Z]/g, 'A').slice(0, 6);
  return {
    voucherCode: code,
    voucherDisplay: `${code.slice(0, 3)}-${code.slice(3)}`,
    expiresAt: new Date(at.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    ...(used
      ? {
          usedAt: new Date(at.getTime() + 12 * 60 * 1000).toISOString(),
          usedByTeamMemberId: staffId,
        }
      : {}),
  };
}

const CUSTOMERS: Array<{
  id: string;
  name: string;
  phone: string;
  vip?: boolean;
  birthday?: string;
  pattern: 'star' | 'regular' | 'new' | 'risk';
}> = [
  { id: 'seed_bv_c01', name: 'Marina Rocha', phone: '+5511917100001', vip: true, birthday: '1994-05-12', pattern: 'star' },
  { id: 'seed_bv_c02', name: 'Thiago Freitas', phone: '+5511917100002', birthday: '1988-11-03', pattern: 'regular' },
  { id: 'seed_bv_c03', name: 'Ana Lima', phone: '+5511917100003', birthday: '1996-08-21', pattern: 'regular' },
  { id: 'seed_bv_c04', name: 'Pedro Castro', phone: '+5511917100004', pattern: 'regular' },
  { id: 'seed_bv_c05', name: 'Rita Souza', phone: '+5511917100005', pattern: 'new' },
  { id: 'seed_bv_c06', name: 'Lucas Almeida', phone: '+5511917100006', vip: true, pattern: 'regular' },
  { id: 'seed_bv_c07', name: 'Camila Nogueira', phone: '+5511917100007', birthday: '1992-03-18', pattern: 'regular' },
  { id: 'seed_bv_c08', name: 'Fernando Dias', phone: '+5511917100008', pattern: 'regular' },
  { id: 'seed_bv_c09', name: 'Beatriz Campos', phone: '+5511917100009', pattern: 'regular' },
  { id: 'seed_bv_c10', name: 'Rafael Moura', phone: '+5511917100010', pattern: 'new' },
  { id: 'seed_bv_c11', name: 'Juliana Pires', phone: '+5511917100011', birthday: '1990-08-28', pattern: 'regular' },
  { id: 'seed_bv_c12', name: 'Gabriel Costa', phone: '+5511917100012', pattern: 'regular' },
  { id: 'seed_bv_c13', name: 'Larissa Mendes', phone: '+5511917100013', pattern: 'regular' },
  { id: 'seed_bv_c14', name: 'Sofia Martins', phone: '+5511917100014', vip: true, pattern: 'star' },
  { id: 'seed_bv_c15', name: 'Diego Azevedo', phone: '+5511917100015', pattern: 'risk' },
  { id: 'seed_bv_c16', name: 'Patrícia Gomes', phone: '+5511917100016', pattern: 'risk' },
  { id: 'seed_bv_c17', name: 'Henrique Lopes', phone: '+5511917100017', pattern: 'risk' },
  { id: 'seed_bv_c18', name: 'Amanda Vieira', phone: '+5511917100018', vip: true, birthday: '1987-01-09', pattern: 'star' },
  { id: 'seed_bv_c19', name: 'Caio Barbosa', phone: '+5511917100019', pattern: 'regular' },
  { id: 'seed_bv_c20', name: 'Isabela Freitas', phone: '+5511917100020', pattern: 'new' },
  { id: 'seed_bv_c21', name: 'Marcelo Pinto', phone: '+5511917100021', pattern: 'new' },
  { id: 'seed_bv_c22', name: 'Helena Duarte', phone: '+5511917100022', pattern: 'regular' },
  { id: 'seed_bv_c23', name: 'Vinícius Ramos', phone: '+5511917100023', pattern: 'regular' },
  { id: 'seed_bv_c24', name: 'Carla Menezes', phone: '+5511917100024', pattern: 'regular' },
];

async function main() {
  const rng = mulberry32(20260821);
  const now = new Date();

  const growth = await prisma.plan.upsert({
    where: { tier: PlanTier.growth },
    update: {},
    create: { tier: PlanTier.growth, name: 'Growth', mrrCents: 19900 },
  });

  const business = await prisma.business.upsert({
    where: { id: BIZ_ID },
    update: {
      name: 'Padaria Bela Vista',
      type: 'padaria',
      status: 'active',
      slogan: 'Pão quente, gente conhecida',
      slug: 'padaria-bela-vista',
      primaryColor: '#6F1D1B',
      primaryColorDark: '#4C1010',
      pointsPerReal: 1,
      stampsExpireDays: 90,
      cashbackExpireDays: 90,
      cashbackMinPurchaseCents: 1500,
      cashbackMaxCents: 2000,
    },
    create: {
      id: BIZ_ID,
      name: 'Padaria Bela Vista',
      type: 'padaria',
      status: 'active',
      slogan: 'Pão quente, gente conhecida',
      slug: 'padaria-bela-vista',
      primaryColor: '#6F1D1B',
      primaryColorDark: '#4C1010',
      pointsPerReal: 1,
      stampsExpireDays: 90,
      cashbackExpireDays: 90,
      cashbackMinPurchaseCents: 1500,
      cashbackMaxCents: 2000,
      createdAt: new Date('2024-11-08T10:00:00-03:00'),
    },
  });

  await prisma.billingAccount.upsert({
    where: { businessId: business.id },
    update: { planId: growth.id, status: 'active', mrrCents: 19900 },
    create: {
      businessId: business.id,
      planId: growth.id,
      status: 'active',
      mrrCents: 19900,
    },
  });

  const location = await prisma.location.upsert({
    where: { id: LOC_ID },
    update: {
      name: 'Bela Vista — Consolação',
      address: 'Rua da Consolação, 2140 — Bela Vista, São Paulo',
      isOpen: true,
    },
    create: {
      id: LOC_ID,
      businessId: business.id,
      name: 'Bela Vista — Consolação',
      address: 'Rua da Consolação, 2140 — Bela Vista, São Paulo',
      isOpen: true,
    },
  });

  const owner = await prisma.teamMember.upsert({
    where: {
      businessId_firebaseUid: {
        businessId: business.id,
        firebaseUid: OWNER_UID,
      },
    },
    update: {
      email: OWNER_EMAIL,
      displayName: 'Júlia Mendes',
      role: TeamRole.owner,
      status: InviteStatus.active,
      locationId: location.id,
    },
    create: {
      businessId: business.id,
      locationId: location.id,
      firebaseUid: OWNER_UID,
      email: OWNER_EMAIL,
      displayName: 'Júlia Mendes',
      role: TeamRole.owner,
      status: InviteStatus.active,
    },
  });

  const bruno = await prisma.teamMember.upsert({
    where: {
      businessId_firebaseUid: {
        businessId: business.id,
        firebaseUid: STAFF_UID,
      },
    },
    update: {
      email: 'bruno@belavista.padaria',
      displayName: 'Bruno Oliveira',
      role: TeamRole.employee,
      status: InviteStatus.active,
      locationId: location.id,
    },
    create: {
      businessId: business.id,
      locationId: location.id,
      firebaseUid: STAFF_UID,
      email: 'bruno@belavista.padaria',
      displayName: 'Bruno Oliveira',
      role: TeamRole.employee,
      status: InviteStatus.active,
    },
  });

  await prisma.transaction.deleteMany({ where: { businessId: business.id } });
  await prisma.campaignLocation.deleteMany({
    where: { campaign: { businessId: business.id } },
  });
  await prisma.audienceSegment.deleteMany({ where: { businessId: business.id } });
  await prisma.membership.deleteMany({ where: { businessId: business.id } });

  // Logo, capa e fotos de prêmio vêm do Firebase (Configurações / Campanhas).
  // O seed não grava URL — no update, preserve o que já foi enviado.
  const campaignFields = {
    stamps: {
      name: 'Pão 10×',
      type: CampaignType.stamps,
      status: CampaignStatus.active,
      stampsNeeded: 10,
      pointsPerReal: null as number | null,
      cashbackPercent: null as number | null,
      rewardTitle: 'Pão de queijo grátis',
      rewardDescription: 'Um pão de queijo quentinho por nossa conta',
    },
    points: {
      name: 'Pontos da casa',
      type: CampaignType.spend,
      status: CampaignStatus.active,
      stampsNeeded: 300,
      pointsPerReal: 1,
      cashbackPercent: null as number | null,
      rewardTitle: 'Café + pão',
      rewardDescription: 'Um café e um pão francês',
    },
    bday: {
      name: 'Aniversário da casa',
      type: CampaignType.birthday,
      status: CampaignStatus.active,
      stampsNeeded: 1,
      pointsPerReal: null as number | null,
      cashbackPercent: null as number | null,
      rewardTitle: 'Croissant de presente',
      rewardDescription: 'No mês do aniversário, um croissant por nossa conta',
    },
    cashback: {
      name: 'Cashback',
      type: CampaignType.cashback,
      status: CampaignStatus.active,
      stampsNeeded: 1,
      pointsPerReal: null as number | null,
      cashbackPercent: CASHBACK_PERCENT,
      rewardTitle: 'Volta em R$',
      rewardDescription: '15% do valor pago volta em saldo para usar no caixa',
    },
  } as const;

  const stamps = await prisma.campaign.upsert({
    where: { id: CAMP_STAMPS },
    update: campaignFields.stamps,
    create: {
      id: CAMP_STAMPS,
      businessId: business.id,
      ...campaignFields.stamps,
    },
  });
  const points = await prisma.campaign.upsert({
    where: { id: CAMP_POINTS },
    update: campaignFields.points,
    create: {
      id: CAMP_POINTS,
      businessId: business.id,
      ...campaignFields.points,
    },
  });
  const bday = await prisma.campaign.upsert({
    where: { id: CAMP_BDAY },
    update: campaignFields.bday,
    create: {
      id: CAMP_BDAY,
      businessId: business.id,
      ...campaignFields.bday,
    },
  });
  const cashback = await prisma.campaign.upsert({
    where: { id: CAMP_CASHBACK },
    update: campaignFields.cashback,
    create: {
      id: CAMP_CASHBACK,
      businessId: business.id,
      ...campaignFields.cashback,
    },
  });

  for (const c of [stamps, points, bday, cashback]) {
    await prisma.campaignLocation.create({
      data: { campaignId: c.id, locationId: location.id },
    });
  }

  await prisma.audienceSegment.create({
    data: {
      businessId: business.id,
      name: 'Fregueses da casa',
      showBadge: true,
      badgeTitle: 'Da casa',
      badgeMessage: 'Você é freguês da Bela Vista. Valeu por voltar.',
      rules: {
        version: 1,
        visitsMin: 8,
        windowDays: 90,
      },
    },
  });

  const membershipByCustomer = new Map<string, string>();
  for (const c of CUSTOMERS) {
    const customer = await prisma.customer.upsert({
      where: { phoneE164: c.phone },
      update: {
        displayName: c.name,
        phoneLast4: c.phone.slice(-4),
        birthday: c.birthday ? new Date(`${c.birthday}T12:00:00.000Z`) : undefined,
        onboardingCompleted: c.pattern !== 'new',
      },
      create: {
        id: c.id,
        phoneE164: c.phone,
        phoneLast4: c.phone.slice(-4),
        displayName: c.name,
        birthday: c.birthday ? new Date(`${c.birthday}T12:00:00.000Z`) : null,
        onboardingCompleted: c.pattern !== 'new',
      },
    });
    const membership = await prisma.membership.create({
      data: {
        id: `seed_bv_m_${c.id.slice(-2)}`,
        customerId: customer.id,
        businessId: business.id,
        isVip: Boolean(c.vip),
        isFavorite: Boolean(c.vip) || c.pattern === 'star',
        associatedAt: new Date(now.getTime() - 80 * 24 * 60 * 60 * 1000),
      },
    });
    membershipByCustomer.set(c.id, membership.id);
  }

  type Tx = {
    businessId: string;
    membershipId: string;
    campaignId: string;
    locationId: string;
    actorTeamMemberId: string;
    type: TransactionType;
    quantity: number;
    unitKind: string | null;
    amountCents: number | null;
    metadata: object | null;
    createdAt: Date;
  };
  const txs: Tx[] = [];

  function atHour(daysAgo: number, hour: number, minute: number) {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minute, Math.floor(rng() * 50), 0);
    return d;
  }

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  function addStamp(membershipId: string, when: Date, staffId: string) {
    txs.push({
      businessId: business.id,
      membershipId,
      campaignId: stamps.id,
      locationId: location.id,
      actorTeamMemberId: staffId,
      type: TransactionType.stamp,
      quantity: 1,
      unitKind: 'stamps',
      amountCents: null,
      metadata: null,
      createdAt: when,
    });
  }

  function addPoints(membershipId: string, when: Date, staffId: string, reais: number) {
    const cents = Math.round(reais * 100);
    txs.push({
      businessId: business.id,
      membershipId,
      campaignId: points.id,
      locationId: location.id,
      actorTeamMemberId: staffId,
      type: TransactionType.stamp,
      quantity: Math.floor(reais),
      unitKind: 'points',
      amountCents: cents,
      metadata: { note: 'Balcão' },
      createdAt: when,
    });
  }

  function addRedeem(
    membershipId: string,
    when: Date,
    staffId: string,
    campaignId: string,
    used: boolean,
  ) {
    txs.push({
      businessId: business.id,
      membershipId,
      campaignId,
      locationId: location.id,
      actorTeamMemberId: staffId,
      type: TransactionType.redeem,
      quantity: 1,
      unitKind: null,
      amountCents: null,
      metadata: voucherMeta(used, when, staffId),
      createdAt: when,
    });
  }

  function addCashbackEarn(
    membershipId: string,
    when: Date,
    staffId: string,
    paidCents: number,
  ) {
    if (paidCents < 1500) return 0;
    const raw = Math.floor((paidCents * CASHBACK_PERCENT) / 100);
    const earned = Math.min(raw, 2000);
    if (earned < 1) return 0;
    txs.push({
      businessId: business.id,
      membershipId,
      campaignId: cashback.id,
      locationId: location.id,
      actorTeamMemberId: staffId,
      type: TransactionType.stamp,
      quantity: earned,
      unitKind: 'cashback_cents',
      amountCents: paidCents,
      metadata: null,
      createdAt: new Date(when.getTime() + 45_000),
    });
    return earned;
  }

  function addCashbackApply(
    membershipId: string,
    when: Date,
    staffId: string,
    saleCents: number,
    applyCents: number,
  ) {
    const applied = Math.min(applyCents, saleCents);
    if (applied < 1) return 0;
    txs.push({
      businessId: business.id,
      membershipId,
      campaignId: cashback.id,
      locationId: location.id,
      actorTeamMemberId: staffId,
      type: TransactionType.redeem,
      quantity: applied,
      unitKind: 'cashback_cents',
      amountCents: saleCents,
      metadata: null,
      createdAt: when,
    });
    return applied;
  }

  const tickets = [14.5, 18, 22, 28.9, 32, 36.5, 41, 48, 54.9, 62];
  const morningHours = [6, 7, 7, 8, 8, 8, 9, 9, 10, 11];
  const afternoonHours = [12, 13, 16, 17, 18];

  for (const c of CUSTOMERS) {
    const mid = membershipByCustomer.get(c.id)!;
    const visitDays: number[] = [];

    if (c.pattern === 'star') {
      for (let d = 1; d <= 45; d++) {
        if (d % 2 === 0 || rng() > 0.35) visitDays.push(d);
      }
    } else if (c.pattern === 'regular') {
      for (let d = 1; d <= 40; d++) {
        if (d % 6 === Number(c.id.slice(-1)) % 6 || rng() > 0.82) visitDays.push(d);
      }
    } else if (c.pattern === 'new') {
      const n = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) visitDays.push(1 + Math.floor(rng() * 8));
    } else {
      for (let d = 35; d <= 70; d++) {
        if (rng() > 0.7) visitDays.push(d);
      }
    }

    const uniqueDays = [...new Set(visitDays)].sort((a, b) => a - b);
    let stampsOnCard = 0;
    let pointsBalance = 0;
    let cashbackCents = 0;

    for (const daysAgo of uniqueDays) {
      const weekendBoost = (() => {
        const day = new Date(now);
        day.setDate(day.getDate() - daysAgo);
        const wd = day.getDay();
        return wd === 0 || wd === 6;
      })();
      const hour = pick(rng, weekendBoost ? afternoonHours : morningHours);
      const minute = Math.floor(rng() * 55);
      const when = atHour(daysAgo, hour, minute);
      const staffId = rng() > 0.45 ? bruno.id : owner.id;

      const doStamp = rng() > 0.35;
      const doPoints = rng() > 0.25 || !doStamp;
      if (doStamp) {
        addStamp(mid, when, staffId);
        stampsOnCard += 1;
      }
      if (doPoints) {
        const reais = pick(rng, tickets) * (weekendBoost ? 1.15 : 1);
        const saleCents = Math.round(reais * 100);
        let applied = 0;
        const likelyApply =
          daysAgo <= 32 &&
          cashbackCents >= 900 &&
          (c.pattern === 'star' ? rng() > 0.42 : rng() > 0.68);
        if (likelyApply) {
          const want = Math.min(
            cashbackCents,
            saleCents,
            800 + Math.floor(rng() * 1600),
          );
          applied = addCashbackApply(
            mid,
            when,
            staffId,
            saleCents,
            want,
          );
          cashbackCents -= applied;
        }
        addPoints(
          mid,
          new Date(when.getTime() + 30_000),
          staffId,
          (saleCents - applied) / 100,
        );
        pointsBalance += Math.floor((saleCents - applied) / 100);
        const earned = addCashbackEarn(
          mid,
          when,
          staffId,
          saleCents - applied,
        );
        cashbackCents += earned;
      }

      if (stampsOnCard >= 10 && rng() > 0.4) {
        addRedeem(
          mid,
          new Date(when.getTime() + 90_000),
          staffId,
          stamps.id,
          rng() > 0.15,
        );
        stampsOnCard -= 10;
      }
      if (pointsBalance >= 300 && rng() > 0.55) {
        addRedeem(
          mid,
          new Date(when.getTime() + 120_000),
          staffId,
          points.id,
          rng() > 0.2,
        );
        pointsBalance -= 300;
      }
    }
  }

  // Dia de hoje — padaria cheia do café da manhã ao fim da tarde.
  // Só entra o que já aconteceu (createdAt ≤ agora), para o painel "Hoje"
  // e o "Ao vivo" baterem com o relógio da apresentação.
  const todayCast: Array<{
    cust: string;
    kind: 'stamp' | 'points' | 'redeem' | 'cashback';
    hour: number;
    min: number;
  }> = [
    { cust: 'seed_bv_c01', kind: 'stamp', hour: 6, min: 12 },
    { cust: 'seed_bv_c01', kind: 'points', hour: 6, min: 13 },
    { cust: 'seed_bv_c14', kind: 'stamp', hour: 6, min: 28 },
    { cust: 'seed_bv_c18', kind: 'points', hour: 6, min: 41 },
    { cust: 'seed_bv_c06', kind: 'stamp', hour: 6, min: 55 },
    { cust: 'seed_bv_c03', kind: 'stamp', hour: 7, min: 4 },
    { cust: 'seed_bv_c03', kind: 'points', hour: 7, min: 5 },
    { cust: 'seed_bv_c02', kind: 'points', hour: 7, min: 18 },
    { cust: 'seed_bv_c07', kind: 'stamp', hour: 7, min: 22 },
    { cust: 'seed_bv_c21', kind: 'stamp', hour: 7, min: 31 },
    { cust: 'seed_bv_c09', kind: 'points', hour: 7, min: 38 },
    { cust: 'seed_bv_c12', kind: 'stamp', hour: 7, min: 47 },
    { cust: 'seed_bv_c14', kind: 'points', hour: 7, min: 52 },
    { cust: 'seed_bv_c04', kind: 'stamp', hour: 8, min: 3 },
    { cust: 'seed_bv_c01', kind: 'redeem', hour: 8, min: 6 },
    { cust: 'seed_bv_c18', kind: 'stamp', hour: 8, min: 11 },
    { cust: 'seed_bv_c06', kind: 'points', hour: 8, min: 19 },
    { cust: 'seed_bv_c22', kind: 'stamp', hour: 8, min: 24 },
    { cust: 'seed_bv_c08', kind: 'points', hour: 8, min: 33 },
    { cust: 'seed_bv_c11', kind: 'stamp', hour: 8, min: 41 },
    { cust: 'seed_bv_c14', kind: 'cashback', hour: 8, min: 48 },
    { cust: 'seed_bv_c19', kind: 'stamp', hour: 8, min: 56 },
    { cust: 'seed_bv_c23', kind: 'points', hour: 9, min: 5 },
    { cust: 'seed_bv_c05', kind: 'stamp', hour: 9, min: 12 },
    { cust: 'seed_bv_c10', kind: 'stamp', hour: 9, min: 18 },
    { cust: 'seed_bv_c01', kind: 'points', hour: 9, min: 27 },
    { cust: 'seed_bv_c24', kind: 'stamp', hour: 9, min: 35 },
    { cust: 'seed_bv_c07', kind: 'points', hour: 9, min: 44 },
    { cust: 'seed_bv_c13', kind: 'stamp', hour: 9, min: 52 },
    { cust: 'seed_bv_c18', kind: 'redeem', hour: 10, min: 8 },
    { cust: 'seed_bv_c02', kind: 'stamp', hour: 10, min: 16 },
    { cust: 'seed_bv_c20', kind: 'stamp', hour: 10, min: 29 },
    { cust: 'seed_bv_c06', kind: 'cashback', hour: 10, min: 37 },
    { cust: 'seed_bv_c09', kind: 'stamp', hour: 10, min: 48 },
    { cust: 'seed_bv_c14', kind: 'stamp', hour: 11, min: 4 },
    { cust: 'seed_bv_c03', kind: 'points', hour: 11, min: 15 },
    { cust: 'seed_bv_c12', kind: 'points', hour: 11, min: 33 },
    { cust: 'seed_bv_c04', kind: 'stamp', hour: 11, min: 51 },
    { cust: 'seed_bv_c01', kind: 'points', hour: 12, min: 8 },
    { cust: 'seed_bv_c18', kind: 'stamp', hour: 12, min: 14 },
    { cust: 'seed_bv_c08', kind: 'stamp', hour: 12, min: 22 },
    { cust: 'seed_bv_c22', kind: 'points', hour: 12, min: 31 },
    { cust: 'seed_bv_c11', kind: 'cashback', hour: 12, min: 39 },
    { cust: 'seed_bv_c19', kind: 'stamp', hour: 12, min: 47 },
    { cust: 'seed_bv_c23', kind: 'stamp', hour: 13, min: 5 },
    { cust: 'seed_bv_c07', kind: 'points', hour: 13, min: 18 },
    { cust: 'seed_bv_c14', kind: 'redeem', hour: 13, min: 26 },
    { cust: 'seed_bv_c06', kind: 'stamp', hour: 16, min: 8 },
    { cust: 'seed_bv_c01', kind: 'stamp', hour: 16, min: 22 },
    { cust: 'seed_bv_c03', kind: 'points', hour: 16, min: 41 },
    { cust: 'seed_bv_c18', kind: 'points', hour: 17, min: 5 },
    { cust: 'seed_bv_c09', kind: 'stamp', hour: 17, min: 19 },
    { cust: 'seed_bv_c02', kind: 'cashback', hour: 17, min: 34 },
    { cust: 'seed_bv_c24', kind: 'stamp', hour: 17, min: 48 },
    { cust: 'seed_bv_c14', kind: 'stamp', hour: 18, min: 6 },
    { cust: 'seed_bv_c12', kind: 'points', hour: 18, min: 21 },
  ];

  function playTodayRow(
    row: (typeof todayCast)[number],
    when: Date,
    staffId: string,
  ) {
    const mid = membershipByCustomer.get(row.cust)!;
    if (row.kind === 'stamp') addStamp(mid, when, staffId);
    else if (row.kind === 'points') {
      const reais = pick(rng, [18, 22, 28.9, 36.5, 48, 54.9]);
      addPoints(mid, when, staffId, reais);
      addCashbackEarn(mid, when, staffId, Math.round(reais * 100));
    } else if (row.kind === 'cashback') {
      addCashbackApply(mid, when, staffId, 4850, 1200);
      addCashbackEarn(mid, when, staffId, 3650);
    } else addRedeem(mid, when, staffId, stamps.id, true);
  }

  const cutoff = new Date(now.getTime() - 20_000);
  for (const row of todayCast) {
    const when = atHour(0, row.hour, row.min);
    if (when.getTime() > cutoff.getTime()) continue;
    playTodayRow(row, when, row.hour < 8 ? bruno.id : owner.id);
  }

  // Últimos minutos — o "Ao vivo" precisa estar quente na hora da demo.
  const justNow: Array<{
    cust: string;
    kind: (typeof todayCast)[number]['kind'];
    minutesAgo: number;
  }> = [
    { cust: 'seed_bv_c22', kind: 'stamp', minutesAgo: 16 },
    { cust: 'seed_bv_c01', kind: 'points', minutesAgo: 11 },
    { cust: 'seed_bv_c14', kind: 'stamp', minutesAgo: 7 },
    { cust: 'seed_bv_c06', kind: 'cashback', minutesAgo: 4 },
    { cust: 'seed_bv_c18', kind: 'stamp', minutesAgo: 2 },
  ];
  for (const row of justNow) {
    const when = new Date(now.getTime() - row.minutesAgo * 60_000);
    if (when.getTime() < todayStart.getTime()) continue;
    playTodayRow(row, when, owner.id);
  }

  txs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const chunk = 200;
  for (let i = 0; i < txs.length; i += chunk) {
    await prisma.transaction.createMany({ data: txs.slice(i, i + chunk) });
  }

  console.log('Padaria Bela Vista pronta para screenshot');
  console.log({
    loja: 'Padaria Bela Vista',
    slug: '/loja/padaria-bela-vista',
    painel: 'Entre com eduardourso+test@gmail.com',
    clientes: CUSTOMERS.length,
    transacoes: txs.length,
    transacoesHoje: txs.filter((t) => t.createdAt >= todayStart).length,
    cashback: `${CASHBACK_PERCENT}% · ${CAMP_CASHBACK}`,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
