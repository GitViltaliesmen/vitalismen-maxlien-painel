# VITALISMEN_EC — Validação de pedidos V254 no sucessor V256

## Problema e alteração

O modelo `Order` aceitava somente `dropiDispatchV252.version=252`. O fluxo V254 grava `version=254` para revisão de dados antes do despacho. A validação do Mongoose ocorre antes do hook de `save`; por isso o pedido podia não persistir, apesar de outra camada da ficha mostrar os dados editados.

O commit funcional `d6a815da7166d54e365a31131dac4a169f7a4964` (árvore `61b50fa7984843c05aa55a61e93ddad2c81e29c5`) acrescenta `254` ao enum e atualiza somente o preload selado e o helper PM2 para reconhecer o sucessor. Não altera a lógica de envio, dados de cliente, VSL, bot ou Meta.

## Publicação

- Parent: V255 `02dccb3ea4604732c23aec1c82c8766789ceb4e6`.
- Branch funcional imutável: `codex/ec-order-v254-v256-20261121`.
- Release V256: `/opt/vitalismen-automacao/releases/20261121T172300Z_production-20261121-d6a815d`.
- Release V255 preservado para retorno: `/opt/vitalismen-automacao/releases/20261121T031500Z_production-20261121-02dccb3`.
- Autoridade: `/var/lib/vitalismen-deploy/sealed-successors-v1/d6a815da7166d54e365a31131dac4a169f7a4964.json`.
- Estado e controlador: `/var/lib/vitalismen-deploy/ec-order-v254-validation-v256-r1`.

A primeira ativação falhou no teste do modelo porque o teste herdou o ambiente PM2; o controlador restaurou V255. O teste isolado com ambiente limpo passou. O controlador foi ajustado para executar apenas essa verificação com ambiente limpo, mantendo a reversão automática. A segunda ativação retornou `PASS_ACTIVE_V256`: PID PM2 `980679` → `982629`, modelo V254 validado, health `online` e timer `vitalismen-postsale-full-v203.timer` ativo. `current` passou a apontar para V256; `pm_cwd` e `pm_exec_path` apontam para `current` no PM2 ativo.

## Verificações e limites

- Testes locais: 17/17 em `tests/order-dropi-v254-placeholder.test.mjs` e `tests/confirmed-dropi-dispatch-v252.test.mjs`.
- Fixture isolada do runtime selado no VPS: 15/15, sem rede e sem envio externo.
- Teste de validação do schema no release V256: `ORDER_V254_SCHEMA_PASS`.
- API `/api/health`: HTTP 200, `status=online` após a ativação.
- O pedido anterior `EC-MWPVC0TH-9P3O` já havia sido enviado à Dropi como `8066200` antes desta publicação; não foi reenviado.
- A verificação do modelo confirma o bloqueio de validação e sua remoção. Uma nova compra real futura ainda precisa ser acompanhada do salvamento até a fila e o recibo Dropi para confirmar o caminho completo, sem criar pedido artificial de cliente.

Rollback exige observar primeiro filas e recibos externos; não reenviar automaticamente operações de resultado incerto. O diretório V255 está preservado, mas o retorno precisa usar o controlador selado e um novo registro de ativação.
