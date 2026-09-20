# V194 — liberação controlada do pós-venda EC

Data operacional: 2026-09-20

## Objetivo

Liberar o pós-venda EC em um único executor mutável, com lote físico máximo de um envio por ciclo, sem reprocessar o histórico e sem criar ou modificar pedidos na Dropi.

## Autorizações do operador

- `AUTORIZO_CORRIGIR_E_PUBLICAR_POSVENDA_EC_CONTROLADO=SIM`
- `AUTORIZO_CANARIO_EXCLUSIVO_NO_QA_5515998038637=SIM`

## Escopo funcional

1. O timer V188 é o único executor mutável do pós-venda.
2. O timer V116 é desativado somente na ativação; o V114 permanece observador.
3. O reconciliador V194 consulta a Dropi em modo somente leitura usando exclusivamente o ID Dropi já persistido no `Shipment`.
4. O reconciliador não cria, reenvia, atualiza ou substitui pedido Dropi.
5. As únicas classificações são `TRACKING_FOUND`, `DROPI_STILL_WITHOUT_TRACKING`, `ORDER_NOT_FOUND`, `AMBIGUOUS_LINK` e `MANUAL_REVIEW`.
6. O backoff é 15, 30 e 60 minutos, depois 60 minutos, com máximo de 12 consultas diárias por envio.
7. Tracking recuperado para remessa histórica recebe `historicalNoReplay=true`; nenhum estágio histórico é reenviado.
8. Todos os estágios de saída são forward-only a partir do cutoff gravado no overlay V194.
9. Cada ciclo pode produzir no máximo um envio físico total, inclusive texto, áudio, imagem e bônus por comprovante.
10. Produto desconhecido, identidade conflitante ou vínculo ambíguo vai para revisão manual.

## Canário

O canário físico é permitido somente em `5515998038637`. Ele percorre os 15 estágios canônicos, um por execução, persiste intenção, ID do provedor e estado `SENT`, confirma a bolha Z-API e prova deduplicação no rerun. Não cria `Order`, `Shipment`, pedido Dropi nem evento Meta.

## Preservado

- VSL e VTurb/V154;
- telefone oficial;
- `conversationEngine` e `agentRouter`;
- Pixel, Meta/CAPI e Purchase;
- preços, produtos, checkout e painel;
- transporte Z-API oficial;
- criação e alteração de pedidos Dropi;
- funil comercial congelado.

## Ativação e rollback

O helper `ops/post-sale-v188` cria primeiro o overlay V194, valida staging e canário, desativa `vitalismen-postsale-transactional-v116.timer` e ativa `vitalismen-postsale-full-v188.timer`. A ativação falha se houver mais de um timer mutável ativo.

Rollback operacional: desativar V188 e reativar V116 com o release anterior, preservando ledger e evidências. Nenhum rollback apaga tracking, ledger, mensagens ou histórico.

## Fonte de verdade

O manifesto canônico é `docs/freeze/post-sale-dropi-reconciler-v194-20260920.json` e o preload é `scripts/lib/ec-runtime-successor-v194-context.mjs`.
