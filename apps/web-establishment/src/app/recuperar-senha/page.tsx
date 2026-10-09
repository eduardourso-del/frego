import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth-screen';
import { RecoverPasswordForm } from './recover-password-form';

export const metadata: Metadata = {
  title: 'Recuperar senha',
};

export default function RecoverPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthScreen
          title="Recuperar senha"
          description="Informe o e-mail da equipe. Enviaremos um link para criar uma nova senha."
        >
          {null}
        </AuthScreen>
      }
    >
      <RecoverPasswordForm />
    </Suspense>
  );
}
