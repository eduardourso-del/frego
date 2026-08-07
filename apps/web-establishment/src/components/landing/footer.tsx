'use client';

import Link from 'next/link';

const productLinks = [
  { href: '#fregueses', label: 'Criar fregueses' },
  { href: '#resultado', label: 'No caixa' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#comparacao', label: 'O que acreditamos' },
];

const accountLinks = [
  { href: '/login', label: 'Entrar' },
  { href: '/register', label: 'Cadastrar meu negócio' },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--color-hairline)] bg-[var(--color-card)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-[12px] text-[15px] font-bold text-white"
              style={{ background: 'var(--color-primary-500)' }}
              aria-hidden
            >
              V
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.02em]">
              Frego
            </span>
          </div>
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
            Não vendemos fidelidade. Criamos fregueses. Relacionamentos que fazem
            o cliente do negócio local voltar — com WhatsApp, IA e automações.
          </p>
        </div>

        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--color-neutral-400)]">
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
          <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--color-neutral-400)]">
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
          <p className="mt-6 text-[13px] text-[var(--color-neutral-500)]">
            Contato:{' '}
            <a
              href="mailto:contato@frego.com"
              className="font-medium text-[var(--color-ink)] hover:text-[var(--color-primary-500)]"
            >
              [E-MAIL A CONFIRMAR]
            </a>
          </p>
          <p className="mt-2 text-[13px] text-[var(--color-neutral-400)]">
            Redes: [LINKS A CONFIRMAR]
          </p>
        </div>
      </div>

      <div className="border-t border-[var(--color-hairline)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-[12px] text-[var(--color-neutral-400)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} Frego. Todos os direitos reservados.</p>
          <p>Todo cliente merece virar freguês.</p>
        </div>
      </div>
    </footer>
  );
}
