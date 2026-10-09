'use client';

import { useCallback, useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { API_URL } from '@/lib/api';
import {
  isMetaEmbeddedSignupConfigured,
  launchWhatsAppEmbeddedSignup,
  type WhatsAppSignupMode,
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
  templateEarnStatus: string;
  templateEarnId: string | null;
  templateEarnSyncedAt: string | null;
  templateWelcomeName?: string;
  templateWelcomeLang?: string;
  templateWelcomeStatus?: string;
  templateWelcomeId?: string | null;
  templateWelcomeSyncedAt?: string | null;
  templateCampaignName?: string;
  templateCampaignLang?: string;
  templateCampaignStatus?: string;
  templateCampaignId?: string | null;
  templateCampaignSyncedAt?: string | null;
  templatePesquisaName?: string;
  templatePesquisaLang?: string;
  templatePesquisaStatus?: string;
  templatePesquisaId?: string | null;
  templatePesquisaSyncedAt?: string | null;
  coexistence: boolean;
  smbSyncStartedAt: string | null;
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

function fillTemplate(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, index: string) => {
    return params[Number(index) - 1] ?? '';
  });
}

function WhatsAppBold({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
          <strong key={index} className="font-semibold">
            {part.slice(1, -1)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

const APP_DOWNLOAD_LINE =
  'Baixe o app Frego em https://onelink.to/quvd8c no celular.';

const MESSAGE_BODIES = {
  earn:
    'Olá! Atualização de fidelidade da *{{1}}*.\n\nVocê acabou de ganhar *{{2}}*.\nSeu saldo agora é: *{{3}}*.\n\n{{4}}\n\nAbra o app Frego para ver detalhes e resgatar prêmios quando disponíveis.\n\n' +
    APP_DOWNLOAD_LINE,
  welcome:
    'Olá, {{1}}! Você foi cadastrado no programa de fidelidade da *{{2}}*.\n\nUse o app Frego com este mesmo número para acompanhar carimbos, pontos e prêmios.\n\n' +
    APP_DOWNLOAD_LINE,
  campaign:
    'Olá! A *{{1}}* lançou uma nova campanha no programa de fidelidade.\n\n{{2}}\n\nAbra o app Frego para conferir os detalhes e participar.\n\n' +
    APP_DOWNLOAD_LINE,
  pesquisa:
    'Olá! Atualização de fidelidade da *{{1}}*.\n\nVocê acabou de ganhar *{{2}}*.\nSeu saldo agora é: *{{3}}*.\n\n{{4}}\n\n{{5}}\nResponda neste link: {{6}}\n\nAbra o app Frego para ver detalhes e resgatar prêmios quando disponíveis.\n\n' +
    APP_DOWNLOAD_LINE,
} as const;

type MessageKey = keyof typeof MESSAGE_BODIES;

function messageSample(key: MessageKey, businessName: string) {
  const shop = businessName.trim() || 'a loja';
  const samples: Record<MessageKey, { label: string; body: string }> = {
    earn: {
      label: 'Acúmulo',
      body: fillTemplate(MESSAGE_BODIES.earn, [
        shop,
        '+1 carimbo',
        '3 carimbos',
        'Café gratuito: faltam 2',
      ]),
    },
    welcome: {
      label: 'Boas-vindas',
      body: fillTemplate(MESSAGE_BODIES.welcome, ['Maria', shop]),
    },
    campaign: {
      label: 'Campanha',
      body: fillTemplate(MESSAGE_BODIES.campaign, [shop, '10 carimbos — café gratuito']),
    },
    pesquisa: {
      label: 'Pesquisa',
      body: fillTemplate(MESSAGE_BODIES.pesquisa, [
        shop,
        '+1 carimbo',
        '3 carimbos',
        'Café gratuito: faltam 2',
        'Responda e ganhe 1 carimbo na cartela Almoço Grátis.',
        'https://frego.app.br/p/exemplo',
      ]),
    },
  };
  return samples[key];
}

function templateStatusLabel(status: string): { label: string; tone: string } {
  switch (status) {
    case 'approved':
      return { label: 'Aprovado', tone: 'text-[var(--color-success)]' };
    case 'pending':
      return { label: 'Em análise na Meta', tone: 'text-amber-700' };
    case 'rejected':
      return { label: 'Rejeitado', tone: 'text-[var(--color-danger)]' };
    case 'paused':
      return { label: 'Pausado', tone: 'text-amber-700' };
    case 'disabled':
      return { label: 'Desativado', tone: 'text-[var(--color-danger)]' };
    default:
      return { label: 'Não criado', tone: 'text-[var(--color-neutral-500)]' };
  }
}

export function WhatsAppSettingsCard() {
  const { getToken, user } = useAuth();
  const { business } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [openMessage, setOpenMessage] = useState<MessageKey | null>(null);
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

  async function connect(mode: WhatsAppSignupMode) {
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      const signup = await launchWhatsAppEmbeddedSignup(mode);
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada');
      const res = await fetch(`${API_URL}/whatsapp/oauth/callback`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: signup.code,
          coexistence: signup.coexistence,
          wabaId: signup.wabaId,
          phoneNumberId: signup.phoneNumberId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (body as { message?: string }).message ??
            'Falha ao conectar WhatsApp',
        );
      }
      const conn = (body as { connection: Connection }).connection ?? null;
      setConnection(conn);
      if (conn?.coexistence) {
        setToast(
          'WhatsApp conectado com o app Business no mesmo número. Mantenha o app aberto alguns minutos enquanto a Meta sincroniza.',
        );
      } else if (conn?.templateEarnStatus === 'approved') {
        setToast('WhatsApp conectado. Template de avisos já aprovado.');
      } else if (conn?.templateEarnStatus === 'pending') {
        setToast(
          'WhatsApp conectado. Template enviado à Meta — aguarde aprovação.',
        );
      } else {
        setToast(
          'WhatsApp conectado. Use “Criar / sincronizar template” se o status não atualizar.',
        );
      }
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

  async function ensureTemplate() {
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão expirada');
      const res = await fetch(`${API_URL}/whatsapp/ensure-template`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (body as { message?: string }).message ??
            'Falha ao criar/sincronizar template',
        );
      }
      const conn = (body as { connection: Connection }).connection ?? null;
      setConnection(conn);
      const st = conn?.templateEarnStatus;
      if (st === 'approved') setToast('Avisos liberados.');
      else if (st === 'pending')
        setToast('Avisos enviados. Aguardando aprovação.');
      else if (st === 'rejected')
        setToast('Um aviso foi recusado. Tente ativar de novo.');
      else setToast('Status dos avisos atualizado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  const templateTone = connection
    ? templateStatusLabel(connection.templateEarnStatus)
    : null;
  const welcomeTone = connection
    ? templateStatusLabel(connection.templateWelcomeStatus ?? 'missing')
    : null;
  const campaignTone = connection
    ? templateStatusLabel(connection.templateCampaignStatus ?? 'missing')
    : null;
  const pesquisaTone = connection
    ? templateStatusLabel(connection.templatePesquisaStatus ?? 'missing')
    : null;
  const needsTemplate = Boolean(
    connection &&
      (connection.templateEarnStatus !== 'approved' ||
        (connection.templateWelcomeStatus ?? 'missing') !== 'approved' ||
        (connection.templateCampaignStatus ?? 'missing') !== 'approved' ||
        (connection.templatePesquisaStatus ?? 'missing') !== 'approved'),
  );

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
              Conecte o WhatsApp Business da loja. O app no celular continua no
              mesmo número. Use “Número dedicado” só quando o número não fica
              no app.
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
              {connection.displayPhoneNumber ?? 'Número conectado'}
            </span>
          </p>
          {connection.verifiedName && (
            <p>
              <span className="text-[var(--color-neutral-500)]">Nome: </span>
              {connection.verifiedName}
            </p>
          )}
          {connection.coexistence && (
            <p className="text-[13px] text-[var(--color-neutral-500)]">
              O app WhatsApp Business continua neste número. Não desconecte em
              Configurações → Conta → Plataforma Business no celular, senão o
              Frego perde o vínculo.
            </p>
          )}
          <div className="mt-3 divide-y divide-[var(--color-hairline)] rounded-[12px] border border-[var(--color-hairline)] px-3">
            {(
              [
                ['earn', 'Acúmulo', templateTone],
                ['welcome', 'Boas-vindas', welcomeTone],
                ['campaign', 'Campanha', campaignTone],
                ['pesquisa', 'Pesquisa', pesquisaTone],
              ] as const
            ).map(([key, label, tone]) =>
              tone ? (
                <div key={key} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[var(--color-ink)]">{label}</span>
                  <span className="flex items-center gap-1">
                    <span className={`text-[13px] font-semibold ${tone.tone}`}>{tone.label}</span>
                    <button
                      type="button"
                      onClick={() => setOpenMessage(key)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-neutral-400)] hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)]"
                      aria-label={`Ver a mensagem de ${label}`}
                    >
                      <Info size={16} aria-hidden />
                    </button>
                  </span>
                </div>
              ) : null,
            )}
          </div>
          {needsTemplate && (
            <p className="text-[13px] text-[var(--color-neutral-500)]">
              Cada aviso passa a sair quando estiver aprovado. A análise costuma levar de alguns minutos a algumas horas.
            </p>
          )}

          <p className="text-[12px] text-[var(--color-neutral-400)]">
            Conectado em{' '}
            {new Date(connection.connectedAt).toLocaleString('pt-BR')}
          </p>
          {connection.lastError && needsTemplate ? (
            <p className="text-[13px] text-[var(--color-danger)]" role="alert">
              Não foi possível preparar os avisos. Tente ativar de novo.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {needsTemplate && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void ensureTemplate()}
                className="min-h-10 rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {busy ? 'Aguarde…' : 'Ativar avisos'}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void disconnect()}
              className="min-h-10 rounded-[12px] border border-[var(--color-hairline)] px-4 text-[13px] font-semibold disabled:opacity-60"
            >
              {busy ? 'Aguarde…' : 'Desconectar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {!configured && (
            <p className="text-[13px] text-[var(--color-danger)]">
              A conexão com o WhatsApp não está disponível agora.
            </p>
          )}
          <div className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-3 text-[13px] text-[var(--color-neutral-500)]">
            <p className="font-semibold text-[var(--color-ink)]">
              Como conectar o número da loja
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                Use o app{' '}
                <span className="text-[var(--color-ink)]">WhatsApp Business</span>{' '}
                (não o WhatsApp pessoal), atualizado, no celular da loja.
              </li>
              <li>
                Clique em{' '}
                <span className="text-[var(--color-ink)]">
                  Conectar WhatsApp Business
                </span>{' '}
                e complete o fluxo da Meta com o Business e o número da loja.
              </li>
              <li>
                Deixe o app aberto alguns minutos depois de conectar (a Meta
                sincroniza o número).
              </li>
              <li>
                Quando os avisos estiverem aprovados, o cadastro e o carimbo no
                balcão já saem no WhatsApp da loja.
              </li>
            </ol>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              disabled={busy || !configured}
              onClick={() => void connect('coexistence')}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white shadow-[var(--shadow-cta)] disabled:bg-[var(--color-primary-200)] disabled:shadow-none"
            >
              {!busy && <WhatsAppGlyph className="h-4 w-4" />}
              {busy ? 'Conectando…' : 'Conectar WhatsApp Business'}
            </button>
            <button
              type="button"
              disabled={busy || !configured}
              onClick={() => void connect('cloud')}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] border border-[var(--color-hairline)] px-4 text-[13px] font-semibold disabled:opacity-60"
              title="Número sem o app WhatsApp Business"
            >
              {busy ? 'Conectando…' : 'Número dedicado'}
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
      {openMessage ? (
        <MessageTemplateDialog
          sample={messageSample(openMessage, business?.name ?? '')}
          onClose={() => setOpenMessage(null)}
        />
      ) : null}
    </section>
  );
}

function MessageTemplateDialog({
  sample,
  onClose,
}: {
  sample: { label: string; body: string };
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="my-6 w-full max-w-lg rounded-[16px] bg-[var(--color-card)] p-5 shadow-[var(--shadow-raised)]"
        role="dialog"
        aria-labelledby="whatsapp-message-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              id="whatsapp-message-title"
              className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]"
            >
              {sample.label}
            </h3>
            <p className="mt-1 text-[13px] text-[var(--color-neutral-500)]">
              Exemplo com o nome da loja. O saldo, o prêmio e o link mudam em cada envio.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-neutral-500)] hover:bg-[var(--color-bg)]"
            aria-label="Fechar"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="mt-4 rounded-[16px] rounded-tl-[4px] bg-[#E7F6EC] px-3.5 py-3 text-[14px] leading-snug whitespace-pre-wrap text-[var(--color-ink)]">
          <WhatsAppBold text={sample.body} />
        </div>
      </div>
    </div>
  );
}
