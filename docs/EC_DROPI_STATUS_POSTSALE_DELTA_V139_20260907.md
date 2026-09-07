# V139 — Status Dropi e pós-venda

## Base congelada

- commit: `e6199c8cd98177de1d2f956f07d7e38f3135adb3`
- tree: `f801f602ebb487061d27630dce6aadfe58d730ad`
- tag: `freeze-v138-dropi-human-authorization-20260907`

## Escopo

A V139 adiciona uma projeção única do estado logístico já persistido no `Shipment` para o `Order`, o `ContactState` e o painel operacional. A projeção ocorre quando o Dropi é sincronizado e antes de qualquer tentativa de mensagem. Ela não cria pedido, não autoriza envio ao Dropi e não envia mensagem ao cliente.

O seletor de status dos Leads Clientes conserva a ponte V138 para a rota autenticada do pedido operacional. A V139 amplia essa rota para persistir a escolha no pedido operacional existente e no rascunho do contato. A resposta declara e testa `dropiCalled: false` e `postSaleTriggered: false`.

## Consulta histórica Servientrega restaurada

O mecanismo histórico validado no commit `5c9f0fd96ddc0f3bd3cc02c24014e6b885c22b77`, de 18/08/2026, permanece em `carrierTrackingService.js`. `trackServientregaGuide()` consulta diretamente `https://www.servientrega.com.ec/Tracking/?guia=...&tipo=GUIA`, extrai estado e último movimento e entrega o resultado ao `shipmentLifecycleStatusService.js`.

A consulta somente leitura da guia `189613429` em 07/09/2026 retornou `Pendiente` e o movimento `Generado Cliente Corporativo`. O normalizador histórico agora reconhece essa resposta real como `GUIA_GENERADA`. Nenhum scraper ou endpoint novo foi criado.

`applyShipmentLifecycleStatus()` continua sendo a única função canônica de aplicação logística. Ela impede regressão, atualiza o Shipment e sua timeline, projeta Order, Dropi ID, guia, ContactState/ficha e painel, e grava apenas uma transição efetiva quando o mesmo estado é consultado repetidamente. A projeção V139 do Dropi delega a essa função histórica.

## Estado e não regressão

O estado logístico do Dropi é a fonte para a projeção operacional. Atualizações atrasadas não rebaixam `shipped` para `processing` e não retiram um pedido de um estado terminal. ID Dropi, guia e status logístico são persistidos no pedido e no contato existente.

## Pós-venda

O dispatcher exige, antes da decisão transacional V66/V116:

- ID numérico real do pedido Dropi;
- `dropiSubmitAuthorizedAt` e `dropiSubmitAuthorizedBy`, gravados pela ação humana V138;
- status observado no provedor diferente do estado local inicial `CREATED`.

O primeiro aviso de agência continua usando o texto V29: informa que o pedido foi enviado, fornece a guia, orienta o cliente a não ir à agência e promete novo aviso quando a retirada estiver liberada. `INGRESANDO EN AGENCIA` continua sendo trânsito. Somente os estados explícitos do Dropi normalizados como `READY_FOR_PICKUP` habilitam a mensagem de retirada.

O ledger transacional existente continua sendo a fonte de verdade do envio. `SENT` exige `providerMessageId`; a chave por pedido, etapa e variante bloqueia repetição depois de restart ou nova sincronização.

## Observação do lead 3435

A inspeção foi somente leitura. No Dropi, a evidência fornecida e conferida indica pedido `6866531`, guia `189613429` e estado `GUIA_GENERADA`. Na produção atual, o `Shipment` ainda estava em `CREATED`, sem ID Dropi e sem guia; o `Order` estava `confirmed`; o `ContactState` estava `confirmado`; o SQLite já mostrava `pedido_enviado`. Não havia ledger estruturado nem `providerMessageId` de pós-venda, portanto não há evidência suficiente para considerar o aviso enviado.

Nenhum dado desse cliente foi alterado e nenhuma mensagem foi enviada.

## Validação

Executar:

```sh
node scripts/guard-ec-dropi-status-postsale-v139.mjs
node --test tests/ec-dropi-status-postsale-v139.test.mjs
npm run senior:check
```

O staging deve ser criado a partir do commit exato da candidata. Publicação e alteração de `/current` permanecem fora desta etapa.
