'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { INTEGRATIONS } from '@/components/integrations/catalog';

function integrationIdFromHash(hash: string): string | null {
  if (!hash.startsWith('#integracoes/')) return null;
  const id = hash.slice('#integracoes/'.length);
  return INTEGRATIONS.some((item) => item.id === id) ? id : null;
}

export function IntegrationsTab() {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => setOpenId(integrationIdFromHash(window.location.hash));
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  function toggle(id: string) {
    const next = openId === id ? null : id;
    setOpenId(next);
    const hash = next ? `#integracoes/${next}` : '#integracoes';
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
        Cada uma é opcional. O estabelecimento liga só o que usa.
      </p>
      {INTEGRATIONS.map((item) => {
        const open = openId === item.id;
        const Status = item.Status;
        const Panel = item.Panel;
        return (
          <section
            key={item.id}
            className="rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] shadow-[var(--shadow-card)]"
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(item.id)}
              className="flex w-full items-start gap-3 px-5 py-4 text-left"
            >
              <span className="min-w-0 flex-1">
                {item.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.logo} alt={item.name} className="h-8 w-auto" />
                ) : (
                  <span className="block text-[16px] font-semibold text-[var(--color-ink)]">
                    {item.name}
                  </span>
                )}
                <span className="mt-1.5 block text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
                  {item.summary}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {Status ? <Status /> : null}
                <ChevronDown
                  size={18}
                  className={`text-[var(--color-neutral-400)] transition-transform ${open ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </span>
            </button>
            {open ? (
              <div className="border-t border-[var(--color-hairline)] px-5 py-4">
                <Panel embedded />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
