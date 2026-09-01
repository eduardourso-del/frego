'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api';
import { BusinessTypePicker } from '@/components/business-type-picker';
import {
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_TYPE_LABEL,
  ROLE_LABEL,
  STATUS_LABEL,
  STATUS_OPTIONS,
  WHATSAPP_STATUS_LABEL,
} from '@/lib/labels';

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
    logoUrl: string | null;
    heroImageUrl: string | null;
    primaryColor: string;
    primaryColorDark: string;
    slogan: string | null;
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
  campaigns: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    stampsNeeded: number | null;
    rewardTitle: string | null;
  }>;
  stats: {
    customers: number;
    stamps: number;
    redeems: number;
    campaigns: number;
  };
};

const inputClass =
  'mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[16px] font-normal normal-case tracking-normal text-[var(--color-ink)]';

function apiErrorMessage(error: string | undefined) {
  if (error === 'SLUG_TAKEN') return 'Este slug já está em uso.';
  if (error === 'LOCATION_NOT_FOUND') return 'Unidade não encontrada.';
  if (error === 'NOT_FOUND') return 'Estabelecimento não encontrado.';
  return error ?? 'Falha ao salvar';
}

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState('café');
  const [status, setStatus] = useState('pending');
  const [slogan, setSlogan] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#24479C');
  const [primaryColorDark, setPrimaryColorDark] = useState('#1B3781');
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
    setSlogan(b.slogan ?? '');
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
    if (!id) return;
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
  }, [id, getToken, applyDetail]);

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

  const letter = (name || 'V').trim().charAt(0).toUpperCase();

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
            {detail.business.status === 'pending' && (
              <div className="flex gap-2">
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
              </div>
            )}
          </header>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Clientes', value: detail.stats.customers },
              { label: 'Campanhas', value: detail.stats.campaigns },
              { label: 'Carimbos', value: detail.stats.stamps },
              { label: 'Resgates', value: detail.stats.redeems },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card)]"
              >
                <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                  {kpi.label}
                </p>
                <p className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-5">
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

          <section className="mt-10 max-w-2xl rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
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

          <section className="mt-4 max-w-2xl rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
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

          <section className="mt-4 max-w-2xl rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
              WhatsApp
            </p>
            {detail.whatsapp ? (
              <p className="mt-3 text-[14px] text-[var(--color-neutral-700)]">
                {WHATSAPP_STATUS_LABEL[detail.whatsapp.status] ??
                  detail.whatsapp.status}
                {detail.whatsapp.displayPhoneNumber
                  ? ` · ${detail.whatsapp.displayPhoneNumber}`
                  : ''}
                {detail.whatsapp.verifiedName
                  ? ` · ${detail.whatsapp.verifiedName}`
                  : ''}
                {detail.whatsapp.lastError ? (
                  <span className="mt-1 block text-[13px] text-[var(--color-danger)]">
                    {detail.whatsapp.lastError}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="mt-3 text-[14px] text-[var(--color-neutral-500)]">
                Não conectado.
              </p>
            )}
          </section>

          <section className="mt-4 max-w-2xl rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
              Campanhas
            </p>
            {detail.campaigns.length === 0 ? (
              <p className="mt-3 text-[14px] text-[var(--color-neutral-500)]">
                Nenhuma campanha.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {detail.campaigns.map((campaign) => (
                  <li key={campaign.id} className="text-[14px]">
                    <span className="font-semibold">{campaign.name}</span>
                    <span className="ml-2 text-[var(--color-neutral-500)]">
                      {CAMPAIGN_TYPE_LABEL[campaign.type] ?? campaign.type} ·{' '}
                      {CAMPAIGN_STATUS_LABEL[campaign.status] ??
                        campaign.status}
                      {campaign.rewardTitle ? ` · ${campaign.rewardTitle}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
