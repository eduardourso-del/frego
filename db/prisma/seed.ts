import {
  PrismaClient,
  PlanTier,
  CampaignType,
  CampaignStatus,
  TeamRole,
  InviteStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

async function seedBusiness(opts: {
  id: string;
  name: string;
  type: string;
  status?: 'pending' | 'trial' | 'active';
  primaryColor: string;
  primaryColorDark: string;
  slogan: string;
  slug: string;
  locationId: string;
  locationName: string;
  locationAddress: string;
  campaignId: string;
  campaignName: string;
  rewardTitle: string;
  rewardDescription: string;
  ownerFirebaseUid: string;
  ownerEmail: string;
  ownerName: string;
  planId: string;
}) {
  const business = await prisma.business.upsert({
    where: { id: opts.id },
    update: {
      name: opts.name,
      type: opts.type,
      status: opts.status ?? 'active',
      primaryColor: opts.primaryColor,
      primaryColorDark: opts.primaryColorDark,
      slogan: opts.slogan,
      slug: opts.slug,
    },
    create: {
      id: opts.id,
      name: opts.name,
      type: opts.type,
      status: opts.status ?? 'active',
      primaryColor: opts.primaryColor,
      primaryColorDark: opts.primaryColorDark,
      slogan: opts.slogan,
      slug: opts.slug,
    },
  });

  await prisma.billingAccount.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      planId: opts.planId,
      status: opts.status === 'pending' ? 'trial' : 'active',
      mrrCents: 0,
    },
  });

  const location = await prisma.location.upsert({
    where: { id: opts.locationId },
    update: {},
    create: {
      id: opts.locationId,
      businessId: business.id,
      name: opts.locationName,
      address: opts.locationAddress,
      isOpen: true,
    },
  });

  const owner = await prisma.teamMember.upsert({
    where: {
      businessId_firebaseUid: {
        businessId: business.id,
        firebaseUid: opts.ownerFirebaseUid,
      },
    },
    update: {
      email: opts.ownerEmail,
      displayName: opts.ownerName,
      status: InviteStatus.active,
    },
    create: {
      businessId: business.id,
      locationId: location.id,
      firebaseUid: opts.ownerFirebaseUid,
      email: opts.ownerEmail,
      phoneE164: null,
      displayName: opts.ownerName,
      role: TeamRole.owner,
      status: InviteStatus.active,
    },
  });

  const campaign = await prisma.campaign.upsert({
    where: { id: opts.campaignId },
    update: {},
    create: {
      id: opts.campaignId,
      businessId: business.id,
      name: opts.campaignName,
      type: CampaignType.stamps,
      status: CampaignStatus.active,
      stampsNeeded: 10,
      rewardTitle: opts.rewardTitle,
      rewardDescription: opts.rewardDescription,
    },
  });

  await prisma.campaignLocation.upsert({
    where: {
      campaignId_locationId: {
        campaignId: campaign.id,
        locationId: location.id,
      },
    },
    update: {},
    create: {
      campaignId: campaign.id,
      locationId: location.id,
    },
  });

  return { business, location, owner, campaign };
}

async function main() {
  const trial = await prisma.plan.upsert({
    where: { tier: PlanTier.trial },
    update: {},
    create: { tier: PlanTier.trial, name: 'Trial', mrrCents: 0 },
  });
  await prisma.plan.upsert({
    where: { tier: PlanTier.starter },
    update: {},
    create: { tier: PlanTier.starter, name: 'Starter', mrrCents: 7900 },
  });
  await prisma.plan.upsert({
    where: { tier: PlanTier.growth },
    update: {},
    create: { tier: PlanTier.growth, name: 'Growth', mrrCents: 19900 },
  });

  // Platform admin Frego
  await prisma.platformAdmin.upsert({
    where: { email: 'admin@frego.app' },
    update: {
      firebaseUid: 'seed_platform_admin_uid',
      displayName: 'Frego Admin',
    },
    create: {
      email: 'admin@frego.app',
      firebaseUid: 'seed_platform_admin_uid',
      displayName: 'Frego Admin',
    },
  });

  // 1 conta = 1 loja
  const bloom = await seedBusiness({
    id: 'seed_bloom_coffee',
    name: 'Bloom Coffee',
    type: 'café',
    primaryColor: '#24479C',
    primaryColorDark: '#1B3781',
    slogan: 'Café que faz voltar',
    slug: 'bloom-coffee',
    locationId: 'seed_bloom_main',
    locationName: 'Bloom — Jardins',
    locationAddress: 'Rua Augusta, 1000 — São Paulo',
    campaignId: 'seed_bloom_stamps',
    campaignName: 'Café 10×',
    rewardTitle: 'Café grátis',
    rewardDescription: 'Um espresso ou filtrado por nossa conta',
    ownerFirebaseUid: 'seed_owner_uid',
    ownerEmail: 'ana@bloom.coffee',
    ownerName: 'Ana',
    planId: trial.id,
  });

  const burger = await seedBusiness({
    id: 'seed_burger_lab',
    name: 'Burger Lab',
    type: 'hamburgueria',
    primaryColorDark: '#9A3412',
    slogan: 'Smash que vicia',
    slug: 'burger-lab',
    locationId: 'seed_burger_main',
    locationName: 'Burger Lab — Pinheiros',
    locationAddress: 'Rua dos Pinheiros, 500 — São Paulo',
    campaignId: 'seed_burger_stamps',
    campaignName: 'Burger 8×',
    rewardTitle: 'Burger grátis',
    rewardDescription: 'Um smash burger clássico',
    ownerFirebaseUid: 'seed_joao_uid',
    ownerEmail: 'joao@burgerlab.com',
    ownerName: 'João',
    planId: trial.id,
  });

  const oakberry = await seedBusiness({
    id: 'seed_oakberry',
    name: 'Oakberry',
    type: 'acai',
    primaryColorDark: '#166534',
    slogan: 'Açaí bowl, sempre',
    slug: 'oakberry',
    locationId: 'seed_oakberry_main',
    locationName: 'Oakberry — Itaim',
    locationAddress: 'Av. Brigadeiro Faria Lima, 2000 — São Paulo',
    campaignId: 'seed_oakberry_stamps',
    campaignName: 'Bowl 6×',
    rewardTitle: 'Bowl grátis',
    rewardDescription: 'Um bowl médio por nossa conta',
    ownerFirebaseUid: '6j4Uztux0hhJqO6aJrz02QBDQyg1',
    ownerEmail: 'ricardo@oakberry.com',
    ownerName: 'Ricardo',
    planId: trial.id,
  });

  await seedBusiness({
    id: 'seed_cafe_brazil',
    name: 'Café Brazil',
    type: 'café',
    primaryColor: '#B45309',
    primaryColorDark: '#92400E',
    slogan: 'Tradição em cada xícara',
    slug: 'cafe-brazil',
    locationId: 'seed_cafe_brazil_main',
    locationName: 'Café Brazil — Centro',
    locationAddress: 'Rua XV de Novembro, 100 — São Paulo',
    campaignId: 'seed_cafe_brazil_stamps',
    campaignName: 'Café 10×',
    rewardTitle: 'Café + pão de queijo',
    rewardDescription: 'Combo clássico',
    ownerFirebaseUid: 'seed_maria_uid',
    ownerEmail: 'maria@cafebrazil.com',
    ownerName: 'Maria',
    planId: trial.id,
  });

  // Garante 1 conta = 1 loja (limpa vínculos antigos do seed)
  await prisma.teamMember.deleteMany({
    where: {
      OR: [
        { businessId: burger.business.id, email: 'ana@bloom.coffee' },
        { businessId: oakberry.business.id, email: 'ana@bloom.coffee' },
        {
          businessId: 'seed_cafe_brazil',
          email: { in: ['ricardo@oakberry.com', 'ana@bloom.coffee'] },
        },
      ],
    },
  });

  const marina = await prisma.customer.upsert({
    where: { phoneE164: '+5511987654321' },
    update: { phoneLast4: '4321' },
    create: {
      phoneE164: '+5511987654321',
      phoneLast4: '4321',
      displayName: 'Marina Costa',
      birthday: new Date('1994-05-12'),
    },
  });

  for (const biz of [bloom.business, burger.business, oakberry.business]) {
    await prisma.membership.upsert({
      where: {
        customerId_businessId: {
          customerId: marina.id,
          businessId: biz.id,
        },
      },
      update: {},
      create: {
        customerId: marina.id,
        businessId: biz.id,
        isVip: biz.id === bloom.business.id,
      },
    });
  }

  const pedro = await prisma.customer.upsert({
    where: { phoneE164: '+5511977778888' },
    update: { phoneLast4: '8888' },
    create: {
      phoneE164: '+5511977778888',
      phoneLast4: '8888',
      displayName: 'Pedro Santos',
    },
  });
  await prisma.membership.upsert({
    where: {
      customerId_businessId: {
        customerId: pedro.id,
        businessId: burger.business.id,
      },
    },
    update: {},
    create: {
      customerId: pedro.id,
      businessId: burger.business.id,
    },
  });

  console.log('Seed OK — 1 conta por loja');
  console.log({
    ana: 'ana@bloom.coffee → Bloom Coffee',
    joao: 'joao@burgerlab.com → Burger Lab (criar no Firebase se precisar)',
    ricardo: 'ricardo@oakberry.com → Oakberry',
    maria: 'maria@cafebrazil.com → Café Brazil (criar no Firebase se precisar)',
    admin: 'admin@frego.app → Frego Admin (criar no Firebase)',
    senha: 'frego-demo-123',
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
