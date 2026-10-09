import type { ReactNode } from 'react';
import Link from 'next/link';
import { FregoWordmark } from '@/components/brand';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';

export const authCardClass =
  'flex flex-col gap-4 rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]';

export function AuthScreen({
  eyebrow = 'Estabelecimento',
  title,
  description,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[var(--color-bg)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[var(--color-primary-50)] to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-8">
          <FregoWordmark height={28} href="/" />
          <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-500)]">
            {eyebrow}
          </p>
        </div>

        <h1 className="text-[32px] font-extrabold tracking-[-0.025em] text-[var(--color-ink)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
            {description}
          </p>
        ) : null}

        <div className="mt-8">{children}</div>
        {footer ? <div className="mt-6">{footer}</div> : null}
        <AuthLegalLinks />
      </div>
    </main>
  );
}

function AuthLegalLinks() {
  return (
    <p className="mt-3 text-center text-[12px] text-[var(--color-neutral-400)]">
      <Link href="/suporte" className="hover:text-[var(--color-ink)]">
        Suporte
      </Link>
      {' · '}
      <Link href="/privacidade" className="hover:text-[var(--color-ink)]">
        Privacidade
      </Link>
      {' · '}
      <Link href="/termos" className="hover:text-[var(--color-ink)]">
        Termos
      </Link>
      {' · '}
      <a href={CONTACT_MAILTO} className="hover:text-[var(--color-ink)]">
        {CONTACT_EMAIL}
      </a>
    </p>
  );
}
