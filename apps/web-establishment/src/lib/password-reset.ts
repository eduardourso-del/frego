import { firebaseErrorCode } from '@/lib/firebase';

const UNKNOWN_ACCOUNT = new Set([
  'auth/user-not-found',
  'auth/email-not-found',
]);

/** Null means the address may or may not exist — show the same success copy. */
export function resetEmailError(err: unknown): string | null {
  const code = firebaseErrorCode(err);
  if (UNKNOWN_ACCOUNT.has(code)) return null;
  if (code === 'auth/invalid-email' || code === 'auth/missing-email') {
    return 'E-mail inválido.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Muitas tentativas. Espere um pouco e tente de novo.';
  }
  return 'Não foi possível enviar o e-mail. Tente de novo.';
}

export function resetCodeExpired(err: unknown): boolean {
  const code = firebaseErrorCode(err);
  return (
    code === 'auth/expired-action-code' ||
    code === 'auth/invalid-action-code' ||
    code === 'auth/user-disabled' ||
    code === 'auth/user-not-found'
  );
}

export function resetPasswordError(err: unknown): string {
  const code = firebaseErrorCode(err);
  if (code === 'auth/weak-password') return 'Use pelo menos 6 caracteres.';
  if (code === 'auth/too-many-requests') {
    return 'Muitas tentativas. Espere um pouco e tente de novo.';
  }
  return 'Não foi possível atualizar a senha. Tente de novo.';
}
