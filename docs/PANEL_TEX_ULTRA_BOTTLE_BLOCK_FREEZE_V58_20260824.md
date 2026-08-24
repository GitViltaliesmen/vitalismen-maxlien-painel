# Freeze V58 — frasco e continuidade do bloco manual Tex Ultra

Data: 2026-08-24
Pais: Equador
Pai: `panel-customer-alias-repair-v57-20260824`

## Incidente comprovado

O bloco manual `tex_ultra_inicio_completo` enviava saudacao, audio universal e
Prova 1, mas parava no frasco e nao alcancava a tabela promocional. O painel
tambem oferecia o mesmo caminho quebrado no atalho de midia M01.

A release V57 apontava esses dois itens para
`/media/sales/ec/tex_ultra_bottle.png`, arquivo inexistente no painel e na
release oficial. A API registrava a tentativa como `unconfirmed`, sem provedor,
antes de chegar a Z-API. A varredura somente leitura encontrou cinco registros
historicos com esse mesmo caminho e estado.

## Correcao autorizada

- M01 e B01 passam a usar o arquivo oficial ja congelado
  `/media/sales/ec/tex_ultra.png`.
- A sequencia B01 permanece: saudacao personalizada, um audio universal, Prova
  1, frasco Tex Ultra e tabela promocional.
- A tabela permanece em 1/2/3/6 frascos por USD 35.99/70.00/80.99/147.99.
- A falha de uma etapa continua interrompendo o bloco; nenhuma etapa posterior
  e declarada enviada sem confirmacao da API.
- Cada etapa leva `clientGeneratedId`, sessao e pais para a API. O painel
  reconcilia a bolha com o registro persistido quando houver sucesso e conserva
  o estado `unconfirmed` quando houver falha.

## Varredura e travas

- Todas as referencias literais de midia do painel foram comparadas com os
  arquivos versionados; aliases legados declarados foram resolvidos para seus
  destinos.
- A unica referencia ativa ausente era o frasco Tex Ultra corrigido aqui.
- O guard V58 exige que M01 e B01 apontem para o arquivo oficial existente,
  proibe `tex_ultra_bottle.png` no painel e confirma a ordem ate os valores.
- A extensao Chrome possui sua propria copia valida em `legacy-media` e nao foi
  alterada.

## Preservado

Produto, precos, VSL, checkout, Dropi, Meta/CAPI, pixel, Z-API, numero oficial,
audios, provas, memoria, pedidos, scheduler, pos-venda, motor automatico e
outros produtos permanecem inalterados. Nenhum cliente real deve ser usado no
canario; somente o telefone QA `5515998038637` pode receber validacao controlada.

## Validacao e rollback

- `npm run guard:panel-tex-ultra-bottle-v58`
- `npm run senior:check`
- `npm test`
- `node scripts/audit-ec-product-micro-layer.mjs`
- `node scripts/audit-guide-print-spam-guard.mjs`

Rollback: reativar integralmente a release V57
`/opt/vitalismen-automacao/releases/20260824T045910Z_production-20260824-33e48fc`.
Bancos, mensagens, pedidos e midias compartilhadas nao devem ser removidos.
