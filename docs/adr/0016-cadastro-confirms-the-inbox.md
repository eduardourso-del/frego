# A Cadastro is not an Estabelecimento until the e-mail is confirmed

The review queue was every form submit, so a fake inbox could open a pending Estabelecimento. The Cadastro is held until the owner confirms that inbox. Only then do we open the Estabelecimento for an operator to approve or refuse. Each decision sends the owner an e-mail; if that send fails, the decision still stands. A refusal asks the owner to write to Frego.

We rejected creating the Estabelecimento immediately and hiding it from operators. Those rows would still be tenants — unidade, billing, owner — and a typo or a bot would leave them behind. The confirmation link is Firebase's, the same mail the painel already sends for a new password. The approval note is a separate message.
