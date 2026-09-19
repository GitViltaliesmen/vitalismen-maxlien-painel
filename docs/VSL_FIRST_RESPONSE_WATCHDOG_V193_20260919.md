# V193 — watchdog de primeira resposta VSL

Data: 2026-09-19

Parent canônico: `818db6cf281ee22d3ab4efc04f76cc7cf7898ae1`

Branch: `codex/v193-vsl-first-response-watchdog-fix`

## Objetivo

Restringir o recovery de primeira resposta à primeira entrada VSL EC real e recém-persistida, sem alterar `publicVslLeadEntry`, o roteamento inline normal, produto, funil, painel, VSL, Meta/CAPI, Dropi ou pós-venda V188.

## Contrato

- `publicVslLeadEntry` permanece com a semântica anterior para tags, produto, painel e roteamento.
- `eligibleForFirstResponseWatchdog` é independente e exige simultaneamente mensagem nova, texto, país/rota VSL permitida, produto EC, atribuição VSL renovada no inbound atual e destinatário que não seja QA.
- Contexto VSL apenas persistido, follow-up, áudio, imagem e webhook duplicado não armam o watchdog.
- A identidade original usa `providerMessageId`, depois `providerZaapId`, depois o `messageId` interno já persistido. Nenhum provider ID é fabricado.
- O primeiro marcador é gravado atomicamente em `ContactState.metadata` somente quando ausente e nunca é sobrescrito.
- No vencimento do timer, o estado e o outbound real são consultados novamente.
- Modo humano e buckets `orders`, `review` e `engagement` bloqueiam recovery.
- O lock e o contador de tentativa são persistidos; a mesma `watchdogKey` admite no máximo uma reivindicação.
- Após adquirir o lock, há uma segunda consulta de estado e outbound antes de chamar o roteador, cobrindo a borda da janela de 75 segundos.
- O ID interno de recovery é determinístico e não altera o provider ID original.
- Evidência de outbound posterior prevalece sobre status legado `failed` ou `reprocessing`.

## Persistência adicionada

Campos em `ContactState.metadata`:

- `vslFirstEntryMessageId`
- `vslFirstEntryProviderMessageId`
- `vslFirstEntryProviderZaapId`
- `vslFirstEntryPersistedMessageId`
- `vslFirstEntryAt`
- `vslFirstResponseWatchdogKey`
- `vslFirstResponseWatchdogLockToken`
- `vslFirstResponseWatchdogLockExpiresAt`
- `vslFirstResponseWatchdogAttemptCount`
- status, motivo e timestamp já usados pelo watchdog anterior

## Histórico

Não existe migração, limpeza retroativa ou fila de recovery histórico. `scripts/audit-v193-historical-watchdog-readonly.mjs` produz somente evidência sanitizada de sete dias: timestamp, release ativo no momento do relatório, tipo de mensagem, VSL/não-VSL, existência de resposta posterior e status terminal. O script não possui primitivas de escrita nem transporte WhatsApp.

## Testes e rollback

Os cenários V193 cobrem primeira entrada, follow-ups, mídia, duplicação, outbound existente, estado legado `failed`, humano, três buckets bloqueados, concorrência entre workers, at-most-once, borda de janela, regressão de produto/funil, fixture Kleber e QA.

Rollback operacional deve usar o pipeline oficial para retornar ao release anterior. Nunca editar `/opt/vitalismen-automacao/current` diretamente.
