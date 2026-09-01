# Frego — guia de estilos provisório

Agosto de 2026 · versão 1
Construído pela **Rampa · Estúdio de marca** · cortesia dentro do projeto de marca.

---

## Comece por aqui

Abra **`guia-de-estilos.html`** em qualquer navegador. É o documento principal: traz a regra e o valor pronto para aplicar em oito seções — assinatura, ícone, cor, tipografia, espaço e forma, componentes, aplicação e arquivos.

Para gerar o PDF: com o guia aberto, **Cmd/Ctrl + P → Salvar como PDF**.

> O guia lê `tokens/tokens.css` para se compor. Mantenha a pasta inteira junto — se separar o HTML dos tokens, o documento perde a formatação.

---

## O que tem em cada pasta

```
entrega/
├── guia-de-estilos.html      ← o documento. comece por ele
├── LEIA-ME.md                ← este arquivo
├── tokens/
│   ├── tokens.css            ← cor, tipografia, espaço e forma em custom properties
│   └── tokens.json           ← os mesmos valores, para consumo no app
└── assets/
    ├── frego-assinatura.svg               ← positiva (fundo claro)
    ├── frego-assinatura-negativa.svg      ← fundo escuro
    ├── frego-assinatura-mono-escura.svg   ← uma cor só, sobre claro
    ├── frego-assinatura-mono-clara.svg    ← uma cor só, sobre escuro
    ├── frego-icone-loja.svg               ← quadrado, para as lojas de app
    ├── frego-icone-arredondado.svg        ← favicon, avatar, web
    ├── frego-icone-negativo.svg           ← sobre fundo escuro
    └── png/                               ← os mesmos assets rasterizados
```

---

## Por perfil

### Quem programa

O `tokens/tokens.css` foi escrito para **substituir o `:root` que já existe** no projeto. Os nomes de token foram mantidos, então a aplicação é troca de valor, não refatoração. Tokens novos estão marcados no arquivo com `NOVO`.

Quatro deles resolvem problemas que a base atual tem hoje:

| Token | Para quê |
|---|---|
| `--color-control` | Contorno de campo e de botão de borda. O separador atual mede 1,07:1 — invisível, e reprova o mínimo de 3:1 para controle. |
| `--color-on-primary` | Texto sobre a primária. Inverte no tema escuro; branco fixo reprova lá. |
| `--color-info` | Substitui `--color-warning`. Âmbar passa a ser exclusivo de pontos. |
| `--radius-pill` | Pílula de pontos e selos. |

O arquivo também traz três regras que não são token: numeral tabular em `.num`, foco visível em tudo que recebe teclado, e respeito a `prefers-reduced-motion`.

**Fonte:** Archivo, do Google Fonts. Em web:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap" rel="stylesheet">
```

Só três pesos: 400, 600 e 800. A pilha alternativa já está em `--font-sans` — se a fonte não carregar, o layout não quebra.

### Quem faz material de venda

Instale o Archivo de graça em `fonts.google.com/specimen/Archivo`. Use os PNG de `assets/png/` — a assinatura vem em 1200, 600 e 300 px, com fundo transparente, em versão para fundo claro e para fundo escuro.

Respiro mínimo em volta da assinatura: **11% da largura dela**, nos quatro lados. Tamanho mínimo: **72 px em tela, 18 mm impresso**.

### Quem publica

| Arquivo | Onde |
|---|---|
| `frego-icone-1024.png` | App Store e Play Store |
| `frego-icone-512.png` · `192.png` | Play Store, launcher Android |
| `frego-icone-180.png` | iOS, tela inicial |
| `frego-favicon-32.png` · `16.png` | navegador |
| `frego-avatar-400.png` | redes sociais |
| `frego-compartilhamento-1200x630.png` | preview de link no WhatsApp e LinkedIn |

O ícone de loja é **quadrado, sem cantos arredondados** — iOS e Android aplicam a máscara do sistema, e canto arredondado no arquivo vira borda dupla.

---

## Este guia é provisório

Ele existe para destravar prospecção e material de rodada **antes** de a marca do Frego ser construída. Nada aqui vem de pesquisa, e nada aqui decide posicionamento, categoria ou nome — isso é o projeto de marca.

Quando a marca definitiva chegar, o custo de troca é baixo de propósito:

- **Cor** — trocar valores em `tokens.css`. Nenhuma tela precisa ser refeita, porque nada usa hex solto.
- **Tipografia** — trocar a família em `--font-sans`.
- **Assinatura e ícone** — substituir os arquivos em `assets/`, mantendo os nomes.

O que não volta atrás: grade de 8, contraste conferido, numeral tabular, alvo de toque de 44 px e foco visível. Isso não é estilo — é o que faz o produto funcionar, e continua valendo com qualquer marca em cima.

---

## Créditos e direitos

Documento, sistema de tokens e construção da assinatura desenvolvidos por
**Rampa · Estúdio de marca** — [rampabr.com](https://rampabr.com).

A autoria deste material é da Rampa. Obra protegida pela Lei 9.610/98; os direitos morais de autoria são inalienáveis (art. 24), então a atribuição deve ser preservada em cópias, adaptações e derivações — inclusive em versões futuras que partam daqui.

Os ativos de marca documentados neste guia — assinatura, ícone e paleta — foram construídos para o Frego e são de uso do Frego. O crédito marca quem construiu; não restringe o uso.

---

## Licenças

**Archivo** — Copyright 2020 The Archivo Project Authors · SIL Open Font License 1.1. Livre para uso comercial, em web, app e impresso, inclusive vetorizada dentro da assinatura, como foi feito aqui. Os SVG entregues são vetores fechados: não dependem da fonte estar instalada.

---

Dúvida em qualquer ponto: eduardo@rampabr.com · renata@rampabr.com
