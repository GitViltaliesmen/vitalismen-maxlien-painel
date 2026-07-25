import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    ECUADOR_PRODUCTS,
    detectExplicitEcuadorProductKey,
    resolveEcuadorProductInfo
} from '../src/services/ecuadorProductService.js';
import {
    TEX_ULTRA_EC_PRODUCT_PROFILE,
    texUltraPriceForQuantity,
    texUltraPublicOfferText
} from '../src/services/texUltraProductProfile.js';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

assert.equal(ECUADOR_PRODUCTS.texUltra.key, 'tex_ultra_ec');
assert.equal(detectExplicitEcuadorProductKey('Producto: Tex Ultra'), 'tex_ultra_ec');
assert.equal(detectExplicitEcuadorProductKey({ productKey: 'tex_ultra_ec' }), 'tex_ultra_ec');
assert.equal(resolveEcuadorProductInfo({ productName: 'TEX-ULTRA' }).key, 'tex_ultra_ec');

assert.deepEqual(Object.keys(TEX_ULTRA_EC_PRODUCT_PROFILE.offerCatalog).map(Number), [1, 2, 3, 6]);
assert.equal(texUltraPriceForQuantity(1).amount, '35.99');
assert.equal(texUltraPriceForQuantity(2).amount, '70.00');
assert.equal(texUltraPriceForQuantity(3).amount, '80.99');
assert.equal(texUltraPriceForQuantity(6).amount, '147.99');
assert.equal(texUltraPriceForQuantity(4), null);

const publicOffer = texUltraPublicOfferText();
assert.match(publicOffer, /1 frasco por 35\.99 USD/);
assert.match(publicOffer, /3 frascos por 80\.99 USD/);
assert.match(publicOffer, /6 frascos por 147\.99 USD/);
assert.doesNotMatch(publicOffer, /2 frascos/);

assert.ok(fs.existsSync(path.join(root, 'public/media/sales/ec/tex_ultra.png')));

const whatsapp = read('src/routes/whatsapp.js');
assert.match(whatsapp, /source: 'ec_tex_ultra_vsl'/);
assert.match(whatsapp, /TEX_ULTRA_EC/);
assert.match(whatsapp, /tex_ultra\.png/);

const panel = read('public/qr.html');
assert.match(panel, /<option value="tex_ultra_ec">Tex Ultra Ecuador<\/option>/);
assert.match(panel, /EC_TEX_ULTRA/);
assert.match(panel, /\['2', '70\.00', 'USD 70\.00', '2 frascos'\]/);

const dropi = read('src/services/droppiEcuadorBrowserService.js');
assert.match(dropi, /DROPPI_EC_TEX_ULTRA_PRODUCT_ENABLED/);
assert.match(dropi, /tex_ultra_dropi_product_not_ready/);

const shipment = read('src/services/shipmentMessageService.js');
assert.match(shipment, /TEX_ULTRA_EC_PRODUCT_PROFILE\.postSale/);
assert.match(shipment, /Tex Ultra/);

console.log('Tex Ultra EC isolation audit: OK');
