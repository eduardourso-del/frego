# Meta App Review — Frego (WhatsApp)

Paste these answers into **Submit for App Review**. Write them yourself in the form — do not use Meta’s auto-generated suggestion (generic / untrue copy is a common rejection).

Permissions in this submission:

- `whatsapp_business_management`
- `whatsapp_business_messaging`
- `public_profile` (comes with Facebook Login for Business / Embedded Signup)

App is already **Live**. This review is what grants **Advanced Access** so third-party shops can connect. Live mode alone is not enough.

Privacy: https://frego.app.br/privacidade  
Terms: https://frego.app.br/termos  
Support: https://frego.app.br/suporte  
Establishment app: https://frego.app.br/login  
Contact: contato@bearlabs.com.br

---

## 1. Allowed usage

Certify that each permission is used only for its allowed purpose. Then paste the matching text + a **separate video per permission**.

**Business Description** (one line, same for every permission):

```
We are a loyalty platform for local shops in Brazil that sends transactional WhatsApp updates from each shop’s own WhatsApp Business number.
```

### `whatsapp_business_management`

Frego is a multi-tenant loyalty platform for local shops in Brazil (operated by Bearlabs). Each shop connects its own WhatsApp Business Account through WhatsApp Embedded Signup so Frego can manage that shop’s WABA on their behalf: subscribe webhooks, create and sync approved message templates (`frego_welcome`, `frego_earn_summary`, `frego_campaign_notice`), and read phone quality / messaging-limit metadata shown in Settings. We do not use this permission to scrape consumer Facebook profiles, run ads, or access WABAs the shop did not grant through Embedded Signup.

**Video (management):** shop owner opens https://frego.app.br/login → Configurações → WhatsApp → Embedded Signup (connect the shop’s WhatsApp Business number) → “Criar / sincronizar template” and the approved template status in Frego / WhatsApp Manager. Show Frego UI, not only Meta’s dashboard.

### `whatsapp_business_messaging`

After a shop connects WhatsApp, Frego sends **Utility** template messages from **that shop’s** Cloud API number: welcome when a customer is registered at the till, earn/balance update when stamps or points are added, and a one-time campaign notice when a Campanha with an Audience becomes active. Sends go through Meta’s Cloud API (`POST /{phone-number-id}/messages`) using approved templates only. Frego does not send free-form marketing blasts or use unofficial WhatsApp APIs.

**Video (messaging):** from Frego Settings, send the in-app test message to a real phone, then show the WhatsApp thread receiving it from the shop number. Optional extra: register or stamp a customer at `/counter` and show the resulting welcome/earn WhatsApp. Both Frego and the WhatsApp client must be visible.

### `public_profile`

Used only because Facebook Login for Business is required to run WhatsApp Embedded Signup. Frego does **not** offer Facebook login to customers (customers sign in with phone OTP). We do not display or store Facebook profile data as a product feature.

If Meta lets you drop `public_profile` from this request without breaking Embedded Signup, drop it. Otherwise keep this explanation.

---

## 2. Data handling

Answer truthfully and specifically. Platform Data here means WABA IDs, phone number IDs, access tokens, template status, webhook delivery events, and (for coexistence) SMB contact/history sync events Meta sends.

**Data controller:** Bearlabs (operator of Frego), Brazil.  
**Privacy contact:** contato@bearlabs.com.br  
**Policy:** https://frego.app.br/privacidade

**What we receive from Meta:** identifiers of the shop’s WhatsApp Business Account and phone, encrypted Cloud API access tokens, template approval status, message send results, and webhook events (delivery, template status, and coexistence sync: `history`, `smb_app_state_sync`, `smb_message_echoes`). Customer phone numbers used as WhatsApp destinations are the same numbers the shop already stored in Frego for loyalty (the phone is the customer account). We do not ingest Facebook friend lists or consumer Facebook profiles.

**Processors question:** **Yes.** (Neon stores encrypted tokens / WABA IDs; Google Cloud Run processes webhooks and sends; the Vercel-hosted dashboard receives the Embedded Signup OAuth code before posting it to the API.) Do **not** list Meta as a processor of data obtained from Meta.

Names to paste if the form asks:

```
Google Cloud (Cloud Run API: token exchange, template APIs, webhooks, message send)
Neon (PostgreSQL: encrypted WhatsApp access tokens, WABA ID, phone number ID, template status)
Vercel (hosts the establishment web app where Embedded Signup runs)
```

Do not list Bearlabs as a processor of itself — Bearlabs is the controller. Tokens are encrypted at rest. Access is scoped per shop (multi-tenant).

**We do not sell Platform Data.** We do not use it for ads. Shops remain responsible for their WhatsApp number and Meta’s messaging policies.

**Retention / deletion:** WhatsApp connection is optional. Disconnecting in Frego Settings drops the stored token and marks the connection disconnected. Customer account deletion in the Frego app (Perfil → Excluir conta) removes the customer phone identifier. Operational ledger rows may be retained in anonymized form as described in the privacy policy.

**Public authority requests:** we only disclose personal data when required by applicable law or a valid legal order, and we limit disclosure to what is necessary. Shops that connect WhatsApp are also controllers/operators of their own customer data under LGPD, as stated in our policy.

---

## 3. Reviewer instructions

Meta’s WhatsApp reviewers usually **do not need a Facebook login**. Do **not** share personal Facebook passwords. Videos are the proof.

```
App name: Frego
Platform: Web (establishment dashboard)
URL: https://frego.app.br/login
Privacy policy: https://frego.app.br/privacidade

Frego is a loyalty SaaS for local shops in Brazil. Shops connect their own
WhatsApp Business number via Embedded Signup (Settings → WhatsApp). Frego then
sends approved Utility templates from that number (welcome, earn/balance,
campaign notice). Customers do not log in with Facebook; they use phone OTP.

How to review (videos attached per permission):
1. whatsapp_business_management — Embedded Signup + template create/sync.
2. whatsapp_business_messaging — test send from Frego, then the WhatsApp
   thread showing the message from the shop’s number.

We are not providing Facebook account credentials. If a dashboard login is
required, contact contato@bearlabs.com.br and we will provision a reviewer
tenant the same day.

Notes:
- Use HTTPS only (frego.app.br). Embedded Signup does not work reliably on
  non-HTTPS hosts.
- Coexistence (WhatsApp Business app + Cloud API on the same number) is the
  intended production path. The shop must use WhatsApp Business, not personal
  WhatsApp.
- Templates are auto-created on the shop’s WABA after connect and must be
  Approved before sends succeed.
```

Replace the last paragraph with a real reviewer email/password **only if** you have a dedicated production tenant for Meta. Do not paste the local seed `ana@bloom.coffee` / `frego-demo-123` unless that account exists on production.

---

## Videos (record before Submit)

One unique screen recording **per permission**. Show **Frego**, not only Meta Admin.

| Permission | Must show |
|---|---|
| `whatsapp_business_management` | Configurações → Conectar WhatsApp Business → Embedded Signup completes → templates appear / “Criar / sincronizar template” |
| `whatsapp_business_messaging` | Enviar mensagem de teste (or a real stamp) **and** the WhatsApp chat receiving it |

Keep each clip short (2–4 min), narrate in English or add captions: what the shop is doing and why the permission is needed.

---

## After you click Submit

1. Start **Access Verification** in parallel (Tech Provider). Without it, API calls on other businesses’ WABAs fail even after App Review.
2. Wait for Advanced Access on the two WhatsApp permissions (often days to a few weeks).
3. Then test coexistence: Configurações → **Conectar WhatsApp Business**. If you still get `#2655111`, Advanced Access is not live yet — use **Número só na API** only as a fallback.
