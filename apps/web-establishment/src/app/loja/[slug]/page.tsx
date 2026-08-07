import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicShopPage } from '@/components/public-shop/public-shop-page';
import type { PublicShopPayload } from '@/components/public-shop/types';
import { API_URL } from '@/lib/api';

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function fetchPublicShop(
  slug: string,
): Promise<PublicShopPayload | null> {
  try {
    const res = await fetch(
      `${API_URL}/public/businesses/${encodeURIComponent(slug)}`,
      { next: { revalidate: 30 } },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as PublicShopPayload;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchPublicShop(slug);
  if (!data) {
    return { title: 'Loja não encontrada' };
  }
  return {
    title: data.business.name,
    description:
      data.business.slogan ??
      `Programa de fidelidade de ${data.business.name} no Frego`,
  };
}

export default async function LojaPublicPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await fetchPublicShop(slug);
  if (!data) notFound();
  return <PublicShopPage data={data} />;
}
