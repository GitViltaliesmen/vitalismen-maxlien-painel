const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'funnel-overlay.html'), 'utf8');
const overlay = fs.readFileSync(path.join(root, 'funnel-overlay.js'), 'utf8');
const source = fs.readFileSync(path.join(root, 'legacy-funnel-library.js'), 'utf8');
const context = {};
context.globalThis = context;
vm.runInNewContext(source, context);

const library = context.VitalismenLegacyFunnel;
assert.ok(library);
assert.equal(library.AUDIO_BASE_NAMES.length, 52);
assert.equal(library.CUSTOM_TEXTS.length, 8);
assert.equal(library.CUSTOM_UPLOADS.length, 2);
assert.equal(library.CUSTOM_BLOCKS.length, 3);

const expected = {
    vit_power_ec: { total: 79, blocks: 4 },
    nitrix_ec: { total: 77, blocks: 2 },
    tex_ultra_ec: { total: 76, blocks: 1 }
};
const referencedAssets = new Set();
for (const [productKey, counts] of Object.entries(expected)) {
    const items = library.list({ productKey });
    assert.equal(items.length, counts.total);
    assert.equal(items.filter((item) => item.type === 'block').length, counts.blocks);
    assert.equal(items.filter((item) => item.type === 'draft').length, 14);
    const promotion = items.find((item) => item.label === 'PROMOCION_1_3_6');
    const realPrice = items.find((item) => item.label === 'PRECIO_REAL_1_3_6');
    assert.ok(promotion, `${productKey}: PROMOCION_1_3_6 ausente`);
    assert.ok(realPrice, `${productKey}: PRECIO_REAL_1_3_6 ausente`);
    for (const price of ['$35,99', '$70,00', '$80,99', '$147,99']) {
        assert.ok(promotion.text.includes(price), `${productKey}: promoção sem ${price}`);
    }
    for (const price of ['$39,99', '$70,00', '$95,99', '$167,99']) {
        assert.ok(realPrice.text.includes(price), `${productKey}: preço real sem ${price}`);
    }
    assert.doesNotMatch(`${promotion.text}\n${realPrice.text}`, /\bmes(?:es)?\b/i);
    assert.equal(items.filter((item) => item.type === 'audio').length, 54);
    assert.equal(items.filter((item) => item.type === 'media').length, 7);
    for (const item of items) {
        for (const value of [item.value, item.mediaUrl, ...(item.steps || []).map((step) => step.value)]) {
            if (typeof value === 'string' && value.startsWith('legacy-media/')) referencedAssets.add(value);
        }
    }
}

assert.equal(referencedAssets.size, 62);
for (const relative of referencedAssets) {
    assert.ok(fs.existsSync(path.join(root, relative)), `arquivo congelado ausente: ${relative}`);
}

const texItems = library.list({ productKey: 'tex_ultra_ec' });
const texStart = texItems.find((item) => item.value === 'tex_ultra_inicio_completo');
assert.ok(texStart, 'bloco inicial Tex Ultra ausente');
assert.deepEqual(
    Array.from(texStart.steps, (step) => `${step.type}:${step.label}`),
    ['audio:Inicio universal 01', 'audio:Inicio universal 02', 'media:Prova 1', 'media:Frasco Tex Ultra', 'draft:Valores promocionais · desde USD 35.99']
);
assert.equal(texStart.steps[3].value, 'legacy-media/sales/ec/tex_ultra_bottle.png');
assert.equal(texStart.steps[4].value, 'custom_text:text_1780282158837_bf20c0');
assert.match(library.resolveText(texStart.steps[4].value, 'tex_ultra_ec'), /1 frasco[^\n]+\$35,99/);
assert.equal(
    texItems.filter((item) => item.type === 'media' && item.code === 'M01')[0]?.value,
    'legacy-media/sales/ec/tex_ultra_bottle.png'
);
assert.equal(
    texItems.some((item) => [item.value, item.mediaUrl, ...(item.steps || []).map((step) => step.value)].includes('legacy-media/sales/ec/vit_power.jpeg')),
    false,
    'biblioteca Tex Ultra nao pode mostrar frasco Vit Power'
);
assert.equal(
    texItems.some((item) => item.type === 'block' && item.productKey === 'vit_power_ec'),
    false,
    'blocos personalizados de Vit Power nao podem aparecer em Tex Ultra'
);
const nitrixItems = library.list({ productKey: 'nitrix_ec' });
assert.equal(
    nitrixItems.some((item) => item.type === 'block' && item.productKey === 'vit_power_ec'),
    false,
    'blocos personalizados de Vit Power nao podem aparecer em Nitrix'
);

assert.ok(manifest.web_accessible_resources[0].resources.includes('legacy-funnel-library.js'));
assert.ok(manifest.web_accessible_resources[0].resources.includes('legacy-media/*'));
assert.match(html, /data-source="legacy"/);
assert.match(html, /data-source="assisted"/);
assert.match(html, /data-type="midia"/);
assert.match(html, /data-type="bloco"/);
assert.match(overlay, /VitalismenLegacyFunnel/);
assert.doesNotMatch(overlay, /\/api\/whatsapp\/send/);
assert.match(overlay, /sendThroughWpp/);

console.log('legacy funnel complete with WA-JS direct send: ok');
