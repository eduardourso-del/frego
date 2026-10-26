import { API_URL } from '@/lib/api';
import { getFirebaseAuth, getIdToken } from '@/lib/firebase';

const BUSINESS_KEY = 'frego.activeBusinessId';

export type CadastroSummary = {
  email: string;
  businessName: string;
  ownerName: string;
  expired: boolean;
};

export type FinishRegistration =
  | { kind: 'created'; businessId: string }
  | { kind: 'already' }
  | { kind: 'needs_email' }
  | { kind: 'missing' }
  | { kind: 'expired' }
  | { kind: 'error'; message: string };

export function rememberBusiness(businessId: string) {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid || typeof window === 'undefined') return;
  window.localStorage.setItem(`${BUSINESS_KEY}.${uid}`, businessId);
}

export function registrationFinishMessage(error: string) {
  switch (error) {
    case 'CNPJ_TAKEN':
      return 'Este CNPJ já está cadastrado.';
    case 'APPLICATION_EXPIRED':
      return 'Esse cadastro expirou. Preencha de novo.';
    case 'EMAIL_NOT_VERIFIED':
      return 'Confirme o e-mail antes de continuar.';
    case 'ALREADY_HAS_BUSINESS':
      return 'Este e-mail já está vinculado a um estabelecimento.';
    case 'INVALID_CNPJ':
      return 'CNPJ inválido.';
    case 'INVALID_CEP':
      return 'CEP inválido.';
    case 'INVALID_STATE':
      return 'Escolha o estado onde a unidade opera.';
    case 'PLATFORM_ADMIN_CANNOT_REGISTER':
      return 'Esta conta é de operador Frego e não pode cadastrar um estabelecimento.';
    default:
      return 'Não foi possível concluir o cadastro.';
  }
}

/** null means the lookup failed. [] means this account has no estabelecimento. */
export async function listMyBusinesses(token: string) {
  const res = await fetch(`${API_URL}/me/businesses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 403) return [];
  if (!res.ok) return null;
  const json = (await res.json()) as { businesses?: unknown[] };
  return json.businesses ?? [];
}

export async function loadMyCadastro(token: string): Promise<CadastroSummary | null> {
  const res = await fetch(`${API_URL}/businesses/register`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { application?: CadastroSummary | null };
  return json.application ?? null;
}

export async function finishBusinessRegistration(): Promise<FinishRegistration> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return { kind: 'error', message: 'Entre para concluir o cadastro.' };
  await user.reload();
  if (!user.emailVerified) return { kind: 'needs_email' };
  const token = await user.getIdToken(true);
  const res = await fetch(`${API_URL}/businesses/register/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    business?: { id?: string };
  };
  if (res.status === 201 && json.business?.id) {
    return { kind: 'created', businessId: json.business.id };
  }
  if (res.status === 409 && json.error === 'ALREADY_HAS_BUSINESS') {
    return { kind: 'already' };
  }
  if (res.status === 404) return { kind: 'missing' };
  if (res.status === 410) return { kind: 'expired' };
  if (res.status === 403 && json.error === 'EMAIL_NOT_VERIFIED') {
    return { kind: 'needs_email' };
  }
  return {
    kind: 'error',
    message: registrationFinishMessage(json.error ?? ''),
  };
}

/** Where to go after a staff sign-in. Existing owners skip the email gate. */
export async function pathAfterStaffSignIn(): Promise<
  '/dashboard' | '/confirmar-email' | '/register'
> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return '/confirmar-email';
  await user.reload();
  const token = await getIdToken(true);
  if (!token) return '/dashboard';
  const businesses = await listMyBusinesses(token);
  if (businesses === null || businesses.length > 0) return '/dashboard';
  if (!user.emailVerified) return '/confirmar-email';
  const finished = await finishBusinessRegistration();
  if (finished.kind === 'created') rememberBusiness(finished.businessId);
  if (finished.kind === 'needs_email' || finished.kind === 'expired') {
    return '/confirmar-email';
  }
  if (finished.kind === 'missing') return '/register';
  return '/dashboard';
}
