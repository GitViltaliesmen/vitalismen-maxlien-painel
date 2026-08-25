import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    getMetaConfigForCountry,
    getMetaConfigForOrder,
    sendBrowserServerEvent,
    sendPurchaseEventForOrder
} from '../src/services/metaConversionsService.js';
import { META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID } from '../src/services/metaProtocoloGAttributionService.js';

const root = process.cwd();
const legacyDataset = 'freeze-canary-legacy-ec-dataset';
const legacyToken = 'freeze-canary-legacy-ec-server-token';
const dedicatedToken = 'freeze-canary-protocolo-g-server-token';
const dedicatedEnv = {
    META_PIXEL_ID_EC: legacyDataset,
    META_ACCESS_TOKEN_EC: legacyToken,
    META_PIXEL_ID_EC_TEX_ULTRA_PROTOCOLO_G: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
    META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G: dedicatedToken
};

const orderFor = ({
    country = 'EC',
    productKey = 'tex_ultra_ec',
    product = 'TEX_ULTRA',
    funnel = 'PROTOCOLO_G',
    orderId = 'FREEZE_EC_CAPI_ROUTING_V61'
} = {}) => ({
    country,
    orderId,
    total: 1,
    currency: 'USD',
    source: 'whatsapp',
    customer: {
        name: 'Cliente Sintetico',
        phone: '+593999999999'
    },
    package: {
        id: 1,
        quantity: 1
    },
    tracking: {
        productKey,
        product,
        funnel,
        external_id: 'freeze-ec-capi-routing-v61'
    }
});

const assertRoute = (actual, expected, label) => {
    assert.equal(actual.pixelId, expected.pixelId, `${label}: Dataset divergente`);
    assert.equal(actual.accessToken, expected.accessToken, `${label}: credencial server-side divergente`);
    assert.equal(actual.route, expected.route, `${label}: rota divergente`);
};

const assertNoServerTokenInResult = (result, label) => {
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, new RegExp(legacyToken), `${label}: credencial EC vazou no resultado`);
    assert.doesNotMatch(serialized, new RegExp(dedicatedToken), `${label}: credencial dedicada vazou no resultado`);
    assert.equal(Object.hasOwn(result, 'accessToken'), false, `${label}: accessToken exposto no contrato de retorno`);
};

const protocoloGOrder = orderFor();
const otherProductOrder = orderFor({
    productKey: 'vit_power_ec',
    product: 'VIT_POWER',
    orderId: 'FREEZE_EC_CAPI_OTHER_PRODUCT_V61'
});
const otherFunnelOrder = orderFor({
    funnel: 'FUNIL_EC_LEGADO',
    orderId: 'FREEZE_EC_CAPI_OTHER_FUNNEL_V61'
});

assertRoute(getMetaConfigForOrder(protocoloGOrder, dedicatedEnv), {
    pixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
    accessToken: dedicatedToken,
    route: 'ec_tex_ultra_protocolo_g'
}, 'EC + TEX_ULTRA + PROTOCOLO_G');

assertRoute(getMetaConfigForOrder(protocoloGOrder, {
    ...dedicatedEnv,
    META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G: ''
}), {
    pixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID,
    accessToken: legacyToken,
    route: 'ec_tex_ultra_protocolo_g'
}, 'fallback autorizado da credencial EC server-side');

assertRoute(getMetaConfigForOrder(otherProductOrder, dedicatedEnv), {
    pixelId: legacyDataset,
    accessToken: legacyToken,
    route: 'country_ec_default'
}, 'outro produto EC');

assertRoute(getMetaConfigForOrder(otherFunnelOrder, dedicatedEnv), {
    pixelId: legacyDataset,
    accessToken: legacyToken,
    route: 'country_ec_default'
}, 'outro funil EC');

assertRoute(getMetaConfigForOrder({ country: 'CO', tracking: {} }, dedicatedEnv), {
    pixelId: null,
    accessToken: null,
    route: 'unsupported_country'
}, 'país fora de EC');

assertRoute(getMetaConfigForOrder(protocoloGOrder, {
    ...dedicatedEnv,
    META_PIXEL_ID_EC_TEX_ULTRA_PROTOCOLO_G: 'freeze-canary-wrong-dataset'
}), {
    pixelId: null,
    accessToken: null,
    route: 'ec_tex_ultra_protocolo_g_invalid_dataset_config'
}, 'Dataset dedicado divergente');

const previousLegacyDataset = process.env.META_PIXEL_ID_EC;
const previousLegacyToken = process.env.META_ACCESS_TOKEN_EC;
const previousDedicatedDataset = process.env.META_PIXEL_ID_EC_TEX_ULTRA_PROTOCOLO_G;
const previousDedicatedToken = process.env.META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G;

try {
    process.env.META_PIXEL_ID_EC = legacyDataset;
    process.env.META_ACCESS_TOKEN_EC = legacyToken;
    process.env.META_PIXEL_ID_EC_TEX_ULTRA_PROTOCOLO_G = META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID;
    process.env.META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G = dedicatedToken;

    assertRoute(getMetaConfigForCountry('EC'), {
        pixelId: legacyDataset,
        accessToken: legacyToken,
        route: 'country_ec_default'
    }, 'default real process.env EC');

    const browserLegacy = await sendBrowserServerEvent({
        country: 'EC',
        eventName: 'Lead',
        event_id: 'FREEZE_EC_BROWSER_LEGACY_V61',
        external_id: 'freeze-ec-browser-legacy-v61'
    }, null, { dryRun: true });
    assert.equal(browserLegacy.ok, true);
    assert.equal(browserLegacy.datasetId, legacyDataset);
    assert.equal(browserLegacy.datasetRoute, 'country_ec_default');
    assertNoServerTokenInResult(browserLegacy, 'evento browser EC legado');

    const browserProtocoloG = await sendBrowserServerEvent({
        country: 'EC',
        productKey: 'tex_ultra_ec',
        product: 'TEX_ULTRA',
        funnel: 'PROTOCOLO_G',
        eventName: 'Lead',
        event_id: 'FREEZE_EC_BROWSER_PROTOCOLO_G_V61',
        external_id: 'freeze-ec-browser-protocolo-g-v61'
    }, null, { dryRun: true });
    assert.equal(browserProtocoloG.ok, true);
    assert.equal(browserProtocoloG.datasetId, META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID);
    assert.equal(browserProtocoloG.datasetRoute, 'ec_tex_ultra_protocolo_g');
    assertNoServerTokenInResult(browserProtocoloG, 'evento browser Protocolo G');
} finally {
    const restore = (key, value) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    };
    restore('META_PIXEL_ID_EC', previousLegacyDataset);
    restore('META_ACCESS_TOKEN_EC', previousLegacyToken);
    restore('META_PIXEL_ID_EC_TEX_ULTRA_PROTOCOLO_G', previousDedicatedDataset);
    restore('META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G', previousDedicatedToken);
}

const attributionEnricher = async () => ({ ok: true, skipped: true, reason: 'freeze_dry_run' });
const purchaseProtocoloG = await sendPurchaseEventForOrder(protocoloGOrder, {
    dryRun: true,
    env: dedicatedEnv,
    attributionEnricher
});
assert.equal(purchaseProtocoloG.ok, true);
assert.equal(purchaseProtocoloG.datasetId, META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID);
assert.equal(purchaseProtocoloG.datasetRoute, 'ec_tex_ultra_protocolo_g');
assertNoServerTokenInResult(purchaseProtocoloG, 'Purchase Protocolo G');

const purchaseOtherProduct = await sendPurchaseEventForOrder(otherProductOrder, {
    dryRun: true,
    env: dedicatedEnv,
    attributionEnricher
});
assert.equal(purchaseOtherProduct.ok, true);
assert.equal(purchaseOtherProduct.datasetId, legacyDataset);
assert.equal(purchaseOtherProduct.datasetRoute, 'country_ec_default');
assertNoServerTokenInResult(purchaseOtherProduct, 'Purchase de outro produto EC');

const publicFiles = [];
const collectPublicFiles = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) collectPublicFiles(absolute);
        else if (/\.(?:css|html|js|json|mjs)$/i.test(entry.name)) publicFiles.push(absolute);
    }
};
collectPublicFiles(path.join(root, 'public'));
for (const file of publicFiles) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(
        source,
        /META_ACCESS_TOKEN_EC(?:_TEX_ULTRA_PROTOCOLO_G)?/,
        `${path.relative(root, file)} não pode referenciar credencial Meta server-side`
    );
}

console.log('META_CAPI_ROUTING_FREEZE_V61=OK');
