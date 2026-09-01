import type { WalletSnapshot } from '../wallet.js';

export type EarnNotifyLines = {
  businessName: string;
  earnLine: string;
  balanceLine: string;
  hintLine: string;
};

/**
 * Build the 4 template body parameters for Meta WhatsApp.
 * Keep strings short and plain (no newlines).
 */
export function buildEarnWhatsAppLines(input: {
  businessName: string;
  unitKind: 'stamps' | 'points' | 'cashback';
  quantity: number;
  amountCents?: number | null;
  cashbackCents?: number | null;
  wallet: WalletSnapshot;
}): EarnNotifyLines {
  const businessName = (input.businessName || 'Frego').slice(0, 60);

  const money = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

  let earnLine: string;
  if (input.unitKind === 'points') {
    const reais =
      input.amountCents != null ? money(input.amountCents) : null;
    earnLine = reais
      ? `+${input.quantity} pts (${reais})`
      : `+${input.quantity} pts`;
  } else if (input.unitKind === 'cashback') {
    earnLine =
      input.cashbackCents && input.cashbackCents > 0
        ? `+${money(input.cashbackCents)} cashback`
        : 'compra registrada';
  } else {
    earnLine =
      input.quantity === 1 ? '+1 carimbo' : `+${input.quantity} carimbos`;
  }
  if (
    input.unitKind !== 'cashback' &&
    input.cashbackCents &&
    input.cashbackCents > 0
  ) {
    earnLine += ` + ${money(input.cashbackCents)} cashback`;
  }

  const cashbackBal = input.wallet.pools.cashbackCents ?? 0;
  let balanceLine = `${input.wallet.pools.stamps} carimbos · ${input.wallet.pools.points} pts`;
  if (cashbackBal > 0) {
    balanceLine += ` · ${money(cashbackBal)} cashback`;
  }

  const redeemable = input.wallet.campaigns.filter((c) => c.canRedeem);
  let hintLine = '—';
  if (redeemable.length === 1) {
    const name = redeemable[0]!.campaignName || 'campanha';
    hintLine = `1 prêmio disponível: ${name}`;
  } else if (redeemable.length > 1) {
    hintLine = `${redeemable.length} prêmios disponíveis no app Frego`;
  } else {
    const relevant = input.wallet.campaigns.filter(
      (c) =>
        !c.canRedeem &&
        (c.type === 'stamps' || c.type === 'spend') &&
        c.unitsNeeded > 0,
    );
    if (relevant.length > 0) {
      const poolFor = (type: string) =>
        type === 'spend' ? input.wallet.pools.points : input.wallet.pools.stamps;
      let best = relevant[0]!;
      let bestRemain = best.unitsNeeded;
      for (const c of relevant) {
        const have = poolFor(c.type) % c.unitsNeeded;
        const remain = c.unitsNeeded - have;
        if (remain < bestRemain) {
          best = c;
          bestRemain = remain;
        }
      }
      const have = poolFor(best.type) % best.unitsNeeded;
      const remain = best.unitsNeeded - have;
      if (remain > 0 && remain < best.unitsNeeded) {
        hintLine = `${best.campaignName}: faltam ${remain}`;
      }
    }
  }

  return {
    businessName,
    earnLine: earnLine.slice(0, 120),
    balanceLine: balanceLine.slice(0, 120),
    hintLine: hintLine.slice(0, 120),
  };
}
