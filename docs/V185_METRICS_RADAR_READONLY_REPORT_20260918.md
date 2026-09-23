# Relatório V185 — métricas por IDs e Radar somente leitura

Data: 2026-09-18

Base V184: `596441983a7d05e0cd002200372aa1bd0077214b`

Branch: `codex/v185-metrics-radar-readonly`

## Resultado

```text
RESULT=PASS
V185_BRANCH=codex/v185-metrics-radar-readonly
V185_COMMIT=SEE_GIT_COMMIT_CONTAINING_THIS_REPORT

ACCESS_PROGRAMS_AVAILABLE=NO
ACCESS_PROGRAMS_REQUIRED_FOR_V185=NO
ACCESS_PROGRAMS_BLOCKING=NO

METRICS_ONLY_CHANGE=YES

CAMPAIGN_NAME_DEPENDENCY=REMOVED
CURRENT_AD_IDS_FOUND=YES
CURRENT_AD_IDS=120249000642680192,120249000412380192
CURRENT_CAMPAIGNS_FOUND=YES
META_ADS_ROWS=2_IN_ACCEPTANCE_FIXTURE
NEW_CAMPAIGN_ZERO_CONFIG=PASS

META_TABLE_ABOVE_RADAR=PASS
CREATIVE_TABLE_ABOVE_RADAR=PASS
RADAR_LAST_MAJOR_BLOCK=PASS

RADAR_NO_DATA=PASS
RADAR_LEARNING=PASS
RADAR_READY=PASS
RADAR_DEGRADED=PASS

RADAR_STATE_CURRENT=LEARNING
RADAR_CONFIDENCE_CURRENT=LOW
RADAR_CREATIVE_CURRENT=120249000642680192
RADAR_BEST_WINDOW_CURRENT=14h-15h
RADAR_BUDGET_SUGGESTION_CURRENT=NONE

VSL_ENTRIES=8
META_LPV=0
VSL_MINUS_META=8
META_MINUS_VSL=0
TRACKING_COVERAGE=0%

VSL_HASH_DIFF=0
BOT_HASH_DIFF=0
QR_PANEL_HASH_DIFF=0
META_CAPI_HASH_DIFF=0
ZAPI_HASH_DIFF=0
DROPI_HASH_DIFF=0

WRITE_COUNT=0
META_MUTATION_COUNT=0
WHATSAPP_OUTBOUND_COUNT=0
ORDER_MUTATION_COUNT=0

LINT=PASS
V171=PASS
V176=PASS
V177=PASS
V178=PASS
V179=PASS
V184=PASS
SENIOR_CHECK=PASS_482_OF_482
V140=PASS_22_OF_22
FREEZE_LOCK=PASS
PREDEPLOY=PASS
GUARDS_BYPASSED=NO

PRODUCTION_CHANGED=NO
DEPLOY_EXECUTED=NO
RESTART_EXECUTED=NO

BLOCKERS=NONE
SAFE_TO_DEPLOY_V185=YES
NEXT_ACTION=AGUARDAR_AUTORIZACAO_EXPLICITA_DE_PUBLICACAO
```

## Evidências e limites

- A aceitação automatizada encontrou os dois `ad_id` obrigatórios, resolveu duas linhas de anúncios por IDs persistidos e continuou funcionando após renomear campanha. O nome é somente rótulo.
- A consulta somente leitura da página atual de produção confirmou os dois IDs na telemetria interna e `Meta OK`, com atualização ao vivo em 2026-09-18. A tabela Meta antiga permaneceu com zero linhas porque ainda usa o filtro textual legado; a V185 remove esse filtro exclusivamente do novo endpoint opt-in.
- A credencial do `.env` local está expirada. O teste de indisponibilidade confirmou fallback `DEGRADED`, dados internos preservados e nenhuma sugestão de verba. O segredo de produção não foi lido nem alterado.
- `META_ADS_ROWS=2_IN_ACCEPTANCE_FIXTURE` é evidência do contrato V185 com os dois IDs obrigatórios; não afirma que a candidata foi executada em produção, pois deploy foi expressamente proibido.
- O cenário atual de aceitação do Radar usa os fatos registrados da missão: oito entradas VSL, zero LPV Meta, quatro conversas e uma venda sem `ad_id`. A venda permanece em `SEM_ATRIBUICAO` e não escolhe vencedor.
- Os três botões do Radar são indicadores visuais. O teste de navegador registrou zero requisições de mutação após clicar em todos.
- Desktop e mobile passaram; não houve overflow horizontal indevido.

## Verificações executadas

- `node scripts/guard-v185-metrics-radar-readonly.mjs`
- testes unitários e de rota V185: 9/9
- teste Playwright desktop/mobile V185
- guards V171/V176/V177/V178/V179/V184
- `senior:check` no contexto sucessor V185: 482/482
- guard/testes V140: 22/22
- lint JavaScript: 1.014 arquivos
- freeze lock no contexto sucessor V185
- predeploy successor chain V91 no contexto sucessor V185
- `git diff --check`

Nenhum pacote, permissão organizacional, configuração de produção, serviço, banco ou dependência foi alterado.
