# Resultado de ativacao V60 — entrega do bonus apos retirada

Data: 2026-08-24

## Publicacao

- Pull request funcional: `#76`.
- Commit oficial: `bdffb627fb82deb7378dd565a3a2440c53a34cd7`.
- Tag anotada: `production-20260824-bdffb62`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260824T161720Z_production-20260824-bdffb62`.
- Ativacao transacional concluida em `2026-08-24T16:20:53Z`.
- Rollback preservado:
  `/opt/vitalismen-automacao/releases/20260824T131742Z_production-20260824-c7061a1`.
- PM2: PID `2603569`, `online`, `unstable_restarts=0`; `pm_cwd` e
  `pm_exec_path` apontam para `/opt/vitalismen-automacao/current` e
  `/proc/2603569/cwd` resolve para a release V60.

## Incidente concluido

- Pedido acompanhado: `EC-MSVUWF31-LT8A`, com Shipment `ENTREGADO`,
  `pickedUp=true` e `delivered=true`.
- Antes da V60 havia exatamente um envio fisico do audio de agradecimento
  `OBRIGADO_PAGOU`, mas `bonusNotifiedAt` continuava nulo porque o texto era
  bloqueado corretamente antes de registrar sucesso.
- Em `2026-08-24T16:22:46Z`, o dispatcher enviou uma unica mensagem fisica do
  bonus pela Z-API. O callback `delivered` foi persistido com `ack=2` em
  `2026-08-24T16:22:53.583Z`.
- Os dois documentos `Message` observados para o texto sao os espelhos
  `queued` e `deliverycallback` do mesmo `providerMessageId` e
  `providerZaapId`; eles nao representam dois envios ao cliente.
- O audio correto de modo de uso `MODO_DE_USO_TEX_ULTRA` teve um unico envio
  fisico pela Z-API em `2026-08-24T16:22:48Z`.
- O audio `OBRIGADO_PAGOU` permaneceu com contagem fisica `1`; nao foi
  repetido durante a recuperacao.
- `automation.bonusNotifiedAt` foi gravado em
  `2026-08-24T16:22:48.423Z`; a contagem de bonus entregue pendente passou de
  `1` para `0`.
- O evento `shipment_dispatch_attempt` de `delivered_bonus` terminou com
  `success=true` em `2026-08-24T16:22:48.563Z`.

## Validacao final

- CI do PR: Node 20/22 e Cloudflare aprovados.
- Suite completa local: `358/358`; lint: `451` arquivos.
- Testes direcionados V60/retirada: `20/20` em producao.
- Guard V60, `senior:check`, produto EC, catalogo Dropi somente leitura,
  anti-spam, notificacoes de retirada, guide print e freeze lock: OK.
- `npm audit --omit=dev`: zero vulnerabilidades.
- `https://ec.maxlien.shop/api/health/`, `/n/` e `/qr.html`: HTTP `200`.
- Health publico: `online`; Z-API `connected`, `outboundBlocked=false`, sem
  erro.
- `current`, PM2 e CWD real do processo apontam para a mesma release V60.

## Preservado

- O gatilho oficial continua sendo Shipment `ENTREGADO` ou confirmacao de
  retirada com evidencia; nenhum caminho paralelo foi criado.
- Hash, historico, lock persistente, `OutboundDedupe` e
  `bonusNotifiedAt` continuam impedindo reenvio do mesmo bonus/pedido.
- Z-API continua sendo o transporte oficial.
- Nenhum replay historico em massa foi executado.
- Nenhum pedido, Shipment, Dropi, Meta/CAPI ou Purchase foi criado ou
  repetido.
- Produto, precos, VSL, checkout, pixel, numero oficial, funil, midias,
  credenciais, bancos e cadencias logisticas nao foram alterados.

Rollback nao executado; autorizacao root de uso unico consumida. Os
comprovantes persistidos de mensagens, pedidos, Shipments e deduplicacao
permanecem preservados.
