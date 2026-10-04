# @frego/tokens · frego_tokens

Design system do Frego. **Uma pasta para atualizar a marca em todos os produtos.**

Origem: `guia-aplicacao-digital` (Rampa · Estúdio de marca, outubro de 2026).

Papel `#F4EFE6`, Grafite `#070707`, Mostarda `#FFD900`, Céu Azul `#0073C8`.
Instrument Sans na interface, Source Serif 4 no título editorial, Source Code Pro na referência técnica.
Mostarda preenche a ação e leva texto em Grafite. O app do freguês enquadra em Céu Azul; PDV, landing e painel enquadram em Grafite.

## Como atualizar

1. Troque valores em `tokens.json` e `css/tokens.css` (mantenha os nomes de interface).
2. Espelhe as cores em `src/index.ts` e `lib/src/tokens.dart`.
3. Substitua arquivos em `assets/` **mantendo os nomes** que os apps já importam.
4. `pnpm --filter @frego/tokens sync-brand` copia os assets para os apps web.
5. Apps Flutter leem os SVG direto deste pacote (`packages/frego_tokens/assets/...`).

Web (establishment, admin, landing) importa `@frego/tokens/css`.
Flutter (mobile, PDV) depende de `frego_tokens` via path.

## Regras

Mostarda não é cor de texto sobre Papel. Contraste AA. Numeral tabular. Alvo de toque 44 px. Foco em Grafite.
Pontos, selos, cashback e promoção têm cores auxiliares e não ampliam a paleta oficial.
A cor da loja fica na marca da loja e não pinta o cromado da Frego.
