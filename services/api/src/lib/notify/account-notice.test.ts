import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { WalletLot } from '../wallet.js';
import {
  accountNoticeCopy,
  campaignEndingDetail,
  channelSettled,
  clampExpiryNoticeDays,
  collectEndingCampaigns,
  collectExpiryNotices,
  expiryDetail,
  msUntilNextReminder,
  packExpiryNotices,
  type ExpiryNotice,
} from './account-notice.js';

function lot(partial: Partial<WalletLot> & Pick<WalletLot, 'unitKind' | 'quantity'>): WalletLot {
  return {
    earnedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-10-20',
    daysLeft: 3,
    destinationLabel: null,
    ...partial,
  };
}

describe('collectExpiryNotices', () => {
  it('keeps carimbos, pontos, and cashback inside the 7-day window', () => {
    const notices = collectExpiryNotices([
      lot({ unitKind: 'stamps', quantity: 2, daysLeft: 7, destinationLabel: 'Carimbos' }),
      lot({ unitKind: 'points', quantity: 40, daysLeft: 1, expiresAt: '2026-10-18' }),
      lot({
        unitKind: 'cashback_cents',
        quantity: 1250,
        daysLeft: 0,
        expiresAt: '2026-10-17',
      }),
      lot({ unitKind: 'stamps', quantity: 9, daysLeft: 8 }),
      lot({ unitKind: 'points', quantity: 5, expiresAt: null, daysLeft: null }),
    ]);
    assert.deepEqual(
      notices.map((n) => [n.unitKind, n.quantity, n.daysLeft]),
      [
        ['cashback_cents', 1250, 0],
        ['points', 40, 1],
        ['stamps', 2, 7],
      ],
    );
  });

  it('sums lots that share a wallet, date, and Cartela', () => {
    const notices = collectExpiryNotices([
      lot({
        unitKind: 'stamps',
        quantity: 2,
        destinationLabel: 'Café',
        expiresAt: '2026-10-20',
      }),
      lot({
        unitKind: 'stamps',
        quantity: 3,
        destinationLabel: 'Café',
        expiresAt: '2026-10-20',
      }),
      lot({
        unitKind: 'stamps',
        quantity: 1,
        destinationLabel: 'Almoço',
        expiresAt: '2026-10-20',
      }),
    ]);
    assert.equal(notices.length, 2);
    assert.equal(notices.find((n) => n.destinationLabel === 'Café')?.quantity, 5);
  });

  it('uses the Estabelecimento Antecedência as the window', () => {
    const notices = collectExpiryNotices(
      [
        lot({ unitKind: 'points', quantity: 10, daysLeft: 3 }),
        lot({ unitKind: 'points', quantity: 10, daysLeft: 4, expiresAt: '2026-10-21' }),
      ],
      3,
    );
    assert.deepEqual(
      notices.map((n) => n.daysLeft),
      [3],
    );
  });
});

function expiryNotice(
  daysLeft: number,
  expiresAt: string,
): ExpiryNotice {
  return {
    keySuffix: `${expiresAt}:${daysLeft}`,
    unitKind: 'points',
    quantity: 10,
    expiresAt,
    daysLeft,
    destinationLabel: null,
  };
}

describe('packExpiryNotices', () => {
  it('sends further last-day lines the same morning and waits with the rest', () => {
    const hoje = expiryNotice(0, '2026-10-17');
    const outroHoje = expiryNotice(0, '2026-10-17');
    const depois = expiryNotice(3, '2026-10-20');
    const packed = packExpiryNotices([hoje, outroHoje, depois], 30);
    assert.equal(expiryDetail([hoje]).length <= 30, true);
    assert.equal(packed.send.length, 2);
    assert.deepEqual(packed.send[0], [hoje]);
    assert.deepEqual(packed.send[1], [outroHoje]);
    assert.deepEqual(packed.defer, [depois]);
  });

  it('keeps a later line in the first message when the whole line fits', () => {
    const hoje = expiryNotice(0, '2026-10-17');
    const amanha = expiryNotice(1, '2026-10-18');
    const depois = expiryNotice(5, '2026-10-22');
    const packed = packExpiryNotices([hoje, amanha, depois], 50);
    assert.deepEqual(packed.send, [[hoje, amanha]]);
    assert.deepEqual(packed.defer, [depois]);
  });

  it('sends a line that alone is longer than the room', () => {
    const longa: ExpiryNotice = {
      keySuffix: 'longa',
      unitKind: 'stamps',
      quantity: 2,
      expiresAt: '2026-10-20',
      daysLeft: 4,
      destinationLabel: 'C'.repeat(200),
    };
    const packed = packExpiryNotices([longa]);
    assert.equal(expiryDetail([longa]).length > 180, true);
    assert.deepEqual(packed.send, [[longa]]);
    assert.deepEqual(packed.defer, []);
  });
});

describe('clampExpiryNoticeDays', () => {
  it('keeps 1 to 30 and falls back to 7', () => {
    assert.equal(clampExpiryNoticeDays(3), 3);
    assert.equal(clampExpiryNoticeDays(0), 1);
    assert.equal(clampExpiryNoticeDays(90), 30);
    assert.equal(clampExpiryNoticeDays(Number.NaN), 7);
  });
});

describe('collectEndingCampaigns', () => {
  const today = '2026-10-17';

  it('includes a Promoção the Cliente can Resgatar that ends inside the window', () => {
    const notices = collectEndingCampaigns(
      [
        {
          campaignId: 'p1',
          campaignName: 'Almoço',
          type: 'promo',
          canRedeem: true,
          endsOn: '2026-10-19',
        },
      ],
      today,
    );
    assert.equal(notices.length, 1);
    assert.equal(notices[0]?.daysLeft, 2);
  });

  it('skips a Promoção she cannot Resgatar, one already over, and other kinds', () => {
    const notices = collectEndingCampaigns(
      [
        {
          campaignId: 'p1',
          campaignName: 'Fora',
          type: 'promo',
          canRedeem: false,
          endsOn: '2026-10-18',
        },
        {
          campaignId: 'p2',
          campaignName: 'Passou',
          type: 'promo',
          canRedeem: true,
          endsOn: '2026-10-16',
        },
        {
          campaignId: 'p3',
          campaignName: 'Longe',
          type: 'promo',
          canRedeem: true,
          endsOn: '2026-10-25',
        },
        {
          campaignId: 's1',
          campaignName: 'Carimbos',
          type: 'stamps',
          canRedeem: true,
          endsOn: '2026-10-18',
        },
      ],
      today,
    );
    assert.equal(notices.length, 0);
  });

  it('includes a Promoção she can still reach before the last day', () => {
    const notices = collectEndingCampaigns(
      [
        {
          campaignId: 'p1',
          campaignName: 'Sexta',
          type: 'promo',
          canRedeem: false,
          lockedReason: 'wrong_weekday',
          unlocksAt: '2026-10-18',
          endsOn: '2026-10-19',
          audienceEligible: true,
        },
        {
          campaignId: 'p2',
          campaignName: 'Fora da audiência',
          type: 'promo',
          canRedeem: false,
          lockedReason: 'audience',
          endsOn: '2026-10-18',
          audienceEligible: false,
        },
        {
          campaignId: 'p3',
          campaignName: 'Cota depois do fim',
          type: 'promo',
          canRedeem: false,
          lockedReason: 'quota_exhausted',
          unlocksAt: '2026-10-20',
          endsOn: '2026-10-19',
        },
      ],
      today,
    );
    assert.equal(notices.length, 1);
    assert.equal(notices[0]?.campaignId, 'p1');
    assert.equal(notices[0]?.ready, false);
  });
});

describe('notice copy', () => {
  it('names each expiring wallet', () => {
    const detail = expiryDetail(
      collectExpiryNotices([
        lot({
          unitKind: 'stamps',
          quantity: 1,
          daysLeft: 1,
          expiresAt: '2026-10-18',
          destinationLabel: 'Café',
        }),
        lot({
          unitKind: 'stamps',
          quantity: 3,
          daysLeft: 2,
          expiresAt: '2026-10-19',
          destinationLabel: 'Carimbos',
        }),
        lot({ unitKind: 'points', quantity: 40, daysLeft: 0, expiresAt: '2026-10-17' }),
        lot({
          unitKind: 'cashback_cents',
          quantity: 1250,
          daysLeft: 7,
          expiresAt: '2026-10-24',
        }),
      ]),
    );
    assert.equal(
      detail,
      '40 pontos vencem hoje. 1 carimbo de Café vence amanhã. 3 carimbos vencem em 2 dias. R$ 12,50 de cashback vence em 7 dias.',
    );
  });

  it('says the Promoção is ending and Resgatar is open', () => {
    assert.equal(
      campaignEndingDetail([
        {
          campaignId: 'p1',
          campaignName: 'Almoço',
          endsOn: '2026-10-17',
          daysLeft: 0,
          ready: true,
        },
      ]),
      'Almoço encerra hoje. O resgate está disponível.',
    );
    assert.equal(
      campaignEndingDetail([
        {
          campaignId: 'p1',
          campaignName: 'Almoço',
          endsOn: '2026-10-19',
          daysLeft: 2,
          ready: true,
        },
        {
          campaignId: 'p2',
          campaignName: 'Café',
          endsOn: '2026-10-18',
          daysLeft: 1,
          ready: true,
        },
      ]),
      'Café encerra amanhã. Almoço encerra em 2 dias. O resgate está disponível.',
    );
    assert.equal(
      campaignEndingDetail([
        {
          campaignId: 'p1',
          campaignName: 'Almoço',
          endsOn: '2026-10-18',
          daysLeft: 1,
          ready: false,
        },
      ]),
      'Almoço encerra amanhã. Ainda dá tempo de resgatar.',
    );
  });

  it('uses the Estabelecimento as the push title', () => {
    const copy = accountNoticeCopy('Café Bloom', '3 carimbos vencem em 2 dias.');
    assert.equal(copy.title, 'Café Bloom');
    assert.equal(copy.body, '3 carimbos vencem em 2 dias.');
  });
});

describe('msUntilNextReminder', () => {
  it('fires at 10:00 America/Sao_Paulo', () => {
    const morning = new Date('2026-10-17T12:00:00.000Z');
    assert.equal(msUntilNextReminder(morning), 60 * 60 * 1000);
    const afternoon = new Date('2026-10-17T14:00:00.000Z');
    assert.equal(msUntilNextReminder(afternoon), 23 * 60 * 60 * 1000);
  });
});

describe('channelSettled', () => {
  it('keeps a sent channel and a channel with nowhere to deliver', () => {
    assert.equal(channelSettled('push', { sent: true }), 'sent');
    assert.equal(
      channelSettled('push', { sent: false, skipped: 'notifications_disabled' }),
      'skipped',
    );
    assert.equal(
      channelSettled('whatsapp', { sent: false, skipped: 'not_connected' }),
      'skipped',
    );
  });

  it('retries while the WhatsApp template is still with Meta', () => {
    assert.equal(
      channelSettled('whatsapp', { sent: false, skipped: 'template_pending' }),
      'retry',
    );
    assert.equal(
      channelSettled('push', { sent: false, skipped: 'all_failed', error: 'unavailable' }),
      'retry',
    );
  });
});
