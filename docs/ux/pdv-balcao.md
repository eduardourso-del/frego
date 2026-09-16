# PDV e Balcão — composição da tela

Uso típico: maquininha, tablet no caixa ou notebook no balcão. Uma pessoa atende o cliente com uma mão no aparelho e a outra no caixa da loja. Teclado virtual cobre a metade inferior. O botão da ação **não pode sumir**.

Apps:

- PDV Flutter: `apps/pdv` (tela única após login)
- Balcão web: `apps/web-establishment` rota `/counter`

Os dois compartilham o mesmo mapa mental. Desktop no painel web pode mostrar mais respiro; o fluxo e os rótulos são os mesmos.

## Tarefas (ordem de frequência)

1. Buscar cliente (4 últimos dígitos ou telefone)
2. Registrar carimbo / gasto / cashback
3. Confirmar voucher na entrega do prêmio — valor da compra é **opcional** (retorno da campanha)
4. Desfazer lançamento (secundário)
5. Trocar loja / sair (menu)

## Screen map

```
┌─────────────────────────────────┐
│ Loja · menu (trocar / sair)     │  chrome
├─────────────────────────────────┤
│ Título (Carimbos / Confirmar…)  │
│ Toggle Registrar | Voucher      │  Registrar é o default
│ Toggle Carimbos | Pontos | CB   │  só em Registrar, se >1 campanha
├─────────────────────────────────┤
│ Registrar:                      │
│   Telefone · cliente · valor    │
│   2 vouchers abertos do cliente │
│ Voucher:                        │
│   Código · Escanear QR          │
│   valor opcional                │
├─────────────────────────────────┤
│ [Desfazer]  CTA primário        │  sticky, acima do teclado
└─────────────────────────────────┘
```

Overlays (não empilhar na coluna principal):

| Situação | Superfície |
| --- | --- |
| Vários clientes com os mesmos 4 dígitos | Folha / diálogo com tiles grandes |
| Mais de 2 vouchers abertos | Folha com lista completa + Confirmar em cada linha |
| Mais de 3 lançamentos | Folha com histórico do cliente neste turno |
| Escanear QR (PDV e web mobile, com câmera) | Folha com viewfinder; preenche o Código; **Usar** continua o sticky |
| Desfazer | Diálogo de confirmação (já existente) |

## Hierarquia visual

1. **Identidade do cliente** (nome + telefone) quando houver lookup.
2. **Campo ativo** (telefone, valor ou voucher) — 28px, centralizado, alvo ≥ 48px.
3. **CTA sticky** — uma ação, 52px de altura, largura total.
4. Saldos (carimbos / pontos / cashback) — leitura, não ação.
5. Voucher só no modo Voucher (não no fluxo de lançar).

Textos longos de onboarding saem da tela de caixa. Uma linha basta.

## StickyActionBar — regras

Uma ação primária por vez. O rótulo segue **estado + foco**. Sem foco, usa o default do estado.

| Estado | Foco | Rótulo | Ação |
| --- | --- | --- | --- |
| Registrar, sem lookup | Telefone / nenhum | Buscar | Lookup 4 dígitos ou telefone |
| Registrar, não encontrado | Telefone completo / nenhum | Buscar / criar… | Lookup global ou cadastro + earn |
| Registrar, vários matches | Qualquer | Buscar | Nova busca; escolha é na folha |
| Registrar, cliente encontrado | Valor, cashback, nenhum | Carimbar / Registrar… | Earn (ou adicionar à loja) |
| Voucher | Código / valor / nenhum | Usar | Fulfill código |
| Voucher, expirado | Qualquer | Aceitar mesmo assim | Fulfill com `acceptExpired` |

Desfazer: se houver `_lastSale`, chip **Desfazer** à esquerda do CTA. Nunca substitui o primário.

Teclado: a barra sobe com o inset (`resizeToAvoidBottomInset` no PDV; `visualViewport` / sticky acima da tab bar no web). Alvo mínimo 44×44, botão primário 52px.

Web mobile: a barra fica **acima** das tabs do `AppShell` (~5.5rem + safe area). Desktop (`md+`): 24px da base da viewport.

## Campos e teclado

- Telefone: `numeric`, submit = Buscar.
- Valor: `numeric` com máscara BRL, submit = earn. No voucher, o mesmo campo é opcional e não bloqueia **Usar**.
- Voucher: caracteres, máscara `XXX-XXX`, submit = Usar. Envia `amountCents` se o valor (do voucher ou do lançamento) estiver preenchido. **Escanear QR** (secundário, modo Voucher) preenche o mesmo campo e limpa o valor leftover; não Confirma. Desktop web (`md+`) não mostra o controle.
- Com campo focado, o sticky mostra **só** a ação daquele campo.

## PDV vs web

| | PDV | Balcão web |
| --- | --- | --- |
| Navegação | Sem tabs; caixa é a home | Tabs do painel; Balcão no centro no mobile |
| Largura | Full bleed maquininha | `max-w-lg` no mobile; no desktop o mesmo bloco centrado (não vira dashboard) |
| Undo | Mesma barra sticky | Mesma barra; toast sobe para não cobrir o CTA |

## O que não entra nesta tela

Campanhas, relatórios, lista completa de clientes, configurações. No PDV isso não existe. No web, está nas outras rotas.
