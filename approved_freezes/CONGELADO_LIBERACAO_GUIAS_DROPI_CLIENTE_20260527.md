# CONGELADO_LIBERACAO_GUIAS_DROPI_CLIENTE_20260527

Data: 2026-05-27

Objetivo: liberar envio automatico controlado da guia Dropi para o cliente pelo WhatsApp.

## Configuracao liberada no VPS

```env
SHIPMENT_STATUS_DISPATCH_ENABLED=true
SHIPMENT_STATUS_DISPATCH_INTERVAL_MINUTES=30
SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT=3
SHIPMENT_STATUS_DISPATCH_ADAPTIVE_ENABLED=false
SHIPMENT_STATUS_DISPATCH_ACTIONS=guide
```

## Escopo liberado

- Somente envio de guia gerada.
- Status elegivel: `GUIA_GENERADA`.
- Precisa ter `logistics.trackingNumber` preenchido.
- Precisa nao ter `automation.guiaNotifiedAt`.
- Envia texto com variacao por pedido.
- Envia PDF da guia/fatura se existir e estiver acessivel.
- Envia audio de acompanhamento da etapa de guia quando disponivel.

## Escopo nao liberado nesta etapa

- `ready_for_pickup`
- `returned`
- `delivered_bonus`
- `in_transit`
- lembretes de retirada
- lembretes de entrega

## Travas ativas

- `automation.guiaNotifiedAt` impede reenvio da guia.
- `sentMessageHashes` impede mensagem duplicada.
- `hasMinGapElapsed` impede novo aviso muito proximo do ultimo aviso do pedido.
- `sendText`, `sendAudio`, `sendImage`, `sendVideo` passam pela cadencia humanizada.
- Z-API/WhatsApp usam intervalo global configurado de 15 a 30 segundos entre envios.

## Arquivos principais

- `src/services/shipmentStatusDispatcherService.js`
- `src/services/shipmentMessageService.js`
- `src/whatsapp/humanPacing.js`
- `src/whatsapp/sendText.js`

## Observacao operacional

- Esta liberacao e adequada para teste real controlado.
- Se o volume de guias aumentar, revisar `SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT` antes de ampliar.
- Nao liberar outras acoes junto com `guide` sem novo congelamento.
