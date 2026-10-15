/** Commercial Plano. The trial is not one of these. */
export type SubscriptionTier = 'starter' | 'growth' | 'enterprise';

export type Feature =
  | 'audiences'
  | 'pesquisas'
  | 'whatsapp'
  | 'intelligence'
  | 'reports'
  | 'extraLocations';

export const FEATURES: Feature[] = [
  'audiences',
  'pesquisas',
  'whatsapp',
  'intelligence',
  'reports',
  'extraLocations',
];

export const PLAN_PRICE_CENTS: Record<SubscriptionTier, number> = {
  starter: 11900,
  growth: 15900,
  enterprise: 19900,
};

export const PLAN_RANK: Record<SubscriptionTier, number> = {
  starter: 0,
  growth: 1,
  enterprise: 2,
};

export const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;
export const GRACE_MS = 3 * 24 * 60 * 60 * 1000;

const GROWTH_FEATURES: Feature[] = ['audiences', 'whatsapp'];
const ENTERPRISE_FEATURES: Feature[] = [
  ...GROWTH_FEATURES,
  'pesquisas',
  'intelligence',
  'reports',
];

export function featuresFor(
  tier: SubscriptionTier | null,
): Record<Feature, boolean> {
  const on =
    tier === 'enterprise'
      ? ENTERPRISE_FEATURES
      : tier === 'growth'
        ? GROWTH_FEATURES
        : [];
  return Object.fromEntries(
    FEATURES.map((feature) => [
      feature,
      feature === 'extraLocations' ? tier != null : on.includes(feature),
    ]),
  ) as Record<Feature, boolean>;
}

export function planName(tier: SubscriptionTier): string {
  if (tier === 'starter') return 'Starter';
  if (tier === 'growth') return 'Growth';
  return 'Enterprise';
}

/** Feature that a lower Plano does not include, and the Plano that does. */
export function requiredTier(feature: Feature): SubscriptionTier {
  if (feature === 'extraLocations') return 'starter';
  return GROWTH_FEATURES.includes(feature) ? 'growth' : 'enterprise';
}

export type BusinessGateStatus =
  | 'pending'
  | 'trial'
  | 'active'
  | 'past_due'
  | 'suspended';

export type BillingSnapshot = {
  businessStatus: BusinessGateStatus;
  now: Date;
  trialEndsAt: Date | null;
  cortesiaTier: SubscriptionTier | null;
  paidTier: SubscriptionTier | null;
  scheduledTier: SubscriptionTier | null;
  cancelAtPeriodEnd: boolean;
  periodEndsAt: Date | null;
  pastDueAt: Date | null;
  /** A confirmed payment replaced a Cortesia, so the paid Plano applies during the trial. */
  paidReplacedCortesia: boolean;
};

export type AccessMode = 'pending' | 'suspended' | 'open' | 'locked';
export type AccessSource = 'trial' | 'cortesia' | 'paid' | 'grace';

export type Access = {
  mode: AccessMode;
  tier: SubscriptionTier | null;
  source: AccessSource | null;
  features: Record<Feature, boolean>;
  publicPage: boolean;
};

function closed(mode: 'pending' | 'suspended' | 'locked'): Access {
  return {
    mode,
    tier: null,
    source: null,
    features: featuresFor(null),
    publicPage: false,
  };
}

function open(
  tier: SubscriptionTier,
  source: AccessSource,
): Access {
  return {
    mode: 'open',
    tier,
    source,
    features: featuresFor(tier),
    publicPage: true,
  };
}

/** Plano actually in force after a scheduled downgrade or cancel. */
export function effectivePaidTier(s: BillingSnapshot): SubscriptionTier | null {
  if (!s.paidTier) return null;
  if (s.periodEndsAt && s.now.getTime() >= s.periodEndsAt.getTime()) {
    if (s.cancelAtPeriodEnd) return null;
    if (s.scheduledTier) return s.scheduledTier;
  }
  return s.paidTier;
}

function pastGrace(s: BillingSnapshot, paid: SubscriptionTier | null): boolean {
  if (!paid || !s.pastDueAt) return false;
  return s.now.getTime() >= s.pastDueAt.getTime() + GRACE_MS;
}

export function resolveAccess(s: BillingSnapshot): Access {
  if (s.businessStatus === 'pending') return closed('pending');
  if (s.businessStatus === 'suspended') return closed('suspended');

  const paid = effectivePaidTier(s);
  const inTrial = s.trialEndsAt != null && s.now.getTime() < s.trialEndsAt.getTime();
  const overdue = pastGrace(s, paid);
  const paidAlive = paid != null && !overdue;

  if (s.paidReplacedCortesia && paid) {
    if (overdue) return closed('locked');
    return open(paid, s.pastDueAt ? 'grace' : 'paid');
  }

  if (s.cortesiaTier && !paidAlive) {
    return open(s.cortesiaTier, 'cortesia');
  }

  if (inTrial) return open('enterprise', 'trial');

  if (paid) {
    if (overdue) return closed('locked');
    return open(paid, s.pastDueAt ? 'grace' : 'paid');
  }

  return closed('locked');
}

export function upgradeDifferenceCents(
  from: SubscriptionTier,
  to: SubscriptionTier,
): number {
  return PLAN_PRICE_CENTS[to] - PLAN_PRICE_CENTS[from];
}
