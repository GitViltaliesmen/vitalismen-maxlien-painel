import test from 'node:test';
import assert from 'node:assert/strict';

import {
    EC_BOT_CORE_V78_DATASET_ID,
    EC_BOT_CORE_V78_MODE,
    EC_BOT_CORE_V195_CANONICAL_DATASET_ID,
    EC_BOT_CORE_V195_CANONICAL_META_PROFILE,
    assertEcBotCoreV78Health,
    expectedEcBotCoreV78HealthDataset
} from '../src/services/ecBotCoreOperationalV78Service.js';
import {
    assertEcBotCoreV78PreActivationHealth
} from '../scripts/lib/ec-bot-core-operational-contract-v78.mjs';

const healthy = Object.freeze({
    status: 'online',
    engine: 'Z-API',
    zapi: { connected: true, outboundBlocked: false },
    automationSafety: {
        mode: EC_BOT_CORE_V78_MODE,
        botCoreOperational: true,
        mutatingSchedulers: 0,
        dropiApplyAllowed: false,
        metaPurchaseAllowed: false
    }
});

const destination = ({
    profile = '',
    datasetId = EC_BOT_CORE_V78_DATASET_ID,
    browserPixelId = datasetId
} = {}) => ({
    profile,
    datasetId,
    browserPixelId,
    browserServerSynchronized: true
});

test('V78 legado preserva exclusivamente o dataset/browser pixel 146', () => {
    const legacy = destination();
    assert.equal(EC_BOT_CORE_V78_DATASET_ID, '1468946114265008');
    assert.equal(expectedEcBotCoreV78HealthDataset(legacy), EC_BOT_CORE_V78_DATASET_ID);
    assert.equal(assertEcBotCoreV78Health(healthy, legacy).ok, true);
    assert.equal(assertEcBotCoreV78PreActivationHealth(healthy, legacy).ok, true);
});

test('perfil canônico V195 aceita dataset/browser pixel 920 exatos', () => {
    const canonical = destination({
        profile: EC_BOT_CORE_V195_CANONICAL_META_PROFILE,
        datasetId: EC_BOT_CORE_V195_CANONICAL_DATASET_ID
    });
    assert.equal(EC_BOT_CORE_V195_CANONICAL_META_PROFILE, 'meta_canonical_920_v195');
    assert.equal(EC_BOT_CORE_V195_CANONICAL_DATASET_ID, '920532663934291');
    assert.equal(expectedEcBotCoreV78HealthDataset(canonical), EC_BOT_CORE_V195_CANONICAL_DATASET_ID);
    assert.equal(assertEcBotCoreV78Health(healthy, canonical).ok, true);
    assert.equal(assertEcBotCoreV78PreActivationHealth(healthy, canonical).ok, true);
});

test('perfil canônico V195 rejeita dataset diferente', () => {
    const wrongDataset = destination({
        profile: EC_BOT_CORE_V195_CANONICAL_META_PROFILE,
        datasetId: '9999999999999999'
    });
    assert.throws(() => assertEcBotCoreV78Health(healthy, wrongDataset), /meta_dataset_invalid/);
    assert.throws(() => assertEcBotCoreV78PreActivationHealth(healthy, wrongDataset), /meta_dataset_invalid/);
});

test('dataset 920 sem perfil canônico V195 permanece bloqueado', () => {
    const missingProfile = destination({ datasetId: EC_BOT_CORE_V195_CANONICAL_DATASET_ID });
    assert.equal(expectedEcBotCoreV78HealthDataset(missingProfile), EC_BOT_CORE_V78_DATASET_ID);
    assert.throws(() => assertEcBotCoreV78Health(healthy, missingProfile), /meta_dataset_invalid/);
    assert.throws(() => assertEcBotCoreV78PreActivationHealth(healthy, missingProfile), /meta_dataset_invalid/);

    const lookalikeProfile = destination({
        profile: 'META_CANONICAL_920_V195',
        datasetId: EC_BOT_CORE_V195_CANONICAL_DATASET_ID
    });
    assert.throws(() => assertEcBotCoreV78Health(healthy, lookalikeProfile), /meta_dataset_invalid/);
});

test('browser pixel divergente permanece bloqueado nos perfis legado e canônico', () => {
    const legacyMismatch = destination({ browserPixelId: '9999999999999999' });
    assert.throws(() => assertEcBotCoreV78Health(healthy, legacyMismatch), /browser_pixel_invalid/);
    assert.throws(() => assertEcBotCoreV78PreActivationHealth(healthy, legacyMismatch), /browser_pixel_invalid/);

    const canonicalMismatch = destination({
        profile: EC_BOT_CORE_V195_CANONICAL_META_PROFILE,
        datasetId: EC_BOT_CORE_V195_CANONICAL_DATASET_ID,
        browserPixelId: EC_BOT_CORE_V78_DATASET_ID
    });
    assert.throws(() => assertEcBotCoreV78Health(healthy, canonicalMismatch), /browser_pixel_invalid/);
    assert.throws(() => assertEcBotCoreV78PreActivationHealth(healthy, canonicalMismatch), /browser_pixel_invalid/);
});
