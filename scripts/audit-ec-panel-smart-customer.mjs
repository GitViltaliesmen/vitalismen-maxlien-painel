import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const panelPath = path.join(root, 'public', 'qr.html');
const panel = fs.readFileSync(panelPath, 'utf8');

const count = (pattern) => [...panel.matchAll(pattern)].length;
assert.equal(count(/id="customerCityInput"/g), 1, 'deve existir um unico campo Cidade');
assert.equal(count(/id="customerReferenceInput"/g), 1, 'deve existir um unico campo Referencia');

assert.doesNotMatch(panel, /(^|[^A-Z0-9_])CO([^A-Z0-9_]|$)/m, 'o painel oficial nao pode conter operacao CO');
assert.doesNotMatch(panel, /coTracking|saveCoGuide|\/api\/shipments\/co/i, 'rotas e controles estrangeiros devem permanecer removidos');
assert.match(panel, /\/api\/shipments\/manual-guide/, 'o fluxo de guia manual EC deve permanecer ativo');

const normalizerScript = panel.indexOf('/panel-intelligence/customer-data-normalizer.js');
const extractorScript = panel.indexOf('/panel-intelligence/conversation-data-extractor.js');
const agencyScript = panel.indexOf('/panel-intelligence/agency-catalog.js');
const formScript = panel.indexOf('/panel-intelligence/customer-form-intelligence.js');
const inlineScript = panel.indexOf('<script>', formScript);
assert.ok(normalizerScript > 0 && normalizerScript < extractorScript, 'normalizador deve carregar antes do extrator');
assert.ok(extractorScript < agencyScript && agencyScript < formScript, 'dependencias de inteligencia devem carregar em ordem');
assert.ok(formScript < inlineScript, 'inteligencia deve carregar antes do painel');

assert.match(panel, /customerReferenceInput'\)\.addEventListener\('input',[\s\S]{0,180}lookupAgencySuggestions/, 'referencia deve acionar a busca de agencias');
assert.doesNotMatch(panel, /customerReferenceInput'\)\.value\s*=\s*''/, 'selecionar agencia nao pode apagar a referencia do cliente');
assert.match(panel, /resolveAgencyLocation/, 'cidade deve validar e inferir provincia pelo catalogo');
assert.match(panel, /selectAutomaticAgency/, 'agencia so deve ser aplicada por correspondencia deterministica');
assert.match(panel, /syncDetectedCustomerDataFromMessages/, 'conversa deve preencher a ficha por extrator validado');

assert.match(panel, /sales-quick-funnel-menu[\s\S]{0,400}overflow-x:\s*auto/, 'funil rapido horizontal deve permanecer rolavel');
assert.match(panel, /\/media\/sales\/ec\/tex_ultra\.png/, 'frasco Tex Ultra deve permanecer visivel');
for (const value of ['35.99', '70.00', '80.99', '147.99']) {
    assert.match(panel, new RegExp(value.replace('.', '\\.')), `valor Tex Ultra ${value} deve permanecer exato`);
}

for (const relativePath of [
    'public/panel-intelligence/customer-data-normalizer.js',
    'public/panel-intelligence/conversation-data-extractor.js',
    'public/panel-intelligence/agency-catalog.js',
    'public/panel-intelligence/customer-form-intelligence.js'
]) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    Function(source);
}

const inlineBlocks = [...panel.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((source) => source.includes("const el ="));
assert.equal(inlineBlocks.length, 1, 'script principal do painel deve ser unico');
Function(inlineBlocks[0]);

console.log('EC smart customer panel audit: OK');
