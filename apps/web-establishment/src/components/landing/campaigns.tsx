'use client';

import {
  Banknote,
  Cake,
  Check,
  Coins,
  Gift,
  ImageIcon,
  Layers,
  MapPin,
  MessageCircle,
  PauseCircle,
  SlidersHorizontal,
  Stamp,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '@/components/landing/reveal';

const types: Array<{
  title: string;
  kicker: string;
  body: string;
  example: string;
  Icon: LucideIcon;
  card: string;
  iconWrap: string;
  kickerClass: string;
  motif: 'stamps' | 'points' | 'cashback' | 'birthday';
}> = [
  {
    title: 'Carimbos',
    kicker: 'Frequência',
    body: 'Cada visita no balcão vira um carimbo. Você escolhe a meta — 8, 10 ou 12 — e o prêmio: o pão de queijo, o café, o combo da loja. É simples de explicar no caixa e fácil de virar hábito.',
    example:
      'Na padaria, no café ou na lanchonete, o cliente vê o cartão enchendo e já sabe por que voltar.',
    Icon: Stamp,
    card: 'border-[var(--color-stamps-ring)] bg-[var(--color-stamps-bg)]',
    iconWrap: 'bg-[var(--color-stamps)] text-white',
    kickerClass: 'text-[var(--color-stamps)]',
    motif: 'stamps',
  },
  {
    title: 'Pontos',
    kicker: 'Gasto',
    body: 'O cliente acumula pontos pelo valor registrado no balcão. Você define quantos pontos cada real vale e qual a meta do prêmio. Funciona bem quando o pedido muda de tamanho a cada visita.',
    example:
      'No restaurante, na pizzaria ou na hamburgueria, quem pede mais avança mais — sem a loja virar promoção o mês inteiro.',
    Icon: Coins,
    card: 'border-[var(--color-points-ring)] bg-[var(--color-points-bg)]',
    iconWrap: 'bg-[var(--color-points)] text-white',
    kickerClass: 'text-[var(--color-points)]',
    motif: 'points',
  },
  {
    title: 'Cashback',
    kicker: 'Saldo',
    body: 'Uma porcentagem da compra volta em reais para o cliente usar na loja. A taxa fica na campanha — 5%, 10% ou 15% — não numa configuração escondida. É um motivo imediato para atravessar a porta de novo.',
    example:
      'No caixa, o saldo aparece na hora. O cliente gasta o que ganhou com você, não no concorrente.',
    Icon: Banknote,
    card: 'border-[var(--color-cashback-ring)] bg-[var(--color-cashback-bg)]',
    iconWrap: 'bg-[var(--color-cashback)] text-white',
    kickerClass: 'text-[var(--color-cashback)]',
    motif: 'cashback',
  },
  {
    title: 'Aniversário',
    kicker: 'Data',
    body: 'No dia do aniversário do cliente — e nos seis dias seguintes — a loja oferece um presente. Não é uma promoção eterna: é um gesto com data, que reforça “você faz parte daqui”.',
    example:
      'Um croissant, um café ou um desconto só naquele período. Relacionamento com data no calendário.',
    Icon: Cake,
    card: 'border-[var(--color-primary-200)] bg-[var(--color-primary-50)]',
    iconWrap: 'bg-[var(--color-primary-500)] text-white',
    kickerClass: 'text-[var(--color-primary-600)]',
    motif: 'birthday',
  },
];

const assemble: Array<{
  n: string;
  title: string;
  body: string;
  Icon: LucideIcon;
  wrap: string;
}> = [
  {
    n: '01',
    title: 'O tipo',
    body: 'Carimbos, pontos, cashback ou aniversário: o formato que combina com a sua operação.',
    Icon: SlidersHorizontal,
    wrap: 'bg-[var(--color-primary-500)] text-white',
  },
  {
    n: '02',
    title: 'A meta',
    body: 'Quantos carimbos, quantos pontos ou qual porcentagem. Você calibra o esforço e o presente.',
    Icon: Target,
    wrap: 'bg-[var(--color-stamps)] text-white',
  },
  {
    n: '03',
    title: 'O prêmio',
    body: 'Você define o nome, a descrição e a foto do produto. O cliente vê no app o que vai ganhar na sua loja.',
    Icon: Gift,
    wrap: 'bg-[var(--color-points)] text-white',
  },
  {
    n: '04',
    title: 'Para quem',
    body: 'Toda a base — ou só alto valor, em risco, quase no prêmio ou VIP. A campanha não precisa ser um recado para todo mundo.',
    Icon: Users,
    wrap: 'bg-[var(--color-cashback)] text-white',
  },
];

const levers: Array<{
  title: string;
  body: string;
  Icon: LucideIcon;
  wrap: string;
}> = [
  {
    title: 'Várias ao mesmo tempo',
    body: 'Carimbos no pão, pontos no almoço, cashback no fim de semana e aniversário o ano todo. Cada campanha tem o próprio prêmio, a própria meta e o próprio ritmo.',
    Icon: Layers,
    wrap: 'bg-[var(--color-primary-50)] text-[var(--color-primary-600)]',
  },
  {
    title: 'Só para quem você escolher',
    body: 'Toda a base — ou só alto valor, em risco, quase no prêmio ou VIP. A campanha chega na audiência certa, não como um cupom igual para todo mundo.',
    Icon: Users,
    wrap: 'bg-[var(--color-stamps-bg)] text-[var(--color-stamps)]',
  },
  {
    title: 'O prêmio é da sua loja',
    body: 'Você define o nome, a descrição e a foto do produto. O cliente vê no app o que vai ganhar — o pão de queijo, não um desconto genérico.',
    Icon: ImageIcon,
    wrap: 'bg-[var(--color-points-bg)] text-[var(--color-points)]',
  },
  {
    title: 'Liga, pausa e arquiva',
    body: 'Você deixa em rascunho enquanto acerta os detalhes. Ativa quando o caixa está pronto, pausa na baixa e arquiva sem apagar o histórico.',
    Icon: PauseCircle,
    wrap: 'bg-[var(--color-cashback-bg)] text-[var(--color-cashback)]',
  },
  {
    title: 'Por unidade, se quiser',
    body: 'Uma campanha na Consolação e outra na Vila Mariana. Ou a mesma nas duas. Você decide o alcance.',
    Icon: MapPin,
    wrap: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  },
  {
    title: 'Encaixa no relacionamento',
    body: 'WhatsApp e automações usam a campanha como motivo da mensagem: “faltam 2 carimbos”, “seu cashback está te esperando”.',
    Icon: MessageCircle,
    wrap: 'bg-[var(--color-primary-50)] text-[var(--color-primary-600)]',
  },
];

function TypeMotif({ kind }: { kind: (typeof types)[number]['motif'] }) {
  if (kind === 'stamps') {
    const filled = 7;
    const needed = 10;
    return (
      <div className="mt-5" aria-hidden>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: needed }).map((_, i) => {
            const isGift = i === needed - 1;
            const isFilled = i < filled;
            return (
              <span
                key={i}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                  isFilled
                    ? 'bg-[var(--color-stamps)] text-white'
                    : 'bg-white/80 text-[var(--color-neutral-400)] ring-1 ring-inset ring-[var(--color-stamps)]/30'
                }`}
              >
                {isGift ? (
                  <Gift size={14} strokeWidth={2.4} />
                ) : isFilled ? (
                  <Check size={15} strokeWidth={3} />
                ) : null}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] font-semibold text-[var(--color-stamps)]">
          {filled}/{needed} · faltam {needed - filled}
        </p>
      </div>
    );
  }
  if (kind === 'points') {
    return (
      <div className="mt-5" aria-hidden>
        <div className="h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-inset ring-[var(--color-points-ring)]">
          <div className="h-full w-[68%] rounded-full bg-[var(--color-points)]" />
        </div>
        <p className="mt-1.5 text-[11px] font-semibold text-[var(--color-points)]">
          68 de 100 pontos
        </p>
      </div>
    );
  }
  if (kind === 'cashback') {
    return (
      <div className="mt-5 flex items-center gap-2" aria-hidden>
        <span className="inline-flex items-center rounded-full bg-[var(--color-cashback)] px-2.5 py-1 text-[12px] font-extrabold text-white">
          10%
        </span>
        <span className="text-[13px] font-medium text-[var(--color-cashback)]">
          volta em reais na próxima visita
        </span>
      </div>
    );
  }
  return (
    <div className="mt-5 flex items-center gap-2" aria-hidden>
      <span className="inline-flex items-center rounded-full bg-[var(--color-primary-500)] px-2.5 py-1 text-[12px] font-extrabold text-white">
        + 6 dias
      </span>
      <span className="text-[13px] font-medium text-[var(--color-primary-600)]">
        depois do aniversário
      </span>
    </div>
  );
}

export function LandingCampaigns() {
  return (
    <section
      id="campanhas"
      className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20"
      aria-labelledby="campanhas-heading"
    >
      <Reveal>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
          Relacionamento
        </p>
        <h2
          id="campanhas-heading"
          className="mt-4 max-w-3xl text-[28px] font-extrabold leading-[1.22] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[36px]"
        >
          O motivo da próxima visita, escolhido por você.
        </h2>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
          Uma campanha no Frego não é um cupom solto nem um cartão de papel. É
          o prêmio que faz o cliente atravessar a porta de novo. Você escolhe o
          tipo, a meta, o presente e para quem ela vale. A loja define o
          formato; o Frego cuida do cartão no app e do registro no caixa.
        </p>
      </Reveal>

      <RevealGroup className="mt-10 grid gap-4 sm:grid-cols-2">
        {types.map((t) => (
          <RevealItem key={t.title}>
            <article
              className={`flex h-full flex-col rounded-[18px] border p-5 sm:p-6 ${t.card}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-[12px] ${t.iconWrap}`}
                >
                  <t.Icon size={22} strokeWidth={2.25} aria-hidden />
                </span>
                <span
                  className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${t.kickerClass}`}
                >
                  {t.kicker}
                </span>
              </div>
              <h3 className="mt-4 text-[20px] font-extrabold tracking-[-0.02em] text-[var(--color-ink)]">
                {t.title}
              </h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-[var(--color-neutral-700)]">
                {t.body}
              </p>
              <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
                {t.example}
              </p>
              <TypeMotif kind={t.motif} />
            </article>
          </RevealItem>
        ))}
      </RevealGroup>

      <Reveal className="mt-14">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
          Como você monta
        </p>
        <h3 className="mt-4 max-w-2xl text-[24px] font-extrabold leading-[1.25] tracking-[-0.02em] text-[var(--color-ink)] sm:text-[28px]">
          Quatro decisões. O Frego cuida do resto.
        </h3>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
          Não existe um pacote único de fidelidade. Você combina as peças do
          jeito que a operação aguenta — e ajusta quando o movimento pede.
        </p>
      </Reveal>

      <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {assemble.map((s) => (
          <RevealItem key={s.n}>
            <article className="h-full rounded-[18px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-[12px] ${s.wrap}`}
                >
                  <s.Icon size={20} strokeWidth={2.25} aria-hidden />
                </span>
                <span className="font-mono text-[12px] font-semibold tracking-[0.04em] text-[var(--color-neutral-400)]">
                  {s.n}
                </span>
              </div>
              <h4 className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                {s.title}
              </h4>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
                {s.body}
              </p>
            </article>
          </RevealItem>
        ))}
      </RevealGroup>

      <Reveal className="mt-14">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-500)]">
          Flexibilidade
        </p>
        <h3 className="mt-4 max-w-2xl text-[24px] font-extrabold leading-[1.25] tracking-[-0.02em] text-[var(--color-ink)] sm:text-[28px]">
          Você decide o alcance. O Frego não trava o formato.
        </h3>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-neutral-500)]">
          A campanha é sua: quem participa, em quais unidades vale, quando você
          pausa e como o prêmio aparece. Combine tipos, teste um rascunho,
          escolha uma audiência. O que não muda é a pergunta: isso faz o
          cliente voltar?
        </p>
      </Reveal>

      <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {levers.map((l) => (
          <RevealItem key={l.title}>
            <article className="flex h-full gap-3.5 rounded-[18px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5">
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${l.wrap}`}
              >
                <l.Icon size={20} strokeWidth={2.25} aria-hidden />
              </span>
              <div className="min-w-0">
                <h4 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
                  {l.title}
                </h4>
                <p className="mt-1 text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
                  {l.body}
                </p>
              </div>
            </article>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
