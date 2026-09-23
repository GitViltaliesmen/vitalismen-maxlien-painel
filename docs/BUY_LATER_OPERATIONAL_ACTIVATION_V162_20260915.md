# V162 — ativação operacional isolada de Comprar depois

Data: 2026-09-15. Base imutável: V161, commit
`7618001e34dff3c8e556d75849e5fa842d5b1fd6`, tree
`9f63a2b964e77e82b7e4b90044643c7c93f6378a`, tag
`production-20260914-7618001`.

## Autorização e limite

O operador autorizou registro, agenda e lembrete real Z-API somente para
`metadata.customerDraft.status=comprar_depois`. A V162 instala um executor
oneshot e um timer próprios; não liga o scheduler principal, não muda o ambiente
PM2 e não enfraquece V78.

O executor aceita somente agenda ativa com data civil válida, produto EC
estruturado, telefone `593...`, `sentAt=null`, `failedAt=null`, tentativa menor
que um, lock livre e instante dentro da janela aprovada V24. O lote é fixo em um
candidato por ciclo e o intervalo é de 15 minutos.

Os 44 registros históricos `status=buy_later` são incompatíveis com a consulta
canônica e permanecem intocados. Não há backfill, inferência de data, migração ou
envio em massa.

## Execução e fail-closed

O fluxo exclusivo é:

```text
systemd timer V162
→ oneshot root endurecido
→ CLI V162 com ambiente mínimo
→ processAdminBuyLaterFollowups({ limit: 1 })
→ texto Z-API
```

O CLI lê somente as chaves necessárias de Mongo, Z-API, timeout e guards de
transporte. Não recebe credencial Dropi ou Meta. Ele fixa
`ADMIN_BUY_LATER_FOLLOWUP_ENABLED=false`, `DISABLE_SCHEDULER=1`, provider Z-API,
`force=false`, dedupe estrito e outbound EC. A autorização real de destinatário
é aplicada no ambiente exclusivo do oneshot e ainda passa obrigatoriamente por
`isAutomationRecipientAllowed`.

Antes do provider, há claim atômico de dez minutos, busca por corpo idêntico em
`Message` e `antiSpamKey` por contato/data/produto. Histórico encontrado satisfaz
a agenda sem reenvio. Falha ou ambiguidade grava `failedAt`, deixa `sentAt=null`,
incrementa `attemptCount` e não entra novamente na consulta automática.

O modo `observe` instala a proteção Mongoose read-only, usa `autoIndex=false` e
mostra somente os quatro dígitos finais. A ação `activate` exige zero candidatos
nesse modo antes de habilitar o timer; caso contrário falha fechada.

## Política preservada

```text
TIMEZONE=America/Guayaquil
WINDOW_START=D-4 09:00
WINDOW_END=D-3 18:59:59
LOCK_MINUTES=10
MAX_AUTOMATIC_ATTEMPTS=1
MEDIA=NO
ORDER_CREATE=NO
SHIPMENT_CREATE=NO
DROPI=NO
META=NO
```

Respostas `yes`, `no` e `other` continuam no contrato existente
`buyLaterConfirmationService`: `yes` retoma conferência sem criar pedido; `no`
cancela a agenda; `other` libera ao funil/humano sem repetir o lembrete.

## Baseline observado antes da publicação

Auditoria read-only em 2026-09-15T04:06:58Z:

```text
BUY_LATER_TOTAL_STATES=46
CANONICAL_BUY_LATER_COUNT=2
LEGACY_BUY_LATER_COUNT=44
ACTIVE_REMINDERS=3
ACTIVE_UNSENT_REMINDERS=1
ELIGIBLE_NOW=0

PHONE_0268_STATUS=comprar_depois
PHONE_0268_ACTIVE=true
PHONE_0268_DESIRED_DATE=2026-10-05
PHONE_0268_WINDOW_START=2026-10-01T14:00:00.000Z
PHONE_0268_WINDOW_END=2026-10-02T23:59:59.000Z
PHONE_0268_SENT_AT=null
PHONE_0268_FAILED_AT=null
```

Nenhuma mensagem real, pedido, remessa, Dropi ou Meta foi produzida por essa
observação.

## Arquivos e relação direta

```text
FILE=src/services/adminBuyLaterFollowupService.js
WHY_REQUIRED=fecha a seleção canônica e permite teste isolado do ciclo real

FILE=scripts/run-buy-later-followup-v162.mjs
WHY_REQUIRED=oferece observe read-only e run batch 1 com ambiente mínimo

FILE=ops/buy-later-followup-v162
WHY_REQUIRED=instala, observa, ativa, executa com lock e contém o timer

FILE=ops/systemd/vitalismen-buy-later-followup-v162.service
WHY_REQUIRED=define o oneshot endurecido

FILE=ops/systemd/vitalismen-buy-later-followup-v162.timer
WHY_REQUIRED=persiste a verificação de 15 minutos após reboot

FILE=tests/buy-later-operational-v162.test.mjs
WHY_REQUIRED=simula 0268, envio único, falha terminal e recuperação sem provider

FILE=scripts/guard-buy-later-operational-v162.mjs
WHY_REQUIRED=valida escopo, hashes e isolamento antes da publicação

FILE=docs/freeze/ec-buy-later-operational-v162-20260915.json
WHY_REQUIRED=congela a sucessora e os arquivos preservados

FILE=docs/BUY_LATER_OPERATIONAL_ACTIVATION_V162_20260915.md
WHY_REQUIRED=documenta autorização, arquitetura e baseline observado

FILE=docs/ARQUITETURA_AUTOMACAO_OFICIAL.md
WHY_REQUIRED=registra o executor como única exceção isolada ao scheduler global

FILE=docs/ARQUIVOS_OFICIAIS.md
WHY_REQUIRED=registra as novas fontes de verdade oficiais

FILE=scripts/lib/ec-runtime-successor-v155-context.mjs
WHY_REQUIRED=propaga o manifesto V162 pela cadeia de guards ancestrais

FILE=scripts/guard-negative-intent-buy-later-v161.mjs
WHY_REQUIRED=preserva a validação V161 ignorando apenas arquivos protegidos pelo manifesto V162 já validado

FILE=package.json
WHY_REQUIRED=inclui guard e testes V162 na regressão oficial
```

```text
FILES_OUTSIDE_SCOPE=0
LEGACY_BUY_LATER_BACKFILL=NO
LEGACY_BUY_LATER_BULK_SEND=NO
GLOBAL_SCHEDULER_ENABLED=NO
```
