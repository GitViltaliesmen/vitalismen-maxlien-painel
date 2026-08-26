# Inventário de outbound e schedulers — V66

## Bordas de provider

| Borda comum | Provider final | Usos principais |
| --- | --- | --- |
| `src/whatsapp/sendText.js` | Z-API `sendZapiText` ou Baileys | funis, follow-ups, logística, alertas, operação manual |
| `src/whatsapp/sendAudio.js` | Z-API `sendZapiAudio` ou Baileys | funis, complementos, retirada, recompra |
| `src/whatsapp/sendImage.js` | Z-API `sendZapiImage` ou Baileys | prova/frascos e `guide_print_image` |
| `src/whatsapp/sendDocument.js` | Z-API `sendZapiDocument` ou Baileys | PDF de guia/fatura |
| `src/routes/zapi.js` | Z-API direta | respostas específicas de chamada/inbound |
| `src/routes/whatsapp.js` | Z-API documento direta | ação humana autenticada do painel |

## Caminhos logísticos automáticos

| Trigger | Dispatcher/serviço | Provider | Proteção V66 |
| --- | --- | --- | --- |
| status de guia | `shipmentStatusDispatcherService` → `notifyShipmentGuideGenerated` | texto | estágio `GUIDE`, lock/ledger/markers |
| print de guia | `guidePrintDispatcherService` → `notifyGuidePrintImage` | imagem | decisão central antes de conversão; revalidação na borda |
| PDF da guia em retirada | `notifyReadyForPickup` → `sendShipmentInvoicePdf` | documento | decisão `GUIDE` verificável antes de `sendDocument` |
| em trânsito | `notifyShipmentInTransit` | texto | estágio `IN_TRANSIT` |
| pronto para retirada | `notifyReadyForPickup` | texto/áudio | estágio `READY_FOR_PICKUP`; PDF permanece sob `GUIDE` |
| devolvido | `notifyShipmentReturned` | texto | estágio `RETURNED` |
| lembretes de retirada 1–6 | `notifyShipmentReminder` | texto/áudio | estágio próprio por passo, decisão central, lock/ledger e marker legado |
| pedido de prova | `notifyPickupProofRequest` | texto | estágio `PICKUP_PROOF_REQUEST`, decisão central e marker legado |
| bônus pós-retirada | `notifyPickupBonus` | áudio/texto/áudio | estágio `PICKUP_BONUS`; uma decisão autoriza a transação multivariante e o texto primário finaliza o ledger |
| recompra/refill | `notifyTreatmentRefillReminder` | texto/áudio | estágio `TREATMENT_REFILL_REMINDER`, decisão central e marker legado |
| liberação explícita Dropi | `postSalePickupReconciliationService` | chama retirada | decisão central de retirada + gate global |

Alertas operacionais para telefones administrativos — `health_alert` e `dropi_payment_claim_*` — não são notificação logística ao cliente. Eles permanecem fora do ledger por Shipment, usam dedupe/evento próprio e, quando disparados por scheduler, ficam atrás do gate global V66.

## Schedulers registrados por `schedulerService`

Todos os timers abaixo ficam sem registro quando o gate V66 global não está integralmente autorizado:

| Scheduler | Efeito potencial | Flag individual |
| --- | --- | --- |
| product followup | outbound texto/mídia | `WHATSAPP_PRODUCT_FOLLOWUP_ENABLED` |
| pending checkout | outbound | `PENDING_CHECKOUT_FOLLOWUP_ENABLED` |
| recompra 30d | outbound | `POST_SALE_REPURCHASE_30D_ENABLED` |
| Tex Ultra pós-venda | outbound | `TEX_ULTRA_CONFIRMED_POSTSALE_QUEUE_ENABLED` |
| pickup reminders | outbound | `SHIPMENT_PICKUP_REMINDERS_ENABLED` |
| pickup proof sweep | DB + possível bonus | `PICKUP_PROOF_SWEEP_ENABLED` |
| status dispatch | outbound logístico | `SHIPMENT_STATUS_DISPATCH_ENABLED` |
| carrier sweep | DB + possível dispatch | `SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED` |
| guide print dispatch | imagem | `SHIPMENT_GUIDE_PRINT_DISPATCH_ENABLED` |
| Dropi active sync | leitura ou mutação de Shipment | `DROPPI_EC_ACTIVE_SYNC_ENABLED` + modo V66 |
| pickup release reconcile | DB + possível outbound | acoplado ao sync ativo |
| admin import/reconcile | DB | flags `ADMIN_*` |
| backlog recovery | outbound | `WHATSAPP_BACKLOG_RECOVERY_ENABLED` |
| buy later | outbound | `ADMIN_BUY_LATER_FOLLOWUP_ENABLED` |
| health alert | outbound ao telefone de teste/ops | `WHATSAPP_HEALTH_ALERT_ENABLED` |
| Nitrix fast state | outbound/DB | `NITRIX_FAST_STATE_ENABLED` |
| Google Contacts | integração externa | `GOOGLE_CONTACTS_SYNC_ENABLED` |

## Rotas manuais

As rotas autenticadas de painel não são schedulers e continuam dependendo de autorização humana. Entretanto, toda rota que chama `notifyShipmentGuideGenerated` continua submetida à decisão central V66 mesmo quando envia `force=true`; `force` pode controlar dedupe genérico, nunca ignorar o estágio `GUIDE`.

## Bypasses encontrados e encerramento

| Bypass V65 | Causa | Estado V66 |
| --- | --- | --- |
| `guidePrintDispatcher` | lock próprio sem decisão central | eliminado |
| `force` em guia | pulava `decidePostSaleNotification` | eliminado |
| PDF em helper privado | provider não exigia token de estágio | eliminado; exige decisão GUIDE |
| Dropi sync default apply | `dryRun=false` implícito | eliminado; default REPORT_ONLY |
| timers de startup | apenas flags individuais | bloqueados antes do registro pelo gate global persistente |
| rollback `cc85952` | sem data compatibility contract | target NOT_SUPPORTED após V66 |
