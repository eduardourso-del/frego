# Multi-tenant WhatsApp on Frego (Embedded Signup)

Each establishment connects **its own** WhatsApp Business Account (WABA) and phone.
Frego never sends from a shared Meta test number.

Earn notifications (carimbos/pontos) use that business’s `phone_number_id` + encrypted token.

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
   - Subscribe to: `messages`, `message_template_status_update` (as available)

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

1. Open **Configurações** → **Conectar WhatsApp**.
2. Complete Meta Embedded Signup (Business Manager → WABA → phone).
3. Prefer a **Brazilian** business phone (US/test numbers often fail with error `130497` when messaging `+55`).
4. In **WhatsApp Manager** for that WABA, create template:

**Name:** `frego_earn_summary`  
**Language:** `pt_BR`  
**Category:** Utility  

**Body:**

```text
*{{1}}*
Você ganhou *{{2}}*.
Saldo: *{{3}}*.
{{4}}
```

Wait until **Approved**.

5. Stamp a customer at the balcão → customer receives WhatsApp from the **store’s** number.

## 4. API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/whatsapp/connection` | Staff | Connection status (no secrets) |
| POST | `/whatsapp/oauth/callback` | Owner/manager | `{ code }` from Embedded Signup |
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
| `META_NO_WABA_GRANTED` | Embedded Signup didn’t grant a WABA; retry flow |
| `130497` country restricted | Use a BR sender number on that WABA |
| Template errors | Approve `frego_earn_summary` on **that** WABA |
| Earn works, no WhatsApp | Check Configurações → connected; API log `whatsapp_earn_skipped` / `_failed` |

## 7. Out of scope (later)

Inbox, contacts, Pub/Sub queues, Secret Manager, auto template sync across tenants.
