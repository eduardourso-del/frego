export const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  stamps: 'Carimbos',
  spend: 'Pontos',
  birthday: 'Aniversário',
  cashback: 'Cashback',
  promo: 'Promoção',
};

export const CAMPAIGN_TYPE_COLOR: Record<string, string> = {
  stamps: 'var(--color-stamps)',
  spend: 'var(--color-points)',
  birthday: 'var(--color-primary-500)',
  cashback: 'var(--color-cashback)',
  promo: 'var(--color-promo)',
};

export function campaignTypeLabel(type: string) {
  return CAMPAIGN_TYPE_LABEL[type] ?? type;
}

export function campaignTypeColor(type: string) {
  return CAMPAIGN_TYPE_COLOR[type] ?? 'var(--color-primary-500)';
}

export function redeemCountLabel(type: string, count: number) {
  if (type === 'cashback') {
    return count === 1 ? '1 uso no caixa' : `${count} usos no caixa`;
  }
  return count === 1 ? '1 resgate' : `${count} resgates`;
}
