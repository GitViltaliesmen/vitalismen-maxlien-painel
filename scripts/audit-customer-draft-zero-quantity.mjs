import fs from 'fs';
import path from 'path';

const root = process.cwd();

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const checks = [];
const failures = [];

const assertIncludes = (file, needle, label) => {
    const content = read(file);
    checks.push(label);
    if (!content.includes(needle)) {
        failures.push(`${file}: faltou ${label}`);
    }
};

const assertNotIncludes = (file, needle, label) => {
    const content = read(file);
    checks.push(label);
    if (content.includes(needle)) {
        failures.push(`${file}: ainda contem ${label}`);
    }
};

assertIncludes('public/qr.html', 'placeholder="0"', 'Ficha inicia quantidade visual 0');
assertIncludes('public/qr.html', 'normalizeCustomerQuantityValue', 'normalizador 0/1/2/3/6 no painel');
assertIncludes('public/qr.html', "new Set(['1', '2', '3', '6'])", 'Ficha aceita 2 frascos digitado manualmente');
assertIncludes('public/qr.html', 'autoSaveCustomerFieldBlur', 'autosave ao sair do campo');
assertIncludes('public/qr.html', 'formatOrderPackageLabel', 'exibicao sem quantidade quando qty 0');
assertIncludes('public/qr.html', 'if (hasValidCustomerQuantity(customerDraft.quantity))', 'PATCH parcial nao envia pacote invalido');
assertNotIncludes('public/qr.html', 'order.package?.quantity || 1', 'fallback visual para 1 frasco');

assertIncludes('src/models/Order.js', 'quantity: { type: Number, default: 0 }', 'Order default quantity 0');
assertIncludes('src/routes/whatsapp.js', 'normalizePanelPackageQuantity', 'normalizador na ficha/whatsapp');
assertIncludes('src/routes/whatsapp.js', "reason: 'missing_valid_quantity'", 'bloqueio de pedido operacional sem quantidade');
assertIncludes('src/routes/whatsapp.js', 'isValidPanelPackageQuantity(cleanDraft.quantity)', 'flowDataOk so marca quantidade valida');
assertNotIncludes('src/routes/whatsapp.js', 'customerDraft.quantity || null', 'preservar qty 0 em leitura de painel');

assertIncludes('src/routes/orders.js', 'normalizePackageQuantity', 'normalizador em orders');
assertIncludes('src/routes/orders.js', 'new Set([1, 2, 3, 6])', 'Orders aceita 2 frascos');
assertIncludes('src/routes/orders.js', "return res.status(400).json({ error: 'Quantidade valida obrigatoria: 1, 2, 3 ou 6 frascos.' });", 'POST pedido rejeita quantidade 0 e aceita 2 frascos');
assertIncludes('src/routes/orders.js', 'quantity: 0', 'draft order inicia sem quantidade');

assertIncludes('src/services/adminPanelStatusService.js', 'normalizeAdminPackageQuantity(draft.quantity)', 'sync admin preserva qty 0');
assertIncludes('src/services/adminPanelStatusService.js', 'new Set([1, 2, 3, 6])', 'admin sqlite aceita product_qty 2');
assertIncludes('src/services/adminPanelStatusService.js', 'payload.get("product_qty", 0)', 'admin sqlite recebe product_qty 0');
assertNotIncludes('src/services/adminPanelStatusService.js', 'product_qty: Number(draft.quantity || 0) || 1', 'sem fallback admin qty 1');

assertIncludes('src/services/adminPanelImportService.js', 'skippedInvalidQuantity', 'import pula lead sem quantidade valida');
assertIncludes('src/services/metaConversionsService.js', 'META Purchase missing valid quantity', 'Meta Purchase bloqueia qty invalida');
assertIncludes('src/services/metaConversionsService.js', 'new Set([1, 2, 3, 6])', 'Meta Purchase aceita qty 2');
assertIncludes('scripts/reconcile-whatsapp-to-unified-panel.mjs', 'normalizePackageQuantity(draft.quantity)', 'reconciliacao nao recria qty 1');
assertIncludes('scripts/export-meta-offline-purchases.mjs', "reason: 'invalid_quantity'", 'export Meta pula qty invalida');
assertIncludes('src/routes/shipments.js', 'if (!quantity || total <= 0) return null;', 'ponte Dropi bloqueia qty 0');
assertIncludes('scripts/import-vps-admin-confirmed.mjs', 'if (!quantity || total <= 0) return null;', 'import confirmado bloqueia qty 0');

if (failures.length) {
    console.error('[customer-draft-zero-quantity] FAIL');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log(`[customer-draft-zero-quantity] OK - ${checks.length} verificacoes passaram.`);
