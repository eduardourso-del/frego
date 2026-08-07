'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const links = [
  { href: '#problema', label: 'O problema' },
  { href: '#fregueses', label: 'Fregueses' },
  { href: '#resultado', label: 'No caixa' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#resultados', label: 'Prova' },
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
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`sticky top-0 z-50 safe-top transition-[background,box-shadow,backdrop-filter] ${
        scrolled
          ? 'border-b border-[var(--color-hairline)] bg-[var(--color-card)]/90 shadow-[var(--shadow-card)] backdrop-blur-md'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <a href="#topo" className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[12px] text-[15px] font-bold text-white"
            style={{ background: 'var(--color-primary-500)' }}
            aria-hidden
          >
            V
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
            Frego
          </span>
        </a>

        <nav
          className="hidden items-center gap-6 lg:flex"
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
            className="hidden min-h-10 items-center rounded-[12px] px-3.5 text-[14px] font-semibold text-[var(--color-ink)] sm:inline-flex"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-10 items-center rounded-[12px] bg-[var(--color-primary-500)] px-4 text-[14px] font-semibold text-white shadow-[var(--shadow-cta)] transition-[transform,background] hover:bg-[var(--color-primary-600)] active:scale-[0.98]"
          >
            Testar grátis
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
