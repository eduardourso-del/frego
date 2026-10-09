import { graphBase } from './meta-oauth.js';

export const EARN_TEMPLATE_NAME = 'frego_earn_summary';
export const EARN_TEMPLATE_LANG = 'pt_BR';

export const WELCOME_TEMPLATE_NAME = 'frego_welcome';
export const WELCOME_TEMPLATE_LANG = 'pt_BR';

export const CAMPAIGN_TEMPLATE_NAME = 'frego_campaign_notice';
export const CAMPAIGN_TEMPLATE_LANG = 'pt_BR';

export type EarnTemplateStatus =
  | 'missing'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'paused'
  | 'disabled';

export type EarnTemplateState = {
  status: EarnTemplateStatus;
  templateId: string | null;
  error?: string;
};

/** OneLink: abre a App Store ou a Play Store. */
export const FREGO_APP_DOWNLOAD_URL = 'https://onelink.to/quvd8c';

const APP_DOWNLOAD_LINE = `Baixe o app Frego em ${FREGO_APP_DOWNLOAD_URL} no celular.`;

const EARN_BODY_TEXT =
  'Olá! Atualização de fidelidade da *{{1}}*.\n\nVocê acabou de ganhar *{{2}}*.\nSeu saldo agora é: *{{3}}*.\n\n{{4}}\n\nAbra o app Frego para ver detalhes e resgatar prêmios quando disponíveis.\n\n' +
  APP_DOWNLOAD_LINE;

const WELCOME_BODY_TEXT =
  'Olá, {{1}}! Você foi cadastrado no programa de fidelidade da *{{2}}*.\n\nUse o app Frego com este mesmo número para acompanhar carimbos, pontos e prêmios.\n\n' +
  APP_DOWNLOAD_LINE;

const CAMPAIGN_BODY_TEXT =
  'Olá! A *{{1}}* lançou uma nova campanha no programa de fidelidade.\n\n{{2}}\n\nAbra o app Frego para conferir os detalhes e participar.\n\n' +
  APP_DOWNLOAD_LINE;

export const PESQUISA_TEMPLATE_NAME = 'frego_earn_pesquisa';
export const PESQUISA_TEMPLATE_LANG = 'pt_BR';

const PESQUISA_BODY_TEXT =
  'Olá! Atualização de fidelidade da *{{1}}*.\n\nVocê acabou de ganhar *{{2}}*.\nSeu saldo agora é: *{{3}}*.\n\n{{4}}\n\n{{5}}\nResponda neste link: {{6}}\n\nAbra o app Frego para ver detalhes e resgatar prêmios quando disponíveis.\n\n' +
  APP_DOWNLOAD_LINE;

function metaErrorMessage(error: {
  message?: string;
  error_user_msg?: string;
} | undefined): string | undefined {
  return error?.error_user_msg || error?.message;
}

function normalizeStatus(raw: string | undefined | null): EarnTemplateStatus {
  switch ((raw ?? '').toUpperCase()) {
    case 'APPROVED':
      return 'approved';
    case 'PENDING':
    case 'IN_APPEAL':
    case 'PENDING_DELETION':
      return 'pending';
    case 'REJECTED':
      return 'rejected';
    case 'PAUSED':
      return 'paused';
    case 'DISABLED':
    case 'FLAGGED':
      return 'disabled';
    default:
      return 'missing';
  }
}

type MetaTemplate = {
  id?: string;
  name?: string;
  language?: string;
  status?: string;
  components?: { type?: string; text?: string }[];
};

type FetchedTemplate = EarnTemplateState & { bodyText: string | null };

function bodyComponent(spec: TemplateSpec) {
  return {
    type: 'BODY' as const,
    text: spec.bodyText,
    example: {
      body_text: [spec.exampleParams],
    },
  };
}

function templateBodyText(template: MetaTemplate): string | null {
  const text = template.components?.find((component) => component.type === 'BODY')?.text;
  return text?.trim() ? text : null;
}

type TemplateSpec = {
  name: string;
  language: string;
  bodyText: string;
  exampleParams: string[];
};

async function fetchTemplateState(
  wabaId: string,
  accessToken: string,
  name: string,
  language: string,
): Promise<FetchedTemplate> {
  const url = new URL(`${graphBase()}/${wabaId}/message_templates`);
  url.searchParams.set('name', name);
  url.searchParams.set('limit', '20');
  url.searchParams.set(
    'fields',
    'id,name,language,status,rejected_reason,components',
  );

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: MetaTemplate[];
    error?: { message?: string; error_user_msg?: string };
  };

  if (!res.ok) {
    return {
      status: 'missing',
      templateId: null,
      bodyText: null,
      error: metaErrorMessage(body.error) ?? `list_templates_${res.status}`,
    };
  }

  const match = (body.data ?? []).find(
    (t) =>
      t.name === name &&
      (t.language === language || t.language === language.replace('_', '-')),
  );

  if (!match) {
    return { status: 'missing', templateId: null, bodyText: null };
  }

  return {
    status: normalizeStatus(match.status),
    templateId: match.id ?? null,
    bodyText: templateBodyText(match),
  };
}

async function updateTemplateBody(
  accessToken: string,
  templateId: string,
  spec: TemplateSpec,
): Promise<EarnTemplateState> {
  const res = await fetch(`${graphBase()}/${templateId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      components: [bodyComponent(spec)],
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    success?: boolean;
    status?: string;
    error?: { message?: string; error_user_msg?: string };
  };
  if (!res.ok) {
    return {
      status: 'pending',
      templateId,
      error: metaErrorMessage(body.error) ?? `update_template_${res.status}`,
    };
  }
  return {
    status: body.status ? normalizeStatus(body.status) : 'pending',
    templateId: body.id ?? templateId,
  };
}

async function refreshDownloadLink(
  accessToken: string,
  existing: FetchedTemplate,
  spec: TemplateSpec,
): Promise<EarnTemplateState> {
  if (
    existing.templateId &&
    !existing.bodyText?.includes(FREGO_APP_DOWNLOAD_URL)
  ) {
    return updateTemplateBody(accessToken, existing.templateId, spec);
  }
  return existing;
}

async function ensureTemplate(
  wabaId: string,
  accessToken: string,
  spec: TemplateSpec,
): Promise<EarnTemplateState> {
  const existing = await fetchTemplateState(
    wabaId,
    accessToken,
    spec.name,
    spec.language,
  );
  if (existing.status !== 'missing') {
    return refreshDownloadLink(accessToken, existing, spec);
  }

  const res = await fetch(`${graphBase()}/${wabaId}/message_templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: spec.name,
      language: spec.language,
      category: 'UTILITY',
      allow_category_change: true,
      parameter_format: 'POSITIONAL',
      components: [bodyComponent(spec)],
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    error?: {
      message?: string;
      error_user_msg?: string;
      code?: number;
      error_subcode?: number;
    };
  };

  if (
    !res.ok &&
    (body.error?.code === 100 ||
      body.error?.code === 2388040 ||
      /already exists|duplicate|taken/i.test(
        metaErrorMessage(body.error) ?? '',
      ))
  ) {
    if (body.error?.error_subcode === 2388293) {
      return {
        status: 'missing',
        templateId: null,
        error: metaErrorMessage(body.error) ?? 'template_rejected',
      };
    }
    const again = await fetchTemplateState(
      wabaId,
      accessToken,
      spec.name,
      spec.language,
    );
    if (again.status !== 'missing') {
      return refreshDownloadLink(accessToken, again, spec);
    }
  }

  if (!res.ok) {
    return {
      status: 'missing',
      templateId: null,
      error: metaErrorMessage(body.error) ?? `create_template_${res.status}`,
    };
  }

  return {
    status: body.status ? normalizeStatus(body.status) : 'pending',
    templateId: body.id ?? null,
  };
}

/**
 * Look up earn template on the WABA (by name + language).
 */
export async function fetchEarnTemplateState(
  wabaId: string,
  accessToken: string,
  name = EARN_TEMPLATE_NAME,
  language = EARN_TEMPLATE_LANG,
): Promise<EarnTemplateState> {
  return fetchTemplateState(wabaId, accessToken, name, language);
}

/**
 * Create earn template if missing; otherwise refresh status from Meta.
 */
export async function ensureEarnTemplate(
  wabaId: string,
  accessToken: string,
  name = EARN_TEMPLATE_NAME,
  language = EARN_TEMPLATE_LANG,
): Promise<EarnTemplateState> {
  return ensureTemplate(wabaId, accessToken, {
    name,
    language,
    bodyText: EARN_BODY_TEXT,
    exampleParams: [
      'Café Bloom',
      '+1 carimbo',
      '3 carimbos · 0 pts',
      'Café gratuito: faltam 2',
    ],
  });
}

export async function fetchWelcomeTemplateState(
  wabaId: string,
  accessToken: string,
  name = WELCOME_TEMPLATE_NAME,
  language = WELCOME_TEMPLATE_LANG,
): Promise<EarnTemplateState> {
  return fetchTemplateState(wabaId, accessToken, name, language);
}

export async function ensureWelcomeTemplate(
  wabaId: string,
  accessToken: string,
  name = WELCOME_TEMPLATE_NAME,
  language = WELCOME_TEMPLATE_LANG,
): Promise<EarnTemplateState> {
  return ensureTemplate(wabaId, accessToken, {
    name,
    language,
    bodyText: WELCOME_BODY_TEXT,
    exampleParams: ['Maria', 'Café Bloom'],
  });
}

export async function fetchCampaignTemplateState(
  wabaId: string,
  accessToken: string,
  name = CAMPAIGN_TEMPLATE_NAME,
  language = CAMPAIGN_TEMPLATE_LANG,
): Promise<EarnTemplateState> {
  return fetchTemplateState(wabaId, accessToken, name, language);
}

async function deleteTemplateByName(
  wabaId: string,
  accessToken: string,
  name: string,
): Promise<void> {
  const url = new URL(`${graphBase()}/${wabaId}/message_templates`);
  url.searchParams.set('name', name);
  await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function ensurePesquisaTemplate(
  wabaId: string,
  accessToken: string,
  name = PESQUISA_TEMPLATE_NAME,
  language = PESQUISA_TEMPLATE_LANG,
): Promise<EarnTemplateState> {
  const existing = await fetchTemplateState(wabaId, accessToken, name, language);
  if (existing.status === 'rejected') {
    await deleteTemplateByName(wabaId, accessToken, name);
  }
  return ensureTemplate(wabaId, accessToken, {
    name,
    language,
    bodyText: PESQUISA_BODY_TEXT,
    exampleParams: [
      'Café Bloom',
      '+1 carimbo',
      '3 carimbos · 0 pts',
      '—',
      'Responda e ganhe 1 carimbo.',
      'https://frego.app.br/p/exemplo',
    ],
  });
}

export async function fetchPesquisaTemplateState(
  wabaId: string,
  accessToken: string,
  name = PESQUISA_TEMPLATE_NAME,
  language = PESQUISA_TEMPLATE_LANG,
): Promise<EarnTemplateState> {
  return fetchTemplateState(wabaId, accessToken, name, language);
}

export async function ensureCampaignTemplate(
  wabaId: string,
  accessToken: string,
  name = CAMPAIGN_TEMPLATE_NAME,
  language = CAMPAIGN_TEMPLATE_LANG,
): Promise<EarnTemplateState> {
  return ensureTemplate(wabaId, accessToken, {
    name,
    language,
    bodyText: CAMPAIGN_BODY_TEXT,
    exampleParams: ['Café Bloom', '10 carimbos'],
  });
}

export function mapWebhookTemplateEvent(
  event: string | undefined,
): EarnTemplateStatus | null {
  if (!event) return null;
  return normalizeStatus(event);
}
