'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { businessTypeLabel } from '@frego/tokens';
import { BusinessLogo, RemoteImg } from '@/components/remote-img';

export type PesquisaBrand = {
  businessName: string;
  businessType?: string | null;
  slogan?: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  primaryColor?: string | null;
  primaryColorDark?: string | null;
  address?: string | null;
  locationOpen?: boolean | null;
};

export function PesquisaBrandHeader({ brand }: { brand: PesquisaBrand }) {
  const name = brand.businessName.trim() || 'Estabelecimento';
  const letter = name.charAt(0).toUpperCase() || 'E';
  const primary = brand.primaryColor?.trim() || '#070707';
  const primaryDark = brand.primaryColorDark?.trim() || primary;
  const typeLabel = businessTypeLabel(brand.businessType) || 'Estabelecimento';
  const slogan = brand.slogan?.trim() || '';
  const address = brand.address?.trim() || '';
  const [heroFailed, setHeroFailed] = useState(false);
  const hero = brand.heroImageUrl?.trim() || '';

  useEffect(() => {
    setHeroFailed(false);
  }, [hero]);

  const showHero = hero.length > 0 && !heroFailed;

  return (
    <header>
      <div
        className="relative overflow-hidden"
        style={
          showHero
            ? undefined
            : { background: `linear-gradient(145deg, ${primary} 0%, ${primaryDark} 100%)` }
        }
      >
        {showHero ? (
          <>
            <div className="relative aspect-[2/1] max-h-[220px] w-full bg-[var(--color-neutral-200)]">
              <RemoteImg
                src={hero}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={() => setHeroFailed(true)}
              />
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
              aria-hidden
              style={{
                background: 'linear-gradient(180deg, transparent 0%, var(--color-bg) 100%)',
              }}
            />
          </>
        ) : (
          <div className="aspect-[2.4/1] max-h-[140px] w-full" aria-hidden />
        )}
      </div>
      <div className="relative mx-auto max-w-lg px-5">
        <div className="-mt-8 mb-3">
          <BusinessLogo
            src={brand.logoUrl}
            letter={letter}
            className="h-16 w-16 rounded-[18px] border-[3px] border-[var(--color-bg)] bg-[var(--color-neutral-200)] object-cover shadow-[0_8px_20px_rgba(16,24,40,0.14)]"
            letterClassName="flex h-16 w-16 items-center justify-center rounded-[18px] border-[3px] border-[var(--color-bg)] text-[24px] font-bold text-white shadow-[0_8px_20px_rgba(16,24,40,0.14)]"
            background={primary}
          />
        </div>
        <h1 className="text-[28px] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--color-ink)]">
          {name}
        </h1>
        <p className="mt-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-neutral-400)]">
          {typeLabel}
        </p>
        {slogan ? (
          <p className="mt-1 max-w-md text-[15px] leading-snug text-[var(--color-neutral-500)]">
            {slogan}
          </p>
        ) : null}
        {address ? (
          <p className="mt-2.5 inline-flex items-start gap-1.5 text-[13px] leading-snug text-[var(--color-neutral-500)]">
            <MapPin size={14} className="mt-0.5 shrink-0 text-[var(--color-neutral-400)]" aria-hidden />
            <span>
              {address}
              {brand.locationOpen === false ? (
                <span className="ml-2 font-medium text-[var(--color-neutral-600)]">· Fechado agora</span>
              ) : null}
            </span>
          </p>
        ) : null}
      </div>
    </header>
  );
}
