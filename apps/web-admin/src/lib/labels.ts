import { TYPE_LABEL, TYPES } from '@frego/tokens';

export { TYPE_LABEL, TYPES };

export const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  trial: 'Trial',
  active: 'Ativo',
  past_due: 'Inadimplente',
  suspended: 'Suspenso',
};

export const STATUS_OPTIONS = [
  'pending',
  'trial',
  'active',
  'past_due',
  'suspended',
] as const;

export const ROLE_LABEL: Record<string, string> = {
  owner: 'Dono',
  manager: 'Gerente',
  employee: 'Funcionário',
};

export const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  stamps: 'Carimbos',
  spend: 'Pontos',
  visits: 'Visitas',
  birthday: 'Aniversário',
  cashback: 'Cashback',
};

export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Ativa',
  paused: 'Pausada',
  archived: 'Arquivada',
};

export const WHATSAPP_STATUS_LABEL: Record<string, string> = {
  connected: 'Conectado',
  disconnected: 'Desconectado',
  error: 'Erro',
};
