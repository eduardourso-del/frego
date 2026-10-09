'use client';

import { useState } from 'react';
import { FregoWordmark } from '@/components/brand';
import { PesquisaBrandHeader, type PesquisaBrand } from '@/components/pesquisa-brand-header';
import { PolegarChoice } from '@/components/pesquisa-polegar';

type BonusKind = 'stamps' | 'points' | 'cashback';
type BonusMode = 'fixed' | 'double';

export type PesquisaPreviewInput = PesquisaBrand & {
  name: string;
  questions: string[];
  notePrompt: string;
  bonusEnabled: boolean;
  bonusKind: BonusKind;
  bonusMode: BonusMode;
  bonusQuantity: string;
  cartelaName: string | null;
};

function moneyLabel(raw: string): string | null {
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function previewHeadline(input: PesquisaPreviewInput): string {
  if (!input.bonusEnabled) return 'A loja deixou uma pesquisa.';
  if (input.bonusMode === 'double' && input.bonusKind === 'cashback') {
    return 'Responda e dobre o cashback desta compra.';
  }
  if (input.bonusMode === 'double' && input.bonusKind === 'points') {
    return 'Responda e dobre os pontos desta compra.';
  }
  if (input.bonusKind === 'cashback') {
    const money = moneyLabel(input.bonusQuantity);
    return money ? `Responda e ganhe ${money}.` : 'Responda e ganhe cashback.';
  }
  const count = Math.round(Number(input.bonusQuantity.replace(',', '.')));
  if (!Number.isInteger(count) || count < 1) {
    return input.bonusKind === 'points' ? 'Responda e ganhe pontos.' : 'Responda e ganhe carimbos.';
  }
  if (input.bonusKind === 'points') {
    const unit = count === 1 ? 'ponto' : 'pontos';
    return `Responda e ganhe ${count} ${unit}.`;
  }
  const unit = count === 1 ? 'carimbo' : 'carimbos';
  if (input.cartelaName) {
    return `Responda e ganhe ${count} ${unit} na cartela ${input.cartelaName}.`;
  }
  return `Responda e ganhe ${count} ${unit}.`;
}

export function PesquisaPagePreview({ input }: { input: PesquisaPreviewInput }) {
  const questions = input.questions.map((prompt) => prompt.trim()).filter(Boolean);
  const [answers, setAnswers] = useState<Record<number, 'up' | 'down'>>({});
  const headline = previewHeadline(input);

  return (
    <div>
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
        Prévia · página do cliente
      </p>
      <div className="overflow-hidden rounded-[16px] border border-[var(--color-hairline)] bg-[var(--color-bg)] shadow-[var(--shadow-card)]">
        <PesquisaBrandHeader brand={input} />
        <div className="flex flex-col gap-4 px-5 py-6">
          {input.name.trim() ? (
            <h2 className="text-[22px] font-extrabold leading-tight tracking-[-0.04em] text-[var(--color-ink)]">
              {input.name.trim()}
            </h2>
          ) : null}
          <p
            className={
              input.name.trim()
                ? 'text-[15px] font-semibold leading-snug text-[var(--color-neutral-600)]'
                : 'text-[22px] font-extrabold leading-tight tracking-[-0.04em] text-[var(--color-ink)]'
            }
          >
            {headline}
          </p>
          {questions.length === 0 ? (
            <p className="text-[14px] text-[var(--color-neutral-500)]">
              As perguntas aparecem aqui.
            </p>
          ) : (
            questions.map((prompt, index) => (
              <section
                key={`${index}-${prompt}`}
                className="rounded-[16px] border border-[var(--color-hairline)] p-4"
              >
                <p className="font-semibold">{prompt}</p>
                <PolegarChoice
                  value={answers[index]}
                  onChange={(next) => setAnswers((current) => ({ ...current, [index]: next }))}
                />
              </section>
            ))
          )}
          {input.notePrompt.trim() ? (
            <label className="block">
              <span className="mb-1 block text-[13px] font-semibold">{input.notePrompt.trim()}</span>
              <textarea
                readOnly
                placeholder="A cliente escreve aqui"
                className="min-h-24 w-full rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-bg)] p-3 text-[14px]"
              />
            </label>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-[13px] font-semibold">Telefone da conta</span>
            <input
              readOnly
              placeholder="11 90000-0000"
              className="min-h-11 w-full rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-bg)] px-3 text-[14px]"
            />
          </label>
          <button
            type="button"
            disabled
            className="min-h-12 rounded-[12px] bg-[var(--color-ink)] font-extrabold text-white opacity-50"
          >
            Enviar código
          </button>
        </div>
        <footer className="border-t border-[var(--color-hairline)] py-6">
          <div className="flex justify-center" aria-label="Frego">
            <FregoWordmark height={22} />
          </div>
        </footer>
      </div>
      <p className="mt-3 text-[12px] leading-snug text-[var(--color-neutral-500)]">
        O link de verdade sai na mensagem da compra, só para essa cliente. Esta prévia não grava resposta.
      </p>
    </div>
  );
}
