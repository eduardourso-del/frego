# WhatsApp da loja: o Frego pode bloquear o número?

**Para:** time (produto, CS, vendas, engenharia)  
**Contexto:** em entrevistas, donos de estabelecimento disseram que têm receio de conectar o número do WhatsApp Business no Frego, porque “a Meta bloqueia a conta quando manda notificação demais”.

**Resposta curta:** o medo é real no mercado, mas descreve **outro tipo de integração**. O Frego usa a API oficial da Meta (Cloud API). Não é o mesmo risco das ferramentas de disparo em massa. Ainda assim, as mensagens saem **do número da loja**, e a Meta pode **limitar ou restringir** esse número se a qualidade cair. O envio que mais se parece com o medo deles é o **aviso de Campanha** para a Audience — não o recado do balcão.

---

## O que os donos costumam ter visto

No Brasil, “a Meta bloqueou meu WhatsApp” quase sempre vem de um destes casos:

- API não oficial que finge ser o WhatsApp (Z-API, Evolution, Baileys e similares)
- Disparo de marketing pelo **app** WhatsApp Business
- Muita mensagem não solicitada; o cliente bloqueia ou denuncia como spam

Esses números **são** banidos com frequência.

O Frego **não é isso**. Cada loja conecta a **própria** conta WhatsApp Business pela Cloud API (Embedded Signup). Só saem **templates aprovados pela Meta**, não texto livre de marketing.

---

## O que o Frego envia hoje

| Momento | Template | Volume |
|---|---|---|
| Cliente cadastrado no balcão | `frego_welcome` | 1 mensagem por cadastro |
| Carimbo / pontos no balcão | `frego_earn_summary` | 1 mensagem por acúmulo |
| Uma Campanha **com Audience** fica **ativa** | `frego_campaign_notice` | 1 mensagem para **cada telefone da Audience** |

Cadastro e acúmulo são 1:1 e ligados a algo que acabou de acontecer na loja. Esse é o padrão seguro.

O aviso de Campanha é um disparo: quando a Campanha com Audience passa a ativa, o Frego manda o template para **todos os telefones da Audience**, em lotes de 8, **sem teto de tamanho**. O push do app respeita a preferência de notificação do cliente; o WhatsApp **não**.

Os três templates entram na Meta como **Utility**. A Meta pode recategorizar — em especial o de Campanha, que parece marketing (“a loja lançou uma nova campanha, abra o app”).

---

## O que a Meta ainda pode fazer no número da loja

Na API oficial quase nunca há “baniu de uma hora para outra por volume”, como nas APIs piratas. O que existe:

1. **Nota de qualidade** (GREEN / YELLOW / RED), a partir de bloqueios e denúncias
2. Se a qualidade cair: pausar templates, cortar o limite diário de clientes únicos, ou restringir o número
3. Número novo costuma começar em torno de **250 clientes únicos / 24h** e sobe se a qualidade se mantém alta

O Frego já guarda `qualityRating` e `messagingLimitTier` e mostra a qualidade em Configurações.

Se a loja usa **coexistência** (app Business + Frego no **mesmo** número), um tombo de qualidade não é “só o Frego”. É o número com que a loja fala com o cliente no dia a dia.

Os termos do Frego já dizem: a conexão é opcional; a loja continua responsável pelo número e pelas políticas da Meta; o envio pode parar por restrição de conta, limite de mensagem ou indisponibilidade da Meta.

---

## Como falar isso na conversa com a loja

- Conectar o Frego **não** é o mesmo que ligar o número da loja numa ferramenta de disparo.
- Recados de cadastro e carimbo são transacionais e crescem com visita real, não com lista comprada.
- A Meta **pode** desacelerar ou restringir o número se as pessoas denunciarem as mensagens.
- Quem protege o WhatsApp que já usa com o cliente deve preferir um **número dedicado** ao Frego, não coexistência no número operacional.
- O aviso de Campanha para a Audience é o volume que eles precisam conhecer — e o ponto em que, depois, pode fazer sentido exigir opt-in explícito ou um teto.

---

## Riscos internos (para o time)

1. **Aviso de Campanha** é o vetor de volume e de qualidade. Sem cap e sem respeitar `notificationsEnabled`.
2. **Coexistência** une o risco do Frego ao WhatsApp operacional da loja.
3. Meta pode reclassificar `frego_campaign_notice` como Marketing mesmo tendo sido criado como Utility.
4. Loja movimentada no balcão pode bater o teto inicial de 250 clientes únicos/dia: isso é **throttle**, não ban — mas parece “parou de enviar”.

Nada disso precisa virar decisão de produto agora. Serve para alinhar o discurso nas entrevistas e para não prometer “a Meta nunca mexe no número”.
