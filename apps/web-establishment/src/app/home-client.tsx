'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { LandingPage } from '@/components/landing/landing-page';

export function HomeClient() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-[15px] text-[var(--color-neutral-500)]">
        Carregando…
      </main>
    );
  }

  if (user) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-[15px] text-[var(--color-neutral-500)]">
        Redirecionando…
      </main>
    );
  }

  return <LandingPage />;
}
