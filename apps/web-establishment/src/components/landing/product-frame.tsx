'use client';

import Image from 'next/image';

export function ProductFrame({
  src,
  alt,
  label,
  caption,
  width,
  height,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  label: string;
  caption?: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-card)] shadow-[var(--shadow-raised)]">
        <div className="flex items-center gap-1.5 border-b border-[var(--color-hairline)] bg-[var(--color-neutral-100)] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-neutral-200)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-neutral-200)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-neutral-200)]" />
          <span className="ml-3 truncate text-[11px] font-medium text-[var(--color-neutral-400)]">
            {label}
          </span>
        </div>
        <div className="bg-[var(--color-bg)]">
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            className="h-auto w-full"
            sizes="(min-width: 1024px) 560px, 100vw"
          />
        </div>
      </div>
      {caption ? (
        <figcaption className="mt-3 text-center text-[13px] text-[var(--color-neutral-500)]">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
