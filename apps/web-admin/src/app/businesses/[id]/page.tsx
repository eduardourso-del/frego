'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api';
import { BusinessCustomers } from '@/components/business-customers';
import { BusinessTypePicker } from '@/components/business-type-picker';
import {
  CampaignEditor,
  type AdminCampaign,
} from '@/components/campaign-editor';
import { DeleteBusinessDialog } from '@/components/delete-business-dialog';
import {
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_TYPE_LABEL,
  ROLE_LABEL,
  STATUS_LABEL,
  STATUS_OPTIONS,
  WHATSAPP_STATUS_LABEL,
} from '@/lib/labels';
import { formatCnpj } from '@/lib/cnpj';

type LocationDraft = {
  id: string;
  name: string;
  address: string;
  isOpen: boolean;
};

type Detail = {
  business: {
    id: string;
    name: string;
    type: string;
    status: string;
    explorationVisible: boolean;
    logoUrl: string | null;
    heroImageUrl: string | null;
    primaryColor: string;
    primaryColorDark: string;
    slogan: string | null;
    cnpj: string | null;
    slug: string | null;
    pointsPerReal: number;
    cashbackPercent: number;
    cashbackMaxCents: number | null;
    cashbackMinPurchaseCents: number | null;
    stampsExpireDays: number | null;
    pointsExpireDays: number | null;
    cashbackExpireDays: number | null;
    createdAt: string;
    updatedAt: string;
  };
  locations: LocationDraft[];
  team: Array<{
    id: string;
    email: string | null;
    displayName: string | null;
    role: string;
    status: string;
    createdAt: string;
  }>;
  billing: {
    status: string;
    mrrCents: number;
    plan: { tier: string; name: string } | null;
  } | null;
  whatsapp: {
    status: string;
    displayPhoneNumber: string | null;
    verifiedName: string | null;
    qualityRating: string | null;
    coexistence: boolean;
    lastError: string | null;
    connectedAt: string;
  } | null;
  audiences?: Array<{ id: string; name: string }>;
  campaigns: AdminCampaign[];
  stats: {
    customers: number;
    campaigns: number;
    activeCampaigns: number;
    earns30d: number;
    redeems30d: number;
    spendCents30d: number;
    lastActivityAt: string | null;
  };
};

type BusinessTab = 'config' | 'metrics' | 'campaigns';

const BUSINESS_TABS: { id: BusinessTab; label: string }[] = [
  { id: 'config', label: 'Configuração' },
  { id: 'metrics', label: 'Métricas' },
  { id: 'campaigns', label: 'Campanhas' },
];

const inputClass =
  'mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[16px] font-normal normal-case tracking-normal text-[var(--color-ink)]';

const WEEKDAY_LABEL = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const REDEEM_PERIOD_LABEL: Record<string, string> = {
  day: 'por dia',
  week: 'por semana',
  month: 'por mês',
  year: 'por ano',
  campaign: 'na campanha',
};

function formatDay(ymd: string) {
  const [year, month, day] = ymd.split('-');
  if (!year || !month || !day) return ymd;
  return `${day}/${month}/${year}`;
}

function campaignRules(campaign: Detail['campaigns'][number]) {
  const parts: string[] = [];
  if (campaign.cartela) parts.push('Cartela');
  if (campaign.stampsNeeded) parts.push(`${campaign.stampsNeeded} para o prêmio`);
  if (campaign.pointsPerReal) {
    parts.push(
      `R$ ${campaign.pointsPerReal.toLocaleString('pt-BR')} → 1 ponto`,
    );
  }
  if (campaign.cashbackPercent != null) {
    parts.push(`${campaign.cashbackPercent}% de cashback`);
  }
  if (campaign.startsOn || campaign.endsOn) {
    const start = campaign.startsOn ? formatDay(campaign.startsOn) : '…';
    const end = campaign.endsOn ? formatDay(campaign.endsOn) : '…';
    parts.push(`${start} – ${end}`);
  }
  if (campaign.weekdays.length > 0 && campaign.weekdays.length < 7) {
    parts.push(
      campaign.weekdays
        .filter((day) => day >= 0 && day <= 6)
        .map((day) => WEEKDAY_LABEL[day])
        .join(', '),
    );
  }
  if (campaign.redeemMax != null) {
    const period = campaign.redeemPeriod
      ? REDEEM_PERIOD_LABEL[campaign.redeemPeriod] ?? campaign.redeemPeriod
      : '';
    parts.push(
      `${campaign.redeemMax} resgate${campaign.redeemMax === 1 ? '' : 's'}${period ? ` ${period}` : ''}`,
    );
  }
  if (campaign.audienceName) parts.push(campaign.audienceName);
  return parts;
}

function apiErrorMessage(error: string | undefined) {
  if (error === 'SLUG_TAKEN') return 'Este slug já está em uso.';
  if (error === 'INVALID_CNPJ') return 'CNPJ inválido.';
  if (error === 'CNPJ_TAKEN') return 'Este CNPJ já está cadastrado.';
  if (error === 'LOCATION_NOT_FOUND') return 'Unidade não encontrada.';
  if (error === 'NOT_FOUND') return 'Estabelecimento não encontrado.';
  return error ?? 'Falha ao salvar';
}

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getToken, ready } = useAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<BusinessTab>('config');
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState('café');
  const [status, setStatus] = useState('pending');
  const [explorationVisible, setExplorationVisible] = useState(false);
  const [slogan, setSlogan] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#070707');
  const [primaryColorDark, setPrimaryColorDark] = useState('#070707');
  const [pointsPerReal, setPointsPerReal] = useState(1);
  const [stampsExpireEnabled, setStampsExpireEnabled] = useState(false);
  const [stampsExpireDays, setStampsExpireDays] = useState(90);
  const [pointsExpireEnabled, setPointsExpireEnabled] = useState(false);
  const [pointsExpireDays, setPointsExpireDays] = useState(90);
  const [cashbackExpireEnabled, setCashbackExpireEnabled] = useState(false);
  const [cashbackExpireDays, setCashbackExpireDays] = useState(90);
  const [locations, setLocations] = useState<LocationDraft[]>([]);

  const applyDetail = useCallback((next: Detail) => {
    setDetail(next);
    const b = next.business;
    setName(b.name);
    setType(b.type);
    setStatus(b.status);
    setExplorationVisible(b.explorationVisible === true);
    setSlogan(b.slogan ?? '');
    setCnpj(formatCnpj(b.cnpj ?? ''));
    setSlug(b.slug ?? '');
    setLogoUrl(b.logoUrl ?? '');
    setHeroImageUrl(b.heroImageUrl ?? '');
    setPrimaryColor(b.primaryColor);
    setPrimaryColorDark(b.primaryColorDark);
    setPointsPerReal(b.pointsPerReal ?? 1);
    setStampsExpireEnabled(b.stampsExpireDays != null);
    setStampsExpireDays(b.stampsExpireDays ?? 90);
    setPointsExpireEnabled(b.pointsExpireDays != null);
    setPointsExpireDays(b.pointsExpireDays ?? 90);
    setCashbackExpireEnabled(b.cashbackExpireDays != null);
    setCashbackExpireDays(b.cashbackExpireDays ?? 90);
    setLocations(
      next.locations.map((loc) => ({
        ...loc,
        address: loc.address ?? '',
      })),
    );
  }, []);

  const load = useCallback(async () => {
    if (!id || !ready) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/businesses/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(json.error));
      applyDetail(json as Detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id, getToken, applyDetail, ready]);

  useEffect(() => {
    void load();
  }, [load]);

  function setLocationField(
    locId: string,
    field: 'name' | 'address',
    value: string,
  ) {
    setLocations((prev) =>
      prev.map((loc) => (loc.id === locId ? { ...loc, [field]: value } : loc)),
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      for (const loc of locations) {
        if (loc.name.trim().length < 2) {
          throw new Error('Nome da unidade deve ter ao menos 2 caracteres');
        }
        if (loc.address.trim().length < 5) {
          throw new Error('Endereço deve ter ao menos 5 caracteres');
        }
      }

      const token = await getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`${API_URL}/admin/businesses/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          name,
          type,
          status,
          slogan: slogan || null,
          cnpj: cnpj || null,
          slug: slug || null,
          logoUrl: logoUrl || null,
          heroImageUrl: heroImageUrl || null,
          primaryColor,
          primaryColorDark,
          pointsPerReal,
          stampsExpireDays: stampsExpireEnabled
            ? Math.max(1, Math.min(3650, stampsExpireDays || 1))
            : null,
          pointsExpireDays: pointsExpireEnabled
            ? Math.max(1, Math.min(3650, pointsExpireDays || 1))
            : null,
          cashbackExpireDays: cashbackExpireEnabled
            ? Math.max(1, Math.min(3650, cashbackExpireDays || 1))
            : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(json.error));

      await Promise.all(
        locations.map(async (loc) => {
          const locRes = await fetch(
            `${API_URL}/admin/businesses/${id}/locations/${encodeURIComponent(loc.id)}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                name: loc.name.trim(),
                address: loc.address.trim(),
                isOpen: loc.isOpen,
              }),
            },
          );
          if (!locRes.ok) {
            const locJson = await locRes.json().catch(() => ({}));
            throw new Error(apiErrorMessage(locJson.error));
          }
        }),
      );

      const refreshed = await fetch(`${API_URL}/admin/businesses/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const refreshedJson = await refreshed.json();
      if (refreshed.ok) applyDetail(refreshedJson as Detail);
      else applyDetail(json as Detail);
      setToast('Estabelecimento salvo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!id || !detail) return;
    setBusy(true);
    setDeleteError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/businesses/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiErrorMessage(json.error));
      router.push('/businesses');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Falha ao excluir');
      setBusy(false);
    }
  }

  async function act(action: 'approve' | 'reject') {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/businesses/${id}/${action}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(json.error));
      await load();
      setToast(action === 'approve' ? 'Aprovado' : 'Recusado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function setVisible(next: boolean) {
    if (!id || visibilitySaving) return;
    const previous = explorationVisible;
    setExplorationVisible(next);
    setVisibilitySaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/businesses/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ explorationVisible: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(json.error));
      if (json.business) {
        setDetail((current) =>
          current
            ? {
                ...current,
                business: {
                  ...current.business,
                  explorationVisible: json.business.explorationVisible === true,
                },
              }
            : current,
        );
      }
      setToast(next ? 'Visível na exploração' : 'Fora da exploração');
    } catch (err) {
      setExplorationVisible(previous);
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setVisibilitySaving(false);
    }
  }

  const letter = (name || 'V').trim().charAt(0).toUpperCase();
  const editingCampaign =
    detail?.campaigns.find((campaign) => campaign.id === editingCampaignId) ??
    null;

  return (
    <AdminShell>
      <Link
        href="/businesses"
        className="mb-5 inline-flex text-[14px] font-semibold text-[var(--color-primary-500)]"
      >
        ← Estabelecimentos
      </Link>

      {loading && !detail ? (
        <p className="text-[15px] text-[var(--color-neutral-500)]">
          Carregando…
        </p>
      ) : !detail ? (
        <p className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-8 text-[15px] text-[var(--color-neutral-500)]">
          {error ?? 'Estabelecimento não encontrado.'}
        </p>
      ) : (
        <>
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[28px] font-semibold tracking-[-0.02em]">
                  {detail.business.name}
                </h1>
                <span className="rounded-[6px] bg-[var(--color-bg)] px-2 py-0.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-500)]">
                  {STATUS_LABEL[detail.business.status] ??
                    detail.business.status}
                </span>
              </div>
              <p className="mt-1 text-[14px] text-[var(--color-neutral-500)]">
                Cadastro em{' '}
                {new Date(detail.business.createdAt).toLocaleString('pt-BR')}
                {' · '}
                Atualizado em{' '}
                {new Date(detail.business.updatedAt).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="flex gap-2">
              {detail.business.status === 'pending' && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act('approve')}
                    className="min-h-10 rounded-[10px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act('reject')}
                    className="min-h-10 rounded-[10px] border border-[var(--color-hairline)] px-4 text-[14px] font-semibold disabled:opacity-60"
                  >
                    Recusar
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDeleteError(null);
                  setConfirmDelete(true);
                }}
                className="min-h-10 rounded-[10px] border border-[var(--color-hairline)] px-4 text-[14px] font-semibold text-[var(--color-danger)] disabled:opacity-60"
              >
                Excluir
              </button>
            </div>
          </header>

          {tab !== 'config' && (error || toast) && (
            <div className="mb-4">
              {error && (
                <p className="text-[13px] text-[var(--color-danger)]" role="alert">
                  {error}
                </p>
              )}
              {toast && (
                <p className="text-[13px] text-[var(--color-primary-600)]">
                  {toast}
                </p>
              )}
            </div>
          )}

          <div
            className="mb-6 flex gap-1 border-b border-[var(--color-hairline)]"
            role="tablist"
            aria-label="Seções do estabelecimento"
          >
            {BUSINESS_TABS.map((item) => {
              const selected = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${item.id}`}
                  onClick={() => setTab(item.id)}
                  className={`-mb-px min-h-11 border-b-2 px-4 text-[14px] font-semibold ${
                    selected
                      ? 'border-[var(--color-primary-500)] text-[var(--color-ink)]'
                      : 'border-transparent text-[var(--color-neutral-500)]'
                  }`}
                >
                  {item.label}
                  {item.id === 'campaigns' && detail.stats.campaigns > 0 && (
                    <span className="ml-1.5 font-medium text-[var(--color-neutral-400)]">
                      {detail.stats.campaigns}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {tab === 'metrics' && (
          <div
            id="panel-metrics"
            role="tabpanel"
            aria-labelledby="tab-metrics"
          >
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              {
                label: 'Clientes',
                value: String(detail.stats.customers),
                onClick: () =>
                  document
                    .getElementById('clientes')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
              },
              {
                label: 'Campanhas ativas',
                value: `${detail.stats.activeCampaigns} de ${detail.stats.campaigns}`,
                onClick: () => setTab('campaigns'),
              },
              {
                label: 'Acúmulos · 30 dias',
                value: String(detail.stats.earns30d),
              },
              {
                label: 'Resgates · 30 dias',
                value: String(detail.stats.redeems30d),
              },
              {
                label: 'Compras · 30 dias',
                value: (detail.stats.spendCents30d / 100).toLocaleString(
                  'pt-BR',
                  { style: 'currency', currency: 'BRL' },
                ),
              },
              {
                label: 'Última atividade',
                value: detail.stats.lastActivityAt
                  ? new Date(detail.stats.lastActivityAt).toLocaleString(
                      'pt-BR',
                      {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )
                  : 'Sem movimento',
              },
            ].map((kpi) => {
              const card = (
                <div className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card)]">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                    {kpi.label}
                  </p>
                  <p className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">
                    {kpi.value}
                  </p>
                </div>
              );
              return 'onClick' in kpi && kpi.onClick ? (
                <button
                  key={kpi.label}
                  type="button"
                  onClick={kpi.onClick}
                  className="block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
                >
                  {card}
                </button>
              ) : (
                <div key={kpi.label}>{card}</div>
              );
            })}
          </div>

          <BusinessCustomers key={id} businessId={id} />
          </div>
          )}

          {tab === 'campaigns' && (
          <div
            id="panel-campaigns"
            role="tabpanel"
            aria-labelledby="tab-campaigns"
          >
          {editingCampaign && (
              <CampaignEditor
                key={editingCampaign.id}
                businessId={id}
                campaign={editingCampaign}
                audiences={detail.audiences ?? []}
                getToken={getToken}
                onClose={() => setEditingCampaignId(null)}
                onSaved={() => {
                  setEditingCampaignId(null);
                  setToast('Campanha salva');
                  void load();
                }}
              />
            )}
          <section className="overflow-hidden rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-end justify-between gap-2 px-5 pt-5">
              <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                Campanhas
              </p>
              <p className="text-[13px] text-[var(--color-neutral-500)]">
                {detail.stats.activeCampaigns} ativa
                {detail.stats.activeCampaigns === 1 ? '' : 's'} de{' '}
                {detail.stats.campaigns}
              </p>
            </div>
            {detail.campaigns.length === 0 ? (
              <p className="px-5 py-4 text-[14px] text-[var(--color-neutral-500)]">
                Nenhuma campanha.
              </p>
            ) : (
              <ul className="mt-3">
                {detail.campaigns.map((campaign) => {
                  const rules = campaignRules(campaign);
                  return (
                    <li
                      key={campaign.id}
                      className="border-t border-[var(--color-hairline)] px-5 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[16px] font-semibold">
                            {campaign.name}
                          </p>
                          <p className="mt-0.5 text-[13px] text-[var(--color-neutral-500)]">
                            {CAMPAIGN_TYPE_LABEL[campaign.type] ?? campaign.type}
                          </p>
                        </div>
                        <span className="rounded-[6px] bg-[var(--color-bg)] px-2 py-0.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-500)]">
                          {CAMPAIGN_STATUS_LABEL[campaign.status] ??
                            campaign.status}
                        </span>
                      </div>
                      {(campaign.rewardTitle || campaign.rewardDescription) && (
                        <p className="mt-2 text-[14px] text-[var(--color-neutral-700)]">
                          {campaign.rewardTitle}
                          {campaign.rewardTitle && campaign.rewardDescription
                            ? ' — '
                            : ''}
                          {campaign.rewardDescription}
                        </p>
                      )}
                      {rules.length > 0 && (
                        <p className="mt-2 text-[13px] text-[var(--color-neutral-500)]">
                          {rules.join(' · ')}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[13px] tabular-nums text-[var(--color-neutral-700)]">
                          {campaign.earns30d} acúmulos · {campaign.redeems30d}{' '}
                          resgates · 30 dias
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCampaignId(campaign.id);
                            setError(null);
                            setToast(null);
                          }}
                          className="min-h-9 rounded-[8px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold"
                        >
                          {editingCampaignId === campaign.id
                            ? 'Editando'
                            : 'Ver e editar'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {detail.stats.campaigns > detail.campaigns.length && (
              <p className="border-t border-[var(--color-hairline)] px-5 py-3 text-[13px] text-[var(--color-neutral-500)]">
                Mostrando {detail.campaigns.length} de {detail.stats.campaigns}.
              </p>
            )}
          </section>
          </div>
          )}

          {tab === 'config' && (
          <div
            id="panel-config"
            role="tabpanel"
            aria-labelledby="tab-config"
            className="flex max-w-2xl flex-col gap-5"
          >
          <section className="flex items-center justify-between gap-4 rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <div>
              <p className="text-[16px] font-semibold">Visível na exploração</p>
              <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
                Aparece na aba Explorar do app. Começa desligado.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={explorationVisible}
              aria-label="Visível na exploração"
              disabled={visibilitySaving}
              onClick={() => void setVisible(!explorationVisible)}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                explorationVisible
                  ? 'bg-[var(--color-primary-500)]'
                  : 'bg-[var(--color-neutral-200)]'
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  explorationVisible ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </section>

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                Perfil
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px] text-[22px] font-bold text-white"
                  style={logoUrl ? undefined : { background: primaryColor }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    letter
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold">{name || 'Loja'}</p>
                  <p className="text-[13px] text-[var(--color-neutral-500)]">
                    {slogan || 'Sem slogan'}
                  </p>
                </div>
              </div>
              {heroImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroImageUrl}
                  alt="Capa"
                  className="mt-4 aspect-[16/9] w-full rounded-[12px] object-cover"
                />
              )}
            </section>

            <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABEL[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
              Nome
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                required
              />
            </label>

            <BusinessTypePicker value={type} onChange={setType} />

            <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
              Slogan
              <input
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
              CNPJ
              <input
                inputMode="numeric"
                value={cnpj}
                onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                className={inputClass}
                placeholder="00.000.000/0000-00"
              />
            </label>

            <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
              Slug
              <input
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                  )
                }
                className={`${inputClass} font-mono text-[15px]`}
                placeholder="bloom-coffee"
              />
            </label>

            <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
              Logo (URL)
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className={inputClass}
                placeholder="https://…"
              />
            </label>

            <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
              Capa (URL)
              <input
                value={heroImageUrl}
                onChange={(e) => setHeroImageUrl(e.target.value)}
                className={inputClass}
                placeholder="https://…"
              />
            </label>

            <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                Unidade e endereço
              </p>
              {locations.length === 0 ? (
                <p className="mt-3 text-[14px] text-[var(--color-neutral-500)]">
                  Nenhuma unidade cadastrada.
                </p>
              ) : (
                <div className="mt-4 flex flex-col gap-5">
                  {locations.map((loc, index) => (
                    <div
                      key={loc.id}
                      className={
                        locations.length > 1
                          ? 'border-t border-[var(--color-hairline)] pt-4 first:border-t-0 first:pt-0'
                          : undefined
                      }
                    >
                      {locations.length > 1 && (
                        <p className="mb-3 text-[12px] font-semibold text-[var(--color-neutral-400)]">
                          Unidade {index + 1}
                        </p>
                      )}
                      <label className="block text-[13px] font-semibold uppercase tracking-[0.04em]">
                        Nome da unidade
                        <input
                          value={loc.name}
                          onChange={(e) =>
                            setLocationField(loc.id, 'name', e.target.value)
                          }
                          className={inputClass}
                          required
                          minLength={2}
                        />
                      </label>
                      <label className="mt-3.5 block text-[13px] font-semibold uppercase tracking-[0.04em]">
                        Endereço
                        <input
                          value={loc.address}
                          onChange={(e) =>
                            setLocationField(loc.id, 'address', e.target.value)
                          }
                          className={inputClass}
                          required
                          minLength={5}
                        />
                      </label>
                      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[14px] font-semibold">
                        <input
                          type="checkbox"
                          checked={loc.isOpen}
                          onChange={(e) =>
                            setLocations((prev) =>
                              prev.map((item) =>
                                item.id === loc.id
                                  ? { ...item, isOpen: e.target.checked }
                                  : item,
                              ),
                            )
                          }
                          className="h-4 w-4"
                        />
                        Unidade aberta
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </section>

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
                Reais gastos para ganhar 1 ponto. Ex.: 10 = R$ 10,00 → 1 pt.
              </span>
            </label>

            <p className="text-[13px] text-[var(--color-neutral-500)]">
              A porcentagem de cashback é definida em cada campanha no painel
              do estabelecimento.
            </p>

            <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                Validade de carimbos, pontos e cashback
              </p>
              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold">
                    <input
                      type="checkbox"
                      checked={stampsExpireEnabled}
                      onChange={(e) =>
                        setStampsExpireEnabled(e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    Carimbos expiram
                  </label>
                  {stampsExpireEnabled && (
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={stampsExpireDays}
                      onChange={(e) =>
                        setStampsExpireDays(
                          Math.max(1, Number(e.target.value) || 1),
                        )
                      }
                      className={inputClass}
                    />
                  )}
                </div>
                <div>
                  <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold">
                    <input
                      type="checkbox"
                      checked={pointsExpireEnabled}
                      onChange={(e) =>
                        setPointsExpireEnabled(e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    Pontos expiram
                  </label>
                  {pointsExpireEnabled && (
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={pointsExpireDays}
                      onChange={(e) =>
                        setPointsExpireDays(
                          Math.max(1, Number(e.target.value) || 1),
                        )
                      }
                      className={inputClass}
                    />
                  )}
                </div>
                <div>
                  <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold">
                    <input
                      type="checkbox"
                      checked={cashbackExpireEnabled}
                      onChange={(e) =>
                        setCashbackExpireEnabled(e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    Cashback expira
                  </label>
                  {cashbackExpireEnabled && (
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={cashbackExpireDays}
                      onChange={(e) =>
                        setCashbackExpireDays(
                          Math.max(1, Number(e.target.value) || 1),
                        )
                      }
                      className={inputClass}
                    />
                  )}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
                Cor primária
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-11 w-14 cursor-pointer rounded-[8px] border border-[var(--color-neutral-200)] bg-transparent p-1"
                  />
                  <input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="min-h-11 flex-1 rounded-[8px] border border-[var(--color-neutral-200)] px-3 font-mono text-[14px]"
                  />
                </div>
              </label>
              <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
                Cor (pressionado)
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColorDark}
                    onChange={(e) => setPrimaryColorDark(e.target.value)}
                    className="h-11 w-14 cursor-pointer rounded-[8px] border border-[var(--color-neutral-200)] bg-transparent p-1"
                  />
                  <input
                    value={primaryColorDark}
                    onChange={(e) => setPrimaryColorDark(e.target.value)}
                    className="min-h-11 flex-1 rounded-[8px] border border-[var(--color-neutral-200)] px-3 font-mono text-[14px]"
                  />
                </div>
              </label>
            </div>

            {error && (
              <p className="text-[13px] text-[var(--color-danger)]" role="alert">
                {error}
              </p>
            )}
            {toast && (
              <p className="text-[13px] text-[var(--color-primary-600)]">
                {toast}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-[12px] bg-[var(--color-primary-500)] text-[15px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </form>

          <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
              Equipe
            </p>
            {detail.team.length === 0 ? (
              <p className="mt-3 text-[14px] text-[var(--color-neutral-500)]">
                Nenhum membro.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {detail.team.map((member) => (
                  <li key={member.id} className="text-[14px]">
                    <span className="font-semibold">
                      {member.displayName ?? '—'}
                    </span>{' '}
                    <span className="text-[var(--color-neutral-500)]">
                      {member.email}
                    </span>
                    <span className="ml-2 text-[12px] uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                      {ROLE_LABEL[member.role] ?? member.role} · {member.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
              Cobrança
            </p>
            {detail.billing ? (
              <p className="mt-3 text-[14px] text-[var(--color-neutral-700)]">
                Plano {detail.billing.plan?.name ?? '—'} ·{' '}
                {STATUS_LABEL[detail.billing.status] ?? detail.billing.status} ·{' '}
                {(detail.billing.mrrCents / 100).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}{' '}
                MRR
              </p>
            ) : (
              <p className="mt-3 text-[14px] text-[var(--color-neutral-500)]">
                Sem conta de cobrança.
              </p>
            )}
          </section>

          <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
              WhatsApp
            </p>
            {detail.whatsapp ? (
              <div className="mt-3 text-[14px] text-[var(--color-neutral-700)]">
                <p>
                  {WHATSAPP_STATUS_LABEL[detail.whatsapp.status] ??
                    detail.whatsapp.status}
                  {detail.whatsapp.displayPhoneNumber
                    ? ` · ${detail.whatsapp.displayPhoneNumber}`
                    : ''}
                  {detail.whatsapp.verifiedName
                    ? ` · ${detail.whatsapp.verifiedName}`
                    : ''}
                </p>
                <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
                  {detail.whatsapp.qualityRating
                    ? `Qualidade ${detail.whatsapp.qualityRating}`
                    : 'Sem nota de qualidade'}
                  {detail.whatsapp.coexistence ? ' · coexistência' : ''}
                  {' · '}
                  conectado em{' '}
                  {new Date(detail.whatsapp.connectedAt).toLocaleString('pt-BR')}
                </p>
                {detail.whatsapp.lastError ? (
                  <p className="mt-1 text-[13px] text-[var(--color-danger)]">
                    {detail.whatsapp.lastError}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-[14px] text-[var(--color-neutral-500)]">
                Não conectado.
              </p>
            )}
          </section>
          </div>
          )}

        </>
      )}
      {confirmDelete && detail && (
        <DeleteBusinessDialog
          name={detail.business.name}
          busy={busy}
          error={deleteError}
          onCancel={() => {
            if (busy) return;
            setConfirmDelete(false);
            setDeleteError(null);
          }}
          onConfirm={() => void remove()}
        />
      )}
    </AdminShell>
  );
}
