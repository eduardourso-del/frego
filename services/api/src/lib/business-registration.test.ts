import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUSINESS_APPLICATION_TTL_MS,
  addressFromStored,
  businessApplicationExpired,
  cadastroAwaitsEmail,
} from './business-registration.js';

describe('cadastro email gate', () => {
  it('holds the cadastro until the inbox is confirmed', () => {
    assert.equal(cadastroAwaitsEmail(false), true);
    assert.equal(cadastroAwaitsEmail(true), false);
  });

  it('expires a cadastro after seven days', () => {
    const updatedAt = new Date('2026-10-01T12:00:00.000Z');
    const stillValid = new Date(updatedAt.getTime() + BUSINESS_APPLICATION_TTL_MS);
    const expired = new Date(stillValid.getTime() + 1);
    assert.equal(businessApplicationExpired(updatedAt, stillValid), false);
    assert.equal(businessApplicationExpired(updatedAt, expired), true);
  });

  it('reads the operating address back from the stored cadastro', () => {
    const parsed = addressFromStored({
      postalCode: '01310100',
      street: 'Avenida Paulista',
      streetNumber: '1000',
      complement: '',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.address.timeZone, 'America/Sao_Paulo');
    assert.equal(parsed.address.state, 'SP');
    assert.equal(parsed.address.complement, null);
  });

  it('rejects a stored address without a UF', () => {
    const parsed = addressFromStored({ street: 'Rua A' });
    assert.deepEqual(parsed, { ok: false, error: 'INVALID_STATE' });
  });
});
