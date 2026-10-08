'use client';

import Link from 'next/link';
import {
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  ArrowUpRight,
  Banknote,
  BarChart3,
  Cake,
  Clock,
  Coins,
  Crown,
  Gift,
  Heart,
  Layers,
  LayoutDashboard,
  Percent,
  Route,
  Settings,
  Stamp,
  Target,
  TrendingUp,
  UserMinus,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

const SECTIONS: Array<{ id: string; label: string; icon: Icon }> = [
  { id: 'caminho', label: 'O caminho', icon: Route },
  { id: 'painel', label: 'Painel', icon: LayoutDashboard },
  { id: 'campanhas', label: 'Campanhas', icon: Target },
  { id: 'audiencias', label: 'Audiências', icon: Layers },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  { id: 'balcao', label: 'Balcão', icon: Stamp },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
];

const STEPS: Array<{ title: string; body: ReactNode }> = [
  {
    title: 'Telefone',
    body: 'O cliente entra no app com o telefone. Esse número é a conta dele.',
  },
  {
    title: 'Balcão',
    body: (
      <>
        No <TextLink href="/counter">Balcão</TextLink>, a equipe busca o
        cliente pelos quatro últimos dígitos ou pelo telefone e registra a
        visita.
      </>
    ),
  },
  {
    title: 'Campanha',
    body: (
      <>
        A <TextLink href="/campaigns">campanha</TextLink> diz o que o
        estabelecimento oferece e quando o cliente tem direito ao prêmio.
      </>
    ),
  },
  {
    title: 'Audiência',
    body: (
      <>
        Sem audiência, a campanha vale para todo o estabelecimento. Com{' '}
        <TextLink href="/audiences">audiência</TextLink>, vale só para esse
        grupo.
      </>
    ),
  },
  {
    title: 'Voucher',
    body: (
      <>
        Quando o cliente tem direito, ele resgata no app. O app gera um
        voucher com o código{' '}
        <strong className="font-semibold text-[var(--color-ink)]">XXX-XXX</strong>.
        A equipe confirma no caixa e entrega o prêmio.
      </>
    ),
  },
];

export function GuideView() {
  const [active, setActive] = useState(SECTIONS[0]!.id);

  useEffect(() => {
    const id = window.location.hash.replace('#', '');
    if (!SECTIONS.some((section) => section.id === id)) return;
    setActive(id);
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const nodes = SECTIONS.map((section) =>
      document.getElementById(section.id),
    ).filter((node): node is HTMLElement => node != null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target.id;
        if (id) setActive(id);
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <AppShell title="Guia" skipPendingGate>
      <div className="mx-auto max-w-5xl px-4 py-5 md:px-7 md:py-8">
        <header>
          <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
            Guia do estabelecimento
          </p>
          <h1 className="mt-2 max-w-xl text-[32px] font-extrabold tracking-[-0.03em] text-[var(--color-ink)]">
            Como funciona
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--color-neutral-500)] md:text-[16px]">
            O telefone é a conta do cliente. A equipe registra a visita no
            balcão. A campanha define o prêmio. A audiência escolhe para quem
            ela vale. O painel mostra o que aconteceu.
          </p>
        </header>

        <nav
          aria-label="Neste guia"
          className="sticky top-0 z-20 -mx-4 mt-6 border-b border-[var(--color-hairline)] bg-[var(--color-bg)]/95 px-4 py-2.5 backdrop-blur-md md:-mx-7 md:px-7"
        >
          <ul className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = active === section.id;
              return (
                <li key={section.id} className="shrink-0">
                  <a
                    href={`#${section.id}`}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      setActive(section.id);
                      document
                        .getElementById(section.id)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      history.replaceState(null, '', `#${section.id}`);
                    }}
                    className={`flex min-h-9 items-center gap-2 rounded-full px-3 text-[13px] transition-colors ${
                      isActive
                        ? 'bg-[var(--color-primary-500)] font-semibold text-[var(--color-on-primary)]'
                        : 'bg-[var(--color-card)] font-medium text-[var(--color-neutral-600)] ring-1 ring-[var(--color-hairline)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    <Icon
                      size={15}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      aria-hidden
                    />
                    {section.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-5 flex flex-col gap-4 pb-8">
            <Screen
              id="caminho"
              icon={Route}
              title="O caminho"
              lede="Do telefone do cliente até o prêmio no caixa."
            >
              <ol className="flex flex-col">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[12px] font-semibold text-white">
                        {index + 1}
                      </span>
                      {index < STEPS.length - 1 ? (
                        <span
                          className="my-1 w-px flex-1 bg-[var(--color-hairline)]"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div className={index < STEPS.length - 1 ? 'pb-5' : ''}>
                      <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-[14px] leading-relaxed text-[var(--color-neutral-600)]">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Callout title="Resgatar">
                  O cliente gera o voucher no app.
                </Callout>
                <Callout title="Confirmar">
                  A equipe marca, no balcão, que o prêmio foi entregue.
                </Callout>
              </div>
            </Screen>

            <Screen
              id="painel"
              icon={LayoutDashboard}
              title="Painel"
              href="/dashboard"
              lede="Hoje, 7 dias, 30 dias ou um intervalo que você escolhe. O percentual ao lado de cada número compara com o período anterior, da mesma duração. “Sem comparação” aparece quando ainda não dá para comparar."
            >
              <Block title="O que fazer agora">
                <p>
                  No topo, o Frego sugere até quatro ações com base no
                  movimento do estabelecimento. Cada aviso abre uma campanha já
                  preenchida para aquele grupo.
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Signal icon={UserMinus} tone="danger">
                    Clientes sem visita há 30 dias ou mais.
                  </Signal>
                  <Signal icon={Crown} tone="danger">
                    VIPs sem visita há 30 dias ou mais.
                  </Signal>
                  <Signal icon={Gift} tone="primary">
                    Clientes a um passo do prêmio.
                  </Signal>
                  <Signal icon={TrendingUp} tone="success">
                    Quem mais gastou nos últimos 90 dias.
                  </Signal>
                  <Signal icon={Clock} tone="intel">
                    O dia ou o horário em que o movimento cai.
                  </Signal>
                  <Signal icon={Heart} tone="intel">
                    Quem voltou mais de uma vez nos últimos 90 dias.
                  </Signal>
                </ul>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
                  Se o estabelecimento ainda não tem visitas, o Frego avisa que está
                  conhecendo o movimento. Cada lançamento no balcão passa a
                  contar nesses avisos.
                </p>
              </Block>

              <Block title="Quem veio">
                <Defs
                  items={[
                    ['Clientes ativos', 'Pessoas com visita neste período.'],
                    ['Novos clientes', 'Primeira visita no estabelecimento neste período.'],
                    [
                      'Taxa de retorno',
                      'Clientes que vieram duas vezes ou mais neste período. O valor em reais fica em Retorno das campanhas, mais abaixo.',
                    ],
                    ['Visitas / cliente', 'A média de visitas no período.'],
                    ['Resgates', 'Vezes que o cliente gerou um voucher no app.'],
                    [
                      'Carimbos, pontos e gasto',
                      'Cada um só aparece se o estabelecimento tiver campanha desse tipo. Gasto registrado é o valor lançado no balcão no programa de pontos.',
                    ],
                  ]}
                />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Callout title="Visitas nesta semana">
                    Os últimos 7 dias, até hoje.
                  </Callout>
                  <Callout title="Funil de fidelidade">
                    Mostra a base de clientes, quem esteve ativo, quem voltou
                    (2 visitas ou mais) e quem resgatou um prêmio. Embaixo, os
                    inativos: quem está na base e não visitou neste período.
                  </Callout>
                </div>
              </Block>

              <Block title="Campanhas no painel">
                <p>
                  A seção mostra só as campanhas ativas, no mesmo período
                  escolhido no topo.
                </p>
                <Defs
                  items={[
                    [
                      'Retorno das campanhas',
                      'Vendas registradas quando o caixa confirma o voucher e quando o cashback é usado.',
                    ],
                    [
                      'Resgates',
                      'Vouchers gerados no app, mais os usos de cashback no caixa.',
                    ],
                    [
                      'Confirmados',
                      'A parte dos vouchers do período que o caixa já confirmou.',
                    ],
                    [
                      'À espera',
                      'Vouchers que o cliente já resgatou e o caixa ainda não confirmou. Se não houver voucher aberto, o número muda para “Sem movimento” e conta campanhas ativas sem resgate no período.',
                    ],
                  ]}
                />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Callout title="Em destaque">
                    A campanha com mais resgates no período.
                  </Callout>
                  <Callout title="Precisa de atenção">
                    Voucher parado no caixa, poucos confirmados, ou campanha sem
                    resgate.
                  </Callout>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
                  O gráfico ao lado compara resgates, pessoas e retorno.
                  “Pessoas” é a quantidade de clientes. O mesmo cliente pode
                  resgatar mais de uma vez.
                </p>
              </Block>

              <Block title="Pessoas">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Callout title="Mais valiosos">
                    Quem mais visita, gasta e resgata no período. A etiqueta
                    VIP aparece em três casos: a marca VIP na ficha, um resgate
                    no período, ou quatro visitas ou mais. Recorrente é quem já
                    voltou e não entrou em VIP. Novo é a primeira visita, com
                    pouco saldo lançado.
                  </Callout>
                  <Callout title="Ao vivo">
                    As últimas movimentações do balcão, lançamento ou
                    confirmação, com a unidade e há quanto tempo.
                  </Callout>
                </div>
              </Block>
            </Screen>

            <Screen
              id="campanhas"
              icon={Target}
              title="Campanhas"
              href="/campaigns"
              lede="Três escolhas: o tipo, o prêmio e para quem. O cartão ao lado do formulário mostra como o cliente vê no app. “Ativar agora” mostra a campanha no app. Desligar esconde a campanha, e ela fica inativa. A lista filtra por ativas e inativas, por tipo e por audiência."
            >
              <div className="flex flex-col gap-3">
                <TypeCard
                  icon={Stamp}
                  title="Carimbos"
                  fill="var(--color-stamps)"
                  bg="var(--color-stamps-bg)"
                >
                  <p>
                    Cada visita no balcão vale 1 carimbo. A campanha define
                    quantos carimbos o cliente junta para ganhar o prêmio.
                  </p>
                  <p>
                    <strong>Cartela própria</strong> guarda os carimbos desta
                    campanha só para o prêmio dela. Sem cartela, os carimbos
                    entram no saldo compartilhado do estabelecimento e valem para qualquer
                    campanha de carimbos que também use esse saldo. Depois da
                    primeira ativação, essa escolha não muda mais.
                  </p>
                  <p>
                    Dá para limitar quantas vezes o mesmo cliente resgata:
                    nesta campanha, por dia, por semana, por mês ou por ano. Os
                    carimbos continuam no saldo. O limite só impede o próximo
                    resgate.
                  </p>
                </TypeCard>
                <TypeCard
                  icon={Coins}
                  title="Pontos"
                  fill="var(--color-points)"
                  bg="var(--color-points-bg)"
                >
                  <p>
                    O cliente acumula pela compra. A campanha define quantos
                    pontos ele junta para ganhar o prêmio. A taxa — quanto o
                    cliente gasta para ganhar 1 ponto — fica em{' '}
                    <TextLink href="/settings">Configurações</TextLink>, na
                    seção Fidelidade, e vale para o estabelecimento todo.
                  </p>
                </TypeCard>
                <TypeCard
                  icon={Cake}
                  title="Aniversário"
                  fill="var(--color-primary-500)"
                  bg="var(--color-primary-50)"
                  onFill="var(--color-grafite)"
                >
                  <p>
                    Um presente por ano, na data de aniversário que o cliente
                    informou no app. O prêmio é obrigatório.
                  </p>
                </TypeCard>
                <TypeCard
                  icon={Banknote}
                  title="Cashback"
                  fill="var(--color-cashback)"
                  bg="var(--color-cashback-bg)"
                >
                  <p>
                    Um percentual da compra volta em reais e o cliente usa no
                    caixa. A porcentagem fica na campanha. O teto por compra, a
                    compra mínima e a validade do saldo ficam em Configurações.
                  </p>
                </TypeCard>
                <TypeCard
                  icon={Percent}
                  title="Promoção"
                  fill="var(--color-promo)"
                  bg="var(--color-promo-bg)"
                >
                  <p>
                    O prêmio não depende de carimbos nem de pontos. Ele depende
                    do calendário do estabelecimento e de um limite de resgates. Você
                    define início, fim e os dias da semana. Se nenhum dia
                    estiver marcado, vale a semana inteira. O limite padrão é
                    uma vez nesta
                    campanha. Dá para trocar por dia, semana, mês ou ano.
                  </p>
                  <p>
                    Uma promoção também pode ter audiência. O cliente resgata
                    no app, recebe o código e a equipe confirma no balcão.
                  </p>
                </TypeCard>
              </div>
              <Callout title="Nome, foto e audiência" className="mt-3">
                “O cliente ganha” é o texto do prêmio. “Nome no app” é o
                título do cartão. A foto é opcional. Sem audiência escolhida, a
                campanha vale para todos os clientes. Com audiência, ela vale
                só para quem estiver nesse grupo na hora do resgate.
              </Callout>
            </Screen>

            <Screen
              id="audiencias"
              icon={Layers}
              title="Audiências"
              href="/audiences"
              lede="Um grupo de clientes do estabelecimento. Serve para filtrar a lista de clientes e para limitar uma campanha. Quem administra o estabelecimento cria e exclui. A equipe do balcão só consulta."
            >
              <Block title="Prontas">
                <p>
                  As quatro audiências do topo já vêm contadas. O número é
                  quantos clientes entram hoje. Dá para abrir a lista ou criar
                  uma campanha para esse grupo.
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  <AudienceCard
                    title="Alto valor"
                    tone="success"
                    body="Gastaram R$ 300 ou mais nos últimos 90 dias."
                  />
                  <AudienceCard
                    title="Em risco"
                    tone="danger"
                    body="Gastaram R$ 200 ou mais nos últimos 180 dias e estão sem visita há 30 dias ou mais."
                  />
                  <AudienceCard
                    title="Quase prêmio"
                    tone="primary"
                    body="Chegaram a 80% ou mais da campanha principal."
                  />
                  <AudienceCard
                    title="VIP"
                    tone="ink"
                    body="Marcados manualmente como VIP na ficha do cliente."
                  />
                </ul>
                <p className="mt-4 text-[13px] font-semibold text-[var(--color-ink)]">
                  Faixas de gasto, últimos 90 dias
                </p>
                <ul className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {['Até R$ 100', 'R$ 100–300', 'R$ 300–800', 'R$ 800 ou mais'].map(
                    (tier) => (
                      <li
                        key={tier}
                        className="rounded-[12px] bg-[var(--color-bg)] px-3 py-2.5 text-[13px] font-semibold text-[var(--color-ink)]"
                      >
                        {tier}
                      </li>
                    ),
                  )}
                </ul>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-neutral-500)]">
                  Cada faixa abre a lista de clientes.
                </p>
              </Block>

              <Block title="Salvas">
                <p>Uma audiência salva tem nome e regras. As regras combinam:</p>
                <Defs
                  items={[
                    ['Gasto', 'Mínimo e máximo, num período de dias.'],
                    ['Sem visita', 'Quantos dias o cliente está sem aparecer.'],
                    [
                      'Etiquetas',
                      'Em “Qualquer”, entra quem tem pelo menos uma das etiquetas. Em “Todas”, só quem tem todas.',
                    ],
                  ]}
                />
                <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-neutral-600)]">
                  “Ver quantos” mostra quantos clientes entram, antes de
                  salvar. O selo no app, se estiver ligado, mostra um título e
                  uma mensagem para quem está na audiência.
                </p>
                <div className="mt-3 rounded-[14px] bg-[var(--color-danger-bg)] px-4 py-3 text-[13px] leading-relaxed text-[var(--color-danger)]">
                  Se você excluir uma audiência, as campanhas que a usavam
                  passam a valer para todo o estabelecimento.
                </div>
              </Block>
            </Screen>

            <Screen
              id="clientes"
              icon={Users}
              title="Clientes"
              href="/customers"
              lede="A base de clientes do estabelecimento. A busca usa nome ou telefone."
            >
              <p className="text-[13px] font-semibold text-[var(--color-ink)]">
                Atalhos
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {[
                  ['Todos', 'A base inteira'],
                  ['VIP', 'Marcados na ficha'],
                  ['Sumidos', 'Sem visita há 30 dias ou mais'],
                  ['Quase prêmio', 'Perto de ganhar o prêmio'],
                ].map(([label, hint]) => (
                  <li
                    key={label}
                    className="rounded-full bg-[var(--color-bg)] px-3 py-1.5"
                  >
                    <span className="text-[13px] font-semibold text-[var(--color-ink)]">
                      {label}
                    </span>
                    <span className="ml-1.5 text-[12px] text-[var(--color-neutral-500)]">
                      {hint}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[14px] leading-relaxed text-[var(--color-neutral-600)]">
                Cada ficha mostra visitas, saldo, etiquetas e o histórico. VIP
                e etiquetas são marcas do estabelecimento: entram na regra da audiência e
                no filtro da lista. Ao abrir uma audiência, você chega nesta
                mesma lista, já filtrada.
              </p>
            </Screen>

            <Screen
              id="relatorios"
              icon={BarChart3}
              title="Relatórios"
              href="/reports"
              lede="Períodos mais longos: 7, 30 ou 90 dias, ou um intervalo que você escolhe. Exportar CSV baixa a planilha do período. Os números do topo repetem os do painel, e trazem dois a mais."
            >
              <Defs
                items={[
                  [
                    'Inativos',
                    '30 dias ou mais sem visita. Prontos para uma campanha de volta.',
                  ],
                  [
                    'Gasto no programa',
                    'Valor lançado no balcão no período.',
                  ],
                ]}
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Callout title="Atividade">
                  Carimbos, pontos e resgates por dia, semana ou mês.
                </Callout>
                <Callout title="Retenção por mês de cadastro">
                  De quem entrou naquele mês, quantos voltaram depois.
                </Callout>
                <Callout title="Ranking de unidades">
                  Divide as visitas entre os endereços do estabelecimento.
                </Callout>
                <Callout title="Ranking da equipe">
                  Lançamentos e confirmações de cada pessoa no período.
                </Callout>
              </div>
              <Block title="Desempenho das campanhas">
                <p>Para cada campanha com atividade no período:</p>
                <Defs
                  items={[
                    [
                      'Resgates',
                      'Ao lado, quantas pessoas resgataram, entre as que podiam.',
                    ],
                    [
                      'Engajamento',
                      'Entre quem podia resgatar, quantos resgataram.',
                    ],
                    ['Confirmados', 'Vouchers que o caixa já entregou.'],
                    [
                      'Receita no resgate',
                      'Vendas registradas na confirmação do voucher ou no uso do cashback. Se alguma confirmação veio sem valor, aparece quantas tinham o valor preenchido, por exemplo “3 de 5 com valor”.',
                    ],
                  ]}
                />
              </Block>
            </Screen>

            <Screen
              id="balcao"
              icon={Stamp}
              title="Balcão"
              href="/counter"
              lede="A tela do caixa. O mesmo fluxo existe no app de PDV."
            >
              <ol className="grid gap-3 sm:grid-cols-2">
                <li className="rounded-[14px] bg-[var(--color-bg)] p-4">
                  <p className="font-mono text-[12px] font-semibold tracking-[0.04em] text-[var(--color-neutral-400)]">
                    01
                  </p>
                  <h3 className="mt-2 text-[15px] font-semibold text-[var(--color-ink)]">
                    Registrar
                  </h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--color-neutral-600)]">
                    Buscar o cliente e lançar carimbo, pontos ou cashback,
                    conforme as campanhas ativas. O valor da compra é pedido
                    quando a campanha precisa dele.
                  </p>
                </li>
                <li className="rounded-[14px] bg-[var(--color-bg)] p-4">
                  <p className="font-mono text-[12px] font-semibold tracking-[0.04em] text-[var(--color-neutral-400)]">
                    02
                  </p>
                  <h3 className="mt-2 text-[15px] font-semibold text-[var(--color-ink)]">
                    Voucher
                  </h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--color-neutral-600)]">
                    Digitar ou escanear o código e confirmar a entrega. O valor
                    da compra nesse momento é opcional e entra no retorno da
                    campanha.
                  </p>
                </li>
              </ol>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-neutral-600)]">
                Desfazer cancela o último lançamento. Campanhas,
                relatórios e a lista completa de clientes ficam nas outras
                telas.
              </p>
            </Screen>

            <Screen
              id="configuracoes"
              icon={Settings}
              title="Configurações"
              href="/settings"
              lede="O que vale para o estabelecimento inteiro, e não só para uma campanha."
            >
              <ul className="grid gap-3 sm:grid-cols-2">
                <Setting
                  title="Nome, marca, capa e onde encontrar"
                  body="Nome, cores, logo e endereço que o cliente vê."
                />
                <Setting
                  title="Página pública"
                  body="O link público do estabelecimento, no endereço /loja/…, com as campanhas ativas."
                />
                <Setting
                  title="Fidelidade"
                  body="Reais para 1 ponto; teto e compra mínima do cashback; em quantos dias carimbos, pontos e cashback expiram depois do ganho. No resgate, o saldo mais antigo sai primeiro."
                />
                <Setting
                  title="WhatsApp"
                  body="Conecta o WhatsApp do estabelecimento. As mensagens de visita, de boas-vindas e de campanha saem depois que o texto é aprovado."
                />
              </ul>
            </Screen>
        </div>
      </div>
    </AppShell>
  );
}

function Screen({
  id,
  icon: Icon,
  title,
  lede,
  href,
  children,
}: {
  id: string;
  icon: Icon;
  title: string;
  lede: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-16 rounded-[20px] border border-[var(--color-hairline)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)] md:p-6 lg:scroll-mt-6"
    >
      <header>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-bg)] text-[var(--color-ink)]">
              <Icon size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--color-ink)]">
              {title}
            </h2>
          </div>
          {href ? (
            <Link
              href={href}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[10px] bg-[var(--color-bg)] px-2.5 text-[13px] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-primary-50)]"
            >
              Abrir
              <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden />
            </Link>
          ) : null}
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-neutral-500)]">
          {lede}
        </p>
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--color-neutral-400)]">
        {title}
      </h3>
      <div className="mt-2 text-[14px] leading-relaxed text-[var(--color-neutral-600)]">
        {children}
      </div>
    </div>
  );
}

function Defs({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="mt-3 overflow-hidden rounded-[14px] bg-[var(--color-bg)]">
      {items.map(([term, body]) => (
        <div
          key={term}
          className="grid gap-0.5 border-b border-[var(--color-hairline)] px-3.5 py-3 last:border-0 sm:grid-cols-[11.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-4"
        >
          <dt className="text-[13px] font-semibold text-[var(--color-ink)]">
            {term}
          </dt>
          <dd className="text-[13px] leading-relaxed text-[var(--color-neutral-600)]">
            {body}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Callout({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[14px] bg-[var(--color-bg)] px-3.5 py-3 ${className}`}>
      <p className="text-[13px] font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-neutral-600)]">
        {children}
      </p>
    </div>
  );
}

function Signal({
  icon: Icon,
  tone,
  children,
}: {
  icon: Icon;
  tone: 'danger' | 'success' | 'primary' | 'intel';
  children: ReactNode;
}) {
  const tones = {
    danger: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
    success: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    primary: 'bg-[var(--color-primary-50)] text-[var(--color-primary-600)]',
    intel: 'bg-[var(--color-intel-bg)] text-[var(--color-intel)]',
  } as const;
  return (
    <li className="flex items-start gap-2.5 rounded-[12px] bg-[var(--color-bg)] px-3 py-2.5">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] ${tones[tone]}`}
      >
        <Icon size={13} strokeWidth={2.25} aria-hidden />
      </span>
      <span className="text-[13px] leading-snug text-[var(--color-neutral-700)]">
        {children}
      </span>
    </li>
  );
}

function TypeCard({
  icon: Icon,
  title,
  fill,
  bg,
  onFill = '#fff',
  className = '',
  children,
}: {
  icon: Icon;
  title: string;
  fill: string;
  bg: string;
  onFill?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article
      className={`rounded-[14px] border border-[var(--color-hairline)] p-4 ${className}`}
      style={{ background: bg }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-[10px]"
          style={{ background: fill, color: onFill }}
        >
          <Icon size={16} strokeWidth={2.25} aria-hidden />
        </span>
        <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
          {title}
        </h3>
      </div>
      <div className="mt-2.5 space-y-2 text-[13px] leading-relaxed text-[var(--color-neutral-700)] [&_strong]:font-semibold [&_strong]:text-[var(--color-ink)]">
        {children}
      </div>
    </article>
  );
}

function AudienceCard({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: 'success' | 'danger' | 'primary' | 'ink';
}) {
  const tones = {
    success: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    danger: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
    primary: 'bg-[var(--color-primary-50)] text-[var(--color-primary-600)]',
    ink: 'bg-[var(--color-ink)] text-white',
  } as const;
  const bodyTone =
    tone === 'ink' ? 'text-white/75' : 'text-[var(--color-neutral-600)]';
  return (
    <li className={`rounded-[14px] px-3.5 py-3 ${tones[tone]}`}>
      <p className="text-[14px] font-semibold">{title}</p>
      <p className={`mt-1 text-[12px] leading-snug ${bodyTone}`}>{body}</p>
    </li>
  );
}

function Setting({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded-[14px] bg-[var(--color-bg)] px-3.5 py-3">
      <p className="text-[14px] font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-neutral-600)]">
        {body}
      </p>
    </li>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-semibold text-[var(--color-primary-600)] underline decoration-[var(--color-primary-200)] underline-offset-2 hover:decoration-[var(--color-primary-500)]"
    >
      {children}
    </Link>
  );
}
