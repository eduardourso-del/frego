/** Pesquisa, Convite, and Bônus rules. No I/O. */

export type BonusKind = 'stamps' | 'points' | 'cashback';
export type BonusMode = 'fixed' | 'double';
export type Polegar = 'up' | 'down';
export type ConviteStatus = 'open' | 'replaced' | 'closed' | 'answered';

export type DestinationCampaign = {
  id: string;
  name: string;
  type: string;
  status: string;
  cartela: boolean;
};

export type BonusSnapshot = {
  kind: BonusKind;
  quantity: number;
  campaignId: string | null;
  cartelaLabel: string | null;
  sentence: string;
};

export type ConviteSnapshot = {
  notePrompt: string | null;
  questions: { position: number; prompt: string }[];
  bonus: BonusSnapshot | null;
  inviteLine: string;
};

const NO_BONUS_LINE = 'A loja deixou uma pesquisa.';

export function moneyCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function saoPauloDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function purchaseWhen(at: Date, now: Date): 'hoje' | 'ontem' | string {
  const day = saoPauloDay(at);
  if (day === saoPauloDay(now)) return 'hoje';
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (day === saoPauloDay(yesterday)) return 'ontem';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'short',
  })
    .format(at)
    .replace('.', '');
}

function joinEarned(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
}

/** The purchase this Convite is tied to: when, what she paid, what she earned. */
export function purchaseLine(input: {
  at: Date;
  amountCents: number | null;
  earnedStamps: number;
  earnedPoints: number;
  earnedCashbackCents: number;
  now?: Date;
}): string | null {
  const earned: string[] = [];
  if (input.earnedCashbackCents >= 1) {
    earned.push(`${moneyCents(input.earnedCashbackCents)} de cashback`);
  }
  if (input.earnedPoints >= 1) {
    const unit = input.earnedPoints === 1 ? 'ponto' : 'pontos';
    earned.push(`${input.earnedPoints} ${unit}`);
  }
  if (input.earnedStamps >= 1) {
    const unit = input.earnedStamps === 1 ? 'carimbo' : 'carimbos';
    earned.push(`${input.earnedStamps} ${unit}`);
  }
  const amount =
    input.amountCents != null && input.amountCents > 0
      ? moneyCents(input.amountCents)
      : null;
  if (!amount && earned.length === 0) return null;

  const when = purchaseWhen(input.at, input.now ?? new Date());
  const gained = earned.length > 0 ? `Você ganhou ${joinEarned(earned)}` : null;
  if (amount && gained) return `Compra de ${when}: ${amount}. ${gained}.`;
  if (amount) return `Compra de ${when}: ${amount}.`;
  const moment = when === 'hoje' || when === 'ontem' ? when : `em ${when}`;
  return `${gained} ${moment}.`;
}

export function bonusSentence(input: {
  kind: BonusKind;
  quantity: number;
  cartelaLabel?: string | null;
  doubled?: boolean;
}): string {
  if (input.doubled && input.kind === 'cashback') {
    return `Responda e dobre o cashback desta compra: mais ${moneyCents(input.quantity)}.`;
  }
  if (input.doubled && input.kind === 'points') {
    const unit = input.quantity === 1 ? 'ponto' : 'pontos';
    return `Responda e dobre os pontos desta compra: mais ${input.quantity} ${unit}.`;
  }
  if (input.kind === 'cashback') {
    return `Responda e ganhe ${moneyCents(input.quantity)}.`;
  }
  if (input.kind === 'points') {
    const unit = input.quantity === 1 ? 'ponto' : 'pontos';
    return `Responda e ganhe ${input.quantity} ${unit}.`;
  }
  const unit = input.quantity === 1 ? 'carimbo' : 'carimbos';
  if (input.cartelaLabel) {
    return `Responda e ganhe ${input.quantity} ${unit} na cartela ${input.cartelaLabel}.`;
  }
  return `Responda e ganhe ${input.quantity} ${unit}.`;
}

export function inviteLine(bonus: BonusSnapshot | null): string {
  return bonus?.sentence ?? NO_BONUS_LINE;
}

export function buildSnapshot(input: {
  notePrompt: string | null;
  questions: { prompt: string }[];
  bonus: BonusSnapshot | null;
}): ConviteSnapshot {
  const questions = input.questions.map((q, position) => ({
    position,
    prompt: q.prompt.trim(),
  }));
  return {
    notePrompt: input.notePrompt?.trim() || null,
    questions,
    bonus: input.bonus,
    inviteLine: inviteLine(input.bonus),
  };
}

export function sharedStampsActive(campaigns: DestinationCampaign[]): boolean {
  return campaigns.some(
    (c) =>
      c.status === 'active' &&
      (c.type === 'stamps' || c.type === 'visits') &&
      !c.cartela,
  );
}

export function destinationActive(
  bonus: {
    kind: BonusKind;
    campaignId: string | null;
  },
  campaigns: DestinationCampaign[],
): boolean {
  if (bonus.kind === 'points') {
    return campaigns.some((c) => c.status === 'active' && c.type === 'spend');
  }
  if (bonus.kind === 'cashback') {
    return campaigns.some((c) => c.status === 'active' && c.type === 'cashback');
  }
  if (bonus.campaignId) {
    return campaigns.some(
      (c) =>
        c.id === bonus.campaignId &&
        c.status === 'active' &&
        c.type === 'stamps' &&
        c.cartela,
    );
  }
  return sharedStampsActive(campaigns);
}

export type PesquisaWrite = {
  name: string;
  notePrompt: string | null;
  questions: { prompt: string }[];
  bonusEnabled: boolean;
  bonusKind: BonusKind | null;
  bonusMode: BonusMode;
  bonusQuantity: number | null;
  bonusCampaignId: string | null;
  audienceSegmentId: string | null;
  status: 'draft' | 'active';
};

export function audienceAllowsConvite(input: {
  audienceSegmentId: string | null;
  matches: boolean;
}): boolean {
  if (!input.audienceSegmentId) return true;
  return input.matches;
}

export function earnCreditsBonusWallet(input: {
  kind: BonusKind;
  earnedStamps: number;
  earnedPoints: number;
  earnedCashbackCents: number;
}): boolean {
  if (input.kind === 'cashback') return input.earnedCashbackCents >= 1;
  if (input.kind === 'points') return input.earnedPoints >= 1;
  return input.earnedStamps >= 1;
}

export function creditsFromEarnRows(
  rows: { type: string; unitKind: string | null; quantity: number }[],
): { earnedStamps: number; earnedPoints: number; earnedCashbackCents: number } {
  let earnedStamps = 0;
  let earnedPoints = 0;
  let earnedCashbackCents = 0;
  for (const row of rows) {
    if (row.type !== 'stamp' || row.quantity < 1) continue;
    if (row.unitKind === 'stamps') earnedStamps += row.quantity;
    else if (row.unitKind === 'points') earnedPoints += row.quantity;
    else if (row.unitKind === 'cashback_cents') earnedCashbackCents += row.quantity;
  }
  return { earnedStamps, earnedPoints, earnedCashbackCents };
}

export function salePaysBonus(
  kind: BonusKind,
  rows: { type: string; unitKind: string | null; quantity: number }[],
): boolean {
  return earnCreditsBonusWallet({ kind, ...creditsFromEarnRows(rows) });
}

/** A Pesquisa with no Bônus opens on any qualifying earn. */
export function shouldOpenConvite(input: {
  bonusEnabled: boolean;
  bonus: BonusSnapshot | null;
}): boolean {
  if (!input.bonusEnabled) return true;
  return input.bonus != null;
}

export function resolveConviteBonus(input: {
  enabled: boolean;
  kind: BonusKind | null;
  mode: BonusMode;
  quantity: number | null;
  campaignId: string | null;
  cartelaLabel: string | null;
  earnedStamps: number;
  earnedPoints: number;
  earnedCashbackCents: number;
}): BonusSnapshot | null {
  if (!input.enabled || !input.kind) return null;
  if (
    !earnCreditsBonusWallet({
      kind: input.kind,
      earnedStamps: input.earnedStamps,
      earnedPoints: input.earnedPoints,
      earnedCashbackCents: input.earnedCashbackCents,
    })
  ) {
    return null;
  }
  if (input.mode === 'double') {
    if (input.kind === 'stamps') return null;
    const quantity =
      input.kind === 'cashback' ? input.earnedCashbackCents : input.earnedPoints;
    if (!Number.isInteger(quantity) || quantity < 1) return null;
    return {
      kind: input.kind,
      quantity,
      campaignId: null,
      cartelaLabel: null,
      sentence: bonusSentence({ kind: input.kind, quantity, doubled: true }).slice(0, 160),
    };
  }
  if (input.quantity == null || !Number.isInteger(input.quantity) || input.quantity < 1) {
    return null;
  }
  const campaignId = input.kind === 'stamps' ? input.campaignId : null;
  const cartelaLabel = input.kind === 'stamps' ? input.cartelaLabel : null;
  return {
    kind: input.kind,
    quantity: input.quantity,
    campaignId,
    cartelaLabel,
    sentence: bonusSentence({ kind: input.kind, quantity: input.quantity, cartelaLabel }).slice(
      0,
      160,
    ),
  };
}

export function parsePesquisaWrite(
  input: PesquisaWrite,
  campaigns: DestinationCampaign[],
): { ok: true; value: PesquisaWrite & { bonus: BonusSnapshot | null } } | { ok: false; error: string; message: string } {
  const name = input.name.trim();
  if (!name || name.length > 80) {
    return { ok: false, error: 'NAME_REQUIRED', message: 'Dê um nome à Pesquisa.' };
  }
  const questions = input.questions
    .map((q) => ({ prompt: q.prompt.trim() }))
    .filter((q) => q.prompt.length > 0);
  if (input.status === 'active' && questions.length < 1) {
    return {
      ok: false,
      error: 'QUESTION_REQUIRED',
      message: 'Ative a Pesquisa com pelo menos uma pergunta.',
    };
  }
  if (questions.length > 5) {
    return {
      ok: false,
      error: 'TOO_MANY_QUESTIONS',
      message: 'A Pesquisa tem no máximo 5 perguntas.',
    };
  }
  for (const q of questions) {
    if (q.prompt.length > 160) {
      return {
        ok: false,
        error: 'QUESTION_TOO_LONG',
        message: 'Cada pergunta tem no máximo 160 caracteres.',
      };
    }
  }
  const notePrompt = input.notePrompt?.trim() || null;
  if (notePrompt && notePrompt.length > 160) {
    return {
      ok: false,
      error: 'NOTE_TOO_LONG',
      message: 'O pedido da nota tem no máximo 160 caracteres.',
    };
  }

  if (!input.bonusEnabled) {
    return {
      ok: true,
      value: {
        name,
        notePrompt,
        questions,
        bonusEnabled: false,
        bonusKind: null,
        bonusMode: 'fixed',
        bonusQuantity: null,
        bonusCampaignId: null,
        audienceSegmentId: input.audienceSegmentId?.trim() || null,
        status: input.status,
        bonus: null,
      },
    };
  }

  const kind = input.bonusKind;
  const mode = input.bonusMode === 'double' ? 'double' : 'fixed';
  if (mode === 'double' && kind !== 'points' && kind !== 'cashback') {
    return {
      ok: false,
      error: 'BONUS_MODE',
      message: 'Só pontos e cashback podem dobrar a compra.',
    };
  }
  const quantity = mode === 'double' ? null : input.bonusQuantity;
  if (!kind || (mode === 'fixed' && (quantity == null || !Number.isInteger(quantity) || quantity < 1))) {
    return {
      ok: false,
      error: 'BONUS_REQUIRED',
      message: 'O Bônus precisa de um valor maior que zero.',
    };
  }
  const campaignId = kind === 'stamps' ? input.bonusCampaignId : null;
  if (!destinationActive({ kind, campaignId }, campaigns)) {
    return {
      ok: false,
      error: 'BONUS_DESTINATION',
      message: 'O destino do Bônus precisa estar ativo.',
    };
  }
  const cartelaLabel =
    kind === 'stamps' && campaignId
      ? campaigns.find((c) => c.id === campaignId)?.name ?? null
      : null;
  const bonus =
    mode === 'double'
      ? null
      : {
          kind,
          quantity: quantity!,
          campaignId,
          cartelaLabel,
          sentence: bonusSentence({ kind, quantity: quantity!, cartelaLabel }).slice(0, 160),
        };
  return {
    ok: true,
    value: {
      name,
      notePrompt,
      questions,
      bonusEnabled: true,
      bonusKind: kind,
      bonusMode: mode,
      bonusQuantity: quantity,
      bonusCampaignId: campaignId,
      audienceSegmentId: input.audienceSegmentId?.trim() || null,
      status: input.status,
      bonus,
    },
  };
}

export function parseSnapshot(value: unknown): ConviteSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const questionsRaw = raw.questions;
  if (!Array.isArray(questionsRaw)) return null;
  const questions = questionsRaw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const prompt = typeof row.prompt === 'string' ? row.prompt.trim() : '';
    if (!prompt) return [];
    const position = typeof row.position === 'number' ? row.position : index;
    return [{ position, prompt }];
  });
  if (questions.length < 1 || questions.length > 5) return null;
  const notePrompt =
    typeof raw.notePrompt === 'string' && raw.notePrompt.trim()
      ? raw.notePrompt.trim()
      : null;
  const bonus = parseBonus(raw.bonus);
  const invite =
    typeof raw.inviteLine === 'string' && raw.inviteLine.trim()
      ? raw.inviteLine.trim()
      : inviteLine(bonus);
  return { notePrompt, questions, bonus, inviteLine: invite };
}

function parseBonus(value: unknown): BonusSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const kind = raw.kind;
  if (kind !== 'stamps' && kind !== 'points' && kind !== 'cashback') return null;
  const quantity = raw.quantity;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
    return null;
  }
  const campaignId = typeof raw.campaignId === 'string' ? raw.campaignId : null;
  const cartelaLabel =
    typeof raw.cartelaLabel === 'string' && raw.cartelaLabel.trim()
      ? raw.cartelaLabel.trim()
      : null;
  const sentence =
    typeof raw.sentence === 'string' && raw.sentence.trim()
      ? raw.sentence.trim()
      : bonusSentence({ kind, quantity, cartelaLabel });
  return { kind, quantity, campaignId, cartelaLabel, sentence };
}

export type SubmitGate = 'ok' | 'already' | 'closed' | 'bonus_unavailable' | 'bonus_wallet';

export function submitGate(input: {
  status: ConviteStatus;
  hasResposta: boolean;
  bonus: BonusSnapshot | null;
  destinationActive: boolean;
  earnPaysBonus: boolean;
}): SubmitGate {
  if (input.hasResposta || input.status === 'answered') return 'already';
  if (input.status === 'closed') return 'closed';
  if (input.bonus && !input.earnPaysBonus) return 'bonus_wallet';
  if (input.bonus && !input.destinationActive) return 'bonus_unavailable';
  return 'ok';
}

export function answersMatchSnapshot(
  snapshot: ConviteSnapshot,
  answers: { position: number; value: Polegar }[],
): boolean {
  if (answers.length !== snapshot.questions.length) return false;
  const seen = new Set<number>();
  for (const answer of answers) {
    if (answer.value !== 'up' && answer.value !== 'down') return false;
    if (seen.has(answer.position)) return false;
    seen.add(answer.position);
    if (!snapshot.questions.some((q) => q.position === answer.position)) {
      return false;
    }
  }
  return seen.size === snapshot.questions.length;
}

export function convitePublicUrl(token: string): string {
  const origin = (
    process.env.PESQUISA_PUBLIC_ORIGIN ?? 'https://frego.app.br'
  ).replace(/\/$/, '');
  return `${origin}/p/${token}`;
}

export function walletBonusLabel(bonus: BonusSnapshot): string {
  if (bonus.kind === 'cashback') return `Pesquisa · ${moneyCents(bonus.quantity)}`;
  if (bonus.kind === 'points') {
    const unit = bonus.quantity === 1 ? 'ponto' : 'pontos';
    return `Pesquisa · ${bonus.quantity} ${unit}`;
  }
  const unit = bonus.quantity === 1 ? 'carimbo' : 'carimbos';
  if (bonus.cartelaLabel) {
    return `Pesquisa · ${bonus.quantity} ${unit} · ${bonus.cartelaLabel}`;
  }
  return `Pesquisa · ${bonus.quantity} ${unit}`;
}
