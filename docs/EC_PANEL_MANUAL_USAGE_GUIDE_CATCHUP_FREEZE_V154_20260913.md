# EC Panel Manual Usage + Guide Catch-up V154 — 2026-09-13

Esta camada sucessora corrige dois pontos operacionais sem desmontar as travas logísticas do V153.

1. O clique humano e autenticado na biblioteca para o áudio oficial P7 de modo de uso volta ao caminho manual comum. Ele não cria Shipment fictício, não marca P7 como pós-venda automático e não libera áudios de retirada.
2. A recuperação de guia histórica continua proibida em massa. Qualquer aviso retroativo de guia deve ser unitário, explicitamente autorizado, revalidado contra a Servientrega e finalizado pelo ledger/idempotência oficial.
3. `Chegou_01`, `Chegou_02` e `Chegou_03` continuam reservados a `READY_FOR_PICKUP` verificado. O telefone de QA não recebe Shipment falso.
4. Z-API, VSL, Pixel/CAPI, Dropi, preços, produto, checkout e outros projetos permanecem inalterados.

A V154 não aumenta o lote automático nem a cota diária do V116 e não habilita backlog histórico.
