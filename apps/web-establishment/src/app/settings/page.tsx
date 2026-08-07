'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  ImageCropDialog,
  LogoCropDialog,
} from '@/components/logo-crop-dialog';
import { WhatsAppSettingsCard } from '@/components/whatsapp-settings-card';
import { useBusiness } from '@/lib/business-context';
import { uploadBusinessHero, uploadBusinessLogo } from '@/lib/firebase';

const TYPES = [
  { value: 'café', label: 'Café' },
  { value: 'restaurant', label: 'Restaurante' },
  { value: 'beauty', label: 'Beleza' },
  { value: 'retail', label: 'Varejo' },
  { value: 'pet', label: 'Pet' },
];

const HERO_ASPECT = 16 / 9;

export default function SettingsPage() {
  const { business, loading, updateBusiness } = useBusiness();
  const [name, setName] = useState('');
  const [type, setType] = useState('café');
  const [slogan, setSlogan] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3B5BDB');
  const [primaryColorDark, setPrimaryColorDark] = useState('#2F49C4');
  const [pointsPerReal, setPointsPerReal] = useState(1);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropKind, setCropKind] = useState<'logo' | 'hero' | null>(null);

  useEffect(() => {
    if (!business) return;
    setName(business.name);
    setType(business.type);
    setSlogan(business.slogan ?? '');
    setSlug(business.slug ?? '');
    setLogoUrl(business.logoUrl ?? '');
    setHeroImageUrl(business.heroImageUrl ?? '');
    setPrimaryColor(business.primaryColor);
    setPrimaryColorDark(business.primaryColorDark);
    setPointsPerReal(business.pointsPerReal ?? 1);
  }, [business]);

  useEffect(() => {
    return () => {
      if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      await updateBusiness({
        name,
        type,
        slogan: slogan || null,
        slug: slug || null,
        logoUrl: logoUrl || null,
        heroImageUrl: heroImageUrl || null,
        primaryColor,
        primaryColorDark,
        pointsPerReal,
      });
      setToast('Perfil da loja salvo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setBusy(false);
    }
  }

  function openImagePicker(file: File | undefined, kind: 'logo' | 'hero') {
    if (!file || !business?.id) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem (JPG, PNG ou WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem até 5 MB');
      return;
    }
    setError(null);
    setToast(null);
    if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
    setCropKind(kind);
    setCropSrc(URL.createObjectURL(file));
  }

  async function uploadCroppedLogo(file: File) {
    if (!business?.id) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadBusinessLogo(business.id, file);
      setLogoUrl(url);
      await updateBusiness({ logoUrl: url });
      if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      setCropKind(null);
      setToast('Logo atualizado — aparece no menu e no cartão');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload');
      throw err;
    } finally {
      setUploading(false);
    }
  }

  async function uploadCroppedHero(file: File) {
    if (!business?.id) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadBusinessHero(business.id, file);
      setHeroImageUrl(url);
      await updateBusiness({ heroImageUrl: url });
      if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      setCropKind(null);
      setToast('Capa atualizada — aparece na página pública e no app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload');
      throw err;
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    setLogoUrl('');
    setError(null);
    try {
      await updateBusiness({ logoUrl: null });
      setToast('Logo removido');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover');
    }
  }

  async function removeHero() {
    setHeroImageUrl('');
    setError(null);
    try {
      await updateBusiness({ heroImageUrl: null });
      setToast('Capa removida');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover');
    }
  }

  function closeCrop() {
    if (uploading) return;
    if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropKind(null);
  }

  const letter = (name || 'V').trim().charAt(0).toUpperCase();

  return (
    <AppShell
      title="Configurações"
      topbar={
        <header className="flex h-[60px] items-center border-b border-[var(--color-hairline)] bg-[var(--color-card)] px-7">
          <h1 className="text-[17px] font-semibold text-[var(--color-ink)]">
            Configurações
          </h1>
        </header>
      }
    >
      <div className="mx-auto max-w-xl px-4 py-6 md:px-7 md:py-8">
        <h1 className="mb-2 text-[26px] font-semibold tracking-[-0.03em] text-[var(--color-ink)] md:hidden">
          Configurações
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
          Perfil da loja: logo, cores e texto. O logo aparece no menu lateral e
          nos cartões do cliente.
        </p>
        {loading && !business ? (
          <div className="h-40 animate-pulse rounded-[14px] bg-[var(--color-neutral-100)]" />
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            {/* Perfil / logo */}
            <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                Perfil do estabelecimento
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <div
                  className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-bg)] text-[28px] font-bold text-white"
                  style={
                    logoUrl
                      ? undefined
                      : { background: primaryColor }
                  }
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt={`Logo ${name || 'da loja'}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    letter
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-semibold text-[var(--color-ink)]">
                    {name || 'Sua loja'}
                  </p>
                  <p className="mt-0.5 text-[13px] text-[var(--color-neutral-500)]">
                    {slogan || 'Slogan aparece aqui'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[12px] bg-[var(--color-primary-500)] px-3.5 text-[13px] font-semibold text-white shadow-[var(--shadow-cta)]">
                      {uploading
                        ? 'Enviando…'
                        : logoUrl
                          ? 'Trocar / ajustar logo'
                          : 'Enviar logo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={uploading || !business?.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          openImagePicker(file, 'logo');
                        }}
                      />
                    </label>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => void removeLogo()}
                        disabled={uploading || busy}
                        className="min-h-10 rounded-[12px] border border-[var(--color-hairline)] px-3.5 text-[13px] font-semibold text-[var(--color-neutral-600)] disabled:opacity-60"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-[12px] text-[var(--color-neutral-400)]">
                    JPG, PNG ou WebP · até 5 MB · recorte quadrado obrigatório
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                Imagem de capa
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
                Aparece no topo da página pública e no detalhe da loja no app.
              </p>
              <div className="mt-4 overflow-hidden rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-bg)]">
                {heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={heroImageUrl}
                    alt="Capa da loja"
                    className="aspect-[16/9] w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex aspect-[16/9] w-full items-center justify-center text-[13px] text-[var(--color-neutral-400)]"
                    style={{
                      background: `linear-gradient(140deg, ${primaryColor}, ${primaryColorDark})`,
                    }}
                  >
                    <span className="rounded-full bg-black/25 px-3 py-1 text-white/90">
                      Sem capa — usa o degradê da marca
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-[12px] bg-[var(--color-primary-500)] px-3.5 text-[13px] font-semibold text-white shadow-[var(--shadow-cta)]">
                  {uploading
                    ? 'Enviando…'
                    : heroImageUrl
                      ? 'Trocar / ajustar capa'
                      : 'Enviar capa'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={uploading || !business?.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      openImagePicker(file, 'hero');
                    }}
                  />
                </label>
                {heroImageUrl && (
                  <button
                    type="button"
                    onClick={() => void removeHero()}
                    disabled={uploading || busy}
                    className="min-h-10 rounded-[12px] border border-[var(--color-hairline)] px-3.5 text-[13px] font-semibold text-[var(--color-neutral-600)] disabled:opacity-60"
                  >
                    Remover capa
                  </button>
                )}
              </div>
              <p className="mt-2 text-[12px] text-[var(--color-neutral-400)]">
                JPG, PNG ou WebP · até 5 MB · recorte 16:9
              </p>
            </section>

            <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
              Nome
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[17px]"
                required
              />
            </label>

            <fieldset>
              <legend className="text-[13px] font-semibold uppercase tracking-[0.04em]">
                Tipo
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`min-h-9 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                      type === t.value
                        ? 'bg-[var(--color-primary-500)] text-white shadow-[var(--shadow-cta)]'
                        : 'bg-[var(--color-bg)] text-[var(--color-neutral-600)] ring-1 ring-[var(--color-hairline)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
              Slogan
              <input
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[17px]"
                placeholder="Café que faz voltar"
              />
            </label>

            <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
              Slug (página pública)
              <input
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, '-'),
                  )
                }
                className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 font-mono text-[15px]"
                placeholder="bloom-coffee"
              />
              <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-normal normal-case tracking-normal text-[var(--color-neutral-400)]">
                {slug.trim()
                  ? `URL: /loja/${slug.trim()}`
                  : 'Defina um slug para publicar a página'}
              </span>
            </label>

            <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
              Pontos por R$ 1
              <input
                type="number"
                min={1}
                max={1000}
                value={pointsPerReal}
                onChange={(e) =>
                  setPointsPerReal(Math.max(1, Number(e.target.value) || 1))
                }
                className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[17px]"
              />
              <span className="mt-1 block text-[12px] font-normal normal-case tracking-normal text-[var(--color-neutral-400)]">
                Taxa padrão do balcão ao registrar gasto (pool de pontos).
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
                Cor primária
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-11 w-14 cursor-pointer rounded-[8px] border border-[var(--color-neutral-200)] bg-transparent p-1"
                  />
                  <input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="min-h-11 flex-1 rounded-[8px] border border-[var(--color-neutral-200)] px-3 font-mono text-[14px]"
                  />
                </div>
              </label>
              <label className="text-[13px] font-semibold uppercase tracking-[0.04em]">
                Cor (pressionado)
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColorDark}
                    onChange={(e) => setPrimaryColorDark(e.target.value)}
                    className="h-11 w-14 cursor-pointer rounded-[8px] border border-[var(--color-neutral-200)] bg-transparent p-1"
                  />
                  <input
                    value={primaryColorDark}
                    onChange={(e) => setPrimaryColorDark(e.target.value)}
                    className="min-h-11 flex-1 rounded-[8px] border border-[var(--color-neutral-200)] px-3 font-mono text-[14px]"
                  />
                </div>
              </label>
            </div>

            <div
              className="overflow-hidden rounded-[16px] text-white shadow-[0_12px_28px_rgba(16,24,40,0.12)]"
              style={{
                background: `linear-gradient(140deg, ${primaryColor}, ${primaryColorDark})`,
              }}
            >
              <div className="flex items-center gap-3 p-5">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-12 w-12 rounded-[12px] object-cover ring-1 ring-white/30"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-[12px] text-[18px] font-bold ring-1 ring-white/30"
                    style={{ background: 'rgba(255,255,255,0.18)' }}
                    aria-hidden
                  >
                    {letter}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-white/80">
                    Prévia do perfil
                  </p>
                  <p className="truncate text-[18px] font-semibold">
                    {name || 'Sua loja'}
                  </p>
                  <p className="truncate text-[13px] text-white/85">
                    {slogan || 'Slogan aparece aqui'}
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-[13px] text-[var(--color-danger)]" role="alert">
                {error}
              </p>
            )}
            {toast && (
              <p
                className="text-[13px] text-[var(--color-success)]"
                role="status"
              >
                {toast}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || uploading}
              className="min-h-12 rounded-[12px] bg-[var(--color-primary-500)] text-[15px] font-semibold text-white shadow-[var(--shadow-cta)] transition-[transform,background] enabled:active:scale-[0.98] disabled:bg-[var(--color-primary-200)] disabled:shadow-none"
            >
              {busy ? 'Salvando…' : 'Salvar perfil'}
            </button>
          </form>
        )}

        <div className="mt-8 space-y-5">
          <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">
                  Página pública
                </h2>
                <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
                  Vitrine da loja para clientes — marca, capa e campanhas.
                </p>
                {business?.slug ? (
                  <p className="mt-2 truncate font-mono text-[12px] text-[var(--color-neutral-400)]">
                    /loja/{business.slug}
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] text-[var(--color-danger)]">
                    Defina e salve um slug acima para liberar o link.
                  </p>
                )}
              </div>
              {business?.slug ? (
                <a
                  href={`/loja/${business.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white shadow-[var(--shadow-cta)]"
                >
                  Abrir página
                  <ExternalLink size={16} strokeWidth={2.25} aria-hidden />
                </a>
              ) : (
                <span className="inline-flex min-h-11 shrink-0 items-center rounded-[12px] bg-[var(--color-primary-200)] px-4 text-[14px] font-semibold text-white">
                  Abrir página
                </span>
              )}
            </div>
          </section>

          <WhatsAppSettingsCard />
        </div>

        <p className="mt-10 text-[13px] text-[var(--color-neutral-400)]">
          Unidades e equipe entram em seguida nesta mesma área.
        </p>
      </div>

      {cropSrc && cropKind === 'logo' && (
        <LogoCropDialog
          imageSrc={cropSrc}
          busy={uploading}
          title="Ajustar logo"
          description="O logo começa inteiro no quadrado. Arraste e use o zoom se quiser aproximar."
          fileNamePrefix="logo"
          onCancel={closeCrop}
          onConfirm={uploadCroppedLogo}
        />
      )}
      {cropSrc && cropKind === 'hero' && (
        <ImageCropDialog
          imageSrc={cropSrc}
          busy={uploading}
          aspect={HERO_ASPECT}
          title="Ajustar capa"
          description="Enquadre a foto 16:9. Ela aparece no topo da página pública e no app."
          fileNamePrefix="hero"
          outputWidth={1600}
          onCancel={closeCrop}
          onConfirm={uploadCroppedHero}
        />
      )}
    </AppShell>
  );
}
