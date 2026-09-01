import type { Metadata } from 'next';
import { HomeClient } from './home-client';

export const metadata: Metadata = {
  title: 'Frego — Transforme clientes em fregueses',
  description:
    'O Frego ajuda negócios locais a criar relacionamentos que fazem o cliente voltar — com campanhas de carimbos, pontos, cashback e aniversário, WhatsApp e automações.',
  keywords: [
    'fazer cliente voltar',
    'relacionamento com clientes',
    'negócio local',
    'campanha de fidelidade',
    'carimbos pontos cashback',
    'whatsapp para loja',
    'aumentar vendas estabelecimento',
  ],
  openGraph: {
    title: 'Frego — Transforme clientes em fregueses',
    description:
      'Não vendemos fidelidade. Criamos fregueses. Relacionamentos que fazem seu cliente voltar.',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: '/brand/png/frego-compartilhamento-1200x630.png',
        width: 1200,
        height: 630,
        alt: 'Frego',
      },
    ],
  },
};

export default function HomePage() {
  return <HomeClient />;
}
