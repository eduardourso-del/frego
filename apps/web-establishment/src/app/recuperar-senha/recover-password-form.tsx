'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { sendStaffPasswordReset } from '@/lib/firebase';
import { resetEmailError } from '@/lib/password-reset';
import { useAuth } from '@/lib/auth-context';
import { FregoWordmark } from '@/components/brand';
import { AuthScreen, authCardClass } from '@/components/auth-screen';
import { Alert, Button, TextField } from '@/components/ui';

export function RecoverPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, configured } = useAuth();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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
      await sendStaffPasswordReset(email);
      setSent(true);
    } catch (err) {
      const message = resetEmailError(err);
      if (message) setError(message);
      else setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <FregoWordmark height={28} href="/" />
        <h1 className="mt-6 text-[32px] font-extrabold tracking-[-0.025em]">
          Recuperar senha
        </h1>
        <p className="mt-2 text-[15px] text-[var(--color-neutral-500)]">
          Configure as variáveis <code>NEXT_PUBLIC_FIREBASE_*</code> em
          `.env.local`.
        </p>
      </main>
    );
  }

  return (
    <AuthScreen
      title="Recuperar senha"
      description="Informe o e-mail da equipe. Enviaremos um link para criar uma nova senha."
      footer={
        <p className="text-center text-[14px] text-[var(--color-neutral-500)]">
          <Link
            href="/login"
            className="font-semibold text-[var(--color-primary-500)]"
          >
            Voltar para entrar
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className={authCardClass}>
          <Alert tone="success">
            Se esse e-mail for de uma conta da equipe, enviamos um link para
            criar uma nova senha. Confira a caixa de entrada e o spam.
          </Alert>
          <Button type="button" variant="secondary" className="w-full" onClick={() => setSent(false)}>
            Enviar de novo
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className={authCardClass}>
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@seucafe.com"
            required
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar link'}
          </Button>
        </form>
      )}
    </AuthScreen>
  );
}
