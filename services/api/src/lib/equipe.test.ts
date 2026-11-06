import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  equipeCanChange,
  equipeHasRoom,
  equipeOccupiesSeat,
  normalizeEquipeEmail,
  normalizeEquipeName,
  planEquipeAdd,
  shouldDeleteInvitedLogin,
} from './equipe.js';
import { equipeAddedMail } from './mail/equipe.js';

describe('equipe seats', () => {
  it('counts pending and active Membros, not the Dono or a Desativado', () => {
    assert.equal(equipeOccupiesSeat({ role: 'owner', status: 'active' }), false);
    assert.equal(equipeOccupiesSeat({ role: 'employee', status: 'disabled' }), false);
    assert.equal(equipeOccupiesSeat({ role: 'employee', status: 'pending' }), true);
    assert.equal(equipeOccupiesSeat({ role: 'manager', status: 'active' }), true);
  });

  it('stops at the Growth cap and leaves Enterprise open', () => {
    assert.equal(equipeHasRoom(2, 2), false);
    assert.equal(equipeHasRoom(2, 1), true);
    assert.equal(equipeHasRoom(0, 0), false);
    assert.equal(equipeHasRoom(null, 40), true);
  });
});

describe('equipe add', () => {
  const actor = 'ana@padaria.test';

  it('adds a new address', () => {
    assert.deepEqual(
      planEquipeAdd({
        actorEmail: actor,
        email: 'joao@padaria.test',
        operator: false,
        existing: null,
      }),
      { action: 'add' },
    );
  });

  it('refuses the dono, an operator, and someone who can already sign in', () => {
    assert.equal(
      planEquipeAdd({
        actorEmail: 'Ana@padaria.test',
        email: 'ana@padaria.test',
        operator: false,
        existing: null,
      }).action,
      'refuse',
    );
    assert.deepEqual(
      planEquipeAdd({
        actorEmail: actor,
        email: 'ops@frego.app',
        operator: true,
        existing: null,
      }),
      { action: 'refuse', error: 'OPERATOR' },
    );
    assert.deepEqual(
      planEquipeAdd({
        actorEmail: actor,
        email: 'joao@padaria.test',
        operator: false,
        existing: { role: 'employee', status: 'active' },
      }),
      { action: 'refuse', error: 'ALREADY_ACTIVE' },
    );
  });

  it('resends while aguardando and turns desativado back on', () => {
    assert.equal(
      planEquipeAdd({
        actorEmail: actor,
        email: 'joao@padaria.test',
        operator: false,
        existing: { role: 'employee', status: 'pending' },
      }).action,
      'resend',
    );
    assert.equal(
      planEquipeAdd({
        actorEmail: actor,
        email: 'joao@padaria.test',
        operator: false,
        existing: { role: 'employee', status: 'disabled' },
      }).action,
      'enable',
    );
  });

  it('frees a dropped login only when it has no password and no other equipe', () => {
    assert.equal(
      shouldDeleteInvitedLogin({ otherMemberships: 0, hasPassword: false }),
      true,
    );
    assert.equal(
      shouldDeleteInvitedLogin({ otherMemberships: 1, hasPassword: false }),
      false,
    );
    assert.equal(
      shouldDeleteInvitedLogin({ otherMemberships: 0, hasPassword: true }),
      false,
    );
  });

  it('allows equipe changes once the painel is open', () => {
    assert.equal(equipeCanChange('pending'), false);
    assert.equal(equipeCanChange('suspended'), false);
    assert.equal(equipeCanChange('trial'), true);
    assert.equal(equipeCanChange('active'), true);
    assert.equal(equipeCanChange('past_due'), true);
  });

  it('keeps a name and a lowercase e-mail', () => {
    assert.equal(normalizeEquipeName('  João   Silva '), 'João Silva');
    assert.equal(normalizeEquipeName('   '), null);
    assert.equal(normalizeEquipeEmail(' Joao@Padaria.Test '), 'joao@padaria.test');
    assert.equal(normalizeEquipeEmail('joao'), null);
  });
});

describe('equipe mail', () => {
  it('names the estabelecimento and includes the set-password link for a new inbox', () => {
    const mail = equipeAddedMail({
      to: 'joao@padaria.test',
      name: 'João Silva',
      businessName: 'Padaria & Cia',
      passwordUrl: 'https://frego.app.br/redefinir-senha?oobCode=abc',
      loginUrl: 'https://frego.app.br/login',
    });
    assert.equal(mail.to, 'joao@padaria.test');
    assert.match(mail.subject, /Padaria & Cia/);
    assert.match(mail.text, /Olá, João\./);
    assert.match(mail.text, /como Balcão/);
    assert.match(mail.text, /redefinir-senha\?oobCode=abc/);
    assert.match(mail.html, /Padaria &amp; Cia/);
    assert.match(mail.html, /Criar senha/);
    assert.doesNotMatch(mail.text, /frego\.app\.br\/login/);
  });

  it('leaves an existing password alone', () => {
    const mail = equipeAddedMail({
      to: 'marina@padaria.test',
      name: 'Marina',
      businessName: 'Padaria do Bairro',
      passwordUrl: null,
      loginUrl: 'https://frego.app.br/login',
    });
    assert.match(mail.text, /senha que você já usa/);
    assert.match(mail.text, /https:\/\/frego\.app\.br\/login/);
    assert.match(mail.html, /Entrar/);
    assert.doesNotMatch(mail.text, /Criar sua senha/);
    assert.doesNotMatch(mail.html, /redefinir-senha/);
  });
});
