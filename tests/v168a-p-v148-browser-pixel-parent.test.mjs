import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    META_V148_APPROVED_BROWSER_PIXELS,
    META_V148_EXISTING_DATASET,
    META_V150_APPROVED_VSL_BROWSER_PIXEL,
    salesAttributionV148
} from '../src/services/metaFunnelV148ContractService.js';
import {
    protocoloGStructuredTracking,
    validateVilaliemenProtocoloGContract
} from '../src/services/metaProtocoloGAttributionService.js';
import { getMetaConfigForOrder } from '../src/services/metaConversionsService.js';
import {
    buildEcBotCoreV78OverlayEnvironment,
    EC_BOT_CORE_V78_DATASET_ID
} from '../src/services/ecBotCoreOperationalV78Service.js';

const fixture = JSON.parse(fs.readFileSync(
    new URL('./fixtures/meta-funnel-v148-contract.json', import.meta.url),
    'utf8'
));

const approvedBrowserPayload = Object.freeze({
    ...fixture,
    browser_pixel_id: META_V150_APPROVED_VSL_BROWSER_PIXEL
});

test('V168A-P separa a allowlist Browser do Dataset CAPI canônico', () => {
    assert.deepEqual(META_V148_APPROVED_BROWSER_PIXELS, [
        '1468946114265008',
        '920532663934291'
    ]);
    assert.equal(META_V148_EXISTING_DATASET, '1468946114265008');
    assert.equal(EC_BOT_CORE_V78_DATASET_ID, '1468946114265008');

    const contract = validateVilaliemenProtocoloGContract(approvedBrowserPayload);
    assert.equal(contract.ok, true);
    assert.deepEqual(contract.errors, []);

    const tracking = protocoloGStructuredTracking(approvedBrowserPayload, contract);
    assert.equal(salesAttributionV148(tracking), true);

    const env = {
        ...buildEcBotCoreV78OverlayEnvironment({
            baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID }
        }),
        META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID,
        META_ACCESS_TOKEN_EC: 'fixture-token'
    };
    const destination = getMetaConfigForOrder({ country: 'EC', tracking }, env);
    assert.equal(destination.pixelId, META_V148_EXISTING_DATASET);
    assert.equal(destination.route, 'country_ec_default');
});

test('V168A-P preserva deliberadamente a compatibilidade Browser anterior', () => {
    const contract = validateVilaliemenProtocoloGContract(fixture);
    assert.equal(contract.ok, true);
    assert.equal(salesAttributionV148(fixture), true);
});

test('V168A-P rejeita Pixel, sessão, identidade e external_id inválidos', () => {
    const invalidCases = [
        { browser_pixel_id: '999999999999999' },
        { sessionId: '' },
        { branch_identity: 'invalid-branch' },
        { external_id: '', visitorId: '' }
    ];
    for (const mutation of invalidCases) {
        assert.equal(
            validateVilaliemenProtocoloGContract({ ...approvedBrowserPayload, ...mutation }).ok,
            false
        );
    }
});

test('V168A-P mantém o classificador V148 fechado para versão incompatível', () => {
    assert.equal(salesAttributionV148({
        ...approvedBrowserPayload,
        measurement_version: 147
    }), false);
});
