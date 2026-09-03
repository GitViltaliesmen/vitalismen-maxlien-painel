# Freeze V119 — envio manual autenticado ao Dropi EC

Data: 2026-09-03
Escopo: botão manual de envio do painel `Leads Clientes` da Vitalismen Ecuador
Baseline pai: `production-vitalismen-ec-panel-aquecimento-v118-20260903-r2`
Commit pai: `7e35a1d187a9bf65bd682ad7a67f528e753bb340`

## Incidente confirmado

O pedido confirmado chegava ao painel, porém a barreira operacional V78 bloqueava
as rotas autenticadas de autorização e envio antes dos handlers, retornando
`ec_bot_core_v78_operation_blocked`. A consulta GET de status também podia tentar
criar um Order, contrariando o contrato de leitura.

## Decisão autorizada

A V119 libera somente os dois POSTs autenticados que já compõem o fluxo manual:

1. `authorize-submit`, que cria/atualiza Order e Shipment e persiste a autorização;
2. `submit`, que executa o transporte Dropi já congelado nas V98/V104.

O efeito externo Dropi só é liberado dentro do contexto assíncrono do segundo POST.
As gravações Mongo ficam limitadas às coleções `orders`, `shipments` e
`contactstates`. O GET `submit-status` apenas lê; quando há somente o lead
confirmado no SQLite, responde `authorization_required` sem criar documentos.

## Segurança preservada

- autenticação administrativa obrigatória;
- dois cliques independentes: autorizar e depois enviar;
- produto e preço oficiais precisam ser identificados antes da autorização;
- telefone e destino precisam pertencer ao Equador;
- bloqueio persistente contra duplicidade antes do envio;
- consulta autoritativa do Dropi imediatamente antes de um único POST;
- ausência de retry automático quando o resultado do POST for ambíguo;
- ID real do Dropi obrigatório para declarar sucesso;
- lote, dispatch automático, sync apply, backfill e marketing continuam bloqueados.

## Fora de escopo

Não foram alterados painel visual, funil, WhatsApp, Z-API, VSL, preços, catálogo,
Meta/CAPI, pós-venda, schedulers ou flags operacionais. `dropiApplyAllowed` continua
`false` no health global porque a exceção é contextual, manual e por pedido.

## Publicação e rollback

A publicação ocorre em release imutável após suíte V119, testes Dropi, guard de
produto, `senior:check`, health e validação dos timers. O rollback é a reativação
formal da release V118
`/opt/vitalismen-automacao/releases/20260903T214229Z_production-20260903-7e35a1d`.
