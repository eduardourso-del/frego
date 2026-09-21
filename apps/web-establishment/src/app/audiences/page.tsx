'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import {
  AudiencePresetCards,
  campaignCreateHref,
  audienceRulesQuery,
  type AudiencePreset,
} from '@/components/audience-preset-cards';
import { Button, Card, EmptyState } from '@/components/ui';
import { TermInfo } from '@/components/term-info';
import { API_URL } from '@/lib/api';
import { TERM } from '@/lib/term-copy';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { tagChipStyle, type CatalogTag } from '@/lib/tags';

type SpendTier = {
  key: string;
  label: string;
  min: number;
  max: number | null;
  count: number;
};

type SavedAudience = {
  id: string;
  name: string;
  memberCount: number;
  rules?: Record<string, unknown>;
};

type AudienceRulesForm = {
  name: string;
  spendCentsMin: string;
  spendCentsMax: string;
  windowDays: string;
  inactiveDaysMin: string;
  tagIds: string[];
  tagMatch: 'any' | 'all';
  showBadge: boolean;
  badgeTitle: string;
  badgeMessage: string;
};

const emptyBuilder: AudienceRulesForm = {
  name: '',
  spendCentsMin: '200',
  spendCentsMax: '',
  windowDays: '90',
  inactiveDaysMin: '',
  tagIds: [],
  tagMatch: 'any',
  showBadge: true,
  badgeTitle: 'Cliente da casa',
  badgeMessage:
    'A loja reconhece você — desbloqueamos condições especiais para quem volta e faz parte da casa.',
};

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8 last:mb-0">
      <header className="mb-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
          {title}
        </h2>
        {hint ? (
          <p className="mt-1 text-[13px] leading-snug text-[var(--color-neutral-500)]">
            {hint}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export default function AudiencesPage() {
  const { loading: authLoading } = useAuth();
  const {
    authHeaders,
    businessId,
    business,
    loading: businessLoading,
  } = useBusiness();

  const [presets, setPresets] = useState<AudiencePreset[]>([]);
  const [spendTiers, setSpendTiers] = useState<SpendTier[]>([]);
  const [saved, setSaved] = useState<SavedAudience[]>([]);
  const [catalog, setCatalog] = useState<CatalogTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [builder, setBuilder] = useState<AudienceRulesForm>(emptyBuilder);
  const [builderBusy, setBuilderBusy] = useState(false);
  const [builderMsg, setBuilderMsg] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canManage = business?.role !== 'employee';

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const [presetRes, savedRes, tagRes] = await Promise.all([
        fetch(`${API_URL}/audiences/presets`, { headers }),
        fetch(`${API_URL}/audiences`, { headers }),
        fetch(`${API_URL}/tags`, { headers }),
      ]);
      const presetJson = await presetRes.json().catch(() => ({}));
      const savedJson = await savedRes.json().catch(() => ({}));
      const tagJson = await tagRes.json().catch(() => ({}));
      if (!presetRes.ok) {
        throw new Error(
          presetJson.error ?? 'Não foi possível carregar as audiências.',
        );
      }
      if (!savedRes.ok) {
        throw new Error(
          savedJson.error ?? 'Não foi possível carregar as audiências salvas.',
        );
      }
      setPresets(presetJson.presets ?? []);
      setSpendTiers(presetJson.spendTiers ?? []);
      setCatalog(tagRes.ok ? (tagJson.tags ?? []) : []);
      setSaved(
        (savedJson.audiences ?? []).map(
          (a: SavedAudience) => ({
            id: a.id,
            name: a.name,
            memberCount: a.memberCount,
            rules: a.rules,
          }),
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Não foi possível carregar.',
      );
      setPresets([]);
      setSpendTiers([]);
      setSaved([]);
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, businessId]);

  useEffect(() => {
    if (authLoading || businessLoading) return;
    if (
      !businessId ||
      business?.status === 'pending' ||
      business?.status === 'suspended'
    ) {
      setLoading(false);
      return;
    }
    void load();
  }, [
    authLoading,
    businessLoading,
    businessId,
    business?.status,
    load,
  ]);

  const builderRules = useMemo(() => {
    const spendMin = Number.parseFloat(builder.spendCentsMin);
    const spendMax = Number.parseFloat(builder.spendCentsMax);
    const windowDays = Number.parseInt(builder.windowDays, 10);
    const inactive = Number.parseInt(builder.inactiveDaysMin, 10);
    return {
      version: 1 as const,
      spendCentsMin: Number.isFinite(spendMin)
        ? Math.round(spendMin * 100)
        : null,
      spendCentsMax: Number.isFinite(spendMax)
        ? Math.round(spendMax * 100)
        : null,
      windowDays: Number.isFinite(windowDays) ? windowDays : null,
      inactiveDaysMin: Number.isFinite(inactive) ? inactive : null,
      tagIds: builder.tagIds.length > 0 ? builder.tagIds : undefined,
      tagMatch: builder.tagIds.length > 0 ? builder.tagMatch : undefined,
    };
  }, [builder]);

  const atRisk = presets.find((p) => p.key === 'at_risk');

  async function previewAudience() {
    setBuilderBusy(true);
    setBuilderMsg(null);
    try {
      const headers = {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      };
      const res = await fetch(`${API_URL}/audiences/preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rules: builderRules }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Não foi possível estimar.');
      setPreviewCount(json.memberCount as number);
    } catch (e) {
      setBuilderMsg(
        e instanceof Error ? e.message : 'Não foi possível estimar.',
      );
    } finally {
      setBuilderBusy(false);
    }
  }

  async function saveAudience() {
    if (!builder.name.trim()) {
      setBuilderMsg('Informe um nome para a audiência.');
      return;
    }
    setBuilderBusy(true);
    setBuilderMsg(null);
    try {
      const headers = {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      };
      const res = await fetch(`${API_URL}/audiences`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: builder.name.trim(),
          rules: builderRules,
          showBadge: builder.showBadge,
          badgeTitle: builder.showBadge
            ? builder.badgeTitle.trim() || builder.name.trim()
            : null,
          badgeMessage: builder.showBadge
            ? builder.badgeMessage.trim() || null
            : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Não foi possível salvar.');
      setBuilderMsg(
        `Audiência salva · ${json.audience?.memberCount ?? 0} clientes`,
      );
      setBuilder(emptyBuilder);
      setPreviewCount(null);
      await load();
    } catch (e) {
      setBuilderMsg(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBuilderBusy(false);
    }
  }

  async function deleteAudience(id: string) {
    if (!window.confirm('Excluir esta audiência? Campanhas que usam ela ficam para toda a casa.')) {
      return;
    }
    setDeletingId(id);
    setBuilderMsg(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/audiences/${id}`, {
        method: 'DELETE',
        headers,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Não foi possível excluir.');
      setSaved((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setBuilderMsg(e instanceof Error ? e.message : 'Não foi possível excluir.');
    } finally {
      setDeletingId(null);
    }
  }

  const topbar = (
    <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-[var(--color-hairline)] bg-[var(--color-card)] px-5 md:px-7">
      <h1 className="text-[17px] font-semibold text-[var(--color-ink)]">
        <TermInfo info={TERM.audiencia}>Audiências</TermInfo>
      </h1>
    </header>
  );

  const busy = loading || authLoading || businessLoading;

  return (
    <AppShell businessName={business?.name} title="Audiências" topbar={topbar}>
      <div className="mx-auto min-w-0 max-w-6xl px-4 py-5 md:px-7 md:py-6">
        <div className="mb-6 md:hidden">
          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
            <TermInfo info={TERM.audiencia}>Audiências</TermInfo>
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
            Recortes da casa para filtrar clientes e criar campanhas.
          </p>
        </div>
        <p className="mb-6 hidden text-[14px] text-[var(--color-neutral-500)] md:block">
          Recortes da casa para filtrar clientes e criar campanhas.
        </p>

        {busy ? (
          <p className="text-[15px] text-[var(--color-neutral-500)]">
            Carregando…
          </p>
        ) : error ? (
          <Card>
            <p className="text-[15px] text-[var(--color-danger)]">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 text-[14px] font-semibold text-[var(--color-primary-500)]"
            >
              Tentar novamente
            </button>
          </Card>
        ) : (
          <>
            {atRisk && atRisk.memberCount > 0 ? (
              <div className="mb-8 rounded-[14px] border border-[var(--color-primary-200)] bg-[var(--color-primary-50)] px-4 py-3.5">
                <p className="text-[14px] font-semibold text-[var(--color-ink)]">
                  Alto valor em risco: {atRisk.memberCount}
                </p>
                <p className="mt-1 text-[13px] text-[var(--color-neutral-600)]">
                  {atRisk.memberCount} clientes gastaram bem e estão sem visita
                  há 30 dias ou mais. Crie uma campanha só para eles.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    href={`/customers?${audienceRulesQuery(atRisk.rules)}`}
                    className="text-[13px] font-semibold text-[var(--color-primary-600)]"
                  >
                    Ver clientes →
                  </Link>
                  <Link
                    href={campaignCreateHref(atRisk.rules, 'Alto valor em risco')}
                    className="text-[13px] font-semibold text-[var(--color-primary-600)]"
                  >
                    Criar campanha →
                  </Link>
                </div>
              </div>
            ) : null}

            <Section
              title="Recortes prontos"
              hint="Atalhos de comportamento — veja quem são ou crie uma campanha na hora."
            >
              <AudiencePresetCards presets={presets} />
            </Section>

            <Section
              title="Faixas de gasto"
              hint="Quanto a casa gastou nos últimos 90 dias."
            >
              <Card>
                {spendTiers.length === 0 ? (
                  <p className="text-[13px] text-[var(--color-neutral-500)]">
                    Ainda sem gasto registrado no período.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {spendTiers.map((t) => {
                      const max = Math.max(
                        1,
                        ...spendTiers.map((x) => x.count),
                      );
                      const pct = Math.round((t.count / max) * 100);
                      return (
                        <div key={t.key} className="flex items-center gap-3">
                          <span className="w-28 shrink-0 text-[12px] text-[var(--color-neutral-500)]">
                            {t.label}
                          </span>
                          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                            <div
                              className="h-full rounded-full bg-[var(--color-primary-500)]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-[12px] font-semibold tabular-nums text-[var(--color-ink)]">
                            {t.count}
                          </span>
                          <Link
                            href={`/customers?spendCentsMin=${t.min}${t.max != null ? `&spendCentsMax=${t.max - 1}` : ''}&windowDays=90`}
                            className="text-[11px] font-semibold text-[var(--color-primary-500)]"
                          >
                            Ver
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </Section>

            <Section
              title="Suas audiências"
              hint="Salvas para reusar em campanhas e no filtro de Clientes."
            >
              {saved.length === 0 ? (
                <EmptyState
                  title="Nenhuma audiência salva"
                  description="Crie um recorte por gasto ou tempo sem visita. Depois é só filtrar em Clientes ou apontar uma campanha."
                />
              ) : (
                <Card padding="none">
                  <ul className="divide-y divide-[var(--color-hairline)]">
                    {saved.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3"
                      >
                        <span className="min-w-0 flex-1 font-medium text-[var(--color-ink)]">
                          {s.name}
                          {Array.isArray(s.rules?.tagIds) &&
                          (s.rules?.tagIds as string[]).length > 0 ? (
                            <span className="mt-0.5 block text-[12px] font-normal text-[var(--color-neutral-400)]">
                              Etiquetas:{' '}
                              {(s.rules?.tagIds as string[])
                                .map(
                                  (id) =>
                                    catalog.find((t) => t.id === id)?.name ??
                                    'etiqueta',
                                )
                                .join(', ')}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[13px] tabular-nums text-[var(--color-neutral-500)]">
                          {s.memberCount} cliente
                          {s.memberCount === 1 ? '' : 's'}
                        </span>
                        <Link
                          href={`/customers?audienceId=${s.id}`}
                          className="text-[13px] font-semibold text-[var(--color-primary-500)]"
                        >
                          Ver
                        </Link>
                        <Link
                          href={`/campaigns?compose=1&audienceId=${s.id}`}
                          className="text-[13px] font-semibold text-[var(--color-primary-500)]"
                        >
                          Campanha
                        </Link>
                        {canManage ? (
                          <button
                            type="button"
                            disabled={deletingId === s.id}
                            onClick={() => void deleteAudience(s.id)}
                            className="text-[13px] font-semibold text-[var(--color-neutral-400)] hover:text-[var(--color-danger)] disabled:opacity-50"
                          >
                            Excluir
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </Section>

            {canManage ? (
              <Section
                title="Nova audiência"
                hint="Defina gasto, janela e, se quiser, um selo no app."
              >
                <Card>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="text-[12px] font-medium text-[var(--color-neutral-500)] lg:col-span-1">
                      Nome
                      <input
                        value={builder.name}
                        onChange={(e) =>
                          setBuilder((b) => ({ ...b, name: e.target.value }))
                        }
                        placeholder="Ex.: clientes a partir de R$ 200"
                        className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-2.5 text-[14px]"
                      />
                    </label>
                    <label className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                      Gasto mínimo (R$)
                      <input
                        type="number"
                        min={0}
                        value={builder.spendCentsMin}
                        onChange={(e) =>
                          setBuilder((b) => ({
                            ...b,
                            spendCentsMin: e.target.value,
                          }))
                        }
                        className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-2.5 text-[14px]"
                      />
                    </label>
                    <label className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                      Gasto máximo (R$)
                      <input
                        type="number"
                        min={0}
                        value={builder.spendCentsMax}
                        onChange={(e) =>
                          setBuilder((b) => ({
                            ...b,
                            spendCentsMax: e.target.value,
                          }))
                        }
                        placeholder="opcional"
                        className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-2.5 text-[14px]"
                      />
                    </label>
                    <label className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                      Janela (dias)
                      <input
                        type="number"
                        min={1}
                        value={builder.windowDays}
                        onChange={(e) =>
                          setBuilder((b) => ({
                            ...b,
                            windowDays: e.target.value,
                          }))
                        }
                        className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-2.5 text-[14px]"
                      />
                    </label>
                    <label className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                      Inativo há (dias)
                      <input
                        type="number"
                        min={0}
                        value={builder.inactiveDaysMin}
                        onChange={(e) =>
                          setBuilder((b) => ({
                            ...b,
                            inactiveDaysMin: e.target.value,
                          }))
                        }
                        placeholder="opcional"
                        className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-2.5 text-[14px]"
                      />
                    </label>
                  </div>
                  {catalog.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                        Etiquetas (opcional)
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--color-neutral-400)]">
                        Deixe vazio para não filtrar por etiqueta.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {catalog.map((tag) => {
                          const on = builder.tagIds.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                setBuilder((b) => ({
                                  ...b,
                                  tagIds: on
                                    ? b.tagIds.filter((id) => id !== tag.id)
                                    : [...b.tagIds, tag.id],
                                }))
                              }
                              className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                                on
                                  ? 'ring-2 ring-[var(--color-ink)] ring-offset-1'
                                  : 'opacity-70'
                              }`}
                              style={tagChipStyle(tag.color)}
                            >
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                      {builder.tagIds.length > 1 ? (
                        <label className="mt-2 flex items-center gap-2 text-[12px] text-[var(--color-neutral-600)]">
                          <input
                            type="checkbox"
                            checked={builder.tagMatch === 'all'}
                            onChange={(e) =>
                              setBuilder((b) => ({
                                ...b,
                                tagMatch: e.target.checked ? 'all' : 'any',
                              }))
                            }
                          />
                          Precisa ter todas as selecionadas
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-3 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-3">
                    <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-ink)]">
                      <input
                        type="checkbox"
                        checked={builder.showBadge}
                        onChange={(e) =>
                          setBuilder((b) => ({
                            ...b,
                            showBadge: e.target.checked,
                          }))
                        }
                      />
                      Mostrar selo no app do cliente
                    </label>
                    <p className="mt-1 text-[12px] text-[var(--color-neutral-500)]">
                      Quem entra nesta audiência vê, no aplicativo, um selo da
                      loja e a mensagem de que desbloqueou promoções exclusivas.
                    </p>
                    {builder.showBadge ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                          Título do selo
                          <input
                            value={builder.badgeTitle}
                            onChange={(e) =>
                              setBuilder((b) => ({
                                ...b,
                                badgeTitle: e.target.value,
                              }))
                            }
                            placeholder="Cliente da casa"
                            className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-2.5 text-[14px]"
                          />
                        </label>
                        <label className="text-[12px] font-medium text-[var(--color-neutral-500)]">
                          Mensagem
                          <input
                            value={builder.badgeMessage}
                            onChange={(e) =>
                              setBuilder((b) => ({
                                ...b,
                                badgeMessage: e.target.value,
                              }))
                            }
                            placeholder="Você desbloqueou condições exclusivas."
                            className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-2.5 text-[14px]"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      className="min-h-9 px-3 text-[13px]"
                      disabled={builderBusy}
                      onClick={() => void previewAudience()}
                    >
                      Estimar
                    </Button>
                    <Button
                      className="min-h-9 px-3 text-[13px]"
                      disabled={builderBusy}
                      onClick={() => void saveAudience()}
                    >
                      Salvar audiência
                    </Button>
                    <Link
                      href={`/customers?${audienceRulesQuery(builderRules)}`}
                      className="text-[13px] font-semibold text-[var(--color-primary-500)]"
                    >
                      Ver clientes
                    </Link>
                    {previewCount != null ? (
                      <span className="text-[13px] text-[var(--color-neutral-500)]">
                        ≈ {previewCount} clientes
                      </span>
                    ) : null}
                    {builderMsg ? (
                      <span className="text-[13px] text-[var(--color-neutral-600)]">
                        {builderMsg}
                      </span>
                    ) : null}
                  </div>
                </Card>
              </Section>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
