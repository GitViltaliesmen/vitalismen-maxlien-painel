# V160 — envio manual da atendente nunca é ignorado

## Incidente confirmado

O painel autenticado recusava o áudio oficial `Chegou_01` escolhido por uma
atendente quando ainda não existia `READY_FOR_PICKUP` verificado. A API devolvia
HTTP 409 com `pickup_communication_blocked` e a interface mostrava “PEDIDO AINDA
NÃO ESTÁ LIBERADO PARA RETIRADA”. O mesmo gate podia recusar texto humano com
linguagem de retirada.

## Causa

O `POST /api/whatsapp/send` aplicava a política logística automática antes de
reconhecer a autoria humana autenticada. Em seguida, o adaptador canônico de
pós-venda voltava a exigir Shipment e estado logístico para `Chegou_01/02/03`.
Assim, uma decisão explícita da atendente era tratada como tentativa automática.

## Correção autorizada

- O sinal de autoria humana é fornecido internamente pela rota autenticada; um
  campo enviado pelo navegador não concede essa permissão.
- Texto, áudio e outras mídias enviados manualmente seguem o transporte comum do
  painel e não são bloqueados pela situação logística.
- O backend habilita o bypass de dedupe de áudio exclusivamente pelo
  `sendMode=manual_panel` já autenticado, sem depender de uma flag opcional do
  navegador. O clique humano continua sendo a autorização de cada envio.
- O registro continua persistido como `isFromMe=true`, `isBot=false`,
  `senderRole=human`, com atendente, `clientGeneratedId`, estado de entrega e
  `providerMessageId` quando aceito.
- O modo humano/hold continua aplicado depois da tentativa, como no fluxo manual
  aprovado.

## Proteções preservadas

A exceção não altera o Shipment nem cria evidência logística. O scheduler e os
notificadores automáticos continuam exigindo `READY_FOR_PICKUP` verificado para
`Chegou_01`, `Chegou_02` e `Chegou_03`. Quando chegar o momento logístico, o
histórico manual aceito continua disponível à reconciliação canônica para evitar
duplicidade. Não foram alterados produto, preço, VSL, checkout, Dropi, Meta/CAPI,
pixel, Z-API, número oficial, catálogo de mídia, fila automática ou limites de
pós-venda.

Nenhuma mensagem real é necessária para validar esta camada. Os testes usam
dublês locais e comprovam que o caminho manual não consulta Shipment nem chama o
provider dentro do adaptador, enquanto a política automática continua bloqueando
retirada sem prontidão verificada.
