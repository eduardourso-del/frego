# Frego

Plataforma SaaS multi-tenant de fidelidade. O **telefone do cliente é a conta inteira** — carimbar/resgatar em menos de 10 segundos.

| Superfície | Stack | Deploy |
|---|---|---|
| Frego Admin | Next.js (`apps/web-admin`) | Vercel |
| Estabelecimento | Next.js (`apps/web-establishment`) | Vercel |
| Cliente + Funcionário | Flutter (`apps/mobile`) | App Store / Play |
| API | Fastify + Prisma (`services/api`) | Cloud Run |
| Banco | PostgreSQL via **Neon** | neon.tech |
| Auth / Push / Analytics | Firebase (OTP por SMS, FCM, Analytics, Crashlytics) | Console Firebase |

Referência de design (HTML — não publicar): `design_handoff_frego/`.

**Idioma do produto: português (pt-BR).**

---

## Estrutura do monorepo

```
apps/web-admin            # Operador da plataforma
apps/web-establishment    # Admin do negócio + /counter (balcão)
apps/mobile               # Flutter (cliente + funcionário)
services/api              # API Cloud Run
packages/tokens           # Design tokens compartilhados
db/                       # Schema Prisma + seed
design_handoff_frego/     # Spec visual
scripts/smoke-stamp.sh    # Teste rápido do fluxo de carimbo
```

## Pré-requisitos

- Node 20+ e [pnpm](https://pnpm.io) 9+
- Flutter 3.22+
- Projeto [Neon](https://neon.tech) (free tier ok)
- Projeto Firebase com Auth **Phone** (para OTP real; a API local pode usar bypass)

## 1. Instalar

```bash
pnpm install
cd apps/mobile && flutter pub get && cd ../..
```

## 2. Banco Neon

1. Crie um projeto em https://console.neon.tech
2. Copie a connection string (Prisma).
3. Configure os envs:

```bash
cp db/.env.example db/.env
cp services/api/.env.example services/api/.env
# Cole o mesmo DATABASE_URL nos dois
```

4. Schema + seed do tenant demo:

```bash
pnpm db:push
pnpm db:seed
pnpm db:generate
```

O seed cria:
- Negócio `seed_bloom_coffee` (Bloom Coffee)
- Unidade Jardins, dona `seed_owner_uid`
- Campanha de carimbos (10 → café grátis)
- Cliente Marina `+5511987654321`

## 3. API (local)

Em `services/api/.env`:

```env
AUTH_BYPASS=true
AUTH_BYPASS_FIREBASE_UID=seed_owner_uid
AUTH_BYPASS_BUSINESS_ID=seed_bloom_coffee
DATABASE_URL=...
```

```bash
pnpm dev:api
# → http://localhost:8080/health
```

Teste do carimbo:

```bash
chmod +x scripts/smoke-stamp.sh
./scripts/smoke-stamp.sh
```

### Endpoints principais

| Método | Path | Função |
|---|---|---|
| `POST` | `/customers/lookup` | Busca global por telefone + vínculo neste negócio |
| `POST` | `/customers` | Cria/associa membership; opcional 1º carimbo |
| `POST` | `/transactions` | Append-only `stamp` \| `redeem` |
| `GET` | `/customers/:id/wallet` | Progresso derivado |
| `CRUD` | `/campaigns` | Escopo do tenant |

Saldos são **sempre** derivados de `transactions`. Nunca atualize uma coluna de saldo.

## 4. Apps web

```bash
cp apps/web-establishment/.env.example apps/web-establishment/.env.local
cp apps/web-admin/.env.example apps/web-admin/.env.local

pnpm dev:establishment   # http://localhost:3000 — /counter = balcão
pnpm --filter @frego/web-admin exec next dev --turbopack -p 3001
```

### Vercel

Dois projetos no monorepo:

- Root `apps/web-admin`
- Root `apps/web-establishment`

Defina `NEXT_PUBLIC_API_URL` com a URL do Cloud Run. Install: `pnpm install`.

## 5. Firebase (auth por telefone)

Projeto GCP/Firebase (id legado): **`voltei-e9d6d`**. A marca do produto é **Frego**; o project id não muda sem recriar o projeto.

| App | ID |
|---|---|
| Web Estabelecimento | `1:258859601466:web:246b84233b07f19918af03` |
| Web Admin | `1:258859601466:web:e4728bae14a2e2f618af03` |
| iOS | `com.bearlabs.frego` (`1:258859601466:ios:cb11a459fce71b9e18af03`) |
| Android | `com.bearlabs.frego` (`1:258859601466:android:2732aa53865511b718af03`) |

Phone Auth **ligado** (clientes no app). Email/Password **ligado** (equipe do estabelecimento).

Números de teste de cliente (código `123456`):

- `+5511987654321` — Marina (cliente)

Conta demo da equipe:

- E-mail: `ana@bloom.coffee`
- Senha: `frego-demo-123`

### Credenciais da API (local)

A org bloqueia criação de JSON key. Use Application Default Credentials:

```bash
gcloud auth application-default login --project=voltei-e9d6d
```

`services/api/.env` já tem `FIREBASE_PROJECT_ID=voltei-e9d6d`. Com `AUTH_BYPASS=true`, smoke tests funcionam sem token; se o cliente enviar `Authorization: Bearer`, o Firebase é validado.

### Web

`.env.local` dos apps web já preenchidos. Fluxo:

1. http://localhost:3000/login → telefone → OTP
2. http://localhost:3000/counter → carimba com o token

### Flutter

`GoogleService-Info.plist` e `google-services.json` já no app. `firebase_options.dart` gerado.

**Apple Developer (team `87284RSCR5`):** App ID `com.bearlabs.frego` registrado (`XC com bearlabs frego`), com Push (`aps-environment`) e profile de desenvolvimento. Falta criar o app no [App Store Connect](https://appstoreconnect.apple.com/apps) (mesmo bundle id) para TestFlight — precisa de API key `.p8` ou criação manual no console.

```bash
cd apps/mobile && flutter run
```

No Cloud Run, associe a service account `voltei-api@voltei-e9d6d.iam.gserviceaccount.com` (sem JSON key).

## 6. Flutter

```bash
cd apps/mobile
flutter run
# Em device físico use o IP da máquina:
# flutter run --dart-define=API_URL=http://192.168.x.x:8080
```

## App Store (iOS)

- **Privacy policy URL** (App Store Connect e no app): https://frego.app.br/privacidade
- **Termos:** https://frego.app.br/termos
- Login do cliente é **somente telefone + OTP**. Não adicionar Google/Facebook sem Sign in with Apple (guideline 4.8).
- Nome e aniversário são opcionais. Exclusão da conta: Perfil → Excluir conta.
- Notas para o reviewer (copiar e colar): `apps/mobile/store/app-review-notes.txt`

**Número de teste Firebase** (obrigatório antes do review — o reviewer nos EUA não recebe SMS brasileiro):

1. Firebase Console → Authentication → Sign-in method → Phone → *Phone numbers for testing*
2. Cadastre `+5511999000100` com código `123456`
3. Use o mesmo par nas notas de review

## 7. Cloud Run (API)

Na **raiz** do repo:

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/frego-api \
  --file services/api/Dockerfile .

gcloud run deploy frego-api \
  --image gcr.io/PROJECT_ID/frego-api \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=...,AUTH_BYPASS=false,FIREBASE_PROJECT_ID=..."
```

## Regras de multi-tenancy

1. **Customer** = global, `phone_e164` único.
2. **Membership** = cliente × negócio. Associar nunca duplica a pessoa.
3. **Transactions** = append-only; carteira = derivada.
4. Toda query da API filtra por `business_id` do membro autenticado.

## Próximos passos

1. Firebase OTP de ponta a ponta (web + Flutter).
2. Estabelecimento: onboarding → painel → clientes/campanhas/config.
3. Frego Admin: negócios + cobrança com dados reais.
4. FCM, relatórios e polish (confetti, estados vazios/erro).

## Licença

Privado — todos os direitos reservados.
