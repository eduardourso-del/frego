# A closed Saipos sale is a pull, not a till event

Saipos does not tell Frego when a compra is finished. The data API is a report of sales that can lag until the next day, so we poll `updated_at` a few times a day and credit only sales created after the token was saved. The compra amount is the total minus the courier fee. We do not spend cashback on that bill, and we do not import history from before the connection.

We rejected the public order API because it sends pedidos into Saipos, and a page script on their caixa because it breaks when they ship and cannot run on SmartPOS. The owner pastes their own data token. Saipos charges them for it.
