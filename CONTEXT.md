# Frego

Loyalty at the till and in the Cliente's pocket. The phone number is the Cliente's account.

## Language

**Estabelecimento**:
The business a Cliente visits.
_Avoid_: shop, store, loja, business

**Cliente**:
The person identified by a phone number. That number is the account.
_Avoid_: client, user, consumer, customer

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
A Campanha whose Prêmio is entitled by Audience, the Estabelecimento calendar, and a Resgatar frequency cap — not by stamps or points.
_Avoid_: offer, gift, brinde, perk

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

**Polegar**:
A Pesquisa question the Cliente answers up or down.
_Avoid_: thumbs, rating, star, NPS

**Resposta**:
A Cliente's finished Pesquisa: every Polegar answered, note optional.
_Avoid_: reply, submission, response

**Bônus**:
The wallet credit an Estabelecimento sets on a Pesquisa. One wallet: carimbos on the shared pile or one Cartela, pontos, or cashback.
_Avoid_: prêmio, reward, voucher
