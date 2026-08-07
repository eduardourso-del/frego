'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api';
import {
  isMetaEmbeddedSignupConfigured,
  launchWhatsAppEmbeddedSignup,
} from '@/lib/whatsapp-embedded-signup';

type Connection = {
  status: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  messagingLimitTier: string | null;
  templateEarnName: string;
  templateEarnLang: string;
  connectedAt: string;
  webhookSubscribedAt: string | null;
  lastError: string | null;
};

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

export function WhatsAppSettingsCard() {
  const { getToken, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const configured = isMetaEmbeddedSignupConfigured();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada');
      const res = await fetch(`${API_URL}/whatsapp/connection`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Falha ao carregar WhatsApp');
      const data = (await res.json()) as {
        connected: boolean;
        connection: Connection | null;
      };
      setConnection(data.connected ? data.connection : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [getToken, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect() {
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      const code = await launchWhatsAppEmbeddedSignup();
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada');
      const res = await fetch(`${API_URL}/whatsapp/oauth/callback`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (body as { message?: string }).message ??
            'Falha ao conectar WhatsApp',
        );
      }
      setConnection(
        (body as { connection: Connection }).connection ?? null,
      );
      setToast('WhatsApp conectado. Use um número BR e aprove o template frego_earn_summary.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao conectar');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm('Desconectar o WhatsApp desta loja?')) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada');
      const res = await fetch(`${API_URL}/whatsapp/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Falha ao desconectar');
      setConnection(null);
      setToast('WhatsApp desconectado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#25D366]/15 text-[#25D366]"
            aria-hidden
          >
            <WhatsAppGlyph className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">
              WhatsApp
            </h2>
            <p className="mt-1 max-w-md text-[13px] text-[var(--color-neutral-500)]">
              Conecte o WhatsApp Business oficial da loja. Após carimbos ou
              pontos no balcão, o cliente recebe um resumo no próprio número da
              marca.
            </p>
          </div>
        </div>
        {connection && (
          <span className="rounded-full bg-[var(--color-success)]/10 px-2.5 py-1 text-[12px] font-semibold text-[var(--color-success)]">
            Conectado
          </span>
        )}
      </div>

      {loading ? (
        <p className="mt-4 text-[14px] text-[var(--color-neutral-500)]">
          Carregando…
        </p>
      ) : connection ? (
        <div className="mt-4 space-y-2 text-[14px]">
          <p>
            <span className="text-[var(--color-neutral-500)]">Número: </span>
            <span className="font-medium text-[var(--color-ink)]">
              {connection.displayPhoneNumber ?? connection.phoneNumberId}
            </span>
          </p>
          {connection.verifiedName && (
            <p>
              <span className="text-[var(--color-neutral-500)]">Nome: </span>
              {connection.verifiedName}
            </p>
          )}
          {connection.qualityRating && (
            <p>
              <span className="text-[var(--color-neutral-500)]">
                Qualidade:{' '}
              </span>
              {connection.qualityRating}
            </p>
          )}
          <p>
            <span className="text-[var(--color-neutral-500)]">
              Template de acúmulo:{' '}
            </span>
            <code className="text-[13px]">
              {connection.templateEarnName} ({connection.templateEarnLang})
            </code>
          </p>
          <p className="text-[12px] text-[var(--color-neutral-400)]">
            Conectado em{' '}
            {new Date(connection.connectedAt).toLocaleString('pt-BR')}
          </p>
          {connection.lastError && (
            <p className="text-[13px] text-[var(--color-danger)]" role="alert">
              Último erro Meta: {connection.lastError}
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
            className="mt-3 ml-auto block min-h-10 rounded-[12px] border border-[var(--color-hairline)] px-4 text-[13px] font-semibold disabled:opacity-60"
          >
            {busy ? 'Aguarde…' : 'Desconectar'}
          </button>
        </div>
      ) : (
        <div className="mt-4">
          {!configured && (
            <p className="mb-3 text-[13px] text-[var(--color-danger)]">
              Embedded Signup não configurado no front
              (NEXT_PUBLIC_META_APP_ID / NEXT_PUBLIC_META_EMBEDDED_CONFIG_ID).
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy || !configured}
              onClick={() => void connect()}
              className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white shadow-[var(--shadow-cta)] disabled:bg-[var(--color-primary-200)] disabled:shadow-none"
            >
              {!busy && <WhatsAppGlyph className="h-4 w-4" />}
              {busy ? 'Conectando…' : 'Conectar WhatsApp'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-[13px] text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
      {toast && (
        <p className="mt-3 text-[13px] text-[var(--color-success)]" role="status">
          {toast}
        </p>
      )}
    </section>
  );
}
