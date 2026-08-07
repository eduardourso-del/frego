'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';

const nav = [
  { href: '/', label: 'Visão geral' },
  { href: '/businesses', label: 'Negócios' },
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
        style={{ background: '#0C0D10', color: '#E8EAED' }}
      >
        <div className="mb-8 flex items-center gap-2 px-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-sm font-semibold text-white"
            style={{ background: 'var(--color-primary-500)' }}
          >
            V
          </div>
          <span className="text-[15px] font-semibold">Frego Admin</span>
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
                className={`rounded-[10px] px-3 py-2 ${
                  active ? 'bg-[#1D2026] text-white' : 'text-[#9AA0AA]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-2 text-[12px] text-[#9AA0AA]">
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
