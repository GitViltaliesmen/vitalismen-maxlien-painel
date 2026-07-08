import fs from 'fs';
import path from 'path';

const root = process.cwd();
const failures = [];

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
    if (!condition) failures.push(message);
};
const assertIncludes = (file, needle, message) => {
    assert(read(file).includes(needle), `${message} (${file})`);
};
const assertNotMatches = (file, regex, message) => {
    assert(!regex.test(read(file)), `${message} (${file})`);
};

assertIncludes('public/qr.html', 'id="customerProductInput"', 'Ficha do Cliente tem seletor de produto');
assertIncludes('public/qr.html', 'Nitrix Oxide Ecuador', 'Ficha mostra Nitrix');
assertIncludes('public/qr.html', 'Vit Power Ecuador', 'Ficha mantem Vit Power para recompra/pedido explicito');
assertIncludes('public/qr.html', 'EC_PRODUCT_CATALOG', 'Ficha usa catalogo EC local');
assertIncludes('public/qr.html', "return 'vit_power_ec';", 'Ficha reconhece Vit Power explicitamente');
assertIncludes('public/qr.html', "return 'nitrix_ec';", 'Ficha reconhece Nitrix explicitamente');
assertIncludes('public/qr.html', 'productLabelForQuantity', 'Ficha monta label por produto selecionado');
assertIncludes('public/qr.html', 'payload.productKey = customerDraft.productKey;', 'PATCH de pedido leva productKey');
assertIncludes('public/qr.html', 'orderPayload.productKey = customerDraft.productKey;', 'POST de pedido leva productKey');
assertIncludes('public/qr.html', "draftCountry === 'EC'", 'Produto fica restrito a ficha EC');
assertNotMatches('public/qr.html', /packageLabel:\s*`Vit Power /, 'Ficha nao cria pedido novo com label fixo Vit Power');
assertNotMatches('public/qr.html', /label:\s*chat\.packageLabel\s*\|\|\s*`Vit Power /, 'Ficha nao atualiza pedido com fallback fixo Vit Power');

assertIncludes('src/services/ecuadorProductService.js', 'ECUADOR_PRODUCTS', 'Servico centraliza produtos EC');
assertIncludes('src/services/ecuadorProductService.js', 'hasVitPowerSignal', 'Servico reconhece Vit Power explicitamente');
assertIncludes('src/services/ecuadorProductService.js', 'return ECUADOR_PRODUCTS.nitrix;', 'Servico usa Nitrix como default');
assertIncludes('src/routes/orders.js', 'productInfoFromOrderRequest', 'Orders resolve produto do pedido');
assertIncludes('src/routes/orders.js', 'productAwarePackageLabel', 'Orders monta label por produto');
assertIncludes('src/routes/orders.js', 'productTrackingMetadata', 'Orders salva tracking de produto');
assertIncludes('src/services/metaConversionsService.js', 'ecuadorProductMetadata(resolveEcuadorProductInfo(order))', 'Purchase EC resolve produto do pedido');
assertIncludes('src/services/metaConversionsService.js', 'content_name: productMetadata.contentName', 'Purchase usa nome de conteudo do produto');
assertIncludes('src/services/metaConversionsService.js', 'content_ids: contentIds', 'Purchase usa content_ids do produto');
assertIncludes('src/services/metaConversionsService.js', 'id: contentIds[0]', 'Purchase usa id do produto');
assertIncludes('src/routes/whatsapp.js', 'allowedDraftProductKeys', 'WhatsApp aceita so whitelist de produtos EC');
assertIncludes('src/routes/whatsapp.js', "cleanDraft.country === 'EC'", 'Whitelist de produto fica restrita a EC');

const {
    ECUADOR_PRODUCTS,
    resolveEcuadorProductInfo
} = await import('../src/services/ecuadorProductService.js');
const {
    buildPurchaseEventPayloadForOrder
} = await import('../src/services/metaConversionsService.js');

assert(resolveEcuadorProductInfo({ package: { label: 'Package 3' } }).key === ECUADOR_PRODUCTS.nitrix.key, 'Resolver default EC e Nitrix');
assert(resolveEcuadorProductInfo({ productKey: 'nitrix_ec' }).key === ECUADOR_PRODUCTS.nitrix.key, 'Resolver aceita productKey Nitrix');
assert(resolveEcuadorProductInfo({ productKey: 'vit_power_ec' }).key === ECUADOR_PRODUCTS.vitPower.key, 'Resolver aceita productKey Vit Power');
assert(resolveEcuadorProductInfo({ productName: 'Vit Power Ecuador' }).key === ECUADOR_PRODUCTS.vitPower.key, 'Resolver aceita pedido explicito Vit Power');

const baseOrder = {
    country: 'EC',
    total: 95.99,
    currency: 'USD',
    source: 'manual',
    package: {
        id: 3,
        quantity: 3
    },
    customer: {
        name: 'Cliente Guard EC',
        phone: '+593987654321',
        city: 'Quito',
        province: 'Pichincha'
    },
    tracking: {
        ip: '203.0.113.10',
        userAgent: 'EC product guard'
    }
};

const purchaseContentIdsFor = (order) => {
    const built = buildPurchaseEventPayloadForOrder(order);
    assert(built.ok, `Purchase payload deve montar: ${built.error || 'erro desconhecido'}`);
    return built.payload?.data?.[0]?.custom_data?.content_ids || [];
};

const nitrixIds = purchaseContentIdsFor({
    ...baseOrder,
    orderId: 'EC-GUARD-NITRIX',
    package: {
        ...baseOrder.package,
        label: 'Nitrix Oxide Ecuador 3 frascos'
    },
    tracking: {
        ...baseOrder.tracking,
        productKey: 'nitrix_ec',
        productName: 'Nitrix Oxide Ecuador'
    }
});
assert(nitrixIds.includes('nitrix_oxide_ec'), 'Purchase Nitrix usa content_id nitrix_oxide_ec');

const vitPowerIds = purchaseContentIdsFor({
    ...baseOrder,
    orderId: 'EC-GUARD-VITPOWER',
    package: {
        ...baseOrder.package,
        label: 'Vit Power Ecuador 3 frascos'
    },
    tracking: {
        ...baseOrder.tracking,
        productKey: 'vit_power_ec',
        productName: 'Vit Power Ecuador'
    }
});
assert(vitPowerIds.includes('vit_power_ec'), 'Purchase Vit Power usa content_id vit_power_ec');

if (failures.length) {
    console.error('EC product micro-layer guard: FALHOU');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log('EC product micro-layer guard: OK');
