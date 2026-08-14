# FREEZE EC - Servientrega status sweep

Data: 2026-07-01
Pais: Equador
Dominio: ec.maxlien.shop

## Problema

O painel dependia muito do status vindo do Dropi ou de gatilhos de aviso. Guias ja notificadas podiam mudar na Servientrega sem refletir todo o ciclo em Shipment, Order e painel. Isso criava risco de:

- cliente em agencia virar novidade/devolucao sem a operacao enxergar;
- cliente devolvido continuar elegivel para novo envio contra entrega;
- pedido entregue/devolvido nao fechar cobranca e recompra corretamente.

## Causa

O rastreio da transportadora ja existia e normalizava status como `READY_FOR_PICKUP`, `NOVEDAD`, `ENTREGADO` e `DEVUELTO`, mas `saveCarrierTrackingResult` atualizava principalmente o objeto `Shipment`. Faltava aplicar o status da Servientrega como ciclo operacional completo:

- `Shipment.logistics.status`;
- `Shipment.outcomes`;
- fila/revisao manual;
- `Order.status` e `Order.shippingStatus`;
- status no painel SQLite.

Tambem faltava uma varredura independente de guias ativas. O refresh so acontecia em certos pontos de envio de mensagens.

## Correcao

Foi adicionada uma camada central `shipmentLifecycleStatusService` para aplicar status logistico de transportadora no Shipment, Order e painel.

Regras finais:

- `INGRESANDO EN AGENCIA` / `PARA RETIRO EN AGENCIA` => `READY_FOR_PICKUP`.
- `NOVEDAD`, `Novedad en CS`, incidencia ou reprogramacao => `NOVEDAD`.
- `NOVEDAD` deixa o pedido como enviado internamente, mas coloca o atendimento em conferencia:
  - `Shipment.review.manualOnly = true`;
  - `Order.reviewQueue.status = conferir_pedidos`;
  - painel SQLite = `conferir_pedidos`.
- `DEVUELTO`, devolucao, retornado ou no retirado => `DEVUELTO`.
- `DEVUELTO` fecha o pedido como devolvido e marca:
  - `Shipment.outcomes.returned = true`;
  - `Shipment.outcomes.prepaidOnly = true`;
  - `Order.status = returned`;
  - painel SQLite = `devolvido`.
- `ENTREGADO` fecha como entregue e libera elegibilidade para nova compra.
- Um status final real (`entregue`, `devolvido`, `cancelado`) pode sobrescrever `conferir_pedidos` no painel quando a transportadora resolver a novidade.

## Varredura

Foi ativada a varredura automatica:

- env: `SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED`, padrao `true`;
- intervalo padrao: 60 minutos;
- lote padrao: 6 guias;
- gap minimo por guia: 50 minutos;
- janela de busca: 45 dias.

Rotas adicionadas:

- `GET /api/shipments/carrier/ec/sweep/status`
- `POST /api/shipments/carrier/ec/sweep/run`

`/api/automation/status` agora mostra `carrierSweepCandidates` e estado da varredura.

## Arquivos alterados

- `src/services/shipmentLifecycleStatusService.js`
- `src/services/carrierTrackingService.js`
- `src/services/droppiEcuadorService.js`
- `src/services/shipmentStatusDispatcherService.js`
- `src/services/schedulerService.js`
- `src/services/adminPanelStatusService.js`
- `src/routes/shipments.js`
- `src/routes/automation.js`
- `public/qr.html`

## Backups de producao

- `/opt/vitalismen-automacao/current/backups/servientrega-status-sweep-ec-20260701122830`
- `/opt/vitalismen-automacao/current/backups/servientrega-status-admin-final-ec-20260701123300`

## Evidencias

Normalizacao local:

- `Novedad en CS` => `NOVEDAD`;
- `PARA RETIRO EN AGENCIA SERVIENTREGA` => `READY_FOR_PICKUP`;
- `INGRESANDO EN AGENCIA` => `READY_FOR_PICKUP`.

Casos reais verificados em producao:

- Jhon Paul, guia `185536106`:
  - Servientrega retornou `Pendiente` com ultimo movimento `Novedad en CS`;
  - normalizado para `NOVEDAD`;
  - `Shipment.logistics.status = NOVEDAD`;
  - `Order.shippingStatus = NOVEDAD`;
  - `Order.reviewQueue.status = conferir_pedidos`;
  - painel SQLite: `conferir_pedidos`.

- Emerson Cotacachi, guia `185530197`:
  - Servientrega retornou `Pendiente` com ultimo movimento `Devuelto de CS ATUNTAQUI_PRINCIPAL`;
  - normalizado para `DEVUELTO`;
  - `Shipment.logistics.status = DEVUELTO`;
  - `Shipment.outcomes.returned = true`;
  - `Shipment.outcomes.prepaidOnly = true`;
  - `Order.status = returned`;
  - painel SQLite: `devolvido`.

Saude apos deploy:

- `GET /health` => `{"status":"ok"}`;
- PM2 `vitalismen-automation` online;
- `carrierSweepCandidates` caiu de 10 para 3 apos consultas/varredura inicial;
- `node --check` aprovado na VPS para arquivos alterados.

## Regra operacional congelada

Para status logistico do Equador, a Servientrega passa a ser a referencia operacional mais fiel. Dropi continua sendo usado para criacao, guia e apoio, mas quando o rastreio da Servientrega indicar `NOVEDAD`, `ENTREGADO` ou `DEVUELTO`, o painel deve refletir esse estado para evitar cobranca indevida, avisos errados e novo envio contra entrega a cliente que nao retirou.
