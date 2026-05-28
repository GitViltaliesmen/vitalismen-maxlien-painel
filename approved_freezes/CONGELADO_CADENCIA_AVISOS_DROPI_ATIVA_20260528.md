# Congelamento - Cadencia Avisos Dropi Ativa

Data: 2026-05-28

## Estado congelado

Sistema operacional com anuncios rodando e avisos Dropi ativos no numero:

`5515991418416`

## Cadencia ativa

Avisos principais Dropi:

- `SHIPMENT_STATUS_DISPATCH_ENABLED=true`
- `SHIPMENT_STATUS_DISPATCH_ACTIONS=guide,ready_for_pickup,delivered_bonus,returned`
- `SHIPMENT_STATUS_DISPATCH_INTERVAL_MINUTES=30`
- `SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT=3`
- Capacidade pratica: ate 6 avisos por hora

Lembretes de retirada:

- `SHIPMENT_PICKUP_REMINDERS_ENABLED=true`
- `SHIPMENT_PICKUP_REMINDER_INTERVAL_MINUTES=60`
- `SHIPMENT_PICKUP_REMINDER_BATCH_LIMIT=3`
- Capacidade pratica: ate 3 lembretes por hora

Limite geral do WhatsApp/Z-API:

- `WHATSAPP_SENDER_HOURLY_LIMIT=30`
- `WHATSAPP_SENDER_MIN_GAP_MS=45000`
- `SHIPMENT_STATUS_DISPATCH_DAILY_LIMIT=60`
- `SHIPMENT_STATUS_DISPATCH_HOURLY_LIMIT_PER_SESSION=8`

## Resultado da atualizacao anterior

Pendencias principais apos varredura e envio:

- Guia: 0
- Retirada: 0
- Bonus: 0
- Devolucao: 0

PDF/faturas que tinham falhado por caminho antigo Baileys foram reenviadas pela Z-API:

- Processados: 9
- Enviados: 9

## Observacao

Existiam candidatos de lembrete de retirada em cadencia posterior. Eles nao eram pendencia principal de guia/retirada/bonus/devolucao e ficaram sob lote pequeno para proteger o numero durante trafego ativo.
