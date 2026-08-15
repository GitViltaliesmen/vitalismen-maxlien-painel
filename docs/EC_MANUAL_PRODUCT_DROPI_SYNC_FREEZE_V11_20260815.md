# Suplemento congelado EC v11: estabilidade do recibo durante sincronizacao

Data: 2026-08-15

Esta microcamada sucede v10. Quando um pedido ja tem `submittedToDroppiAt` e ID Dropi confirmado, uma sincronizacao logistica posterior preserva `raw.latestDroppiPayload.status` como `submitted`. O estado recebido da transportadora continua disponivel em `dropiStatus` e em `logistics.status`.

A mudanca impede que um consumidor legado volte a apresentar como apenas criado um pedido ja enviado. Nenhum pedido e criado, reenviado, cancelado ou removido por esta camada. Produto, precos, cliente, funis, sessao, permissoes e dependencias permanecem inalterados.
