'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CircleCheck, Mail } from 'lucide-react';
import {
  applyStaffEmailVerification,
  firebaseErrorCode,
  getFirebaseAuth,
  sendStaffEmailVerification,
} from '@/lib/firebase';
import {
  finishBusinessRegistration,
  loadMyCadastro,
  rememberBusiness,
  type CadastroSummary,
} from '@/lib/register-account';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { AuthScreen, authCardClass } from '@/components/auth-screen';
import { Alert, Button } from '@/components/ui';

type Phase =
  | 'loading'
  | 'wait'
  | 'signed_out'
  | 'invalid_link'
  | 'expired'
  | 'missing'
  | 'error';

export function ConfirmEmailForm() {
  const router = useRouter();
  const { user, loading: authLoading, configured, logout } = useAuth();
  const { business, loading: businessLoading, refresh } = useBusiness();
  const started = useRef(false);
  const finishLock = useRef(false);
  const [ready, setReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);
  const [application, setApplication] = useState<CadastroSummary | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured || started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('oobCode');
    const mode = params.get('mode');
    void (async () => {
      if (mode === 'resetPassword') {
        const search = params.toString();
        router.replace(search ? `/redefinir-senha?${search}` : '/redefinir-senha');
        return;
      }
      if (code && mode !== 'recoverEmail') {
        try {
          const email = await applyStaffEmailVerification(code);
          setConfirmedEmail(email);
          const current = getFirebaseAuth().currentUser;
          if (current) {
            await current.reload();
            await current.getIdToken(true);
            if (current.emailVerified) setVerified(true);
          }
        } catch {
          setLinkError(true);
        }
        router.replace('/confirmar-email');
      }
      const current = getFirebaseAuth().currentUser;
      if (current?.emailVerified) setVerified(true);
      setReady(true);
    })();
  }, [configured, router]);

  async function complete() {
    if (finishLock.current) return;
    finishLock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await finishBusinessRegistration();
      if (result.kind === 'created') rememberBusiness(result.businessId);
      if (result.kind === 'created' || result.kind === 'already') {
        await refresh();
        router.replace('/dashboard');
        return;
      }
      if (result.kind === 'needs_email') {
        setVerified(false);
        setPhase('wait');
        return;
      }
      if (result.kind === 'missing') {
        setPhase('missing');
        return;
      }
      if (result.kind === 'expired') {
        setPhase('expired');
        return;
      }
      setPhase('error');
      setError(result.message);
    } finally {
      finishLock.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!ready || authLoading || businessLoading) return;
    if (business) {
      router.replace('/dashboard');
      return;
    }
    if (verified) return;
    if (!user) {
      setPhase(linkError && !confirmedEmail ? 'invalid_link' : 'signed_out');
      return;
    }
    let cancelled = false;
    void (async () => {
      const token = await user.getIdToken();
      const cadastro = await loadMyCadastro(token);
      if (cancelled) return;
      setApplication(cadastro);
      if (cadastro?.expired) setPhase('expired');
      else if (linkError) setPhase('invalid_link');
      else setPhase('wait');
    })();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    authLoading,
    businessLoading,
    business,
    verified,
    user,
    linkError,
    confirmedEmail,
    router,
  ]);

  useEffect(() => {
    if (!ready || !verified || businessLoading || business) return;
    void complete();
    // complete is stable enough for this gate: it locks itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, verified, businessLoading, business]);

  useEffect(() => {
    if (!ready || !user || verified) return;
    const id = window.setInterval(() => {
      void user.reload().then(async () => {
        if (!user.emailVerified) return;
        await user.getIdToken(true);
        setVerified(true);
      });
    }, 4000);
    return () => window.clearInterval(id);
  }, [ready, user, verified]);

  async function resend() {
    const current = getFirebaseAuth().currentUser;
    if (!current) {
      setError('Entre para reenviar o e-mail.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await sendStaffEmailVerification(current);
      setNotice('Enviamos de novo. Olhe também o spam.');
      setPhase('wait');
      setLinkError(false);
    } catch (err) {
      const code = firebaseErrorCode(err);
      setError(
        code === 'auth/too-many-requests'
          ? 'Muitas tentativas. Espere um pouco e tente de novo.'
          : 'Não foi possível reenviar o e-mail.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function alreadyConfirmed() {
    const current = getFirebaseAuth().currentUser;
    if (!current) return;
    setBusy(true);
    try {
      await current.reload();
      await current.getIdToken(true);
      if (current.emailVerified) {
        setVerified(true);
        return;
      }
      setError('Ainda não vemos a confirmação. Abra o link do e-mail e tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <AuthScreen title="Confirme seu e-mail">
        <p className="text-[15px] text-[var(--color-neutral-500)]">
          Configure as variáveis <code>NEXT_PUBLIC_FIREBASE_*</code> em
          `.env.local`.
        </p>
      </AuthScreen>
    );
  }

  const email = application?.email ?? confirmedEmail ?? user?.email ?? '';
  const businessName = application?.businessName;
  const finishing =
    verified && phase !== 'error' && phase !== 'missing' && phase !== 'expired';
  const confirmedSignedOut = phase === 'signed_out' && Boolean(confirmedEmail);
  const title = finishing
    ? 'E-mail confirmado'
    : phase === 'expired'
      ? 'Cadastro expirado'
      : phase === 'missing'
        ? 'Nenhum cadastro'
        : confirmedSignedOut
          ? 'E-mail confirmado'
          : 'Confirme seu e-mail';
  const description = finishing
    ? 'O cadastro segue para a equipe Frego.'
    : phase === 'wait'
      ? businessName
        ? `O cadastro de ${businessName} só segue depois dessa confirmação.`
        : 'A equipe Frego só recebe o cadastro depois dessa confirmação.'
      : confirmedSignedOut
        ? 'Entre com a senha para concluir.'
        : phase === 'expired'
          ? 'O pedido ficou parado por mais de sete dias.'
          : phase === 'missing'
            ? 'Esta conta ainda não tem um cadastro.'
            : phase === 'loading'
              ? 'Conferindo o link.'
              : 'Enviamos um link para o seu e-mail.';

  return (
    <AuthScreen
      title={title}
      description={description}
      footer={
        user ? (
          <p className="text-center text-[14px] text-[var(--color-neutral-500)]">
            <button
              type="button"
              onClick={() => void logout()}
              className="font-semibold text-[var(--color-primary-500)]"
            >
              Sair
            </button>
          </p>
        ) : (
          <p className="text-center text-[14px] text-[var(--color-neutral-500)]">
            <Link
              href="/login"
              className="font-semibold text-[var(--color-primary-500)]"
            >
              Entrar
            </Link>
          </p>
        )
      }
    >
      {phase === 'loading' || finishing ? (
        <ConfirmCard tone={finishing ? 'done' : 'mail'}>
          <p className="text-center text-[14px] text-[var(--color-neutral-500)]">
            {finishing ? 'Abrindo o painel…' : 'Um momento…'}
          </p>
        </ConfirmCard>
      ) : null}

      {!verified && (phase === 'wait' || phase === 'invalid_link') ? (
        <ConfirmCard tone="mail">
          {email ? <AddressLine email={email} /> : null}
          {phase === 'invalid_link' ? (
            <Alert tone="danger">
              Esse link expirou ou já foi usado. Peça outro e-mail.
            </Alert>
          ) : (
            <ConfirmSteps />
          )}
          <p className="flex items-center justify-center gap-2 text-[13px] text-[var(--color-neutral-500)]">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-primary-500)]"
              aria-hidden
            />
            Esta página conclui sozinha
          </p>
          {notice ? <Alert tone="success">{notice}</Alert> : null}
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {user ? (
            <>
              <Button type="button" className="w-full" disabled={busy} onClick={() => void resend()}>
                {busy ? 'Enviando…' : 'Reenviar e-mail'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={busy}
                onClick={() => void alreadyConfirmed()}
              >
                Já confirmei
              </Button>
              <p className="text-center text-[12px] leading-relaxed text-[var(--color-neutral-400)]">
                Não chegou? Olhe também o spam.
              </p>
            </>
          ) : (
            <Button type="button" className="w-full" onClick={() => router.push('/login')}>
              Entrar
            </Button>
          )}
        </ConfirmCard>
      ) : null}

      {phase === 'signed_out' ? (
        <ConfirmCard tone={confirmedEmail ? 'done' : 'mail'}>
          {confirmedEmail ? <AddressLine email={confirmedEmail} /> : null}
          <p className="text-center text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
            {confirmedEmail
              ? 'A caixa está confirmada. Entre para a equipe Frego receber o cadastro.'
              : 'Entre com o e-mail do cadastro para abrir o link de confirmação.'}
          </p>
          <Button type="button" className="w-full" onClick={() => router.push('/login')}>
            Entrar
          </Button>
        </ConfirmCard>
      ) : null}

      {phase === 'expired' || phase === 'missing' ? (
        <ConfirmCard tone="mail">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button type="button" className="w-full" onClick={() => router.push('/register')}>
            Preencher cadastro
          </Button>
        </ConfirmCard>
      ) : null}

      {phase === 'error' ? (
        <ConfirmCard tone="mail">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Button
            type="button"
            className="w-full"
            disabled={busy}
            onClick={() => void complete()}
          >
            Tentar de novo
          </Button>
        </ConfirmCard>
      ) : null}
    </AuthScreen>
  );
}

function ConfirmCard({
  tone,
  children,
}: {
  tone: 'mail' | 'done';
  children: ReactNode;
}) {
  const done = tone === 'done';
  const Icon = done ? CircleCheck : Mail;
  return (
    <div className={authCardClass}>
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-[16px]"
        style={{
          background: done
            ? 'var(--color-success-bg)'
            : 'var(--color-primary-50)',
          color: done ? 'var(--color-success)' : 'var(--color-primary-500)',
        }}
        aria-hidden
      >
        <Icon className="h-7 w-7" strokeWidth={1.75} />
      </div>
      {children}
    </div>
  );
}

function AddressLine({ email }: { email: string }) {
  return (
    <p className="break-all rounded-[12px] bg-[var(--color-bg)] px-4 py-3 text-center text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
      {email}
    </p>
  );
}

function ConfirmSteps() {
  const steps = [
    'Abra o e-mail',
    'Toque em confirmar',
    'O cadastro segue para a equipe Frego',
  ];
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[12px] font-bold text-[var(--color-primary-500)]">
            {index + 1}
          </span>
          <span className="text-[14px] text-[var(--color-ink)]">{step}</span>
        </li>
      ))}
    </ol>
  );
}
