'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { FregoWordmark } from '@/components/brand';

const nav = [
  { href: '/', label: 'Visão geral' },
  { href: '/businesses', label: 'Estabelecimentos' },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout, configured } = useAuth();

  useEffect(() => {
    if (!loading && configured && !user) {
      router.replace('/login');
    }
  }, [loading, configured, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[15px] text-[var(--color-neutral-500)]">
        Carregando…
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <aside
        className="hidden w-[236px] shrink-0 flex-col px-4 py-6 md:flex"
        style={{
          background: 'var(--color-primary-800)',
          color: 'var(--color-card)',
        }}
      >
        <div className="mb-8 px-2">
          <FregoWordmark height={22} negative />
          <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-200)]">
            Admin
          </p>
        </div>
        <nav className="flex flex-col gap-1 text-[15px]">
          {nav.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-[8px] px-3 py-2 ${
                  active
                    ? 'bg-[color-mix(in_srgb,white_10%,transparent)] text-white'
                    : 'text-[color-mix(in_srgb,white_55%,transparent)] hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-2 text-[12px] text-[color-mix(in_srgb,white_55%,transparent)]">
          <div className="truncate">{user.email}</div>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-1 text-[var(--color-primary-200)] hover:text-white"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 px-6 py-8 md:px-10">{children}</main>
    </div>
  );
}
