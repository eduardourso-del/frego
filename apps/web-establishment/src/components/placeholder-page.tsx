'use client';

import { AppShell } from '@/components/app-shell';
import { Card } from '@/components/ui';
import { FregoMark } from '@/components/brand';

export default function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AppShell
      title={title}
      topbar={
        <header className="flex h-[60px] items-center border-b border-[var(--color-hairline)] bg-[var(--color-card)]/90 px-7 backdrop-blur">
          <h1 className="text-[17px] font-semibold text-[var(--color-ink)]">
            {title}
          </h1>
        </header>
      }
    >
      <div className="mx-auto max-w-lg px-4 py-12 md:px-7 md:py-16">
        <Card className="text-center" padding="lg">
          <div className="mx-auto mb-5 flex justify-center">
            <FregoMark size={48} />
          </div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-500)]">
            Em breve
          </p>
          <h1 className="mt-2 text-[24px] font-extrabold tracking-[-0.015em] text-[var(--color-ink)]">
            {title}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
            {description}
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
