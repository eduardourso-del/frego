'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Target,
  BarChart3,
  Settings,
  Stamp,
  MoreHorizontal,
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useBusiness } from '@/lib/business-context';
import { BusinessLogo } from '@/components/remote-img';
import { PendingGate } from '@/components/pending-gate';

const mainNav = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/campaigns', label: 'Campanhas', icon: Target },
  { href: '/reports', label: 'Relatórios', icon: BarChart3 },
];

const utilityNav = [
  { href: '/counter', label: 'Balcão', icon: Stamp },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

/** Tabs fixas no rodapé mobile — Balcão no centro. */
const mobileTabs = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/counter', label: 'Balcão', icon: Stamp, emphasize: true },
  { href: '/campaigns', label: 'Campanhas', icon: Target },
] as const;

function initialsFrom(emailOrName: string | null | undefined) {
  if (!emailOrName) return 'EQ';
  const base = emailOrName.split('@')[0] ?? emailOrName;
  const parts = base.split(/[.\s_-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AppShellProps = {
  children: ReactNode;
  businessName?: string;
  topbar?: ReactNode;
  /** Título mostrado no header mobile quando não há topbar desktop. */
  title?: string;
};

export function AppShell({
  children,
  businessName,
  topbar,
  title,
}: AppShellProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { business, businesses, businessId, setBusinessId } = useBusiness();
  const [moreOpen, setMoreOpen] = useState(false);

  const name = businessName ?? business?.name ?? 'Frego';
  const letter = name.trim().charAt(0).toUpperCase() || 'V';
  const logoUrl = business?.logoUrl;
  const primary = business?.primaryColor ?? 'var(--color-primary-500)';
  const staffLabel = user?.email?.split('@')[0] ?? 'Equipe';
  const staffInitials = initialsFrom(user?.email ?? staffLabel);
  const businessBlocked =
    business?.status === 'pending' || business?.status === 'suspended';

  const visibleUtility = businessBlocked
    ? utilityNav.filter((item) => item.href !== '/counter')
    : utilityNav;

  const visibleMobileTabs = businessBlocked
    ? mobileTabs.filter((item) => item.href !== '/counter')
    : mobileTabs;

  const moreActive =
    isActivePath(pathname, '/settings') ||
    isActivePath(pathname, '/reports') ||
    moreOpen;

  const brandTheme = business?.primaryColor
    ? ({
        '--color-primary-500': business.primaryColor,
        '--color-primary-600':
          business.primaryColorDark || business.primaryColor,
        '--color-primary-50': `${business.primaryColor}14`,
      } as CSSProperties)
    : undefined;

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  function NavLink({
    href,
    label,
    icon: Icon,
    onNavigate,
  }: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    onNavigate?: () => void;
  }) {
    const active = isActivePath(pathname, href);
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={`flex min-h-11 items-center gap-3 rounded-[9px] px-2.5 text-[14px] transition-colors ${
          active
            ? 'bg-[var(--color-primary-50)] font-semibold text-[var(--color-primary-500)]'
            : 'font-medium text-[var(--color-neutral-700)] hover:bg-[var(--color-bg)]'
        }`}
      >
        <Icon
          size={18}
          strokeWidth={active ? 2.25 : 1.75}
          className={
            active
              ? 'text-[var(--color-primary-500)]'
              : 'text-[var(--color-neutral-400)]'
          }
          aria-hidden
        />
        {label}
      </Link>
    );
  }

  const brandMark = (
    <div className="flex min-w-0 items-center gap-2.5">
      <BusinessLogo
        src={logoUrl}
        letter={letter}
        className="h-9 w-9 shrink-0 rounded-[11px] object-cover shadow-sm ring-1 ring-black/5"
        letterClassName="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[15px] font-bold text-white shadow-sm"
        background={primary}
      />
      <div className="min-w-0">
        {businesses.length > 1 ? (
          <label className="block">
            <span className="sr-only">Trocar loja</span>
            <select
              value={businessId ?? ''}
              onChange={(e) => setBusinessId(e.target.value)}
              className="max-w-[160px] truncate rounded-[8px] border-0 bg-transparent py-0 pl-0 pr-6 text-[15px] font-semibold text-[var(--color-ink)] focus:ring-0 md:max-w-none"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-ink)]">
            {name}
          </p>
        )}
        {title ? (
          <p className="truncate text-[12px] text-[var(--color-neutral-500)] md:hidden">
            {title}
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className="flex h-dvh overflow-hidden bg-[var(--color-bg)]"
      style={brandTheme}
    >
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-[228px] shrink-0 flex-col border-r border-[var(--color-hairline)] bg-[var(--color-card)] px-3.5 py-5 md:flex">
        <div className="mb-5 shrink-0 px-2">{brandMark}</div>

        <nav
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto"
          aria-label="Principal"
        >
          {mainNav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        <div className="mt-3 flex shrink-0 flex-col gap-0.5 border-t border-[var(--color-hairline)] pt-3">
          {visibleUtility.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
          <div className="mt-2 flex items-center gap-2.5 rounded-[10px] bg-[var(--color-bg)] p-2.5">
            <div
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
              style={{ background: 'var(--color-ink)' }}
              aria-hidden
            >
              {staffInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-[var(--color-ink)]">
                {staffLabel}
              </div>
              {user ? (
                <button
                  type="button"
                  onClick={() => logout()}
                  className="text-[11px] text-[var(--color-neutral-400)] hover:text-[var(--color-primary-500)]"
                >
                  Sair
                </button>
              ) : (
                <Link
                  href="/login"
                  className="text-[11px] text-[var(--color-primary-500)]"
                >
                  Entrar
                </Link>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Mobile top chrome */}
        <header className="safe-top sticky top-0 z-30 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-hairline)] bg-[var(--color-card)]/95 px-4 py-3 backdrop-blur-md md:hidden">
          {brandMark}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)]"
            aria-label="Mais opções"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ background: 'var(--color-ink)' }}
            >
              {staffInitials}
            </span>
          </button>
        </header>

        {topbar ? (
          <div className="hidden shrink-0 md:block">{topbar}</div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0">
            <PendingGate>{children}</PendingGate>
          </div>
        </div>

        {/* Mobile bottom tabs */}
        <nav
          className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-hairline)] bg-[var(--color-card)]/95 backdrop-blur-md md:hidden"
          aria-label="Navegação principal"
        >
          <div
            className={`mx-auto grid max-w-lg px-1 pt-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] ${
              visibleMobileTabs.length >= 4 ? 'grid-cols-5' : 'grid-cols-4'
            }`}
          >
            {visibleMobileTabs.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              const emphasize = 'emphasize' in item && item.emphasize;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold tracking-[-0.01em] transition-colors ${
                    active
                      ? 'text-[var(--color-primary-500)]'
                      : 'text-[var(--color-neutral-400)]'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-[14px] transition-all ${
                      emphasize
                        ? active
                          ? 'bg-[var(--color-primary-500)] text-[var(--color-on-primary)]'
                          : 'bg-[var(--color-ink)] text-[var(--color-card)]'
                        : active
                          ? 'bg-[var(--color-primary-50)]'
                          : ''
                    }`}
                  >
                    <Icon
                      size={emphasize ? 20 : 20}
                      strokeWidth={active || emphasize ? 2.25 : 1.75}
                      className={
                        emphasize
                          ? 'text-white'
                          : active
                            ? 'text-[var(--color-primary-500)]'
                            : 'text-[var(--color-neutral-400)]'
                      }
                      aria-hidden
                    />
                  </span>
                  {item.label}
                </Link>
              );
            })}

            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold tracking-[-0.01em] transition-colors ${
                moreActive
                  ? 'text-[var(--color-primary-500)]'
                  : 'text-[var(--color-neutral-400)]'
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-[14px] ${
                  moreActive ? 'bg-[var(--color-primary-50)]' : ''
                }`}
              >
                <MoreHorizontal
                  size={20}
                  strokeWidth={moreActive ? 2.25 : 1.75}
                  aria-hidden
                />
              </span>
              Mais
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile "Mais" sheet */}
      {moreOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            aria-label="Fechar"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="safe-bottom absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-auto rounded-t-[22px] bg-[var(--color-card)] shadow-[0_-12px_40px_rgba(16,24,40,0.18)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="more-sheet-title"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-hairline)] bg-[var(--color-card)] px-5 py-4">
              <div>
                <p
                  id="more-sheet-title"
                  className="text-[17px] font-semibold text-[var(--color-ink)]"
                >
                  Mais
                </p>
                <p className="text-[13px] text-[var(--color-neutral-500)]">
                  Relatórios, configurações e a conta
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-neutral-600)]"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-4 py-4">
              <div className="mb-4 flex items-center gap-3 rounded-[16px] bg-[var(--color-bg)] p-3.5">
                <BusinessLogo
                  src={logoUrl}
                  letter={letter}
                  className="h-12 w-12 rounded-[14px] object-cover ring-1 ring-black/5"
                  letterClassName="flex h-12 w-12 items-center justify-center rounded-[14px] text-[18px] font-bold text-white"
                  background={primary}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-[var(--color-ink)]">
                    {name}
                  </p>
                  <p className="truncate text-[13px] text-[var(--color-neutral-500)]">
                    {user?.email ?? 'Equipe'}
                  </p>
                </div>
              </div>

              {businesses.length > 1 ? (
                <label className="mb-4 block">
                  <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
                    Loja ativa
                  </span>
                  <select
                    value={businessId ?? ''}
                    onChange={(e) => setBusinessId(e.target.value)}
                    className="min-h-11 w-full rounded-[12px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[15px] font-medium"
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="flex flex-col gap-0.5">
                <NavLink
                  href="/reports"
                  label="Relatórios"
                  icon={BarChart3}
                  onNavigate={() => setMoreOpen(false)}
                />
                <NavLink
                  href="/settings"
                  label="Configurações"
                  icon={Settings}
                  onNavigate={() => setMoreOpen(false)}
                />
                {!businessBlocked ? (
                  <NavLink
                    href="/counter"
                    label="Balcão"
                    icon={Stamp}
                    onNavigate={() => setMoreOpen(false)}
                  />
                ) : null}
              </div>

              <div className="mt-4 border-t border-[var(--color-hairline)] pt-4">
                {user ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      void logout();
                    }}
                    className="flex min-h-11 w-full items-center gap-3 rounded-[12px] px-2.5 text-[14px] font-semibold text-[var(--color-danger)]"
                  >
                    <LogOut size={18} aria-hidden />
                    Sair da conta
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMoreOpen(false)}
                    className="flex min-h-11 items-center gap-3 rounded-[12px] px-2.5 text-[14px] font-semibold text-[var(--color-primary-500)]"
                  >
                    Entrar
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
