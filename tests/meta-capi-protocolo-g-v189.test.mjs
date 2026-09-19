import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
    PROTOCOLO_G_EVENT_SOURCE_URL,
    PROTOCOLO_G_META_DESTINATION,
    PROTOCOLO_G_META_TOKEN_SOURCE,
    isEcuadorTexUltraProtocoloGMetaDestination
} from '../src/services/metaProtocoloGAttributionService.js';
import {
    META_DESTINATION_ROUTES,
    assertMetaDestinationRegistryDocument,
    resolveMetaDestinationDocument
} from '../src/services/metaDestinationRegistryService.js';
import {
    buildPurchaseEventPayloadForOrder,
    getMetaConfigForOrder
} from '../src/services/metaConversionsService.js';

const GENERAL_DATASET = '1468946114265008';
const GENERAL_TOKEN = 'token-geral-sintetico-v189';
const DEDICATED_TOKEN = 'token-dedicado-sintetico-v189';
const VERIFIED_AT = '2026-09-19T12:00:00.000Z';

const protocoloOrder = (tracking = {}) => ({
    orderId: 'V189-SYNTHETIC-ORDER',
    country: 'EC',
    status: 'confirmed',
    total: 80.99,
    currency: 'USD',
    source: 'whatsapp',
    customer: {
        name: 'Cliente Sintetico',
        phone: '+593999999999',
        city: 'Quito',
        province: 'Pichincha'
    },
    package: { id: 3, quantity: 3 },
    tracking: {
        productKey: 'tex_ultra_ec',
        product: 'TEX_ULTRA',
        funnel: 'PROTOCOLO_G',
        sourceUrl: PROTOCOLO_G_EVENT_SOURCE_URL,
        external_id: 'v189-synthetic-external-id',
        ...tracking
    }
});

const env = {
    META_PIXEL_ID_EC: GENERAL_DATASET,
    META_ACCESS_TOKEN_EC: GENERAL_TOKEN,
    META_PIXEL_ID_EC_TEX_ULTRA_PROTOCOLO_G: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
    META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G: DEDICATED_TOKEN
};

const registry = (protocoloTokenRefs = [PROTOCOLO_G_META_TOKEN_SOURCE]) => ({
    version: 1,
    updatedAt: VERIFIED_AT,
    activeRoutes: {
        [META_DESTINATION_ROUTES.EC_DEFAULT]: 'ec-default',
        [META_DESTINATION_ROUTES.EC_TEX_ULTRA_PROTOCOLO_G]: 'ec-protocolo-g'
    },
    profiles: {
        'ec-default': {
            label: 'EC default',
            route: META_DESTINATION_ROUTES.EC_DEFAULT,
            datasetId: GENERAL_DATASET,
            browserPixelId: GENERAL_DATASET,
            accessTokenRefs: ['env:META_ACCESS_TOKEN_EC'],
            browserDeploymentVerifiedAt: VERIFIED_AT,
            enabled: true
        },
        'ec-protocolo-g': {
            label: 'EC Tex Ultra Protocolo-G',
            route: META_DESTINATION_ROUTES.EC_TEX_ULTRA_PROTOCOLO_G,
            datasetId: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
            browserPixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
            accessTokenRefs: protocoloTokenRefs,
            browserDeploymentVerifiedAt: VERIFIED_AT,
            enabled: true
        }
    }
});

test('destino canônico V189 fixa Browser/CAPI 920532663934291 e token dedicado', () => {
    assert.deepEqual(PROTOCOLO_G_META_DESTINATION, {
        route: 'ec_tex_ultra_protocolo_g',
        datasetId: '920532663934291',
        browserPixelId: '920532663934291',
        tokenEnv: 'META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G',
        tokenSource: 'env:META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G',
        eventSourceUrl: 'https://vilaliemen.shop/protocolo-g'
    });
});

test('classificação dedicada exige simultaneamente país, produto, funil e origem oficial', () => {
    assert.equal(isEcuadorTexUltraProtocoloGMetaDestination(protocoloOrder()), true);
    assert.equal(isEcuadorTexUltraProtocoloGMetaDestination(protocoloOrder({ sourceUrl: '' })), false);
    assert.equal(isEcuadorTexUltraProtocoloGMetaDestination({ ...protocoloOrder(), country: 'CO' }), false);
    assert.equal(isEcuadorTexUltraProtocoloGMetaDestination(protocoloOrder({ productKey: 'vit_power_ec' })), false);
    assert.equal(isEcuadorTexUltraProtocoloGMetaDestination(protocoloOrder({ funnel: 'OUTRO' })), false);
});

test('Purchase Protocolo-G resolve somente Dataset e token dedicados', () => {
    assert.deepEqual(getMetaConfigForOrder(protocoloOrder(), env), {
        pixelId: '920532663934291',
        accessToken: DEDICATED_TOKEN,
        route: 'ec_tex_ultra_protocolo_g'
    });
});

test('ausência do token dedicado falha fechada sem usar META_ACCESS_TOKEN_EC', () => {
    assert.deepEqual(getMetaConfigForOrder(protocoloOrder(), {
        ...env,
        META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G: ''
    }), {
        pixelId: '920532663934291',
        accessToken: null,
        route: 'ec_tex_ultra_protocolo_g'
    });
});

test('registry rejeita fallback geral ou cadeia mista na rota Protocolo-G', () => {
    assert.throws(
        () => assertMetaDestinationRegistryDocument(registry(['env:META_ACCESS_TOKEN_EC'])),
        error => error?.code === 'META_PROTOCOLO_G_SPECIFIC_TOKEN_REQUIRED'
    );
    assert.throws(
        () => assertMetaDestinationRegistryDocument(registry([
            PROTOCOLO_G_META_TOKEN_SOURCE,
            'env:META_ACCESS_TOKEN_EC'
        ])),
        error => error?.code === 'META_PROTOCOLO_G_SPECIFIC_TOKEN_REQUIRED'
    );
});

test('registry dedicado resolve tokenSource explícito e Dataset sincronizado', () => {
    const destination = resolveMetaDestinationDocument({
        route: META_DESTINATION_ROUTES.EC_TEX_ULTRA_PROTOCOLO_G,
        registryDocument: registry(),
        env
    });
    assert.equal(destination.pixelId, '920532663934291');
    assert.equal(destination.browserPixelId, '920532663934291');
    assert.equal(destination.tokenSource, PROTOCOLO_G_META_TOKEN_SOURCE);
    assert.equal(destination.accessToken, DEDICATED_TOKEN);
    assert.equal(destination.browserServerSynchronized, true);
});

test('semântica sales V148 não sobrepõe a rota específica do Protocolo-G', () => {
    const order = protocoloOrder({
        measurementVersion: 148,
        renderedBranch: 'SALES',
        branchIdentity: 'SALES',
        browserPixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID
    });
    assert.equal(getMetaConfigForOrder(order, env).pixelId, '920532663934291');
    assert.equal(getMetaConfigForOrder(order, env).accessToken, DEDICATED_TOKEN);
});

test('Purchase sintético preserva event_source_url oficial e nunca injeta Test Event', () => {
    const built = buildPurchaseEventPayloadForOrder(protocoloOrder(), {
        eventTime: 1789800000,
        testEventCode: 'NAO_PERSISTIR_NEM_USAR'
    });
    assert.equal(built.ok, true);
    assert.equal(built.payload.data[0].action_source, 'website');
    assert.equal(built.payload.data[0].event_source_url, PROTOCOLO_G_EVENT_SOURCE_URL);
    assert.equal('test_event_code' in built.payload, false);
});

test('rotas EC fora do contrato Protocolo-G permanecem no destino geral', () => {
    for (const order of [
        protocoloOrder({ sourceUrl: 'https://vilaliemen.shop/outra-pagina' }),
        protocoloOrder({ funnel: 'OUTRO_FUNIL' }),
        protocoloOrder({ productKey: 'vit_power_ec', product: 'VIT_POWER' })
    ]) {
        assert.deepEqual(getMetaConfigForOrder(order, env), {
            pixelId: GENERAL_DATASET,
            accessToken: GENERAL_TOKEN,
            route: 'country_ec_default'
        });
    }
});

test('código funcional não contém Dataset antigo, fallback geral ou TEST61236', () => {
    const files = [
        'src/services/metaProtocoloGAttributionService.js',
        'src/services/metaConversionsService.js',
        'src/services/metaDestinationRegistryService.js',
        'scripts/manage-meta-destinations-v73.mjs',
        '.env.example'
    ];
    const body = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
    assert.doesNotMatch(body, /2048099902484149/);
    assert.doesNotMatch(body, /META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G\s*\|\|\s*(?:env\.)?META_ACCESS_TOKEN_EC/);
    assert.doesNotMatch(body, /TEST61236/);
});
