# Freeze EC - Shipment panel provider status

Data: 2026-07-01
Dominio: ec.maxlien.shop
Pais: EC
Escopo: avisos logisticos Servientrega/Dropi no painel WhatsApp

## Objetivo

Fazer os avisos logisticos aparecerem no painel com rastreio de envio/entrega/leitura usando o mesmo `providerMessageId` que a Z-API retorna.

## Problema anterior

Texto, PDF e audio dos avisos logisticos podiam chegar ao cliente pela Z-API, mas o webhook de entrega voltava como `matched=false` porque nao existia bolha persistida no painel com o `providerMessageId`.

Sintoma observado:

- `ZAPI-WEBHOOK delivery | matched=false`
- Cliente recebia, mas o painel nao conseguia refletir todos os status como WhatsApp normal.

## Correcao

Arquivos alterados:

- `src/services/shipmentMessageService.js`
- `src/whatsapp/sendDocument.js`
- `src/routes/zapi.js`

Mudancas:

1. `sendDocument` agora pode retornar detalhes quando `returnDetails=true`:
   - `provider`
   - `providerMessageId`
   - `providerZaapId`
   - `providerStatus`
   - `providerPayload`
2. `shipmentMessageService` agora grava bolha `Message` para:
   - texto de guia;
   - PDF guia/fatura;
   - audio de guia;
   - texto de retirada;
   - PDF de retirada;
   - audio de retirada;
   - aviso em rota;
   - lembretes de retirada;
   - devolucao/pre-pago;
   - pedido de comprovante;
   - bonus pos-retirada;
   - lembrete de recompra/tratamento.
3. Cada bolha fica com:
   - `provider: zapi`;
   - `providerMessageId`;
   - `ack: 1`;
   - `deliveryStatus: sent`;
   - `orderId`;
   - telefone do cliente;
   - `mediaUrl` quando for PDF/audio.
4. `/api/zapi/webhook/received` com `fromMe=true` agora tambem tenta aplicar status `sent` por `providerMessageId`.
5. `/api/zapi/webhook/delivery` segue elevando para `delivered` e `read` quando a Z-API enviar essas confirmações.

## Backup producao

Backup criado no VPS:

- `/opt/vitalismen-automacao/current/backups/shipment-panel-provider-status-ec-20260701121213/`

## Validacao

Validacoes executadas:

- `node --check src/services/shipmentMessageService.js`
- `node --check src/whatsapp/sendDocument.js`
- `node --check src/routes/zapi.js`
- PM2 `vitalismen-automation` reiniciado e online.
- Health EC:
  - status: online
  - engine: Z-API
  - WhatsApp ready: true
  - Z-API connected: true
  - telefone conectado: 553183002800
  - nome: Ana Lopez 2800
  - fila inbound: 0
- Automacao:
  - `shipmentDispatchCandidates: 0`
  - `shipmentNotificationCandidates: 0`
  - `whatsappQueue: 0`

## Regra final congelada

Todo aviso logistico automatico do EC deve criar uma bolha no painel com o `providerMessageId` da Z-API. O webhook de entrega/leitura deve atualizar essa bolha pelo id do provedor, evitando `matched=false` em novos avisos logisticos.

## Observacao

Alertas antigos de `matched=false` podem permanecer no historico antes desta data. A correcao vale para novos envios a partir deste freeze.
