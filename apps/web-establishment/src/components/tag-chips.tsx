import type { CSSProperties } from 'react';
import { tagChipStyle, type CustomerTag } from '@/lib/tags';

export function TagChip({
  tag,
  className = '',
}: {
  tag: CustomerTag;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}
      style={tagChipStyle(tag.color) as CSSProperties}
    >
      {tag.name}
    </span>
  );
}

export function TagChipRow({
  tags,
  max = 3,
}: {
  tags: CustomerTag[] | undefined;
  max?: number;
}) {
  if (!tags || tags.length === 0) return null;
  const shown = tags.slice(0, max);
  const extra = tags.length - shown.length;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {shown.map((tag) => (
        <TagChip key={tag.id} tag={tag} />
      ))}
      {extra > 0 ? (
        <span className="text-[10px] font-semibold text-[var(--color-neutral-400)]">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
