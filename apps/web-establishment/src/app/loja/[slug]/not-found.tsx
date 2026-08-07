import Link from 'next/link';

export default function LojaNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--color-ink)]">
        Loja não encontrada
      </h1>
      <p className="max-w-sm text-[15px] text-[var(--color-neutral-500)]">
        Esse link público não existe ou a loja ainda não está disponível.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-11 items-center justify-center rounded-[12px] bg-[var(--color-primary-500)] px-5 text-[14px] font-semibold text-white"
      >
        Ir para a Frego
      </Link>
    </main>
  );
}
