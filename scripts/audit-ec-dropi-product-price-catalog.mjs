import fs from 'node:fs';
import path from 'node:path';
import {
    ECUADOR_PRICE_CATALOGS,
    detectExplicitEcuadorProductKey,
    getEcuadorOffer,
    listEcuadorDropiProducts
} from '../src/services/ecuadorProductService.js';
import { buildDroppiEcuadorOrderPayload } from '../src/services/droppiEcuadorService.js';

const root = process.cwd();
const failures = [];
const assert = (condition, message) => {
    if (!condition) failures.push(message);
};
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const expected = {
    normal: { 1: 39.99, 2: 70.00, 3: 95.99, 6: 167.99 },
    promotional: { 1: 35.99, 2: 70.00, 3: 80.99, 6: 147.99 }
};
const products = listEcuadorDropiProducts();
const productKeys = products.map((product) => product.key).sort();

assert(
    JSON.stringify(productKeys) === JSON.stringify(['nitrix_ec', 'tex_ultra_ec', 'vit_power_ec']),
    'Catalogo deve conter somente Vit Power, Nitrix e Tex Ultra'
);
assert(JSON.stringify(ECUADOR_PRICE_CATALOGS) === JSON.stringify(expected), 'Tabela central de precos diverge do solicitado');
assert(
    getEcuadorOffer({ productKey: 'vit_power_ec', priceCatalog: 'valor_digitado', quantity: 1 }) === null,
    'Servidor nao pode aceitar uma tabela de preco arbitraria como normal'
);
assert(
    detectExplicitEcuadorProductKey({
        notes: 'Cliente perguntou sobre Nitrix\n[DROPI_PRODUCT] key=vit_power_ec; name=Vit Power; priceCatalog=normal; quantity=1; total=39.99',
        tracking: { productKey: 'vit_power_ec' }
    }) === 'vit_power_ec',
    'Selecao explicita mais recente deve prevalecer sobre texto historico de outro produto'
);

for (const product of products) {
    for (const [priceCatalog, prices] of Object.entries(expected)) {
        for (const [quantityText, total] of Object.entries(prices)) {
            const quantity = Number(quantityText);
            const offer = getEcuadorOffer({ productKey: product.key, priceCatalog, quantity });
            assert(Boolean(offer), `${product.key}/${priceCatalog}/${quantity} deve existir`);
            assert(offer?.total === total, `${product.key}/${priceCatalog}/${quantity} deve manter USD ${total.toFixed(2)}`);

            const payload = buildDroppiEcuadorOrderPayload({
                order: {
                    orderId: `EC-AUDIT-${product.key}-${priceCatalog}-${quantity}`,
                    country: 'EC',
                    total,
                    notes: `[DROPI_PRODUCT] key=${product.key}; name=${product.name}; priceCatalog=${priceCatalog}; quantity=${quantity}; total=${total.toFixed(2)}`,
                    package: {
                        id: quantity,
                        quantity,
                        label: `${product.name} ${quantity} frascos`
                    },
                    customer: {
                        name: 'Cliente Auditoria',
                        phone: '+593991234567',
                        address: 'Endereco de auditoria',
                        city: 'Quito',
                        province: 'Pichincha'
                    },
                    tracking: {
                        productKey: product.key,
                        productName: product.name
                    }
                }
            });
            assert(payload.price === total, `${product.key}/${priceCatalog}/${quantity} nao pode arredondar o total`);
            assert(
                Math.abs(payload.unitPrice - (total / quantity)) < 0.000001,
                `${product.key}/${priceCatalog}/${quantity} deve calcular preco unitario a partir do total exato`
            );
            assert(payload.productKey === product.key, `${product.key} deve permanecer explicito no payload`);
        }
    }
}

const leadsHtml = read('public/leads-window.html');
for (const label of ['Vit Power', 'Nitrix', 'Tex Ultra', 'Preco normal', 'Preco promocional']) {
    assert(leadsHtml.includes(label), `Leads Clientes deve mostrar ${label}`);
}
for (const value of ['39.99', '70.00', '95.99', '167.99', '35.99', '80.99', '147.99']) {
    assert(leadsHtml.includes(value), `Leads Clientes deve conter USD ${value}`);
}
assert(
    leadsHtml.includes('/configure-order'),
    'Selecao do painel deve ser persistida no pedido operacional antes da autorizacao'
);
assert(
    leadsHtml.includes('Nada sera enviado agora. O envio real exige outro clique'),
    'Fluxo deve manter autorizacao separada do envio real'
);

const qrHtml = read('public/qr.html');
for (const value of ['tex_ultra_ec', '35.99', '70.00', '80.99', '147.99']) {
    assert(qrHtml.includes(value), `Ficha WhatsApp deve conter ${value}`);
}
assert(
    qrHtml.includes('<option value="tex_ultra_ec">Tex Ultra Ecuador</option>'),
    'Ficha WhatsApp deve permitir selecionar Tex Ultra'
);

const vslHtml = read('public/n/index.html');
const ctaConfig = read('public/cta-nx-messages.json');
assert(vslHtml.includes('productKey: "tex_ultra_ec"'), 'VSL /n/ deve atribuir Tex Ultra');
assert(vslHtml.includes('const PRICE_MAP = { 1: 35.99, 2: 70.00, 3: 80.99, 6: 147.99 };'), 'VSL /n/ deve usar a tabela promocional Tex Ultra');
assert(!vslHtml.includes('productKey: "nitrix_ec"'), 'VSL /n/ nao pode continuar atribuindo Nitrix');
assert(ctaConfig.includes('"productKey": "tex_ultra_ec"'), 'CTA /n/ deve abrir WhatsApp como Tex Ultra');

const contactStateModel = read('src/models/ContactState.js');
assert(contactStateModel.includes("'tex_ultra_ec'"), 'ContactState deve aceitar Tex Ultra');
const agentProfiles = read('src/services/agentProfiles.js');
assert(agentProfiles.includes("key: 'tex_ultra_ec'"), 'Roteador deve ter perfil isolado Tex Ultra');
assert(agentProfiles.includes('1 por 35.99 USD, 2 por 70.00 USD, 3 por 80.99 USD y 6 por 147.99 USD'), 'Perfil Tex Ultra deve registrar a oferta promocional aprovada');

const browserService = read('src/services/droppiEcuadorBrowserService.js');
assert(
    browserService.includes('dropi_product_price_selection_required'),
    'Browser Dropi deve bloquear pedido sem produto/preco oficial'
);
assert(
    !browserService.includes('DROPPI_EC_NITRIX_PRODUCT_URL || PRODUCT_URL'),
    'Nitrix nunca pode usar o URL de Vit Power como fallback'
);

if (failures.length) {
    console.error('EC Dropi product/price catalog audit: FALHOU');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(`EC Dropi product/price catalog audit: OK (${products.length} produtos, 24 combinacoes verificadas, sem envio real).`);
