'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Banknote, ClipboardList, Coins, Gift, Stamp, ThumbsUp, Users, type LucideIcon } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  PesquisaPagePreview,
  type PesquisaPreviewInput,
} from '@/components/pesquisa-page-preview';
import type { PesquisaBrand } from '@/components/pesquisa-brand-header';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';

type BonusKind = 'stamps' | 'points' | 'cashback';
type BonusMode = 'fixed' | 'double';
type Status = 'draft' | 'active' | 'archived';
type StatusFilter = 'all' | 'active' | 'inactive';

type Pesquisa = {
  id: string;
  name: string;
  status: Status;
  notePrompt: string | null;
  bonusEnabled: boolean;
  bonusKind: BonusKind | null;
  bonusMode: BonusMode;
  bonusQuantity: number | null;
  bonusCampaignId: string | null;
  bonusCampaignName?: string | null;
  audienceSegmentId: string | null;
  audienceSegmentName?: string | null;
  questions: { position: number; prompt: string }[];
  respostaCount: number;
};

type Destinations = {
  sharedStamps: boolean;
  cartelas: { id: string; name: string }[];
  points: boolean;
  cashback: boolean;
};

type Detail = Pesquisa & {
  counts: { position: number; prompt: string; up: number; down: number }[];
  respostas: {
    id: string;
    note: string | null;
    createdAt: string;
    customerName: string | null;
    phoneE164: string;
    bonusLanded: boolean;
    answers: { position: number; prompt: string; value: 'up' | 'down' }[];
  }[];
};

type FormState = {
  name: string;
  notePrompt: string;
  questions: string[];
  bonusEnabled: boolean;
  bonusKind: BonusKind;
  bonusMode: BonusMode;
  bonusQuantity: string;
  bonusCampaignId: string;
  audienceSegmentId: string;
};

type AudienceOption = { id: string; name: string; memberCount: number };

const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  archived: 'Arquivada',
};

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'active', label: 'Ativas' },
  { key: 'inactive', label: 'Inativas' },
];

const inputClass =
  'mt-1.5 min-h-11 w-full rounded-[12px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[15px] text-[var(--color-ink)] outline-none focus:border-[var(--color-primary-500)]';

const emptyForm = (): FormState => ({
  name: '',
  notePrompt: '',
  questions: ['', '', '', '', ''],
  bonusEnabled: false,
  bonusKind: 'stamps',
  bonusMode: 'fixed',
  bonusQuantity: '1',
  bonusCampaignId: '',
  audienceSegmentId: '',
});

function formFrom(row: Pesquisa): FormState {
  const questions = ['', '', '', '', ''];
  for (const q of row.questions) questions[q.position] = q.prompt;
  const quantity =
    row.bonusKind === 'cashback' && row.bonusQuantity != null
      ? String(row.bonusQuantity / 100).replace('.', ',')
      : row.bonusQuantity != null
        ? String(row.bonusQuantity)
        : '1';
  return {
    name: row.name,
    notePrompt: row.notePrompt ?? '',
    questions,
    bonusEnabled: row.bonusEnabled,
    bonusKind: row.bonusKind ?? 'stamps',
    bonusMode: row.bonusMode === 'double' ? 'double' : 'fixed',
    bonusQuantity: quantity,
    bonusCampaignId: row.bonusCampaignId ?? '',
    audienceSegmentId: row.audienceSegmentId ?? '',
  };
}

function previewFromRow(row: Pesquisa, brand: PesquisaBrand): PesquisaPreviewInput {
  const filled = formFrom(row);
  return {
    businessName: brand.businessName,
    businessType: brand.businessType,
    slogan: brand.slogan,
    logoUrl: brand.logoUrl,
    heroImageUrl: brand.heroImageUrl,
    primaryColor: brand.primaryColor,
    primaryColorDark: brand.primaryColorDark,
    name: filled.name,
    questions: filled.questions,
    notePrompt: filled.notePrompt,
    bonusEnabled: filled.bonusEnabled,
    bonusKind: filled.bonusKind,
    bonusMode: filled.bonusKind === 'stamps' ? 'fixed' : filled.bonusMode,
    bonusQuantity: filled.bonusQuantity,
    cartelaName: row.bonusKind === 'stamps' ? row.bonusCampaignName ?? null : null,
  };
}

function bonusLine(row: Pick<Pesquisa, 'bonusEnabled' | 'bonusKind' | 'bonusMode' | 'bonusQuantity' | 'bonusCampaignName' | 'questions'>) {
  const questions = row.questions.filter((q) => q.prompt.trim()).length;
  const q = questions === 1 ? '1 pergunta' : `${questions} perguntas`;
  if (row.bonusEnabled && row.bonusMode === 'double' && row.bonusKind === 'points') {
    return `${q} · dobra os pontos desta compra`;
  }
  if (row.bonusEnabled && row.bonusMode === 'double' && row.bonusKind === 'cashback') {
    return `${q} · dobra o cashback desta compra`;
  }
  if (!row.bonusEnabled || row.bonusQuantity == null || !row.bonusKind) {
    return `${q} · sem benefício`;
  }
  if (row.bonusKind === 'cashback') {
    const money = (row.bonusQuantity / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    return `${q} · ${money} de cashback`;
  }
  if (row.bonusKind === 'points') {
    const unit = row.bonusQuantity === 1 ? 'ponto' : 'pontos';
    return `${q} · ${row.bonusQuantity} ${unit}`;
  }
  const unit = row.bonusQuantity === 1 ? 'carimbo' : 'carimbos';
  const where = row.bonusCampaignName ? ` na cartela ${row.bonusCampaignName}` : '';
  return `${q} · ${row.bonusQuantity} ${unit}${where}`;
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

const BONUS_TYPES: {
  value: BonusKind;
  title: string;
  Icon: LucideIcon;
  color: string;
  bg: string;
  fill: string;
  onFill: string;
}[] = [
  {
    value: 'stamps',
    title: 'Carimbos',
    Icon: Stamp,
    color: 'var(--color-stamps)',
    bg: 'var(--color-stamps-bg)',
    fill: 'var(--color-stamps)',
    onFill: '#fff',
  },
  {
    value: 'points',
    title: 'Pontos',
    Icon: Coins,
    color: 'var(--color-points)',
    bg: 'var(--color-points-bg)',
    fill: 'var(--color-points)',
    onFill: '#fff',
  },
  {
    value: 'cashback',
    title: 'Cashback',
    Icon: Banknote,
    color: 'var(--color-cashback)',
    bg: 'var(--color-cashback-bg)',
    fill: 'var(--color-cashback)',
    onFill: '#fff',
  },
];

export default function PesquisasPage() {
  const { loading: authLoading } = useAuth();
  const { authHeaders, businessId, business, loading: businessLoading } = useBusiness();
  const canManage = business?.role !== 'employee';

  const [destinations, setDestinations] = useState<Destinations | null>(null);
  const [audiences, setAudiences] = useState<AudienceOption[]>([]);
  const [rows, setRows] = useState<Pesquisa[]>([]);
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState<PesquisaPreviewInput | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const [res, audRes] = await Promise.all([
        fetch(`${API_URL}/pesquisas`, { headers }),
        fetch(`${API_URL}/audiences`, { headers }),
      ]);
      const json = await res.json();
      const audJson = await audRes.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? json.error ?? 'Erro ao carregar');
      setRows((json.pesquisas ?? []) as Pesquisa[]);
      setDestinations(json.destinations ?? null);
      setAudiences(
        (audJson.audiences ?? []).map((a: AudienceOption) => ({
          id: a.id,
          name: a.name,
          memberCount: a.memberCount,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, businessId]);

  const loadDetail = useCallback(
    async (id: string) => {
      if (details[id]) return details[id];
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/pesquisas/${id}`, { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? 'Erro ao carregar');
      const detail = json as Detail;
      setDetails((current) => ({ ...current, [id]: detail }));
      return detail;
    },
    [authHeaders, details],
  );

  useEffect(() => {
    if (authLoading || businessLoading) return;
    void loadList();
  }, [authLoading, businessLoading, loadList]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter === 'active') return row.status === 'active';
      if (statusFilter === 'inactive') return row.status !== 'active';
      return true;
    });
  }, [rows, statusFilter]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((row) => row.status === 'active').length,
      inactive: rows.filter((row) => row.status !== 'active').length,
    }),
    [rows],
  );

  const hasOpen = rows.some((row) => row.status !== 'archived');
  const selectedAudience =
    audiences.find((audience) => audience.id === form.audienceSegmentId) ?? null;
  const brand: PesquisaBrand = {
    businessName: business?.name ?? '',
    businessType: business?.type,
    slogan: business?.slogan,
    logoUrl: business?.logoUrl,
    heroImageUrl: business?.heroImageUrl,
    primaryColor: business?.primaryColor,
    primaryColorDark: business?.primaryColorDark,
  };

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
    setError(null);
  }

  function openEdit(row: Pesquisa) {
    setEditingId(row.id);
    setForm(formFrom(row));
    setShowForm(true);
    setError(null);
  }

  async function save(status: 'draft' | 'active', next = form, id = editingId) {
    setSaving(true);
    setError(null);
    const questions = next.questions
      .map((prompt) => prompt.trim())
      .filter(Boolean)
      .map((prompt) => ({ prompt }));
    const doubled =
      next.bonusEnabled &&
      next.bonusMode === 'double' &&
      (next.bonusKind === 'points' || next.bonusKind === 'cashback');
    let bonusQuantity: number | null = null;
    if (next.bonusEnabled && !doubled) {
      const parsed = Number(next.bonusQuantity.replace(',', '.'));
      bonusQuantity =
        next.bonusKind === 'cashback' ? Math.round(parsed * 100) : Math.round(parsed);
    }
    const body = {
      name: next.name.trim(),
      notePrompt: next.notePrompt.trim() || null,
      questions,
      bonusEnabled: next.bonusEnabled,
      bonusKind: next.bonusEnabled ? next.bonusKind : null,
      bonusMode: doubled ? 'double' : 'fixed',
      bonusQuantity: next.bonusEnabled && !doubled ? bonusQuantity : null,
      bonusCampaignId:
        next.bonusEnabled && next.bonusKind === 'stamps' && next.bonusCampaignId
          ? next.bonusCampaignId
          : null,
      audienceSegmentId: next.audienceSegmentId || null,
      status,
    };
    try {
      const headers = {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      };
      const res = await fetch(id ? `${API_URL}/pesquisas/${id}` : `${API_URL}/pesquisas`, {
        method: id ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? 'Não foi possível salvar');
      setDetails((current) => ({ ...current, [json.id]: json as Detail }));
      closeForm();
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  }

  async function archive(id: string) {
    setSaving(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/pesquisas/${id}/archive`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? 'Não foi possível arquivar');
      setDetails((current) => ({ ...current, [id]: json as Detail }));
      if (editingId === id) closeForm();
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível arquivar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleRespostas(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    try {
      await loadDetail(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    }
  }

  return (
    <AppShell title="Pesquisa">
      <div className="px-4 py-5 md:px-7 md:py-6">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-[26px] font-semibold tracking-[-0.03em] text-[var(--color-ink)] md:text-[28px]">
              Pesquisa
              <span className="rounded-full bg-[var(--color-neutral-100)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-500)]">
                Beta
              </span>
            </h1>
            <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-[var(--color-neutral-500)] md:text-[15px]">
              Até cinco perguntas de polegar e uma nota. O cliente responde uma vez, no app ou pelo link.
            </p>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={() => (showForm ? closeForm() : openCreate())}
              disabled={!showForm && hasOpen}
              className="min-h-11 w-full rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[15px] font-semibold text-white shadow-[var(--shadow-cta)] transition-[transform,background] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {showForm ? 'Cancelar' : 'Nova pesquisa'}
            </button>
          ) : null}
        </header>

        {error ? (
          <p className="mb-4 text-[13px] text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        ) : null}

        {showForm && canManage ? (
          <form
            className="mb-8"
            onSubmit={(event) => {
              event.preventDefault();
              void save('active');
            }}
          >
            <div className="mb-4">
              <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                {editingId ? 'Editar pesquisa' : 'Nova pesquisa'}
              </h2>
              <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
                As perguntas, a nota e o benefício.
              </p>
            </div>
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-3">
              <Section Icon={ClipboardList} title="A pesquisa" hint="O cliente vê o nome e as perguntas.">
                <label className="block text-[13px] font-semibold text-[var(--color-ink)]">
                  Nome
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputClass}
                    required
                  />
                </label>
                <div className="mt-3 flex flex-col gap-3">
                  {form.questions.map((prompt, index) => (
                    <label key={index} className="block text-[13px] font-semibold text-[var(--color-ink)]">
                      Pergunta {index + 1}
                      <input
                        value={prompt}
                        onChange={(e) => {
                          const questions = [...form.questions];
                          questions[index] = e.target.value;
                          setForm({ ...form, questions });
                        }}
                        className={inputClass}
                        placeholder={index === 0 ? 'Obrigatória para ativar' : 'Opcional'}
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-3 block text-[13px] font-semibold text-[var(--color-ink)]">
                  Nota
                  <input
                    value={form.notePrompt}
                    onChange={(e) => setForm({ ...form, notePrompt: e.target.value })}
                    placeholder="Em branco, o cliente não vê o campo"
                    className={inputClass}
                  />
                </label>
              </Section>

              <Section Icon={Gift} title="O benefício" hint="Um crédito, numa carteira. Sem ele, qualquer compra abre o Convite.">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[12px] border border-[var(--color-hairline)] px-3 py-2.5">
                  <span>
                    <span className="block text-[13px] font-semibold text-[var(--color-ink)]">
                      Dar um benefício
                    </span>
                    <span className="text-[12px] text-[var(--color-neutral-500)]">
                      Quem responde ganha esse crédito uma vez.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.bonusEnabled}
                    onChange={(e) => setForm({ ...form, bonusEnabled: e.target.checked })}
                    className="h-5 w-5 accent-[var(--color-primary-500)]"
                  />
                </label>
                {form.bonusEnabled ? (
                  <div className="mt-3">
                    <div className="grid grid-cols-3 gap-2">
                      {BONUS_TYPES.map((opt) => {
                        const selected = form.bonusKind === opt.value;
                        const Icon = opt.Icon;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                bonusKind: opt.value,
                                bonusCampaignId: '',
                                bonusMode: opt.value === 'stamps' ? 'fixed' : form.bonusMode,
                              })
                            }
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
                              className="flex h-9 w-9 items-center justify-center rounded-[10px]"
                              style={{
                                background: selected ? opt.fill : 'var(--color-neutral-200)',
                                color: selected ? opt.onFill : 'var(--color-neutral-500)',
                              }}
                            >
                              <Icon size={18} strokeWidth={2.25} />
                            </span>
                            <span
                              className="text-center text-[11px] font-semibold leading-tight"
                              style={{ color: selected ? opt.color : 'var(--color-ink)' }}
                            >
                              {opt.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[12px] text-[var(--color-neutral-500)]">
                      Só quem ganhou essa carteira nesta compra pode responder.
                    </p>
                    {form.bonusKind === 'points' || form.bonusKind === 'cashback' ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(
                          [
                            ['double', 'Dobrar a compra'],
                            ['fixed', 'Valor fixo'],
                          ] as const
                        ).map(([mode, label]) => {
                          const selected = form.bonusMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setForm({ ...form, bonusMode: mode })}
                              className={`min-h-11 rounded-[12px] border px-3 text-[13px] font-semibold ${
                                selected
                                  ? 'border-[var(--color-ink)] bg-[var(--color-bg)] text-[var(--color-ink)]'
                                  : 'border-[var(--color-hairline)] text-[var(--color-neutral-500)]'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    {form.bonusMode === 'double' && form.bonusKind !== 'stamps' ? (
                      <p className="mt-2 text-[12px] leading-snug text-[var(--color-neutral-500)]">
                        {form.bonusKind === 'cashback'
                          ? 'Ela ganhou R$ 5,00 de cashback nesta compra e responde: entram mais R$ 5,00. Uma compra sem cashback não leva benefício.'
                          : 'Ela ganhou 20 pontos nesta compra e responde: entram mais 20. Uma compra sem pontos não leva benefício.'}
                      </p>
                    ) : (
                      <label className="mt-3 block text-[13px] font-semibold text-[var(--color-ink)]">
                        {form.bonusKind === 'cashback'
                          ? 'Reais a mais'
                          : form.bonusKind === 'points'
                            ? 'Pontos a mais'
                            : 'Carimbos a mais'}
                        <input
                          value={form.bonusQuantity}
                          onChange={(e) => setForm({ ...form, bonusQuantity: e.target.value })}
                          inputMode="decimal"
                          className={inputClass}
                        />
                        {form.bonusKind === 'cashback' ? (
                          <span className="mt-1 block text-[12px] font-medium text-[var(--color-neutral-500)]">
                            1 vale R$ 1,00, creditado uma vez. Não dobra a compra.
                          </span>
                        ) : null}
                      </label>
                    )}
                    {form.bonusKind === 'stamps' ? (
                      <label className="mt-3 block text-[13px] font-semibold text-[var(--color-ink)]">
                        Destino
                        <select
                          value={form.bonusCampaignId}
                          onChange={(e) => setForm({ ...form, bonusCampaignId: e.target.value })}
                          className={inputClass}
                        >
                          <option value="">Carimbos compartilhados</option>
                          {(destinations?.cartelas ?? []).map((cartela) => (
                            <option key={cartela.id} value={cartela.id}>
                              Cartela {cartela.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                ) : null}
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
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[var(--color-ink)]">Audiência</span>
                  <Link
                    href="/audiences"
                    className="text-[12px] font-semibold text-[var(--color-primary-500)]"
                  >
                    Gerenciar
                  </Link>
                </div>
                <select
                  value={form.audienceSegmentId}
                  onChange={(e) => setForm({ ...form, audienceSegmentId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Todos os clientes</option>
                  {audiences.map((audience) => (
                    <option key={audience.id} value={audience.id}>
                      {audience.name} ({audience.memberCount})
                    </option>
                  ))}
                </select>
              </Section>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[15px] font-semibold text-white shadow-[var(--shadow-cta)] disabled:opacity-60"
                >
                  Ativar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save('draft')}
                  className="min-h-11 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-card)] px-4 text-[15px] font-semibold text-[var(--color-ink)] disabled:opacity-60"
                >
                  Salvar rascunho
                </button>
              </div>
            </div>
            <div className="lg:sticky lg:top-4">
              <PesquisaPagePreview
                input={{
                  ...brand,
                  name: form.name,
                  questions: form.questions,
                  notePrompt: form.notePrompt,
                  bonusEnabled: form.bonusEnabled,
                  bonusKind: form.bonusKind,
                  bonusMode: form.bonusKind === 'stamps' ? 'fixed' : form.bonusMode,
                  bonusQuantity: form.bonusQuantity,
                  cartelaName:
                    form.bonusKind === 'stamps' && form.bonusCampaignId
                      ? (destinations?.cartelas.find((cartela) => cartela.id === form.bonusCampaignId)
                          ?.name ?? null)
                      : null,
                }}
              />
            </div>
            </div>
          </form>
        ) : null}

        {!showForm ? (
          <>
            <div
              className="mb-5 flex gap-1 overflow-x-auto rounded-[14px] bg-[var(--color-neutral-100)] p-1"
              role="tablist"
              aria-label="Filtrar por status"
            >
              {FILTERS.map((filter) => {
                const selected = statusFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setStatusFilter(filter.key)}
                    className={`min-h-9 shrink-0 rounded-[11px] px-3.5 text-[13px] font-semibold transition-all ${
                      selected
                        ? 'bg-[var(--color-card)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(16,24,40,0.08)]'
                        : 'text-[var(--color-neutral-500)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    {filter.label}
                    {!loading ? (
                      <span className="ml-1.5 font-medium text-[var(--color-neutral-400)]">
                        {counts[filter.key]}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {loading ? (
              <p className="text-[15px] text-[var(--color-neutral-500)]">Carregando…</p>
            ) : rows.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-[var(--color-neutral-200)] p-8 text-center">
                <p className="text-[15px] text-[var(--color-neutral-500)]">
                  Nenhuma pesquisa ainda. Crie as perguntas e, se quiser, um benefício.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-[var(--color-neutral-200)] p-8 text-center">
                <p className="text-[15px] text-[var(--color-neutral-500)]">
                  Nenhuma pesquisa neste filtro.{' '}
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
                {filtered.map((row) => {
                  const detail = details[row.id];
                  const open = openId === row.id;
                  return (
                    <li
                      key={row.id}
                      className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-[17px] font-semibold">{row.name}</h2>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-50)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-primary-600)] ring-1 ring-inset ring-[var(--color-primary-200)]">
                              <ThumbsUp size={13} strokeWidth={2.25} aria-hidden />
                              Pesquisa
                            </span>
                            <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-neutral-600)] ring-1 ring-inset ring-[var(--color-hairline)]">
                              {STATUS_LABEL[row.status] ?? row.status}
                            </span>
                            {row.audienceSegmentName ? (
                              <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-neutral-600)] ring-1 ring-inset ring-[var(--color-hairline)]">
                                Audiência: {row.audienceSegmentName}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-[14px] text-[var(--color-neutral-500)]">
                            {bonusLine(row)}
                            {row.respostaCount
                              ? ` · ${row.respostaCount} ${row.respostaCount === 1 ? 'resposta' : 'respostas'}`
                              : ''}
                          </p>
                          <div className="mt-2 flex gap-3">
                            <button
                              type="button"
                              onClick={() => void toggleRespostas(row.id)}
                              className="text-[12px] font-semibold text-[var(--color-primary-500)]"
                            >
                              {open ? 'Ocultar respostas' : 'Ver respostas'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreview(previewFromRow(row, brand))}
                              className="text-[12px] font-semibold text-[var(--color-primary-500)]"
                            >
                              Prévia
                            </button>
                          </div>
                        </div>
                        {canManage && row.status !== 'archived' ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => openEdit(row)}
                              className="min-h-10 rounded-[10px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold disabled:opacity-60"
                            >
                              Editar
                            </button>
                            {row.status !== 'active' ? (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void save('active', formFrom(row), row.id)}
                                className="min-h-10 rounded-[10px] bg-[var(--color-primary-500)] px-3 text-[13px] font-semibold text-white disabled:opacity-60"
                              >
                                Ativar
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void save('draft', formFrom(row), row.id)}
                                className="min-h-10 rounded-[10px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold disabled:opacity-60"
                              >
                                Desligar
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void archive(row.id)}
                              className="min-h-10 rounded-[10px] px-3 text-[13px] font-semibold text-[var(--color-neutral-500)] disabled:opacity-60"
                            >
                              Arquivar
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {open && detail ? (
                        <div className="mt-4">
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {detail.counts.map((count) => (
                              <div key={count.position} className="min-w-0">
                                <div className="text-[11px] font-medium text-[var(--color-neutral-400)]">
                                  {count.prompt}
                                </div>
                                <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-[var(--color-ink)]">
                                  {count.up} para cima
                                </div>
                                <div className="text-[11px] text-[var(--color-neutral-400)]">
                                  {count.down} para baixo
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex flex-col gap-2">
                            {detail.respostas.map((resposta) => (
                              <div
                                key={resposta.id}
                                className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-bg)] px-3 py-3"
                              >
                                <p className="text-[14px] font-semibold">
                                  {resposta.customerName || 'Cliente'} · {resposta.phoneE164}
                                </p>
                                <p className="text-[12px] text-[var(--color-neutral-500)]">
                                  {new Date(resposta.createdAt).toLocaleString('pt-BR')}
                                  {resposta.bonusLanded ? ' · benefício creditado' : ''}
                                </p>
                                {resposta.note ? (
                                  <p className="mt-2 text-[14px] text-[var(--color-ink)]">{resposta.note}</p>
                                ) : null}
                              </div>
                            ))}
                            {detail.respostas.length === 0 ? (
                              <p className="text-[14px] text-[var(--color-neutral-500)]">
                                Nenhuma resposta ainda.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
        {preview ? (
          <div
            className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
            role="presentation"
            onClick={() => setPreview(null)}
          >
            <div
              className="my-6 w-full max-w-lg"
              role="dialog"
              aria-label="Prévia da Pesquisa"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="min-h-10 rounded-[10px] bg-[var(--color-card)] px-3 text-[13px] font-semibold"
                >
                  Fechar
                </button>
              </div>
              <PesquisaPagePreview input={preview} />
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
