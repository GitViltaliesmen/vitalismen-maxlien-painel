# Auditoria do pedido histórico administrativo — v7

Data: 2026-08-15
Projeto: Vitalismen Automação — Ecuador
Base local: `dd1abb32e75315716e01b3f08ba99449907bdfe5`

## 1. Objetivo

Validar o caso real do Angel e equivalentes, liberar o Funil Rápido manual universal para cliente EC em atendimento humano e preservar a compra/lead administrativo anterior quando houver uma negociação atual distinta.

## 2. Restrições cumpridas

- nenhuma mutação de cliente, pedido, conversa ou banco foi usada na auditoria;
- nenhum backfill histórico;
- nenhuma venda real ou evento Meta;
- nenhuma mensagem WhatsApp ou operação Dropi;
- nenhum push ou deploy v7;
- produção restaurada e preservada em `b53e575`;
- arquivo local preexistente fora do Git preservado.

## 3. Evidência real sanitizada

O estado consultado em leitura retornou país `EC`, modo humano `manual`, identificador `EC-ADMIN-3338`, status `atendendo`, negociação atual sem `orderId` e tags operacionais `ZAPI_INBOUND_CAPTURED`, `PANEL_UNIFIED_IMPORTED`, `admin:atendendo` e `manual:atendimento_iniciado`.

As tags `ANTIGO` e `CLIENTE ANTIGO` não estavam persistidas. Esses rótulos eram produzidos visualmente por `chatEntryInfo`, usando a data de entrada.

## 4. Causa raiz

`historicalOrderIdFromChat` fornecia à política apenas status, tags e `currentNegotiationOrderId`. A política v6 reconhecia histórico por status terminal ou tag legada. O teste anterior inseria tags legadas artificiais e, portanto, não representava o registro real.

No estado real, o Funil Rápido já era corretamente liberado por `country=EC` e `human.mode=manual`, mas `EC-ADMIN-3338` não era classificado como histórico. Na confirmação, isso podia impedir a criação correta do novo pedido e permitir sincronização da negociação atual com o lead administrativo anterior.

## 5. Correção mínima

Foi acrescentado o sinal booleano `legacyEntry`, calculado por `chatEntryInfo(chat).className === 'old'`. A política também valida o formato administrativo do identificador. O histórico é reconhecido apenas pela combinação de entrada antiga e ID administrativo, desde que o ID não pertença explicitamente à negociação atual.

## 6. Casos cobertos

| Caso | Resultado esperado |
|---|---|
| Angel real: `EC-ADMIN-3338`, entrada antiga, negociação vazia | histórico preservado |
| Mesmo ID administrativo, entrada atual | não classificar por antiguidade |
| Mesmo ID já igual a `currentNegotiationOrderId` | negociação atual prevalece |
| Pedido terminal entregue/enviado | histórico preservado |
| Novo pedido confirmado ligado à negociação atual | não separar antes de se tornar terminal |

## 7. Efeito sobre a confirmação

Quando o histórico é reconhecido, o painel mantém o identificador anterior em `previousOrderId`, cria um novo pedido somente na confirmação válida, grava o novo `orderId` como `currentNegotiationOrderId` e pula a sincronização do lead administrativo anterior.

## 8. Áreas preservadas

Não foram alterados textos do funil, preços, mídia, áudio, Z-API, Meta/CAPI, Dropi, ficha inteligente, métricas, motor de bot, scheduler, coleta de dados ou regras de produto. O Funil Rápido continua apenas preparando texto para revisão, sem envio automático.

## 9. Validação obrigatória

O teste `tests/manual-quick-funnel.test.cjs` usa as tags reais sanitizadas do Angel e cobre as duas negativas críticas: entrada administrativa nova e propriedade explícita da negociação atual. Os gates v7 também exigem a presença desses casos e protegem por SHA-256 todos os arquivos herdados e modificados.

## 10. Estado operacional

Este documento não autoriza produção. O release ativo continua `/opt/vitalismen-automacao/releases/20260815T045340Z_ec_universal_metrics_b53e575`; o release `dd1abb3` está armazenado e inativo. O v7 somente poderá ser publicado após um novo commit local ser informado e receber autorização específica.

## 11. Resultados executados

Passaram localmente:

- guard e runtime oficial v7;
- freeze-lock com 19 regras;
- Funil Rápido/Angel, 4 de 4;
- ficha inteligente;
- métricas autenticadas, 7 de 7;
- atribuição Meta, 6 de 6;
- concorrência e retry Purchase, 7 de 7;
- operação somente Ecuador, 4 de 4;
- microcamada de produtos e regressão Meta/país;
- Senior Guard apontando para v7;
- catálogo EC/Dropi, 3 produtos e 24 combinações, sem envio;
- notificações, anti-spam de guia e status/Google Contacts;
- etiquetas operacionais, 7 de 7;
- retirada, 9 de 9;
- isolamento Tex Ultra e Nitrix;
- gate Nitrix e entrada de dois áudios;
- rascunho com quantidade zero, 27 verificações;
- matriz de contexto do funil e Leitor Atento;
- guard público com zero avisos e teste mutável desativado.

O guard de status dos painéis falhou localmente porque `/opt/maxlien-mvp/app.py` não existe no Windows. O mesmo guard passou diretamente na VPS, onde a dependência oficial existe. A consulta remota também confirmou em leitura o symlink, `PM2 cwd`, saúde local e saúde pública do release restaurado.

## 12. Avisos e limitações

`official:audit` terminou `OK` com quatro avisos ambientais: API local retornando 401, token da sessão WhatsApp local inválido, ausência de formulário recente com quantidade 3/6 e timeout do subprocesso SSH interno. A verificação SSH foi repetida diretamente e passou. Nenhum desses avisos altera o código v7 ou autoriza produção.

O `npm ci` do ensaio anterior registrou 14 vulnerabilidades herdadas no lockfile — 6 moderadas, 6 altas e 2 críticas. Nenhuma dependência foi atualizada nesta microcorreção, pois isso exige auditoria própria.

## 13. Rollback e recuperação

O backup físico verificado do release anterior permanece em `/opt/vitalismen-automacao/backups/20260815T061819Z_pre_meta_dd1abb3`, com hash integral `9be8f9aaf9c89909f0deb0783e1848af0c297adc6242f28b6adfe8290e027eac`. O rollback já executado restaurou o release `b53e575`; durante a criação do v7 houve somente verificação remota em modo leitura, sem publicação, mudança de estado ou qualquer mutação na VPS.
