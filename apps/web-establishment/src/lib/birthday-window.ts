export type BirthdayWindowKind = 'days' | 'month';

/** Copy for the Janela. Days begin on the birthday and include that day. */
export function birthdayWindowLabel(
  kind: string | null | undefined,
  days: number | null | undefined,
  opts?: { onceAYear?: boolean },
): string {
  const count = days != null && days > 0 ? days : 7;
  const base =
    kind === 'month'
      ? 'No mês do aniversário'
      : count === 1
        ? 'No dia do aniversário'
        : `${count} dias a partir do aniversário`;
  return opts?.onceAYear ? `${base} · uma vez ao ano` : base;
}
