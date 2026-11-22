# Candidata V260 — guia e movimentos na ficha do chat

Estado: candidata local, sem publicação ou envio ao cliente.

## Diagnóstico observado

- Na produção Hostinger em 22/11/2026, o PM2 informa `DISABLE_SCHEDULER=1`, `SHIPMENT_STATUS_DISPATCH_ENABLED=false`, `SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED=false` e `SHIPMENT_GUIDE_PRINT_DISPATCH_ENABLED=false`. A rotina que detecta e comunica guia não roda automaticamente nesse modo.
- O caminho de aviso existente `notifyShipmentGuideGenerated` envia apenas texto e número de guia, grava `guia_notified` após sucesso e tenta persistir a mensagem no chat. A imagem/PDF e o áudio de retirada ficam reservados para `READY_FOR_PICKUP` verificado.
- O endpoint `GET /api/whatsapp/customer-profile/:phone` carregava envios mas montava a linha do tempo apenas de mensagens e pedidos, embora `Shipment.events` já guarde mudanças de status. Essa omissão fazia a ficha não mostrar movimentos registrados.

## Alteração candidata

O endpoint acrescenta à linha do tempo somente mudanças logísticas persistidas e o recibo `guia_notified` com `primaryTextSent=true`. Não inventa status, não marca envio sem prova, não envia WhatsApp e não altera o fluxo comercial. O painel `public/qr.html` já renderiza `profile.events`; não requer mudança visual.

## Validação e ativação pendente

- `node --test tests/shipment-customer-timeline-v260.test.mjs`, `node --check` e `git diff --check` devem passar antes de qualquer publicação.
- Para envio automático, é necessário sucessor selado e uma decisão coordenada sobre o modo operacional completo, com `npm run senior:check`, backup, teste de um pedido real elegível, prova do transporte, bolha persistida no painel e deduplicação. Não ativar uma flag isolada nem reenviar guias históricas sem verificar recibos anteriores.
