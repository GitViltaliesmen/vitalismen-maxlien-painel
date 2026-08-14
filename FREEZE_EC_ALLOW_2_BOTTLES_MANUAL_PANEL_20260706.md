# FREEZE EC - Ficha manual aceita 2 frascos

Data: 2026-07-06
Camada: Equador / painel WhatsApp / Ficha do Cliente
Dominio: https://ec.maxlien.shop

## Objetivo

Permitir que a Ficha do Cliente aceite pedido manual de 2 frascos, com total USD 70, sem acrescentar botao/preset novo no painel.

## Regra congelada

- Operador pode digitar `2` no campo de quantidade da ficha.
- Operador pode salvar valor total `70`.
- Presets visuais do painel continuam sem botao de 2 frascos.
- Validadores de painel, pedido, importacao, reconciliacao, envio/ponte e Meta agora reconhecem quantidade `2` como valida.
- Caso uma entrada tecnica chegue com `product_qty=2` sem valor explicito, o fallback EC usa `USD 70`.

## Correcao adicional da mesma camada

O log do VPS mostrava falha ao assumir atendimento:

`Claim contact error: ReferenceError: minutes is not defined`

Foi corrigido o registro da pausa longa do atendimento humano. Agora o painel registra a pausa como `pausa por 3650 dias`, usando a mesma duracao ja aplicada por `longManualHoldUntil()`.

## Arquivos alterados

- `public/qr.html`
- `src/routes/whatsapp.js`
- `src/routes/orders.js`
- `src/routes/leads.js`
- `src/routes/shipments.js`
- `src/services/adminPanelStatusService.js`
- `src/services/adminPanelImportService.js`
- `src/services/metaConversionsService.js`
- `src/services/aiRouter.js`
- `scripts/audit-customer-draft-zero-quantity.mjs`
- `scripts/export-meta-offline-purchases.mjs`
- `scripts/import-vps-admin-confirmed.mjs`
- `scripts/reconcile-whatsapp-to-unified-panel.mjs`

## Backup VPS

- `/root/codex_deploy_backups/ec-allow-2-bottles-manual-fix-20260706T024955Z`

## Evidencia de publicacao

PM2:

- `vitalismen-automation`: online
- `exec cwd`: `/opt/vitalismen-automacao/releases/202606141310`
- `unstable restarts`: 0

Saude:

- `https://ec.maxlien.shop/api/health/`: `status=online`, `engine=Z-API`
- Z-API conectado ao telefone EC final `2800`

Hashes publicados:

- `public/qr.html`: `7d6592d8228421e56bec06701618d2130bc0012a5346db351d581ec05573a262`
- `/var/www/ec.maxlien.shop/qr.html`: `7d6592d8228421e56bec06701618d2130bc0012a5346db351d581ec05573a262`
- HTML servido em `https://ec.maxlien.shop/qr.html`: `7d6592d8228421e56bec06701618d2130bc0012a5346db351d581ec05573a262`
- `src/routes/whatsapp.js`: `8ddcf52a475724588402a5f0480ece73cb0228580a46dcea20c39ffa4143b038`
- `src/routes/orders.js`: `600a52b396e6f418e0784a01a00dd9de11f5572b665e49fd1cdc24240ac1563e`
- `src/routes/leads.js`: `bb17245660ba41206bcf5bc9b9bf382fe7b2a27e116c0538ccf733222c9e663f`
- `src/services/metaConversionsService.js`: `6073647df852af22ee424ab7e062c1ca331675b3660eb522c83e31fb1b1c4bbe`

## Checks executados

Local e VPS:

- `node --check src/routes/whatsapp.js`
- `node --check src/routes/orders.js`
- `node --check src/routes/leads.js`
- `node --check src/routes/shipments.js`
- `node --check src/services/adminPanelStatusService.js`
- `node --check src/services/adminPanelImportService.js`
- `node --check src/services/metaConversionsService.js`
- `node --check src/services/aiRouter.js`
- `node --check scripts/audit-customer-draft-zero-quantity.mjs`
- `node scripts/guard-freeze-lock-ec.mjs`
- `node scripts/guard-status-panels-freeze.mjs`
- `node scripts/audit-no-regression-meta-country.mjs`
- `node scripts/audit-customer-draft-zero-quantity.mjs`

Resultado:

- `[FREEZE-LOCK-EC] OK`
- `[STATUS-PANELS-FREEZE] OK`
- `[REGRESSION-AUDIT] OK`
- `[customer-draft-zero-quantity] OK - 27 verificacoes passaram`

## Regra operacional

Para pedido manual de recuperacao:

1. Abrir a Ficha do Cliente.
2. Digitar quantidade `2`.
3. Digitar valor total `70`.
4. Salvar normalmente.

Nao foi liberado preco novo no grid de presets; a camada e apenas permissao de digitacao/salvamento manual.
