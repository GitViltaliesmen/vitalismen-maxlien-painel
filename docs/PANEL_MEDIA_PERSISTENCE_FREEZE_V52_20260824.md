# Freeze V52 — persistência do áudio e mídia manual no painel EC

A V52 sucede a V51 e corrige exclusivamente o envio manual de áudio e mídia da
biblioteca do painel oficial `public/qr.html`.

## Incidente confirmado

Ao escolher **Agradecimento do pedido**, a bolha aparecia no painel e sumia.
Os dois arquivos oficiais estavam presentes, íntegros e acessíveis, e a API de
templates devolvia ambos. O histórico persistido demonstrou que os envios
confirmados permaneciam; a falha ocorria antes da persistência quando a política
manual bloqueava o arquivo.

## Causa confirmada

O backend usava qualquer ocorrência de `agencia` ou `retir` no nome do arquivo
para classificá-lo como aviso de retirada. Por isso,
`Agradecimento_Agencia_01`, `AGRADECIMENTO_AGENCIA_DE_ENTREGA` e mais sete
áudios comerciais eram confundidos com “pedido pronto para retirada”. Quando o
pedido ainda não estava em `READY_FOR_PICKUP` verificado, a API recusava o envio
e o painel removia a bolha provisória.

## Alteração autorizada

- Somente `Chegou_01`, `Chegou_02`, `Chegou_03` e nomes técnicos explicitamente
  equivalentes a `READY_FOR_PICKUP` são áudios de retirada no gate manual.
- Os nove falsos positivos de agradecimento, bônus, endereço, modalidade e
  segurança de agência permanecem disponíveis nas etapas comerciais aprovadas.
- Áudio e mídia da biblioteca recebem `clientGeneratedId` e confirmam a bolha
  local com o registro persistido retornado pela API.
- Se a API rejeitar uma tentativa, a bolha fica marcada como sem confirmação em
  vez de desaparecer imediatamente.

## Proteções preservadas

Os três áudios `Chegou_*` continuam bloqueados antes do estado logístico
`READY_FOR_PICKUP` verificado. Não foram alterados envio automático, cadência,
produto, preço, VSL, pedido, checkout, Dropi, Meta/CAPI, pixel, banco, scheduler,
Z-API, número oficial ou PM2. Nenhuma mídia foi enviada a cliente para validar.

## Validação e rollback

São obrigatórios o teste V52, os testes V29 de logística, `senior:check` e
`node scripts/audit-ec-product-micro-layer.mjs`. O rollback funcional é o
release V51
`/opt/vitalismen-automacao/releases/20260824T001100Z_production-20260824-bab7bbb`.
Bancos, mensagens e mídias compartilhados não devem ser removidos no rollback.
