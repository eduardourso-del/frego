'use client';

import { useEffect } from 'react';
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  StoreBadges,
} from '@/components/store-badges';

export type CheckInCard = {
  businessName: string;
  rewardTitle: string | null;
  stampsNeeded: number;
  status: string;
  appUrl: string;
  name: string;
};

export function CheckInDoor({
  card = null,
  missing = false,
  unavailable = false,
}: {
  card?: CheckInCard | null;
  missing?: boolean;
  unavailable?: boolean;
}) {
  useEffect(() => {
    if (!card || card.status !== 'active') return;
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua);
    const android = /Android/i.test(ua);
    if (!ios && !android) return;

    let left = false;
    const markLeft = () => {
      if (document.hidden) left = true;
    };
    const onHide = () => {
      left = true;
    };
    document.addEventListener('visibilitychange', markLeft);
    window.addEventListener('pagehide', onHide);
    window.location.href = card.appUrl;

    const timer = window.setTimeout(() => {
      if (left || document.hidden) return;
      window.location.href = ios ? APP_STORE_URL : PLAY_STORE_URL;
    }, 1800);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', markLeft);
      window.removeEventListener('pagehide', onHide);
    };
  }, [card]);

  const needed = card?.stampsNeeded ?? 1;
  const open = card?.status === 'active';

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10 text-center text-[var(--color-ink)]">
      {missing ? (
        <p className="text-[16px]">Esse QR não está mais valendo.</p>
      ) : unavailable || !card ? (
        <p className="text-[16px] text-[var(--color-neutral-500)]">
          Não foi possível abrir o check-in.
        </p>
      ) : (
        <>
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-500)]">
            {card.businessName}
          </p>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.03em]">
            {card.rewardTitle?.trim() || card.name}
          </h1>
          <p className="mt-2 text-[18px]">
            A cada {needed} check-in{needed === 1 ? '' : 's'}
          </p>
          <p className="mt-4 text-[14px] text-[var(--color-neutral-500)]">
            {open
              ? 'Abra o Frego para registrar o check-in de hoje.'
              : 'Essa campanha não está aceitando check-in agora.'}
          </p>
          {open ? (
            <a
              href={card.appUrl}
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-[14px] bg-[var(--color-primary-500)] px-5 text-[15px] font-semibold text-white"
            >
              Fazer check-in
            </a>
          ) : null}
          <div className="mt-8">
            <StoreBadges className="justify-center" />
          </div>
        </>
      )}
    </main>
  );
}
