# Congelado — consulta automática de retirada Dropi EC

Data: 2026-07-18

## Problema

Um pedido EC pode ser aceito pela Dropi sem guia na primeira sincronização. Quando a Dropi posteriormente muda o pedido para retirada em agência, esse pedido não entrava na fila do despachante: a fila exigia guia ou status `READY_FOR_PICKUP` já gravado localmente.

Consequência: o atendimento humano precisava consultar e avisar manualmente, embora a Z-API estivesse saudável.

## Correção

`shipmentStatusDispatcherService` agora também seleciona, em cada ciclo normal, pedidos EC de referência Dropi válida que estejam pendentes/sem guia. Antes de decidir uma ação, o ciclo consulta o painel Dropi. Se retornar guia e `READY_FOR_PICKUP`, aplica a mesma guarda de duplicidade e dispara o aviso automático de retirada.

## Guardas preservadas

- Somente `country: EC`.
- Exige referência Dropi gravada e telefone do cliente.
- Não processa entregues, retirados ou devolvidos.
- Respeita o intervalo mínimo configurado (`SHIPMENT_MIN_MESSAGE_GAP_MS`).
- A mensagem manual já existente é detectada pela trava global; o sistema não duplica um aviso em execução normal.
- Reenvio forçado só é usado por ação explícita do operador.
- Não houve alteração de VSL, CTA, bot, números, dados, domínio, Pixel ou qualquer camada da Colômbia.

## Evidência inicial

Pedido EC `EC-MRNGR7DQ-3S3K` (telefone final `2862`) estava `PENDIENTE`, sem guia local e fora da fila, apesar de ser retirada em agência. O painel registrou um aviso manual entregue pela Z-API em 2026-07-18T14:18:19Z. A correção inclui esse estado pendente na consulta automática, para que mudanças posteriores da Dropi sejam sincronizadas e notificadas sem intervenção manual.
