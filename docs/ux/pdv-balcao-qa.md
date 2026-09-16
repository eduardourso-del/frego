# QA — PDV e Balcão (maquininha / tablet)

Testar no aparelho real ou em viewport ≤ 480px com teclado virtual. Alvos ≥ 44px. Textos em pt-BR.

## Chrome
- [ ] Loja visível no topo; menu Trocar loja / Sair no PDV.
- [ ] Web mobile: sticky CTA **acima** das tabs; desktop: ~24px da base.
- [ ] Teclado aberto: o CTA sticky sobe e continua tocável (não fica atrás do teclado).

## Busca
- [ ] Campo de 4 dígitos é o primeiro input visível; 28px, centralizado.
- [ ] Foco no telefone → sticky diz **Buscar**.
- [ ] Enter / teclado Search dispara a busca.
- [ ] 4 dígitos ou telefone completo com DDD funcionam.
- [ ] Erro aparece acima do sticky, próximo do campo.
- [ ] **Nova busca** limpa o cliente e volta ao campo.

## Matches
- [ ] Vários clientes: folha abre sozinha (e dá para reabrir em “Ver N clientes”).
- [ ] Tiles grandes; toque escolhe e fecha a folha.

## Cadastro
- [ ] Não encontrado: telefone completo em destaque.
- [ ] Foco nesse campo → sticky **Buscar / criar…** (rótulo conforme modo).
- [ ] Valor da compra (pontos/cashback) não esconde o sticky.

## Cliente encontrado
- [ ] Nome, telefone e saldos visíveis sem rolar demais.
- [ ] Sticky: **Carimbar** / **Registrar gasto** / **Registrar cashback** / **Adicionar à loja…**.
- [ ] Foco no valor ou no cashback a usar: sticky continua a ação de registrar (não vira Buscar).
- [ ] Sem campanha e sem cashback: CTA desabilitado (“Sem campanha ativa”).

## Voucher
- [ ] Toggle **Registrar | Voucher** no topo; **Registrar** é o default.
- [ ] Em Registrar, o bloco de código do voucher não aparece (só os vouchers abertos do cliente encontrado).
- [ ] Em Voucher, o campo de código aparece na hora; sticky **Usar** (mínimo 4 caracteres).
- [ ] PDV e web mobile (com câmera): **Escanear QR** secundário; folha com viewfinder; QR válido preenche `XXX-XXX` e limpa o valor; PIX/lixo: “Não é um voucher Frego”; permissão negada: “Sem câmera. Digite o código.”
- [ ] Web desktop (`md+`): sem **Escanear QR**.
- [ ] Valor desta compra é opcional; **Usar** funciona sem valor.
- [ ] Se o valor do lançamento já estiver preenchido, o voucher herda esse valor ao trocar de modo.
- [ ] Código inválido / já usado / ok: banner claro. Confirmação com valor mostra o R$ no banner.
- [ ] Expirado: sticky **Aceitar mesmo assim**.
- [ ] Mais de 2 vouchers abertos no cliente: mostra 2 + **Ver todos**; folha com Confirmar em cada linha (44px+).

## Desfazer
- [ ] Após lançar, **Desfazer** aparece à esquerda/acima do CTA, sem substituir o primário.
- [ ] Diálogo pede confirmação; cancelar fecha.
- [ ] Mais de 3 lançamentos: **Ver N lançamentos** abre a folha.

## Recentes
- [ ] Sem lookup: até 4 clientes “neste turno” (PDV); toque busca de novo.

## Contraste e toque
- [ ] Botão primário 52px de altura, largura total.
- [ ] Chips de valor e Confirmar voucher ≥ 44px.
- [ ] Não há dois CTAs primários iguais na mesma tela (inline “Usar” no voucher é atalho; o sticky replica).
