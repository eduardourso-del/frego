'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { parseScannedVoucherCodigo } from '@/lib/voucher';

type BarcodeDetectorLike = {
  detect: (
    source: CanvasImageSource,
  ) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector():
  | (new (opts?: { formats?: string[] }) => BarcodeDetectorLike)
  | undefined {
  return (
    window as unknown as {
      BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
    }
  ).BarcodeDetector;
}

export function VoucherScanSheet({
  onClose,
  onCode,
}: {
  onClose: () => void;
  onCode: (codigo: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const handledRef = useRef(false);
  const busyRef = useRef(false);
  const onCodeRef = useRef(onCode);
  const [error, setError] = useState<string | null>(null);
  const [junk, setJunk] = useState<string | null>(null);

  onCodeRef.current = onCode;

  useEffect(() => {
    let cancelled = false;
    const Detector = getBarcodeDetector();
    const detector = Detector
      ? new Detector({ formats: ['qr_code'] })
      : null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Sem câmera. Digite o código.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        tick();
      } catch {
        if (!cancelled) setError('Sem câmera. Digite o código.');
      }
    }

    function accept(raw: string) {
      if (handledRef.current) return;
      const codigo = parseScannedVoucherCodigo(raw);
      if (!codigo) {
        setJunk('Não é um voucher Frego');
        return;
      }
      handledRef.current = true;
      onCodeRef.current(codigo);
    }

    async function decodeFrame() {
      if (cancelled || handledRef.current || busyRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
        return;
      }
      busyRef.current = true;
      try {
        if (detector) {
          const codes = await detector.detect(video);
          const raw = codes[0]?.rawValue;
          if (raw) accept(raw);
          return;
        }
        const canvas = canvasRef.current;
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!canvas || !w || !h) return;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const image = ctx.getImageData(0, 0, w, h);
        const code = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code?.data) accept(code.data);
      } catch {
        /* keep scanning */
      } finally {
        busyRef.current = false;
      }
    }

    function tick() {
      if (cancelled || handledRef.current) return;
      void decodeFrame();
      rafRef.current = window.requestAnimationFrame(tick);
    }

    void start();
    const video = videoRef.current;

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (video) video.srcObject = null;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 pb-[calc(13.5rem+env(safe-area-inset-bottom))] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voucher-scan-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-[22px] bg-[var(--color-card)] shadow-[var(--shadow-raised)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5">
          <p
            id="voucher-scan-title"
            className="text-[18px] font-semibold text-[var(--color-ink)]"
          >
            Escanear voucher
          </p>
          <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
            Aponte para o código no celular do cliente
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-5 pt-4">
          <div className="relative aspect-square overflow-hidden rounded-[16px] bg-[var(--color-neutral-100)]">
            {error ? (
              <p className="flex h-full items-center justify-center px-6 text-center text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
                {error}
              </p>
            ) : (
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                autoPlay
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          {junk ? (
            <p className="mt-3 text-center text-[14px] font-semibold text-[var(--color-danger)]">
              {junk}
            </p>
          ) : null}
        </div>
        <div className="px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 w-full rounded-[10px] border border-[var(--color-hairline)] text-[15px] font-semibold text-[var(--color-ink)]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
