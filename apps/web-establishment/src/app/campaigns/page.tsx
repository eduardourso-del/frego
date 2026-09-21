'use client';

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Stamp, Coins, Cake, ImageIcon, Banknote, Percent } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  CampaignCreateForm,
  emptyCampaignForm,
  type AudienceOption,
  type CampaignFormState,
  type CampaignType,
  type PromoPeriod,
} from '@/components/campaign-create-form';
import { SegmentedControl } from '@/components/ui';
import { useBusiness } from '@/lib/business-context';
import { API_URL } from '@/lib/api';
import { formatCoverage } from '@/lib/campaign-return';
import { promoHint } from '@/lib/promo-label';
import { CampaignCompareChart } from '@/components/campaign-compare-chart';
import { TermInfo } from '@/components/term-info';
import { formatBrl } from '@/lib/money';
import { TERM } from '@/lib/term-copy';

type CampaignStatus = 'draft' | 'active' | 'paused' | 'archived';
type StatusFilter = 'all' | 'active' | 'inactive';
type TypeFilter = 'all' | CampaignType;

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
  startsOn?: string | null;
  endsOn?: string | null;
  weekdays?: number[];
  redeemMax?: number | null;
  redeemPeriod?: string | null;
};

type CampaignPerformance = {
  eligible: number;
  redeemers: number;
  redeems: number;
  fulfillPct: number;
  engagePct: number;
  revenueFromRedeemersCents: number;
  revenueCoverage?: { withAmount: number; used: number };
  cashbackSpentCents?: number;
  cashbackEarnedCents?: number;
  openVouchers?: number;
  usedVouchers?: number;
  expiredVouchers?: number;
  series: Array<{ date: string; redeems: number }>;
};

const emptyForm: CampaignFormState = emptyCampaignForm;

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

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'stamps', label: 'Carimbos' },
  { value: 'spend', label: 'Pontos' },
  { value: 'birthday', label: 'Aniversário' },
  { value: 'cashback', label: 'Cashback' },
  { value: 'promo', label: 'Promoção' },
];

function parseStatusFilter(raw: string | null): StatusFilter {
  if (raw === 'active' || raw === 'inactive' || raw === 'all') return raw;
  return 'all';
}

function parseTypeFilter(raw: string | null): TypeFilter {
  if (
    raw === 'stamps' ||
    raw === 'spend' ||
    raw === 'birthday' ||
    raw === 'cashback' ||
    raw === 'promo'
  ) {
    return raw;
  }
  return 'all';
}

const RULE_KEYS = [
  'spendCentsMin',
  'spendCentsMax',
  'windowDays',
  'inactiveDaysMin',
  'visitsMin',
  'visitsMax',
  'nearReward',
  'isVip',
  'tagIds',
  'tagMatch',
] as const;

function composeQueryKeys() {
  return [
    'compose',
    'fromAudience',
    'audienceId',
    'audienceName',
    'campaignName',
    'rewardTitle',
    ...RULE_KEYS,
  ];
}

function parseRulesFromSearch(searchParams: URLSearchParams) {
  const rules: Record<string, unknown> = { version: 1 };
  for (const key of RULE_KEYS) {
    const v = searchParams.get(key);
    if (v == null || v === '') continue;
    if (key === 'nearReward' || key === 'isVip') {
      rules[key] = v === 'true' || v === '1';
    } else if (key === 'tagIds') {
      rules[key] = v.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (key === 'tagMatch') {
      rules[key] = v === 'all' ? 'all' : 'any';
    } else {
      rules[key] = Number.parseInt(v, 10);
    }
  }
  return rules;
}

function ruleValue(v: unknown) {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return v.join(',');
  return String(v);
}

function rulesMatch(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown>,
) {
  if (!a) return false;
  return RULE_KEYS.every((k) => ruleValue(a[k]) === ruleValue(b[k]));
}

function badgeTitleForAudience(name: string, rules: Record<string, unknown>) {
  const n = name.trim().toLowerCase();
  if (
    n === 'alto valor' ||
    n === 'quem mais gastou' ||
    n === 'quem voltou'
  ) {
    return 'Cliente da casa';
  }
  if (n === 'em risco' || n === 'quem sumiu') return 'De volta à casa';
  if (n === 'quase prêmio' || n === 'quase premio') return 'Quase lá';
  if (n === 'vip' || n === 'vips quietos') return 'VIP da casa';
  if (name.trim()) return name.trim();
  return typeof rules.spendCentsMin === 'number' ? 'Cliente da casa' : name;
}

function matchesFilter(
  c: Campaign,
  status: StatusFilter,
  type: TypeFilter,
  audience: string,
) {
  if (status === 'active' && c.status !== 'active') return false;
  if (status === 'inactive' && c.status === 'active') return false;
  if (type !== 'all' && c.type !== type) return false;
  if (audience === 'none') {
    if (c.audienceSegmentId || c.audienceSegment?.id) return false;
  } else if (audience) {
    const id = c.audienceSegmentId || c.audienceSegment?.id;
    if (id !== audience) return false;
  }
  return true;
}

function formatMoney(cents: number) {
  return formatBrl(cents);
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
  const typeFilter = parseTypeFilter(searchParams.get('type'));
  const audienceFilter = searchParams.get('audience') ?? '';
  const highlightId = searchParams.get('highlight');
  const urlAudienceId = searchParams.get('audienceId');
  const urlAudienceName = searchParams.get('audienceName');
  const fromAudience = searchParams.get('fromAudience');
  const compose = searchParams.get('compose') === '1';
  const urlCampaignName = searchParams.get('campaignName');
  const urlRewardTitle = searchParams.get('rewardTitle');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [audiences, setAudiences] = useState<AudienceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(() =>
    Boolean(urlAudienceId || fromAudience || compose),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    audienceSegmentId: urlAudienceId ?? '',
    name:
      urlCampaignName?.trim() ||
      (urlAudienceName ? `Campanha · ${urlAudienceName}` : emptyForm.name),
    rewardTitle:
      urlRewardTitle?.trim() ||
      (urlAudienceName
        ? `Prêmio para ${urlAudienceName}`
        : emptyForm.rewardTitle),
  }));
  const [uploading, setUploading] = useState(false);
  const [perfById, setPerfById] = useState<Record<string, CampaignPerformance>>(
    {},
  );
  const [perfOpenId, setPerfOpenId] = useState<string | null>(null);
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const audienceBootstrapKey = `${urlAudienceId ?? ''}|${fromAudience ?? ''}|${urlAudienceName ?? ''}|${compose ? '1' : ''}|${urlCampaignName ?? ''}|${urlRewardTitle ?? ''}`;
  const audienceBootstrapped = useRef<string | null>(null);

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((c) =>
        matchesFilter(c, statusFilter, typeFilter, audienceFilter),
      ),
    [campaigns, statusFilter, typeFilter, audienceFilter],
  );

  const compareRows = useMemo(
    () =>
      filteredCampaigns
        .map((c) => {
          const perf = perfById[c.id];
          if (!perf) return null;
          return {
            id: c.id,
            name: c.name,
            type: c.type,
            redeems: perf.redeems,
            redeemers: perf.redeemers,
            revenueCents: perf.revenueFromRedeemersCents,
          };
        })
        .filter(
          (
            row,
          ): row is {
            id: string;
            name: string;
            type: string;
            redeems: number;
            redeemers: number;
            revenueCents: number;
          } => row != null,
        ),
    [filteredCampaigns, perfById],
  );

  const filterCounts = useMemo(() => {
    const inTypeAudience = campaigns.filter((c) =>
      matchesFilter(c, 'all', typeFilter, audienceFilter),
    );
    let active = 0;
    let inactive = 0;
    for (const c of inTypeAudience) {
      if (c.status === 'active') active += 1;
      else inactive += 1;
    }
    return { all: inTypeAudience.length, active, inactive };
  }, [campaigns, typeFilter, audienceFilter]);

  function replaceCampaignsQuery(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.replace(qs ? `/campaigns?${qs}` : '/campaigns', { scroll: false });
  }

  function setStatusFilter(next: StatusFilter) {
    replaceCampaignsQuery((params) => {
      if (next === 'all') params.delete('status');
      else params.set('status', next);
    });
  }

  function setTypeFilter(next: TypeFilter) {
    replaceCampaignsQuery((params) => {
      if (next === 'all') params.delete('type');
      else params.set('type', next);
    });
  }

  function setAudienceFilter(id: string) {
    replaceCampaignsQuery((params) => {
      if (!id) params.delete('audience');
      else params.set('audience', id);
    });
  }

  function clearFilters() {
    replaceCampaignsQuery((params) => {
      params.delete('status');
      params.delete('type');
      params.delete('audience');
    });
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

      const withHistory = (campJson.campaigns ?? []).filter(
        (c: Campaign) => c.status === 'active' || c.status === 'paused',
      ) as Campaign[];
      const perfEntries = await Promise.all(
        withHistory.slice(0, 12).map(async (c) => {
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

  useEffect(() => {
    if (highlightId) setPerfOpenId(highlightId);
  }, [highlightId]);

  // Open create form immediately when arriving from Painel/Relatórios/Clientes.
  // Audience create can finish after the form is already on screen.
  useEffect(() => {
    if (!urlAudienceId && !fromAudience && !compose) return;
    if (audienceBootstrapped.current === audienceBootstrapKey) return;

    let cancelled = false;

    const seededName =
      urlCampaignName?.trim() ||
      (urlAudienceName ? `Campanha · ${urlAudienceName}` : emptyForm.name);
    const seededReward =
      urlRewardTitle?.trim() ||
      (urlAudienceName
        ? `Prêmio para ${urlAudienceName}`
        : emptyForm.rewardTitle);

    setEditingId(null);
    setForm({
      ...emptyForm,
      audienceSegmentId: urlAudienceId ?? '',
      name: seededName,
      rewardTitle: seededReward,
    });
    setShowForm(true);

    async function attachAudience() {
      if (!fromAudience || urlAudienceId) {
        if (!cancelled) audienceBootstrapped.current = audienceBootstrapKey;
        return;
      }
      let segmentId = '';
      try {
        const headers = {
          ...(await authHeaders()),
          'Content-Type': 'application/json',
        };
        const rules = parseRulesFromSearch(searchParams);
        const name =
          urlAudienceName?.trim() ||
          `Audiência ${new Date().toLocaleDateString('pt-BR')}`;

        const listRes = await fetch(`${API_URL}/audiences`, { headers });
        const listJson = await listRes.json().catch(() => ({}));
        const existing = (
          (listJson.audiences ?? []) as Array<{
            id: string;
            name: string;
            memberCount?: number;
            rules?: Record<string, unknown>;
          }>
        ).find(
          (a) =>
            a.name.trim().toLowerCase() === name.toLowerCase() &&
            rulesMatch(a.rules, rules),
        );

        if (existing) {
          segmentId = existing.id;
          if (!cancelled) {
            setAudiences((prev) => {
              if (prev.some((a) => a.id === segmentId)) return prev;
              return [
                {
                  id: existing.id,
                  name: existing.name,
                  memberCount: existing.memberCount ?? 0,
                },
                ...prev,
              ];
            });
          }
        } else {
          const res = await fetch(`${API_URL}/audiences`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              name,
              rules,
              showBadge: true,
              badgeTitle: badgeTitleForAudience(name, rules),
              badgeMessage:
                'A loja reconhece você — desbloqueamos condições especiais para quem volta e faz parte da casa.',
            }),
          });
          const json = await res.json();
          if (res.ok && json.audience?.id) {
            segmentId = json.audience.id as string;
            if (!cancelled) {
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
          }
        }
      } catch {
        // Form stays open even if the audience could not be saved yet.
      }
      if (cancelled) return;
      if (segmentId) {
        setForm((prev) => ({ ...prev, audienceSegmentId: segmentId }));
      }
      audienceBootstrapped.current = audienceBootstrapKey;
    }

    void attachAudience();
    return () => {
      cancelled = true;
    };
  }, [
    audienceBootstrapKey,
    urlAudienceId,
    urlAudienceName,
    fromAudience,
    compose,
    urlCampaignName,
    urlRewardTitle,
    searchParams,
    authHeaders,
  ]);

  useEffect(() => {
    if (!showForm) return;
    formSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [showForm]);

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    audienceBootstrapped.current = null;
    if (urlAudienceId || fromAudience || compose) {
      const params = new URLSearchParams(searchParams.toString());
      for (const key of composeQueryKeys()) params.delete(key);
      const qs = params.toString();
      router.replace(qs ? `/campaigns?${qs}` : '/campaigns', { scroll: false });
    }
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
            : c.type === 'promo'
              ? 'promo'
              : 'stamps';
    const period: PromoPeriod =
      c.redeemPeriod === 'day' ||
      c.redeemPeriod === 'week' ||
      c.redeemPeriod === 'month' ||
      c.redeemPeriod === 'year' ||
      c.redeemPeriod === 'campaign'
        ? c.redeemPeriod
        : 'campaign';
    setForm({
      name: c.name,
      type,
      stampsNeeded:
        c.stampsNeeded ??
        (type === 'spend' ? 100 : type === 'birthday' || type === 'promo' ? 1 : 10),
      pointsPerReal: c.pointsPerReal ?? 1,
      cashbackPercent: c.cashbackPercent ?? 5,
      rewardTitle: c.rewardTitle ?? '',
      rewardDescription: c.rewardDescription ?? '',
      rewardImageUrl: c.rewardImageUrl ?? '',
      activate: c.status === 'active',
      audienceSegmentId:
        c.audienceSegmentId ?? c.audienceSegment?.id ?? '',
      startsOn: c.startsOn ? String(c.startsOn).slice(0, 10) : '',
      endsOn: c.endsOn ? String(c.endsOn).slice(0, 10) : '',
      weekdays:
        (c.weekdays ?? []).length === 7 ? [] : (c.weekdays ?? []),
      unlimited: type === 'promo' && c.redeemMax == null,
      redeemMax: c.redeemMax ?? 1,
      redeemPeriod: period,
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
          form.type === 'birthday' ||
          form.type === 'cashback' ||
          form.type === 'promo'
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
        ...(form.type === 'promo'
          ? {
              startsOn: form.startsOn || null,
              endsOn: form.endsOn || null,
              weekdays: form.weekdays,
              redeemMax: form.unlimited ? null : form.redeemMax,
              redeemPeriod: form.unlimited ? null : form.redeemPeriod,
            }
          : {
              startsOn: null,
              endsOn: null,
              weekdays: [],
              redeemMax: null,
              redeemPeriod: null,
            }),
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
          throw new Error(
            form.type === 'promo'
              ? 'Informe o prêmio da promoção.'
              : 'Informe o prêmio do aniversário.',
          );
        }
        if (json.error === 'INVALID_PROMO_DATES') {
          throw new Error('A data de início não pode ser depois da data de fim.');
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

  async function deleteCampaign(id: string, name: string) {
    const label = name.trim() || 'esta campanha';
    if (
      !confirm(
        `Excluir “${label}”? O histórico de carimbos da loja é mantido, mas a campanha some da lista e do app.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/campaigns/${id}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Não foi possível excluir.');
      if (editingId === id) closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir.');
    } finally {
      setBusy(false);
    }
  }

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
              O cliente vê e resgata no aplicativo. Cada campanha tem um
              prêmio e, se quiser, uma audiência.
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

        {!showForm && (
          <div className="mb-5 flex flex-col gap-2">
            <div
              className="flex gap-1 overflow-x-auto rounded-[14px] bg-[var(--color-neutral-100)] p-1"
              role="tablist"
              aria-label="Filtrar por status"
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <SegmentedControl
                value={typeFilter}
                options={TYPE_FILTERS.map((f) => ({
                  value: f.value,
                  label: f.label,
                  icon:
                    f.value === 'stamps' ? (
                      <Stamp size={14} strokeWidth={2.25} aria-hidden />
                    ) : f.value === 'spend' ? (
                      <Coins size={14} strokeWidth={2.25} aria-hidden />
                    ) : f.value === 'birthday' ? (
                      <Cake size={14} strokeWidth={2.25} aria-hidden />
                    ) : f.value === 'cashback' ? (
                      <Banknote size={14} strokeWidth={2.25} aria-hidden />
                    ) : f.value === 'promo' ? (
                      <Percent size={14} strokeWidth={2.25} aria-hidden />
                    ) : undefined,
                }))}
                onChange={setTypeFilter}
                ariaLabel="Filtrar por tipo"
                className="min-w-0 flex-1"
              />
              <div className="flex shrink-0 items-center gap-2 sm:w-auto">
                <label className="block sm:w-[220px]">
                  <span className="sr-only">Audiência</span>
                  <select
                    value={audienceFilter}
                    onChange={(e) => setAudienceFilter(e.target.value)}
                    aria-label="Filtrar por audiência"
                    className="min-h-11 w-full rounded-[14px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3.5 text-[13px] font-semibold text-[var(--color-ink)] outline-none transition-[border,box-shadow] focus:border-[var(--color-primary-500)] focus:shadow-[var(--shadow-focus)]"
                  >
                    <option value="">Todas as audiências</option>
                    <option value="none">Toda a casa</option>
                    {audiences.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.memberCount})
                      </option>
                    ))}
                  </select>
                </label>
                <Link
                  href="/audiences"
                  className="shrink-0 text-[12px] font-semibold text-[var(--color-primary-500)]"
                >
                  Gerenciar
                </Link>
              </div>
            </div>
          </div>
        )}
        {showForm && (
          <div ref={formSectionRef}>
            <CampaignCreateForm
              form={form}
              setForm={setForm}
              audiences={audiences}
              business={business}
              isEditing={isEditing}
              busy={busy}
              uploading={uploading}
              setUploading={setUploading}
              setError={setError}
              onSubmit={onSave}
            />
          </div>
        )}

        {!showForm && (loading ? (
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
              Nenhuma campanha neste filtro.{' '}
              <button
                type="button"
                onClick={clearFilters}
                className="font-semibold text-[var(--color-primary-500)]"
              >
                Ver todas
              </button>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {compareRows.length > 1 && (
              <CampaignCompareChart
                compact
                campaigns={compareRows}
                hrefFor={(id) => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set('highlight', id);
                  return `/campaigns?${params.toString()}`;
                }}
                periodHint="Últimos 30 dias, nas campanhas deste filtro."
              />
            )}
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
                      ) : c.type === 'promo' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-promo-bg)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-promo)] ring-1 ring-inset ring-[var(--color-promo-ring)]">
                          <Percent size={13} strokeWidth={2.25} aria-hidden />
                          Promoção
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
                            : c.type === 'promo'
                              ? promoHint(c)
                              : `${c.stampsNeeded} carimbos`}
                      {c.rewardTitle ? ` · ${c.rewardTitle}` : ''}
                    </p>
                    {perfById[c.id] && (
                      <CampaignPerfStrip
                        type={c.type}
                        perf={perfById[c.id]}
                        open={perfOpenId === c.id}
                        onToggle={() =>
                          setPerfOpenId(perfOpenId === c.id ? null : c.id)
                        }
                      />
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
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deleteCampaign(c.id, c.name)}
                      className="min-h-10 rounded-[10px] px-3 text-[13px] font-semibold text-[var(--color-danger)] disabled:opacity-60"
                    >
                      Excluir
                    </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function PerfMetric({
  label,
  value,
  hint,
  info,
}: {
  label: string;
  value: string;
  hint?: string | null;
  info?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-[var(--color-neutral-400)]">
        {info ? <TermInfo info={info}>{label}</TermInfo> : label}
      </div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-[var(--color-ink)]">
        {value}
      </div>
      {hint ? (
        <div className="text-[11px] text-[var(--color-neutral-400)]">{hint}</div>
      ) : null}
    </div>
  );
}

function CampaignPerfStrip({
  type,
  perf,
  open,
  onToggle,
}: {
  type: string;
  perf: CampaignPerformance;
  open: boolean;
  onToggle: () => void;
}) {
  const isCashback = type === 'cashback';
  const voucherTotal =
    (perf.openVouchers ?? 0) +
    (perf.usedVouchers ?? 0) +
    (perf.expiredVouchers ?? 0);
  const series = perf.series.filter((_, i, arr) =>
    arr.length > 40 ? i % 3 === 0 : true,
  );
  const max = Math.max(1, ...perf.series.map((x) => x.redeems));

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PerfMetric
          label={isCashback ? 'Usos no caixa (30d)' : 'Resgates (30d)'}
          info={TERM.resgates}
          value={perf.redeems.toLocaleString('pt-BR')}
          hint={
            isCashback
              ? `${perf.redeemers} ganharam`
              : `${perf.redeemers} de ${perf.eligible} pessoas`
          }
        />
        {isCashback ? (
          <PerfMetric
            label="Cashback usado"
            value={formatMoney(perf.cashbackSpentCents ?? 0)}
            hint={
              (perf.cashbackEarnedCents ?? 0) > 0
                ? `${formatMoney(perf.cashbackEarnedCents ?? 0)} creditados`
                : null
            }
          />
        ) : (
          <PerfMetric
            label="Confirmados"
            info={TERM.confirmados}
            value={voucherTotal === 0 ? '—' : `${perf.fulfillPct}%`}
            hint={
              (perf.openVouchers ?? 0) > 0
                ? `${perf.openVouchers} à espera no caixa`
                : voucherTotal === 0
                  ? 'sem vouchers'
                  : `${perf.usedVouchers ?? 0} no caixa`
            }
          />
        )}
        <PerfMetric
          label="Engajamento"
          info={TERM.engajamento}
          value={`${perf.engagePct}%`}
          hint={`${perf.eligible.toLocaleString('pt-BR')} elegíveis`}
        />
        <PerfMetric
          label={isCashback ? 'Vendas no caixa' : 'Retorno no resgate'}
          info={TERM.retorno}
          value={formatMoney(perf.revenueFromRedeemersCents)}
          hint={formatCoverage(perf.revenueCoverage)}
        />
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="mt-2 text-[12px] font-semibold text-[var(--color-primary-500)]"
      >
        {open ? 'Ocultar série' : 'Ver série diária'}
      </button>
      {open && (
        <div className="mt-2 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-3">
          <div className="flex h-16 items-end gap-0.5">
            {series.map((d) => {
              const h = Math.max(2, Math.round((d.redeems / max) * 100));
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
