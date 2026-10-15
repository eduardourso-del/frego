# Asaas bills the Estabelecimento Plano

An Estabelecimento holds Starter (R$ 119), Growth (R$ 159), or Enterprise (R$ 199) per month. Asaas charges that price with card, Pix, or boleto. Frego never stores the card. The 7 days after approval are a trial of Enterprise, not a Plano. A Cortesia is a Plano a Frego operator sets with no charge.

We chose Asaas over Stripe and Mercado Pago because the payer is a local shop that pays with Pix or boleto and needs an NFS-e. Stripe is the stronger billing engine, and the nota would be a second system. Mercado Pago is a checkout, and this charge is not the Cliente paying at the till.

Pix and boleto are a new charge each month. The card renews itself. A failed renewal stays open for 3 days. Paying during the trial does not cut those 7 days short, except when the payment replaces a Cortesia: that paid Plano applies as soon as Asaas confirms it.
