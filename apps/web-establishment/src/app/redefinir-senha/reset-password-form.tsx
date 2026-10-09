'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  confirmStaffPasswordReset,
  verifyStaffPasswordReset,
} from '@/lib/firebase';
import { resetCodeExpired, resetPasswordError } from '@/lib/password-reset';
import { useAuth } from '@/lib/auth-context';
import { FregoWordmark } from '@/components/brand';
import { AuthScreen, authCardClass } from '@/components/auth-screen';
import { Alert, Button, PasswordField } from '@/components/ui';

type Status = 'checking' | 'ready' | 'missing' | 'invalid' | 'saved';

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get('oobCode') ?? '';
  const mode = params.get('mode');
  const unsupported = Boolean(mode && mode !== 'resetPassword');
  const { configured } = useAuth();
  const [status, setStatus] = useState<Status>(
    unsupported ? 'invalid' : code ? 'checking' : 'missing',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured || !code || unsupported) return;
    let cancelled = false;
    verifyStaffPasswordReset(code)
      .then((accountEmail) => {
        if (cancelled) return;
        setEmail(accountEmail);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [code, configured, unsupported]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError('Use pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await confirmStaffPasswordReset(code, password);
      setStatus('saved');
    } catch (err) {
      if (resetCodeExpired(err)) {
        setStatus('invalid');
        return;
      }
      setError(resetPasswordError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <FregoWordmark height={28} href="/" />
        <h1 className="mt-6 text-[32px] font-extrabold tracking-[-0.025em]">
          Nova senha
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
      title={status === 'saved' ? 'Senha atualizada' : 'Nova senha'}
      description={
        status === 'ready' && email
          ? `Crie uma nova senha para ${email}.`
          : status === 'saved'
            ? 'Entre no painel com a nova senha.'
            : 'Crie uma nova senha para a conta da equipe.'
      }
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
      {status === 'checking' ? (
        <p className="text-[14px] text-[var(--color-neutral-500)]">Verificando o link…</p>
      ) : null}

      {status === 'missing' || status === 'invalid' ? (
        <div className={authCardClass}>
          <Alert tone={status === 'invalid' ? 'danger' : 'info'}>
            {status === 'invalid'
              ? unsupported
                ? 'Este link não redefine a senha.'
                : 'Este link expirou ou já foi usado.'
              : 'Peça um novo link com o e-mail da equipe.'}
          </Alert>
          <Button
            type="button"
            className="w-full"
            onClick={() => router.push('/recuperar-senha')}
          >
            Pedir um novo link
          </Button>
        </div>
      ) : null}

      {status === 'ready' ? (
        <form onSubmit={onSubmit} noValidate className={authCardClass}>
          <PasswordField
            label="Nova senha"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <PasswordField
            label="Confirmar senha"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar senha'}
          </Button>
        </form>
      ) : null}

      {status === 'saved' ? (
        <div className={authCardClass}>
          <Alert tone="success">Senha atualizada. Entre com a nova senha.</Alert>
          <Button
            type="button"
            className="w-full"
            onClick={() => router.push('/login?senha=atualizada')}
          >
            Entrar
          </Button>
        </div>
      ) : null}
    </AuthScreen>
  );
}
