'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { API_URL } from '@/lib/api';
import { FregoWordmark } from '@/components/brand';
import { PesquisaBrandHeader, type PesquisaBrand } from '@/components/pesquisa-brand-header';
import { PolegarChoice } from '@/components/pesquisa-polegar';

type Snapshot = {
  notePrompt: string | null;
  inviteLine: string;
  questions: { position: number; prompt: string }[];
  bonus: { sentence: string } | null;
};

type View =
  | { state: 'loading' }
  | { state: 'missing' }
  | ({ state: 'closed' } & Partial<PesquisaBrand>)
  | ({ state: 'answered' } & Partial<PesquisaBrand>)
  | ({
      state: 'open';
      conviteId: string;
      pesquisaName: string;
      purchase: string | null;
      snapshot: Snapshot;
    } & PesquisaBrand)
  | ({
      state: 'done';
      sentence: string | null;
      benefit: string | null;
    } & Partial<PesquisaBrand>);

function brandFrom(json: Record<string, unknown>): PesquisaBrand {
  return {
    businessName: typeof json.businessName === 'string' ? json.businessName : '',
    businessType: typeof json.businessType === 'string' ? json.businessType : null,
    slogan: typeof json.slogan === 'string' ? json.slogan : null,
    logoUrl: typeof json.logoUrl === 'string' ? json.logoUrl : null,
    heroImageUrl: typeof json.heroImageUrl === 'string' ? json.heroImageUrl : null,
    primaryColor: typeof json.primaryColor === 'string' ? json.primaryColor : null,
    primaryColorDark:
      typeof json.primaryColorDark === 'string' ? json.primaryColorDark : null,
    address: typeof json.address === 'string' ? json.address : null,
    locationOpen: typeof json.locationOpen === 'boolean' ? json.locationOpen : null,
  };
}

export default function PesquisaPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<View>({ state: 'loading' });
  const [answers, setAnswers] = useState<Record<number, 'up' | 'down'>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then((value) => setToken(value.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    void fetch(`${API_URL}/public/convites/${token}`)
      .then(async (res) => {
        if (res.status === 404) {
          setView({ state: 'missing' });
          return;
        }
        const json = await res.json();
        if (json.state === 'open') {
          setView({
            state: 'open',
            conviteId: json.conviteId,
            pesquisaName: typeof json.pesquisaName === 'string' ? json.pesquisaName : '',
            purchase: typeof json.purchase === 'string' ? json.purchase : null,
            snapshot: json.snapshot,
            ...brandFrom(json),
          });
          return;
        }
        setView({ state: json.state, ...brandFrom(json) });
      })
      .catch(() => setView({ state: 'missing' }));
  }, [token]);

  async function submit() {
    if (view.state !== 'open' || !token) return;
    const missing = view.snapshot.questions.some((q) => !answers[q.position]);
    if (missing) {
      setError('Responda todas as perguntas.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/public/convites/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conviteId: view.conviteId,
          note: note.trim() || null,
          answers: view.snapshot.questions.map((q) => ({
            position: q.position,
            value: answers[q.position],
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Não foi possível enviar.');
      const rawLabel =
        json.bonus?.landed && typeof json.bonus.label === 'string'
          ? json.bonus.label.replace(/^Pesquisa · /, '')
          : '';
      setView({
        state: 'done',
        sentence: json.bonus?.landed ? json.bonus.sentence : null,
        benefit: rawLabel || null,
        businessName: view.businessName,
        businessType: view.businessType,
        slogan: view.slogan,
        logoUrl: view.logoUrl,
        heroImageUrl: view.heroImageUrl,
        primaryColor: view.primaryColor,
        primaryColorDark: view.primaryColorDark,
        address: view.address,
        locationOpen: view.locationOpen,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[var(--color-bg)]">
      {view.state !== 'loading' && view.state !== 'missing' && view.businessName ? (
        <PesquisaBrandHeader brand={{ ...view, businessName: view.businessName }} />
      ) : (
        <p className="px-5 pt-8 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-400)]">
          Frego
        </p>
      )}
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-5 pb-10 pt-8">
      {view.state === 'loading' ? <p>Carregando…</p> : null}
      {view.state === 'missing' || view.state === 'closed' ? (
        <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">
          Esta Pesquisa está encerrada.
        </h1>
      ) : null}
      {view.state === 'answered' ? (
        <div className="flex flex-col items-center gap-3 pt-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
            <Check size={32} strokeWidth={2.5} aria-hidden />
          </span>
          <h1 className="text-[32px] font-extrabold tracking-[-0.04em]">Obrigado</h1>
          <p className="max-w-sm text-[16px] leading-snug text-[var(--color-neutral-600)]">
            Você já respondeu esta Pesquisa.
          </p>
        </div>
      ) : null}
      {view.state === 'done' ? (
        <div className="flex flex-col items-center gap-3 pt-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
            <Check size={32} strokeWidth={2.5} aria-hidden />
          </span>
          <h1 className="text-[32px] font-extrabold tracking-[-0.04em]">Obrigado</h1>
          <p className="max-w-sm text-[16px] leading-snug text-[var(--color-neutral-600)]">
            {view.sentence
              ? 'Sua resposta entrou e o benefício foi para o saldo.'
              : 'Sua resposta foi registrada.'}
          </p>
          {view.benefit ? (
            <p className="mt-2 w-full rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] px-4 py-3 text-[16px] font-extrabold">
              {view.benefit}
            </p>
          ) : null}
        </div>
      ) : null}
      {view.state === 'open' ? (
        <>
          {view.pesquisaName ? (
            <h1 className="text-[28px] font-extrabold tracking-[-0.04em]">
              {view.pesquisaName}
            </h1>
          ) : null}
          {view.purchase ? (
            <p className="text-[14px] font-semibold leading-snug text-[var(--color-neutral-600)]">
              {view.purchase}
            </p>
          ) : null}
          <p
            className={
              view.pesquisaName
                ? 'text-[16px] font-semibold leading-snug text-[var(--color-neutral-600)]'
                : 'text-[28px] font-extrabold tracking-[-0.04em]'
            }
          >
            {view.snapshot.bonus?.sentence ?? view.snapshot.inviteLine}
          </p>
          {view.snapshot.questions.map((question) => (
            <section key={question.position} className="rounded-[16px] border border-[var(--color-hairline)] p-4">
              <p className="font-semibold">{question.prompt}</p>
              <PolegarChoice
                value={answers[question.position]}
                onChange={(next) => setAnswers({ ...answers, [question.position]: next })}
              />
            </section>
          ))}
          {view.snapshot.notePrompt ? (
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold">{view.snapshot.notePrompt}</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-24 w-full rounded-[12px] border border-[var(--color-hairline)] p-3"
              />
            </label>
          ) : null}
          {error ? <p className="text-[14px] font-semibold text-[var(--color-danger)]">{error}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="min-h-12 rounded-[12px] bg-[var(--color-ink)] font-extrabold text-white disabled:opacity-50"
          >
            Enviar resposta
          </button>
        </>
      ) : null}
      </div>
      <footer className="border-t border-[var(--color-hairline)] py-8">
        <Link href="/" className="mx-auto flex justify-center" aria-label="Frego">
          <FregoWordmark height={28} />
        </Link>
      </footer>
    </main>
  );
}
