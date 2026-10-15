# Frego

The Clube, at the till and in the Cliente's pocket. The phone number is the Cliente's account.

## Language

**Estabelecimento**:
The business a Cliente visits.
_Avoid_: shop, store, loja, business, casa

**Fuso**:
The civil timezone of an Estabelecimento, taken from the UF of the address where it operates. The Painel's day follows that Fuso.
_Avoid_: browser timezone, UTC, fuso do usuário

**Plano**:
The monthly subscription an Estabelecimento holds. The two Planos are Starter and Growth. The days before the first charge are not a Plano.
_Avoid_: tier, package, assinatura (the brand mark is already called that)

**Cortesia**:
A Plano a Frego operator sets on an Estabelecimento with no charge. It does not expire on its own.
_Avoid_: grant, comp, free plan, trial

**Cliente**:
The person identified by a phone number. That number is the account. Staff may correct the display name. An unclaimed registration — no app, and only this Estabelecimento — may be moved onto the right number so the Benefício follows. A Cliente who already uses the app, or who belongs to another Estabelecimento, keeps her number.
_Avoid_: client, user, consumer, customer

**Clube**:
The program a Cliente belongs to at one Estabelecimento.
_Avoid_: fidelidade, loyalty, programa de fidelidade

**Benefício**:
What the Clube puts in the Cliente's wallet: carimbos, pontos, cashback, or a Prêmio.
_Avoid_: fidelidade

**Campanha**:
A program an Estabelecimento defines that may entitle a Prêmio. Kinds: stamps, spend, birthday, cashback, Promoção.
_Avoid_: offer, promotion (as the name for every Campanha)

**Carimbo**:
A unit a Cliente holds at one Estabelecimento toward stamp Campanhas.
_Avoid_: stamp, ponto, punch

**Cartela**:
The carimbos that belong to one stamp Campanha and can Resgatar only that Campanha's Prêmio. A stamp Campanha without a Cartela spends the Estabelecimento's shared carimbos.
_Avoid_: card, cartão, punch card, pool

**Promoção**:
A Campanha whose Prêmio is entitled by Audiência, the Estabelecimento calendar, and a Resgatar frequency cap — not by stamps or points.
_Avoid_: offer, gift, brinde, perk

**Audiência**:
A saved set of Clientes. A Campanha or a Pesquisa can be limited to one. With none set, every Cliente qualifies.
_Avoid_: segment, list, filter, audience

**Prêmio**:
The in-store reward a Cliente is entitled to collect.
_Avoid_: gift, reward, coupon

**Voucher**:
The delivery token created when the Cliente Resgata a Prêmio. It is not a second currency and not a new identifier.
_Avoid_: coupon, ticket, QR voucher

**Código**:
The identifier of a Voucher (`XXX-XXX`). A scannable image is the same Código, not a second token. The UI may say QR for that image; QR is not a second identifier and not a kind of Voucher.
_Avoid_: QR (as the name of the token), barcode, voucher ID, PIN, QR voucher

**Resgatar**:
The Cliente action that creates a Voucher and consumes the wallet entitlement. A carimbo Campanha may cap how often one Cliente can Resgatar.
_Avoid_: generate, issue, claim, unlock

**Confirmar**:
The staff action that marks a Voucher as delivered at the till.
_Avoid_: fulfill, redeem (staff), use, Usar (UI label on the typed/scanned path)

**Pesquisa**:
The questions an Estabelecimento asks a Cliente: up to five polegar questions and one optional note.
_Avoid_: survey, research, campanha, NPS

**Convite**:
The open offer for one Cliente to answer a Pesquisa, tied to her latest qualifying earn.
_Avoid_: invite, link, notification, survey

**Polegar**:
A Pesquisa question the Cliente answers up or down.
_Avoid_: thumbs, rating, star, NPS

**Resposta**:
A Cliente's finished Pesquisa: every Polegar answered, note optional.
_Avoid_: reply, submission, response

**Bônus**:
The wallet credit an Estabelecimento sets on a Pesquisa. One wallet: a fixed number of carimbos on the shared pile or one Cartela, a fixed number of pontos, a fixed cashback amount, or a double of the pontos or cashback on that earn. It is offered only on an earn that credited that same wallet. With none set, any qualifying earn can open a Convite.
_Avoid_: prêmio, reward, voucher
