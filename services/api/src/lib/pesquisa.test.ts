import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  answersMatchSnapshot,
  audienceAllowsConvite,
  bonusSentence,
  buildSnapshot,
  destinationActive,
  inviteLine,
  parsePesquisaWrite,
  resolveConviteBonus,
  purchaseLine,
  salePaysBonus,
  shouldOpenConvite,
  submitGate,
  type DestinationCampaign,
} from './pesquisa.js';

const campaigns: DestinationCampaign[] = [
  { id: 'cafe', name: 'Café', type: 'stamps', status: 'active', cartela: false },
  { id: 'almoco', name: 'Almoço', type: 'stamps', status: 'active', cartela: true },
  { id: 'gasto', name: 'Gasto', type: 'spend', status: 'active', cartela: false },
  { id: 'volta', name: 'Volta', type: 'cashback', status: 'active', cartela: false },
];

describe('bonusSentence', () => {
  it('names a Cartela when the carimbos have one', () => {
    assert.equal(
      bonusSentence({ kind: 'stamps', quantity: 1, cartelaLabel: 'Almoço' }),
      'Responda e ganhe 1 carimbo na cartela Almoço.',
    );
  });

  it('uses the shared pile without a Cartela name', () => {
    assert.equal(
      bonusSentence({ kind: 'stamps', quantity: 2 }),
      'Responda e ganhe 2 carimbos.',
    );
  });
});

describe('parsePesquisaWrite', () => {
  it('refuses an active Pesquisa with no Polegar', () => {
    const result = parsePesquisaWrite(
      {
        name: 'Visita',
        notePrompt: null,
        questions: [],
        bonusEnabled: false,
        bonusKind: null,
        bonusMode: 'fixed',
        bonusQuantity: null,
        bonusCampaignId: null,
        audienceSegmentId: null,
        status: 'active',
      },
      campaigns,
    );
    assert.equal(result.ok, false);
  });

  it('refuses a Bônus whose Cartela is not active', () => {
    const result = parsePesquisaWrite(
      {
        name: 'Visita',
        notePrompt: 'O que melhorar?',
        questions: [{ prompt: 'O café estava bom?' }],
        bonusEnabled: true,
        bonusKind: 'stamps',
        bonusMode: 'fixed',
        bonusQuantity: 1,
        bonusCampaignId: 'missing',
        audienceSegmentId: null,
        status: 'active',
      },
      campaigns,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'BONUS_DESTINATION');
  });

  it('builds a snapshot sentence for an active cashback Bônus', () => {
    const result = parsePesquisaWrite(
      {
        name: 'Visita',
        notePrompt: '',
        questions: [{ prompt: 'O café estava bom?' }],
        bonusEnabled: true,
        bonusKind: 'cashback',
        bonusMode: 'fixed',
        bonusQuantity: 150,
        bonusCampaignId: null,
        audienceSegmentId: null,
        status: 'active',
      },
      campaigns,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const snapshot = buildSnapshot({
      notePrompt: result.value.notePrompt,
      questions: result.value.questions,
      bonus: result.value.bonus,
    });
    assert.equal(snapshot.notePrompt, null);
    assert.equal(snapshot.inviteLine, inviteLine(snapshot.bonus));
    assert.match(snapshot.inviteLine, /1,50/);
  });

  it('stores a double without a fixed amount', () => {
    const result = parsePesquisaWrite(
      {
        name: 'Visita',
        notePrompt: null,
        questions: [{ prompt: 'O café estava bom?' }],
        bonusEnabled: true,
        bonusKind: 'cashback',
        bonusMode: 'double',
        bonusQuantity: null,
        bonusCampaignId: null,
        audienceSegmentId: null,
        status: 'active',
      },
      campaigns,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.bonusQuantity, null);
    assert.equal(result.value.bonus, null);
  });

  it('refuses to double carimbos', () => {
    const result = parsePesquisaWrite(
      {
        name: 'Visita',
        notePrompt: null,
        questions: [{ prompt: 'O café estava bom?' }],
        bonusEnabled: true,
        bonusKind: 'stamps',
        bonusMode: 'double',
        bonusQuantity: null,
        bonusCampaignId: null,
        audienceSegmentId: null,
        status: 'active',
      },
      campaigns,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'BONUS_MODE');
  });
});

describe('resolveConviteBonus', () => {
  it('copies the cashback from this earn', () => {
    const bonus = resolveConviteBonus({
      enabled: true,
      kind: 'cashback',
      mode: 'double',
      quantity: null,
      campaignId: null,
      cartelaLabel: null,
      earnedStamps: 0,
      earnedPoints: 0,
      earnedCashbackCents: 500,
    });
    assert.equal(bonus?.quantity, 500);
    assert.match(bonus?.sentence ?? '', /5,00/);
    assert.match(bonus?.sentence ?? '', /dobre o cashback/);
  });

  it('copies the pontos from this earn', () => {
    const bonus = resolveConviteBonus({
      enabled: true,
      kind: 'points',
      mode: 'double',
      quantity: null,
      campaignId: null,
      cartelaLabel: null,
      earnedStamps: 0,
      earnedPoints: 20,
      earnedCashbackCents: 0,
    });
    assert.equal(bonus?.quantity, 20);
    assert.match(bonus?.sentence ?? '', /mais 20 pontos/);
  });

  it('drops the Bônus when this earn did not credit that wallet', () => {
    const bonus = resolveConviteBonus({
      enabled: true,
      kind: 'cashback',
      mode: 'double',
      quantity: null,
      campaignId: null,
      cartelaLabel: null,
      earnedStamps: 0,
      earnedPoints: 12,
      earnedCashbackCents: 0,
    });
    assert.equal(bonus, null);
  });

  it('refuses a fixed cashback Bônus on a carimbo earn', () => {
    const bonus = resolveConviteBonus({
      enabled: true,
      kind: 'cashback',
      mode: 'fixed',
      quantity: 500,
      campaignId: null,
      cartelaLabel: null,
      earnedStamps: 1,
      earnedPoints: 0,
      earnedCashbackCents: 0,
    });
    assert.equal(bonus, null);
  });

  it('keeps a fixed Bônus when the earn credited that wallet', () => {
    const cashback = resolveConviteBonus({
      enabled: true,
      kind: 'cashback',
      mode: 'fixed',
      quantity: 500,
      campaignId: null,
      cartelaLabel: null,
      earnedStamps: 0,
      earnedPoints: 0,
      earnedCashbackCents: 300,
    });
    assert.equal(cashback?.quantity, 500);
    const stamps = resolveConviteBonus({
      enabled: true,
      kind: 'stamps',
      mode: 'fixed',
      quantity: 1,
      campaignId: 'almoco',
      cartelaLabel: 'Almoço',
      earnedStamps: 2,
      earnedPoints: 0,
      earnedCashbackCents: 0,
    });
    assert.equal(stamps?.quantity, 1);
  });
});

describe('purchaseLine', () => {
  const now = new Date('2026-10-09T18:00:00.000Z');

  it('names today, the amount, and the cashback earned', () => {
    const line = purchaseLine({
      at: new Date('2026-10-09T17:30:00.000Z'),
      amountCents: 8000,
      earnedStamps: 0,
      earnedPoints: 0,
      earnedCashbackCents: 600,
      now,
    });
    assert.match(line ?? '', /^Compra de hoje:/);
    assert.match(line ?? '', /80,00/);
    assert.match(line ?? '', /Você ganhou .*6,00 de cashback\.$/);
  });

  it('names carimbos when that is what the purchase credited', () => {
    const line = purchaseLine({
      at: new Date('2026-10-08T17:30:00.000Z'),
      amountCents: null,
      earnedStamps: 2,
      earnedPoints: 0,
      earnedCashbackCents: 0,
      now,
    });
    assert.match(line ?? '', /^Você ganhou 2 carimbos ontem\.$/);
  });

  it('stays empty when the purchase credited nothing', () => {
    assert.equal(
      purchaseLine({
        at: now,
        amountCents: null,
        earnedStamps: 0,
        earnedPoints: 0,
        earnedCashbackCents: 0,
        now,
      }),
      null,
    );
  });
});

describe('shouldOpenConvite', () => {
  it('opens with no Bônus on any earn', () => {
    assert.equal(shouldOpenConvite({ bonusEnabled: false, bonus: null }), true);
  });

  it('stays closed when the Bônus cannot be paid', () => {
    assert.equal(shouldOpenConvite({ bonusEnabled: true, bonus: null }), false);
  });
});

describe('salePaysBonus', () => {
  it('accepts cashback only when the purchase credited cashback', () => {
    const carimbo = [{ type: 'stamp', unitKind: 'stamps', quantity: 1 }];
    const cashback = [{ type: 'stamp', unitKind: 'cashback_cents', quantity: 400 }];
    assert.equal(salePaysBonus('cashback', carimbo), false);
    assert.equal(salePaysBonus('cashback', cashback), true);
    assert.equal(salePaysBonus('stamps', carimbo), true);
    assert.equal(salePaysBonus('points', carimbo), false);
  });
});

describe('audienceAllowsConvite', () => {
  it('lets every Cliente through when no Audiência is set', () => {
    assert.equal(
      audienceAllowsConvite({ audienceSegmentId: null, matches: false }),
      true,
    );
  });

  it('opens a Convite only when she matches the Audiência', () => {
    assert.equal(
      audienceAllowsConvite({ audienceSegmentId: 'vip', matches: true }),
      true,
    );
    assert.equal(
      audienceAllowsConvite({ audienceSegmentId: 'vip', matches: false }),
      false,
    );
  });
});

describe('destinationActive', () => {
  it('accepts the shared pile only when a non-Cartela stamp Campanha is active', () => {
    assert.equal(
      destinationActive({ kind: 'stamps', campaignId: null }, campaigns),
      true,
    );
    assert.equal(
      destinationActive({ kind: 'stamps', campaignId: null }, [
        { id: 'almoco', name: 'Almoço', type: 'stamps', status: 'active', cartela: true },
      ]),
      false,
    );
  });
});

describe('submitGate', () => {
  const bonus = {
    kind: 'stamps' as const,
    quantity: 1,
    campaignId: 'almoco',
    cartelaLabel: 'Almoço',
    sentence: 'Responda e ganhe 1 carimbo na cartela Almoço.',
  };

  it('lets a replaced Convite submit its own snapshot', () => {
    assert.equal(
      submitGate({
        status: 'replaced',
        hasResposta: false,
        bonus,
        destinationActive: true,
        earnPaysBonus: true,
      }),
      'ok',
    );
  });

  it('does not spend the Resposta when the credit cannot land', () => {
    assert.equal(
      submitGate({
        status: 'open',
        hasResposta: false,
        bonus,
        destinationActive: false,
        earnPaysBonus: true,
      }),
      'bonus_unavailable',
    );
  });

  it('refuses an answer when the purchase credited another wallet', () => {
    assert.equal(
      submitGate({
        status: 'open',
        hasResposta: false,
        bonus,
        destinationActive: true,
        earnPaysBonus: false,
      }),
      'bonus_wallet',
    );
    assert.equal(
      submitGate({
        status: 'open',
        hasResposta: false,
        bonus: null,
        destinationActive: true,
        earnPaysBonus: false,
      }),
      'ok',
    );
  });

  it('closes a Convite that was undone or switched off', () => {
    assert.equal(
      submitGate({
        status: 'closed',
        hasResposta: false,
        bonus: null,
        destinationActive: true,
        earnPaysBonus: true,
      }),
      'closed',
    );
  });

  it('refuses a second Resposta', () => {
    assert.equal(
      submitGate({
        status: 'open',
        hasResposta: true,
        bonus: null,
        destinationActive: true,
        earnPaysBonus: true,
      }),
      'already',
    );
  });
});

describe('answersMatchSnapshot', () => {
  const snapshot = buildSnapshot({
    notePrompt: 'Nota',
    questions: [{ prompt: 'A' }, { prompt: 'B' }],
    bonus: null,
  });

  it('requires every Polegar', () => {
    assert.equal(
      answersMatchSnapshot(snapshot, [{ position: 0, value: 'up' }]),
      false,
    );
    assert.equal(
      answersMatchSnapshot(snapshot, [
        { position: 0, value: 'up' },
        { position: 1, value: 'down' },
      ]),
      true,
    );
  });
});
