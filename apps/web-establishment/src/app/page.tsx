import type { Metadata } from 'next';
import { HomeClient } from './home-client';

export const metadata: Metadata = {
  title: 'Frego — Suba o ticket médio e o faturamento da sua loja',
  description:
    'O Frego ajuda o seu estabelecimento a subir o ticket médio e melhorar o faturamento: campanhas, WhatsApp e audiências que transformam clientes em fregueses.',
  keywords: [
    'aumentar ticket médio',
    'aumentar faturamento estabelecimento',
    'fazer cliente voltar',
    'relacionamento com clientes',
    'negócio local',
    'campanha de fidelidade',
    'carimbos pontos cashback',
    'whatsapp para loja',
    'aumentar vendas estabelecimento',
  ],
  openGraph: {
    title: 'Frego — Suba o ticket médio e o faturamento da sua loja',
    description:
      'Campanhas, WhatsApp e audiências para o estabelecimento que quer fregueses que voltam e gastam mais.',
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
