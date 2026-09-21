# Frego

Loyalty at the till and in the customer’s pocket. The phone number is the customer’s account.

## Language

**Campanha**:
A shop-defined program at a business that may entitle a Prêmio. Kinds: stamps, spend, birthday, cashback, Promoção.
_Avoid_: offer, promotion (as the name for every Campanha)

**Promoção**:
A Campanha whose Prêmio is entitled by Audience, shop calendar, and a Resgatar frequency cap — not by stamps or points.
_Avoid_: offer, gift, brinde, perk

**Prêmio**:
The in-store reward a customer is entitled to collect.
_Avoid_: gift, reward, coupon

**Voucher**:
The delivery token created when the customer Resgata a Prêmio. It is not a second currency and not a new identifier.
_Avoid_: coupon, ticket, QR voucher

**Código**:
The identifier of a Voucher (`XXX-XXX`). A scannable image is the same Código, not a second token. The UI may say QR for that image; QR is not a second identifier and not a kind of Voucher.
_Avoid_: QR (as the name of the token), barcode, voucher ID, PIN, QR voucher

**Resgatar**:
The customer action that creates a Voucher and consumes the wallet entitlement.
_Avoid_: generate, issue, claim, unlock

**Confirmar**:
The staff action that marks a Voucher as delivered at the till.
_Avoid_: fulfill, redeem (staff), use, Usar (UI label on the typed/scanned path)
