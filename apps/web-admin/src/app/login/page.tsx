'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isFirebaseConfigured, signInStaff } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api';
import { FregoWordmark } from '@/components/brand';

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, loading, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!configured) {
      setError('Firebase não configurado.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInStaff(email, password);
      const { getIdToken } = await import('@/lib/firebase');
      const token = await getIdToken(true);
      const res = await fetch(`${API_URL}/admin/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const { getFirebaseAuth } = await import('@/lib/firebase');
        const { signOut } = await import('firebase/auth');
        await signOut(getFirebaseAuth());
        throw new Error(
          json.error === 'NOT_A_PLATFORM_ADMIN'
            ? 'Esta conta não é admin Frego.'
            : (json.error ?? 'Sem permissão'),
        );
      }
      router.replace('/');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao entrar';
      setError(
        message.includes('invalid-credential') ||
          message.includes('wrong-password') ||
          message.includes('user-not-found')
          ? 'E-mail ou senha incorretos'
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  if (!isFirebaseConfigured()) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <FregoWordmark height={28} />
        <h1 className="mt-6 text-[32px] font-extrabold tracking-[-0.025em]">Admin</h1>
        <p className="mt-2 text-[15px] text-[var(--color-neutral-500)]">
          Configure <code>NEXT_PUBLIC_FIREBASE_*</code> em `.env.local`.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <FregoWordmark height={28} />
      <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-500)]">
        Plataforma
      </p>
      <h1 className="mt-1 text-[32px] font-extrabold tracking-[-0.025em]">
        Entrar no admin
      </h1>
      <p className="mt-2 text-[15px] text-[var(--color-neutral-500)]">
        Aprove novos estabelecimentos e acompanhe a operação.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3">
        <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-control)] bg-[var(--color-card)] px-3 text-[16px]"
            required
          />
        </label>
        <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-control)] bg-[var(--color-card)] px-3 text-[16px]"
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
          className="min-h-11 rounded-[8px] bg-[var(--color-primary-500)] text-[14px] font-extrabold text-[var(--color-on-primary)] disabled:bg-[var(--color-neutral-100)] disabled:text-[var(--color-neutral-400)]"
        >
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
