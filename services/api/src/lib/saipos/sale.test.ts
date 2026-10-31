import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applySaiposSale, type SaiposPorts, type SaiposSave } from './apply.js';
import { saleAmountCents, unwrapSaiposSales } from './sale.js';

const connectedAt = new Date('2026-10-28T12:00:00-03:00');

function sale(patch: Record<string, unknown> = {}) {
  return {
    id_sale: 184,
    id_sale_type: 1,
    created_at: '2026-10-28T15:00:00',
    canceled: 'N',
    totals: { total_amount: 96.5 },
    delivery: { delivery_fee: 6.5 },
    customer: { name: 'Ana Lima', phone: ['11999990000'] },
    payments: [{ payment_amount: 96.5 }],
    ...patch,
  };
}

function memory(existing?: SaiposSave) {
  const saved: SaiposSave[] = [];
  const opens: string[] = [];
  const earns: number[] = [];
  const reversals: string[] = [];
  let reverseOutcome: 'reversed' | 'blocked' | 'already' = 'reversed';
  const ports: SaiposPorts = {
    findImport: async () =>
      existing
        ? {
            status: existing.status,
            saleId: existing.saleId,
            membershipId: existing.membershipId,
            updatedAt: connectedAt,
          }
        : null,
    save: async (row) => {
      saved.push(row);
    },
    openClube: async (input) => {
      opens.push(input.phone);
      return { membershipId: 'mem-1' };
    },
    recordEarn: async (input) => {
      earns.push(input.amountCents);
      return { ok: true, saleId: 'frego-sale' };
    },
    reverse: async (input) => {
      reversals.push(input.saleId);
      return reverseOutcome;
    },
  };
  return {
    ports,
    saved,
    opens,
    earns,
    reversals,
    block() {
      reverseOutcome = 'blocked';
    },
  };
}

describe('Saipos sale amount', () => {
  it('drops the courier fee and keeps the rest of the bill', () => {
    assert.equal(saleAmountCents(sale()), 9000);
    assert.equal(
      saleAmountCents({
        totals: { total_amount: 12 },
        delivery: null,
      }),
      1200,
    );
  });
});

describe('apply a closed Saipos sale', () => {
  it('skips an unidentified customer and a masked phone', async () => {
    const unidentified = memory();
    const first = await applySaiposSale(
      {
        sale: sale({
          customer: { name: 'Consumidor não identificado', phone: [''] },
        }),
        connectedAt,
      },
      unidentified.ports,
    );
    assert.equal(first.action, 'skip');
    assert.equal(first.reason, 'unidentified');
    assert.equal(unidentified.saved[0]?.status, 'skipped');
    assert.equal(unidentified.opens.length, 0);

    const masked = memory();
    const second = await applySaiposSale(
      {
        sale: sale({ customer: { name: 'Ana', phone: ['119****0000'] } }),
        connectedAt,
      },
      masked.ports,
    );
    assert.equal(second.reason, 'invalid_phone');
    assert.equal(masked.earns.length, 0);
  });

  it('opens a Clube for a new phone and credits the amount without the delivery fee', async () => {
    const box = memory();
    const result = await applySaiposSale({ sale: sale(), connectedAt }, box.ports);
    assert.equal(result.action, 'credit');
    assert.deepEqual(box.opens, ['+5511999990000']);
    assert.deepEqual(box.earns, [9000]);
    assert.equal(box.saved[0]?.status, 'credited');
    assert.equal(box.saved[0]?.saleId, 'frego-sale');
  });

  it('does not credit the same sale twice', async () => {
    const box = memory({
      saiposSaleId: '184',
      status: 'credited',
      skipReason: null,
      saleId: 'frego-sale',
      membershipId: 'mem-1',
      amountCents: 9000,
    });
    const result = await applySaiposSale({ sale: sale(), connectedAt }, box.ports);
    assert.equal(result.action, 'noop');
    assert.equal(box.earns.length, 0);
    assert.equal(box.opens.length, 0);
  });

  it('reverses a canceled sale, and leaves a spent balance in place', async () => {
    const credited = {
      saiposSaleId: '184',
      status: 'credited' as const,
      skipReason: null,
      saleId: 'frego-sale',
      membershipId: 'mem-1',
      amountCents: 9000,
    };
    const undone = memory(credited);
    const reversed = await applySaiposSale(
      { sale: sale({ canceled: 'Y' }), connectedAt },
      undone.ports,
    );
    assert.equal(reversed.action, 'reverse');
    assert.deepEqual(undone.reversals, ['frego-sale']);
    assert.equal(undone.saved[0]?.status, 'reversed');

    const spent = memory(credited);
    spent.block();
    const blocked = await applySaiposSale(
      { sale: sale({ canceled: 'Y' }), connectedAt },
      spent.ports,
    );
    assert.equal(blocked.action, 'reverse_blocked');
    assert.equal(spent.saved[0]?.status, 'reverse_blocked');
  });

  it('ignores a sale from before the token was saved', async () => {
    const box = memory();
    const result = await applySaiposSale(
      { sale: sale({ created_at: '2026-10-28T10:00:00' }), connectedAt },
      box.ports,
    );
    assert.equal(result.action, 'ignore');
    assert.equal(box.saved.length, 0);
    assert.equal(box.opens.length, 0);
  });
});

describe('unwrapSaiposSales', () => {
  it('reads the array Saipos returns, including the string wrapper in the docs', () => {
    const row = sale();
    assert.equal(unwrapSaiposSales([row]).length, 1);
    assert.equal(unwrapSaiposSales({ Result: { value: JSON.stringify([row]) } }).length, 1);
  });
});
