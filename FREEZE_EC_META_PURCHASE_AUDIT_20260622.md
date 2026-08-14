# Freeze EC Meta Purchase Audit - 2026-06-22

## Objetivo
Garantir que vendas confirmadas do Equador gerem Purchase Meta/CAPI e que pedidos antigos sem evento tenham caminho de recuperacao sem duplicar ou forcar evento fora da janela da Meta.

## Regra operacional congelada
- Pixel/Dataset oficial EC: 1468946114265008.
- CAPI EC ativo com token configurado e sem test_event_code.
- Purchase so e considerado tecnicamente OK quando `tracking.metaPurchaseSentAt` existe e a resposta da Meta tem `events_received: 1`.
- Vendas confirmadas sem `metaPurchaseSentAt` entram na auditoria diaria.
- Se a venda ainda estiver dentro da janela CAPI, usar retro Purchase em dry-run antes de envio real.
- Se estiver fora da janela CAPI, nao forcar CAPI: gerar export Offline/Compradores.
- Pedidos do Dropi so marcam Meta se tambem existirem no nosso banco/painel como Order vinculado; Dropi sozinho nao dispara CAPI.

## Arquivos alterados
- `scripts/audit-meta-purchase-ec.mjs`: auditoria operacional EC de PageView, Lead, Purchase enviado, pendente e erro.
- `scripts/send-meta-retro-purchases.mjs`: dry-run agora mostra detalhes dos pedidos ignorados antes do limite.
- `scripts/export-meta-offline-purchases.mjs`: export offline permite todos os pedidos EC, filtro por dias e opcional admin-only.
- `public/leads-window.html`: selo por pedido no painel: Meta Purchase enviado, Meta pendente, Meta erro ou Meta offline.
- `package.json`: script `meta:audit:purchases`.

## Evidencia VPS
Backup antes do deploy: `backups/meta-purchase-audit-20260622205552`.

Auditoria 30 dias em 2026-06-22:
- Pixel: 1468946114265008.
- Token configurado: sim, length 203.
- Test mode: false.
- API version: v20.0.
- Pedidos confirmados/processing/shipped/delivered com valor positivo: 17.
- Purchase enviado: 13.
- Purchase pendente: 4.
- Purchase com erro: 0.
- PageView: 5502.
- Lead: 116.

Pendentes fora da janela CAPI, enviados para recuperacao Offline:
- EC-DROPI-5756679, shipped, USD 40, ageDays 8.
- EC-ADMIN-1888, processing, USD 39.99, ageDays 8.
- EC-ADMIN-1895, processing, USD 95.99, ageDays 8.
- EC-ADMIN-2100, processing, USD 39.99, ageDays 8.

Dry-run retro CAPI:
- candidates: 4.
- matched: 0.
- sent: 0.
- reason: `outside_meta_server_window`.

Export Offline gerado:
- matchedOrders: 4.
- exportedEvents: 4.
- exportedAudienceRows: 4.
- CSV: `/opt/vitalismen-automacao/releases/202606141310/exports/meta/meta-offline-purchases-EC-2026-06-22T20-56-10-793Z.csv`.
- Audience CSV: `/opt/vitalismen-automacao/releases/202606141310/exports/meta/meta-buyer-audience-EC-2026-06-22T20-56-10-793Z.csv`.

Vendas da tela Dropi conferidas:
- 5855679 -> EC-MQPF0XB1-0BUO -> events_received 1.
- 5855042 -> EC-MQPE5V1U-1S73 -> events_received 1.
- 5853972 -> EC-MQP95Q1I-GBYM -> events_received 1.
- 5850517 -> EC-MQOP97E1-9H7D -> events_received 1.
- 5849534 -> EC-MQOKJKVS-VN1N -> events_received 1.
- 5849506 -> EC-MQOJDBXA-IQSZ -> events_received 1.
- 5837427 -> EC-MQMIZ2U7-LTYL -> events_received 1.
- 5835527 -> EC-MQLSJI39-5GJ0 -> events_received 1.
- 5826841/Jacinto -> EC-MQL2V6UA-PSM7 -> events_received 1.
- 5822540 -> EC-MQK8ELKZ-ZXZS -> events_received 1.

Status publico conferido:
- `https://ec.maxlien.shop/api/zapi/status`: connected true, phone 553183002800, Ana Lopez 2800.

## Como auditar diariamente
Cron ativo no VPS:
`10 8 * * * cd /opt/vitalismen-automacao/current && mkdir -p logs/meta-audit && DAY=$(/bin/date +\%Y\%m\%d) && META_AUDIT_DAYS=1 node scripts/audit-meta-purchase-ec.mjs > logs/meta-audit/ec-meta-purchase-$DAY.json 2>&1 # EC_META_PURCHASE_DAILY_AUDIT`

Rodar no VPS:
`META_AUDIT_DAYS=1 node scripts/audit-meta-purchase-ec.mjs`

Para 30 dias:
`META_AUDIT_DAYS=30 node scripts/audit-meta-purchase-ec.mjs`

Para recuperar pendentes com seguranca:
1. `META_RETRO_DAYS=7 node scripts/send-meta-retro-purchases.mjs`
2. Conferir dry-run.
3. Somente se matched > 0 e pedidos corretos, rodar com `META_RETRO_SEND=YES`.

Para pendentes fora da janela CAPI:
`META_OFFLINE_DAYS=30 node scripts/export-meta-offline-purchases.mjs`
