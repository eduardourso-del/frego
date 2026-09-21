export type RevenueCoverage = {
  withAmount: number;
  used: number;
};

export function formatCoverage(c?: RevenueCoverage | null): string | null {
  if (!c || c.used <= 0) return null;
  return `${c.withAmount} de ${c.used} com valor`;
}
