'use client';

import {
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  Banknote,
  Cake,
  CalendarRange,
  Camera,
  Coins,
  Gift,
  ImageIcon,
  Percent,
  Stamp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { CampaignCardPreview } from '@/components/campaign-card-preview';
import { uploadCampaignRewardImage } from '@/lib/firebase';
import {
  WEEKDAY_LABELS,
  promoFrequencyHint,
} from '@/lib/promo-label';

export type CampaignType = 'stamps' | 'spend' | 'birthday' | 'cashback' | 'promo';
export type PromoPeriod = 'day' | 'week' | 'month' | 'year' | 'campaign';

export type CampaignFormState = {
  name: string;
  type: CampaignType;
  stampsNeeded: number;
  pointsPerReal: number;
  cashbackPercent: number;
  rewardTitle: string;
  rewardDescription: string;
  rewardImageUrl: string;
  activate: boolean;
  audienceSegmentId: string;
  startsOn: string;
  endsOn: string;
  weekdays: number[];
  unlimited: boolean;
  redeemMax: number;
  redeemPeriod: PromoPeriod;
};

export type AudienceOption = {
  id: string;
  name: string;
  memberCount: number;
};

export const emptyCampaignForm: CampaignFormState = {
  name: '',
  type: 'stamps',
  stampsNeeded: 10,
  pointsPerReal: 1,
  cashbackPercent: 5,
  rewardTitle: '',
  rewardDescription: '',
  rewardImageUrl: '',
  activate: true,
  audienceSegmentId: '',
  startsOn: '',
  endsOn: '',
  weekdays: [],
  unlimited: true,
  redeemMax: 1,
  redeemPeriod: 'day',
};

type TypeOption = {
  value: CampaignType;
  title: string;
  hint: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
  fill: string;
  /** Glyph on the selected fill. Mostarda needs Grafite; dark fills need white. */
  onFill: string;
};

const TYPES: TypeOption[] = [
  {
    value: 'stamps',
    title: 'Carimbos',
    hint: 'Cada visita no balcão vale 1 carimbo.',
    Icon: Stamp,
    color: 'var(--color-stamps)',
    bg: 'var(--color-stamps-bg)',
    fill: 'var(--color-stamps)',
    onFill: '#fff',
  },
  {
    value: 'spend',
    title: 'Pontos',
    hint: 'Acumula pela compra. A taxa fica em Configurações.',
    Icon: Coins,
    color: 'var(--color-points)',
    bg: 'var(--color-points-bg)',
    fill: 'var(--color-points)',
    onFill: '#fff',
  },
  {
    value: 'birthday',
    title: 'Aniversário',
    hint: 'Presente uma vez por ano, no aniversário.',
    Icon: Cake,
    color: 'var(--color-ink)',
    bg: 'var(--color-primary-50)',
    fill: 'var(--color-primary-500)',
    onFill: 'var(--color-grafite)',
  },
  {
    value: 'cashback',
    title: 'Cashback',
    hint: 'Um percentual da compra volta em reais no caixa.',
    Icon: Banknote,
    color: 'var(--color-cashback)',
    bg: 'var(--color-cashback-bg)',
    fill: 'var(--color-cashback)',
    onFill: '#fff',
  },
  {
    value: 'promo',
    title: 'Promoção',
    hint: 'Sem carimbos nem pontos. Calendário da casa e limite de resgates.',
    Icon: Percent,
    color: 'var(--color-promo)',
    bg: 'var(--color-promo-bg)',
    fill: 'var(--color-promo)',
    onFill: '#fff',
  },
];

const TYPE_DEFAULTS: Record<
  CampaignType,
  { stampsNeeded: number; name: string; rewardTitle: string }
> = {
  stamps: {
    stampsNeeded: 10,
    name: 'Carimbo fidelidade',
    rewardTitle: 'Item grátis',
  },
  spend: {
    stampsNeeded: 100,
    name: 'Pontos por compra',
    rewardTitle: 'Prêmio da casa',
  },
  birthday: {
    stampsNeeded: 1,
    name: 'Presente de aniversário',
    rewardTitle: 'Sobremesa grátis',
  },
  cashback: {
    stampsNeeded: 1,
    name: 'Cashback',
    rewardTitle: 'Volta em R$',
  },
  promo: {
    stampsNeeded: 1,
    name: 'Promoção',
    rewardTitle: '50% off',
  },
};

const inputClass =
  'mt-1.5 min-h-11 w-full rounded-[12px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[15px] text-[var(--color-ink)] outline-none focus:border-[var(--color-primary-500)]';

function applyType(form: CampaignFormState, type: CampaignType): CampaignFormState {
  const defaults = TYPE_DEFAULTS[type];
  const prevDefaults = TYPE_DEFAULTS[form.type];
  const nameIsStock = !form.name.trim() || form.name === prevDefaults.name;
  const rewardIsStock =
    !form.rewardTitle.trim() || form.rewardTitle === prevDefaults.rewardTitle;
  return {
    ...form,
    type,
    stampsNeeded: defaults.stampsNeeded,
    name: nameIsStock ? defaults.name : form.name,
    rewardTitle: rewardIsStock ? defaults.rewardTitle : form.rewardTitle,
    ...(type === 'promo'
      ? {
          unlimited: false,
          redeemMax: 1,
          redeemPeriod: 'campaign' as const,
          weekdays: [] as number[],
        }
      : type === 'stamps'
        ? { unlimited: true, redeemMax: 1, redeemPeriod: 'day' as const }
        : {}),
  };
}

function Section({
  Icon,
  title,
  hint,
  children,
}: {
  Icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-primary-50)] text-[var(--color-primary-600)]">
          <Icon size={16} strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
            {title}
          </h3>
          {hint ? (
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-neutral-500)]">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  suffix: string;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <button
        type="button"
        aria-label="Diminuir"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[var(--color-neutral-200)] text-[20px] font-semibold text-[var(--color-ink)]"
      >
        −
      </button>
      <div className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] border border-[var(--color-neutral-200)] px-3">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            onChange(Math.min(max, Math.max(min, n)));
          }}
          className="w-16 bg-transparent text-center text-[18px] font-semibold tabular-nums outline-none"
        />
        <span className="text-[13px] text-[var(--color-neutral-500)]">
          {suffix}
        </span>
      </div>
      <button
        type="button"
        aria-label="Aumentar"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[var(--color-neutral-200)] text-[20px] font-semibold text-[var(--color-ink)]"
      >
        +
      </button>
    </div>
  );
}

function PromoRules({
  form,
  setForm,
}: {
  form: CampaignFormState;
  setForm: Dispatch<SetStateAction<CampaignFormState>>;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div>
        <span className="text-[13px] font-semibold text-[var(--color-ink)]">
          Quando vale
        </span>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <label className="block text-[12px] font-medium text-[var(--color-neutral-500)]">
            Início
            <input
              type="date"
              value={form.startsOn}
              onChange={(e) =>
                setForm((f) => ({ ...f, startsOn: e.target.value }))
              }
              className={inputClass}
            />
          </label>
          <label className="block text-[12px] font-medium text-[var(--color-neutral-500)]">
            Fim
            <input
              type="date"
              value={form.endsOn}
              onChange={(e) =>
                setForm((f) => ({ ...f, endsOn: e.target.value }))
              }
              className={inputClass}
            />
          </label>
        </div>
        <p className="mt-1.5 text-[12px] font-normal text-[var(--color-neutral-500)]">
          Vazio = sem data. Dias em Brasília.
        </p>
      </div>

      <div>
        <span className="text-[13px] font-semibold text-[var(--color-ink)]">
          Dias da semana
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {WEEKDAY_LABELS.map((label, day) => {
            const selected =
              form.weekdays.length === 0 || form.weekdays.includes(day);
            const all = form.weekdays.length === 0;
            return (
              <button
                key={label}
                type="button"
                onClick={() =>
                  setForm((f) => {
                    if (f.weekdays.length === 0) {
                      return {
                        ...f,
                        weekdays: [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== day),
                      };
                    }
                    const has = f.weekdays.includes(day);
                    const next = has
                      ? f.weekdays.filter((d) => d !== day)
                      : [...f.weekdays, day].sort((a, b) => a - b);
                    return {
                      ...f,
                      weekdays: next.length === 7 ? [] : next,
                    };
                  })
                }
                className="min-h-9 rounded-[10px] border px-2.5 text-[12px] font-semibold"
                style={
                  selected && !all
                    ? {
                        borderColor: 'var(--color-promo)',
                        background: 'var(--color-promo-bg)',
                        color: 'var(--color-promo)',
                      }
                    : selected
                      ? {
                          borderColor: 'var(--color-neutral-200)',
                          color: 'var(--color-ink)',
                        }
                      : {
                          borderColor: 'var(--color-neutral-200)',
                          color: 'var(--color-neutral-400)',
                        }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[12px] font-normal text-[var(--color-neutral-500)]">
          Todos selecionados = qualquer dia.
        </p>
      </div>

      <RedeemLimitFields
        form={form}
        setForm={setForm}
        unlimitedHint="Resgate a cada visita, um código aberto por vez."
        cappedHint="O cliente resgata no app na hora da visita. O código vale 24h."
      />
    </div>
  );
}

function RedeemLimitFields({
  form,
  setForm,
  unlimitedHint,
  cappedHint,
}: {
  form: CampaignFormState;
  setForm: Dispatch<SetStateAction<CampaignFormState>>;
  unlimitedHint: string;
  cappedHint: string;
}) {
  return (
    <div>
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-ink)]">
        <CalendarRange size={14} strokeWidth={2.25} aria-hidden />
        Quantas vezes
      </span>
      <label className="mt-1.5 flex cursor-pointer items-center justify-between gap-3 rounded-[12px] border border-[var(--color-hairline)] px-3 py-2.5">
        <span>
          <span className="block text-[13px] font-semibold text-[var(--color-ink)]">
            Sem limite
          </span>
          <span className="text-[12px] text-[var(--color-neutral-500)]">
            {unlimitedHint}
          </span>
        </span>
        <input
          type="checkbox"
          checked={form.unlimited}
          onChange={(e) =>
            setForm((f) => ({ ...f, unlimited: e.target.checked }))
          }
          className="h-5 w-5 accent-[var(--color-primary-500)]"
        />
      </label>
      {!form.unlimited ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block text-[13px] font-semibold text-[var(--color-ink)]">
            Limite
            <Stepper
              value={form.redeemMax}
              min={1}
              max={99}
              suffix={form.redeemMax === 1 ? 'vez' : 'vezes'}
              onChange={(n) => setForm((f) => ({ ...f, redeemMax: n }))}
            />
          </label>
          <label className="block text-[13px] font-semibold text-[var(--color-ink)]">
            Período
            <select
              value={form.redeemPeriod}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  redeemPeriod: e.target.value as PromoPeriod,
                }))
              }
              className={inputClass}
            >
              <option value="campaign">Nesta campanha</option>
              <option value="day">Por dia</option>
              <option value="week">Por semana</option>
              <option value="month">Por mês</option>
              <option value="year">Por ano</option>
            </select>
          </label>
        </div>
      ) : null}
      <p className="mt-1.5 text-[12px] font-normal text-[var(--color-neutral-500)]">
        {cappedHint}
      </p>
    </div>
  );
}

function RewardThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  return (
    <div className="relative h-16 w-16 overflow-hidden rounded-[12px] bg-[var(--color-neutral-200)]">
      {failed ? (
        <span className="absolute inset-0 flex items-center justify-center text-[var(--color-neutral-400)]">
          <ImageIcon size={18} strokeWidth={1.75} aria-hidden />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export function CampaignCreateForm({
  form,
  setForm,
  audiences,
  business,
  isEditing,
  busy,
  uploading,
  setUploading,
  setError,
  onSubmit,
}: {
  form: CampaignFormState;
  setForm: Dispatch<SetStateAction<CampaignFormState>>;
  audiences: AudienceOption[];
  business: {
    id?: string;
    name?: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
    primaryColorDark?: string | null;
    pointsPerReal?: number;
  } | null;
  isEditing: boolean;
  busy: boolean;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  setError: (v: string | null) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const selectedType =
    TYPES.find((t) => t.value === form.type) ?? TYPES[0]!;
  const selectedAudience = audiences.find(
    (a) => a.id === form.audienceSegmentId,
  );
  const primary = business?.primaryColor ?? 'var(--color-primary-500)';

  return (
    <form onSubmit={onSubmit} className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
            {isEditing ? 'Editar campanha' : 'Nova campanha'}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
            Três escolhas: o tipo, o prêmio, e para quem.
          </p>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Section
            Icon={selectedType.Icon}
            title="Tipo da campanha"
            hint={selectedType.hint}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {TYPES.map((opt) => {
                const selected = form.type === opt.value;
                const Icon = opt.Icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => applyType(f, opt.value))}
                    className="flex flex-col items-center gap-1.5 rounded-[14px] border border-[var(--color-hairline)] px-2 py-3 transition hover:border-[var(--color-neutral-400)]"
                    style={
                      selected
                        ? {
                            borderColor: opt.fill,
                            background: opt.bg,
                            boxShadow: `0 0 0 1px ${opt.fill}40`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white"
                      style={{
                        background: selected
                          ? opt.fill
                          : 'var(--color-neutral-200)',
                        color: selected
                          ? opt.onFill
                          : 'var(--color-neutral-500)',
                      }}
                      aria-hidden
                    >
                      <Icon size={18} strokeWidth={2.25} />
                    </span>
                    <span
                      className="text-center text-[11px] font-semibold leading-tight"
                      style={{
                        color: selected
                          ? opt.color
                          : 'var(--color-ink)',
                      }}
                    >
                      {opt.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            Icon={Gift}
            title="O prêmio"
            hint="O que a casa oferece de volta."
          >
            <label className="block text-[13px] font-semibold text-[var(--color-ink)]">
              O cliente ganha
              <input
                value={form.rewardTitle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rewardTitle: e.target.value }))
                }
                required={form.type === 'birthday' || form.type === 'promo'}
                className={inputClass}
                placeholder={
                  form.type === 'birthday'
                    ? 'Sobremesa grátis'
                    : form.type === 'cashback'
                      ? 'Volta em R$'
                      : form.type === 'promo'
                        ? '50% no panetone'
                        : 'Café grátis'
                }
              />
            </label>

            {form.type === 'stamps' ? (
              <>
                <label className="mt-3 block text-[13px] font-semibold text-[var(--color-ink)]">
                  Carimbos para ganhar
                  <Stepper
                    value={form.stampsNeeded}
                    min={2}
                    max={50}
                    suffix="carimbos"
                    onChange={(n) =>
                      setForm((f) => ({ ...f, stampsNeeded: n }))
                    }
                  />
                </label>
                <div className="mt-3">
                  <RedeemLimitFields
                    form={form}
                    setForm={setForm}
                    unlimitedHint="Pode resgatar cada vez que completar os carimbos."
                    cappedHint="Os carimbos continuam no saldo. O limite só segura o próximo resgate."
                  />
                </div>
              </>
            ) : form.type === 'spend' ? (
              <label className="mt-3 block text-[13px] font-semibold text-[var(--color-ink)]">
                Pontos para resgatar
                <Stepper
                  value={form.stampsNeeded}
                  min={10}
                  max={10000}
                  suffix="pontos"
                  onChange={(n) =>
                    setForm((f) => ({ ...f, stampsNeeded: n }))
                  }
                />
                <p className="mt-1.5 text-[12px] font-normal text-[var(--color-neutral-500)]">
                  A taxa de acúmulo fica em{' '}
                  <a
                    href="/settings"
                    className="font-semibold text-[var(--color-primary-500)]"
                  >
                    Configurações
                  </a>
                  .
                </p>
              </label>
            ) : form.type === 'cashback' ? (
              <label className="mt-3 block text-[13px] font-semibold text-[var(--color-ink)]">
                Quanto volta
                <Stepper
                  value={form.cashbackPercent}
                  min={1}
                  max={100}
                  suffix="%"
                  onChange={(n) =>
                    setForm((f) => ({ ...f, cashbackPercent: n }))
                  }
                />
              </label>
            ) : form.type === 'promo' ? (
              <PromoRules form={form} setForm={setForm} />
            ) : null}

            <label className="mt-3 block text-[13px] font-semibold text-[var(--color-ink)]">
              Nome no app
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                className={inputClass}
                placeholder={TYPE_DEFAULTS[form.type].name}
              />
            </label>
          </Section>

          <Section
            Icon={Users}
            title="Para quem"
            hint={
              selectedAudience
                ? `${selectedAudience.name} · ${selectedAudience.memberCount} cliente${selectedAudience.memberCount === 1 ? '' : 's'}`
                : 'Toda a casa, ou só uma audiência.'
            }
          >
            {selectedAudience ? (
              <div className="mb-3 flex items-center gap-2 rounded-[12px] bg-[var(--color-intel-bg)] px-3 py-2.5">
                <Users
                  size={16}
                  strokeWidth={2.25}
                  className="shrink-0 text-[var(--color-intel)]"
                  aria-hidden
                />
                <p className="min-w-0 text-[13px] font-semibold text-[var(--color-ink)]">
                  {selectedAudience.name}
                  <span className="ml-1.5 font-normal text-[var(--color-neutral-500)]">
                    {selectedAudience.memberCount} cliente
                    {selectedAudience.memberCount === 1 ? '' : 's'}
                  </span>
                </p>
              </div>
            ) : null}
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-[var(--color-ink)]">
                  Audiência
                </span>
                <Link
                  href="/audiences"
                  className="text-[12px] font-semibold text-[var(--color-primary-500)]"
                >
                  Gerenciar
                </Link>
              </div>
              <select
                value={form.audienceSegmentId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    audienceSegmentId: e.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="">Todos os clientes</option>
                {audiences.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.memberCount})
                  </option>
                ))}
              </select>
            </div>

            <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-[12px] border border-[var(--color-hairline)] px-3 py-2.5">
              <span>
                <span className="block text-[13px] font-semibold text-[var(--color-ink)]">
                  {isEditing ? 'Campanha ativa' : 'Ativar agora'}
                </span>
                <span className="text-[12px] text-[var(--color-neutral-500)]">
                  {isEditing
                    ? 'Clientes veem esta campanha no app.'
                    : 'Publica no app assim que criar.'}
                </span>
              </span>
              <input
                type="checkbox"
                checked={form.activate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, activate: e.target.checked }))
                }
                className="h-5 w-5 accent-[var(--color-primary-500)]"
              />
            </label>
          </Section>

          <Section
            Icon={Camera}
            title="Foto do prêmio"
            hint="Opcional — o cliente vê no cartão."
          >
            <div className="flex items-center gap-3">
              {form.rewardImageUrl ? (
                <RewardThumb src={form.rewardImageUrl} />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-[12px] border border-dashed border-[var(--color-neutral-200)] text-[var(--color-neutral-400)]">
                  <ImageIcon size={20} strokeWidth={1.75} aria-hidden />
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-card)] px-3 text-[13px] font-semibold">
                  {uploading ? 'Enviando…' : 'Escolher foto'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploading || !business?.id}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file || !business?.id) return;
                      setUploading(true);
                      setError(null);
                      try {
                        const url = await uploadCampaignRewardImage(
                          business.id,
                          file,
                        );
                        setForm((f) => ({ ...f, rewardImageUrl: url }));
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : 'Não foi possível enviar a foto.',
                        );
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                </label>
                {form.rewardImageUrl ? (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, rewardImageUrl: '' }))
                    }
                    className="text-left text-[12px] font-semibold text-[var(--color-neutral-500)]"
                  >
                    Remover
                  </button>
                ) : null}
              </div>
            </div>
          </Section>
        </div>

        <aside className="w-full min-w-0 lg:sticky lg:top-4">
          <div className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-4">
            <CampaignCardPreview
              businessName={business?.name ?? 'Sua loja'}
              businessLogoUrl={business?.logoUrl}
              primaryColor={primary}
              primaryColorDark={business?.primaryColorDark ?? primary}
              campaignName={form.name}
              campaignType={form.type}
              unitsNeeded={form.stampsNeeded}
              pointsPerReal={business?.pointsPerReal ?? form.pointsPerReal}
              cashbackPercent={
                form.type === 'cashback' ? form.cashbackPercent : 0
              }
              rewardTitle={form.rewardTitle}
              rewardDescription={form.rewardDescription}
              rewardImageUrl={form.rewardImageUrl || null}
              promoHint={
                form.type === 'promo'
                  ? form.unlimited
                    ? 'Sem limite · resgate na loja'
                    : `${promoFrequencyHint({
                        redeemMax: form.redeemMax,
                        redeemPeriod: form.redeemPeriod,
                      })} · resgate na loja`
                  : form.type === 'stamps' && !form.unlimited
                    ? promoFrequencyHint({
                        redeemMax: form.redeemMax,
                        redeemPeriod: form.redeemPeriod,
                      })
                    : undefined
              }
              startsOn={form.startsOn || null}
              endsOn={form.endsOn || null}
              weekdays={form.weekdays}
            />
          </div>
          <button
            type="submit"
            disabled={busy || uploading}
            className="mt-3 min-h-11 w-full rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[15px] font-semibold text-white shadow-[var(--shadow-cta)] disabled:bg-[var(--color-primary-200)] disabled:shadow-none"
          >
            {busy
              ? 'Salvando…'
              : isEditing
                ? 'Salvar alterações'
                : 'Criar campanha'}
          </button>
        </aside>
      </div>
    </form>
  );
}
