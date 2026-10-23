'use client';

import { FormEvent, useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import {
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_TYPE_LABEL,
} from '@/lib/labels';

export type AdminCampaign = {
  id: string;
  name: string;
  type: string;
  status: string;
  stampsNeeded: number | null;
  pointsPerReal: number | null;
  cashbackPercent: number | null;
  rewardTitle: string | null;
  rewardDescription: string | null;
  rewardImageUrl: string | null;
  cartela: boolean;
  activatedAt: string | null;
  startsOn: string | null;
  endsOn: string | null;
  weekdays: number[];
  redeemMax: number | null;
  redeemPeriod: string | null;
  birthdayWindow?: 'days' | 'month' | null;
  birthdayWindowDays?: number | null;
  audienceSegmentId: string | null;
  audienceName: string | null;
  earns30d: number;
  redeems30d: number;
};

type AudienceOption = { id: string; name: string };

const KNOWN_TYPES = ['stamps', 'spend', 'birthday', 'cashback', 'promo'] as const;
type KnownType = (typeof KNOWN_TYPES)[number];

const STATUSES = ['draft', 'active', 'paused', 'archived'] as const;

const WEEKDAYS = [
  { day: 0, label: 'Dom' },
  { day: 1, label: 'Seg' },
  { day: 2, label: 'Ter' },
  { day: 3, label: 'Qua' },
  { day: 4, label: 'Qui' },
  { day: 5, label: 'Sex' },
  { day: 6, label: 'Sáb' },
];

const PERIODS: { value: string; label: string }[] = [
  { value: 'campaign', label: 'Nesta campanha' },
  { value: 'day', label: 'Por dia' },
  { value: 'week', label: 'Por semana' },
  { value: 'month', label: 'Por mês' },
  { value: 'year', label: 'Por ano' },
];

const inputClass =
  'mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[16px] font-normal normal-case tracking-normal text-[var(--color-ink)]';

function isKnownType(type: string): type is KnownType {
  return (KNOWN_TYPES as readonly string[]).includes(type);
}

function campaignError(error: string | undefined, message?: string) {
  if (message && error !== 'NOT_FOUND') return message;
  if (error === 'POINTS_PER_REAL_REQUIRED') {
    return 'Informe quantos reais valem 1 ponto.';
  }
  if (error === 'CASHBACK_PERCENT_REQUIRED') {
    return 'Informe a porcentagem de cashback (1 a 100).';
  }
  if (error === 'REWARD_TITLE_REQUIRED') return 'Informe o prêmio.';
  if (error === 'INVALID_PROMO_DATES') {
    return 'A data de início não pode ser depois da data de fim.';
  }
  if (error === 'REDEEM_PERIOD_REQUIRED') {
    return 'Escolha o período do limite de resgates.';
  }
  if (error === 'INVALID_AUDIENCE') return 'Audiência inválida.';
  if (error === 'BIRTHDAY_CAMPAIGN_EXISTS') {
    return 'Já existe um presente de aniversário ativo. Pause o atual antes de ativar outro.';
  }
  if (error === 'CARTELA_LOCKED') {
    return 'A cartela não muda depois que a campanha foi ativada.';
  }
  if (error === 'CARTELA_STAMPS_ONLY') {
    return 'Cartela é só para campanha de carimbos.';
  }
  if (error === 'NOT_FOUND') return 'Campanha não encontrada.';
  return error ?? 'Não foi possível salvar.';
}

export function CampaignEditor({
  businessId,
  campaign,
  audiences,
  getToken,
  onClose,
  onSaved,
}: {
  businessId: string;
  campaign: AdminCampaign;
  audiences: AudienceOption[];
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(campaign.name);
  const [type, setType] = useState(campaign.type);
  const [status, setStatus] = useState(campaign.status);
  const [stampsNeeded, setStampsNeeded] = useState(campaign.stampsNeeded ?? 10);
  const [pointsPerReal, setPointsPerReal] = useState(campaign.pointsPerReal ?? 1);
  const [cashbackPercent, setCashbackPercent] = useState(
    campaign.cashbackPercent ?? 5,
  );
  const [rewardTitle, setRewardTitle] = useState(campaign.rewardTitle ?? '');
  const [rewardDescription, setRewardDescription] = useState(
    campaign.rewardDescription ?? '',
  );
  const [rewardImageUrl, setRewardImageUrl] = useState(
    campaign.rewardImageUrl ?? '',
  );
  const [audienceSegmentId, setAudienceSegmentId] = useState(
    campaign.audienceSegmentId ?? '',
  );
  const [startsOn, setStartsOn] = useState(campaign.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(campaign.endsOn ?? '');
  const [weekdays, setWeekdays] = useState<number[]>(
    campaign.weekdays.length === 7 ? [] : campaign.weekdays,
  );
  const [unlimited, setUnlimited] = useState(campaign.redeemMax == null);
  const [redeemMax, setRedeemMax] = useState(campaign.redeemMax ?? 1);
  const [redeemPeriod, setRedeemPeriod] = useState(
    campaign.redeemPeriod ?? (campaign.type === 'promo' ? 'campaign' : 'day'),
  );
  const [cartela, setCartela] = useState(campaign.cartela);
  const [birthdayWindow, setBirthdayWindow] = useState<'days' | 'month'>(
    campaign.birthdayWindow === 'month' ? 'month' : 'days',
  );
  const [birthdayWindowDays, setBirthdayWindowDays] = useState(
    campaign.birthdayWindowDays ?? 7,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const known = isKnownType(type);
  const cartelaLocked = Boolean(campaign.activatedAt);

  useEffect(() => {
    document
      .getElementById('campaign-editor')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const image = rewardImageUrl.trim();
    if (image) {
      try {
        const parsed = new URL(image);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('bad protocol');
        }
      } catch {
        setError('URL da foto do prêmio inválida.');
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const quota = unlimited
        ? { redeemMax: null, redeemPeriod: null }
        : { redeemMax, redeemPeriod };
      const body: Record<string, unknown> = {
        name: name.trim(),
        status,
        rewardTitle: rewardTitle.trim() || undefined,
        rewardDescription: rewardDescription.trim() || null,
        rewardImageUrl: rewardImageUrl.trim() || null,
        audienceSegmentId: audienceSegmentId || null,
      };
      if (known) body.type = type;
      if (type === 'birthday' || type === 'cashback' || type === 'promo') {
        body.stampsNeeded = 1;
      } else if (type === 'stamps' || type === 'spend') {
        body.stampsNeeded = stampsNeeded;
      }
      if (type === 'spend') body.pointsPerReal = pointsPerReal;
      if (type === 'cashback') body.cashbackPercent = cashbackPercent;
      Object.assign(body, {
        startsOn: startsOn || null,
        endsOn: endsOn || null,
      });
      if (type === 'promo') {
        Object.assign(body, {
          weekdays,
          ...quota,
        });
      } else if (type === 'stamps') {
        Object.assign(body, {
          weekdays: [],
          ...quota,
          cartela,
        });
      } else if (type === 'birthday') {
        Object.assign(body, {
          weekdays: [],
          redeemMax: null,
          redeemPeriod: null,
          birthdayWindow,
          birthdayWindowDays,
        });
      } else if (known) {
        Object.assign(body, {
          weekdays: [],
          redeemMax: null,
          redeemPeriod: null,
        });
      }

      const res = await fetch(
        `${API_URL}/admin/businesses/${businessId}/campaigns/${campaign.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(campaignError(json.error, json.message));
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  const typeOptions = isKnownType(campaign.type)
    ? [...KNOWN_TYPES]
    : [campaign.type, ...KNOWN_TYPES];

  return (
    <form
      id="campaign-editor"
      onSubmit={onSubmit}
      className="mb-4 scroll-mt-6 rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
            Campanha
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
            {campaign.earns30d} acúmulos · {campaign.redeems30d} resgates · 30
            dias
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 rounded-[8px] px-3 text-[13px] font-semibold text-[var(--color-neutral-500)]"
        >
          Fechar
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-[13px] font-semibold uppercase tracking-[0.04em] sm:col-span-2">
          Nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
            maxLength={80}
          />
        </label>
        <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
          Tipo
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          >
            {typeOptions.map((value) => (
              <option key={value} value={value}>
                {CAMPAIGN_TYPE_LABEL[value] ?? value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {CAMPAIGN_STATUS_LABEL[value]}
              </option>
            ))}
            {!STATUSES.includes(status as (typeof STATUSES)[number]) && (
              <option value={status}>{status}</option>
            )}
          </select>
        </label>
        <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
          Prêmio
          <input
            value={rewardTitle}
            onChange={(e) => setRewardTitle(e.target.value)}
            className={inputClass}
            maxLength={80}
          />
        </label>
        <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
          Audiência
          <select
            value={audienceSegmentId}
            onChange={(e) => setAudienceSegmentId(e.target.value)}
            className={inputClass}
          >
            <option value="">Todo o estabelecimento</option>
            {audiences.map((audience) => (
              <option key={audience.id} value={audience.id}>
                {audience.name}
              </option>
            ))}
            {audienceSegmentId &&
              !audiences.some((audience) => audience.id === audienceSegmentId) && (
                <option value={audienceSegmentId}>
                  {campaign.audienceName ?? 'Audiência'}
                </option>
              )}
          </select>
        </label>
        <label className="text-[13px] font-semibold uppercase tracking-[0.04em] sm:col-span-2">
          Descrição do prêmio
          <input
            value={rewardDescription}
            onChange={(e) => setRewardDescription(e.target.value)}
            className={inputClass}
            maxLength={200}
          />
        </label>
        <label className="text-[13px] font-semibold uppercase tracking-[0.04em] sm:col-span-2">
          Foto do prêmio (URL)
          <input
            value={rewardImageUrl}
            onChange={(e) => setRewardImageUrl(e.target.value)}
            className={inputClass}
            placeholder="https://…"
          />
        </label>
      </div>

      {rewardImageUrl.trim() && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={rewardImageUrl.trim()}
          alt="Prêmio"
          className="mt-4 h-36 w-full rounded-[12px] object-cover"
        />
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
          Início
          <input
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
          Fim
          <input
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            className={inputClass}
          />
        </label>
        <p className="text-[12px] font-normal normal-case tracking-normal text-[var(--color-neutral-400)] sm:col-span-2">
          Vazio = sem data. A campanha segue até ser pausada ou arquivada. Dias
          em Brasília.
        </p>
      </div>

      {type === 'stamps' && (
        <div className="mt-4 flex flex-col gap-4">
          <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
            Carimbos para o prêmio
            <input
              type="number"
              min={1}
              max={10000}
              value={stampsNeeded}
              onChange={(e) =>
                setStampsNeeded(Math.max(1, Number(e.target.value) || 1))
              }
              className={inputClass}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[14px] font-semibold">
            <input
              type="checkbox"
              checked={cartela}
              disabled={cartelaLocked}
              onChange={(e) => setCartela(e.target.checked)}
              className="h-4 w-4"
            />
            Cartela própria
          </label>
          {cartelaLocked && (
            <p className="text-[12px] font-normal text-[var(--color-neutral-400)]">
              A cartela não muda depois que a campanha foi ativada.
            </p>
          )}
          <RedeemLimit
            unlimited={unlimited}
            redeemMax={redeemMax}
            redeemPeriod={redeemPeriod}
            onUnlimited={setUnlimited}
            onMax={setRedeemMax}
            onPeriod={setRedeemPeriod}
            hint="Pode resgatar cada vez que completar os carimbos."
          />
        </div>
      )}

      {type === 'spend' && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
            Pontos para o prêmio
            <input
              type="number"
              min={1}
              max={10000}
              value={stampsNeeded}
              onChange={(e) =>
                setStampsNeeded(Math.max(1, Number(e.target.value) || 1))
              }
              className={inputClass}
            />
          </label>
          <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
            R$ para 1 ponto
            <input
              type="number"
              min={1}
              max={1000}
              value={pointsPerReal}
              onChange={(e) =>
                setPointsPerReal(Math.max(1, Number(e.target.value) || 1))
              }
              className={inputClass}
            />
            <span className="mt-1 block text-[12px] font-normal normal-case tracking-normal text-[var(--color-neutral-400)]">
              O balcão usa a taxa da configuração do estabelecimento.
            </span>
          </label>
        </div>
      )}

      {type === 'birthday' && (
        <div className="mt-4 flex flex-col gap-3">
          <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
            Quando libera
            <select
              value={birthdayWindow}
              onChange={(e) =>
                setBirthdayWindow(e.target.value === 'month' ? 'month' : 'days')
              }
              className={inputClass}
            >
              <option value="days">Dias a partir do aniversário</option>
              <option value="month">Mês do aniversário</option>
            </select>
          </label>
          {birthdayWindow === 'days' ? (
            <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
              Dias
              <input
                type="number"
                min={1}
                max={90}
                value={birthdayWindowDays}
                onChange={(e) =>
                  setBirthdayWindowDays(
                    Math.max(1, Math.min(90, Number(e.target.value) || 1)),
                  )
                }
                className={inputClass}
              />
              <span className="mt-1 block text-[12px] font-normal normal-case tracking-normal text-[var(--color-neutral-400)]">
                O dia do aniversário entra na conta. 15 dias = o dia e os 14
                seguintes.
              </span>
            </label>
          ) : (
            <p className="text-[12px] font-normal normal-case tracking-normal text-[var(--color-neutral-400)]">
              Do dia 1 ao último dia do mês da data que o cliente cadastrou.
            </p>
          )}
        </div>
      )}

      {type === 'cashback' && (
        <label className="mt-4 block text-[13px] font-semibold uppercase tracking-[0.04em]">
          Cashback (%)
          <input
            type="number"
            min={0}
            max={100}
            value={cashbackPercent}
            onChange={(e) =>
              setCashbackPercent(
                Math.max(0, Math.min(100, Number(e.target.value) || 0)),
              )
            }
            className={inputClass}
          />
        </label>
      )}

      {type === 'promo' && (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.04em]">
              Dias
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((item) => {
                const selected = weekdays.includes(item.day);
                return (
                  <button
                    key={item.day}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleWeekday(item.day)}
                    className={`min-h-9 rounded-[8px] px-3 text-[13px] font-semibold ${
                      selected
                        ? 'bg-[var(--color-primary-500)] text-white'
                        : 'border border-[var(--color-hairline)] text-[var(--color-neutral-700)]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[12px] font-normal normal-case tracking-normal text-[var(--color-neutral-400)]">
              Nenhum dia marcado vale a semana inteira.
            </p>
          </div>
          <RedeemLimit
            unlimited={unlimited}
            redeemMax={redeemMax}
            redeemPeriod={redeemPeriod}
            onUnlimited={setUnlimited}
            onMax={setRedeemMax}
            onPeriod={setRedeemPeriod}
            hint="Sem limite de resgates no período."
          />
        </div>
      )}

      {error && (
        <p className="mt-4 text-[13px] text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Salvando…' : 'Salvar campanha'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-[12px] border border-[var(--color-hairline)] px-4 text-[15px] font-semibold"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function RedeemLimit({
  unlimited,
  redeemMax,
  redeemPeriod,
  onUnlimited,
  onMax,
  onPeriod,
  hint,
}: {
  unlimited: boolean;
  redeemMax: number;
  redeemPeriod: string;
  onUnlimited: (value: boolean) => void;
  onMax: (value: number) => void;
  onPeriod: (value: string) => void;
  hint: string;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-2 text-[14px] font-semibold">
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(e) => onUnlimited(e.target.checked)}
          className="h-4 w-4"
        />
        Sem limite
      </label>
      <p className="mt-1 text-[12px] font-normal text-[var(--color-neutral-400)]">
        {hint}
      </p>
      {!unlimited && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
            Limite
            <input
              type="number"
              min={1}
              max={999}
              value={redeemMax}
              onChange={(e) => onMax(Math.max(1, Number(e.target.value) || 1))}
              className={inputClass}
            />
          </label>
          <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
            Período
            <select
              value={redeemPeriod}
              onChange={(e) => onPeriod(e.target.value)}
              className={inputClass}
            >
              {PERIODS.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
