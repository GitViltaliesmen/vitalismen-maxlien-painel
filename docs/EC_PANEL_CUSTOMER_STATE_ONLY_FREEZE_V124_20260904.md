# Freeze V124 — salvar ficha sem antecipar ação de pedido

Data: 2026-09-04
País e operação: Vitalismen Ecuador
Baseline pai: V123, commit `bc0164b9628a62d05e7a066ac2b1c5974e0181ef`, tree `4c87550546aef88d2b33a09d739f0ce9094b1873`

## Fechamento do incidente

A V123 garantiu no backend que `ContactState` fosse persistido antes da sincronização opcional de pedido. A revisão final encontrou outro caminho no navegador: quando a conversa já possuía `orderId`, o formulário podia chamar `PATCH /api/orders/:id` antes do `PATCH` da ficha. Como rotas genéricas de pedido permanecem corretamente bloqueadas pela V78, esse caminho ainda poderia impedir o salvamento comum.

## Microcamada V124

O salvamento comum de dados e status passa a operar com `synchronizeOrder=false` por padrão. As chamadas genéricas de pedido só são consideradas quando uma ação explicitamente operacional usa `synchronizeOrder=true`, como abrir/enviar pelo fluxo Dropi. Portanto, editar nome, cidade, modalidade, endereço, referência, quantidade, valor ou qualquer status sempre alcança primeiro a rota própria da ficha.

Nenhuma rota foi liberada e nenhuma coleção adicional foi autorizada.

## Preservado

- V123: `ContactState.save()` antes da sincronização opcional;
- escopo Mongo V122 limitado a `contactstates`;
- VSL, funil e WhatsApp;
- Dropi e autorização manual por pedido;
- Meta/CAPI e pós-venda;
- aquecimento, produtos e preços;
- banco sem migração ou backfill.

## Rollback

Retornar ao release V123:

`/opt/vitalismen-automacao/releases/20260904T042521Z_production-20260904-bc0164b`
