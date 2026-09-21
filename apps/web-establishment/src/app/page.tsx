import type { Metadata } from 'next';
import { HomeClient } from './home-client';

export const metadata: Metadata = {
  title: 'Frego — Transforme clientes em fregueses',
  description:
    'A inteligência comercial que o pequeno negócio sempre deveria ter. A Frego mostra quem merece sua atenção — sem CRM, sem equipe de marketing.',
  keywords: [
    'fazer cliente voltar',
    'conhecer meus clientes',
    'relacionamento com clientes',
    'negócio local',
    'inteligência comercial',
    'campanha de fidelidade',
    'carimbos pontos cashback',
    'whatsapp para loja',
    'pequeno negócio',
  ],
  openGraph: {
    title: 'Frego — Transforme clientes em fregueses',
    description:
      'Você não precisa de um CRM para conhecer seus clientes. A Frego transforma as vendas em ação: quem sumiu, quem está perto de um benefício, quem chamar hoje.',
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
