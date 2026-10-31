import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { WalletSnapshot } from '../wallet.js';
import { buildEarnWhatsAppLines } from './earn-message.js';
import {
  EARN_NOTIFY_FLUSH_DELAY_MS,
  EARN_NOTIFY_QUIET_MS,
  activeHold,
  holdToNotifyInput,
  mergeEarnHold,
  parseEarnHoldPayload,
  releaseEarnHold,
  type EarnNotifyHoldPayload,
} from './earn-hold.js';
import type { EarnNotifyInput } from './earn-message.js';

function wallet(partial?: Partial<WalletSnapshot['pools']>): WalletSnapshot {
  return {
    pools: {
      stamps: 1,
      points: 0,
      cashbackCents: 0,
      ...partial,
    },
    lots: [],
    campaigns: [],
    stampsExpireDays: null,
    pointsExpireDays: null,
    cashbackExpireDays: null,
    cashbackUseMultiple: null,
    cashbackPercent: 0,
    stampDestinations: [],
  };
}

function earn(partial: Partial<EarnNotifyInput> & Pick<EarnNotifyInput, 'unitKind'>): EarnNotifyInput {
  return {
    businessId: 'biz',
    businessName: 'Padaria Sol',
    customerId: 'cus',
    toE164: '+5511999990000',
    quantity: 1,
    wallet: wallet(),
    ...partial,
  };
}

function held(input: EarnNotifyInput): EarnNotifyHoldPayload {
  const merged = mergeEarnHold(null, input);
  assert.equal(merged.flushNow, null);
  return merged.next;
}

describe('earn notify timing', () => {
  it('flushes after 10 seconds of quiet and within 15 seconds', () => {
    assert.equal(EARN_NOTIFY_QUIET_MS, 10_000);
    assert.ok(EARN_NOTIFY_FLUSH_DELAY_MS > EARN_NOTIFY_QUIET_MS);
    assert.ok(EARN_NOTIFY_FLUSH_DELAY_MS <= 15_000);
  });
});

describe('mergeEarnHold', () => {
  it('sums carimbos on the same Cartela and keeps the latest balance', () => {
    const first = held(
      earn({
        unitKind: 'stamps',
        quantity: 1,
        saleId: 'sale-1',
        transactionId: 'tx-1',
        wallet: wallet({ stamps: 4 }),
        stampEarn: { cartela: true, label: 'Café', balance: 4 },
      }),
    );
    const second = earn({
      unitKind: 'stamps',
      quantity: 1,
      saleId: 'sale-2',
      transactionId: 'tx-2',
      wallet: wallet({ stamps: 6 }),
      stampEarn: { cartela: true, label: 'Café', balance: 6 },
    });
    const merged = mergeEarnHold(first, second);
    assert.equal(merged.flushNow, null);
    const notice = holdToNotifyInput(merged.next);
    assert.equal(notice.quantity, 2);
    assert.equal(notice.stampEarn?.balance, 6);
    assert.equal(notice.transactionId, 'tx-2');
    assert.equal(notice.summaryLine, '+2 carimbos · Café');

    const lines = buildEarnWhatsAppLines({
      businessName: notice.businessName,
      unitKind: notice.unitKind,
      quantity: notice.quantity,
      wallet: notice.wallet,
      stampEarn: notice.stampEarn,
      summaryLine: notice.summaryLine,
    });
    assert.equal(lines.earnLine, '+2 carimbos · Café');
    assert.match(lines.balanceLine, /^6 carimbos/);
  });

  it('folds different Cartelas into the same quiet window', () => {
    const cafe = held(
      earn({
        unitKind: 'stamps',
        saleId: 'sale-1',
        stampEarn: { cartela: true, label: 'Café', balance: 2 },
      }),
    );
    const pao = earn({
      unitKind: 'stamps',
      saleId: 'sale-2',
      stampEarn: { cartela: true, label: 'Pão', balance: 1 },
    });
    const merged = mergeEarnHold(cafe, pao);
    assert.equal(merged.flushNow, null);
    assert.equal(merged.next.parts.length, 2);
    assert.equal(
      holdToNotifyInput(merged.next).summaryLine,
      '+1 carimbo · Café + 1 carimbo · Pão',
    );
  });

  it('folds carimbos, pontos, and cashback into one message', () => {
    const stamps = held(earn({ unitKind: 'stamps', quantity: 2 }));
    const withPoints = mergeEarnHold(
      stamps,
      earn({
        unitKind: 'points',
        quantity: 10,
        amountCents: 2000,
      }),
    );
    assert.equal(withPoints.flushNow, null);
    const reais = (250 / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const pointsReais = (2000 / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const merged = mergeEarnHold(
      withPoints.next,
      earn({
        unitKind: 'cashback',
        quantity: 0,
        cashbackCents: 250,
      }),
    );
    assert.equal(merged.flushNow, null);
    const notice = holdToNotifyInput(merged.next);
    assert.equal(notice.unitKind, 'cashback');
    assert.equal(notice.quantity, 0);
    assert.equal(
      notice.summaryLine,
      `+2 carimbos + 10 pts (${pointsReais}) + ${reais} cashback`,
    );
  });

  it('sums pontos, reais, and cashback across the burst', () => {
    const first = held(
      earn({
        unitKind: 'points',
        quantity: 10,
        amountCents: 2000,
        cashbackCents: 100,
      }),
    );
    const merged = mergeEarnHold(
      first,
      earn({
        unitKind: 'points',
        quantity: 5,
        amountCents: 1000,
        cashbackCents: 50,
        wallet: wallet({ points: 15, cashbackCents: 150 }),
      }),
    );
    const notice = holdToNotifyInput(merged.next);
    assert.equal(notice.quantity, 15);
    assert.equal(notice.amountCents, 3000);
    assert.equal(notice.cashbackCents, 150);
    assert.equal(notice.wallet.pools.points, 15);
    const reais = (3000 / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const cashback = (150 / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    assert.equal(notice.summaryLine, `+15 pts (${reais}) + ${cashback} cashback`);
  });

  it('keeps a Convite from an earlier earn when the later one has none', () => {
    const first = held(
      earn({
        unitKind: 'stamps',
        pesquisa: {
          sentence: 'Como foi?',
          url: 'https://frego.app.br/p/1',
          conviteId: 'convite-1',
        },
      }),
    );
    const merged = mergeEarnHold(first, earn({ unitKind: 'stamps', quantity: 1 }));
    assert.equal(holdToNotifyInput(merged.next).pesquisa?.conviteId, 'convite-1');
  });

  it('uses the latest Convite when a later earn refreshes it', () => {
    const first = held(
      earn({
        unitKind: 'stamps',
        pesquisa: {
          sentence: 'Como foi?',
          url: 'https://frego.app.br/p/1',
          conviteId: 'convite-1',
        },
      }),
    );
    const merged = mergeEarnHold(
      first,
      earn({
        unitKind: 'stamps',
        pesquisa: {
          sentence: 'Como foi agora?',
          url: 'https://frego.app.br/p/2',
          conviteId: 'convite-2',
        },
      }),
    );
    assert.equal(holdToNotifyInput(merged.next).pesquisa?.conviteId, 'convite-2');
  });
});

describe('releaseEarnHold', () => {
  it('drops the hold when the only sale in the window is reversed', () => {
    const payload = held(
      earn({ unitKind: 'stamps', saleId: 'sale-1', transactionId: 'tx-1' }),
    );
    const left = releaseEarnHold(
      payload,
      { saleId: 'sale-1', transactionIds: ['tx-1'] },
      wallet({ stamps: 0 }),
    );
    assert.equal(left, null);
  });

  it('keeps the other carimbos and the balance after the reverse', () => {
    const first = held(
      earn({
        unitKind: 'stamps',
        quantity: 1,
        saleId: 'sale-1',
        transactionId: 'tx-1',
        stampEarn: { cartela: true, label: 'Café', balance: 2 },
        pesquisa: {
          sentence: 'Como foi?',
          url: 'https://frego.app.br/p/1',
          conviteId: 'convite-1',
        },
      }),
    );
    const merged = mergeEarnHold(
      first,
      earn({
        unitKind: 'stamps',
        quantity: 1,
        saleId: 'sale-2',
        transactionId: 'tx-2',
        stampEarn: { cartela: true, label: 'Café', balance: 3 },
      }),
    ).next;
    const after = wallet({ stamps: 2 });
    after.stampDestinations = [
      {
        campaignId: 'camp',
        label: 'Café',
        balance: 2,
        cartela: true,
        earnable: true,
      },
    ];
    const left = releaseEarnHold(
      merged,
      { saleId: 'sale-1', transactionIds: ['tx-1'] },
      after,
    );
    assert.ok(left);
    const notice = holdToNotifyInput(left);
    assert.equal(notice.quantity, 1);
    assert.equal(notice.transactionId, 'tx-2');
    assert.equal(notice.stampEarn?.balance, 2);
    assert.equal(notice.pesquisa, null);
    assert.equal(notice.wallet.pools.stamps, 2);
  });
});

describe('parseEarnHoldPayload', () => {
  it('round-trips a held burst', () => {
    const payload = held(
      earn({ unitKind: 'cashback', quantity: 0, cashbackCents: 250, saleId: 'sale-1' }),
    );
    const parsed = parseEarnHoldPayload(JSON.parse(JSON.stringify(payload)));
    assert.deepEqual(parsed, payload);
  });

  it('rejects a payload without parts', () => {
    assert.equal(parseEarnHoldPayload({ unitKind: 'stamps', parts: [] }), null);
  });

  it('remembers that a hold was already sent', () => {
    const payload = held(
      earn({ unitKind: 'stamps', quantity: 1, saleId: 'sale-1' }),
    );
    payload.sentAt = '2026-10-21T15:00:00.000Z';
    const parsed = parseEarnHoldPayload(JSON.parse(JSON.stringify(payload)));
    assert.equal(parsed?.sentAt, payload.sentAt);
    assert.equal(activeHold(parsed), null);
  });

  it('reads an older part that has no unit kind of its own', () => {
    const parsed = parseEarnHoldPayload({
      businessId: 'biz',
      businessName: 'Padaria Sol',
      customerId: 'cus',
      toE164: '+5511999990000',
      unitKind: 'points',
      wallet: wallet({ points: 10 }),
      stampEarn: null,
      parts: [
        {
          saleId: 'sale-1',
          transactionId: 'tx-1',
          quantity: 10,
          amountCents: 2000,
          cashbackCents: null,
          pesquisa: null,
        },
      ],
    });
    assert.equal(parsed?.parts[0]?.unitKind, 'points');
    assert.equal(holdToNotifyInput(parsed!).summaryLine?.startsWith('+10 pts'), true);
  });
});
