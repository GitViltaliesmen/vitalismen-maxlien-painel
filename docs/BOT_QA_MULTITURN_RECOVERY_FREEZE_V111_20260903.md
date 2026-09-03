# Freeze V111 — continuidade real multi-turn no QA oficial

Data: 2026-09-03
Escopo: atribuição VSL renovada e classificação inbound do QA `5515998038637`
Pai: V110 (`370f398ec64a0e27d76d6bca4d47c348661a4596`)

## Falha real observada

A V110 restaurou a primeira resposta ponta a ponta e recebeu confirmação
`delivered`. No follow-up autorizado `2 frascos`, a mensagem foi persistida,
mas `routeToBot=false`: a assinatura oficial nova havia renovado o produto,
porém conservava o timestamp antigo de `vslEntryPanelLeadAt`. Assim, a próxima
mensagem já encontrava a atribuição expirada.

O callback de entrega do outbound também entrava no contador do permit QA por
ser avaliado antes da classificação `fromMe`/delivery. Isso não enviou resposta
duplicada, mas consumiu indevidamente uma posição da janela de oito entradas.

## Correção mínima

- uma assinatura/atribuição VSL nova grava `vslEntryPanelLeadAt` no instante
  atual; atribuição persistida ainda vigente mantém o timestamp original;
- o claim QA aceita somente mensagem inbound com texto;
- callback `fromMe`, status de entrega, ACK e evento sem texto não consomem o
  contador multi-turn;
- primeira entrada, telefone exato, oito IDs únicos, expiração, serialização e
  restauração do `human.mode` continuam iguais à V110.

## Preservado

Dashboard, ficha, edição manual, cidade/província, pedidos, recompra, pedido
3469, Dropi manual/BFF, anti-duplicidade, Meta/CAPI, Nginx, preços, mídias,
pós-venda, backlog e schedulers não são alterados.

## Publicação e rollback

A V111 segue stage, guards, publicação V70, permit root de uso único e troca
atômica de `current`. Falha no canário exige contenção do reset QA e retorno à
V110; nenhum pedido ou dado comercial precisa ser restaurado.
