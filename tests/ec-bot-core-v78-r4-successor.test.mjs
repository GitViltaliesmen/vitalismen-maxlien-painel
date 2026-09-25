import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildEcBotCoreOperationalBundleV78,
    validateEcBotCoreOperationalBundleV78
} from '../scripts/lib/ec-bot-core-operational-contract-v78.mjs';
import {
    EC_BOT_CORE_V199_NODE_OPTIONS,
    EC_BOT_CORE_R4_NODE_OPTIONS,
    selectEcBotCoreV78PreloadForRelease
} from '../src/services/ecBotCoreOperationalV78Service.js';

const v201 = Object.freeze({
    release: '20260924T015646Z_production-20260924-641759b',
    commit: '641759b160c2b91e95a3f1df371ad372a74d72e1',
    tree: '1feb02ad1a3f2ae266ef519bf33426b91ac80aa3',
    tag: 'production-20260924-641759b',
    successorManifestSha256: 'e8b82901e8faa4cda1d37a013fd2698401bad9c2039b702e637b88d5e4e56bee'
});
const base = Object.freeze({
    ...v201,
    permitId: 'ec-bot-core-v78-successor-fixture-001',
    createdAt: '2026-09-24T00:00:00.000Z',
    expiresAt: '2026-09-24T00:09:00.000Z',
    functionalPayloadSha256: 'a'.repeat(64),
    manifestSha256: 'b'.repeat(64),
    releaseMetadataSha256: 'c'.repeat(64),
    stagingCompleteSha256: 'd'.repeat(64),
    publicationMetadataSha256: 'e'.repeat(64),
    publicationCompleteSha256: 'f'.repeat(64)
});
const withV201Context = fn => {
    const before = globalThis.__VITALISMEN_V201_V78_OVERLAY_CONTEXT;
    globalThis.__VITALISMEN_V201_V78_OVERLAY_CONTEXT = Object.freeze({
        loaded: true,
        baseCommit: 'e4f0f3b4afa075b9fcaf421eda8689b5a3cfd8e9',
        manifestSha256: v201.successorManifestSha256
    });
    try { return fn(); } finally {
        if (before === undefined) delete globalThis.__VITALISMEN_V201_V78_OVERLAY_CONTEXT;
        else globalThis.__VITALISMEN_V201_V78_OVERLAY_CONTEXT = before;
    }
};
const assertBlocked = (label, fn) => assert.throws(fn, undefined, label);

test('V201 exata seleciona V199 e cria bundle V78 coerente', () => withV201Context(() => {
    assert.equal(selectEcBotCoreV78PreloadForRelease(v201), EC_BOT_CORE_V199_NODE_OPTIONS);
    const bundle = buildEcBotCoreOperationalBundleV78(base);
    assert.equal(bundle.environment.NODE_OPTIONS, EC_BOT_CORE_V199_NODE_OPTIONS);
    assert.equal(bundle.attestation.commit, v201.commit);
    assert.equal(bundle.attestation.tree, v201.tree);
    assert.equal(bundle.permit.commit, v201.commit);
    assert.equal(bundle.permit.tree, v201.tree);
    const valid = validateEcBotCoreOperationalBundleV78({
        overlay: bundle.overlay,
        attestation: bundle.attestation,
        permit: bundle.permit,
        nowMs: Date.parse('2026-09-24T00:01:00.000Z'),
        expected: base
    });
    assert.equal(valid.ok, true);
}));

test('matriz V78 bloqueia preload, identidade, manifesto, attestation e permit divergentes',
    () => withV201Context(() => {
        const bundle = buildEcBotCoreOperationalBundleV78(base);
        const common = {
            overlay: bundle.overlay, attestation: bundle.attestation, permit: bundle.permit,
            nowMs: Date.parse('2026-09-24T00:01:00.000Z'), expected: base
        };
        assertBlocked('V201 + R4', () => validateEcBotCoreOperationalBundleV78({
            ...common, overlay: bundle.overlay.replace(EC_BOT_CORE_V199_NODE_OPTIONS,
                EC_BOT_CORE_R4_NODE_OPTIONS)
        }));
        assertBlocked('wrong commit', () => selectEcBotCoreV78PreloadForRelease({
            ...v201, commit: '0'.repeat(40)
        }));
        assertBlocked('wrong tree', () => selectEcBotCoreV78PreloadForRelease({
            ...v201, tree: '0'.repeat(40)
        }));
        assertBlocked('unknown release', () => selectEcBotCoreV78PreloadForRelease({
            ...v201, release: '20260924T015646Z_production-20260924-0000000'
        }));
        assertBlocked('wrong manifest', () => selectEcBotCoreV78PreloadForRelease({
            ...v201, successorManifestSha256: '0'.repeat(64)
        }));
        assertBlocked('wrong bundle identity', () => validateEcBotCoreOperationalBundleV78({
            ...common, expected: { ...base, tree: '0'.repeat(40) }
        }));
        assertBlocked('wrong attestation', () => validateEcBotCoreOperationalBundleV78({
            ...common, attestation: { ...bundle.attestation, commit: '0'.repeat(40) }
        }));
        assertBlocked('wrong permit', () => validateEcBotCoreOperationalBundleV78({
            ...common, permit: { ...bundle.permit, permitId: 'ec-bot-core-v78-wrong-000' }
        }));
        assertBlocked('expired permit', () => validateEcBotCoreOperationalBundleV78({
            ...common, nowMs: Date.parse('2026-09-24T00:10:00.000Z')
        }));
    }));
