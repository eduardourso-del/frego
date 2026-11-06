export type EquipeRole = 'owner' | 'manager' | 'employee';
export type EquipeStatus = 'pending' | 'active' | 'disabled';

export type EquipeRow = {
  role: EquipeRole;
  status: EquipeStatus;
};

export type EquipeAddDecision =
  | { action: 'refuse'; error: 'SELF' | 'OPERATOR' | 'ALREADY_ACTIVE' }
  | { action: 'resend' }
  | { action: 'enable' }
  | { action: 'add' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEquipeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 200 || !EMAIL.test(email)) return null;
  return email;
}

export function normalizeEquipeName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80) return null;
  return name;
}

/** Pending and active Membros besides the Dono fill a seat. Desativado does not. */
export function equipeOccupiesSeat(member: { role: string; status: string }): boolean {
  return member.role !== 'owner' && member.status !== 'disabled';
}

/** Null limit is Enterprise. Zero is a Plano without Equipe. */
export function equipeHasRoom(limit: number | null, taken: number): boolean {
  if (limit == null) return true;
  return taken < limit;
}

/** The Dono can change the Equipe while she can use the Painel. */
export function equipeCanChange(status: string): boolean {
  return status !== 'pending' && status !== 'suspended';
}

/**
 * One e-mail, one row on this Equipe.
 * Aguardando resends. Desativado comes back. A Membro who can sign in is refused.
 */
export function planEquipeAdd(input: {
  actorEmail: string;
  email: string;
  operator: boolean;
  existing: EquipeRow | null;
}): EquipeAddDecision {
  if (input.actorEmail.trim().toLowerCase() === input.email) {
    return { action: 'refuse', error: 'SELF' };
  }
  if (input.operator) return { action: 'refuse', error: 'OPERATOR' };
  const existing = input.existing;
  if (!existing) return { action: 'add' };
  if (existing.role === 'owner' || existing.status === 'active') {
    return { action: 'refuse', error: 'ALREADY_ACTIVE' };
  }
  if (existing.status === 'pending') return { action: 'resend' };
  return { action: 'enable' };
}

/** A dropped Aguardando login goes away only when nobody else uses it. */
export function shouldDeleteInvitedLogin(input: {
  otherMemberships: number;
  hasPassword: boolean;
}): boolean {
  return input.otherMemberships === 0 && !input.hasPassword;
}
