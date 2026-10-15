import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHECK_INTERVAL_MS,
  RENEW_WITHIN_MS,
  chooseExchangedToken,
  interpretAccess,
  isGrantLostSend,
  isPartnerOffboardEvent,
  needsHealthCheck,
  needsRenewal,
} from './token-grant.js';

const day = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-15T12:00:00.000Z');

describe('WhatsApp token grant', () => {
  it('treats a missing phone permission as a lost grant', () => {
    assert.equal(
      isGrantLostSend({
        code: 100,
        subcode: 33,
        message: 'Unsupported post request',
      }),
      true,
    );
    assert.equal(isGrantLostSend({ code: 190, message: 'expired' }), true);
    assert.equal(
      isGrantLostSend({
        message:
          'Object does not exist, cannot be loaded due to missing permissions',
      }),
      true,
    );
    assert.equal(
      isGrantLostSend({ code: 132001, message: 'Template name does not exist' }),
      false,
    );
  });

  it('renews only inside the two-week window', () => {
    assert.equal(
      needsRenewal({ expiresAt: new Date(now.getTime() + 10 * day), neverExpires: false }, now),
      true,
    );
    assert.equal(
      needsRenewal({ expiresAt: new Date(now.getTime() + 40 * day), neverExpires: false }, now),
      false,
    );
    assert.equal(needsRenewal({ expiresAt: null, neverExpires: true }, now), false);
    assert.equal(needsRenewal({ expiresAt: null, neverExpires: false }, now), false);
    assert.equal(RENEW_WITHIN_MS, 14 * day);
  });

  it('checks a token again after a day', () => {
    assert.equal(needsHealthCheck(null, now), true);
    assert.equal(needsHealthCheck(new Date(now.getTime() - CHECK_INTERVAL_MS), now), true);
    assert.equal(needsHealthCheck(new Date(now.getTime() - 60 * 60 * 1000), now), false);
  });

  it('keeps a token that can still read the phone when the scope list is incomplete', () => {
    assert.equal(
      interpretAccess({ valid: true, hasMessaging: false }, 'ok'),
      'healthy',
    );
    assert.equal(
      interpretAccess({ valid: true, hasMessaging: false }, 'lost'),
      'lost',
    );
    assert.equal(
      interpretAccess({ valid: true, hasMessaging: false }, 'unknown'),
      'unknown',
    );
    assert.equal(interpretAccess({ valid: false, hasMessaging: true }, 'ok'), 'lost');
    assert.equal(interpretAccess(null, 'lost'), 'unknown');
  });

  it('accepts an exchanged token only when it still has messaging and does not expire sooner', () => {
    const current = {
      valid: true,
      hasMessaging: true,
      expiresAt: new Date('2026-12-12T00:00:00.000Z'),
      neverExpires: false,
    };
    assert.equal(
      chooseExchangedToken(current, {
        valid: true,
        hasMessaging: false,
        expiresAt: null,
        neverExpires: true,
      }),
      'current',
    );
    assert.equal(
      chooseExchangedToken(current, {
        valid: true,
        hasMessaging: true,
        expiresAt: null,
        neverExpires: true,
      }),
      'exchanged',
    );
    assert.equal(
      chooseExchangedToken(current, {
        valid: true,
        hasMessaging: true,
        expiresAt: new Date('2026-11-01T00:00:00.000Z'),
        neverExpires: false,
      }),
      'current',
    );
    assert.equal(
      chooseExchangedToken(
        { valid: false, hasMessaging: false, expiresAt: null, neverExpires: false },
        {
          valid: true,
          hasMessaging: true,
          expiresAt: new Date('2026-11-01T00:00:00.000Z'),
          neverExpires: false,
        },
      ),
      'exchanged',
    );
  });

  it('recognises Meta offboard events', () => {
    assert.equal(isPartnerOffboardEvent('PARTNER_REMOVED'), true);
    assert.equal(isPartnerOffboardEvent('ACCOUNT_OFFBOARDED'), true);
    assert.equal(isPartnerOffboardEvent('PARTNER_ADDED'), false);
    assert.equal(isPartnerOffboardEvent(undefined), false);
  });
});
