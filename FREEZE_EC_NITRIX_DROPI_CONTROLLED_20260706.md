# FREEZE EC - Nitrix Dropi controlado

Data: 2026-07-06
Camada: Equador / Nitrix / Dropi / envio controlado
Dominio: https://ec.maxlien.shop

## Objetivo

Preparar o envio Dropi para pedidos Nitrix sem contaminar Vit Power e sem permitir envio automatico para produto errado.

## O que mudou

- Criado resolvedor de produto EC:
  - Vit Power continua padrao quando nao ha sinal Nitrix.
  - Nitrix e reconhecido por `Nitrix`, `n_i_trix`, `nitric`, `oxido nitrico` e variacoes.
- Ficha/painel WhatsApp passa a inferir Nitrix por:
  - campo de produto, quando existir;
  - tags/metadados;
  - mensagem recente do cliente com Nitrix/oxido nitrico.
- Payload Dropi agora leva `productName/productKey/contentName/contentIds` do produto resolvido.
- Browser Dropi agora seleciona produto por aliases do produto alvo e nao clica livremente no primeiro botao da pagina de busca.
- Criado script seguro de inspecao:
  - `scripts/inspect-dropi-ec-product-target.mjs`
  - Ele loga e le cards do catalogo, sem clicar em `Enviar al cliente` e sem criar pedido.
- Criado audit:
  - `scripts/audit-ec-nitrix-dropi-controlled.mjs`

## Travas congeladas

- Se houver mensagem recente Nitrix para o telefone, mas o pedido estiver marcado como outro produto, o envio Dropi e bloqueado com `nitrix_order_product_mismatch`.
- Mesmo marcado como Nitrix, o envio automatico fica bloqueado ate habilitar explicitamente:
  - `DROPPI_EC_NITRIX_PRODUCT_ENABLED=true`
- Antes de habilitar, e preciso configurar/confirmar produto Nitrix no catalogo Dropi:
  - `DROPPI_EC_NITRIX_PRODUCT_URL`
  - `DROPPI_EC_NITRIX_PRODUCT_NAME`
  - `DROPPI_EC_NITRIX_PRODUCT_ALIASES`

## Evidencia Dropi

Inspecao segura executada no VPS:

`node scripts/inspect-dropi-ec-product-target.mjs Nitrix`

Resultado:

- `matchCount: 0`
- Cards encontrados no catalogo atual:
  - `Vit Powerss 1000ml Potencializador`
  - `Vit Powerss 1000 Ml X1 Comunidad`

Conclusao: Nitrix ainda nao aparece no catalogo Dropi desta conta/fornecedor. Portanto, envio automatico Nitrix fica bloqueado por configuracao.

## Incidente encontrado durante a validacao

Pedido:

- Order: `EC-MR8MOOWO-WTTK`
- Cliente final: `1956`
- Cliente: Joel Anton Delgado
- Pedido esperado: Nitrix 2 frascos, total USD 70

Enquanto a camada ainda estava em validacao, o pedido foi autorizado/enviado na Dropi como:

- Dropi: `6009952`
- Produto real criado: `VIT POWERSS 1000ML / POTENCIALIZADOR`
- Quantidade: 2
- Valor Dropi: USD 70

Correcao aplicada no nosso painel/banco:

- Order local: `Nitrix 2 frascos`, total `70`
- SQLite painel: `product_qty=2`, `product_value=70`
- Shipment: `productName=Nitrix`
- Review travada:
  - `manualOnly=true`
  - `reviewStatus=wrong_product_nitrix_manual_review`
  - `reviewReason=Dropi 6009952 criado com Vit Powerss/Potencializador; produto Nitrix nao encontrado no catalogo Dropi.`

Acao operacional necessaria:

- Abrir Dropi e cancelar/corrigir manualmente o Dropi `6009952` antes de qualquer aviso ao cliente.
- Nao reenviar automatico Nitrix ate o produto Nitrix aparecer no catalogo e a flag `DROPPI_EC_NITRIX_PRODUCT_ENABLED=true` ser habilitada.

## Backup VPS

- `/root/codex_deploy_backups/ec-nitrix-dropi-controlled-20260706T030922Z`

## Validacoes

Local e VPS:

- `node --check src/services/ecuadorProductService.js`
- `node --check src/services/droppiEcuadorService.js`
- `node --check src/services/droppiEcuadorBrowserService.js`
- `node --check src/routes/whatsapp.js`
- `node --check src/routes/leads.js`
- `node --check src/routes/shipments.js`
- `node --check scripts/audit-ec-nitrix-dropi-controlled.mjs`
- `node --check scripts/inspect-dropi-ec-product-target.mjs`
- `node scripts/guard-freeze-lock-ec.mjs`
- `node scripts/guard-status-panels-freeze.mjs`
- `node scripts/audit-no-regression-meta-country.mjs`
- `node scripts/audit-customer-draft-zero-quantity.mjs`
- `node scripts/audit-ec-nitrix-dropi-controlled.mjs`

Resultado:

- `[FREEZE-LOCK-EC] OK`
- `[STATUS-PANELS-FREEZE] OK`
- `[REGRESSION-AUDIT] OK`
- `[customer-draft-zero-quantity] OK - 27 verificacoes passaram`
- `[audit-ec-nitrix-dropi-controlled] OK - 15 verificacoes passaram`

Saude:

- PM2 `vitalismen-automation`: online
- `unstable restarts`: 0
- Health: `status=online`, `engine=Z-API`
- Z-API: conectado no final `2800`
- Pendentes autorizados nao enviados: `0`

## Hashes VPS

- `src/services/ecuadorProductService.js`: `7832c2b1fb94384780719a4c23217045b82d8fbb9e9bb885e78e8db35c4a67a1`
- `src/services/droppiEcuadorBrowserService.js`: `5c1c5d7f0b81c7ce07f8c59c247b5ffea4027776fe9a7c33c1647a140682019e`
- `src/services/droppiEcuadorService.js`: `29ccfa17ebb48011ddbd49553b598d38112565eb8a5013b52b9cae3231fe2aaa`
- `src/routes/whatsapp.js`: `3e40b4134912214a2c3094d2b011c906d912b535db2569ff250ba7d35b45d001`
- `scripts/audit-ec-nitrix-dropi-controlled.mjs`: `1c38de46fe39f7a75fcca584d90bb3a2f39e83a7fd1e7f437ee2c4c790e9bcc1`
- `scripts/inspect-dropi-ec-product-target.mjs`: `519820523eba38e470ebe925505bddc7517b7c96f9b1aee83ff5565bc666e373`

