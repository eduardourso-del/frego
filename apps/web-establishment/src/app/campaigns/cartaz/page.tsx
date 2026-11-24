'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { FregoWordmark } from '@/components/brand';
import { BusinessLogo } from '@/components/remote-img';
import { useBusiness } from '@/lib/business-context';
import { API_URL } from '@/lib/api';

type Campaign = {
  id: string;
  name: string;
  type: string;
  stampsNeeded: number | null;
  rewardTitle: string | null;
  checkInToken: string | null;
  status: string;
};

function Cartaz() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const router = useRouter();
  const { business, authHeaders, loading } = useBusiness();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState<'cartaz' | 'adesivo'>('cartaz');

  useEffect(() => {
    if (!id || loading) return;
    let cancel = false;
    (async () => {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/campaigns`, { headers });
      const json = await res.json().catch(() => ({}));
      if (cancel) return;
      if (!res.ok) {
        setError('Não foi possível abrir o cartaz.');
        return;
      }
      const found = ((json.campaigns ?? []) as Campaign[]).find(
        (item) => item.id === id && item.type === 'checkin',
      );
      if (!found?.checkInToken) {
        setError('Essa campanha não tem QR.');
        return;
      }
      setError(null);
      setCampaign(found);
    })().catch(() => setError('Não foi possível abrir o cartaz.'));
    return () => {
      cancel = true;
    };
  }, [authHeaders, id, loading]);

  const token = campaign?.checkInToken;

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    setQr(null);
    const local =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    (async () => {
      if (local) {
        const port = window.location.port || '3000';
        const res = await fetch(`/api/local-origin?port=${encodeURIComponent(port)}`);
        const json = (await res.json()) as { origin?: string | null };
        if (cancel) return;
        setUrl(`${json.origin || window.location.origin}/c/${token}`);
        return;
      }
      const res = await fetch(
        `${API_URL}/public/check-ins/${encodeURIComponent(token)}`,
      );
      if (!res.ok) throw new Error('missing');
      const json = (await res.json()) as { url?: string };
      if (!cancel) setUrl(json.url || `${window.location.origin}/c/${token}`);
    })().catch(() => {
      if (!cancel) setError('Não foi possível gerar o QR.');
    });
    return () => {
      cancel = true;
    };
  }, [token]);

  useEffect(() => {
    if (!url) return;
    let cancel = false;
    import('qrcode')
      .then((QR) => QR.toDataURL(url, { margin: 1, width: 640 }))
      .then((data) => {
        if (!cancel) setQr(data);
      })
      .catch(() => setError('Não foi possível gerar o QR.'));
    return () => {
      cancel = true;
    };
  }, [url]);

  async function rotate() {
    if (!campaign) return;
    setBusy(true);
    setError(null);
    try {
      const headers = {
        ...(await authHeaders()),
        'Content-Type': 'application/json',
      };
      const res = await fetch(`${API_URL}/campaigns/${campaign.id}/check-in-token`, {
        method: 'POST',
        headers,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Não foi possível trocar o QR.');
      setCampaign((current) =>
        current ? { ...current, checkInToken: json.token as string } : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível trocar o QR.');
    } finally {
      setBusy(false);
    }
  }

  const needed = campaign?.stampsNeeded ?? 1;
  const prize = campaign?.rewardTitle?.trim() || 'o prêmio';
  const shop = business?.name ?? 'Estabelecimento';
  const letter = shop.trim().charAt(0).toUpperCase() || 'E';

  return (
    <AppShell businessName={business?.name} title="Cartaz">
      <div className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-lg flex-col pt-6">
        <div className="mb-8 flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => router.push('/campaigns')}
            className="min-h-10 rounded-[10px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold"
          >
            Voltar
          </button>
          <div className="flex rounded-[10px] border border-[var(--color-hairline)] p-0.5">
            {(
              [
                ['adesivo', 'Adesivo'],
                ['cartaz', 'Cartaz'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSize(value)}
                className={`min-h-9 rounded-[8px] px-3 text-[13px] font-semibold ${
                  size === value
                    ? 'bg-[var(--color-ink)] text-white'
                    : 'text-[var(--color-neutral-500)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-10 rounded-[10px] bg-[var(--color-primary-500)] px-3 text-[13px] font-semibold text-white"
          >
            Imprimir
          </button>
          <button
            type="button"
            disabled={busy || !campaign}
            onClick={() => void rotate()}
            className="min-h-10 rounded-[10px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold disabled:opacity-60"
          >
            Novo QR
          </button>
        </div>
        {error ? (
          <p className="mb-3 text-[13px] text-[var(--color-danger)]">{error}</p>
        ) : null}
        <div className="flex flex-1 items-start justify-center pt-10">
          <article
            data-size={size}
            className="cartaz-sheet w-[420px] max-w-full overflow-hidden rounded-[24px] border border-[var(--color-hairline)] bg-white text-center text-[var(--color-ink)]"
          >
            <div className="px-8 pb-8 pt-14">
              <BusinessLogo
                src={business?.logoUrl}
                letter={letter}
                className="mx-auto h-16 w-16 rounded-[18px] object-cover"
                letterClassName="mx-auto flex h-16 w-16 items-center justify-center rounded-[18px] text-[24px] font-bold text-white"
                background={business?.primaryColor ?? '#070707'}
              />
              <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-500)]">
                {shop}
              </p>
              <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em]">
                {prize}
              </h1>
              <p className="mt-2 text-[18px]">
                A cada {needed} check-in{needed === 1 ? '' : 's'}
              </p>
              <div className="mx-auto mt-8 w-[240px]">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt="QR do check-in" className="h-auto w-full" />
                ) : (
                  <div className="aspect-square w-full bg-[var(--color-neutral-100)]" />
                )}
              </div>
              <p className="mt-4 text-[13px] text-[var(--color-neutral-500)]">
                Aponte a câmera do celular
              </p>
            </div>
            <footer
              className="cartaz-footer flex items-center justify-center px-6 py-4"
              style={{ backgroundColor: '#FFD900' }}
            >
              <FregoWordmark height={26} />
            </footer>
          </article>
        </div>
      </div>
      <style>{`
        @media screen {
          .cartaz-sheet[data-size='adesivo'] {
            zoom: 0.68;
          }
        }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body, body * { overflow: visible !important; }
          body * { visibility: hidden; }
          .cartaz-sheet, .cartaz-sheet * { visibility: visible; }
          .cartaz-sheet {
            position: absolute;
            left: 50%;
            top: 12mm;
            width: 420px !important;
            max-width: none !important;
            zoom: 1 !important;
            transform-origin: top center;
            border-radius: 0 !important;
            border: 1px solid #070707;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .cartaz-sheet[data-size='cartaz'] {
            transform: translateX(-50%) scale(1.38);
          }
          .cartaz-sheet[data-size='adesivo'] {
            transform: translateX(-50%) scale(0.6);
          }
          .cartaz-footer {
            background-color: #FFD900 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </AppShell>
  );
}

export default function CartazPage() {
  return (
    <Suspense fallback={null}>
      <Cartaz />
    </Suspense>
  );
}
