'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isFirebaseConfigured, signInStaff } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { FregoWordmark } from '@/components/brand';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!configured) {
      setError('Firebase não configurado neste ambiente.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInStaff(email, password);
      router.replace('/dashboard');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível entrar.';
      setError(
        message.includes('invalid-credential') ||
          message.includes('wrong-password') ||
          message.includes('user-not-found')
          ? 'E-mail ou senha incorretos.'
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <FregoWordmark height={28} href="/" />
        <h1 className="mt-6 text-[32px] font-extrabold tracking-[-0.025em]">Entrar</h1>
        <p className="mt-2 text-[15px] text-[var(--color-neutral-500)]">
          Configure as variáveis <code>NEXT_PUBLIC_FIREBASE_*</code> em
          `.env.local`.
        </p>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[var(--color-bg)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[var(--color-primary-50)] to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-8">
          <FregoWordmark height={28} href="/" />
          <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-500)]">
            Estabelecimento
          </p>
        </div>

        <h1 className="text-[32px] font-extrabold tracking-[-0.025em] text-[var(--color-ink)]">
          Entrar
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
          Entre com o e-mail da equipe. No aplicativo, o cliente entra com o
          telefone.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 flex flex-col gap-4 rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]"
        >
          <label className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-500)]">
            E-mail
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-control)] bg-[var(--color-card)] px-3.5 text-[16px] text-[var(--color-ink)]"
              placeholder="voce@seucafe.com"
              required
            />
          </label>
          <label className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-500)]">
            Senha
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-control)] bg-[var(--color-card)] px-3.5 text-[16px] text-[var(--color-ink)]"
              required
              minLength={6}
            />
          </label>
          {error && (
            <p className="text-[13px] text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
          className="min-h-11 rounded-[8px] bg-[var(--color-primary-500)] text-[14px] font-extrabold text-[var(--color-on-primary)] transition-[transform,background] enabled:active:scale-[0.98] disabled:bg-[var(--color-neutral-100)] disabled:text-[var(--color-neutral-400)]"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-[14px] text-[var(--color-neutral-500)]">
          Novo estabelecimento?{' '}
          <Link
            href="/register"
            className="font-semibold text-[var(--color-primary-500)]"
          >
            Cadastre sua loja
          </Link>
        </p>
        <p className="mt-3 text-center text-[12px] text-[var(--color-neutral-400)]">
          <Link href="/privacidade" className="hover:text-[var(--color-ink)]">
            Privacidade
          </Link>
          {' · '}
          <Link href="/termos" className="hover:text-[var(--color-ink)]">
            Termos
          </Link>
          {' · '}
          <a href={CONTACT_MAILTO} className="hover:text-[var(--color-ink)]">
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
