import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEarnWhatsAppLines,
  earnPushCopy,
} from './whatsapp/earn-message.js';
import { buildEarnPushMessage } from './push/earn-notify.js';
import type { WalletSnapshot } from './wallet.js';

function wallet(partial?: Partial<WalletSnapshot['pools']>): WalletSnapshot {
  return {
    pools: {
      stamps: 3,
      points: 0,
      cashbackCents: 0,
      ...partial,
    },
    lots: [],
    campaigns: [],
    stampsExpireDays: null,
    pointsExpireDays: null,
    cashbackExpireDays: null,
    cashbackPercent: 0,
  };
}

describe('earn notify copy', () => {
  it('maps stamp earn to the same text on WhatsApp params and push', () => {
    const lines = buildEarnWhatsAppLines({
      businessName: 'Café Bloom',
      unitKind: 'stamps',
      quantity: 1,
      wallet: wallet({ stamps: 3 }),
    });
    assert.equal(lines.businessName, 'Café Bloom');
    assert.equal(lines.earnLine, '+1 carimbo');
    assert.equal(lines.balanceLine, '3 carimbos · 0 pts');

    const push = earnPushCopy(lines);
    assert.equal(push.title, 'Café Bloom');
    assert.match(push.body, /Você acabou de ganhar \+1 carimbo/);
    assert.match(push.body, /Seu saldo agora é: 3 carimbos · 0 pts/);
  });

  it('includes points and cashback in the shared earn line', () => {
    const lines = buildEarnWhatsAppLines({
      businessName: 'Padaria',
      unitKind: 'points',
      quantity: 12,
      amountCents: 2400,
      cashbackCents: 120,
      wallet: wallet({ points: 12, cashbackCents: 120 }),
    });
    assert.match(lines.earnLine, /\+12 pts/);
    assert.match(lines.earnLine, /cashback/);
    const push = earnPushCopy(lines);
    assert.equal(push.title, lines.businessName);
    assert.ok(push.body.includes(lines.earnLine));
    assert.ok(push.body.includes(lines.balanceLine));
  });
});

describe('buildEarnPushMessage', () => {
  it('puts unitKind in the data payload for the app deep link', () => {
    const message = buildEarnPushMessage({
      tokens: ['abc'],
      title: 'Loja',
      body: 'Você acabou de ganhar',
      businessId: 'biz_1',
      unitKind: 'stamps',
      transactionId: 'tx_1',
      quantity: 2,
    });
    assert.deepEqual(message.data, {
      type: 'earn',
      businessId: 'biz_1',
      unitKind: 'stamps',
      transactionId: 'tx_1',
      quantity: '2',
    });
    const payload = message.apns?.payload as Record<string, unknown> | undefined;
    assert.equal(payload?.type, 'earn');
    assert.equal(payload?.businessId, 'biz_1');
    assert.equal(payload?.unitKind, 'stamps');
  });
});
