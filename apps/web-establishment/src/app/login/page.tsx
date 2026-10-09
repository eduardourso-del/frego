'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInStaff } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { FregoWordmark } from '@/components/brand';
import { AuthScreen, authCardClass } from '@/components/auth-screen';
import { Alert, Button, FieldLabel, PasswordField, TextField } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPasswordUpdated(params.get('senha') === 'atualizada');
  }, []);

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

  const recoverHref = email.trim()
    ? `/recuperar-senha?email=${encodeURIComponent(email.trim())}`
    : '/recuperar-senha';

  return (
    <AuthScreen
      title="Entrar"
      description="Entre com o e-mail da equipe. No aplicativo, o cliente entra com o telefone."
      footer={
        <p className="text-center text-[14px] text-[var(--color-neutral-500)]">
          Novo estabelecimento?{' '}
          <Link
            href="/register"
            className="font-semibold text-[var(--color-primary-500)]"
          >
            Cadastre sua loja
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className={authCardClass}>
        {passwordUpdated ? (
          <Alert tone="success">Senha atualizada. Entre com a nova senha.</Alert>
        ) : null}
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@seucafe.com"
          required
        />
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <FieldLabel className="mb-0">Senha</FieldLabel>
            <Link
              href={recoverHref}
              className="shrink-0 text-[13px] font-semibold normal-case tracking-normal text-[var(--color-primary-500)]"
            >
              Esqueci minha senha
            </Link>
          </div>
          <PasswordField
            aria-label="Senha"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthScreen>
  );
}
