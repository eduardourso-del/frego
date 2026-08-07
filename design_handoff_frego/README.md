# Handoff: Frego — Loyalty Platform

## Overview
Frego is a multi-tenant SaaS loyalty platform for restaurants, coffee shops (and later retail, beauty, gyms, pet shops). The core promise: a customer's **phone number is the entire loyalty account** — no cards, no QR, no customer login at the counter. A full stamp/reward interaction should take under 10 seconds.

There are three surfaces:
1. **Frego Admin Panel** — platform operator (super admin): manage every business/tenant, billing, usage.
2. **Estabelecimento Admin Panel** — the business itself: dashboard, customers, campaigns, reports, settings (locations + team).
3. **Customer App** — mobile: phone-first wallet, rewards, campaigns, history, optional profile.

An **Employee App** flow (give-stamp at the counter) is included inside the Estabelecimento design file.

## About the Design Files
The files in this bundle are **design references authored in HTML** — prototypes showing intended look, layout, copy, and behavior. **They are not production code to copy directly.** They are built as inline-styled HTML canvases (a custom `<x-dc>` runtime via `support.js`) purely for visual fidelity.

**Your task:** recreate these designs in the target codebase using its established patterns and libraries. Per the intended stack:
- **Admin + Estabelecimento panels → Next.js** (React components).
- **Employee + Customer apps → Flutter** (translate HTML/CSS layouts to widgets; the iOS-style mockups map to Cupertino/Material).
- **Backend:** Firebase Auth (phone/SMS OTP), Firebase Cloud Messaging (notifications), Firebase Analytics/Crashlytics, Cloud Run APIs, PostgreSQL.

Do **not** ship the HTML. Rebuild each screen as real components; use the HTML only as the pixel/spec reference.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, copy, and most states (default/loading/empty/error) are specified. Recreate pixel-faithfully using the codebase's component library. Icons in the mocks are **emoji placeholders** — replace with a real icon set (SF Symbols for iOS/Flutter Cupertino, Lucide/Material for web).

---

## Design Tokens

### Color — Light
| Token | Hex | Use |
|---|---|---|
| primary/50 | `#EEF1FD` | tints, selected-row bg, badge bg |
| primary/200 | `#C7D2F7` | secondary bars, disabled-on-primary |
| **primary/500** | **`#3B5BDB`** | primary actions, active nav, accents |
| primary/600 | `#2F49C4` | gradient end, pressed |
| primary/800 | `#1E2F8A` | deep gradient |
| neutral/bg | `#F7F8FA` | app background |
| neutral/100 | `#F1F3F6` | track fills, chip bg |
| neutral/200 | `#E4E7EC` | input borders |
| neutral/hairline | `#EEF0F3` | card borders, dividers |
| neutral/400 | `#9AA0AA` | muted/placeholder text |
| neutral/500 | `#6B7280` | secondary text |
| neutral/700 | `#3F444F` | labels, body-strong |
| neutral/ink | `#16181D` | primary text |
| card | `#FFFFFF` | card/surface |
| success | `#1F9D6B` | success text/badges |
| success/bg | `#E6F6EE` | success badge bg |
| warning | `#E8920C` | warning text/badges |
| warning/bg | `#FDF2E0` | warning badge bg |
| danger | `#DF4138` | danger text/buttons |
| danger/bg | `#FDECEB` | danger badge bg |

### Color — Dark
| Token | Hex |
|---|---|
| bg | `#0C0D10` |
| card | `#15171C` |
| raised | `#1D2026` |
| border | `#2A2E37` |
| primary | `#5B78E8` |
| text | `#E8EAED` |
| text-dim | `#9AA0AA` |
| text-faint | `#5B616B` |
| success | `#2BB37E` · warning `#F0A52C` · danger `#F0584F` |

### Typography
System font stack (Apple HIG feel), zero web-font load:
`-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif`
Monospace (labels/codes): `ui-monospace, SFMono-Regular, Menlo, monospace`

| Role | Size / Weight / Tracking |
|---|---|
| Display | 40 / 600 / -3% |
| Title | 28 / 600 / -2% |
| Heading | 20 / 600 / -1% |
| Body | 17 / 400 |
| Secondary | 15 / 400 |
| Label/Caption | 13 / 600 / +4% uppercase |

### Spacing — 8pt grid
`8 (xs) · 16 (sm) · 24 (md) · 32 (lg) · 48 (xl)`. All paddings/gaps are multiples of 8 (occasional 4 for tight optical adjustments).

### Radius
`8` (inputs, small chips) · `10–12` (buttons, cards inner) · `14–16` (cards) · `18–20` (modals, hero cards) · `999px` (pills, avatars, progress tracks). Phone bezel `46`, screen `36`.

### Shadow
- Card: `0 1px 2px rgba(16,24,40,.04)` + hairline border `#EEF0F3`
- Raised/modal: `0 16px 40px rgba(16,24,40,.08)`
- Floating card / device: `0 24px 60px rgba(16,24,40,.10–.16)`
- Primary button: `0 1px 2px rgba(16,24,40,.12)`; FAB/CTA glow: `0 8px 20px rgba(59,91,219,.28)`
- Focus ring: `0 0 0 3–4px rgba(59,91,219,.10–.12)` + `1.5px` primary border

---

## Screens / Views

### A · Frego Admin Panel (Next.js, desktop-first)
**A1 · Platform Overview** — dark operator sidebar (`#0C0D10`) to distinguish from tenant panels. 236px sidebar (Overview, Businesses, Billing & plans, Usage, Team & roles, Support, Settings). 60px topbar with search + "Add business". Content: 4 KPI cards (Active businesses, MRR, Platform customers, Stamps issued today), then a "Recent businesses" table (Business w/ icon, Plan, Stores, Customers, Status badge).
**A2 · Businesses & billing table** — filter bar (search + Plan/Status dropdowns), columns Business / Plan (pill) / MRR / Status (Active/Trial/Past due), pagination footer ("1–5 of 412").

### B · Estabelecimento Admin Panel (Next.js, desktop-first)
Trimmed nav — **Dashboard · Customers · Campaigns · Reports · Settings**. Stores→**Locations** and Employees→**Team** live inside Settings; Rewards are defined inside Campaigns; Companies belong to the Frego Admin level.

- **Onboarding wizard (registration)** — 5 steps (Business → First location → Invite team → First campaign → Ready) with a dark step-rail. Step 1: business name + type chips (Café/Restaurant/Beauty/Retail/Pet). Final: success state with confetti + summary stats + "Go to dashboard".
- **Dashboard** — greeting header + date range toggle (Today/7d/30d); 4 KPIs (Customers today, Stamps given, Rewards redeemed, Repeat rate); "Visits this week" grouped bar chart (visits `#3B5BDB` + redemptions `#C7D2F7`); "Live now" activity feed; active-campaign callout (dark card).
- **Customers** — big phone-first search bar (focused style), table: Customer (avatar + name + VIP badge) / Phone / Progress (mini bar + `n/10` or "Reward!") / Visits / Last visit. "Add customer" primary button.
- **Customer profile panel** — header (avatar, name, phone, VIP), 3 stat tiles (Visits here / Birthday / Reward). **"Shared Frego identity" callout**: the phone is a global identity; other shops the customer belongs to are shown but their stamps are locked/private ("Each shop only sees its own stamps"). Recent activity = immutable transaction list (who/when).
- **Add / associate customer flow** (3 states): (1) phone search field w/ "Checking Frego…"; (2) **found globally → associate** — prefilled name/birthday, "active at N other shops", "Add to <business>" primary; (3) **not found → create** — name & birthday optional, only phone required, "Create & add first stamp".
- **Create campaign** — split view. Left: type cards (Stamps/Spend/Visits/Birthday), name, stamps-needed + reward, "Applies to" location chips, Publish/Save draft. Right: **live customer-card preview** (gradient stamp card) + estimated-impact card.
- **Settings → Locations + Team** — sub-nav (Business profile, Locations, Team, Billing, Notifications). Locations list (address, staff count, Open badge). Team list (Owner/Employee role badges, Pending invite state).

### B · Employee flow (Flutter, iOS-style) — inside Estabelecimento file
Phone home/search (recent customers) → customer profile with **stamp grid** (filled `#3B5BDB` circles, dashed empties, gift on final) + sticky "Add stamp" CTA → **reward-unlocked** full-screen (confetti, "Redeem now" / "Save to wallet").

### C · Customer App (Flutter, iOS-style, light + dark)
Progressive, never gated: **phone → OTP → wallet is the finish line; account is optional upsell.**
- **Phone entry** — country code `+55`, big number field, "Continue".
- **OTP** — 4-digit code boxes (active box has focus ring), "Resend in 0:24".
- **Wallet** (finish line) — gradient hero progress card (`7/10`), optional birthday-profile nudge card, bottom tab bar (Wallet/Rewards/History/Profile). Badge in mock: "Logged in — no account made".
- **Complete profile** (optional/skippable) — first name + birthday, "You can do this anytime".
- **Rewards** — ready-to-use reward (green gradient, "Show to staff to redeem") + almost-there progress.
- **History** — grouped by Today/This month; earned (+, `n/10`) and redeemed (🎁, −1) transactions — auditable.
- **Profile** (dark) — avatar, phone, rows (Birthday, Notifications toggle, My shops, Dark mode toggle).
- **My shops** — one number, many loyalty cards (Bloom Coffee / Burger Lab / Pet & Co.), each tappable to its wallet.

---

## Interactions & Behavior
- **Counter flow (employee):** search phone → if exists open profile, else create → tap "Add stamp" → optimistic UI, toast "Stamp added — X of N"; if final stamp, trigger reward-unlock screen with confetti. Target < 10s.
- **Customer auth:** Firebase phone auth. Enter number → SMS OTP → session. No password. Reaching Wallet = success; profile completion is a separate, skippable screen.
- **Progress animation:** stamp fill and progress bars animate on change; reward unlock uses confetti + scale/float on the gift.
- **Transactions are immutable:** never mutate a balance directly — every add/redeem is an append-only transaction row. Balances/progress are derived.
- **Toasts:** dark pill, success icon, auto-dismiss; e.g. "Stamp added · Marina now has 7 of 10".
- **States provided:** default, focus (ring), loading (spinner in button / skeleton shimmer rows), empty ("No customer found" + CTA), error (red border + helper text). Disabled = primary/200 fill.

## State Management
- **Customer identity is global** (keyed by E.164 phone) at the platform level; **memberships, stamps, transactions are per-business (tenant-scoped)**. A business associating a customer creates a membership, not a new person.
- Key entities: Business(tenant) → Locations, Team members; Customer(global) → Membership(per business) → Transactions (immutable), Campaigns → Rewards, Wallet (derived).
- Web state: current business/tenant, date-range filter, table pagination/filters, search query. App state: auth session, selected shop, wallet progress (server-derived), notification prefs.
- Data fetching: lookup-by-phone, create-transaction, campaign CRUD, reports aggregations. Most screens are views over a small set of resources.

## Design Tokens
See the **Design Tokens** section above (colors light+dark, type scale, 8pt spacing, radii, shadows). Recommend materializing as CSS variables (web) and a Dart theme (Flutter) from one source.

## Assets
- **Icons:** emoji placeholders in mocks — **replace** with SF Symbols (Flutter Cupertino) / Lucide or Material (web).
- **Illustrations:** none external; empty/success states are composed from shapes + emoji — swap for your illustration set.
- **Fonts:** system font stack only (SF/system-ui) — no font files to bundle.
- **Logo:** "V" wordmark set in the primary blue rounded square — recreate as an SVG.

## Files
All under this folder (open the `.dc.html` files in a browser to inspect exact pixels/copy; `support.js` is the runtime they need to render):
- `Frego Design Language.dc.html` — brand, full token system (light+dark), component library, and the three-area overview with links.
- `Frego Estabelecimento.dc.html` — Estabelecimento deep dive: IA rationale, onboarding wizard, customers + profile, add/associate flow, campaign builder, settings, dashboard, reports, + employee counter flow.
- `Frego Customer App.dc.html` — customer deep dive: phone→OTP→wallet entry flow, rewards, history, profile, my-shops.
- `support.js` — DC runtime (only needed to view the HTML references).
