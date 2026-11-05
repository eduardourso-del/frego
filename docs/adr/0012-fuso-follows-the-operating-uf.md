# The Painel day follows the UF where the Estabelecimento operates

The day of the Painel is the civil day of the Estabelecimento, not the viewer's clock and not UTC. Midnight UTC is 21:00 in São Paulo, so a UTC day flips during evening service. Registration and Configurações collect the operating address; CEP fills the street, and the UF selects the IANA zone. One Fuso per Estabelecimento: when several unidades exist, the oldest unidade that has a UF sets it. Until that UF is saved, the Painel uses America/Sao_Paulo and Configurações keeps asking for the address.

A state is the grain we can ask for. It misses Fernando de Noronha (Pernambuco, UTC−2) and a strip of western Amazonas (UTC−5). Promoção stays on America/Sao_Paulo (ADR 0003).
