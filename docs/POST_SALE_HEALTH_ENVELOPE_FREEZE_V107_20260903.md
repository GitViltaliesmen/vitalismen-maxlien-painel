# Freeze V107 — health semântico do pós-venda

Data: 2026-09-03
Escopo: validação de health e limpeza segura de autorização V105 não consumida
Pai: V106 (`f0457d2bee280b44fc6c13a42078f3100a202a75`)

## Causa

O endpoint oficial `/api/health/` respondeu HTTP 200 com JSON válido e estado
operacional correto, mas o contrato V105 exigia que o corpo HTTP já estivesse
serializado no mesmo formato canônico usado pelos artefatos imutáveis internos.
A ativação falhou fechada antes de consumir o permit e restaurou o bot core.

## Correção

Somente a entrada externa de health passa a aceitar qualquer serialização JSON
válida de um objeto. A validação semântica de status, Z-API, bridge V66, runtime,
Dropi `REPORT_ONLY` e mutações operacionais permanece idêntica. Um comando
explícito arquiva o bundle não consumido apenas quando PM2, health, bot core,
zero schedulers mutantes e Dropi bloqueado forem comprovados.

## Preservado

O perfil V105, lote máximo um, limite diário um, bridge sem replay, bot, funil,
Z-API, Dropi `REPORT_ONLY`, backlog desligado e Meta retroativo desligado não
mudam. A microcamada não envia mensagens, não chama Dropi e não altera pedidos.
