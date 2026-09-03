# Multi-tenant WhatsApp on Frego (Embedded Signup)

Each establishment connects **its own** WhatsApp Business Account (WABA) and phone.
Frego never sends from a shared Meta test number.

Earn notifications (carimbos/pontos) and welcome (novo cadastro) use that business’s `phone_number_id` + encrypted token.

## Architecture (v1)

- **Postgres:** `business_whatsapp_connections`, `whatsapp_webhook_events`
- **API:** `GET/POST /whatsapp/*`, `GET|POST /webhooks/meta`
- **UI:** Configurações → card WhatsApp → Embedded Signup
- **Scope:** earn templates only (no inbox)

## 1. Meta App (platform / Frego)

1. [developers.facebook.com](https://developers.facebook.com/apps) → your **Frego** app.
2. Add **WhatsApp** product / use case.
3. Note **App ID** and **App Secret** (App settings → Basic).
4. Add product **Facebook Login for Business** (if missing).
5. Create the Embedded Signup **Configuration ID**:
   - Left sidebar → **Facebook Login for Business** → **Configurations**
   - Prefer **Create from template** → *WhatsApp Embedded Signup Configuration With 60 Expiration Token*
   - Or **Create configuration** → name it → login variation **WhatsApp Embedded Signup** → assets (WhatsApp accounts) → permissions `whatsapp_business_management` + `whatsapp_business_messaging` → Create
   - Copy the **Configuration ID** shown after save (this is `NEXT_PUBLIC_META_EMBEDDED_CONFIG_ID`)
   - Optional: **WhatsApp → Embedded Signup Builder** can also help generate/test the same flow
6. For other businesses to connect, complete **Tech Provider** / partner onboarding as required by Meta for your app type.
6. Configure the app webhook:
   - Callback URL: `https://<your-api>/webhooks/meta`
   - Verify token: same as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
   - Subscribe to: `messages`, `message_template_status_update`, `history`, `smb_app_state_sync`, `smb_message_echoes` (and `account_update` if available)

## 2. Environment variables

### API (`services/api/.env`)

```bash
META_APP_ID=...
META_APP_SECRET=...
META_EMBEDDED_CONFIG_ID=...          # optional on server
WHATSAPP_TOKEN_ENCRYPTION_KEY=...    # openssl rand -base64 32
WHATSAPP_WEBHOOK_VERIFY_TOKEN=frego-meta-verify
WHATSAPP_GRAPH_VERSION=v21.0
```

### Establishment web (`apps/web-establishment/.env.local`)

```bash
NEXT_PUBLIC_META_APP_ID=...
NEXT_PUBLIC_META_EMBEDDED_CONFIG_ID=...
```

## 3. Per restaurant (establishment)

1. Open **Configurações** → **Conectar WhatsApp Business**.
2. Complete Meta Embedded Signup. Prefer **connect existing WhatsApp Business app** (coexistence) so the store keeps the app on the phone — no account delete.
3. Use **WhatsApp Business** (not personal WhatsApp). App version ≥ 2.24.17.
4. Prefer a **Brazilian** business phone (US/test numbers often fail with error `130497` when messaging `+55`).
5. Keep the WhatsApp Business app open for a few minutes after connect (Meta SMB sync).
6. Frego **auto-creates** templates `frego_earn_summary`, `frego_welcome`, and `frego_campaign_notice` (`pt_BR`) on that WABA after connect. Wait until status is **Approved** (shown in Configurações). You can also tap **Criar / sincronizar template**.
7. Register a customer at the balcão → welcome WhatsApp. Stamp → earn WhatsApp from the **store’s** number once templates are approved.

### Coexistence (after App Review)

Embedded Signup can launch with `featureType: whatsapp_business_app_onboarding`.

- Owners keep WhatsApp Business app + Cloud API on the **same number**.
- Frego **skips** `/PHONE_NUMBER_ID/register` for coexistence numbers.
- Immediately after connect, Frego calls `smb_app_data` for contacts + history (Meta requires this within 24h).
- Frego does **not** show an inbox yet; sync webhooks are accepted and stored so Meta does not offboard the number.

**Before App Review**, use **Conectar para testes** (standard Cloud API Embedded Signup, no `featureType`). Coexistence needs Advanced Access and will fail with `#2655111` until Meta approves.

Subscribe the Meta app webhook to (in addition to `messages` / `message_template_status_update`):

- `history`
- `smb_app_state_sync`
- `smb_message_echoes`
- `account_update` (optional; detects app-side disconnect)

### Pre–App Review testing

You can fully test connect + template + send **without** Advanced Access:

1. Meta App Dashboard → **Roles** → add your Facebook user as **Admin** or **Developer**.
2. Fix or avoid restricted Business Portfolios (e.g. Bearlabs “Business restriction”).
3. On production HTTPS ([voltei-establishment.vercel.app](https://voltei-establishment.vercel.app)) → Configurações → **Conectar para testes**.
4. Complete Embedded Signup with an eligible portfolio + BR phone (or Meta sandbox / test number).
5. Wait for `frego_earn_summary` **Approved** (or tap Criar / sincronizar template).
6. Use **Enviar mensagem de teste** (`POST /whatsapp/test-send`) — record this for App Review videos.
7. Optionally stamp a customer at `/counter` to validate the real earn path.

Limits until App Review + Access Verification:

- Only people with app roles can complete Embedded Signup with the needed permissions.
- You cannot onboard arbitrary third-party businesses yet.
- Coexistence button stays secondary until Advanced Access is granted.

### Earn template (auto)

**Name:** `frego_earn_summary`  
**Language:** `pt_BR`  
**Category:** Utility  

**Body:**

```text
Olá! Atualização de fidelidade da *{{1}}*.

Você acabou de ganhar *{{2}}*.
Seu saldo agora é: *{{3}}*.

{{4}}

Abra o app Frego para ver detalhes e resgatar prêmios quando disponíveis.
```

### Welcome template (auto)

**Name:** `frego_welcome`  
**Language:** `pt_BR`  
**Category:** Utility  

**Body:**

```text
Olá, {{1}}! Você foi cadastrado no programa de fidelidade da *{{2}}*.

Use o app Frego com este mesmo número para acompanhar carimbos, pontos e prêmios.
```

### Campaign template (auto)

**Name:** `frego_campaign_notice`  
**Language:** `pt_BR`  
**Category:** Utility  

**Body:**

```text
Olá! A *{{1}}* lançou uma nova campanha no programa de fidelidade.

{{2}}

Abra o app Frego para conferir os detalhes e participar.
```

Push uses the same announcement: title is the store name; body is “Lançou uma nova campanha: {nome}. Abra o app Frego para conferir os detalhes e participar.”

Manual creation in WhatsApp Manager is only a fallback if the API create fails.

## 4. API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/whatsapp/connection` | Staff | Connection status (no secrets) |
| POST | `/whatsapp/oauth/callback` | Owner/manager | `{ code, coexistence?, phoneNumberId?, wabaId? }` from Embedded Signup |
| POST | `/whatsapp/ensure-template` | Owner/manager | Create earn template if missing + refresh status |
| POST | `/whatsapp/sync-template` | Owner/manager | Refresh template status only |
| POST | `/whatsapp/register-phone` | Owner/manager | Re-run Cloud API phone registration (not for coexistence) |
| POST | `/whatsapp/test-send` | Owner/manager | `{ toE164 }` sample earn template for QA / App Review video |
| POST | `/whatsapp/disconnect` | Owner/manager | Disconnect |
| GET/POST | `/webhooks/meta` | Public (verify token) | Meta webhooks |

Earn paths (`POST /transactions`, customer `addFirstStamp`) call WhatsApp only if `status=connected`.

## 5. Security

- Access tokens are **AES-GCM encrypted** at rest (`WHATSAPP_TOKEN_ENCRYPTION_KEY`).
- Tokens are **never** returned to the frontend.
- `phone_number_id` is unique; reconnecting moves the number to the current business.
- Employees cannot connect/disconnect (owner/manager only).

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Button disabled / config error | Set `NEXT_PUBLIC_META_*` and restart Next |
| `META_APP_NOT_CONFIGURED` | Set `META_APP_ID` + `META_APP_SECRET` on API |
| `TOKEN_ENCRYPTION_NOT_CONFIGURED` | Set `WHATSAPP_TOKEN_ENCRYPTION_KEY` |
| Stuck on Facebook cancel / `reentry_finish` URL | Popup didn’t finish — `selected_business_id` empty. Close it, retry, and complete Business + WABA + phone. Prefer **HTTPS** (Vercel); Meta documents HTTPS-only domains for Embedded Signup. Ensure app is Tech Provider / config is WhatsApp Embedded Signup. |
| Phone number already registered / in use | Prefer **Conectar para testes** with a free Cloud API number, or coexistence after App Review. Personal WhatsApp cannot coexist. |
| `#2655111` advanced permissions | Use **Conectar para testes** until App Review grants Advanced Access; coexistence needs that approval. |
| Business portfolio not eligible / restricted | Fix or appeal in Meta Business Support Home; or pick another portfolio |
| `(#132001) Template name does not exist` | Template missing/unapproved on that WABA. Use **Criar / sincronizar template** or wait for Meta approval. |
| `(#133010) Account not registered` | Cloud-only number not registered. Connect flow calls `/register` when not coexistence. Or `POST /whatsapp/register-phone`. Prefer a real BR number over Meta `+1 555…` test numbers for messaging `+55`. |
| `META_NO_WABA_GRANTED` | Embedded Signup didn’t grant a WABA; retry flow |
| `130497` country restricted | Use a BR sender number on that WABA |
| Template errors | Approve `frego_earn_summary` on **that** WABA (auto-created; check status in settings) |
| Earn works, no WhatsApp | Check Configurações → connected; API log `whatsapp_earn_skipped` / `_failed` |
| Coexistence drops after ~24h | SMB sync must start on connect (`smb_app_data`). Check API logs `whatsapp_smb_sync_failed` and Meta webhook fields `history` / `smb_app_state_sync` |

## 7. Out of scope (later)

Inbox, contacts, Pub/Sub queues, Secret Manager, auto template sync across tenants.
