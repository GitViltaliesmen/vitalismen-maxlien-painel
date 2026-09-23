# V147-R3 — Servientrega DELIVERED como conclusão única

A V147-R3 final deriva da candidata congelada `5e3f4019bbdffebf06f2e66a74e58db52e1206da`. Os tags da candidata anterior permanecem imutáveis. Esta candidata substitui o gate financeiro separado pela decisão operacional autorizada: somente uma evidência canônica do tracking Servientrega classificada como `DELIVERED` conclui o ciclo logístico e habilita P5, P6 e P7.

## Gate de conclusão

O gate exige simultaneamente:

- `logistics.canonicalStatus=DELIVERED`;
- `logistics.canonicalEvidence.provider=servientrega`;
- `logistics.canonicalEvidence.source=carrier_tracking`;
- código, status ou substatus bruto do provedor que também classifique `DELIVERED`;
- `customerId`, `orderId` e `shipmentId` canônicos;
- ausência de retorno.

Nenhum outro estado libera P5, P6 ou P7. Campos de pagamento, `outcomes.delivered`, `outcomes.pickedUp`, `deliveredConfirmedAt`, status legado `ENTREGADO` e comprovante de retirada não substituem o tracking Servientrega. `shipmentPaymentConfirmed()` foi restaurada ao comportamento preexistente para compatibilidade com outros fluxos, sem ser chamada pelas três etapas.

## P5, P6 e P7

P5 usa o áudio byte a byte preservado `public/media/templates/EC/OBRIGADO_PAGOU.ogg`, SHA-256 `bd6ce39a51cb67be469aa6aeb6c0ca94c2f53e4ab27dba46dabd2efc93a5adfd`. A auditoria semântica aprovada permanece válida: o áudio agradece ao cliente, sem afirmar recebimento de pagamento, bônus ou modo de uso.

P6 exige o mesmo `DELIVERED`, P5 aceito ou recuperado, elegibilidade comercial do bônus, URL HTTPS válida e marcador ainda ausente. P7 exige o mesmo `DELIVERED`, P6 aceito ou recuperado, produto canônico e marcador ainda ausente. P7 conserva estágio, ledger e dedupe próprios. Para Tex Ultra, o dedupe permanece compartilhado com o envio manual de modo de uso.

O dispatcher recarrega o Shipment após P5 e P6. O pacing existente ocorre antes da borda do provider em P6 e P7, impedindo rajada simultânea. Locks, ledger, providerMessageId, reconciliação de timeout e chaves por cliente, pedido, Shipment, etapa e template preservam at-most-once em reinício e concorrência.

## READY, lembretes e comprovante

`READY_FOR_PICKUP` com prova do tracking continua liberando somente A07. A10 permanece em A07 aceita +72 horas, e A19 em A07 aceita +120 horas. O lock de cada lembrete revalida atomicamente que o registro ainda está READY, confirmado pelo tracking e não terminal. A aplicação de `DELIVERED` limpa locks pendentes de A10/A19 antes de iniciar P5.

O comprovante de retirada recebido pelo WhatsApp ou pela rota administrativa passa a ser somente evidência persistida. Ele não altera Shipment, Order, ContactState, painel ou carteira para entregue e não chama P5/P6/P7. O fluxo aguarda `SERVIENTREGA_CANONICAL_DELIVERED`.

## Reconciliação e catch-up

O caminho V140 inclui Order sem Shipment e produz, em dry-run, o plano idempotente para criar exatamente um Shipment canônico por identidade de pedido, Dropi, guia, cliente e lead. Esse plano não cria pedido Dropi, não submete pedido, não cria guia, não envia Meta Purchase e não envia mensagem.

A auditoria read-only consulta o status live com concorrência limitada, classifica todas as divergências nas classes autorizadas e produz duas listas distintas:

- READY catch-up: somente A07 potencial, sem envio;
- DELIVERED closure catch-up: pedidos `DELIVERED` com P5, P6 ou P7 ausente, incluindo identidade, produto, elegibilidade e motivo de exclusão.

As duas listas são finitas, ordenadas, deduplicáveis e recebem hash SHA-256. A auditoria não autoriza backfill e envia zero mensagens.

## Executor e publicação

`ops/post-sale-v116 staging-check RELEASE` executa o plano V116 na release imutável, carrega o preload sucessor da candidata e escreve somente em `/var/log/vitalismen-deploy` com modo `0600`. A verificação usa `/proc` para validar o PM2 oficial e não acessa o diretório PM2 somente leitura.

Esta candidata não altera `current`, não reinicia PM2, não publica, não envia mensagens reais e exige aprovação humana após o staging e o novo freeze.
