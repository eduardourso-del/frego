import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  approvalNotifiesOwner,
  businessApprovedMail,
  businessRefusedMail,
  establishmentLoginUrl,
  refusalNotifiesOwner,
} from './business-approved.js';

describe('approval email', () => {
  it('notifies when a pending estabelecimento is approved', () => {
    assert.equal(approvalNotifiesOwner('pending', 'trial'), true);
    assert.equal(approvalNotifiesOwner('pending', 'active'), true);
    assert.equal(approvalNotifiesOwner('pending', 'suspended'), false);
    assert.equal(approvalNotifiesOwner('trial', 'active'), false);
  });

  it('names the estabelecimento and the painel link', () => {
    const mail = businessApprovedMail({
      to: 'ana@padaria.test',
      ownerName: 'Ana Souza',
      businessName: 'Padaria do Bairro',
      loginUrl: 'https://frego.app.br/login',
    });
    assert.equal(mail.to, 'ana@padaria.test');
    assert.equal(mail.subject, 'Seu estabelecimento foi aprovado');
    assert.match(mail.text, /Olá, Ana\./);
    assert.match(mail.text, /Padaria do Bairro foi aprovado/);
    assert.match(mail.text, /https:\/\/frego\.app\.br\/login/);
    assert.match(mail.html, /<strong>Padaria do Bairro<\/strong>/);
    assert.match(
      mail.html,
      /src="https:\/\/frego\.app\.br\/brand\/png\/frego-assinatura-escura-600\.png"/,
    );
    assert.match(mail.html, /bgcolor="#FFD900"/);
    assert.match(mail.html, /background:#FFD900/);
    assert.match(mail.html, /href="https:\/\/frego\.app\.br\/login"/);
  });

  it('escapes the name in the html part', () => {
    const mail = businessApprovedMail({
      to: 'ana@padaria.test',
      ownerName: '<Ana>',
      businessName: 'Padaria & Cia',
      loginUrl: 'https://frego.app.br/login',
    });
    assert.match(mail.html, /Olá, &lt;Ana&gt;\./);
    assert.match(mail.html, /Padaria &amp; Cia/);
    assert.doesNotMatch(mail.html, /<Ana>/);
  });

  it('asks the owner to write when the cadastro is refused', () => {
    assert.equal(refusalNotifiesOwner('pending', 'suspended'), true);
    assert.equal(refusalNotifiesOwner('trial', 'suspended'), false);
    assert.equal(refusalNotifiesOwner('pending', 'trial'), false);
    const mail = businessRefusedMail({
      to: 'ana@padaria.test',
      ownerName: 'Ana Souza',
      businessName: 'Padaria & Cia',
    });
    assert.equal(mail.subject, 'Seu estabelecimento foi recusado');
    assert.match(mail.text, /Olá, Ana\./);
    assert.match(mail.text, /Padaria & Cia não foi aprovado/);
    assert.match(mail.text, /contato@frego\.app\.br/);
    assert.match(mail.html, /<strong>Padaria &amp; Cia<\/strong>/);
    assert.match(
      mail.html,
      /href="mailto:contato@frego\.app\.br"/,
    );
    assert.match(mail.html, /Escrever para a Frego/);
    assert.doesNotMatch(mail.html, /Entrar no painel/);
  });

  it('falls back to the public painel when the origin is unset', () => {
    const previousOrigin = process.env.ESTABLISHMENT_APP_ORIGIN;
    const previousPesquisa = process.env.PESQUISA_PUBLIC_ORIGIN;
    delete process.env.ESTABLISHMENT_APP_ORIGIN;
    delete process.env.PESQUISA_PUBLIC_ORIGIN;
    try {
      assert.equal(establishmentLoginUrl(), 'https://frego.app.br/login');
    } finally {
      if (previousOrigin === undefined) delete process.env.ESTABLISHMENT_APP_ORIGIN;
      else process.env.ESTABLISHMENT_APP_ORIGIN = previousOrigin;
      if (previousPesquisa === undefined) delete process.env.PESQUISA_PUBLIC_ORIGIN;
      else process.env.PESQUISA_PUBLIC_ORIGIN = previousPesquisa;
    }
  });
});
