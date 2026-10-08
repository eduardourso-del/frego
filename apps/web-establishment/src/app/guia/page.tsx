import type { Metadata } from 'next';
import { GuideView } from './guide-view';

export const metadata: Metadata = {
  title: 'Guia',
  description:
    'Como o painel, as campanhas, as audiências, os clientes, os relatórios e o balcão funcionam.',
};

export default function GuiaPage() {
  return <GuideView />;
}
