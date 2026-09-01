const LABELS: Record<string, string> = {
  pending: 'Pendente',
  trial: 'Teste',
  active: 'Ativo',
  past_due: 'Inadimplente',
  suspended: 'Suspenso',
  inactive: 'Inativo',
  draft: 'Rascunho',
};

const STYLES: Record<string, string> = {
  pending:
    'bg-[var(--color-warning-bg)] text-[var(--color-warning)] ring-[var(--color-warning)]/25',
  trial:
    'bg-[var(--color-primary-50)] text-[var(--color-primary-600)] ring-[var(--color-primary-200)]',
  active:
    'bg-[var(--color-success-bg)] text-[var(--color-success)] ring-[var(--color-success)]/25',
  past_due:
    'bg-[var(--color-warning-bg)] text-[var(--color-warning)] ring-[var(--color-warning)]/25',
  suspended:
    'bg-[var(--color-danger-bg)] text-[var(--color-danger)] ring-[var(--color-danger)]/25',
  inactive:
    'bg-[var(--color-bg)] text-[var(--color-neutral-600)] ring-[var(--color-hairline)]',
  draft:
    'bg-[var(--color-bg)] text-[var(--color-neutral-600)] ring-[var(--color-hairline)]',
};

export function StatusBadge({ status }: { status: string }) {
  const label = LABELS[status] ?? status;
  const style =
    STYLES[status] ??
    'bg-[var(--color-bg)] text-[var(--color-neutral-600)] ring-[var(--color-hairline)]';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold tracking-[0.02em] ring-1 ring-inset ${style}`}
    >
      {label}
    </span>
  );
}
