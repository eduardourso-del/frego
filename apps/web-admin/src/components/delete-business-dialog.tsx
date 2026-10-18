'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';

export function DeleteBusinessDialog({
  name,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const word = name.trim() || 'EXCLUIR';
  const matches = typed === word;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!matches || busy) return;
    onConfirm();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="w-full max-w-md rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]"
      >
        <h2 id={titleId} className="text-[20px] font-semibold tracking-[-0.02em]">
          Excluir estabelecimento
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-neutral-700)]">
          Campanhas, pesquisas, equipe e o histórico de{' '}
          <span className="font-semibold text-[var(--color-ink)]">{word}</span>{' '}
          somem. A conta do cliente na Frego permanece. Isso não desfaz.
        </p>
        <label className="mt-4 block text-[13px] font-semibold uppercase tracking-[0.04em]">
          Digite o nome para confirmar
          <span className="mt-2 block font-mono text-[15px] font-semibold normal-case tracking-normal text-[var(--color-ink)]">
            {word}
          </span>
          <input
            ref={inputRef}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            aria-label={`Digite ${word} para confirmar`}
            className="mt-2 min-h-11 w-full rounded-[8px] border border-[var(--color-neutral-200)] bg-[var(--color-card)] px-3 text-[16px] font-normal normal-case tracking-normal text-[var(--color-ink)]"
          />
        </label>
        {error && (
          <p className="mt-3 text-[13px] text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-10 rounded-[10px] border border-[var(--color-hairline)] px-4 text-[14px] font-semibold disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!matches || busy}
            className="min-h-10 rounded-[10px] bg-[var(--color-danger)] px-4 text-[14px] font-semibold text-white disabled:opacity-40"
          >
            {busy ? 'Excluindo…' : 'Excluir estabelecimento'}
          </button>
        </div>
      </form>
    </div>
  );
}
