'use client';

import { Heart } from 'lucide-react';
import { businessTypeLabel } from '@frego/tokens';
import { BusinessLogo } from '@/components/remote-img';

/** Cartão da lista de lojas no app do cliente. */
export function ShopAppPreview({
  name,
  type,
  slogan,
  logoUrl,
  primaryColor,
}: {
  name: string;
  type: string;
  slogan: string;
  logoUrl: string;
  primaryColor: string;
}) {
  const letter = (name || 'V').trim().charAt(0).toUpperCase() || 'V';
  const displayName = name.trim() || 'Sua loja';
  const typeLabel = businessTypeLabel(type) || type || 'Estabelecimento';
  const sloganText = slogan.trim();

  return (
    <div>
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
        Preview ao vivo · cartão do cliente
      </p>

      <div
        className="overflow-hidden rounded-[18px] border border-[var(--color-hairline)] bg-[var(--color-card)] text-[var(--color-ink)]"
        style={{
          boxShadow: '0 8px 18px rgba(0,0,0,0.045)',
        }}
      >
        <div className="flex items-start py-4 pl-4 pr-1">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[12px]">
            <BusinessLogo
              src={logoUrl || null}
              letter={letter}
              className="h-12 w-12 object-cover"
              letterClassName="flex h-12 w-12 items-center justify-center text-[20px] font-bold text-white"
              background={primaryColor}
            />
          </div>
          <div className="ml-3.5 min-w-0 flex-1 pt-px">
            <p className="text-[11px] font-semibold tracking-[0.04em] text-[var(--color-neutral-400)]">
              {typeLabel}
            </p>
            <p className="truncate text-[16px] font-bold tracking-[-0.02em] text-[var(--color-ink)]">
              {displayName}
            </p>
            {sloganText ? (
              <p className="mt-0.5 truncate text-[13px] text-[var(--color-neutral-500)]">
                {sloganText}
              </p>
            ) : (
              <p className="mt-0.5 truncate text-[13px] text-[var(--color-neutral-400)]">
                Slogan aparece aqui
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[var(--color-stamps-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--color-stamps)]">
                3 carimbos
              </span>
              <span className="rounded-full bg-[var(--color-points-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--color-points)]">
                120 pts
              </span>
            </div>
          </div>
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--color-neutral-400)]"
            aria-hidden
          >
            <Heart size={22} strokeWidth={1.75} />
          </span>
        </div>
      </div>

      <p className="mt-2 text-[12px] text-[var(--color-neutral-400)]">
        Assim o cartão aparece na lista de lojas do app.
      </p>
    </div>
  );
}
