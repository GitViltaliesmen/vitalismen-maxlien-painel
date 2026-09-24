import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    validateCheckpoint, validateR4Manifest, validateAttestation,
    SHIPMENTS_SHA256, V201_COMMIT, V201_TREE, V201_MANIFEST_SHA256
} from '../scripts/lib/unified-successor-v202-r4-authority.mjs';
import { assertExternalLocks } from '../scripts/guard-unified-successor-v202-r4.mjs';
import {
    EC_BOT_CORE_V78_NODE_OPTIONS, EC_BOT_CORE_V199_NODE_OPTIONS,
    selectEcBotCoreV78PreloadForRelease
} from '../src/services/ecBotCoreOperationalV78Service.js';

const manifest = JSON.parse(fs.readFileSync(new URL(
    '../docs/freeze/unified-successor-v47-v77h2-v202-r4-20260924.json', import.meta.url)));
const sha = 'a'.repeat(64);
const commit = 'b'.repeat(40);
const tree = 'c'.repeat(40);
const checkpoint = {
    checkpointId: 'CHECKPOINT_UNIFIED_SUCCESSOR_OPERATIONAL_R4_STAGEFIX_READY',
    status: 'FROZEN',
    parentCheckpoint: 'CHECKPOINT_UNIFIED_SUCCESSOR_OPERATIONAL_R4_READY',
    parentR4Commit: 'd965572e5ada1acae697953af162eaceae3ca3b6',
    parentR4Tree: 'c2db82792192f7aafb6b8ca45ea2acd8fc1fdace',
    parentAuthorityCheckpointSha256:
        'b5b9a04e38e1f7560dfae7b1f209ed3bc6933066cb3313748dbad6e1fa7fb09e',
    project: 'MAXLIEN EC — VITALISMEN OFICIAL',
    r4OperationalCommit: commit,
    r4OperationalTree: tree,
    r4OperationalManifestSha256: sha,
    r4OperationalPreloadSha256: sha,
    r4OperationalGuardSha256: sha,
    r4OperationalRunnerSha256: sha,
    allowlistCount: 83,
    v201PublishedCommit: V201_COMMIT,
    v201PublishedTree: V201_TREE,
    v201ManifestSha256: V201_MANIFEST_SHA256,
    shipmentsSha256: SHIPMENTS_SHA256
};
const attestation = {
    attestationId: 'R4_OPERATIONAL_RELEASE_ATTESTATION',
    checkpointId: checkpoint.checkpointId,
    checkpointSha256: sha,
    releaseName: '20260924T120000Z_production-20260924-bbbbbbb',
    commit, tree,
    manifestSha256: sha,
    preloadSha256: sha,
    guardSha256: sha,
    runnerSha256: sha,
    allowlistCount: 83,
    materializedFileHashes: manifest.allowlist.map(entry =>
        ({ path: entry.path, sha256: entry.canonicalSha256 })),
    externalEffectLocks: manifest.externalEffectLocks,
    v201ContextReleasePath:
        '/opt/vitalismen-automacao/releases/20260924T120000Z_production-20260924-641759b',
    gitValidatedBeforeRemoval: true
};
const clone = value => structuredClone(value);
const rejects = fn => assert.throws(fn);
test('CURRENT_POLICY=EXACT_IDENTITIES_ONLY: legacy V78 exata seleciona V97', () => {
    assert.equal(selectEcBotCoreV78PreloadForRelease({
        release: '20260920T163629Z_production-20260920-8c25ed9',
        commit: '8c25ed9912abc4aabee2656cf9192420389934c6',
        tree: '44d310be637e71d6f6f5fb5d28f06c47f2bf7283',
        tag: 'production-20260920-8c25ed9'
    }), EC_BOT_CORE_V78_NODE_OPTIONS);
});
test('CURRENT_POLICY=EXACT_IDENTITIES_ONLY: V201 publicada exata seleciona V199', () => {
    const before = globalThis.__VITALISMEN_V201_V78_OVERLAY_CONTEXT;
    globalThis.__VITALISMEN_V201_V78_OVERLAY_CONTEXT = {
        loaded: true, baseCommit: 'e4f0f3b4afa075b9fcaf421eda8689b5a3cfd8e9',
        manifestSha256: V201_MANIFEST_SHA256
    };
    try {
        const identity = {
            release: '20260924T120000Z_production-20260924-641759b',
            commit: V201_COMMIT, tree: V201_TREE, tag: 'production-20260924-641759b',
            successorManifestSha256: V201_MANIFEST_SHA256
        };
        assert.equal(selectEcBotCoreV78PreloadForRelease(identity),
            EC_BOT_CORE_V199_NODE_OPTIONS);
        rejects(() => selectEcBotCoreV78PreloadForRelease({
            ...identity, commit: 'd'.repeat(40)
        }));
        rejects(() => selectEcBotCoreV78PreloadForRelease({
            ...identity, tree: 'e'.repeat(40)
        }));
        rejects(() => selectEcBotCoreV78PreloadForRelease({
            ...identity, successorManifestSha256: sha
        }));
        rejects(() => selectEcBotCoreV78PreloadForRelease({
            ...identity, commit: 'abc1234' + 'a'.repeat(33),
            release: '20260924T120000Z_production-20260924-abc1234',
            tag: 'production-20260924-abc1234'
        }));
    } finally {
        if (before === undefined) delete globalThis.__VITALISMEN_V201_V78_OVERLAY_CONTEXT;
        else globalThis.__VITALISMEN_V201_V78_OVERLAY_CONTEXT = before;
    }
});
test('wrong legacy, unknown e manifesto isolado bloqueiam', () => {
    rejects(() => selectEcBotCoreV78PreloadForRelease({
        release: '20260920T163629Z_production-20260920-8c25ed9',
        commit: '8c25ed9912abc4aabee2656cf9192420389934c6',
        tree: '44d310be637e71d6f6f5fb5d28f06c47f2bf7283',
        tag: 'production-20260920-0000000'
    }));
    rejects(() => selectEcBotCoreV78PreloadForRelease({}));
    rejects(() => selectEcBotCoreV78PreloadForRelease({
        release: '20260924T120000Z_production-20260924-abcdef0',
        commit: 'abcdef0' + 'a'.repeat(33), tree: 'c'.repeat(40),
        tag: 'production-20260924-abcdef0',
        successorManifestSha256: V201_MANIFEST_SHA256
    }));
});
test('checkpoint exato e campos não extensíveis', () => {
    assert.equal(validateCheckpoint(clone(checkpoint)).r4OperationalCommit, commit);
    const cases = [
        value => { value.r4OperationalCommit = '0'.repeat(39); },
        value => { value.r4OperationalTree = '0'.repeat(39); },
        value => { value.r4OperationalManifestSha256 = '0'.repeat(63); },
        value => { value.allowlistCount = 84; },
        value => { value.parentCheckpoint = 'OUTRO'; },
        value => { value.parentR4Commit = '0'.repeat(40); },
        value => { value.parentAuthorityCheckpointSha256 = '0'.repeat(64); },
        value => { value.extra = true; }
    ];
    for (const change of cases) {
        const value = clone(checkpoint); change(value);
        rejects(() => validateCheckpoint(value));
    }
});
test('manifesto R4 preserva 83, shipments e locks', () => {
    assert.equal(validateR4Manifest(clone(manifest)).allowlistCount, 83);
    const cases = [
        value => { value.allowlistCount = 84; },
        value => { value.allowlist.pop(); },
        value => { value.allowlist.push(value.allowlist[0]); },
        value => { value.allowlist.find(x => x.path === 'src/routes/shipments.js').canonicalSha256 = sha; },
        value => { value.externalEffectLocks.dropiRealBlocked = false; },
        value => { value.policy.runtimeGitDependency = true; }
    ];
    for (const change of cases) {
        const value = clone(manifest); change(value);
        rejects(() => validateR4Manifest(value));
    }
});
test('attestation exata bloqueia identidade, hashes e allowlist adulterados', () => {
    assert.equal(validateAttestation(clone(attestation), checkpoint, sha, manifest).allowlistCount, 83);
    const cases = [
        value => { value.checkpointSha256 = '0'.repeat(64); },
        value => { value.commit = '0'.repeat(40); },
        value => { value.tree = '0'.repeat(40); },
        value => { value.manifestSha256 = '0'.repeat(64); },
        value => { value.preloadSha256 = '0'.repeat(64); },
        value => { value.guardSha256 = '0'.repeat(64); },
        value => { value.runnerSha256 = '0'.repeat(64); },
        value => { value.allowlistCount = 82; },
        value => { value.materializedFileHashes.pop(); },
        value => { value.materializedFileHashes[0].sha256 = '0'.repeat(64); },
        value => { value.externalEffectLocks.purchaseRealBlocked = false; },
        value => { value.gitValidatedBeforeRemoval = false; },
        value => { value.extra = true; }
    ];
    for (const change of cases) {
        const value = clone(attestation); change(value);
        rejects(() => validateAttestation(value, checkpoint, sha, manifest));
    }
});
test('efeitos externos reais continuam bloqueados no operacional', () => {
    assertExternalLocks(manifest.externalEffectLocks,
        { DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY' }, { allowBotOperational: true });
    rejects(() => assertExternalLocks(manifest.externalEffectLocks,
        { DROPPI_EC_ACTIVE_SYNC_ENABLED: 'true' }, { allowBotOperational: true }));
    rejects(() => assertExternalLocks(manifest.externalEffectLocks,
        { VITALISMEN_META_PURCHASE_ENABLED: 'true' }, { allowBotOperational: true }));
    rejects(() => assertExternalLocks(manifest.externalEffectLocks,
        { DROPPI_EC_ACTIVE_SYNC_MODE: 'APPLY' }, { allowBotOperational: true }));
});
