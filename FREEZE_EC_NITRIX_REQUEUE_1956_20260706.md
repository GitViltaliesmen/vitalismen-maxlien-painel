# FREEZE EC - Reenvio Nitrix pendente final 1956

Data: 2026-07-06
Camada: Equador / Nitrix / Dropi / pedido final 1956

## Pedido

- Cliente: Joel Anton Delgado
- Telefone final: `1956`
- Order: `EC-MR8MOOWO-WTTK`
- Dropi antigo cancelado pelo operador: `6009952`
- Produto correto esperado: Nitrix
- Quantidade: 2 frascos
- Total: USD 70

## Estado congelado

O pedido local foi limpo do vinculo Dropi antigo:

- `Order.status=confirmed`
- `Order.package.label=Nitrix 2 frascos`
- `Order.total=70`
- `Order.dropiOrderId=''`
- `Shipment.productName=Nitrix`
- `Shipment.logistics.status=created`
- `Shipment.automation.submittedToDroppiAt=null`
- `Shipment.automation.dropiSubmitAuthorizedAt=null`
- `Shipment.review.manualOnly=true`
- `Shipment.review.reviewStatus=nitrix_dropi_product_pending`

## Motivo da trava

A inspeção segura da Dropi nao confirmou produto Nitrix no catalogo. A chamada:

`node scripts/inspect-dropi-ec-product-target.mjs Nitrix`

voltou para tela de login/sem cards Nitrix. Portanto, o reenvio automatico permanece bloqueado ate o produto Nitrix ser confirmado/configurado.

## Correcao tecnica adicional

`src/services/droppiEcuadorService.js` agora preserva revisoes manuais Nitrix durante sync ativo da Dropi:

- `wrong_product_nitrix_manual_review`
- `nitrix_dropi_product_pending`

Tambem foi corrigida a regra de `manualOnly`: status normal da Dropi nao deve soltar `manualOnly` quando ele ja estava travado.

## Proximo passo operacional

Para reenviar pelo bot/Dropi de forma controlada, primeiro confirmar um destes:

1. produto Nitrix aparece na conta Dropi EC; ou
2. informar URL/ID/nome exato do produto Nitrix na Dropi.

Depois disso habilitar explicitamente:

- `DROPPI_EC_NITRIX_PRODUCT_URL`
- `DROPPI_EC_NITRIX_PRODUCT_NAME`
- `DROPPI_EC_NITRIX_PRODUCT_ALIASES`
- `DROPPI_EC_NITRIX_PRODUCT_ENABLED=true`

Sem isso, o sistema deve bloquear reenvio para evitar novo Vit Power errado.

