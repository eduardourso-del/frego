import { graphBase } from './meta-oauth.js';

export const EARN_TEMPLATE_NAME = 'frego_earn_summary';
export const EARN_TEMPLATE_LANG = 'pt_BR';

export const WELCOME_TEMPLATE_NAME = 'frego_welcome';
export const WELCOME_TEMPLATE_LANG = 'pt_BR';

export const CAMPAIGN_TEMPLATE_NAME = 'frego_campaign_new';
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

const EARN_BODY_TEXT =
  'Olá! Atualização de fidelidade da *{{1}}*.\n\nVocê acabou de ganhar *{{2}}*.\nSeu saldo agora é: *{{3}}*.\n\n{{4}}\n\nAbra o app Frego para ver detalhes e resgatar prêmios quando disponíveis.';

const WELCOME_BODY_TEXT =
  'Olá, {{1}}! Você foi cadastrado no programa de fidelidade da *{{2}}*.\n\nUse o app Frego com este mesmo número para acompanhar carimbos, pontos e prêmios.';

const CAMPAIGN_BODY_TEXT =
  '*{{1}}*\nNova campanha: {{2}}';

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
};

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
): Promise<EarnTemplateState> {
  const url = new URL(`${graphBase()}/${wabaId}/message_templates`);
  url.searchParams.set('name', name);
  url.searchParams.set('limit', '20');
  url.searchParams.set(
    'fields',
    'id,name,language,status,rejected_reason',
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
      error: metaErrorMessage(body.error) ?? `list_templates_${res.status}`,
    };
  }

  const match = (body.data ?? []).find(
    (t) =>
      t.name === name &&
      (t.language === language || t.language === language.replace('_', '-')),
  );

  if (!match) {
    return { status: 'missing', templateId: null };
  }

  return {
    status: normalizeStatus(match.status),
    templateId: match.id ?? null,
  };
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
    return existing;
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
      components: [
        {
          type: 'BODY',
          text: spec.bodyText,
          example: {
            body_text: [spec.exampleParams],
          },
        },
      ],
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
    if (again.status !== 'missing') return again;
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
