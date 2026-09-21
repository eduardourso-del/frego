'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FregoWordmark } from '@/components/brand';
import { RemoteImg, BusinessLogo } from '@/components/remote-img';
import { Banknote, Cake, Coins, MapPin, Percent, Stamp } from 'lucide-react';
import { businessTypeLabel } from '@frego/tokens';
import { promoHint } from '@/lib/promo-label';
import type {
  PublicShopCampaign,
  PublicShopPayload,
} from '@/components/public-shop/types';

const ease = [0.22, 1, 0.36, 1] as const;

function campaignHint(
  c: PublicShopCampaign,
  reaisPerPoint = 1,
): string {
  if (c.type === 'birthday') {
    return 'Presente especial no aniversário — e nos 6 dias seguintes';
  }
  if (c.type === 'promo') {
    return promoHint(c);
  }
  if (c.type === 'cashback') {
    const pct = c.cashbackPercent ?? 0;
    return pct > 0
      ? `${pct}% de cashback nas compras — use o saldo no caixa`
      : 'Parte do valor da compra volta em R$ para a próxima visita';
  }
  if (c.type === 'spend') {
    const pts = c.stampsNeeded ?? 0;
    const rate = c.pointsPerReal ?? reaisPerPoint;
    return `Acumule ${pts} ponto${pts === 1 ? '' : 's'} (a cada R$ ${rate} = 1 ponto) e ganhe o prêmio`;
  }
  const n = c.stampsNeeded ?? 0;
  return `Complete ${n} carimbo${n === 1 ? '' : 's'} e ganhe o prêmio`;
}

function CampaignTypeBadge({
  type,
  primaryColor,
}: {
  type: string;
  primaryColor: string;
}) {
  if (type === 'spend') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF8E8] px-2 py-0.5 text-[11px] font-semibold text-[#92400E]">
        <Coins size={12} strokeWidth={2.5} aria-hidden />
        Pontos
      </span>
    );
  }
  if (type === 'cashback') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-cashback-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-cashback)]">
        <Banknote size={12} strokeWidth={2.5} aria-hidden />
        Cashback
      </span>
    );
  }
  if (type === 'birthday') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF2F8] px-2 py-0.5 text-[11px] font-semibold text-[#9D174D]">
        <Cake size={12} strokeWidth={2.5} aria-hidden />
        Aniversário
      </span>
    );
  }
  if (type === 'promo') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-promo-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-promo)]">
        <Percent size={12} strokeWidth={2.5} aria-hidden />
        Promoção
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: `${primaryColor}1A`, color: primaryColor }}
    >
      <Stamp size={12} strokeWidth={2.5} aria-hidden />
      Carimbos
    </span>
  );
}

export function PublicShopPage({ data }: { data: PublicShopPayload }) {
  const { business, locations, campaigns } = data;
  const letter = business.name.trim().charAt(0).toUpperCase() || 'V';
  const primary = business.primaryColor || '#24479C';
  const primaryDark = business.primaryColorDark || '#1B3781';
  const location = locations[0];

  const hasHero = Boolean(business.heroImageUrl?.trim());

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-ink)]">
      {/*
        Split hero: photo/brand plane has no text.
        Identity sits on solid page background — readable on any cover photo
        and any brand color (including light grays).
      */}
      <header>
        <div
          className="relative overflow-hidden"
          style={
            hasHero
              ? undefined
              : {
                  background: `linear-gradient(145deg, ${primary} 0%, ${primaryDark} 100%)`,
                }
          }
        >
          {hasHero ? (
            <>
              <div className="relative aspect-[2/1] max-h-[220px] w-full bg-[var(--color-neutral-200)] sm:max-h-[240px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={business.heroImageUrl!}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              {/* Soft fade into page — polish only, no text on the photo */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
                aria-hidden
                style={{
                  background:
                    'linear-gradient(180deg, transparent 0%, var(--color-bg) 100%)',
                }}
              />
            </>
          ) : (
            <div
              className="aspect-[2.4/1] max-h-[140px] w-full sm:max-h-[160px]"
              aria-hidden
            >
              <div
                className="h-full w-full opacity-30"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
                  backgroundSize: '20px 20px',
                }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
                aria-hidden
                style={{
                  background:
                    'linear-gradient(180deg, transparent 0%, var(--color-bg) 100%)',
                }}
              />
            </div>
          )}
        </div>

        <div className="relative mx-auto max-w-lg px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease }}
            className="-mt-8 mb-3 sm:-mt-9"
          >
            <BusinessLogo
              src={business.logoUrl}
              letter={letter}
              className="h-16 w-16 rounded-[18px] border-[3px] border-[var(--color-bg)] bg-[var(--color-neutral-200)] object-cover shadow-[0_8px_20px_rgba(16,24,40,0.14)] sm:h-[72px] sm:w-[72px]"
              letterClassName="flex h-16 w-16 items-center justify-center rounded-[18px] border-[3px] border-[var(--color-bg)] text-[24px] font-bold text-white shadow-[0_8px_20px_rgba(16,24,40,0.14)] sm:h-[72px] sm:w-[72px] sm:text-[26px]"
              background={primary}
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.04, ease }}
            className="text-[28px] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[32px]"
          >
            {business.name}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06, ease }}
            className="mt-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-neutral-400)]"
          >
            {businessTypeLabel(business.type)}
          </motion.p>

          {business.slogan && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08, ease }}
              className="mt-1 max-w-md text-[15px] leading-snug text-[var(--color-neutral-500)]"
            >
              {business.slogan}
            </motion.p>
          )}

          {location?.address && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.12, ease }}
              className="mt-2.5 inline-flex items-start gap-1.5 text-[13px] leading-snug text-[var(--color-neutral-500)]"
            >
              <MapPin
                size={14}
                className="mt-0.5 shrink-0 text-[var(--color-neutral-400)]"
                aria-hidden
              />
              <span>
                {location.address}
                {!location.isOpen && (
                  <span className="ml-2 font-medium text-[var(--color-neutral-600)]">
                    · Fechado agora
                  </span>
                )}
              </span>
            </motion.p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 pb-10 pt-8 sm:px-8 sm:pb-12 sm:pt-10">
        <section>
          <h2 className="text-[22px] font-semibold tracking-[-0.03em]">
            Programa de fidelidade
          </h2>
          <p className="mt-1.5 text-[15px] text-[var(--color-neutral-500)]">
            Participe pelo app Frego e acumule recompensas nesta loja.
          </p>

          {campaigns.length === 0 ? (
            <p className="mt-8 rounded-[14px] border border-dashed border-[var(--color-hairline)] bg-[var(--color-card)] px-4 py-8 text-center text-[14px] text-[var(--color-neutral-500)]">
              Em breve novas campanhas por aqui.
            </p>
          ) : (
            <ul className="mt-6 flex flex-col gap-3">
              {campaigns.map((c, i) => (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: i * 0.06, ease }}
                  className={`overflow-hidden rounded-[16px] border shadow-[0_6px_16px_rgba(16,24,40,0.05)] ${
                    c.type === 'cashback'
                      ? 'border-[var(--color-cashback-ring)] bg-[var(--color-cashback-bg)]'
                      : 'border-[var(--color-hairline)] bg-white'
                  }`}
                >
                  <div
                    className="h-[3px]"
                    style={{
                      background:
                        c.type === 'cashback'
                          ? 'var(--color-cashback)'
                          : primary,
                    }}
                  />
                  <div className="flex gap-3 p-4">
                    {c.rewardImageUrl ? (
                      <RemoteImg
                        src={c.rewardImageUrl}
                        className="h-16 w-16 shrink-0 rounded-[12px] object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[12px]"
                        style={{ background: `${primary}14` }}
                        aria-hidden
                      >
                        {c.type === 'spend' ? (
                          <Coins size={22} style={{ color: primary }} />
                        ) : c.type === 'birthday' ? (
                          <Cake size={22} className="text-[#9D174D]" />
                        ) : c.type === 'cashback' ? (
                          <Banknote size={22} className="text-[var(--color-cashback)]" />
                        ) : c.type === 'promo' ? (
                          <Percent size={22} className="text-[var(--color-promo)]" />
                        ) : (
                          <Stamp size={22} style={{ color: primary }} />
                        )}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">
                          {c.name}
                        </p>
                        <CampaignTypeBadge
                          type={c.type}
                          primaryColor={primary}
                        />
                      </div>
                      <p className="mt-1 text-[13px] font-medium text-[var(--color-ink)]">
                        {c.rewardTitle?.trim() || 'Recompensa'}
                      </p>
                      {c.rewardDescription?.trim() && (
                        <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--color-neutral-500)]">
                          {c.rewardDescription}
                        </p>
                      )}
                      <p className="mt-2 text-[12px] text-[var(--color-neutral-400)]">
                        {campaignHint(c, business.pointsPerReal ?? 1)}
                      </p>
                    </div>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-[22px] font-semibold tracking-[-0.03em]">
            Como participar
          </h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
            Baixe o app Frego, entre com seu telefone e encontre{' '}
            <span className="font-medium text-[var(--color-ink)]">
              {business.name}
            </span>{' '}
            para começar a acumular.
          </p>
          <a
            href="#app"
            id="app"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-[14px] px-6 text-[15px] font-semibold text-white shadow-[var(--shadow-cta)] transition-[transform,opacity] hover:opacity-95 active:scale-[0.98] sm:w-auto"
            style={{ background: primary }}
          >
            Participar no app Frego
          </a>
          <p className="mt-3 text-[13px] text-[var(--color-neutral-400)]">
            App Store e Google Play em breve. Peça o QR Code no balcão.
          </p>
        </section>
      </main>

      <footer className="border-t border-[var(--color-hairline)] py-8">
        <Link href="/" className="mx-auto flex justify-center" aria-label="Frego">
          <FregoWordmark height={28} />
        </Link>
      </footer>
    </div>
  );
}
