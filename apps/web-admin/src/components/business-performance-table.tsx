import Link from 'next/link';
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/labels';

export type BusinessPerformanceRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  slug: string | null;
  logoUrl: string | null;
  primaryColor: string;
  owner: { email: string | null; displayName: string | null } | null;
  customers: number;
  campaigns: number;
  activeCampaigns: number;
  performance: {
    earns: number;
    redeems: number;
    spendCents: number;
    lastActivityAt: string | null;
  };
};

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatWhen(iso: string | null) {
  if (!iso) return 'Sem movimento';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function BusinessPerformanceTable({
  rows,
  busyId,
  onAct,
  onDelete,
}: {
  rows: BusinessPerformanceRow[];
  busyId?: string | null;
  onAct?: (id: string, action: 'approve' | 'reject') => void;
  onDelete?: (id: string, name: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[920px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-[var(--color-hairline)] text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
            <th className="px-4 py-3 font-semibold">Estabelecimento</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Clientes</th>
            <th className="px-4 py-3 font-semibold">Campanhas</th>
            <th className="px-4 py-3 font-semibold">30 dias</th>
            <th className="px-4 py-3 font-semibold">Última atividade</th>
            <th className="px-4 py-3 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr
              key={b.id}
              className="border-b border-[var(--color-hairline)] last:border-0"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] text-[14px] font-bold text-white"
                    style={{ background: b.primaryColor }}
                  >
                    {b.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.logoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      b.name.trim().charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{b.name}</p>
                    <p className="truncate text-[13px] text-[var(--color-neutral-500)]">
                      {TYPE_LABEL[b.type] ?? b.type}
                      {b.slug ? ` · /${b.slug}` : ''}
                      {b.owner?.displayName ? ` · ${b.owner.displayName}` : ''}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="rounded-[6px] bg-[var(--color-bg)] px-2 py-0.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-500)]">
                  {STATUS_LABEL[b.status] ?? b.status}
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums">
                <Link
                  href={`/businesses/${b.id}#clientes`}
                  className="font-semibold text-[var(--color-primary-600)]"
                >
                  {b.customers}
                </Link>
              </td>
              <td className="px-4 py-3 tabular-nums">
                <span className="font-semibold">{b.activeCampaigns}</span>
                <span className="text-[var(--color-neutral-500)]">
                  {' '}
                  ativas · {b.campaigns}
                </span>
              </td>
              <td className="px-4 py-3 text-[13px] text-[var(--color-neutral-700)]">
                {b.performance.earns} acúmulos
                <span className="text-[var(--color-neutral-400)]"> · </span>
                {b.performance.redeems} resgates
                <span className="text-[var(--color-neutral-400)]"> · </span>
                {formatBrl(b.performance.spendCents)}
              </td>
              <td className="px-4 py-3 text-[13px] text-[var(--color-neutral-500)]">
                {formatWhen(b.performance.lastActivityAt)}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  {onAct && b.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => onAct(b.id, 'approve')}
                        className="min-h-9 rounded-[8px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold disabled:opacity-60"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => onAct(b.id, 'reject')}
                        className="min-h-9 rounded-[8px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold disabled:opacity-60"
                      >
                        Recusar
                      </button>
                    </>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => onDelete(b.id, b.name)}
                      className="min-h-9 rounded-[8px] border border-[var(--color-hairline)] px-3 text-[13px] font-semibold text-[var(--color-danger)] disabled:opacity-60"
                    >
                      Excluir
                    </button>
                  )}
                  <Link
                    href={`/businesses/${b.id}`}
                    className="inline-flex min-h-9 items-center rounded-[8px] bg-[var(--color-primary-500)] px-3 text-[13px] font-semibold text-white"
                  >
                    Abrir
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
