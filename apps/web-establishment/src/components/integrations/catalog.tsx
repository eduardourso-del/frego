import type { ComponentType } from 'react';
import { SaiposSettingsCard, SaiposStatus } from '@/components/saipos-settings-card';
import {
  WhatsAppMark,
  WhatsAppSettingsCard,
  WhatsAppStatus,
} from '@/components/whatsapp-settings-card';

/** One optional connection an Estabelecimento can turn on. Add a row to register another. */
export type IntegrationDefinition = {
  id: string;
  name: string;
  summary: string;
  /** Public path to the brand mark. The row shows this in place of the name. */
  logo?: string;
  /** Icon shown beside the name. */
  Mark?: ComponentType;
  Panel: ComponentType<{ embedded?: boolean }>;
  Status?: ComponentType;
};

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    Mark: WhatsAppMark,
    summary:
      'Cadastro, acúmulo, campanha, pesquisa e o lembrete saem pelo WhatsApp da loja.',
    Panel: WhatsAppSettingsCard,
    Status: WhatsAppStatus,
  },
  {
    id: 'saipos',
    name: 'Saipos',
    logo: '/integrations/saipos.svg',
    summary: 'Vendas fechadas creditam pontos e cashback. Liga se o caixa já é a Saipos.',
    Panel: SaiposSettingsCard,
    Status: SaiposStatus,
  },
];
