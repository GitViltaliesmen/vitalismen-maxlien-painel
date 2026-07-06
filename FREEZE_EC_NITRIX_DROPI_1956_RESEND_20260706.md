# Freeze EC Nitrix Dropi 1956 Resend 2026-07-06

## Escopo
- Pais: Equador.
- Cliente: telefone final 1956.
- Pedido local: `EC-MR8MOOWO-WTTK`.
- Produto correto: Nitrix / Dropi `NITRIC OXIDE`, product ID `105825`.
- Pedido antigo cancelado pelo operador: Dropi `6009952`, produto Vit Power.
- Novo pedido criado: Dropi `6010513`.

## Correcoes Congeladas
- Configurado no VPS o produto Nitrix EC:
  - `DROPPI_EC_NITRIX_PRODUCT_URL=https://app.dropi.ec/dashboard/product-details/105825/nitric-oxide`
  - `DROPPI_EC_NITRIX_PRODUCT_NAME=NITRIC OXIDE`
  - aliases Nitrix/Nitric/Oxido Nitrico
  - habilitado `DROPPI_EC_NITRIX_PRODUCT_ENABLED=true`
- A pagina direta da Dropi agora so permite clique em `Enviar al cliente` se o texto da pagina bater com o produto alvo.
- O sync ativo da Dropi agora evita contaminar shipment de outro produto.
- O painel manual de WhatsApp agora libera texto repetido curto em atendimento manual, evitando falha falsa por dedupe ao digitar respostas como `Si`.

## Evidencias
- Auditoria local e VPS:
  - `scripts/audit-ec-nitrix-dropi-controlled.mjs`
  - resultado: `OK - 19 verificacoes passaram`
- Inspecao segura Dropi:
  - URL final: `https://app.dropi.ec/dashboard/product-details/105825/nitric-oxide?privated=true`
  - texto validado: `Proveedor: Angelica Nitric Oxide ID:105825 Nitric Oxide`
  - estoque lido: `292` antes do envio
- Payload do pedido:
  - `productKey=nitrix_ec`
  - `productName=Nitrix`
  - `quantity=2`
  - `unitPrice=35`
  - `price=70`
  - carrier preferido: `SERVIENTREGA`
- Resultado Dropi:
  - `ok=true`
  - `dropiOrderId=6010513`
  - `status=PENDIENTE`
  - `chosenCarrier=SERVIENTREGA`
  - Dropi retornou `orderdetails[0].product_id=105825`
  - Dropi retornou `orderdetails[0].product.name=NITRIC OXIDE`
  - Dropi retornou `orderdetails[0].quantity=2.00`
  - Dropi retornou `orderdetails[0].price=35.00`

## Estado Final
- `Order.status=processing`
- `Order.shippingStatus=PENDIENTE`
- `Order.dropiOrderId=6010513`
- `Order.trackingNumber` ainda vazio porque a Dropi ainda nao retornou guia.
- `Shipment.productName=Nitrix`
- `Shipment.review.manualOnly=false`
- `Shipment.review.reviewStatus=submitted`
- `Shipment.automation.browserCheckpoint=submitted_verified`
- `Shipment.raw.previousWrongDropiOrderId=6009952`

## Saude Pos-Deploy
- `https://ec.maxlien.shop/api/health/`: online.
- Z-API EC conectado no final `2800`.
- `https://ec.maxlien.shop/api/zapi/status`: `smartphoneConnected=true`.

## Backups VPS
- `.env`: `/root/codex_deploy_backups/ec-nitrix-product-url-20260706T033803Z/.env`
- arquivos antes do deploy WhatsApp/Nitrix: `/root/codex_deploy_backups/ec-panel-nitrix-whatsapp-20260706T034113Z/`
- arquivos antes da trava de sync: `/root/codex_deploy_backups/ec-sync-product-guard-20260706T034354Z/`

## Regra Operacional
- Vit Power antigo fica apenas como historico do cancelamento.
- Reenvios Nitrix EC devem apontar para Dropi product ID `105825`.
- Nao reenviar o mesmo pedido se `dropiOrderId` ou guia ja estiverem preenchidos.
- Mensagens manuais no painel EC podem repetir texto curto quando o operador esta em atendimento manual.
