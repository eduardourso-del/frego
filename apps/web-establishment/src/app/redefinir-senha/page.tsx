import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth-screen';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  title: 'Nova senha',
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthScreen
          title="Nova senha"
          description="Crie uma nova senha para a conta da equipe."
        >
          <p className="text-[14px] text-[var(--color-neutral-500)]">Verificando o link…</p>
        </AuthScreen>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
