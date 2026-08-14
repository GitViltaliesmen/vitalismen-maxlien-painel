# Freeze EC - Ficha do Cliente Autosave e Quantidade Zero

Data: 2026-06-22
Pais: EC
Dominio: ec.maxlien.shop
Servico: vitalismen-automation

## Problema

A Ficha do Cliente podia salvar dados parciais, como cidade/agencia/provincia, e transformar quantidade vazia em `1 frasco` por fallback interno. Isso gerava risco de pedido, Dropi ou Purchase incorreto.

## Regra congelada

- Quantidade vazia, `0`, `null` ou indefinida significa pacote nao escolhido.
- Apenas `1`, `3` e `6` sao pacotes validos.
- Autosave da ficha salva dados operacionais ao sair do campo.
- Salvar nome, telefone, cidade, provincia, agencia/endereco, referencia ou status nao cria pacote.
- Pedido operacional, Dropi e Meta Purchase ficam bloqueados sem quantidade valida e valor positivo.
- Painel deve exibir `sem quantidade` quando nao houver pacote escolhido.

## Arquivos alterados

- `public/qr.html`
- `src/models/Order.js`
- `src/routes/whatsapp.js`
- `src/routes/orders.js`
- `src/routes/shipments.js`
- `src/services/adminPanelStatusService.js`
- `src/services/adminPanelImportService.js`
- `src/services/metaConversionsService.js`
- `scripts/reconcile-whatsapp-to-unified-panel.mjs`
- `scripts/export-meta-offline-purchases.mjs`
- `scripts/import-vps-admin-confirmed.mjs`
- `scripts/audit-customer-draft-zero-quantity.mjs`
- `package.json`

## Backup VPS

Backup criado antes do deploy:

`/opt/vitalismen-automacao/backups/customer-draft-zero-quantity-20260622-220656`

## Provas

- Local: `node scripts/audit-customer-draft-zero-quantity.mjs`
- VPS: `node scripts/audit-customer-draft-zero-quantity.mjs`
- Resultado: `[customer-draft-zero-quantity] OK - 23 verificacoes passaram.`
- API publica: `https://ec.maxlien.shop/api/health` retornou `status: online`.
- QR publico contem `customerQuantityInput` com `placeholder="0"` e `autoSaveCustomerFieldBlur`.
- Teste controlado no numero falso `593900000863`:
  - PATCH de ficha com cidade/provincia/agencia e `quantity:"0"`;
  - `ContactState.metadata.customerDraft.quantity` ficou `"0"`;
  - `Order` criado: `0`;
  - admin SQLite recebeu `product_qty: 0` e `product_value: 0`;
  - teste removido depois: `deletedContactStates: 1`, `deletedOrders: 0`, `deletedAdminLeadIds: [2341]`.

## Observacao operacional

Durante o restart apareceu erro antigo de export ausente para observacao. Foi corrigido adicionando `listOnlineAdminLeadsByWindow` em `adminPanelStatusService.js`. Depois disso `/api/observation/actionables` retornou `ok:true`.
