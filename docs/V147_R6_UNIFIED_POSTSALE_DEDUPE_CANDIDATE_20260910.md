# V147-R6 — candidata de dedupe único do pós-venda

Escopo autorizado: painel manual e V116 compartilham identidade, reserva e reconciliação de P5/P6/P7. Base R5 `dbb3d1440d2a4e549271321686e1edefe8e6e73c`, tree `1554583304bda990b89c29ea44274ffb0292fec9`. Produção permanece R4 `b821dc09ace9021c14e1998624dbfad3d49312c6`, em `/opt/vitalismen-automacao/current`. Esta candidata não autoriza publicação nem alteração do banco de produção.

## Causa e evidência

A auditoria somente leitura está em `/var/lib/vitalismen-deploy/evidence/v147-r6-unified-postsale-20260910/6886247-readonly-source.json`. O script `scripts/audit-unified-postsale-v147-r6.mjs` classifica os registros reais e distingue IDs armazenados de identidades resolvidas. Para P5 existem dois provider IDs: manual `F23EAFC1072FD1AD9592` e V116 `3EB092E63EAE7F5439FAC1`. As duas linhas Mongo do segundo ID representam um envio. P6 manual: `3EB057B0346896B8233327`. P7 manual Tex Ultra: `3EB0AAF76AB0EEC6CC265B`.

P5/P7 manuais usavam body `[Audio]` com mídia canônica; o histórico antigo só identificava o rótulo no body. P6 manual usava o template exato em espanhol com “bono”; a recuperação antiga buscava “bonus/regalo”. O log oficial do V116 às 19:48:58 registra `history_repeat`, chave `logistics_ready_for_pickup`: o guard textual genérico bloqueou P6 antes do provedor, originando `shipment_text_not_sent` e `FAILED_FINAL`. A evidência está em `p6-failed-final-provider-block.json`, no mesmo diretório protegido.

## Contrato implementado

A chave reutiliza o construtor V147 e contém customerId, orderId da remessa, shipmentId, evento e template. P7 inclui produto. `Shipment.orderId=6886247` e `Order.orderId=EC-ADMIN-3496` são aliases ligados por Dropi; ambos os caminhos resolvem a mesma remessa antes de construir a chave. P5/P6 não exigem produto. P7 exige resolução sem conflito.

O mesmo `Shipment.automation.postSaleSafetyLedger` e `notificationLocks` recebe a reserva atômica `INTENDED`, antes do provider call. `Message.postSaleEvent` registra metadados do evento, sem criar outro ledger. Aceite exige providerMessageId. O painel mantém seu transporte, registro de mensagem e takeover; encaminha o contexto transacional existente para limitar tentativas. Mensagens humanas livres continuam no fluxo original.

Reinício não libera `INTENDED`. Timeout ambíguo fica terminal e exige reconciliação com prova. Histórico legado usa identificador/template exato, destinatário, janela da entrega e limite da compra seguinte; registros com chave canônica usam a própria identidade. Nenhum timestamp ou provider ID de Message é reescrito. Reconciliação preserva entradas anteriores em `priorEntries`, inclusive P6 `FAILED_FINAL`, e registra o incidente de P5 duplicado.

A reconciliação ocorre no dispatcher existente e nos três notificadores. Não há scheduler, poller, alteração de transporte, regra DELIVERED, Chromium, ProtectHome, Meta, VSL, Dropi ou backfill. A sequência e o pacing existentes permanecem. Preservam-se human.mode manual para o comercial e a exceção transacional R5.

## Auditoria A07/A10/A19

O teste read-only reproduz áudio manual aceito, body `[Audio]`, mídia `Chegou_01/02/03`: a decisão antiga não reconhece esses registros como satisfação canônica. O painel não adquire os locks desses estágios. Portanto não há dedupe manual/V116 compartilhado garantido para esses três blocos. Defeito reportado separadamente, sem correção nesta R6 e sem envio real de teste.

## Validação e aprovação

Executar guard e testes R6/R5/R4, suíte completa, lint, senior, preload oficial V97 e staging real. `scripts/test-v147-r6-staging-sink.mjs` exige Mongo isolado, release diferente de current e transporte SINK, testa corrida de dois processos, timeout, reinício e replay dos registros reais do pedido 6886247. A evidência final e o hash funcional pertencem ao recibo protegido de freeze, gerado após os testes na release imutável. Sucesso do replay não significa reconciliação já aplicada ao banco de produção.

Parar após criar tags de candidata e freeze. A publicação requer aprovação humana da identidade final. Após aprovação, revalidar 6886247 sem reenviar e aguardar um DELIVERED natural para prova operacional.
