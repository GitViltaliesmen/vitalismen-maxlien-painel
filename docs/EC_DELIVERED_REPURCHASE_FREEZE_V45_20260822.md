# Microcamada V45 — recompra após pedido entregue EC

Data: 2026-08-22.

## Decisão autorizada

Este freeze sucede a V44 e corrige somente a transição manual de um cliente
antigo com entrega comprovada para uma nova compra. O pedido e o Shipment
anteriores permanecem históricos. Selecionar `Confirmar pedido` no painel cria
um novo pedido com prefixo `EC-RECOMPRA-`, registra `previousOrderId` e conserva
a data da entrega anterior quando disponível.

O ambiente permanece exclusivamente Vitalismen Ecuador em `72.60.137.77`,
`ec.maxlien.shop` e `/opt/vitalismen-automacao/current`.

## Evidência e causa

No caso operacional terminado em `1956`, o CRM e dois Shipments registravam
`ENTREGADO`, mas o documento `Order` antigo ainda podia aparecer como
`confirmed`. O painel usava apenas o status do `Order`, concluía que o pedido
era atual e aplicava `PATCH` sobre ele. Isso reabria o identificador antigo em
vez de iniciar uma recompra.

## Contrato corrigido

- o status terminal do Shipment tem precedência somente para projetar o ciclo
  histórico no painel;
- `Order confirmed` com Shipment `ENTREGADO`, `outcomes.delivered`,
  `outcomes.pickedUp` ou `deliveredConfirmedAt` é exibido como entregue e não
  conta como obrigação operacional ativa;
- a recompra exige painel autenticado, mesmo telefone e entrega anterior
  comprovada;
- o pedido novo recebe `EC-RECOMPRA-*`,
  `entryReason=repeat_purchase_after_delivered`, `previousOrderId` e
  `previousDeliveredAt`;
- o lead único do telefone pode voltar de `entregue` para `confirmado` somente
  quando a gravação vem desse novo ciclo de recompra;
- confirmar a recompra mantém o evento Purchase normal de uma venda nova;
- nenhuma autorização ou submissão Dropi é criada automaticamente.

## AQUECIMENTO e Novas

A V44 permanece íntegra. Conversa persistida como `engagement` continua fora de
`Novas` e mantém o selo próprio de `AQUECIMENTO`. Quando o cliente demonstra
intenção comercial ou possui um novo pedido confirmado, a conversa deixa o
caminho passivo e passa legitimamente para `ATENDIMENTO`/`PEDIDOS`; nesse caso,
uma entrada não lida deve aparecer em `Novas`.

A busca por nome ou telefone continua acima dos filtros, conforme a V41.

## Preservado

- pedido, Shipment, guia, Dropi ID e Purchase históricos;
- autorização humana obrigatória antes de enviar à Dropi;
- produtos, preços, ofertas, VSLs e funis;
- V40–V44, incluindo contador próprio e resposta local do AQUECIMENTO;
- Z-API, número oficial, mídias, pós-venda, schedulers e storage;
- nenhum envio WhatsApp faz parte dos testes V45.

## Base e rollback

- base local/origin/release antes da alteração:
  `50b6a6cb95493957fe8dc68cd9021a60270891e8`;
- release ativa observada:
  `/opt/vitalismen-automacao/releases/20260822T195713Z_production-20260822-50b6a6c`;
- manifesto pai V44 SHA-256:
  `239795973a82cec2beea290e449298641b42bb8a4e0627e7a352e71509cb97c5`.

Rollback operacional: reativar a release V44 acima, preservando bancos,
mídias compartilhadas e todos os pedidos/Shipments. Um pedido de recompra já
criado é dado comercial real e não deve ser apagado pelo rollback de código.
