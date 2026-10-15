'use client';

import { useState } from 'react';
import { BarChart3, Check, Layers, MessageCircle, Stamp, type LucideIcon } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { useBusiness } from '@/lib/business-context';
import {
  formatPlanPrice,
  LANDING_PLANS,
  PLAN_LABEL,
  PLAN_ORDER,
  type PlanTier,
} from '@/lib/plans';

const PLAN_ICON: Record<PlanTier, LucideIcon> = {
  starter: Stamp,
  growth: MessageCircle,
  enterprise: BarChart3,
};

function when(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function rank(tier: PlanTier) {
  return PLAN_ORDER.indexOf(tier);
}

export function BillingSettings() {
  const { business, authHeaders, refresh } = useBusiness();
  const billing = business?.billing;
  const owner = business?.role === 'owner';
  const inForce: PlanTier | null = !billing
    ? null
    : billing.source === 'cortesia'
      ? billing.cortesiaTier
      : billing.source === 'trial'
        ? 'enterprise'
        : billing.tier;
  const [tier, setTier] = useState<PlanTier | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!billing) return null;

  const periodOpen = Boolean(
    billing.periodEndsAt && new Date(billing.periodEndsAt).getTime() > Date.now(),
  );
  const paidOpen =
    (billing.source === 'paid' || billing.source === 'grace') && Boolean(inForce) && periodOpen;
  const selected = tier ?? billing.scheduledTier ?? inForce ?? 'growth';
  const price =
    billing.prices[selected] ??
    LANDING_PLANS.find((plan) => plan.tier === selected)?.priceCents ??
    0;
  const currentPrice = inForce ? (billing.prices[inForce] ?? 0) : 0;
  const upgrading = Boolean(paidOpen && inForce && rank(selected) > rank(inForce));
  const downgrading = Boolean(paidOpen && inForce && rank(selected) < rank(inForce));
  const same = Boolean(paidOpen && inForce && selected === inForce);
  const alreadyScheduled = billing.scheduledTier === selected;
  const keeping = same && Boolean(billing.scheduledTier);
  const due = upgrading ? Math.max(price - currentPrice, 0) : price;
  const needsCharge = !same && !downgrading;
  const changeOn = when(billing.periodEndsAt);
  const action = keeping
    ? `Manter ${PLAN_LABEL[selected]}`
    : same
      ? 'Plano atual'
      : alreadyScheduled && changeOn
        ? `Mudança confirmada · ${PLAN_LABEL[selected]} em ${changeOn}`
        : downgrading
          ? `Confirmar mudança para ${PLAN_LABEL[selected]}`
          : `Pagar ${formatPlanPrice(due)} na Asaas`;

  async function post(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: body
          ? { ...headers, 'Content-Type': 'application/json' }
          : headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json()) as {
        error?: string;
        message?: string;
        result?: { kind?: string; invoiceUrl?: string | null; appliesAt?: string | null };
        invoiceUrl?: string | null;
        appliesAt?: string | null;
      };
      if (!res.ok) {
        if (json.error === 'ASAAS_NOT_CONFIGURED') {
          throw new Error('A cobrança ainda não está ligada. Fale com o Frego.');
        }
        if (json.error === 'OWNER_ONLY') {
          throw new Error('Só quem é dono do estabelecimento altera o Plano.');
        }
        if (json.error === 'CNPJ_REQUIRED') {
          throw new Error(
            'Informe o CPF ou CNPJ do estabelecimento e salve o perfil. A Asaas só gera a cobrança com ele.',
          );
        }
        throw new Error(json.message || 'Não foi possível atualizar o Plano.');
      }
      const invoice = json.result?.invoiceUrl ?? json.invoiceUrl;
      if (invoice) window.open(invoice, '_blank', 'noopener,noreferrer');
      const date = when(json.result?.appliesAt ?? json.appliesAt ?? null);
      if (path === '/billing/cancel') {
        setNote(date ? `O Plano encerra em ${date}.` : 'O Plano encerra no fim do período.');
      } else if (json.result?.kind === 'scheduled' || json.appliesAt) {
        setNote(date ? `A mudança vale em ${date}.` : 'A mudança vale no fim do período já pago.');
      } else if (json.result?.kind === 'current') {
        setNote('Este já é o Plano do período.');
      } else if (invoice) {
        setNote('A cobrança abriu na Asaas. Lá você escolhe Pix, boleto ou cartão.');
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar o Plano.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="plano"
      className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 md:p-5"
    >
      <div className="mb-4 flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-primary-50)] text-[var(--color-primary-600)]">
          <Layers size={16} strokeWidth={2.25} aria-hidden />
        </span>
        <div>
          <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
            Planos
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-neutral-500)]">
            {describe(billing)}
          </p>
        </div>
      </div>

      {owner ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2 md:grid-cols-3">
            {LANDING_PLANS.map((plan) => {
              const picked = selected === plan.tier;
              const Icon = PLAN_ICON[plan.tier];
              const cents = billing.prices[plan.tier] ?? plan.priceCents;
              return (
                <button
                  key={plan.tier}
                  type="button"
                  onClick={() => setTier(plan.tier)}
                  className={`flex h-full w-full flex-col items-stretch justify-start rounded-[12px] border px-3 py-3 text-left ${
                    picked
                      ? 'border-[var(--color-primary-500)] bg-[var(--color-primary-50)]'
                      : 'border-[var(--color-hairline)]'
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--color-bg)] text-[var(--color-ink)]">
                      <Icon size={16} strokeWidth={2.25} aria-hidden />
                    </span>
                    {inForce === plan.tier ? (
                      <span className="rounded-full bg-[var(--color-ink)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Atual
                      </span>
                    ) : billing.scheduledTier === plan.tier ? (
                      <span className="rounded-full bg-[var(--color-ink)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {changeOn ? `A partir de ${changeOn}` : 'Próximo período'}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-3 block text-[13px] font-semibold text-[var(--color-ink)]">
                    {PLAN_LABEL[plan.tier]}
                  </span>
                  <span className="mt-1 block text-[18px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
                    {formatPlanPrice(cents)}
                    <span className="text-[12px] font-normal text-[var(--color-neutral-500)]">
                      {' '}
                      /mês
                    </span>
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-[var(--color-neutral-500)]">
                    {billing.scheduledTier === plan.tier && changeOn && inForce
                      ? `${PLAN_LABEL[inForce]} segue até ${changeOn}.`
                      : plan.summary}
                  </span>
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {plan.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-1.5 text-[12px] leading-snug text-[var(--color-neutral-600)]"
                      >
                        <Check size={14} className="mt-0.5 shrink-0" aria-hidden />
                        {point}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              disabled={busy || (same && !keeping) || alreadyScheduled || (needsCharge && !business?.cnpj)}
              onClick={() => void post('/billing/plan', { tier: selected })}
              className="min-h-11 rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? (downgrading ? 'Salvando…' : 'Abrindo cobrança…') : action}
            </button>
            {alreadyScheduled && changeOn && inForce ? (
              <p className="text-[12px] leading-snug text-[var(--color-neutral-500)]">
                {PLAN_LABEL[inForce]} segue até {changeOn}. Depois passa para {PLAN_LABEL[selected]}.
              </p>
            ) : same ? null : downgrading ? (
              <p className="text-[12px] leading-snug text-[var(--color-neutral-500)]">
                {inForce
                  ? `${PLAN_LABEL[inForce]} segue até ${changeOn ?? 'o fim do período'}. A mudança só vale depois que você confirmar.`
                  : 'A mudança só vale depois que você confirmar.'}
              </p>
            ) : (
              <p className="text-[12px] leading-snug text-[var(--color-neutral-500)]">
                {upgrading
                  ? `Só a diferença agora. Na página da Asaas você escolhe Pix, boleto ou cartão.`
                  : 'Na página da Asaas você escolhe Pix, boleto ou cartão.'}
              </p>
            )}
            {!business?.cnpj && needsCharge ? (
              <p className="text-[13px] text-[var(--color-neutral-600)]">
                A Asaas só gera a cobrança com o CPF ou CNPJ.{' '}
                <a href="#cnpj" className="font-semibold text-[var(--color-ink)]">
                  Informe o CPF ou CNPJ
                </a>{' '}
                e salve o perfil.
              </p>
            ) : null}
          </div>
          {note ? (
            <p className="text-[13px] text-[var(--color-neutral-600)]" role="status">
              {note}
            </p>
          ) : null}
          {error ? (
            <p className="text-[13px] text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          {billing.paidTier ? (
            <div className="flex justify-end border-t border-[var(--color-hairline)] pt-3">
              <button
                type="button"
                disabled={busy || billing.cancelAtPeriodEnd}
                onClick={() => void post('/billing/cancel')}
                className="text-[12px] font-normal text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] disabled:opacity-60"
              >
                {billing.cancelAtPeriodEnd ? 'Cancelamento agendado' : 'Cancelar Plano'}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-[14px] text-[var(--color-neutral-500)]">
          Só quem é dono do estabelecimento altera o Plano.
        </p>
      )}
    </section>
  );
}

function describe(billing: NonNullable<ReturnType<typeof useBusiness>['business']>['billing']) {
  if (!billing) return '';
  if (billing.mode === 'locked') {
    return 'O pagamento não confirmou. O balcão fica fechado até a Asaas confirmar.';
  }
  if (billing.source === 'trial' && billing.trialEndsAt) {
    return `Teste do Enterprise até ${when(billing.trialEndsAt)}. O Plano escolhido vale no dia seguinte se o pagamento confirmar.`;
  }
  if (billing.source === 'cortesia' && billing.cortesiaTier) {
    return `${PLAN_LABEL[billing.cortesiaTier]} por cortesia, sem cobrança.`;
  }
  if (billing.source === 'grace') {
    return 'A renovação está em atraso. O Frego segue aberto por 3 dias depois do vencimento.';
  }
  const name = billing.tier ? PLAN_LABEL[billing.tier] : 'Plano';
  const next = when(billing.periodEndsAt);
  if (billing.cancelAtPeriodEnd && next) {
    return `${name} segue até ${next}. Depois o Plano encerra.`;
  }
  if (billing.scheduledTier && next) {
    return `${name} até ${next}. Depois, ${PLAN_LABEL[billing.scheduledTier]}.`;
  }
  const scheduled = billing.scheduledTier
    ? ` Muda para ${PLAN_LABEL[billing.scheduledTier]}${next ? ` em ${next}` : ''}.`
    : '';
  const cancel = billing.cancelAtPeriodEnd
    ? ` Cancela${next ? ` em ${next}` : ' no fim do período'}.`
    : '';
  return `${name}${next ? ` · próxima cobrança ${next}` : ''}.${scheduled}${cancel}`;
}
