import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const panel = read('public/qr.html');
const legacyLibrary = read('extensions/vitalismen-whatsapp-official/legacy-funnel-library.js');
const assistedTexFunnel = read('extensions/vitalismen-whatsapp-official/product-funnels/tex-ultra-ec.js');
const texCatalog = read('extensions/vitalismen-whatsapp-official/tex-ultra-order-catalog.js');
const sidepanel = read('extensions/vitalismen-whatsapp-official/sidepanel.html');

const panelBlockStart = panel.indexOf('const footerFunnelBlocks = () => {');
const panelBlockEnd = panel.indexOf('const sortedFooterAudioTemplates', panelBlockStart);
assert.ok(panelBlockStart >= 0 && panelBlockEnd > panelBlockStart, 'construtor dos blocos do painel ausente');
const panelBlocks = panel.slice(panelBlockStart, panelBlockEnd);

assert.match(panel, /const activeFunnelProductKey = \(\) => normalizeCustomerProductKey/);
assert.match(panel, /Frasco Tex Ultra[^\n]+tex_ultra\.png/);
assert.match(panelBlocks, /value: 'tex_ultra_inicio_completo'/);
assert.match(panelBlocks, /Saudacao com nome \+ um audio universal \+ Prova 1 \+ Frasco Tex Ultra \+ Valores promocionais/);
assert.match(panelBlocks, /value: 'tex_ultra_promotion_1'/);
assert.doesNotMatch(panelBlocks, /value: 'tex_ultra_promotion_2'/);
assert.match(panel, /tex_ultra_promotion_1: '📦 Hoy tenemos kits promocionales disponibles con precios especiales:/);
assert.match(panel, /1 frasco por solo \$35,99/);
assert.match(panel, /2 frascos por \$70,00/);
assert.match(panel, /3 frascos por \$80,99/);
assert.match(panel, /6 frascos \(tratamiento completo\) por \$147,99/);
assert.match(panel, /tex_ultra_promotion_2: '📦 Precios originales de los kits disponibles:/);
assert.match(panel, /1 frasco por solo \$39,99/);

for (const legacyVitBlock of [
    'custom_1780182896042_1b91ef',
    'custom_1780196676304_4b628b',
    'custom_1780268918250_4add3e'
]) {
    assert.match(panel, new RegExp(legacyVitBlock));
}
assert.match(panel, /knownVitPowerCustomBlockValues/);
assert.match(panel, /block\.productKey === 'all' \|\| block\.productKey === selectedProductKey/);
assert.match(panel, /productKey: existingBlock\?\.productKey \|\| activeFunnelProductKey\(\)/);
assert.match(panel, /productKey: block\.productKey/);

assert.match(legacyLibrary, /productKey: 'vit_power_ec',[\s\S]+custom_1780182896042_1b91ef/);
assert.match(legacyLibrary, /\.filter\(\(item\) => item\.productKey === productKey\)/);
assert.doesNotMatch(legacyLibrary, /productAwareCustomBlock/);
assert.match(legacyLibrary, /custom_text:text_1780282158837_bf20c0/);

for (const source of [assistedTexFunnel, texCatalog]) {
    assert.match(source, /1 frasco por solo \$35,99/);
    assert.match(source, /2 frascos por \$70,00/);
    assert.match(source, /3 frascos por \$80,99/);
    assert.match(source, /6 frascos \(tratamiento completo\) por \$147,99/);
    assert.doesNotMatch(source, /\b(?:1 mes|2 meses|3 meses|6 meses|1 mês)\b/i);
}
assert.match(sidepanel, /data-kit-quantity="1"><span>1 frasco<\/span>/);
assert.match(sidepanel, /data-kit-quantity="6"><span>6 frascos<\/span>/);

console.log('EC product funnel isolation v13: ok');
