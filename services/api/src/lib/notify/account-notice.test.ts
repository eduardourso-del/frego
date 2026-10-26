import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { WalletLot } from '../wallet.js';
import {
  accountNoticeCopy,
  campaignEndingDetail,
  channelSettled,
  collectEndingCampaigns,
  collectExpiryNotices,
  expiryDetail,
  msUntilNextReminder,
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
