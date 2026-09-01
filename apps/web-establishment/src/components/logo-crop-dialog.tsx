'use client';

import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';

type ImageCropDialogProps = {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
  busy?: boolean;
  /** Crop aspect ratio. Default 1 (square logo). */
  aspect?: number;
  title?: string;
  description?: string;
  fileNamePrefix?: string;
  /** Output width in px. Height derived from aspect. */
  outputWidth?: number;
};

async function cropToFile(
  imageSrc: string,
  area: Area,
  opts: { outputWidth: number; aspect: number; fileNamePrefix: string },
): Promise<File> {
  const image = await loadImage(imageSrc);
  const outputWidth = opts.outputWidth;
  const outputHeight = Math.round(outputWidth / opts.aspect);
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas não disponível');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outputWidth, outputHeight);

  const natW = image.naturalWidth || image.width;
  const natH = image.naturalHeight || image.height;

  const sx = Math.max(0, area.x);
  const sy = Math.max(0, area.y);
  const ex = Math.min(natW, area.x + area.width);
  const ey = Math.min(natH, area.y + area.height);
  const sw = ex - sx;
  const sh = ey - sy;

  if (sw > 0 && sh > 0) {
    const dx = ((sx - area.x) / area.width) * outputWidth;
    const dy = ((sy - area.y) / area.height) * outputHeight;
    const dw = (sw / area.width) * outputWidth;
    const dh = (sh / area.height) * outputHeight;
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))),
      'image/jpeg',
      0.9,
    );
  });

  return new File([blob], `${opts.fileNamePrefix}-${Date.now()}.jpg`, {
    type: 'image/jpeg',
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', () =>
      reject(new Error('Não foi possível carregar a imagem')),
    );
    img.src = src;
  });
}

/** @deprecated Prefer ImageCropDialog — kept as alias for logo square crop. */
export function LogoCropDialog(props: ImageCropDialogProps) {
  return <ImageCropDialog {...props} aspect={props.aspect ?? 1} />;
}

export function ImageCropDialog({
  imageSrc,
  onCancel,
  onConfirm,
  busy = false,
  aspect = 1,
  title = 'Ajustar imagem',
  description = 'Arraste e use o zoom para enquadrar.',
  fileNamePrefix = 'image',
  outputWidth = aspect === 1 ? 512 : 1600,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  async function handleConfirm() {
    if (!croppedArea || busy || saving) return;
    setSaving(true);
    setError(null);
    try {
      const file = await cropToFile(imageSrc, croppedArea, {
        outputWidth,
        aspect,
        fileNamePrefix,
      });
      await onConfirm(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível recortar.');
      setSaving(false);
    }
  }

  const locked = busy || saving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-crop-title"
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-[16px] bg-[var(--color-card)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[var(--color-hairline)] px-5 py-4">
          <h2
            id="image-crop-title"
            className="text-[17px] font-semibold text-[var(--color-ink)]"
          >
            {title}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
            {description}
          </p>
        </div>

        <div
          className="relative bg-white"
          style={{ height: aspect < 1.2 ? 320 : 240 }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={1}
            maxZoom={4}
            aspect={aspect}
            objectFit="contain"
            cropShape="rect"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            classes={{
              containerClassName: 'bg-white',
              mediaClassName: '',
            }}
          />
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <label className="flex items-center gap-3 text-[13px] text-[var(--color-neutral-600)]">
            <span className="w-12 shrink-0 font-medium">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              disabled={locked}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[var(--color-primary-500)]"
            />
          </label>

          {error && (
            <p className="text-[13px] text-[var(--color-danger)]">{error}</p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={locked}
              className="min-h-10 rounded-[10px] border border-[var(--color-hairline)] px-4 text-[13px] font-semibold text-[var(--color-neutral-600)] disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={locked || !croppedArea}
              className="min-h-10 rounded-[10px] bg-[var(--color-primary-500)] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              {locked ? 'Salvando…' : 'Usar este recorte'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
