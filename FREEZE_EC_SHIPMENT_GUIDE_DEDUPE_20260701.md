# Freeze EC - Shipment guide dedupe

Data: 2026-07-01
Dominio: ec.maxlien.shop
Pais: EC
Escopo: avisos logisticos Servientrega/Dropi para clientes Equador

## Problema

O aviso automatico de guia Servientrega podia ser bloqueado pela trava de historico como se fosse repeticao de aviso de retirada em agencia.

Evidencia principal:

- Pedido: EC-MR23YTB3-0Q0W
- Cliente: final 4065
- Guia Servientrega: 185572844
- Falha anterior: `text_send_failed`
- Log: `texto repetido bloqueado por historico -> 593991564065@c.us | reason=history_repeat | key=logistics_ready_for_pickup`

## Causa

`src/whatsapp/sendText.js` classificava mensagens com palavras como `servientrega`, `agencia`, `guia` e `ya esta` como `logistics_ready_for_pickup`, mesmo quando o texto era apenas confirmacao de guia gerada/envio.

Isso misturava dois momentos diferentes:

- guia gerada/enviada;
- pedido pronto para retirada.

## Correcao

Arquivo alterado:

- `src/whatsapp/sendText.js`

Regra nova:

- aviso de guia/enviado: `logistics_guide:<numero_da_guia>`;
- aviso pronto para retirada: `logistics_ready_for_pickup:<numero_da_guia>`.

Assim a trava continua bloqueando repeticao real, mas nao bloqueia a etapa correta da guia.

## Backup

Backup de producao:

- `/opt/vitalismen-automacao/current/backups/shipment-guide-dedupe-ec-20260701114852/sendText.js`

## Validacao

Validacoes executadas:

- `node --check src/whatsapp/sendText.js` local e producao.
- PM2 `vitalismen-automation` reiniciado e online.
- Health EC online com Z-API conectada:
  - provider: Z-API
  - telefone: 553183002800
  - nome: Ana Lopez 2800
- Fila de despacho apos correcao: `shipmentDispatchCandidates: 0`.
- Pedido EC-MR23YTB3-0Q0W:
  - `guia_notified` com `primaryTextSent: true`;
  - `invoiceSent: true`;
  - audio `CONFIRMACION_Y_REGALITO_ESPECIAL` enviado;
  - `shipment_dispatch_attempt` final `success: true`.
- Logs Z-API:
  - texto da guia enfileirado para 593991564065;
  - PDF da guia/fatura enfileirado para 593991564065;
  - audio da guia enfileirado para 593991564065;
  - webhooks de entrega retornaram `status=delivered`.
- Print da guia no painel:
  - `/media/shipments/guide-prints/EC-MR23YTB3-0Q0W_185572844.png`
  - `providerMessageId=3EB07C2970C8BA0496A196`
  - `deliveryStatus=sent`, depois webhook `delivered` casado por `provider_id`.

## Pendencia controlada

Texto, PDF e audio da guia foram entregues pela Z-API, mas os webhooks deles apareceram como `matched=false`, porque ainda nao existe bolha persistida para todos os envios logisticos automaticos.

Proximo fechamento recomendado:

1. Persistir bolha de painel com `providerMessageId` para texto, PDF e audio dos avisos logisticos.
2. Exibir `enviado`, `entregue` e `lido` para todos esses avisos, nao so para mensagens ja registradas.
3. Manter Servientrega como referencia de status antes de aviso de retirada, entregue ou devolvido.

## Regra final congelada

No EC, aviso de guia Servientrega nao pode ser deduplicado como aviso de retirada. Guia e retirada sao etapas separadas.
