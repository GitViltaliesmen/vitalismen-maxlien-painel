# Resultado da ativação V53 — saúde do pós-venda EC

## Produção oficial

- Domínio: `https://ec.maxlien.shop/`
- Tag: `production-20260824-04b1e8e`
- Commit: `04b1e8e6084a78da7ad4254ca1c979996a7484f9`
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260824T025315Z_production-20260824-04b1e8e`
- Rollback preservado:
  `/opt/vitalismen-automacao/releases/20260824T020500Z_production-20260824-1bf5013`
- Ativação transacional concluída em `2026-08-24T02:54:39Z`, sem rollback.

## Validações de código e publicação

- `npm run lint`: 415 arquivos JavaScript válidos.
- `npm test`: 324/324 testes oficiais aprovados.
- Guard V53 e retirada: 16/16 testes direcionados aprovados.
- Guards de microcamada de produto, catálogo Dropi, retirada, contatos e os 19
  freezes oficiais: aprovados localmente e no staging oficial.
- Checks remotos Node 20, Node 22 e Cloudflare Pages: aprovados no PR 64.
- O helper transacional confirmou o commit, a tag anotada, a branch
  `production`, o health local/oficial e `/n/` antes de concluir a ativação.

## Resultado operacional observado

- Retirada: 6 etapas distintas concluídas durante a janela de observação,
  6/6 mensagens físicas confirmadas como entregues pela Z-API e nenhuma etapa
  repetida para o mesmo Shipment.
- Os Shipments `review.manualOnly=true` permaneceram fora da seleção automática.
- Tex Ultra recente: 12 pedidos concluídos, com 24/24 áudios físicos entregues;
  6 já possuíam callback de leitura no fechamento da auditoria.
- Tex Ultra histórico: 21 pendências antigas reconciliadas como
  `stale_missing_not_replayed`, sem qualquer replay automático.
- Recompra: nenhuma pendência vencida nem evento novo durante a janela; nenhuma
  violação de produto/áudio foi encontrada.
- Locks persistentes de retirada, recompra e etapas Tex Ultra: zero presos.
- Falhas de deduplicação pendentes: zero.

Dois timeouts transitórios de 20 segundos ficaram preservados no histórico de
mensagens. A fila liberou os locks, repetiu somente a tentativa não concluída e
terminou sem falha de deduplicação aberta. Não houve repetição física de mídia.

A retirada possui dois registros internos por `providerMessageId`: o espelho do
transporte e o espelho persistente do Shipment. O painel os unifica pelo mesmo
ID do provedor. A auditoria agrupada confirmou 6 mensagens físicas, todas
entregues, e não 12 disparos.

## Estado final

- `current` aponta para a release V53.
- PM2 `vitalismen-automation`: `online`, PID novo, zero reinícios instáveis,
  `pm_cwd=/opt/vitalismen-automacao/current` e
  `pm_exec_path=/opt/vitalismen-automacao/current/src/index.js`.
- Health público: `online`, sem motivos de degradação, WhatsApp pronto e Z-API
  conectada.
- A fila Tex Ultra recente terminou com zero pendências; as 21 antigas
  permaneceram bloqueadas para replay.

Nenhum cliente real foi usado como canário. Nenhum pedido, Dropi, preço,
Meta/CAPI, produto, VSL ou funil comercial foi criado ou alterado durante os
testes. A única remoção no VPS foi a pasta candidata preliminar inativa e sem
`.staging-complete.json`; a release oficial e o rollback foram preservados.
