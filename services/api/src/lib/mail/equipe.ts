import type { OutboundMail } from './send.js';
import { brandedHtml, greeting } from './business-approved.js';

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

function businessLabel(businessName: string) {
  return oneLine(businessName) || 'Seu estabelecimento';
}

/** One Frego note. A new inbox gets the set-password link; an existing one does not. */
export function equipeAddedMail(input: {
  to: string;
  name: string | null;
  businessName: string;
  passwordUrl: string | null;
  loginUrl: string;
}): OutboundMail {
  const shop = businessLabel(input.businessName);
  const shopHtml = escapeHtml(shop);
  const setPassword = Boolean(input.passwordUrl);
  const actionHref = input.passwordUrl ?? input.loginUrl;
  const subject = `Você entrou na equipe de ${shop}`;
  const hello = greeting(input.name);
  const text = setPassword
    ? `${hello}\n\n${shop} adicionou você como Balcão. Crie sua senha para entrar:\n${actionHref}\n`
    : `${hello}\n\n${shop} adicionou você como Balcão. Entre com a senha que você já usa:\n${actionHref}\n`;
  const body = setPassword
    ? `<strong>${shopHtml}</strong> adicionou você como Balcão. Crie sua senha para entrar.`
    : `<strong>${shopHtml}</strong> adicionou você como Balcão. Entre com a senha que você já usa.`;
  const html = brandedHtml({
    title: 'Você entrou na equipe',
    hello,
    body,
    preheader: `${shop} adicionou você como Balcão.`,
    actionHref,
    actionLabel: setPassword ? 'Criar senha' : 'Entrar',
  });
  return { to: input.to, subject, text, html };
}
