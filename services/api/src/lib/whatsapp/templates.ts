import { graphBase } from './meta-oauth.js';

export const EARN_TEMPLATE_NAME = 'frego_earn_summary_v3';
export const EARN_TEMPLATE_LANG = 'pt_BR';

export const WELCOME_TEMPLATE_NAME = 'frego_welcome_v4';
export const WELCOME_TEMPLATE_LANG = 'pt_BR';

export const CAMPAIGN_TEMPLATE_NAME = 'frego_campaign_notice_v3';
export const CAMPAIGN_TEMPLATE_LANG = 'pt_BR';

export const NOTICE_TEMPLATE_NAME = 'frego_account_notice_v1';
export const NOTICE_TEMPLATE_LANG = 'pt_BR';

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
  'Olá. Registro da compra na *{{1}}*.\n\nCreditado nesta compra: *{{2}}*.\nSaldo da conta: *{{3}}*.\n\n{{4}}\n\nEsta mensagem confirma o crédito desta compra.';

const WELCOME_BODY_TEXT =
  'Olá, {{1}}. Cadastro confirmado na conta da *{{2}}*.\n\nEste número passa a receber as atualizações desta conta.';

const CAMPAIGN_BODY_TEXT =
  'Olá. Atualização da conta na *{{1}}*.\n\nFoi registrado na sua conta: {{2}}.\n\nO saldo desta conta não mudou com esta mensagem.';

const NOTICE_BODY_TEXT =
  'Olá. Atualização da conta na *{{1}}*.\n\n{{2}}\n\nO saldo desta conta não mudou com esta mensagem.';

export const PESQUISA_TEMPLATE_NAME = 'frego_earn_pesquisa_v3';
export const PESQUISA_TEMPLATE_LANG = 'pt_BR';

const PESQUISA_BODY_TEXT =
  'Olá. Registro da compra na *{{1}}*.\n\nCreditado nesta compra: *{{2}}*.\nSaldo da conta: *{{3}}*.\n\n{{4}}\n\nPesquisa sobre esta compra: {{5}}.\n\nA pesquisa refere-se somente a esta compra.';

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
  category?: string;
  components?: { type?: string; text?: string }[];
};

type FetchedTemplate = EarnTemplateState & {
  bodyText: string | null;
  category: string | null;
};

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
    'id,name,language,status,category,rejected_reason,components',
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
      category: null,
      error: metaErrorMessage(body.error) ?? `list_templates_${res.status}`,
    };
  }

  const match = (body.data ?? []).find(
    (t) =>
      t.name === name &&
      (t.language === language || t.language === language.replace('_', '-')),
  );

  if (!match) {
    return { status: 'missing', templateId: null, bodyText: null, category: null };
  }

  return {
    status: normalizeStatus(match.status),
    templateId: match.id ?? null,
    bodyText: templateBodyText(match),
    category: match.category?.toUpperCase() ?? null,
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
      category: 'UTILITY',
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
      status: 'missing',
      templateId,
      error: metaErrorMessage(body.error) ?? `update_template_${res.status}`,
    };
  }
  return {
    status: body.status ? normalizeStatus(body.status) : 'pending',
    templateId: body.id ?? templateId,
  };
}

function needsUtilityRestore(existing: FetchedTemplate): boolean {
  if (!existing.templateId || existing.category === 'MARKETING') return false;
  return existing.bodyText?.includes('Baixe o app Frego') === true;
}

async function restoreUtilityTemplate(
  accessToken: string,
  existing: FetchedTemplate,
  spec: TemplateSpec,
): Promise<EarnTemplateState> {
  if (!needsUtilityRestore(existing) || !existing.templateId) return existing;
  const updated = await updateTemplateBody(accessToken, existing.templateId, spec);
  if (updated.error) return { ...existing, error: updated.error };
  return updated;
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
    return restoreUtilityTemplate(accessToken, existing, spec);
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
      allow_category_change: false,
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
      return restoreUtilityTemplate(accessToken, again, spec);
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
      '3 carimbos',
      'Almoço: 3 de 10',
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
      '3 carimbos',
      'Almoço: 3 de 10',
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

export async function fetchAccountNoticeTemplateState(
  wabaId: string,
  accessToken: string,
  name = NOTICE_TEMPLATE_NAME,
  language = NOTICE_TEMPLATE_LANG,
): Promise<EarnTemplateState> {
  return fetchTemplateState(wabaId, accessToken, name, language);
}

export async function ensureAccountNoticeTemplate(
  wabaId: string,
  accessToken: string,
  name = NOTICE_TEMPLATE_NAME,
  language = NOTICE_TEMPLATE_LANG,
): Promise<EarnTemplateState> {
  return ensureTemplate(wabaId, accessToken, {
    name,
    language,
    bodyText: NOTICE_BODY_TEXT,
    exampleParams: ['Café Bloom', '3 carimbos vencem em 2 dias.'],
  });
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
    exampleParams: ['Café Bloom', 'Almoço'],
  });
}

export function mapWebhookTemplateEvent(
  event: string | undefined,
): EarnTemplateStatus | null {
  if (!event) return null;
  return normalizeStatus(event);
}
