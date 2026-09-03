# Congelamento V99 — registro idempotente de recompra EC

## Objetivo

Corrigir a falha em que uma nova compra confirmada por cliente com pedido já
entregue permanecia vinculada ao identificador histórico. A ficha e o painel
passam a registrar um novo pedido `EC-RECOMPRA-*`, mantendo o pedido, Shipment,
guia e Dropi ID anteriores imutáveis.

## Incidente autorizado

O lead EC `1503` possuía entrega comprovada no pedido histórico
`EC-DROPI-5756679`. Uma nova compra de Vit Power, 2 frascos por USD 70, estava
confirmada, porém o salvamento da ficha voltou a usar o pedido entregue e a
rota `stage-confirmed` chamada pelo painel não existia no backend atual.

## Contrato corrigido

- a rota administrativa `stage-confirmed` existe e exige autenticação de
  administrador;
- entrega comprovada nunca é atualizada como negociação corrente;
- a recompra recebe identidade própria, `previousOrderId`,
  `previousDeliveredAt` e `entryReason=repeat_purchase_after_delivered`;
- repetição do mesmo clique reaproveita a recompra ativa do mesmo ciclo;
- a ficha passa a apontar `orderId` e `currentNegotiationOrderId` para o novo
  pedido, preservando a origem e o pedido anterior separadamente;
- o evento Purchase de uma venda confirmada continua idempotente conforme V45;
- nenhum Shipment, autorização Dropi ou submissão Dropi é criado pela etapa de
  registro.

## Preservado

Não foram alterados produtos, preços, VSLs, checkout, funil, mensagens,
áudios, imagens, número oficial, transporte WhatsApp, schedulers, schema de
banco, pixel/dataset ou qualquer país/projeto fora do Ecuador. A V98 continua
manual, em dois cliques e com busca idempotente antes do único POST Dropi.

## Rollback

Reativar a release anterior pelo helper oficial e confirmar `current`,
`pm_cwd` e `pm_exec_path`. Pedidos de recompra reais já registrados não devem
ser apagados pelo rollback de código.
