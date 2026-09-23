import test from 'node:test';
import assert from 'node:assert/strict';

import {
    META_CANONICAL_DATASET_EC_V195,
    META_LEGACY_DATASET_EC_V195,
    expectedMetaEcDatasetV195,
    resolveMetaCanonicalConsolidationV195
} from '../src/services/metaCanonicalConsolidationV195Service.js';
import {
    buildBrowserServerEventPayload,
    getMetaConfigForOrder,
    getPublicMetaDestinationForRoute,
    sendBrowserServerEvent
} from '../src/services/metaConversionsService.js';
import { META_DESTINATION_ROUTES } from '../src/services/metaDestinationRegistryService.js';
import { withMetaCheckoutV148 } from '../src/services/metaFunnelV148ContractService.js';
import {
    buildEcBotCoreV78OverlayEnvironment,
    EC_BOT_CORE_V78_DATASET_ID
} from '../src/services/ecBotCoreOperationalV78Service.js';

const canonicalEnv = (extra = {}) => ({
    META_PIXEL_ID_EC: META_LEGACY_DATASET_EC_V195,
    META_ACCESS_TOKEN_EC: 'legacy-token-not-used',
    META_CANONICAL_CONSOLIDATION_EC_APPROVED: 'true',
    META_CANONICAL_DATASET_EC: META_CANONICAL_DATASET_EC_V195,
    META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G: 'canonical-token-v195',
    ...extra
});

const v148Tracking = () => ({
    measurementVersion: 148,
    renderedBranch: 'SALES',
    branchIdentity: 'vturb-smartplayer:ab-6a6023ffd403aabb02392eb9',
    browserPixelId: META_CANONICAL_DATASET_EC_V195
});

test('V195 permanece inativo sem as duas flags e preserva o destino legado', () => {
    assert.equal(resolveMetaCanonicalConsolidationV195({}).configured, false);
    assert.equal(expectedMetaEcDatasetV195({}), META_LEGACY_DATASET_EC_V195);
    const config = getMetaConfigForOrder({ country: 'EC' }, {
        META_PIXEL_ID_EC: META_LEGACY_DATASET_EC_V195,
        META_ACCESS_TOKEN_EC: 'legacy-token'
    });
    assert.equal(config.pixelId, META_LEGACY_DATASET_EC_V195);
});

test('V195 falha fechado em ativação parcial, dataset divergente ou token ausente', () => {
    for (const env of [
        { META_CANONICAL_DATASET_EC: META_CANONICAL_DATASET_EC_V195 },
        { META_CANONICAL_CONSOLIDATION_EC_APPROVED: 'true', META_CANONICAL_DATASET_EC: META_LEGACY_DATASET_EC_V195 },
        { META_CANONICAL_CONSOLIDATION_EC_APPROVED: 'true', META_CANONICAL_DATASET_EC: META_CANONICAL_DATASET_EC_V195 }
    ]) {
        const result = resolveMetaCanonicalConsolidationV195(env);
        assert.equal(result.configured, true);
        assert.equal(result.enabled, false);
        assert.equal(result.destination.pixelId, null);
        assert.equal(expectedMetaEcDatasetV195(env), '');
    }
});

test('V195 converge EC default, Protocolo G e V148 no dataset canônico sem fallback', () => {
    const env = canonicalEnv();
    const generic = getMetaConfigForOrder({ country: 'EC', productKey: 'vit_power_ec' }, env);
    const protocolo = getMetaConfigForOrder({
        country: 'EC',
        productKey: 'tex_ultra_ec',
        funnel: 'PROTOCOLO_G'
    }, env);
    const v148 = getMetaConfigForOrder({ country: 'EC', tracking: v148Tracking() }, env);

    for (const config of [generic, protocolo, v148]) {
        assert.equal(config.pixelId, META_CANONICAL_DATASET_EC_V195);
        assert.equal(config.browserPixelId, META_CANONICAL_DATASET_EC_V195);
        assert.equal(config.tokenSource, 'env:META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G');
        assert.equal(config.source, 'meta_canonical_consolidation_v195');
    }
});

test('V195 publica binding canônico assinado para as duas rotas EC', () => {
    const env = canonicalEnv();
    for (const route of Object.values(META_DESTINATION_ROUTES)) {
        const descriptor = getPublicMetaDestinationForRoute(route, env, { now: Date.parse('2026-09-23T12:00:00Z') });
        assert.equal(descriptor.available, true);
        assert.equal(descriptor.datasetId, META_CANONICAL_DATASET_EC_V195);
        assert.equal(descriptor.browserPixelId, META_CANONICAL_DATASET_EC_V195);
        assert.equal(descriptor.profile, 'meta_canonical_920_v195');
        assert.match(descriptor.binding, /^[A-Za-z0-9_-]{40,64}$/);
    }
});

test('V195 permite test_event_code explícito no evento técnico Protocolo G, nunca implicitamente', () => {
    const event = {
        eventName: 'PageView',
        event_id: 'meta920-v195-test',
        country: 'EC',
        productKey: 'tex_ultra_ec',
        funnel: 'PROTOCOLO_G',
        client_ip_address: '72.60.137.77',
        client_user_agent: 'V195-Test/1.0'
    };
    const explicit = buildBrowserServerEventPayload(event, null, { testEventCode: 'TEST83735' });
    const normal = buildBrowserServerEventPayload(event);
    assert.equal(explicit.payload.test_event_code, 'TEST83735');
    assert.equal(normal.payload.test_event_code, undefined);
});

test('V195 mantém o gate V148 e projeta InitiateCheckout somente para 920', async () => {
    const base = buildEcBotCoreV78OverlayEnvironment({
        baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID }
    });
    const env = canonicalEnv({ ...base, META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID });
    const event = {
        eventName: 'InitiateCheckout',
        event_id: 'InitiateCheckout:v195-fixture',
        country: 'EC',
        measurementVersion: 148,
        phone: '593999999901',
        content_ids: ['tex_ultra_ec'],
        action_source: 'chat'
    };

    assert.equal((await sendBrowserServerEvent(event, null, { env, dryRun: true })).ok, false);
    const result = await withMetaCheckoutV148({
        reserved: true,
        businessTrigger: 'tex_ultra_explicit_quantity',
        eventId: event.event_id
    }, () => sendBrowserServerEvent(event, null, { env, dryRun: true }));

    assert.equal(result.ok, true);
    assert.equal(result.datasetId, META_CANONICAL_DATASET_EC_V195);
    assert.equal(result.payload.data[0].event_name, 'InitiateCheckout');
    assert.equal(result.payload.test_event_code, undefined);
});
