export type PlanTier = 'starter' | 'growth' | 'enterprise';

export type PlanFeature =
  | 'audiences'
  | 'pesquisas'
  | 'whatsapp'
  | 'intelligence'
  | 'reports'
  | 'extraLocations';

export type BillingView = {
  mode: 'pending' | 'suspended' | 'open' | 'locked';
  tier: PlanTier | null;
  source: 'trial' | 'cortesia' | 'paid' | 'grace' | null;
  features: Record<PlanFeature, boolean>;
  publicPage: boolean;
  trialEndsAt: string | null;
  periodEndsAt: string | null;
  pastDueAt: string | null;
  cortesiaTier: PlanTier | null;
  paidTier: PlanTier | null;
  scheduledTier: PlanTier | null;
  pendingUpgradeTier: PlanTier | null;
  cancelAtPeriodEnd: boolean;
  billingType: string | null;
  prices: Record<PlanTier, number>;
};

export const PLAN_ORDER: PlanTier[] = ['starter', 'growth', 'enterprise'];

export const PLAN_LABEL: Record<PlanTier, string> = {
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
};

export const FEATURE_LABEL: Record<PlanFeature, string> = {
  audiences: 'Audiências',
  pesquisas: 'Pesquisa',
  whatsapp: 'WhatsApp',
  intelligence: 'Frego Inteligência',
  reports: 'Relatórios',
  extraLocations: 'Mais unidades',
};

export function tierForFeature(feature: PlanFeature): PlanTier {
  if (
    feature === 'pesquisas' ||
    feature === 'intelligence' ||
    feature === 'reports'
  ) {
    return 'enterprise';
  }
  if (feature === 'extraLocations') return 'starter';
  return 'growth';
}

export function planMenuLabel(billing: BillingView | null | undefined): string | null {
  if (!billing || billing.mode === 'pending' || billing.mode === 'suspended') return null;
  if (billing.mode === 'locked') return 'Sem Plano';
  if (billing.source === 'trial') return 'Enterprise · teste';
  if (billing.source === 'cortesia' && billing.cortesiaTier) {
    return `${PLAN_LABEL[billing.cortesiaTier]} · cortesia`;
  }
  if (billing.source === 'grace' && billing.tier) {
    return `${PLAN_LABEL[billing.tier]} · atraso`;
  }
  if (billing.tier) return PLAN_LABEL[billing.tier];
  return null;
}

export function formatPlanPrice(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export const LANDING_PLANS: Array<{
  tier: PlanTier;
  priceCents: number;
  summary: string;
  points: string[];
}> = [
  {
    tier: 'starter',
    priceCents: 11900,
    summary: 'O Clube no balcão.',
    points: [
      'Balcão, Clientes e Campanhas',
      'Painel do estabelecimento',
      'Página pública',
    ],
  },
  {
    tier: 'growth',
    priceCents: 15900,
    summary: 'Fala com o Cliente além do caixa.',
    points: ['Tudo do Starter', 'Audiências', 'WhatsApp'],
  },
  {
    tier: 'enterprise',
    priceCents: 19900,
    summary: 'Enxerga o negócio e ouve o Cliente.',
    points: [
      'Tudo do Growth',
      'Pesquisa',
      'Frego Inteligência',
      'Relatórios',
    ],
  },
];
