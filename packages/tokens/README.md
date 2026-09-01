# @frego/tokens · frego_tokens

Design system do Frego. **Uma pasta para atualizar a marca em todos os produtos.**

Origem: `frego-guia-de-estilos` (Rampa · Estúdio de marca, ago/2026, provisório).

## Como atualizar

1. Troque valores em `tokens.json` e `css/tokens.css` (mantenha os nomes).
2. Espelhe as cores em `src/index.ts` e `lib/src/tokens.dart`.
3. Substitua arquivos em `assets/` **mantendo os nomes**.
4. `pnpm --filter @frego/tokens sync-brand` copia os assets para os apps web.
5. Apps Flutter leem os SVG direto deste pacote (`packages/frego_tokens/assets/...`).

Web (establishment, admin, landing) importa `@frego/tokens/css`.
Flutter (mobile, PDV) depende de `frego_tokens` via path.

## Regras que não voltam atrás

Grade de 8 · contraste AA · numeral tabular · alvo de toque 44 px · foco visível.
Âmbar = pontos. Teal = selos. Texto sobre a primária usa `--color-on-primary`.
