'use client';

import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { Coins, ExternalLink, Globe, ImageIcon, MapPin, Palette, Store, type LucideIcon } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  ImageCropDialog,
  LogoCropDialog,
} from '@/components/logo-crop-dialog';
import { ShopAppPreview } from '@/components/shop-app-preview';
import { WhatsAppSettingsCard } from '@/components/whatsapp-settings-card';
import { TagManager } from '@/components/tag-manager';
import { API_URL } from '@/lib/api';
import { useBusiness } from '@/lib/business-context';
import { uploadBusinessHero, uploadBusinessLogo } from '@/lib/firebase';
import { BusinessTypePicker } from '@/components/business-type-picker';

const HERO_ASPECT = 16 / 9;

type LocationDraft = {
  id: string;
  name: string;
  address: string;
};

function Section({
  Icon,
  title,
  hint,
  children,
}: {
  Icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-4 md:p-5">
      <div className="mb-4 flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-primary-50)] text-[var(--color-primary-600)]">
          <Icon size={16} strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
            {title}
          </h2>
          {hint ? (
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-neutral-500)]">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

const inputClass =
  'mt-1.5 min-h-11 w-full rounded-[12px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[15px] font-normal normal-case tracking-normal text-[var(--color-ink)] outline-none focus:border-[var(--color-primary-500)]';

export default function SettingsPage() {
  const { business, loading, updateBusiness, authHeaders } = useBusiness();
  const [name, setName] = useState('');
  const [type, setType] = useState('café');
  const [slogan, setSlogan] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#070707');
  const [primaryColorDark, setPrimaryColorDark] = useState('#070707');
  const [pointsPerReal, setPointsPerReal] = useState(1);
  const [cashbackMaxEnabled, setCashbackMaxEnabled] = useState(false);
  const [cashbackMaxReais, setCashbackMaxReais] = useState(10);
  const [cashbackMinEnabled, setCashbackMinEnabled] = useState(false);
  const [cashbackMinReais, setCashbackMinReais] = useState(20);
  const [stampsExpireEnabled, setStampsExpireEnabled] = useState(false);
  const [stampsExpireDays, setStampsExpireDays] = useState(90);
  const [pointsExpireEnabled, setPointsExpireEnabled] = useState(false);
  const [pointsExpireDays, setPointsExpireDays] = useState(90);
  const [cashbackExpireEnabled, setCashbackExpireEnabled] = useState(false);
  const [cashbackExpireDays, setCashbackExpireDays] = useState(90);
  const [locations, setLocations] = useState<LocationDraft[]>([]);
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
    const maxCents = business.cashbackMaxCents ?? null;
    setCashbackMaxEnabled(maxCents != null);
    setCashbackMaxReais(maxCents != null ? Math.round(maxCents / 100) : 10);
    const minCents = business.cashbackMinPurchaseCents ?? null;
    setCashbackMinEnabled(minCents != null);
    setCashbackMinReais(minCents != null ? Math.round(minCents / 100) : 20);
    const stampsDays = business.stampsExpireDays ?? null;
    setStampsExpireEnabled(stampsDays != null);
    setStampsExpireDays(stampsDays ?? 90);
    const pointsDays = business.pointsExpireDays ?? null;
    setPointsExpireEnabled(pointsDays != null);
    setPointsExpireDays(pointsDays ?? 90);
    const cashbackDays = business.cashbackExpireDays ?? null;
    setCashbackExpireEnabled(cashbackDays != null);
    setCashbackExpireDays(cashbackDays ?? 90);
  }, [business]);

  useEffect(() => {
    if (!business?.id) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${API_URL}/business/locations`, { headers });
        if (!res.ok) return;
        const json = (await res.json()) as {
          locations?: Array<{
            id: string;
            name: string;
            address: string | null;
          }>;
        };
        if (cancelled) return;
        setLocations(
          (json.locations ?? []).map((loc) => ({
            id: loc.id,
            name: loc.name,
            address: loc.address ?? '',
          })),
        );
      } catch {
        /* ignore — form still works for brand fields */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [business?.id, authHeaders]);
  useEffect(() => {
    return () => {
      if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  function setLocationField(
    id: string,
    field: 'name' | 'address',
    value: string,
  ) {
    setLocations((prev) =>
      prev.map((loc) => (loc.id === id ? { ...loc, [field]: value } : loc)),
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      for (const loc of locations) {
        const trimmedName = loc.name.trim();
        const trimmedAddress = loc.address.trim();
        if (trimmedName.length < 2) {
          throw new Error('O nome da unidade precisa ter pelo menos 2 caracteres.');
        }
        if (trimmedAddress.length < 5) {
          throw new Error('O endereço precisa ter pelo menos 5 caracteres.');
        }
      }

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
        cashbackMaxCents: cashbackMaxEnabled
          ? Math.max(100, Math.round(cashbackMaxReais || 1) * 100)
          : null,
        cashbackMinPurchaseCents: cashbackMinEnabled
          ? Math.max(100, Math.round(cashbackMinReais || 1) * 100)
          : null,
        stampsExpireDays: stampsExpireEnabled
          ? Math.max(1, Math.min(3650, stampsExpireDays || 1))
          : null,
        pointsExpireDays: pointsExpireEnabled
          ? Math.max(1, Math.min(3650, pointsExpireDays || 1))
          : null,
        cashbackExpireDays: cashbackExpireEnabled
          ? Math.max(1, Math.min(3650, cashbackExpireDays || 1))
          : null,
      });

      if (locations.length > 0) {
        const headers = {
          ...(await authHeaders()),
          'Content-Type': 'application/json',
        };
        await Promise.all(
          locations.map(async (loc) => {
            const res = await fetch(
              `${API_URL}/business/locations/${encodeURIComponent(loc.id)}`,
              {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                  name: loc.name.trim(),
                  address: loc.address.trim(),
                }),
              },
            );
            if (!res.ok) {
              const json = (await res.json().catch(() => null)) as {
                error?: string;
              } | null;
              throw new Error(json?.error ?? 'Não foi possível salvar o endereço.');
            }
          }),
        );
      }

      setToast('Perfil da loja salvo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  function openImagePicker(file: File | undefined, kind: 'logo' | 'hero') {
    if (!file || !business?.id) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem (JPG, PNG ou WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem pode ter no máximo 5 MB.');
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
      setToast('Logo atualizado — aparece no menu e no cartão.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.');
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
      setToast('Capa atualizada — aparece na página pública e no aplicativo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.');
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
      setError(err instanceof Error ? err.message : 'Não foi possível remover.');
    }
  }

  async function removeHero() {
    setHeroImageUrl('');
    setError(null);
    try {
      await updateBusiness({ heroImageUrl: null });
      setToast('Capa removida');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível remover.');
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
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-7 md:py-8">
        <h1 className="mb-2 text-[26px] font-semibold tracking-[-0.03em] text-[var(--color-ink)] md:hidden">
          Configurações
        </h1>
        <p className="mb-6 max-w-2xl text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
          Como a casa aparece no app do cliente: marca, endereço e regras do
          saldo. A prévia ao lado atualiza na hora.
        </p>
        {loading && !business ? (
          <div className="h-40 animate-pulse rounded-[14px] bg-[var(--color-neutral-100)]" />
        ) : (
          <div className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
              <div className="flex min-w-0 flex-col gap-3 self-start">
              <form
                id="loja-settings"
                onSubmit={onSubmit}
                className="flex min-w-0 flex-col gap-3"
              >
                <Section
                  Icon={Store}
                  title="A casa"
                  hint="Nome, tipo e slogan no cartão da loja."
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div
                      className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-bg)] text-[28px] font-bold text-white"
                      style={logoUrl ? undefined : { background: primaryColor }}
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
                      <div className="flex flex-wrap gap-2">
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
                        {logoUrl ? (
                          <button
                            type="button"
                            onClick={() => void removeLogo()}
                            disabled={uploading || busy}
                            className="min-h-10 rounded-[12px] border border-[var(--color-hairline)] px-3.5 text-[13px] font-semibold text-[var(--color-neutral-600)] disabled:opacity-60"
                          >
                            Remover
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-2 text-[12px] text-[var(--color-neutral-400)]">
                        JPG, PNG ou WebP · até 5 MB · recorte quadrado
                      </p>
                    </div>
                  </div>

                  <label className="mt-4 block text-[13px] font-semibold text-[var(--color-ink)]">
                    Nome
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </label>

                  <div className="mt-3">
                    <BusinessTypePicker value={type} onChange={setType} />
                  </div>

                  <label className="mt-3 block text-[13px] font-semibold text-[var(--color-ink)]">
                    Slogan
                    <input
                      value={slogan}
                      onChange={(e) => setSlogan(e.target.value)}
                      className={inputClass}
                      placeholder="Café que faz voltar"
                    />
                  </label>
                </Section>

                <Section
                  Icon={Palette}
                  title="Marca"
                  hint="Cores do cabeçalho no app e na página pública."
                >
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-[13px] font-semibold text-[var(--color-ink)]">
                      Cor primária
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="h-11 w-14 cursor-pointer rounded-[8px] border border-[var(--color-neutral-200)] bg-transparent p-1"
                        />
                        <input
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="min-h-11 flex-1 rounded-[12px] border border-[var(--color-neutral-200)] px-3 font-mono text-[14px] outline-none focus:border-[var(--color-primary-500)]"
                        />
                      </div>
                    </label>
                    <label className="text-[13px] font-semibold text-[var(--color-ink)]">
                      Cor (pressionado)
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          type="color"
                          value={primaryColorDark}
                          onChange={(e) => setPrimaryColorDark(e.target.value)}
                          className="h-11 w-14 cursor-pointer rounded-[8px] border border-[var(--color-neutral-200)] bg-transparent p-1"
                        />
                        <input
                          value={primaryColorDark}
                          onChange={(e) => setPrimaryColorDark(e.target.value)}
                          className="min-h-11 flex-1 rounded-[12px] border border-[var(--color-neutral-200)] px-3 font-mono text-[14px] outline-none focus:border-[var(--color-primary-500)]"
                        />
                      </div>
                    </label>
                  </div>
                </Section>

                <Section
                  Icon={ImageIcon}
                  title="Capa"
                  hint="Foto no topo da ficha no app e da página pública."
                >
                  <div className="overflow-hidden rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-bg)]">
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
                    {heroImageUrl ? (
                      <button
                        type="button"
                        onClick={() => void removeHero()}
                        disabled={uploading || busy}
                        className="min-h-10 rounded-[12px] border border-[var(--color-hairline)] px-3.5 text-[13px] font-semibold text-[var(--color-neutral-600)] disabled:opacity-60"
                      >
                        Remover capa
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[12px] text-[var(--color-neutral-400)]">
                    JPG, PNG ou WebP · até 5 MB · recorte 16:9
                  </p>
                </Section>

                <Section
                  Icon={MapPin}
                  title="Onde encontrar"
                  hint="Aparece no app do cliente e na página pública."
                >
                  {locations.length === 0 ? (
                    <p className="text-[14px] text-[var(--color-neutral-500)]">
                      Nenhuma unidade encontrada para esta loja.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-5">
                      {locations.map((loc, index) => (
                        <div
                          key={loc.id}
                          className={
                            locations.length > 1
                              ? 'border-t border-[var(--color-hairline)] pt-4 first:border-t-0 first:pt-0'
                              : undefined
                          }
                        >
                          {locations.length > 1 ? (
                            <p className="mb-3 text-[12px] font-semibold text-[var(--color-neutral-400)]">
                              Unidade {index + 1}
                            </p>
                          ) : null}
                          <label className="block text-[13px] font-semibold text-[var(--color-ink)]">
                            Nome da unidade
                            <input
                              value={loc.name}
                              onChange={(e) =>
                                setLocationField(loc.id, 'name', e.target.value)
                              }
                              className={inputClass}
                              placeholder="Ex.: Loja Jardins"
                              required
                              minLength={2}
                            />
                          </label>
                          <label className="mt-3 block text-[13px] font-semibold text-[var(--color-ink)]">
                            Endereço
                            <input
                              value={loc.address}
                              onChange={(e) =>
                                setLocationField(
                                  loc.id,
                                  'address',
                                  e.target.value,
                                )
                              }
                              className={inputClass}
                              placeholder="Rua, número, bairro"
                              required
                              minLength={5}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section
                  Icon={Globe}
                  title="Página pública"
                  hint="Vitrine da loja para quem abre o link — marca, capa e campanhas."
                >
                  <label className="block text-[13px] font-semibold text-[var(--color-ink)]">
                    Slug
                    <input
                      value={slug}
                      onChange={(e) =>
                        setSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, '-'),
                        )
                      }
                      className={`${inputClass} font-mono text-[14px]`}
                      placeholder="bloom-coffee"
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="min-w-0 truncate font-mono text-[12px] text-[var(--color-neutral-400)]">
                      {slug.trim()
                        ? `/loja/${slug.trim()}`
                        : 'Defina o endereço da página para publicá-la'}
                    </p>
                    {business?.slug ? (
                      <a
                        href={`/loja/${business.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[12px] bg-[var(--color-primary-500)] px-3.5 text-[13px] font-semibold text-white shadow-[var(--shadow-cta)]"
                      >
                        Abrir página
                        <ExternalLink size={15} strokeWidth={2.25} aria-hidden />
                      </a>
                    ) : (
                      <span className="inline-flex min-h-10 shrink-0 items-center rounded-[12px] bg-[var(--color-primary-200)] px-3.5 text-[13px] font-semibold text-white">
                        Salve para abrir
                      </span>
                    )}
                  </div>
                  {slug.trim() &&
                  business?.slug &&
                  slug.trim() !== business.slug ? (
                    <p className="mt-2 text-[12px] text-[var(--color-neutral-500)]">
                      O link só muda depois de salvar.
                    </p>
                  ) : null}
                </Section>

                <Section
                  Icon={Coins}
                  title="Fidelidade"
                  hint="Taxa de pontos, teto de cashback e validade do saldo."
                >
                  <label className="block text-[13px] font-semibold text-[var(--color-ink)]">
                    R$ para 1 ponto
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={pointsPerReal}
                      onChange={(e) =>
                        setPointsPerReal(Math.max(1, Number(e.target.value) || 1))
                      }
                      className={inputClass}
                    />
                    <span className="mt-1.5 block text-[12px] font-normal text-[var(--color-neutral-500)]">
                      Quanto o cliente precisa gastar no balcão para ganhar 1
                      ponto. Ex.: 10 = R$ 10,00 → 1 ponto.
                    </span>
                  </label>

                  <div className="mt-4 rounded-[14px] border border-[var(--color-cashback-ring)] bg-[var(--color-cashback-bg)] px-4 py-3 text-[13px] leading-relaxed text-[var(--color-cashback)]">
                    A porcentagem de cashback fica em cada campanha, em{' '}
                    <a href="/campaigns" className="font-semibold underline">
                      Campanhas
                    </a>
                    . Aqui ficam só o teto, a compra mínima e a validade do
                    saldo.
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold text-[var(--color-ink)]">
                        <input
                          type="checkbox"
                          checked={cashbackMaxEnabled}
                          onChange={(e) =>
                            setCashbackMaxEnabled(e.target.checked)
                          }
                          className="h-4 w-4 rounded border-[var(--color-neutral-300)]"
                        />
                        Teto por compra
                      </label>
                      {cashbackMaxEnabled ? (
                        <label className="mt-2 block text-[13px] font-semibold text-[var(--color-neutral-500)]">
                          Máximo (R$)
                          <input
                            type="number"
                            min={1}
                            max={100000}
                            value={cashbackMaxReais}
                            onChange={(e) =>
                              setCashbackMaxReais(
                                Math.max(1, Number(e.target.value) || 1),
                              )
                            }
                            className={inputClass}
                          />
                        </label>
                      ) : null}
                    </div>
                    <div>
                      <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold text-[var(--color-ink)]">
                        <input
                          type="checkbox"
                          checked={cashbackMinEnabled}
                          onChange={(e) =>
                            setCashbackMinEnabled(e.target.checked)
                          }
                          className="h-4 w-4 rounded border-[var(--color-neutral-300)]"
                        />
                        Compra mínima
                      </label>
                      {cashbackMinEnabled ? (
                        <label className="mt-2 block text-[13px] font-semibold text-[var(--color-neutral-500)]">
                          Mínimo (R$)
                          <input
                            type="number"
                            min={1}
                            max={100000}
                            value={cashbackMinReais}
                            onChange={(e) =>
                              setCashbackMinReais(
                                Math.max(1, Number(e.target.value) || 1),
                              )
                            }
                            className={inputClass}
                          />
                        </label>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-5 text-[13px] font-semibold text-[var(--color-ink)]">
                    Validade do saldo
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--color-neutral-500)]">
                    Em quantos dias o saldo expira depois que o cliente ganha. No
                    resgate, o mais antigo é usado primeiro.
                  </p>
                  <div className="mt-3 flex flex-col gap-4">
                    <div>
                      <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold text-[var(--color-ink)]">
                        <input
                          type="checkbox"
                          checked={stampsExpireEnabled}
                          onChange={(e) =>
                            setStampsExpireEnabled(e.target.checked)
                          }
                          className="h-4 w-4 rounded border-[var(--color-neutral-300)]"
                        />
                        Carimbos expiram
                      </label>
                      {stampsExpireEnabled ? (
                        <label className="mt-2 block text-[13px] font-semibold text-[var(--color-neutral-500)]">
                          Dias após o ganho
                          <input
                            type="number"
                            min={1}
                            max={3650}
                            value={stampsExpireDays}
                            onChange={(e) =>
                              setStampsExpireDays(
                                Math.max(1, Number(e.target.value) || 1),
                              )
                            }
                            className={inputClass}
                          />
                        </label>
                      ) : null}
                    </div>
                    <div>
                      <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold text-[var(--color-ink)]">
                        <input
                          type="checkbox"
                          checked={pointsExpireEnabled}
                          onChange={(e) =>
                            setPointsExpireEnabled(e.target.checked)
                          }
                          className="h-4 w-4 rounded border-[var(--color-neutral-300)]"
                        />
                        Pontos expiram
                      </label>
                      {pointsExpireEnabled ? (
                        <label className="mt-2 block text-[13px] font-semibold text-[var(--color-neutral-500)]">
                          Dias após o ganho
                          <input
                            type="number"
                            min={1}
                            max={3650}
                            value={pointsExpireDays}
                            onChange={(e) =>
                              setPointsExpireDays(
                                Math.max(1, Number(e.target.value) || 1),
                              )
                            }
                            className={inputClass}
                          />
                        </label>
                      ) : null}
                    </div>
                    <div>
                      <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold text-[var(--color-ink)]">
                        <input
                          type="checkbox"
                          checked={cashbackExpireEnabled}
                          onChange={(e) =>
                            setCashbackExpireEnabled(e.target.checked)
                          }
                          className="h-4 w-4 rounded border-[var(--color-neutral-300)]"
                        />
                        Cashback expira
                      </label>
                      {cashbackExpireEnabled ? (
                        <label className="mt-2 block text-[13px] font-semibold text-[var(--color-neutral-500)]">
                          Dias após o ganho
                          <input
                            type="number"
                            min={1}
                            max={3650}
                            value={cashbackExpireDays}
                            onChange={(e) =>
                              setCashbackExpireDays(
                                Math.max(1, Number(e.target.value) || 1),
                              )
                            }
                            className={inputClass}
                          />
                        </label>
                      ) : null}
                    </div>
                  </div>
                </Section>
                {error ? (
                  <p
                    className="text-[13px] text-[var(--color-danger)] lg:hidden"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
                {toast ? (
                  <p
                    className="text-[13px] text-[var(--color-success)] lg:hidden"
                    role="status"
                  >
                    {toast}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={busy || uploading}
                  className="min-h-12 rounded-[12px] bg-[var(--color-primary-500)] text-[15px] font-semibold text-white shadow-[var(--shadow-cta)] transition-[transform,background] enabled:active:scale-[0.98] disabled:bg-[var(--color-primary-200)] disabled:shadow-none lg:hidden"
                >
                  {busy ? 'Salvando…' : 'Salvar perfil'}
                </button>
              </form>
              <TagManager />
              </div>

            <aside className="w-full min-w-0">
              <div className="lg:sticky lg:top-4">
              <div className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-4">
                <ShopAppPreview
                  name={name}
                  type={type}
                  slogan={slogan}
                  logoUrl={logoUrl}
                  primaryColor={primaryColor}
                />
              </div>
              {error ? (
                <p
                  className="mt-3 hidden text-[13px] text-[var(--color-danger)] lg:block"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              {toast ? (
                <p
                  className="mt-3 hidden text-[13px] text-[var(--color-success)] lg:block"
                  role="status"
                >
                  {toast}
                </p>
              ) : null}
              <button
                type="submit"
                form="loja-settings"
                disabled={busy || uploading}
                className="mt-3 hidden min-h-11 w-full rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[15px] font-semibold text-white shadow-[var(--shadow-cta)] disabled:bg-[var(--color-primary-200)] disabled:shadow-none lg:block"
              >
                {busy ? 'Salvando…' : 'Salvar perfil'}
              </button>
              </div>
            </aside>
          </div>

            <WhatsAppSettingsCard />
          </div>
        )}
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
