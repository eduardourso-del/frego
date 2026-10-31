import type { ComponentType } from 'react';
import { SaiposSettingsCard, SaiposStatus } from '@/components/saipos-settings-card';

/** One optional connection an Estabelecimento can turn on. Add a row to register another. */
export type IntegrationDefinition = {
  id: string;
  name: string;
  summary: string;
  /** Public path to the brand mark. The row shows this in place of the name. */
  logo?: string;
  Panel: ComponentType<{ embedded?: boolean }>;
  Status?: ComponentType;
};

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: 'saipos',
    name: 'Saipos',
    logo: '/integrations/saipos.svg',
    summary: 'Vendas fechadas creditam pontos e cashback. Liga se o caixa já é a Saipos.',
    Panel: SaiposSettingsCard,
    Status: SaiposStatus,
  },
];
