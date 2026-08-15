# Suplemento congelado EC v10: recibo legado da submissao Dropi

Data: 2026-08-15

Esta microcamada sucede v9 e preserva integralmente produto, precos, funis, sessao e permissoes. Quando a submissao real e confirmada pela Dropi, o servico ja grava a fonte principal em `raw.droppiOrder`, `Order.dropiOrderId` e `automation.submittedToDroppiAt`. A v10 passa a espelhar o mesmo recibo tambem em `raw.latestDroppiPayload` com `status: submitted`, `dropiOrderId`, eventual rastreio e data.

O espelho evita que consumidores legados tratem como `created` um pedido que ja possui ID Dropi confirmado. Ele nao cria novo pedido, nao envia novamente e nao altera dados do cliente.
