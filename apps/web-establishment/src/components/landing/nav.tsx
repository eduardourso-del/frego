'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FregoMark } from '@/components/brand';

const links = [
  { href: '#problema', label: 'O problema' },
  { href: '#fregueses', label: 'A promessa' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#campanhas', label: 'Campanhas' },
  { href: '#app', label: 'App' },
  { href: '#resultado', label: 'No caixa' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 safe-top transition-[background,box-shadow,backdrop-filter] ${
        scrolled
          ? 'border-b border-[var(--color-hairline)] bg-[var(--color-card)]/90 shadow-[var(--shadow-card)] backdrop-blur-md'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <a href="#topo" className="inline-flex items-center py-2" aria-label="Frego">
          <FregoMark size={32} />
        </a>

        <nav
          className="hidden items-center gap-4 xl:gap-6 lg:flex"
          aria-label="Seções"
        >
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[14px] font-medium text-[var(--color-neutral-500)] transition-colors hover:text-[var(--color-ink)]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden min-h-11 items-center rounded-[8px] px-3.5 text-[14px] font-extrabold text-[var(--color-primary-500)] sm:inline-flex"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center rounded-[8px] bg-[var(--color-primary-500)] px-5 text-[14px] font-extrabold text-[var(--color-on-primary)] transition-[transform,background] hover:bg-[var(--color-primary-600)] active:scale-[0.98]"
          >
            Testar grátis
          </Link>
        </div>
      </div>
    </header>
  );
}
