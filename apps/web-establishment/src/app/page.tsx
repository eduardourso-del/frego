import type { Metadata } from 'next';
import { HomeClient } from './home-client';

export const metadata: Metadata = {
  title: 'Frego — Transforme clientes em fregueses',
  description:
    'O Frego ajuda negócios locais a criar relacionamentos que fazem o cliente voltar — com WhatsApp, IA e automações. Sem depender de marketplace, cartão de papel ou desconto constante.',
  keywords: [
    'fazer cliente voltar',
    'relacionamento com clientes',
    'negócio local',
    'whatsapp para loja',
    'aumentar vendas estabelecimento',
  ],
  openGraph: {
    title: 'Frego — Transforme clientes em fregueses',
    description:
      'Não vendemos fidelidade. Criamos fregueses. Relacionamentos que fazem seu cliente voltar.',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function HomePage() {
  return <HomeClient />;
}
