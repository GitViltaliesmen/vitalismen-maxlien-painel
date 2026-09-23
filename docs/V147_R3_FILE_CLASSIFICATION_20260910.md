# V147-R3 — classificação integral dos arquivos

Baseline: `4d848d749255bfd0a7bdc47ac52390b74311966b`. A matriz cobre todos os arquivos da diferença final contra produção, incluindo este documento. `YES` em `PAYMENT_GATE_SPECIFIC` identifica conteúdo criado no R3 de pagamento; a decisão `KEEP` significa que o arquivo foi convertido para a regra DELIVERED ou contém uma correção independente ainda necessária. Os artefatos exclusivos de pagamento foram removidos ou renomeados e não aparecem na diferença final.

| FILE | CHANGE_PURPOSE | PAYMENT_GATE_SPECIFIC | INDEPENDENT_CORRECTNESS_FIX | TEST_ONLY | GUARD_ONLY | BOOTSTRAP_ONLY | REQUIRED_BY_FINAL_RULE | KEEP_OR_REVERT | REASON |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| docs/ARQUITETURA_AUTOMACAO_OFICIAL.md | Registrar arquitetura V147 | YES | YES | NO | NO | NO | YES | KEEP | Substitui a regra financeira pela conclusão Servientrega |
| docs/V147_POSTSALE_CANONICAL_RESTORATION_20260909.md | Contrato V147 base | NO | YES | NO | NO | NO | YES | KEEP | Documenta estados e reconciliação canônica |
| docs/V147_R2_POSTSALE_COMPLETE_20260910.md | Contrato P5/P7 R2 | NO | YES | NO | NO | NO | YES | KEEP | Ancestral auditável da candidata |
| docs/V147_R3_DELIVERED_SINGLE_GATE_20260910.md | Contrato final R3 | YES | YES | NO | NO | NO | YES | KEEP | Reescrito sem gate financeiro |
| docs/V147_R3_FILE_CLASSIFICATION_20260910.md | Matriz de escopo | YES | YES | NO | NO | NO | YES | KEEP | Prova a decisão arquivo a arquivo |
| docs/freeze/ec-delivered-single-gate-v147-r3-20260910.json | Manifesto final R3 | YES | YES | NO | YES | NO | YES | KEEP | Substitui o manifesto exclusivo de pagamento |
| docs/freeze/ec-postsale-canonical-restoration-v147-20260909.json | Freeze V147 base | NO | YES | NO | YES | NO | YES | KEEP | Ancestral do preload oficial |
| docs/freeze/ec-postsale-complete-v147-r2-20260910.json | Freeze R2 | NO | YES | NO | YES | NO | YES | KEEP | Preserva identidade da candidata aprovada |
| ops/post-sale-v116 | Executor seguro e staging-check | NO | YES | NO | NO | NO | YES | KEEP | Elimina escrita no PM2 home e prova plan em staging |
| package.json | Encadear testes e guard final | YES | YES | NO | NO | YES | YES | KEEP | Remove referências ao guard de pagamento |
| public/qr.html | Projetar estado canônico no painel | NO | YES | NO | NO | NO | YES | KEEP | DELIVERED precisa chegar ao painel como entregue |
| scripts/audit-post-sale-v147-readonly.mjs | Auditoria live e catch-ups | YES | YES | YES | NO | NO | YES | KEEP | Produz listas, hashes, divergências e target sem escrita |
| scripts/guard-delivered-single-gate-v147-r3.mjs | Guard final R3 | YES | YES | YES | YES | NO | YES | KEEP | Detecta retorno de gate financeiro ou atalho de pickup proof |
| scripts/guard-integration-health-v145.mjs | Compatibilidade do sucessor | NO | YES | YES | YES | NO | YES | KEEP | Preserva V145 sob arquivos substituídos de forma auditada |
| scripts/guard-pickup-bonus-delivery-v60.mjs | Guard V60 sucedido | YES | YES | YES | YES | NO | YES | KEEP | Mantém dedupe do bônus e passa a exigir DELIVERED Servientrega |
| scripts/guard-post-sale-canonical-restoration-v147.mjs | Guard V147 base | NO | YES | YES | YES | NO | YES | KEEP | Protege estados, mídia e reconciliação |
| scripts/guard-post-sale-complete-v147-r2.mjs | Guard R2 | NO | YES | YES | YES | NO | YES | KEEP | Protege P5/P7 ancestrais |
| scripts/guard-post-sale-safety-v66.mjs | Compatibilidade anti-spam | NO | YES | YES | YES | NO | YES | KEEP | Mantém ledger/lock e aceita extensão P7 controlada |
| scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs | Preload sucessor V144 | NO | YES | NO | NO | YES | YES | KEEP | Carrega overrides sem enfraquecer hash ancestral |
| scripts/lib/ec-runtime-successor-v146-context.mjs | Preload sucessor V146 | NO | YES | NO | NO | YES | YES | KEEP | Preserva V146 na cadeia oficial |
| scripts/lib/ec-runtime-successor-v147-context.mjs | Preload V147 | NO | YES | NO | NO | YES | YES | KEEP | Valida manifesto V147 base |
| scripts/lib/ec-runtime-successor-v147-r2-context.mjs | Preload R2 | NO | YES | NO | NO | YES | YES | KEEP | Valida manifesto R2 |
| scripts/lib/ec-runtime-successor-v147-r3-context.mjs | Preload final R3 | YES | YES | NO | NO | YES | YES | KEEP | Aponta ao manifesto DELIVERED final |
| scripts/senior-guard.mjs | Cadeia de testes oficial | YES | YES | YES | YES | NO | YES | KEEP | Executa a nova suíte sem remover cobertura ancestral |
| src/models/Order.js | Evidência logística canônica | NO | YES | NO | NO | NO | YES | KEEP | Propagação Shipment→Order |
| src/models/PostSaleDispatchQuota.js | Cota atômica por evento | NO | YES | NO | NO | NO | YES | KEEP | Isola clientes e workers concorrentes |
| src/models/Shipment.js | Marcador P7 e evidência canônica | NO | YES | NO | NO | NO | YES | KEEP | Dedupe próprio, locks e status persistido |
| src/routes/shipments.js | Pickup proof somente evidência | YES | YES | NO | NO | NO | YES | KEEP | Remove promoção manual para entregue e disparos |
| src/services/canonicalLogisticsStatusV147Service.js | Status e gate único | YES | YES | NO | NO | NO | YES | KEEP | Valida DELIVERED bruto Servientrega e identidades |
| src/services/carrierTrackingService.js | Normalização Servientrega | NO | YES | NO | NO | NO | YES | KEEP | Produz o status canônico da fonte autorizada |
| src/services/droppiEcuadorImportService.js | Restauração Shipment idempotente | NO | YES | NO | NO | NO | YES | KEEP | Reconciliará target sem duplicar Dropi/guia |
| src/services/ecPhoneServientregaReconciliationV140Service.js | Incluir Order sem Shipment | NO | YES | NO | NO | NO | YES | KEEP | Corrige exclusão V140 do target |
| src/services/guidePrintDispatcherService.js | Revalidação canônica | NO | YES | NO | NO | NO | YES | KEEP | Impede ação com identidade/status obsoleto |
| src/services/logisticsCommunicationV29.js | Linguagem READY fail-closed | NO | YES | NO | NO | NO | YES | KEEP | ENTERING_AGENCY não pode liberar retirada |
| src/services/postSaleCatchupV147Service.js | Seletores e hashes de catch-up | YES | YES | NO | NO | NO | YES | KEEP | Separa READY de DELIVERED closure |
| src/services/postSaleNextEligibleMonitorV112Service.js | Seleção DELIVERED estrita | YES | YES | NO | NO | NO | YES | KEEP | Remove outcomes/pickup proof como conclusão |
| src/services/postSaleNotificationDecisionService.js | Gate antes do lock/provider | YES | YES | NO | NO | NO | YES | KEEP | Defesa central P5/P6/P7 |
| src/services/postSalePickupReconciliationService.js | Reconciliação histórica segura | NO | YES | NO | NO | NO | YES | KEEP | Evita replay e usa ledger persistido |
| src/services/postSaleSafetyV66Service.js | Estágio e dedupe P7 | NO | YES | NO | NO | NO | YES | KEEP | P7 independente e at-most-once |
| src/services/postSaleTemplateCatalogV147Service.js | Catálogo A07/A10/A19/P5/P6/P7 | NO | YES | NO | NO | NO | YES | KEEP | Preserva mídia e produto corretos |
| src/services/postSaleTransactionalSafetyV116Service.js | Cota/timeout transacional | NO | YES | NO | NO | NO | YES | KEEP | Concorrência e no-blind-retry |
| src/services/shipmentLifecycleStatusService.js | Propagação e cancelamento A10/A19 | YES | YES | NO | NO | NO | YES | KEEP | DELIVERED atualiza projeções e limpa locks pendentes |
| src/services/shipmentMessageService.js | P5/P6/P7, pacing e pickup proof | YES | YES | NO | NO | NO | YES | KEEP | Remove pagamento e exige gate único em cada etapa |
| src/services/shipmentStatusDispatcherService.js | Fila DELIVERED estrita | YES | YES | NO | NO | NO | YES | KEEP | Exige evidência Servientrega antes da sequência |
| tests/pickup-bonus-delivery-v60.test.mjs | Regressão V60 autorizada | YES | YES | YES | NO | NO | YES | KEEP | Atualiza apenas a asserção sucedida e mantém a classe de regressão |
| tests/post-sale-canonical-restoration-v147.test.mjs | Matriz V147 | YES | YES | YES | NO | NO | YES | KEEP | Prova estados, target, P5, reconciliação e dedupe |
| tests/post-sale-delivered-single-gate-v147-r3.test.mjs | Matriz final R3 | YES | YES | YES | NO | NO | YES | KEEP | Cobre gate, sequência, restart, concorrência e catch-ups |
| tests/shipment-pickup-notification.test.mjs | Regressão de retirada | NO | YES | YES | NO | NO | YES | KEEP | Preserva A07/A10/A19 e anti-spam |
| tests/tex-ultra-how-to-use-audio-v31.test.mjs | Dedupe manual/P7 Tex | NO | YES | YES | NO | NO | YES | KEEP | Evita segundo áudio de uso |

## Correções independentes auditadas

| ITEM | NECESSARY | PROOF | REGRESSION_RISK | KEEP |
|---|---|---|---|---|
| P7 como estágio independente | YES | `PRODUCT_USAGE`, ledger e `usageNotifiedAt` têm teste próprio | Duplicar ou omitir modo de uso | YES |
| marcador/dedupe próprio de P7 | YES | restart envia zero e provider é chamado no máximo uma vez | Reenvio após reinício | YES |
| dedupe compartilhado com envio manual Tex Ultra | YES | teste recupera providerMessageId existente sem nova borda | Segundo áudio ao mesmo cliente | YES |
| revalidação de fila | YES | lock de reminder exige READY e tracking; dispatcher exige DELIVERED bruto | Envio com status obsoleto | YES |
| concorrência | YES | reserva persistente e teste de dois workers | Chamadas duplicadas ao provider | YES |
| pacing | YES | `waitFn` precede as bordas P6 e P7 | Rajada P5/P6/P7 | YES |
| preload/propagação de contexto | YES | guard carrega V97→V147-R3 e verifica hashes ancestrais | Release inicia sem guard congelado | YES |
| teste V31 atualizado | YES | envio manual e P7 compartilham dedupe canônico | Regressão no modo de uso Tex Ultra | YES |

## Complexidade de pagamento removida

Foram removidos da árvore final o normalizador artificial de prova financeira, os gates de pagamento de P6/P7, a matriz yes/no/unknown, o audit financeiro e os nomes de guard, teste, documento e manifesto dedicados a pagamento. `shipmentPaymentConfirmed()` permanece com sua semântica preexistente e sem referência nos blocos P5/P6/P7.
