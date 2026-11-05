import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth-screen';
import { ConfirmEmailForm } from './confirm-email-form';

export const metadata: Metadata = {
  title: 'Confirme seu e-mail',
};

export default function ConfirmEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthScreen
          title="Confirme seu e-mail"
          description="Enviamos um link para o seu e-mail."
        >
          <p className="text-[14px] text-[var(--color-neutral-500)]">Um momento…</p>
        </AuthScreen>
      }
    >
      <ConfirmEmailForm />
    </Suspense>
  );
}
