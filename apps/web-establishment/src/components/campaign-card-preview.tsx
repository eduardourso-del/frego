'use client';

import { useState } from 'react';
import { Cake, Coins, Gift, ImageIcon, Stamp } from 'lucide-react';

type CampaignCardPreviewProps = {
  businessName: string;
  businessLogoUrl?: string | null;
  primaryColor: string;
  primaryColorDark?: string;
  campaignName: string;
  campaignType: 'stamps' | 'spend' | 'birthday';
  unitsNeeded: number;
  pointsPerReal?: number;
  rewardTitle: string;
  rewardDescription?: string;
  rewardImageUrl?: string | null;
};

/** Cartão como o cliente vê — superfície clara, marca só como acento. */
export function CampaignCardPreview({
  businessName,
  businessLogoUrl,
  primaryColor,
  campaignName,
  campaignType,
  unitsNeeded,
  pointsPerReal = 1,
  rewardTitle,
  rewardDescription,
  rewardImageUrl,
}: CampaignCardPreviewProps) {
  const needed = Math.max(2, Math.min(unitsNeeded || 10, 8));
  const sampleProgress =
    campaignType === 'stamps'
      ? Math.min(3, needed - 1)
      : Math.min(Math.round(needed * 0.35), needed - 1);
  const remaining = Math.max(0, needed - sampleProgress);
  const letter = businessName.trim().charAt(0).toUpperCase() || 'V';
  const reward = rewardTitle.trim() || 'Recompensa';
  const hasImage = Boolean(rewardImageUrl?.trim());

  return (
    <div>
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
        Preview ao vivo · cartão do cliente
      </p>

      <div className="overflow-hidden rounded-[16px] border border-[var(--color-hairline)] bg-white text-[var(--color-ink)] shadow-[0_6px_16px_rgba(16,24,40,0.06)]">
        <div className="h-[3px]" style={{ background: primaryColor }} />

        <div className="p-3.5">
          <div className="flex items-center gap-2">
            {businessLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={businessLogoUrl}
                alt=""
                className="h-6 w-6 rounded-[7px] object-cover"
              />
            ) : (
              <div
                className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[11px] font-semibold"
                style={{
                  background: `${primaryColor}1F`,
                  color: primaryColor,
                }}
                aria-hidden
              >
                {letter}
              </div>
            )}
            <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--color-neutral-500)]">
              {businessName}
            </p>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                campaignType === 'spend'
                  ? 'bg-[#FFF8E8] text-[#92400E]'
                  : campaignType === 'birthday'
                    ? 'bg-[#FDF2F8] text-[#9D174D]'
                    : ''
              }`}
              style={
                campaignType === 'stamps'
                  ? {
                      background: `${primaryColor}1A`,
                      color: primaryColor,
                    }
                  : undefined
              }
            >
              {campaignType === 'spend' ? (
                <Coins size={11} strokeWidth={2.5} aria-hidden />
              ) : campaignType === 'birthday' ? (
                <Cake size={11} strokeWidth={2.5} aria-hidden />
              ) : (
                <Stamp size={11} strokeWidth={2.5} aria-hidden />
              )}
              {campaignType === 'spend'
                ? 'Pontos'
                : campaignType === 'birthday'
                  ? 'Aniversário'
                  : 'Carimbos'}
            </span>
          </div>

          <div className="mt-2.5 flex items-start gap-3">
            {hasImage && (
              <RewardThumb src={rewardImageUrl!} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">
                {campaignName.trim() || 'Sua campanha'}
              </p>

              {campaignType === 'birthday' ? (
                <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-[#FDF2F8] px-2.5 py-2">
                  <span className="text-[14px]">🎂</span>
                  <p className="text-[11px] font-medium text-[#9D174D]">
                    {reward} · 1× ao ano
                  </p>
                </div>
              ) : campaignType === 'stamps' ? (
                <>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Array.from({ length: needed }).map((_, i) => {
                      const filled = i < sampleProgress;
                      const isGift = i === needed - 1;
                      return (
                        <div
                          key={i}
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                            filled || isGift
                              ? 'text-white'
                              : 'border-[1.4px] border-[var(--color-neutral-200)] bg-transparent'
                          }`}
                          style={
                            filled || isGift
                              ? { background: primaryColor }
                              : undefined
                          }
                          aria-hidden
                        >
                          {isGift ? (
                            <Gift size={12} strokeWidth={2.25} />
                          ) : filled ? (
                            <Stamp size={12} strokeWidth={2.25} />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-[var(--color-neutral-500)]">
                    {sampleProgress}/{needed}
                    {remaining > 0 ? ` · faltam ${remaining}` : ''}
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span
                      className="text-[22px] font-semibold tracking-[-0.02em] leading-none"
                      style={{ color: primaryColor }}
                    >
                      {sampleProgress}
                    </span>
                    <span className="text-[12px] text-[var(--color-neutral-500)]">
                      / {needed} pts
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (sampleProgress / needed) * 100)}%`,
                        background: primaryColor,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-[var(--color-neutral-500)]">
                    {pointsPerReal} pt/R$1
                    {remaining > 0 ? ` · faltam ${remaining}` : ''}
                  </p>
                </>
              )}
            </div>
          </div>

          {!hasImage && campaignType !== 'birthday' && (
            <p className="mt-2 truncate text-[12px] font-medium text-[var(--color-neutral-500)]">
              {reward}
              {rewardDescription?.trim()
                ? ` · ${rewardDescription.trim()}`
                : ''}
            </p>
          )}

          <button
            type="button"
            disabled
            className="mt-3 flex min-h-9 w-full items-center justify-center rounded-[11px] text-[13px] font-semibold text-white"
            style={{ background: primaryColor }}
          >
            Continuar acumulando
          </button>
        </div>
      </div>

      <p className="mt-2 text-[12px] text-[var(--color-neutral-400)]">
        Assim o cartão aparece no app do cliente.
      </p>
    </div>
  );
}

function RewardThumb({ src }: { src: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[12px] bg-[var(--color-neutral-200)]">
      {status !== 'ready' && (
        <span
          className="absolute inset-0 flex items-center justify-center text-[var(--color-neutral-400)]"
          aria-hidden
        >
          <ImageIcon size={18} strokeWidth={1.75} />
        </span>
      )}
      {status !== 'error' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          className={`h-full w-full object-cover transition-opacity ${
            status === 'ready' ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setStatus('ready')}
          onError={() => setStatus('error')}
        />
      )}
    </div>
  );
}
