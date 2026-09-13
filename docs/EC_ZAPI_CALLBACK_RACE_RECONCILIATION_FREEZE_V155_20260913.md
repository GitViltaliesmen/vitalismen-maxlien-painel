# V155 — reconciliação de callback Z-API anterior ao Message

Data operacional: 2026-09-13.

Bug real comprovado na V154: o áudio manual `MODO_DE_USO_TEX_ULTRA.ogg` foi aceito pela Z-API com `providerMessageId=3EB0A4AFABA8F7B30B99F8`. Os callbacks reais `delivered` e `sent` chegaram às 13:40:47–13:40:48 UTC, antes de o painel persistir o `Message` às 13:41:09 UTC. A rota registrou `matched=false`, e o registro permaneceu incorretamente em `pending` com `ack=null`.

A V155 adiciona somente uma janela efêmera e limitada de reconciliação por identidade exata do provedor. Callback sem `Message` correspondente fica em memória por no máximo cinco minutos; quando o envio manual termina de persistir o registro, o status mais forte é aplicado sem rebaixar `delivered/read`. Telefone isoladamente nunca autoriza associação, o cache não contém corpo, mídia, token, auth state ou segredo, e possui limite de mil callbacks.

O reparo histórico unitário exige callback `matched=false` real no log do PM2, igualdade exata de `providerMessageId`, telefone idêntico, um único `Message` e autorização explícita. O modo padrão é `plan`, sem escrita. O comando não chama Z-API e não envia mensagem.

Validação operacional complementar: a primeira execução retrospectiva falhou fechada antes de escrever porque o TTL era calculado a partir do horário histórico do callback. O contrato foi corrigido para iniciar o TTL no instante local de ingestão, preservando separadamente o horário real do evento em `deliveredAt`. Um teste regressivo cobre explicitamente callback histórico antigo; a falha original não alterou Mongo e não chamou o provedor.

Preservado:

- V154, V153, V152, V148, V147, V140, V116 e seus contratos;
- Z-API como transporte oficial e o número de produção;
- dedupe, chronology guard, lote máximo 1, cota diária 1 e at-most-once;
- nenhuma liberação de backlog, guia atrasada ou `Chegou_01` antes de `READY_FOR_PICKUP` inequívoco;
- VSL, Pixel, CAPI, Dropi, funil, lógica comercial, painel central e pós-venda fora da reconciliação de ACK.

Validação mínima:

```sh
node scripts/guard-zapi-callback-race-reconciliation-v155.mjs
node --test tests/zapi-callback-reconciliation-v155.test.mjs tests/zapi-outbound-audio-contract.test.mjs tests/logistics-clean-chat-v29.test.mjs
```
