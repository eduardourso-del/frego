'use client';

import { AppShell } from '@/components/app-shell';
import { Card } from '@/components/ui';

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
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[16px] bg-[var(--color-primary-50)] text-[20px] font-bold text-[var(--color-primary-500)]">
            V
          </div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--color-neutral-400)]">
            Em breve
          </p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
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
