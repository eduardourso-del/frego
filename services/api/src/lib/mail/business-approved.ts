import { prisma } from '@frego/db';
import { sendMail, type MailResult, type OutboundMail } from './send.js';

/** Leaving the review queue for a usable status is the approval. */
export function approvalNotifiesOwner(from: string, to: string) {
  return from === 'pending' && (to === 'trial' || to === 'active');
}

/** Recusar is pending → suspended. A later suspension is a different decision. */
export function refusalNotifiesOwner(from: string, to: string) {
  return from === 'pending' && to === 'suspended';
}

export function establishmentLoginUrl() {
  const raw = (
    process.env.ESTABLISHMENT_APP_ORIGIN ??
    process.env.PESQUISA_PUBLIC_ORIGIN ??
    'https://frego.app.br'
  ).replace(/\/$/, '');
  const origin = /^https?:\/\//i.test(raw) ? raw : 'https://frego.app.br';
  return `${origin}/login`;
}

function oneLine(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Public mark. Email clients cannot load a localhost file. */
const LOGO_URL =
  'https://frego.app.br/brand/png/frego-assinatura-escura-600.png';
const CONTACT_EMAIL = 'contato@frego.app.br';

function brandedHtml(input: {
  title: string;
  hello: string;
  body: string;
  preheader: string;
  actionHref: string;
  actionLabel: string;
}) {
  const title = escapeHtml(input.title);
  const hello = escapeHtml(input.hello);
  const preheader = escapeHtml(input.preheader);
  const actionHref = escapeHtml(input.actionHref);
  const actionLabel = escapeHtml(input.actionLabel);
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F4EFE6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F4EFE6;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;">
          <tr>
            <td bgcolor="#FFD900" style="background:#FFD900;padding:28px 32px;border-radius:20px 20px 0 0;">
              <img src="${LOGO_URL}" width="156" alt="Frego" style="display:block;border:0;outline:none;text-decoration:none;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0;font-family:${font};font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.03em;color:#070707;">
              ${title}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;font-family:${font};font-size:16px;line-height:1.5;color:#070707;">
              ${hello}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0;font-family:${font};font-size:16px;line-height:1.5;color:#070707;">
              ${input.body}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#FFD900;">
                    <a href="${actionHref}" style="display:inline-block;padding:14px 22px;font-family:${font};font-size:15px;font-weight:700;line-height:1;color:#070707;text-decoration:none;">${actionLabel}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-family:${font};font-size:12px;line-height:1.5;color:#6B6B6B;">
          Frego · <a href="mailto:${CONTACT_EMAIL}" style="color:#6B6B6B;text-decoration:underline;">${CONTACT_EMAIL}</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function greeting(ownerName: string | null) {
  const first = oneLine(ownerName ?? '').split(/\s+/).filter(Boolean)[0];
  return first ? `Olá, ${first}.` : 'Olá.';
}

function businessLabel(businessName: string) {
  return oneLine(businessName) || 'Seu estabelecimento';
}

export function businessApprovedMail(input: {
  to: string;
  ownerName: string | null;
  businessName: string;
  loginUrl: string;
}): OutboundMail {
  const hello = greeting(input.ownerName);
  const name = businessLabel(input.businessName);
  const subject = 'Seu estabelecimento foi aprovado';
  const text = [
    hello,
    '',
    `${name} foi aprovado. Entre no painel para configurar as campanhas e usar o balcão.`,
    '',
    input.loginUrl,
  ].join('\n');
  const html = brandedHtml({
    title: subject,
    hello,
    body: `<strong>${escapeHtml(name)}</strong> foi aprovado. Entre no painel para configurar as campanhas e usar o balcão.`,
    preheader: `${name} já pode configurar as campanhas e o balcão.`,
    actionHref: input.loginUrl,
    actionLabel: 'Entrar no painel',
  });
  return { to: input.to, subject, text, html };
}

export function businessRefusedMail(input: {
  to: string;
  ownerName: string | null;
  businessName: string;
}): OutboundMail {
  const hello = greeting(input.ownerName);
  const name = businessLabel(input.businessName);
  const subject = 'Seu estabelecimento foi recusado';
  const mailto = `mailto:${CONTACT_EMAIL}`;
  const text = [
    hello,
    '',
    `${name} não foi aprovado. Se quiser conversar sobre o cadastro, escreva para ${CONTACT_EMAIL}.`,
    '',
    CONTACT_EMAIL,
  ].join('\n');
  const html = brandedHtml({
    title: subject,
    hello,
    body: `<strong>${escapeHtml(name)}</strong> não foi aprovado. Se quiser conversar sobre o cadastro, escreva para <a href="${mailto}" style="color:#070707;">${CONTACT_EMAIL}</a>.`,
    preheader: `Escreva para ${CONTACT_EMAIL} se quiser conversar sobre o cadastro.`,
    actionHref: mailto,
    actionLabel: 'Escrever para a Frego',
  });
  return { to: input.to, subject, text, html };
}

async function ownerInbox(businessId: string) {
  const owner = await prisma.teamMember.findFirst({
    where: { businessId, role: 'owner', status: 'active' },
    orderBy: { createdAt: 'asc' },
    select: { email: true, displayName: true },
  });
  const to = owner?.email?.trim();
  if (!to) return null;
  return { to, ownerName: owner?.displayName ?? null };
}

export async function notifyBusinessApproved(business: {
  id: string;
  name: string;
}): Promise<MailResult> {
  const owner = await ownerInbox(business.id);
  if (!owner) return { sent: false, reason: 'no_recipient' };
  return sendMail(
    businessApprovedMail({
      to: owner.to,
      ownerName: owner.ownerName,
      businessName: business.name,
      loginUrl: establishmentLoginUrl(),
    }),
  );
}

export async function notifyBusinessRefused(business: {
  id: string;
  name: string;
}): Promise<MailResult> {
  const owner = await ownerInbox(business.id);
  if (!owner) return { sent: false, reason: 'no_recipient' };
  return sendMail(
    businessRefusedMail({
      to: owner.to,
      ownerName: owner.ownerName,
      businessName: business.name,
    }),
  );
}

export async function emailOwnerIfApproved(
  log: { warn: (obj: object, msg?: string) => void },
  from: string,
  to: string,
  business: { id: string; name: string },
) {
  if (!approvalNotifiesOwner(from, to)) return;
  try {
    const result = await notifyBusinessApproved(business);
    if (!result.sent) {
      log.warn(
        {
          businessId: business.id,
          reason: result.reason,
          detail: 'detail' in result ? result.detail : undefined,
        },
        'approval email not sent',
      );
    }
  } catch (err) {
    log.warn({ err, businessId: business.id }, 'approval email failed');
  }
}

export async function emailOwnerIfRefused(
  log: { warn: (obj: object, msg?: string) => void },
  from: string,
  to: string,
  business: { id: string; name: string },
) {
  if (!refusalNotifiesOwner(from, to)) return;
  try {
    const result = await notifyBusinessRefused(business);
    if (!result.sent) {
      log.warn(
        {
          businessId: business.id,
          reason: result.reason,
          detail: 'detail' in result ? result.detail : undefined,
        },
        'refusal email not sent',
      );
    }
  } catch (err) {
    log.warn({ err, businessId: business.id }, 'refusal email failed');
  }
}
