import {
  prisma,
  type BillingAccount,
  type BusinessStatus,
  type SubscriptionTier,
} from '@frego/db';
import {
  asaasConfigured,
  asaasCreatePayment,
  asaasCreateSubscription,
  asaasCustomerPayments,
  asaasDeleteSubscription,
  asaasEnsureCustomer,
  asaasSubscriptionPayments,
  asaasUpdateSubscription,
  type AsaasBillingType,
  type AsaasPayment,
} from './asaas.js';
import {
  GRACE_MS,
  PLAN_PRICE_CENTS,
  PLAN_RANK,
  TRIAL_MS,
  effectivePaidTier,
  planName,
  resolveAccess,
  upgradeDifferenceCents,
  type Access,
  type BillingSnapshot,
  type BusinessGateStatus,
} from './plan-access.js';

const TIERS: SubscriptionTier[] = ['starter', 'growth', 'enterprise'];

export function isSubscriptionTier(value: string): value is SubscriptionTier {
  return (TIERS as string[]).includes(value);
}

export function isBillingType(value: string): value is AsaasBillingType {
  return (
    value === 'CREDIT_CARD' ||
    value === 'PIX' ||
    value === 'BOLETO' ||
    value === 'UNDEFINED'
  );
}

function ymdSaoPaulo(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function reais(cents: number): number {
  return Math.round(cents) / 100;
}

function tierFromValue(valueReais: number): SubscriptionTier | null {
  const cents = Math.round(valueReais * 100);
  const match = (Object.entries(PLAN_PRICE_CENTS) as Array<[SubscriptionTier, number]>).find(
    ([, price]) => price === cents,
  );
  return match?.[0] ?? null;
}

export function snapshotFrom(
  status: BusinessStatus,
  account: BillingAccount | null,
  now: Date,
): BillingSnapshot {
  return {
    businessStatus: status as BusinessGateStatus,
    now,
    trialEndsAt: account?.trialEndsAt ?? null,
    cortesiaTier: account?.cortesiaTier ?? null,
    paidTier: account?.paidTier ?? null,
    scheduledTier: account?.scheduledTier ?? null,
    cancelAtPeriodEnd: account?.cancelAtPeriodEnd ?? false,
    periodEndsAt: account?.periodEndsAt ?? null,
    pastDueAt: account?.pastDueAt ?? null,
    paidReplacedCortesia: account?.paidReplacedCortesia ?? false,
  };
}

export async function loadBilling(businessId: string, now = new Date()) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, status: true, name: true, cnpj: true },
  });
  if (!business) return null;

  let account = await prisma.billingAccount.findUnique({
    where: { businessId },
  });
  if (account && (await reconcileAsaas(account))) {
    account = await prisma.billingAccount.findUnique({
      where: { businessId },
    });
  }
  if (account) account = await syncPeriod(account, now);

  const access = resolveAccess(snapshotFrom(business.status, account, now));
  await syncStatus(business.status, businessId, account, access);
  return { business, account, access };
}

async function syncPeriod(account: BillingAccount, now: Date): Promise<BillingAccount> {
  if (!account.periodEndsAt || now < account.periodEndsAt) return account;

  if (account.cancelAtPeriodEnd) {
    if (account.asaasSubscriptionId && asaasConfigured()) {
      try {
        await asaasDeleteSubscription(account.asaasSubscriptionId);
      } catch (err) {
        console.error('asaas cancel failed', err);
      }
    }
    return prisma.billingAccount.update({
      where: { id: account.id },
      data: {
        paidTier: null,
        scheduledTier: null,
        pendingUpgradeTier: null,
        checkoutTier: null,
        cancelAtPeriodEnd: false,
        periodEndsAt: null,
        asaasSubscriptionId: null,
        mrrCents: 0,
      },
    });
  }

  if (account.scheduledTier && account.scheduledTier !== account.paidTier) {
    const tier = account.scheduledTier;
    if (account.asaasSubscriptionId && asaasConfigured()) {
      try {
        await asaasUpdateSubscription(account.asaasSubscriptionId, {
          value: reais(PLAN_PRICE_CENTS[tier]),
          updatePendingPayments: true,
        });
      } catch (err) {
        console.error('asaas downgrade failed', err);
      }
    }
    return prisma.billingAccount.update({
      where: { id: account.id },
      data: {
        paidTier: tier,
        scheduledTier: null,
        checkoutTier: tier,
        mrrCents: PLAN_PRICE_CENTS[tier],
      },
    });
  }

  return account;
}

async function syncStatus(
  status: BusinessStatus,
  businessId: string,
  account: BillingAccount | null,
  access: Access,
) {
  if (status === 'pending' || status === 'suspended') return;
  const next: BusinessStatus =
    access.mode === 'locked' || access.source === 'grace'
      ? 'past_due'
      : access.source === 'trial'
        ? 'trial'
        : 'active';
  const mrr =
    access.tier && (access.source === 'paid' || access.source === 'grace')
      ? PLAN_PRICE_CENTS[access.tier]
      : 0;
  if (next === status && (!account || (account.status === next && account.mrrCents === mrr))) {
    return;
  }
  await prisma.business.update({
    where: { id: businessId },
    data: { status: next },
  });
  if (account) {
    await prisma.billingAccount.update({
      where: { id: account.id },
      data: { status: next, mrrCents: mrr },
    });
  }
}

export type BillingView = {
  mode: Access['mode'];
  tier: Access['tier'];
  source: Access['source'];
  features: Access['features'];
  publicPage: boolean;
  trialEndsAt: string | null;
  periodEndsAt: string | null;
  pastDueAt: string | null;
  cortesiaTier: SubscriptionTier | null;
  paidTier: SubscriptionTier | null;
  scheduledTier: SubscriptionTier | null;
  pendingUpgradeTier: SubscriptionTier | null;
  cancelAtPeriodEnd: boolean;
  billingType: string | null;
  prices: typeof PLAN_PRICE_CENTS;
};

export function presentBilling(
  account: BillingAccount | null,
  access: Access,
): BillingView {
  return {
    mode: access.mode,
    tier: access.tier,
    source: access.source,
    features: access.features,
    publicPage: access.publicPage,
    trialEndsAt: account?.trialEndsAt?.toISOString() ?? null,
    periodEndsAt: account?.periodEndsAt?.toISOString() ?? null,
    pastDueAt: account?.pastDueAt?.toISOString() ?? null,
    cortesiaTier: account?.cortesiaTier ?? null,
    paidTier: account?.paidTier ?? null,
    scheduledTier: account?.scheduledTier ?? null,
    pendingUpgradeTier: account?.pendingUpgradeTier ?? null,
    cancelAtPeriodEnd: account?.cancelAtPeriodEnd ?? false,
    billingType: account?.billingType ?? null,
    prices: PLAN_PRICE_CENTS,
  };
}

export async function accessFor(businessId: string, now = new Date()) {
  const loaded = await loadBilling(businessId, now);
  return loaded?.access ?? null;
}

/** A confirmed Plano is still in its paid period or inside the 3-day grace. */
export function subscriptionBlocksCortesia(account: BillingAccount, now: Date): boolean {
  const paid = effectivePaidTier(snapshotFrom('active', account, now));
  if (!paid) return false;
  if (
    account.pastDueAt &&
    now.getTime() >= account.pastDueAt.getTime() + GRACE_MS
  ) {
    return false;
  }
  return true;
}

export async function startTrial(businessId: string, now = new Date()) {
  const trialEndsAt = new Date(now.getTime() + TRIAL_MS);
  await prisma.billingAccount.update({
    where: { businessId },
    data: { trialEndsAt, status: 'trial' },
  });
  return trialEndsAt;
}

export async function setCortesia(
  businessId: string,
  tier: SubscriptionTier | null,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  const loaded = await loadBilling(businessId, now);
  if (!loaded?.account) return { ok: false, error: 'NOT_FOUND' };
  if (tier && subscriptionBlocksCortesia(loaded.account, now)) {
    return { ok: false, error: 'CORTESIA_BLOCKED' };
  }
  await prisma.billingAccount.update({
    where: { id: loaded.account.id },
    data: {
      cortesiaTier: tier,
      ...(tier ? { paidReplacedCortesia: false } : {}),
    },
  });
  return { ok: true };
}

export async function locationIsOperable(
  businessId: string,
  locationId: string,
  access: Access,
): Promise<boolean> {
  if (access.mode !== 'open') return false;
  if (access.features.extraLocations) return true;
  const oldest = await prisma.location.findFirst({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return !oldest || oldest.id === locationId;
}

export async function whatsappSendingAllowed(businessId: string): Promise<boolean> {
  const access = await accessFor(businessId);
  return Boolean(access?.features.whatsapp);
}

type CheckoutResult =
  | { ok: true; kind: 'invoice'; invoiceUrl: string | null; tier: SubscriptionTier }
  | { ok: true; kind: 'scheduled'; tier: SubscriptionTier; appliesAt: string | null }
  | { ok: true; kind: 'current'; tier: SubscriptionTier }
  | { ok: false; error: string; status: number; message?: string };

export async function changePlan(input: {
  businessId: string;
  tier: SubscriptionTier;
  billingType: AsaasBillingType;
  ownerEmail: string | null;
  now?: Date;
}): Promise<CheckoutResult> {
  const now = input.now ?? new Date();
  const loaded = await loadBilling(input.businessId, now);
  if (!loaded?.account) return { ok: false, error: 'NOT_FOUND', status: 404 };
  if (loaded.business.status === 'pending') {
    return { ok: false, error: 'PENDING_APPROVAL', status: 403 };
  }
  if (loaded.business.status === 'suspended') {
    return { ok: false, error: 'SUSPENDED', status: 403 };
  }

  const account = loaded.account;
  const paidNow = effectivePaidTier(snapshotFrom(loaded.business.status, account, now));
  const periodOpen = Boolean(account.periodEndsAt && account.periodEndsAt > now);
  const hasPaidPeriod = Boolean(paidNow) && periodOpen;
  const billed = Boolean(account.asaasSubscriptionId) && Boolean(paidNow);

  if (hasPaidPeriod && input.tier === paidNow) {
    await prisma.billingAccount.update({
      where: { id: account.id },
      data: { scheduledTier: null, cancelAtPeriodEnd: false, pendingUpgradeTier: null },
    });
    return { ok: true, kind: 'current', tier: input.tier };
  }

  if (hasPaidPeriod && paidNow && PLAN_RANK[input.tier] < PLAN_RANK[paidNow]) {
    await prisma.billingAccount.update({
      where: { id: account.id },
      data: {
        scheduledTier: input.tier,
        cancelAtPeriodEnd: false,
        pendingUpgradeTier: null,
      },
    });
    return {
      ok: true,
      kind: 'scheduled',
      tier: input.tier,
      appliesAt: account.periodEndsAt?.toISOString() ?? null,
    };
  }

  if (!asaasConfigured()) {
    return { ok: false, error: 'ASAAS_NOT_CONFIGURED', status: 503 };
  }
  if (!loaded.business.cnpj) {
    return { ok: false, error: 'CNPJ_REQUIRED', status: 409 };
  }

  const owner = await prisma.teamMember.findFirst({
    where: { businessId: input.businessId, role: 'owner', status: 'active' },
    select: { email: true },
  });

  try {
    const customerId = await asaasEnsureCustomer({
      customerId: account.asaasCustomerId,
      name: loaded.business.name,
      cpfCnpj: loaded.business.cnpj,
      email: input.ownerEmail ?? owner?.email ?? null,
      externalReference: input.businessId,
    });

    if (billed && paidNow && PLAN_RANK[input.tier] > PLAN_RANK[paidNow]) {
      const diff = upgradeDifferenceCents(paidNow, input.tier);
      const payment = await asaasCreatePayment({
        customer: customerId,
        billingType: input.billingType,
        value: reais(diff),
        dueDate: ymdSaoPaulo(now),
        description: `Frego ${planName(input.tier)}`,
        externalReference: `upgrade:${input.tier}`,
      });
      await prisma.billingAccount.update({
        where: { id: account.id },
        data: {
          asaasCustomerId: customerId,
          billingType: input.billingType,
          pendingUpgradeTier: input.tier,
          scheduledTier: null,
          cancelAtPeriodEnd: false,
        },
      });
      return {
        ok: true,
        kind: 'invoice',
        invoiceUrl: payment.invoiceUrl,
        tier: input.tier,
      };
    }

    let subscriptionId = account.asaasSubscriptionId;
    if (!subscriptionId) {
      const created = await asaasCreateSubscription({
        customer: customerId,
        billingType: input.billingType,
        value: reais(PLAN_PRICE_CENTS[input.tier]),
        nextDueDate: ymdSaoPaulo(now),
        description: `Frego ${planName(input.tier)}`,
        externalReference: `plan:${input.businessId}`,
      });
      subscriptionId = created.id;
    } else {
      await asaasUpdateSubscription(subscriptionId, {
        value: reais(PLAN_PRICE_CENTS[input.tier]),
        billingType: input.billingType,
        updatePendingPayments: true,
      });
    }

    await prisma.billingAccount.update({
      where: { id: account.id },
      data: {
        asaasCustomerId: customerId,
        asaasSubscriptionId: subscriptionId,
        billingType: input.billingType,
        checkoutTier: input.tier,
        cancelAtPeriodEnd: false,
        scheduledTier: null,
      },
    });

    const payments = await asaasSubscriptionPayments(subscriptionId);
    return {
      ok: true,
      kind: 'invoice',
      invoiceUrl: firstOpenPayment(payments)?.invoiceUrl ?? null,
      tier: input.tier,
    };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ASAAS_NOT_CONFIGURED') {
      return { ok: false, error: 'ASAAS_NOT_CONFIGURED', status: 503 };
    }
    console.error(err);
    const message = err instanceof Error ? err.message : undefined;
    return { ok: false, error: 'ASAAS_ERROR', status: 502, message };
  }
}

function firstOpenPayment(payments: AsaasPayment[]): AsaasPayment | null {
  return (
    payments.find((payment) =>
      ['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS'].includes(payment.status),
    ) ??
    payments[0] ??
    null
  );
}

export async function scheduleCancel(businessId: string, now = new Date()) {
  const loaded = await loadBilling(businessId, now);
  if (!loaded?.account?.paidTier) return { ok: false as const, error: 'NO_SUBSCRIPTION' };
  await prisma.billingAccount.update({
    where: { id: loaded.account.id },
    data: { cancelAtPeriodEnd: true, scheduledTier: null, pendingUpgradeTier: null },
  });
  return {
    ok: true as const,
    appliesAt: loaded.account.periodEndsAt?.toISOString() ?? null,
  };
}

export async function updatePaymentMethod(
  businessId: string,
  billingType: AsaasBillingType,
) {
  const account = await prisma.billingAccount.findUnique({ where: { businessId } });
  if (!account?.asaasSubscriptionId) {
    return { ok: false as const, error: 'NO_SUBSCRIPTION', status: 409 };
  }
  if (!asaasConfigured()) {
    return { ok: false as const, error: 'ASAAS_NOT_CONFIGURED', status: 503 };
  }
  try {
    await asaasUpdateSubscription(account.asaasSubscriptionId, { billingType });
    await prisma.billingAccount.update({
      where: { id: account.id },
      data: { billingType },
    });
    const payments = await asaasSubscriptionPayments(account.asaasSubscriptionId);
    return {
      ok: true as const,
      invoiceUrl: firstOpenPayment(payments)?.invoiceUrl ?? null,
    };
  } catch (err) {
    console.error(err);
    return { ok: false as const, error: 'ASAAS_ERROR', status: 502 };
  }
}

function periodEndFromDue(dueDate: string): Date {
  const [year, month, day] = dueDate.split('-').map(Number);
  const due = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 15, 0, 0));
  return addMonths(due, 1);
}

async function findAccountForPayment(payment: AsaasPayment) {
  if (payment.subscription) {
    const bySubscription = await prisma.billingAccount.findFirst({
      where: { asaasSubscriptionId: payment.subscription },
    });
    if (bySubscription) return bySubscription;
  }
  if (payment.customer) {
    return prisma.billingAccount.findFirst({
      where: { asaasCustomerId: payment.customer },
    });
  }
  return null;
}

export async function applyAsaasPayment(payment: AsaasPayment): Promise<void> {
  const confirmed = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(payment.status);
  const overdue = payment.status === 'OVERDUE';
  if (!confirmed && !overdue) return;

  const row = await findAccountForPayment(payment);
  if (!row) return;

  const upgradeTier = payment.externalReference?.startsWith('upgrade:')
    ? payment.externalReference.slice('upgrade:'.length)
    : null;

  if (overdue) {
    if (!row.paidTier) return;
    if (row.pastDueAt) return;
    await prisma.billingAccount.update({
      where: { id: row.id },
      data: { pastDueAt: new Date() },
    });
    return;
  }

  if (upgradeTier && isSubscriptionTier(upgradeTier)) {
    if (
      row.paidTier &&
      PLAN_RANK[row.paidTier] >= PLAN_RANK[upgradeTier]
    ) {
      if (row.pendingUpgradeTier) {
        await prisma.billingAccount.update({
          where: { id: row.id },
          data: { pendingUpgradeTier: null },
        });
      }
      return;
    }
    if (row.asaasSubscriptionId && asaasConfigured()) {
      try {
        await asaasUpdateSubscription(row.asaasSubscriptionId, {
          value: reais(PLAN_PRICE_CENTS[upgradeTier]),
          updatePendingPayments: false,
        });
      } catch (err) {
        console.error('asaas upgrade value failed', err);
      }
    }
    await prisma.billingAccount.update({
      where: { id: row.id },
      data: {
        paidTier: upgradeTier,
        pendingUpgradeTier: null,
        scheduledTier: null,
        cancelAtPeriodEnd: false,
        pastDueAt: null,
        mrrCents: PLAN_PRICE_CENTS[upgradeTier],
        paidReplacedCortesia: row.cortesiaTier ? true : row.paidReplacedCortesia,
        cortesiaTier: null,
      },
    });
    return;
  }

  const paidTier =
    row.checkoutTier ?? row.paidTier ?? tierFromValue(payment.value);
  if (!paidTier) return;

  const replacedCortesia = Boolean(row.cortesiaTier);
  await prisma.billingAccount.update({
    where: { id: row.id },
    data: {
      paidTier,
      checkoutTier: paidTier,
      periodEndsAt: payment.dueDate ? periodEndFromDue(payment.dueDate) : addMonths(new Date(), 1),
      pastDueAt: null,
      mrrCents: PLAN_PRICE_CENTS[paidTier],
      paidReplacedCortesia: replacedCortesia ? true : row.paidReplacedCortesia,
      cortesiaTier: replacedCortesia ? null : row.cortesiaTier,
    },
  });
}

async function reconcileAsaas(account: BillingAccount): Promise<boolean> {
  const waitingUpgrade = Boolean(account.pendingUpgradeTier);
  const checkoutTier = account.checkoutTier;
  const waitingFirst =
    Boolean(checkoutTier) &&
    checkoutTier !== account.paidTier &&
    (!account.paidTier || (checkoutTier != null && PLAN_RANK[checkoutTier] > PLAN_RANK[account.paidTier]));
  if (!waitingUpgrade && !waitingFirst) return false;
  if (!asaasConfigured()) return false;
  if (!account.asaasCustomerId && !account.asaasSubscriptionId) return false;
  try {
    const payments = account.asaasCustomerId
      ? await asaasCustomerPayments(account.asaasCustomerId)
      : await asaasSubscriptionPayments(account.asaasSubscriptionId!);
    for (const payment of payments) {
      await applyAsaasPayment(payment);
    }
  } catch (err) {
    console.error('asaas reconcile failed', err);
  }
  return true;
}
