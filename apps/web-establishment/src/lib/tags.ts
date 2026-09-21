export type CustomerTag = {
  id: string;
  name: string;
  color: string | null;
};

export type CatalogTag = CustomerTag & {
  sortOrder: number;
  archivedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const TAG_PALETTE = [
  '#24479C',
  '#0F766E',
  '#B45309',
  '#BE185D',
  '#6D28D9',
  '#047857',
  '#C2410C',
  '#334155',
] as const;

export function tagChipStyle(color: string | null | undefined): {
  background: string;
  color: string;
} {
  const hex = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#24479C';
  return { background: `${hex}1A`, color: hex };
}
