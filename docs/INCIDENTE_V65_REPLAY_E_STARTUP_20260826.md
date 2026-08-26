# Relatório de incidente — V65, replay pós-rollback e startup Dropi mutante

Data do incidente e contenção: 2026-08-26
Sistema: Vitalismen Ecuador
Severidade: crítica por risco de spam e mutação operacional não autorizada

## Resumo executivo

A release V65 (`production-20260826-1a3b9a5`, commit `1a3b9a517960d8f48d871d33a4a4098ee63d6fbd`) passou health, guards e testes, mas revelou três lacunas de integração:

1. `guidePrintDispatcherService` enviava `guide_print_image` por um caminho que não consultava `decidePostSaleNotification`;
2. a V65 escreveu supressões que o baseline `cc85952` não conhecia; o rollback de código reabriu eventos históricos;
3. o sync Dropi ativo possuía `dryRun=false` por padrão e foi iniciado automaticamente cerca de 30 segundos após o restart.

O processo foi contido com `vitalismen-automation=stopped`, PID final `0`, estado parado salvo no PM2 e `/current` retornado para `/opt/vitalismen-automacao/releases/20260826T054900Z_production-20260826-cc85952`. O baseline permaneceu inativo por ser incompatível e inseguro para reinício.

## Linha do tempo comprovada

| Ordem | Evento | Evidência/efeito |
| ---: | --- | --- |
| 1 | V65 ativada | health online; Z-API connected; runtime guards OK; testes PASS |
| 2 | startup + ~30 s | sync `dropi_orders_api_with_dom_fallback` executado em apply |
| 3 | sync concluído | `SEEN=205`, `MATCHED=182`, `UPDATED=79`, `UNCHANGED=103`, `NO_MATCH=20`, `AMBIGUOUS_MATCH=3` |
| 4 | dispatcher de print | caudas 6457 e 4818 receberam uma imagem real cada apesar de decisão equivalente manual |
| 5 | rollback de código | `/current` retornou ao baseline `cc85952` |
| 6 | runtime antigo | campos V65 de supressão foram ignorados e houve replay para 9599 e 7146/990287146 |
| 7 | contenção | processo parado; PID 0; PM2 save; nenhuma nova tentativa autorizada |

O PID efêmero da ativação V65 não foi copiado para este repositório antes da contenção. Para não inventar evidência, este relatório registra o único PID final verificável (`0`) e os identificadores imutáveis de release/commit. O log original do host e as coleções de Message/Shipment permanecem a fonte auditável dos PIDs/provider IDs históricos.

## Comunicações reais preservadas

O operador registrou cinco comunicações reais no incidente. O escopo conhecido inclui:

| Grupo sanitizado | Tipo/causa | Tratamento V66 |
| --- | --- | --- |
| `…6457` | `guide_print_image` real; bypass | histórico reconhecido; todas as variantes GUIDE bloqueadas |
| `…4818` | `guide_print_image` real; bypass | memória semântica preservada na transição EN_RUTA → READY |
| `…9599` | replay após rollback | supressão + markers dual-write + runtime antigo bloqueado |
| `…7146` / `…990287146` | replay após rollback; duas comunicações humanas anteriores | histórico humano e supressão preservados |

Os provider IDs reais não são reproduzidos no Git. Referências sanitizadas: `provider:…6457`, `provider:…4818`, `provider:…9599`, `provider:…7146`. Os valores completos permanecem nos registros Message/ledger de produção. Nenhuma das cinco comunicações deve ser apagada, marcada como não enviada, alterada ou compensada automaticamente.

## Root cause A — mídia fora da decisão central

O dispatcher possuía seu próprio `guidePrintDispatchLockedUntil`, consultava `guidePrintNotifiedAt`, convertia o PDF e chamava `notifyGuidePrintImage`. Isso protegia concorrência local do caminho de imagem, mas não equivalência semântica entre texto/PDF/imagem, histórico humano, supressão V65 ou o lock central por estágio.

Assim, o sistema podia produzir simultaneamente uma resposta correta na decisão central (`ALREADY_NOTIFIED_MANUALLY`) e um envio real em outro caminho que jamais consultou essa decisão.

## Root cause B — rollback de código sem contrato de dados

A V65 persistiu `reviewStatus=superseded_by_authoritative_logistics` e `review.suppressedNotificationKinds`. O schema/runtime `cc85952` não interpretava esses campos na decisão de envio. O rollback trocou binários, mas manteve corretamente os dados novos; o runtime antigo concluiu incorretamente que etapas não haviam sido comunicadas.

A causa não foi “dado sujo”. Foi ausência de uma versão persistente de compatibilidade e ausência de bloqueio técnico do target.

## Root cause C — apply inferido no startup

`syncActiveDroppiEcuadorOrdersFromPanel` tinha `dryRun=false` como default. `checkDropiActiveSync` o chamava apenas com `maxRows`. Com `DROPPI_EC_ACTIVE_SYNC_ENABLED`, o scheduler agendava a primeira execução após 30 segundos. Não existia separação entre “subir release para observar” e “autorizar mutações operacionais”.

## Contenção executada

- interrupção do processo `vitalismen-automation`;
- persistência do estado parado no PM2;
- retorno do symlink ao baseline identificado;
- nenhuma nova inicialização do baseline incompatível;
- nenhuma limpeza de Shipment, tracking, suppression ou provider ID;
- nenhuma mensagem compensatória;
- abertura da missão V66 em branch local separada.

## Ações corretivas V66

- estágio canônico e chave idempotente por etapa;
- lock persistente com token de propriedade;
- ledger de segurança terminal e retryable;
- dual-write de markers antigos ao recuperar história/supressão;
- provider de imagem/PDF condicionado a `SHOULD_SEND` verificável;
- startup safe-by-default sem scheduler ou reconciliação mutante;
- sync `REPORT_ONLY`/`DRY_RUN`/`APPLY`, com APPLY nunca inferido;
- `OperationalSafetyState` com `dataCompatibilityVersion` e `minRuntimeVersion`;
- bloqueio de target anterior ao contrato de dados;
- bridge separado, default REPORT_ONLY e sem replay;
- 44 testes V66 permanentes, incluindo os quatro grupos de controle, 1264, as demais bordas logísticas automáticas e a matriz explícita de replay.

## Estado do incidente

Contido, não encerrado operacionalmente. O código candidato corrige as causas, mas produção continua parada e nenhuma fase A/B foi autorizada. Encerramento exige futura publicação controlada, confirmação de provider calls zero e liberação operacional separada.
