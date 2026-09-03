import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    assertDropiManualTransportV104,
    DROPI_MANUAL_TRANSPORT_V104_OVERRIDE_KEY
} from '../src/services/dropiManualTransportV104Service.js';

const adapter = fs.readFileSync('src/services/dropiBffAdapter.js', 'utf8');
const browser = fs.readFileSync('src/services/droppiEcuadorBrowserService.js', 'utf8');

test('V104 registra ciclo sanitizado do transporte sem reduzir HTTP 0 a erro genérico', () => {
    for (const category of [
        'DNS_FAILURE', 'TLS_FAILURE', 'CONNECTION_RESET', 'ABORTED',
        'BROWSER_CONTEXT_LOST', 'FETCH_FAILED', 'NO_RESPONSE', 'INVALID_RESPONSE'
    ]) assert.match(adapter, new RegExp(category));
    assert.match(adapter, /requestStarted: false/);
    assert.match(adapter, /requestDispatched: false/);
    assert.match(adapter, /responseReceived: false/);
    assert.match(adapter, /bodyParsed: false/);
    assert.match(browser, /droppi_bff_create_lifecycle/);
});

test('V104 usa contrato BFF autoritativo para Tex Ultra sem trocar produto', () => {
    assert.match(browser, /buildTexUltraBffQuote/);
    assert.match(browser, /DROPI_BFF_CATALOG_ENDPOINT/);
    assert.match(browser, /DROPI_BFF_QUOTE_ENDPOINT/);
    assert.match(browser, /privated_product: false/);
    assert.match(browser, /TEX_ULTRA_BFF_WAREHOUSE_ID/);
    assert.match(browser, /productIdFromDropiUrl/);
    assert.match(browser, /AUTHORITATIVE_CITY_NOT_FOUND/);
});

test('V104 conserva lookup antes do POST e elimina retentativa automática', () => {
    const flow = browser.slice(browser.indexOf('const submitOrderInPanel'), browser.indexOf('const findMatchingPanelText'));
    assert.ok(flow.indexOf('findExistingDropiOrderForManualSubmission(page, payload)') < flow.indexOf('submitOrderViaDropiApi(page'));
    assert.match(flow, /apiResult\.lifecycle\?\.requestDispatched/);
    assert.doesNotMatch(browser, /retrying_transient_browser_error|droppi_browser_transient_retry/);
    assert.doesNotMatch(browser, /for \(let attempt = 1; attempt <= 2/);
});

test('V104 é aceita pelos três guards comerciais somente com path e hash exatos', () => {
    for (const relativePath of [
        'scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs',
        'scripts/guard-protocolo-g-ad-metrics-v63.mjs',
        'scripts/guard-protocolo-g-conversion-v62.mjs'
    ]) {
        const guard = fs.readFileSync(relativePath, 'utf8');
        assert.match(guard, /v104Manifest\.declaredAncestorOverrides\?\.includes\(relativePath\)/);
        assert.match(guard, /v104Manifest\.protectedFiles\?\.\[relativePath\] === actualHash/);
    }
});

test('V104 valida identidade, escopo EC e política fail-closed', () => {
    globalThis[DROPI_MANUAL_TRANSPORT_V104_OVERRIDE_KEY] = [
        'package-lock.json',
        'package.json',
        'scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs',
        'scripts/guard-protocolo-g-ad-metrics-v63.mjs',
        'scripts/guard-protocolo-g-conversion-v62.mjs',
        'scripts/lib/ec-runtime-successor-v97-context.mjs',
        'src/services/dropiBffAdapter.js',
        'src/services/droppiEcuadorBrowserService.js',
        'src/services/ecOperationalGuardContextV97Service.js',
        'src/services/ecRuntimeSafeResetV95Service.js',
        'src/services/ecRuntimeSuccessorV93Service.js',
        'src/services/protocoloGSuccessorGuardV101Service.js',
        'tests/dropi-bff-manual-v60.test.mjs'
    ];
    const result = assertDropiManualTransportV104();
    assert.equal(result.ready, true);
    assert.deepEqual(result.failures, []);
});

test('V104 corrige somente qs transitivo sem migrar Express', () => {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const packageLock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    assert.equal(packageJson.dependencies.express, '^4.18.2');
    assert.equal(packageJson.overrides.qs, '6.16.0');
    assert.equal(packageLock.packages['node_modules/qs'].version, '6.16.0');
});

test('V104 propaga o override autenticado até o pai V92', () => {
    for (const relativePath of [
        'src/services/ecRuntimeSuccessorV93Service.js',
        'src/services/ecRuntimeSafeResetV95Service.js',
        'src/services/ecOperationalGuardContextV97Service.js'
    ]) {
        const source = fs.readFileSync(relativePath, 'utf8');
        assert.match(source, /modified\.has\(relativePath\) \|\| successorOverrides\.has\(relativePath\)/);
    }
});
