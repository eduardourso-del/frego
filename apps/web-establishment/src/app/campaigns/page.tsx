'use client';

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Stamp, Coins, Cake, ImageIcon, Banknote } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { CampaignCardPreview } from '@/components/campaign-card-preview';
import { useBusiness } from '@/lib/business-context';
import { API_URL } from '@/lib/api';
import { uploadCampaignRewardImage } from '@/lib/firebase';

type CampaignType = 'stamps' | 'spend' | 'birthday' | 'cashback';
type CampaignStatus = 'draft' | 'active' | 'paused' | 'archived';
type StatusFilter = 'all' | 'active' | 'inactive';

type Campaign = {
  id: string;
  name: string;
  type: CampaignType | string;
  status: CampaignStatus | string;
  stampsNeeded: number | null;
  pointsPerReal: number | null;
  cashbackPercent?: number | null;
  rewardTitle: string | null;
  rewardDescription: string | null;
  rewardImageUrl: string | null;
  audienceSegmentId?: string | null;
  audienceSegment?: { id: string; name: string; memberCount?: number | null } | null;
  audienceMemberCount?: number | null;
};

type AudienceOption = {
  id: string;
  name: string;
  memberCount: number;
};

type CampaignPerformance = {
  eligible: number;
  redeemers: number;
  redeems: number;
  fulfillPct: number;
  engagePct: number;
  revenueFromRedeemersCents: number;
  cashbackSpentCents?: number;
  cashbackEarnedCents?: number;
  series: Array<{ date: string; redeems: number }>;
};

const emptyForm = {
  name: '',
  type: 'stamps' as CampaignType,
  stampsNeeded: 10,
  pointsPerReal: 1,
  cashbackPercent: 5,
  rewardTitle: '',
  rewardDescription: '',
  rewardImageUrl: '',
  activate: true,
  audienceSegmentId: '' as string,
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  paused: 'Pausada',
  archived: 'Arquivada',
};

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'active', label: 'Ativas' },
  { key: 'inactive', label: 'Inativas' },
];

function parseStatusFilter(raw: string | null): StatusFilter {
  if (raw === 'active' || raw === 'inactive' || raw === 'all') return raw;
  return 'all';
}

function matchesFilter(c: Campaign, filter: StatusFilter) {
  if (filter === 'all') return true;
  if (filter === 'active') return c.status === 'active';
  return c.status !== 'active';
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function CampaignsPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Campanhas">
          <div className="px-4 py-5 md:px-7 md:py-6">
            <p className="text-[15px] text-[var(--color-neutral-500)]">
              Carregando…
            </p>
          </div>
        </AppShell>
      }
    >
      <CampaignsPageContent />
    </Suspense>
  );
}

function CampaignsPageContent() {
  const { authHeaders, business } = useBusiness();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = parseStatusFilter(searchParams.get('status'));
  const highlightId = searchParams.get('highlight');
  const urlAudienceId = searchParams.get('audienceId');
  const urlAudienceName = searchParams.get('audienceName');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [audiences, setAudiences] = useState<AudienceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [perfById, setPerfById] = useState<Record<string, CampaignPerformance>>(
    {},
  );
  const [perfOpenId, setPerfOpenId] = useState<string | null>(null);
  const audienceBootstrapKey = `${urlAudienceId ?? ''}|${searchParams.get('fromAudience') ?? ''}|${urlAudienceName ?? ''}`;
  const audienceBootstrapped = useRef<string | null>(null);

  const filteredCampaigns = useMemo(
    () => campaigns.filter((c) => matchesFilter(c, statusFilter)),
    [campaigns, statusFilter],
  );

  const filterCounts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const c of campaigns) {
      if (c.status === 'active') active += 1;
      else inactive += 1;
    }
    return { all: campaigns.length, active, inactive };
  }, [campaigns]);

  function setStatusFilter(next: StatusFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    const qs = params.toString();
    router.replace(qs ? `/campaigns?${qs}` : '/campaigns', { scroll: false });
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const [campRes, audRes] = await Promise.all([
        fetch(`${API_URL}/campaigns`, { headers }),
        fetch(`${API_URL}/audiences`, { headers }),
      ]);
      const campJson = await campRes.json().catch(() => ({}));
      const audJson = await audRes.json().catch(() => ({}));
      if (!campRes.ok) {
        throw new Error(
          (campJson as { error?: string }).error ??
            `Não foi possível listar as campanhas (${campRes.status})`,
        );
      }
      setCampaigns(campJson.campaigns ?? []);
      setAudiences(
        (audJson.audiences ?? []).map(
          (a: { id: string; name: string; memberCount: number }) => ({
            id: a.id,
            name: a.name,
            memberCount: a.memberCount,
          }),
        ),
      );

      const active = (campJson.campaigns ?? []).filter(
        (c: Campaign) => c.status === 'active',
      ) as Campaign[];
      const perfEntries = await Promise.all(
        active.slice(0, 8).map(async (c) => {
          try {
            const res = await fetch(
              `${API_URL}/campaigns/${c.id}/performance?range=30d`,
              { headers },
            );
            const json = await res.json();
            if (!res.ok) return null;
            return [c.id, json.performance as CampaignPerformance] as const;
          } catch {
            return null;
          }
        }),
      );
      const next: Record<string, CampaignPerformance> = {};
      for (const entry of perfEntries) {
        if (entry) next[entry[0]] = entry[1];
      }
      setPerfById(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro';
      setError(
        msg === 'Failed to fetch' ||
          msg === 'Load failed' ||
          msg ===
            'NetworkError when attempting to fetch resource.'
          ? 'Não foi possível conectar ao servidor. Verifique se o serviço está no ar.'
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  // Open create form when arriving from Relatórios/Clientes with audience params
  useEffect(() => {
    const fromAudience = searchParams.get('fromAudience');
    if (!urlAudienceId && !fromAudience) return;
    if (audienceBootstrapped.current === audienceBootstrapKey) return;
    audienceBootstrapped.current = audienceBootstrapKey;

    let cancelled = false;

    async function bootstrap() {
      let segmentId = urlAudienceId ?? '';
      if (!segmentId && fromAudience) {
        try {
          const headers = {
            ...(await authHeaders()),
            'Content-Type': 'application/json',
          };
          const rules: Record<string, unknown> = { version: 1 };
          for (const key of [
            'spendCentsMin',
            'spendCentsMax',
            'windowDays',
            'inactiveDaysMin',
            'visitsMin',
            'visitsMax',
            'nearReward',
            'isVip',
          ]) {
            const v = searchParams.get(key);
            if (v == null || v === '') continue;
            if (key === 'nearReward' || key === 'isVip') {
              rules[key] = v === 'true' || v === '1';
            } else {
              rules[key] = Number.parseInt(v, 10);
            }
          }
          const name =
            urlAudienceName?.trim() ||
            `Audiência ${new Date().toLocaleDateString('pt-BR')}`;
          const res = await fetch(`${API_URL}/audiences`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              name,
              rules,
              showBadge: true,
              badgeTitle: (() => {
                const n = (urlAudienceName ?? '').trim().toLowerCase();
                if (n === 'alto valor') return 'Cliente da casa';
                if (n === 'em risco') return 'De volta à casa';
                if (n === 'quase prêmio' || n === 'quase premio') return 'Quase lá';
                if (n === 'vip') return 'VIP da casa';
                if (urlAudienceName?.trim()) {
                  // Prefer friendly title over raw ops segment name
                  const ops = ['alto valor', 'em risco', 'quase prêmio', 'quase premio', 'vip'];
                  if (ops.includes(n)) return 'Cliente da casa';
                  return urlAudienceName.trim();
                }
                return typeof rules.spendCentsMin === 'number'
                  ? 'Cliente da casa'
                  : name;
              })(),
              badgeMessage:
                'A loja reconhece você — desbloqueamos condições especiais para quem volta e faz parte da casa.',
            }),
          });
          const json = await res.json();
          if (res.ok && json.audience?.id) {
            segmentId = json.audience.id as string;
            setAudiences((prev) => {
              if (prev.some((a) => a.id === segmentId)) return prev;
              return [
                {
                  id: segmentId,
                  name: json.audience.name as string,
                  memberCount: json.audience.memberCount as number,
                },
                ...prev,
              ];
            });
          }
        } catch {
          // fall through — form still opens without audience
        }
      }
      if (cancelled) return;
      setEditingId(null);
      setForm({
        ...emptyForm,
        audienceSegmentId: segmentId,
        name: urlAudienceName
          ? `Campanha · ${urlAudienceName}`
          : emptyForm.name,
        rewardTitle: urlAudienceName
          ? `Prêmio para ${urlAudienceName}`
          : emptyForm.rewardTitle,
      });
      setShowForm(true);
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [
    audienceBootstrapKey,
    urlAudienceId,
    urlAudienceName,
    searchParams,
    authHeaders,
  ]);

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEdit(c: Campaign) {
    setEditingId(c.id);
    const type: CampaignType =
      c.type === 'spend'
        ? 'spend'
        : c.type === 'birthday'
          ? 'birthday'
          : c.type === 'cashback'
            ? 'cashback'
            : 'stamps';
    setForm({
      name: c.name,
      type,
      stampsNeeded:
        c.stampsNeeded ??
        (type === 'spend' ? 100 : type === 'birthday' ? 1 : 10),
      pointsPerReal: c.pointsPerReal ?? 1,
      cashbackPercent: c.cashbackPercent ?? 5,
      rewardTitle: c.rewardTitle ?? '',
      rewardDescription: c.rewardDescription ?? '',
      rewardImageUrl: c.rewardImageUrl ?? '',
      activate: c.status === 'active',
      audienceSegmentId:
        c.audienceSegmentId ?? c.audienceSegment?.id ?? '',
    });
    setShowForm(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const headers = {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      };

      let status: CampaignStatus | undefined;
      if (editingId) {
        const current = campaigns.find((c) => c.id === editingId);
        if (form.activate) {
          status = 'active';
        } else if (current?.status === 'active') {
          status = 'paused';
        } else if (current?.status === 'archived') {
          status = 'draft';
        }
      } else {
        status = form.activate ? 'active' : 'draft';
      }

      const body = {
        name: form.name,
        type: form.type,
        stampsNeeded:
          form.type === 'birthday' || form.type === 'cashback'
            ? 1
            : form.stampsNeeded,
        pointsPerReal:
          form.type === 'spend'
            ? (business?.pointsPerReal ?? form.pointsPerReal)
            : undefined,
        cashbackPercent:
          form.type === 'cashback' ? form.cashbackPercent : undefined,
        rewardTitle: form.rewardTitle || undefined,
        rewardDescription: form.rewardDescription || undefined,
        rewardImageUrl: form.rewardImageUrl || null,
        audienceSegmentId: form.audienceSegmentId || null,
        ...(status ? { status } : {}),
      };

      const res = await fetch(
        editingId ? `${API_URL}/campaigns/${editingId}` : `${API_URL}/campaigns`,
        {
          method: editingId ? 'PATCH' : 'POST',
          headers,
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        if (json.error === 'CASHBACK_PERCENT_REQUIRED') {
          throw new Error('Informe a porcentagem de cashback (1 a 100).');
        }
        if (json.error === 'BIRTHDAY_CAMPAIGN_EXISTS') {
          throw new Error(
            'Já existe um presente de aniversário ativo. Pause o atual antes de ativar outro.',
          );
        }
        if (json.error === 'REWARD_TITLE_REQUIRED') {
          throw new Error('Informe o prêmio do aniversário.');
        }
        throw new Error(
          json.error ?? (editingId ? 'Não foi possível salvar.' : 'Não foi possível criar.'),
        );
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: CampaignStatus) {
    setBusy(true);
    setError(null);
    try {
      const headers = {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      };
      const res = await fetch(`${API_URL}/campaigns/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Não foi possível atualizar.');
      if (editingId === id) closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  const primary = business?.primaryColor ?? 'var(--color-primary-500)';
  const isEditing = Boolean(editingId);

  return (
    <AppShell title="Campanhas">
      <div className="px-4 py-5 md:px-7 md:py-6">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-[var(--color-ink)] md:text-[28px]">
              Campanhas
            </h1>
            <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-[var(--color-neutral-500)] md:text-[15px]">
              Crie campanhas de carimbos, pontos, cashback ou um presente de
              aniversário. O cliente vê e resgata no aplicativo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => (showForm ? closeForm() : openCreate())}
            className="min-h-11 w-full rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[15px] font-semibold text-white shadow-[var(--shadow-cta)] transition-[transform,background] enabled:active:scale-[0.98] sm:w-auto"
          >
            {showForm ? 'Cancelar' : 'Nova campanha'}
          </button>
        </header>

        {error && (
          <p className="mb-4 text-[13px] text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        )}

        <div
          className="mb-5 flex gap-1 overflow-x-auto rounded-[14px] bg-[var(--color-neutral-100)] p-1"
          role="tablist"
          aria-label="Filtrar campanhas"
        >
          {FILTERS.map((f) => {
            const selected = statusFilter === f.key;
            const count = filterCounts[f.key];
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setStatusFilter(f.key)}
                className={`min-h-9 shrink-0 rounded-[11px] px-3.5 text-[13px] font-semibold transition-all ${
                  selected
                    ? 'bg-[var(--color-card)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(16,24,40,0.08)]'
                    : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)]'
                }`}
              >
                {f.label}
                {!loading && (
                  <span className="ml-1.5 font-medium text-[var(--color-neutral-400)]">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {showForm && (
          <form
            onSubmit={onSave}
            className="mb-8 rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]"
          >
            <h2 className="text-[17px] font-semibold">
              {isEditing ? 'Editar campanha' : 'Nova campanha'}
            </h2>

            <fieldset className="mt-4">
              <legend className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                Como fidelizar
              </legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      value: 'stamps' as const,
                      title: 'Carimbos',
                      desc: 'Ideal para café e visitas repetidas. Cada visita vale 1 carimbo.',
                      Icon: Stamp,
                      selectedClass:
                        'border-[var(--color-stamps)] bg-[var(--color-stamps-bg)] ring-1 ring-[var(--color-stamps)]/25',
                      iconWrap: 'bg-[var(--color-stamps)] text-white',
                      titleClass: 'text-[var(--color-stamps)]',
                    },
                    {
                      value: 'spend' as const,
                      title: 'Pontos por gasto',
                      desc: 'O cliente acumula pontos pela compra (taxa da loja) e escolhe este prêmio no aplicativo.',
                      Icon: Coins,
                      selectedClass:
                        'border-[var(--color-points)] bg-[var(--color-points-bg)] ring-1 ring-[var(--color-points)]/25',
                      iconWrap: 'bg-[var(--color-points)] text-white',
                      titleClass: 'text-[var(--color-points)]',
                    },
                    {
                      value: 'birthday' as const,
                      title: 'Aniversário',
                      desc: 'Presente opcional no aniversário do cliente — uma vez por ano.',
                      Icon: Cake,
                      selectedClass:
                        'border-[var(--color-primary-500)] bg-[var(--color-primary-50)] ring-1 ring-[var(--color-primary-500)]/25',
                      iconWrap: 'bg-[var(--color-primary-500)] text-white',
                      titleClass: 'text-[var(--color-primary-600)]',
                    },
                    {
                      value: 'cashback' as const,
                      title: 'Cashback',
                      desc: 'Um percentual da compra volta em reais para a próxima visita. A taxa fica nesta campanha.',
                      Icon: Banknote,
                      selectedClass:
                        'border-[var(--color-cashback)] bg-[var(--color-cashback-bg)] ring-1 ring-[var(--color-cashback)]/25',
                      iconWrap: 'bg-[var(--color-cashback)] text-white',
                      titleClass: 'text-[var(--color-cashback)]',
                    },
                  ] as const
                ).map((opt) => {
                  const selected = form.type === opt.value;
                  const Icon = opt.Icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          type: opt.value,
                          stampsNeeded:
                            opt.value === 'spend'
                              ? 100
                              : opt.value === 'birthday' ||
                                  opt.value === 'cashback'
                                ? 1
                                : 10,
                          name:
                            f.name ||
                            (opt.value === 'spend'
                              ? 'Pontos por compra'
                              : opt.value === 'birthday'
                                ? 'Presente de aniversário'
                                : opt.value === 'cashback'
                                  ? 'Cashback'
                                  : 'Carimbo fidelidade'),
                          rewardTitle:
                            f.rewardTitle ||
                            (opt.value === 'spend'
                              ? 'Prêmio da casa'
                              : opt.value === 'birthday'
                                ? 'Sobremesa grátis'
                                : opt.value === 'cashback'
                                  ? 'Volta em R$'
                                  : 'Item grátis'),
                        }))
                      }
                      className={`rounded-[14px] border p-4 text-left transition ${
                        selected
                          ? opt.selectedClass
                          : 'border-[var(--color-hairline)] hover:border-[var(--color-neutral-300)]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${
                            selected
                              ? opt.iconWrap
                              : 'bg-[var(--color-bg)] text-[var(--color-neutral-500)]'
                          }`}
                          aria-hidden
                        >
                          <Icon size={20} strokeWidth={2.25} />
                        </span>
                        <div className="min-w-0">
                          <div
                            className={`text-[15px] font-semibold ${
                              selected
                                ? opt.titleClass
                                : 'text-[var(--color-ink)]'
                            }`}
                          >
                            {opt.title}
                          </div>
                          <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
                            {opt.desc}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-[13px] font-semibold">
                Nome
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  required
                  className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-3 text-[15px]"
                />
              </label>
              <label className="text-[13px] font-semibold">
                Recompensa
                {form.type === 'birthday' ? (
                  <span className="ml-1 font-normal text-[var(--color-neutral-400)]">
                    · obrigatório
                  </span>
                ) : null}
                <input
                  value={form.rewardTitle}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rewardTitle: e.target.value }))
                  }
                  required={form.type === 'birthday'}
                  className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-3 text-[15px]"
                  placeholder={
                    form.type === 'birthday'
                      ? 'Sobremesa grátis'
                      : 'Café grátis'
                  }
                />
              </label>
            </div>

            {form.type === 'birthday' ? (
              <div className="mt-3 rounded-[14px] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-4 py-3 text-[13px] leading-relaxed text-[var(--color-primary-800)]">
                O cliente vê este presente na loja. Pode resgatar no dia do
                aniversário e nos 6 dias seguintes, uma vez por ano. Quem não
                informou a data no perfil vê o prêmio bloqueado.
              </div>
            ) : form.type === 'cashback' ? (
              <div className="mt-3 space-y-3">
                <label className="text-[13px] font-semibold">
                  Porcentagem de volta
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.cashbackPercent}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        cashbackPercent: Math.max(
                          1,
                          Math.min(100, Number(e.target.value) || 1),
                        ),
                      }))
                    }
                    className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-3 text-[15px]"
                  />
                </label>
                <div className="rounded-[14px] border border-[var(--color-cashback-ring)] bg-[var(--color-cashback-bg)] px-4 py-3 text-[13px] leading-relaxed text-[var(--color-cashback)]">
                  Pode haver várias campanhas ativas, cada uma com a própria
                  porcentagem e audiência. Se o cliente entrar em mais de uma,
                  vale a maior taxa. O saldo é único da loja e é usado no caixa
                  — não gera voucher no aplicativo.
                </div>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {form.type === 'stamps' ? (
                  <label className="text-[13px] font-semibold">
                    Carimbos para ganhar
                    <input
                      type="number"
                      min={2}
                      max={50}
                      value={form.stampsNeeded}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          stampsNeeded: Number(e.target.value),
                        }))
                      }
                      className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-3 text-[15px]"
                    />
                  </label>
                ) : (
                  <>
                    <div className="rounded-[14px] border border-[var(--color-points-ring)] bg-[var(--color-points-bg)] px-3 py-3 text-[13px] text-[var(--color-points)]">
                      A taxa de acúmulo (quantos reais geram 1 ponto) é a da
                      loja, em{' '}
                      <a
                        href="/settings"
                        className="font-semibold underline"
                      >
                        Configurações
                      </a>
                      . Aqui você define só a meta e o prêmio.
                    </div>
                    <label className="text-[13px] font-semibold">
                      Pontos para resgatar
                      <input
                        type="number"
                        min={10}
                        max={10000}
                        value={form.stampsNeeded}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            stampsNeeded: Number(e.target.value),
                          }))
                        }
                        className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-3 text-[15px]"
                      />
                    </label>
                  </>
                )}
              </div>
            )}

            <label className="mt-3 block text-[13px] font-semibold">
              Descrição (opcional)
              <input
                value={form.rewardDescription}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rewardDescription: e.target.value }))
                }
                className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-3 text-[15px]"
              />
            </label>

            <div className="mt-4">
              <p className="text-[13px] font-semibold">Foto do prêmio</p>
              <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
                Envie uma foto do prêmio — o cliente vê no cartão da campanha.
              </p>
              <div className="mt-3 flex flex-wrap items-start gap-4">
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[12px] border border-dashed border-[var(--color-neutral-200)] bg-[var(--color-neutral-200)]">
                  {form.rewardImageUrl ? (
                    <CampaignImageThumb
                      src={form.rewardImageUrl}
                      className="h-full w-full"
                    />
                  ) : (
                    <span className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-[11px] text-[var(--color-neutral-500)]">
                      <ImageIcon size={20} strokeWidth={1.75} aria-hidden />
                      Sem foto
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-card)] px-3 text-[13px] font-semibold">
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
                  {form.rewardImageUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, rewardImageUrl: '' }))
                      }
                      className="text-left text-[13px] text-[var(--color-neutral-500)]"
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            <label className="mt-4 flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                checked={form.activate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, activate: e.target.checked }))
                }
              />
              {isEditing
                ? 'Campanha ativa'
                : 'Ativar agora'}
            </label>

            <label className="mt-4 block text-[13px] font-semibold">
              Somente para audiência
              <span className="ml-1 font-normal text-[var(--color-neutral-400)]">
                · opcional
              </span>
              <select
                value={form.audienceSegmentId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    audienceSegmentId: e.target.value,
                  }))
                }
                className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] px-3 text-[15px]"
              >
                <option value="">Todos os clientes</option>
                {audiences.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.memberCount})
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[12px] font-normal text-[var(--color-neutral-500)]">
                Se escolhida, só os clientes dessa audiência{' '}
                {form.type === 'cashback'
                  ? 'ganham cashback.'
                  : 'podem resgatar.'}
                {form.audienceSegmentId
                  ? ` Estimativa: ${
                      audiences.find((a) => a.id === form.audienceSegmentId)
                        ?.memberCount ?? '—'
                    } clientes.`
                  : ' Crie audiências em Relatórios.'}
              </p>
            </label>

            {/* Preview */}
            <div className="mt-5 rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-4">
              <CampaignCardPreview
                businessName={business?.name ?? 'Sua loja'}
                businessLogoUrl={business?.logoUrl}
                primaryColor={primary}
                primaryColorDark={
                  business?.primaryColorDark ?? primary
                }
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
              />
            </div>

            <button
              type="submit"
              disabled={busy || uploading}
              className="mt-4 min-h-11 rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[15px] font-semibold text-white shadow-[var(--shadow-cta)] disabled:bg-[var(--color-primary-200)] disabled:shadow-none"
            >
              {busy
                ? 'Salvando…'
                : isEditing
                  ? 'Salvar alterações'
                  : 'Criar campanha'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-[15px] text-[var(--color-neutral-500)]">
            Carregando…
          </p>
        ) : campaigns.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[var(--color-neutral-200)] p-8 text-center">
            <p className="text-[15px] text-[var(--color-neutral-500)]">
              Nenhuma campanha ainda. Crie carimbos, pontos, cashback ou um
              presente de aniversário.
            </p>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-[var(--color-neutral-200)] p-8 text-center">
            <p className="text-[15px] text-[var(--color-neutral-500)]">
              {statusFilter === 'active'
                ? 'Nenhuma campanha ativa no momento.'
                : 'Nenhuma campanha inativa.'}{' '}
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="font-semibold text-[var(--color-primary-500)]"
              >
                Ver todas
              </button>
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filteredCampaigns.map((c) => (
              <li
                key={c.id}
                id={`campaign-${c.id}`}
                className={`rounded-[16px] border bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)] ${
                  highlightId === c.id
                    ? 'border-[var(--color-primary-500)] ring-2 ring-[var(--color-primary-500)]/20'
                    : 'border-[var(--color-hairline)]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[17px] font-semibold">{c.name}</h2>
                      {c.type === 'spend' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-points-bg)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-points)] ring-1 ring-inset ring-[var(--color-points-ring)]">
                          <Coins size={13} strokeWidth={2.25} aria-hidden />
                          Pontos
                        </span>
                      ) : c.type === 'birthday' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-50)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-primary-600)] ring-1 ring-inset ring-[var(--color-primary-200)]">
                          <Cake size={13} strokeWidth={2.25} aria-hidden />
                          Aniversário
                        </span>
                      ) : c.type === 'cashback' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-cashback-bg)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-cashback)] ring-1 ring-inset ring-[var(--color-cashback-ring)]">
                          <Banknote size={13} strokeWidth={2.25} aria-hidden />
                          Cashback
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-stamps-bg)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-stamps)] ring-1 ring-inset ring-[var(--color-stamps-ring)]">
                          <Stamp size={13} strokeWidth={2.25} aria-hidden />
                          Carimbos
                        </span>
                      )}
                      <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-neutral-600)] ring-1 ring-inset ring-[var(--color-hairline)]">
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                      {(c.audienceSegment || c.audienceSegmentId) && (
                        <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-neutral-600)] ring-1 ring-inset ring-[var(--color-hairline)]">
                          Audiência
                          {c.audienceSegment?.name
                            ? `: ${c.audienceSegment.name}`
                            : ''}
                          {c.audienceMemberCount != null
                            ? ` (${c.audienceMemberCount})`
                            : ''}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[14px] text-[var(--color-neutral-500)]">
                      {c.type === 'spend'
                        ? `Meta ${c.stampsNeeded} pontos`
                        : c.type === 'birthday'
                          ? 'Presente no aniversário · uma vez ao ano'
                          : c.type === 'cashback'
                            ? `Cashback ${c.cashbackPercent ?? 0}% · válido no caixa`
                            : `${c.stampsNeeded} carimbos`}
                      {c.rewardTitle ? ` · ${c.rewardTitle}` : ''}
                    </p>
                    {perfById[c.id] && (
                      <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-[var(--color-neutral-500)]">
                        {c.type === 'cashback' ? (
                          <>
                            <span>
                              <strong className="text-[var(--color-ink)]">
                                {perfById[c.id].redeems}
                              </strong>{' '}
                              {perfById[c.id].redeems === 1
                                ? 'uso no caixa (30d)'
                                : 'usos no caixa (30d)'}
                            </span>
                            <span>
                              <strong className="text-[var(--color-ink)]">
                                {formatMoney(
                                  perfById[c.id].cashbackSpentCents ?? 0,
                                )}
                              </strong>{' '}
                              usados
                            </span>
                            {(perfById[c.id].cashbackEarnedCents ?? 0) > 0 && (
                              <span>
                                {formatMoney(
                                  perfById[c.id].cashbackEarnedCents ?? 0,
                                )}{' '}
                                creditados
                              </span>
                            )}
                            <span>
                              <strong className="text-[var(--color-ink)]">
                                {perfById[c.id].engagePct}%
                              </strong>{' '}
                              ganharam
                            </span>
                            <span>
                              {formatMoney(
                                perfById[c.id].revenueFromRedeemersCents,
                              )}{' '}
                              em vendas no caixa
                            </span>
                          </>
                        ) : (
                          <>
                            <span>
                              <strong className="text-[var(--color-ink)]">
                                {perfById[c.id].redeems}
                              </strong>{' '}
                              resgates (30d)
                            </span>
                            <span>
                              <strong className="text-[var(--color-ink)]">
                                {perfById[c.id].fulfillPct}%
                              </strong>{' '}
                              entrega
                            </span>
                            <span>
                              <strong className="text-[var(--color-ink)]">
                                {perfById[c.id].engagePct}%
                              </strong>{' '}
                              engaj.
                            </span>
                            <span>
                              {formatMoney(
                                perfById[c.id].revenueFromRedeemersCents,
                              )}{' '}
                              dos resgatadores
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setPerfOpenId(
                              perfOpenId === c.id ? null : c.id,
                            )
                          }
                          className="font-semibold text-[var(--color-primary-500)]"
                        >
                          {perfOpenId === c.id ? 'Ocultar' : 'Detalhe'}
                        </button>
                      </div>
                    )}
                    {perfOpenId === c.id && perfById[c.id] && (
                      <div className="mt-3 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-3">
                        <p className="text-[12px] text-[var(--color-neutral-500)]">
                          Elegíveis {perfById[c.id].eligible} ·{' '}
                          {c.type === 'cashback'
                            ? `Ganharam ${perfById[c.id].redeemers}`
                            : `Resgatadores ${perfById[c.id].redeemers}`}
                        </p>
                        <div className="mt-2 flex h-16 items-end gap-0.5">
                          {perfById[c.id].series
                            .filter((_, i, arr) =>
                              arr.length > 40 ? i % 3 === 0 : true,
                            )
                            .map((d) => {
                              const max = Math.max(
                                1,
                                ...perfById[c.id].series.map((x) => x.redeems),
                              );
                              const h = Math.max(
                                2,
                                Math.round((d.redeems / max) * 100),
                              );
                              return (
                                <div
                                  key={d.date}
                                  className="min-w-0 flex-1 rounded-[2px] bg-[var(--color-primary-500)]"
                                  style={{ height: `${h}%` }}
                                  title={`${d.date}: ${d.redeems}`}
                                />
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {c.rewardImageUrl && (
                      <CampaignImageThumb
                        src={c.rewardImageUrl}
                        className="h-14 w-14 rounded-[10px]"
                      />
                    )}
                    <div className="flex flex-wrap gap-2">
                    {c.status !== 'archived' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openEdit(c)}
                        className="min-h-10 rounded-[10px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold disabled:opacity-60"
                      >
                        Editar
                      </button>
                    )}
                    {c.status !== 'active' && c.status !== 'archived' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setStatus(c.id, 'active')}
                        className="min-h-10 rounded-[10px] bg-[var(--color-primary-500)] px-3 text-[13px] font-semibold text-white disabled:opacity-60"
                      >
                        Ativar
                      </button>
                    )}
                    {c.status === 'active' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setStatus(c.id, 'paused')}
                        className="min-h-10 rounded-[10px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold disabled:opacity-60"
                      >
                        Pausar
                      </button>
                    )}
                    {c.status !== 'archived' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setStatus(c.id, 'archived')}
                        className="min-h-10 rounded-[10px] px-3 text-[13px] font-semibold text-[var(--color-neutral-500)] disabled:opacity-60"
                      >
                        Arquivar
                      </button>
                    )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function CampaignImageThumb({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div
      className={`relative overflow-hidden bg-[var(--color-neutral-200)] ${className ?? ''}`}
    >
      {failed ? (
        <span
          className="absolute inset-0 flex items-center justify-center text-[var(--color-neutral-400)]"
          aria-hidden
        >
          <ImageIcon size={18} strokeWidth={1.75} />
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
