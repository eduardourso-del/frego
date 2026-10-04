'use client';

import Link from 'next/link';
import { FregoWordmark } from '@/components/brand';
import { StoreBadges } from '@/components/store-badges';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';

const productLinks = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#atencao', label: 'Quem merece atenção' },
  { href: '#hoje', label: 'Inteligência' },
  { href: '#resultado', label: 'Resultado' },
  { href: '#campanhas', label: 'Relacionamento' },
  { href: '#app', label: 'App do cliente' },
  { href: '#simplicidade', label: 'Simplicidade' },
];

const accountLinks = [
  { href: '/login', label: 'Entrar' },
  { href: '/register', label: 'Cadastrar meu negócio' },
];

const legalLinks = [
  { href: '/suporte', label: 'Suporte' },
  { href: '/privacidade', label: 'Privacidade' },
  { href: '/termos', label: 'Termos de uso' },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--color-hairline)] bg-[var(--color-card)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <FregoWordmark height={28} />
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
            Transforme clientes em fregueses. Inteligência comercial simples
            para o pequeno negócio local — sem CRM, sem equipe de marketing.
          </p>
          <p className="mt-4 text-[13px] text-[var(--color-neutral-500)]">
            Contato:{' '}
            <a
              href={CONTACT_MAILTO}
              className="font-medium text-[var(--color-ink)] hover:text-[var(--color-primary-500)]"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <StoreBadges className="mt-5" />
        </div>

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-500)]">
            Produto
          </p>
          <ul className="mt-3 space-y-2">
            {productLinks.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="text-[14px] text-[var(--color-neutral-700)] hover:text-[var(--color-primary-500)]"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-500)]">
            Conta
          </p>
          <ul className="mt-3 space-y-2">
            {accountLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-[14px] text-[var(--color-neutral-700)] hover:text-[var(--color-primary-500)]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-neutral-500)]">
            Ajuda
          </p>
          <ul className="mt-3 space-y-2">
            {legalLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-[14px] text-[var(--color-neutral-700)] hover:text-[var(--color-primary-500)]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--color-hairline)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-[12px] text-[var(--color-neutral-400)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {new Date().getFullYear()} Frego · Bearlabs. Todos os direitos
            reservados.
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <Link href="/suporte" className="hover:text-[var(--color-ink)]">
              Suporte
            </Link>
            <Link href="/privacidade" className="hover:text-[var(--color-ink)]">
              Privacidade
            </Link>
            <Link href="/termos" className="hover:text-[var(--color-ink)]">
              Termos
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
