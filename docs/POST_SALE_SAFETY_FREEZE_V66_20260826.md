# Congelamento V66 — anti-spam, startup seguro e compatibilidade de rollback

Data: 2026-08-26
Escopo: Vitalismen / Equador / pós-venda logístico / Dropi EC / WhatsApp oficial
Estado: candidato local validável; sem deploy, push, merge, tag, ativação ou mutação de produção

## Objetivo congelado

A V66 elimina três classes de incidente observadas na ativação V65:

1. mídia logística que alcança o provider sem a decisão anti-spam central;
2. startup que infere mutação Dropi a partir do ambiente de produção;
3. rollback de código para runtime incapaz de interpretar o contrato persistido por uma versão mais nova.

Este freeze é sucessor direto de `post-sale-gargalos-v65-20260826`, que permanece sucessor de `dropi-customer-full-name-v64-20260826`. Nenhum manifesto ancestral foi reescrito.

## Contrato de estágio

| Estágio canônico | Variantes | Marcadores legados dual-write |
| --- | --- | --- |
| `GUIDE` | `guide_text`, `guide_pdf`, `guide_print_image` | `automation.guiaNotifiedAt`, `automation.guidePrintNotifiedAt` |
| `IN_TRANSIT` | `in_transit_text` | `automation.inTransitNotifiedAt` |
| `READY_FOR_PICKUP` | texto e áudio de retirada da transação aprovada; PDF de guia continua no estágio `GUIDE` | `automation.readyForPickupNotifiedAt` |
| `RETURNED` | `returned_text` | `automation.returnedNotifiedAt` |
| `PICKUP_REMINDER_DAY1` … `PICKUP_REMINDER_SOFT_DAY6` | cada passo autorizado da cadência, com texto/áudio equivalentes dentro do próprio passo | markers `automation.reminder*At` correspondentes |
| `PICKUP_PROOF_REQUEST` | pedido de comprovante de retirada | `automation.pickupProofRequestedAt` |
| `PICKUP_BONUS` | transação multivariante de agradecimento, bônus e modo de uso | `automation.bonusNotifiedAt` |
| `TREATMENT_REFILL_REMINDER` | lembrete de recompra por tratamento concluído | `automation.refillReminderAt` |

A chave idempotente é derivada de país, pedido, tracking e estágio. A variante não cria uma chave nova. Portanto, texto, PDF e imagem da guia não podem disputar como comunicações independentes; cada passo legítimo da cadência recebe um estágio próprio e não colide com os demais dias.

## Decisão, lock e ledger

O fluxo congelado é:

```text
trigger
→ scheduler/dispatcher
→ decidePostSaleNotification
→ lock persistente automation.notificationLocks.<STAGE>
→ provider somente com SHOULD_SEND + token + chave idempotente válidos
→ finalização atômica
→ safety ledger + marcadores legados dual-write
```

O ledger canônico fica em `automation.postSaleSafetyLedger.<STAGE>` e registra:

- estágio e variante;
- estado (`LOCKED`, `SENT`, `RECOVERED_STRUCTURED`, `RECOVERED_MANUAL`, `SUPPRESSED_HISTORICAL` ou `FAILED_RETRYABLE`);
- decisão e motivo;
- chave idempotente;
- timestamps de decisão e finalização;
- provider message ID quando aplicável;
- `dataCompatibilityVersion = 66`.

Estados terminais bloqueiam novas aquisições. Falha de provider registra `FAILED_RETRYABLE` e libera somente o lock que possua o mesmo token. Evidência humana ou supressão V65 materializa ledger e marcadores legados sem enviar mensagem.

## Última barreira antes do provider

`notifyGuidePrintImage` exige uma decisão central verificável com:

- `decision = SHOULD_SEND`;
- `stage = GUIDE`;
- `lockToken` presente;
- chave idempotente igual à chave recalculada para o Shipment.

O dispatcher consulta a decisão antes de converter/enviar e entrega a mesma decisão à borda de mídia. O parâmetro histórico `force` não ignora mais a decisão central.

## Startup seguro

O modo padrão é `SAFE_OBSERVATION_ONLY`. Ausência, `false` ou qualquer valor diferente de `true` em `POST_SALE_V66_MUTATIONS_ENABLED` bloqueia toda automação mutante de startup.

A liberação operacional exige simultaneamente:

```text
POST_SALE_V66_MUTATIONS_ENABLED=true
POST_SALE_V66_MUTATIONS_AUTHORIZATION=I_UNDERSTAND_V66_OPERATIONAL_MUTATIONS
POST_SALE_V66_COMPATIBILITY_BRIDGE_READY=true
```

Além das três flags, o registro persistente `_id=post-sale-safety-v66` precisa afirmar:

```text
bridgeComplete=true
dataCompatibilityVersion=66
minRuntimeVersion<=66
```

Sem esse conjunto, API, painel, health e consulta passiva de Z-API podem funcionar, mas o scheduler não é registrado e nem a reconciliação state-only de startup é executada.

## Modos do sync Dropi

Existem somente:

- `REPORT_ONLY` — padrão e read-only quanto a Shipments;
- `DRY_RUN` — simulação explícita, read-only quanto a Shipments;
- `APPLY` — exige modo explícito e o gate operacional V66 integral.

`NODE_ENV=production`, PM2, restart, symlink ou `DROPPI_EC_ACTIVE_SYNC_ENABLED=true` isoladamente não autorizam `APPLY`. Valor ausente ou inválido falha fechado em `REPORT_ONLY`.

## Fases de futura publicação

### Fase A — safety bridge

1. publicar runtime V66 com mutações desabilitadas;
2. confirmar health/observabilidade sem scheduler;
3. executar `npm run post-sale:v66:bridge:report`;
4. revisar integralmente o relatório sanitizado;
5. em janela aprovada separadamente, executar o bridge `--apply` com a frase de autorização;
6. confirmar markers dual-write e o contrato persistente V66;
7. manter mutações desabilitadas.

### Fase B — liberação operacional

Somente em outra decisão operacional:

1. validar o target de rollback com `npm run post-sale:v66:compatibility`;
2. escolher `DROPPI_EC_ACTIVE_SYNC_MODE` explicitamente;
3. habilitar as três credenciais V66;
4. iniciar com batch mínimo e observar provider/ledger;
5. nunca voltar para `cc85952` ou V65 após o banco elevar `minRuntimeVersion=66`.

## Política de rollback

Rollback é troca de runtime, nunca limpeza de dados. O alvo é bloqueado quando `runtimeVersion < minRuntimeVersion` do banco. A V66 também dual-write markers legados como defesa adicional, mas essa defesa não transforma um runtime antigo em alvo suportado: o baseline possui startup mutante inseguro e não lê o contrato V66.

## Garantias desta missão

- nenhum Shipment real foi editado;
- nenhum histórico, provider ID ou supressão foi apagado;
- nenhuma mensagem real foi enviada;
- nenhuma submissão ou sync Dropi real foi executado;
- nenhum deploy, push, merge, tag, symlink ou ação PM2 foi executado;
- candidato `1264` permanece `MANUAL_REVIEW_REQUIRED`;
- V64 e V65 permanecem ancestrais íntegros.
