import Link from 'next/link';
import type { ReactNode } from 'react';
import { FregoWordmark } from '@/components/brand';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';

const legalNav = [
  { href: '/suporte', label: 'Suporte' },
  { href: '/privacidade', label: 'Privacidade' },
  { href: '/termos', label: 'Termos' },
] as const;

export function LegalDoc({
  title,
  updatedAt,
  intro,
  children,
}: {
  title: string;
  updatedAt?: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-dvh bg-[var(--color-bg)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[var(--color-primary-50)] to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <FregoWordmark height={28} href="/" />
          <nav className="flex flex-wrap gap-4 text-[13px]">
            {legalNav.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[var(--color-neutral-600)] hover:text-[var(--color-primary-500)]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <article className="rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-card)] px-6 py-8 shadow-[var(--shadow-card)] sm:px-10 sm:py-10">
          <h1 className="text-[32px] font-extrabold tracking-[-0.025em] text-[var(--color-ink)]">
            {title}
          </h1>
          {updatedAt ? (
            <p className="mt-2 text-[13px] text-[var(--color-neutral-400)]">
              Última atualização: {updatedAt}
            </p>
          ) : null}
          {intro ? <div className="mt-6">{intro}</div> : null}
          <div className="legal-prose mt-8 space-y-6 text-[15px] leading-relaxed text-[var(--color-neutral-700)] [&_h2]:mt-10 [&_h2:first-child]:mt-0 [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_h2]:text-[var(--color-ink)] [&_h3]:mt-6 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-[var(--color-ink)] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_a]:font-medium [&_a]:text-[var(--color-primary-500)] [&_a]:underline-offset-2 hover:[&_a]:underline [&_strong]:font-semibold [&_strong]:text-[var(--color-ink)]">
            {children}
          </div>
        </article>

        <p className="mt-8 text-center text-[13px] text-[var(--color-neutral-400)]">
          Dúvidas?{' '}
          <a
            href={CONTACT_MAILTO}
            className="font-medium text-[var(--color-primary-500)]"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
