import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    assertEcMultiproductManualReleaseV120Manifest,
    ecMultiproductManualReleaseV120RouteDecision,
    resolveEcMultiproductManualReleaseV120Configuration
} from '../src/services/ecMultiproductManualReleaseV120Service.js';
import { resolveEcuadorBffWarehouseProfile } from '../src/services/droppiEcuadorBrowserService.js';
import {
    EC_BOT_CORE_V78_DATASET_ID,
    buildEcBotCoreV78OverlayEnvironment
} from '../src/services/ecBotCoreOperationalV78Service.js';
import { ecBotCoreMutationRouteGuardV78 } from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';

const operationalEnv = Object.freeze({
    VITALISMEN_EC_BOT_CORE_OPERATIONAL: 'true',
    PANEL_AUTH_DISABLED: 'false'
});

test('V120 libera somente o cadastro autenticado adicional do painel', () => {
    assert.deepEqual(
        ecMultiproductManualReleaseV120RouteDecision({
            method: 'POST',
            path: '/api/whatsapp/contacts',
            env: operationalEnv
        }),
        {
            enforced: true,
            allowed: true,
            operation: 'authenticated-contact-upsert',
            reason: 'ec_multiproduct_v120_route_allowed'
        }
    );
    for (const [method, path] of [
        ['GET', '/api/whatsapp/contacts'],
        ['POST', '/api/whatsapp/contacts/delete'],
        ['POST', '/api/whatsapp/anything-else'],
        ['POST', '/api/shipments/droppi/ec/dispatch/run']
    ]) {
        assert.equal(
            ecMultiproductManualReleaseV120RouteDecision({ method, path, env: operationalEnv }).allowed,
            false,
            `${method} ${path}`
        );
    }
});

test('V120 falha fechado quando a autenticação do painel não é obrigatória', () => {
    const invalidEnv = { ...operationalEnv, PANEL_AUTH_DISABLED: 'true' };
    assert.deepEqual(resolveEcMultiproductManualReleaseV120Configuration(invalidEnv), {
        enabled: true,
        ready: false,
        mode: 'EC_AUTHENTICATED_CONTACT_AND_MULTIPRODUCT_DROPI',
        failures: ['PANEL_AUTH_DISABLED_must_be_false']
    });
    assert.equal(ecMultiproductManualReleaseV120RouteDecision({
        method: 'POST', path: '/api/whatsapp/contacts', env: invalidEnv
    }).allowed, false);
});

test('barreira V78 encaminha o POST autenticado de contato e continua bloqueando wildcard', async () => {
    const env = {
        ...buildEcBotCoreV78OverlayEnvironment({
            baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID }
        }),
        META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID,
        PANEL_AUTH_DISABLED: 'false'
    };
    const previous = new Map();
    for (const [key, value] of Object.entries(env)) {
        previous.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
        process.env[key] = value;
    }
    try {
        const passed = await ecBotCoreMutationRouteGuardV78({
            method: 'POST', originalUrl: '/api/whatsapp/contacts', body: {}
        }, {}, () => 'contact-handler-reached');
        assert.equal(passed, 'contact-handler-reached');

        const blocked = {};
        const response = {
            status(code) {
                blocked.status = code;
                return this;
            },
            json(body) {
                blocked.body = body;
                return body;
            }
        };
        await ecBotCoreMutationRouteGuardV78({
            method: 'POST', originalUrl: '/api/whatsapp/contacts/delete', body: {}
        }, response, () => assert.fail('wildcard não pode alcançar handler'));
        assert.equal(blocked.status, 423);
        assert.equal(blocked.body.error, 'ec_bot_core_v78_operation_blocked');
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});

test('cadastro continua idempotente, limitado a telefone EC e depois da autenticação', () => {
    const routes = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const authIndex = routes.indexOf('router.use(authMiddleware)');
    const contactIndex = routes.indexOf("router.post('/contacts'");
    const handlerEnd = routes.indexOf("router.post('/contact-state/:phone/claim'", contactIndex);
    const handler = routes.slice(contactIndex, handlerEnd);
    assert.ok(authIndex >= 0 && contactIndex > authIndex);
    assert.match(handler, /findOrCreateContactState\(normalizedDigits\)/);
    assert.match(handler, /alreadyExisted = !state\.isNew/);
    assert.match(handler, /isAllowedPanelPhoneForCountry/);
    assert.match(handler, /Cliente ja cadastrado; ficha atualizada sem duplicar/);
});

test('V120 fixa perfis autoritativos distintos dos três produtos do seletor EC', () => {
    assert.deepEqual(resolveEcuadorBffWarehouseProfile('tex_ultra_ec'), {
        productKey: 'tex_ultra_ec',
        warehouseId: 1261,
        originCityId: 802,
        warehouseName: 'Laboratorio Vitalcom Ec'
    });
    assert.deepEqual(resolveEcuadorBffWarehouseProfile('nitrix_ec'), {
        productKey: 'nitrix_ec',
        warehouseId: 1544,
        originCityId: 802,
        warehouseName: 'ECOMARKET QUITO'
    });
    assert.deepEqual(resolveEcuadorBffWarehouseProfile('vit_power_ec'), {
        productKey: 'vit_power_ec',
        warehouseId: 1261,
        originCityId: 802,
        warehouseName: 'Laboratorio Vitalcom Ec'
    });
    assert.equal(resolveEcuadorBffWarehouseProfile(''), null);
    assert.equal(resolveEcuadorBffWarehouseProfile('unknown_product'), null);
});

test('V120 usa catálogo e cotação BFF para os três produtos antes do único create', () => {
    const browser = fs.readFileSync('src/services/droppiEcuadorBrowserService.js', 'utf8');
    const quoteStart = browser.indexOf('export const buildEcuadorProductBffQuote');
    const quoteEnd = browser.indexOf('export const buildTexUltraBffQuote', quoteStart);
    const quote = browser.slice(quoteStart, quoteEnd);
    assert.match(quote, /EC_BFF_SUPPORTED_PRODUCT_KEYS/);
    assert.match(quote, /DROPI_BFF_CATALOG_ENDPOINT/);
    assert.match(quote, /catalogProduct\.warehouse_product/);
    assert.match(quote, /warehouseProfile\.warehouseId/);
    assert.match(quote, /DROPI_BFF_QUOTE_ENDPOINT/);
    assert.match(quote, /PREFERRED_CARRIER_QUOTE_NOT_AVAILABLE/);

    const flowStart = browser.indexOf('const submitOrderInPanel');
    const flowEnd = browser.indexOf('const findMatchingPanelText', flowStart);
    const flow = browser.slice(flowStart, flowEnd);
    assert.ok(flow.indexOf('buildEcuadorProductBffQuote') < flow.indexOf('findExistingDropiOrderForManualSubmission'));
    assert.ok(flow.indexOf('findExistingDropiOrderForManualSubmission') < flow.indexOf('submitOrderViaDropiApi'));
    assert.doesNotMatch(flow, /for \(let attempt = 1; attempt <= 2/);
});

test('V120 compõe a barreira sem abrir lote, backfill ou envio automático', () => {
    const integration = fs.readFileSync('src/services/ecBotCoreRuntimeIntegrationV78Service.js', 'utf8');
    assert.match(integration, /ecMultiproductManualReleaseV120RouteDecision/);
    assert.match(integration, /ec_multiproduct_v120_route_allowed/);
    assert.match(integration, /panelContactV120/);

    const v119 = fs.readFileSync('src/services/ecManualDropiReleaseV119Service.js', 'utf8');
    assert.match(v119, /authorize-submit\|submit/);
    assert.doesNotMatch(v119, /dispatch\/run/);

    const successorGuard = fs.readFileSync('src/services/protocoloGSuccessorGuardV101Service.js', 'utf8');
    assert.match(successorGuard, /ec-multiproduct-manual-release-v120-20260904\.json/);
    assert.match(successorGuard, /v120\.protectedFiles\?\.\['src\/services\/droppiEcuadorBrowserService\.js'\] === currentDropiBrowserHash/);

    const qaSuccessor = fs.readFileSync('src/services/botQaMultiturnRecoveryV111Service.js', 'utf8');
    assert.match(qaSuccessor, /modified\.has\(relativePath\) \|\| successorOverrides\.has\(relativePath\)/);
});

test('V120 valida manifesto, produtos e políticas de não automação', () => {
    const result = assertEcMultiproductManualReleaseV120Manifest();
    assert.equal(result.ready, true);
    assert.deepEqual(result.manifest.policy.allowedProducts, [
        'tex_ultra_ec',
        'nitrix_ec',
        'vit_power_ec'
    ]);
    assert.equal(result.manifest.policy.allowedAdditionalPostRouteCount, 1);
    assert.equal(result.manifest.policy.manualAuthorizationPerOrderRequired, true);
    assert.equal(result.manifest.policy.automaticDispatchAllowed, false);
    assert.equal(result.manifest.policy.automaticRetryAfterAmbiguousFailure, false);
    assert.equal(result.manifest.policy.historicalBackfillAllowed, false);
});
