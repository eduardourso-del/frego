import type { WalletSnapshot } from '../wallet.js';

export type EarnNotifyLines = {
  businessName: string;
  earnLine: string;
  balanceLine: string;
  /** Balance detail for the utility template. No prize or app call to action. */
  accountLine: string;
  /** Push copy. May name a prize that is already available. */
  hintLine: string;
};

export type EarnBurstPart = {
  unitKind: 'stamps' | 'points' | 'cashback';
  quantity: number;
  amountCents?: number | null;
  cashbackCents?: number | null;
  stampLabel?: string | null;
};

export type EarnNotifyInput = {
  businessId: string;
  businessName: string;
  customerId: string;
  toE164: string;
  unitKind: 'stamps' | 'points' | 'cashback';
  quantity: number;
  amountCents?: number | null;
  cashbackCents?: number | null;
  /** Counter sale this earn belongs to. Used to drop the held message if that sale is reversed. */
  saleId?: string | null;
  transactionId?: string | null;
  wallet: WalletSnapshot;
  /** Set on a carimbo earn so the copy names a Cartela or the shared balance. */
  stampEarn?: { cartela: boolean; label: string; balance: number } | null;
  /** Set when this earn opened or refreshed a Convite. */
  pesquisa?: { sentence: string; url: string; conviteId: string } | null;
  /**
   * Earn line for a burst that may mix carimbos, pontos, and cashback.
   * Built when the hold is sent, so a reverse still sees the parts that remain.
   */
  summaryLine?: string | null;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
};

function money(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** One earn line for every kind credited in the quiet window. */
export function earnBurstLine(parts: EarnBurstPart[]): string {
  const stampGroups = new Map<string, number>();
  let pointsQty = 0;
  let pointsCents = 0;
  let pointsHaveAmount = false;
  let cashbackCents = 0;

  for (const part of parts) {
    if (part.unitKind === 'stamps') {
      const label = part.stampLabel ?? '';
      stampGroups.set(label, (stampGroups.get(label) ?? 0) + part.quantity);
    } else if (part.unitKind === 'points') {
      pointsQty += part.quantity;
      if (part.amountCents != null) {
        pointsHaveAmount = true;
        pointsCents += part.amountCents;
      }
    }
    if (part.unitKind === 'cashback') {
      cashbackCents += part.cashbackCents ?? 0;
    } else if (part.cashbackCents != null && part.cashbackCents > 0) {
      cashbackCents += part.cashbackCents;
    }
  }

  const segments: string[] = [];
  for (const [label, qty] of stampGroups) {
    if (qty <= 0) continue;
    const qtyText = qty === 1 ? '1 carimbo' : `${qty} carimbos`;
    segments.push(label ? `${qtyText} · ${label}` : qtyText);
  }
  if (pointsQty > 0) {
    segments.push(
      pointsHaveAmount
        ? `${pointsQty} pts (${money(pointsCents)})`
        : `${pointsQty} pts`,
    );
  }
  if (cashbackCents > 0) {
    segments.push(`${money(cashbackCents)} cashback`);
  }
  const line = segments.length > 0 ? `+${segments.join(' + ')}` : 'compra registrada';
  return line.slice(0, 120);
}

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
  stampEarn?: { cartela: boolean; label: string; balance: number } | null;
  summaryLine?: string | null;
}): EarnNotifyLines {
  const businessName = (input.businessName || 'Frego').slice(0, 60);

  let earnLine: string;
  if (input.summaryLine) {
    earnLine = input.summaryLine;
  } else if (input.unitKind === 'points') {
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
    const qty =
      input.quantity === 1 ? '+1 carimbo' : `+${input.quantity} carimbos`;
    earnLine =
      input.stampEarn?.cartela && input.stampEarn.label
        ? `${qty} · ${input.stampEarn.label}`
        : qty;
  }
  if (
    !input.summaryLine &&
    input.unitKind !== 'cashback' &&
    input.cashbackCents &&
    input.cashbackCents > 0
  ) {
    earnLine += ` + ${money(input.cashbackCents)} cashback`;
  }

  const cashbackBal = input.wallet.pools.cashbackCents ?? 0;
  const stampBalance =
    input.unitKind === 'stamps' && input.stampEarn
      ? input.stampEarn.balance
      : input.wallet.pools.stamps;
  let balanceLine = `${stampBalance} carimbos · ${input.wallet.pools.points} pts`;
  if (cashbackBal > 0) {
    balanceLine += ` · ${money(cashbackBal)} cashback`;
  }

  const redeemable = input.wallet.campaigns.filter((c) => c.canRedeem);
  let hintLine = '—';
  let accountLine = 'Nenhum outro lançamento nesta compra.';
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
      const poolFor = (c: (typeof relevant)[number]) =>
        c.balance ??
        (c.type === 'spend'
          ? input.wallet.pools.points
          : input.wallet.pools.stamps);
      let best = relevant[0]!;
      let bestRemain = best.unitsNeeded;
      for (const c of relevant) {
        const have = poolFor(c) % c.unitsNeeded;
        const remain = c.unitsNeeded - have;
        if (remain < bestRemain) {
          best = c;
          bestRemain = remain;
        }
      }
      const have = poolFor(best) % best.unitsNeeded;
      const remain = best.unitsNeeded - have;
      if (remain > 0 && remain < best.unitsNeeded) {
        hintLine = `${best.campaignName}: faltam ${remain}`;
        accountLine = `${best.campaignName}: ${have} de ${best.unitsNeeded}`;
      }
    }
  }

  return {
    businessName,
    earnLine: earnLine.slice(0, 120),
    balanceLine: balanceLine.slice(0, 120),
    accountLine: accountLine.slice(0, 120),
    hintLine: hintLine.slice(0, 120),
  };
}

/** Push title/body from the same lines WhatsApp fills into the earn template. */
export function earnPushCopy(lines: EarnNotifyLines): {
  title: string;
  body: string;
} {
  const parts = [
    `Você acabou de ganhar ${lines.earnLine}.`,
    `Seu saldo agora é: ${lines.balanceLine}.`,
  ];
  if (lines.hintLine && lines.hintLine !== '—') {
    parts.push(lines.hintLine);
  }
  return {
    title: lines.businessName,
    body: parts.join(' ').slice(0, 180),
  };
}
