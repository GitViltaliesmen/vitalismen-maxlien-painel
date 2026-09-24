import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

import {
    EC_BOT_CORE_V78_DATASET_ID,
    EC_BOT_CORE_V78_NODE_OPTIONS,
    EC_BOT_CORE_V199_NODE_OPTIONS,
    buildEcBotCoreV78OverlayEnvironment,
    selectEcBotCoreV78PreloadForRelease
} from '../src/services/ecBotCoreOperationalV78Service.js';
import { buildEcBotCoreOperationalBundleV78 } from '../scripts/lib/ec-bot-core-operational-contract-v78.mjs';
import { assertV201OverlaySuccessorContract } from '../scripts/lib/ec-runtime-successor-v199-context.mjs';

const HASH = 'a'.repeat(64);
const legacy = Object.freeze({
    release: '20260920T163629Z_production-20260920-8c25ed9',
    commit: '8c25ed9912abc4aabee2656cf9192420389934c6',
    tree: '44d310be637e71d6f6f5fb5d28f06c47f2bf7283',
    tag: 'production-20260920-8c25ed9'
});
const canonicalBase = Object.freeze({
    release: '20260923T220336Z_production-20260923-e4f0f3b',
    commit: 'e4f0f3b4afa075b9fcaf421eda8689b5a3cfd8e9',
    tree: '84f9eca9cc956de9ef5d8aa90bb7b6a456927173',
    tag: 'production-20260923-e4f0f3b'
});
const bundleFor = (identity) => buildEcBotCoreOperationalBundleV78({
    ...identity,
    permitId: 'ec-bot-core-v78-successor-test',
    createdAt: '2026-09-24T00:00:00.000Z',
    expiresAt: '2026-09-24T00:05:00.000Z',
    functionalPayloadSha256: HASH,
    manifestSha256: HASH,
    releaseMetadataSha256: HASH,
    stagingCompleteSha256: HASH,
    publicationMetadataSha256: HASH,
    publicationCompleteSha256: HASH
});

test('bundle legado exato preserva somente o preload V97', () => {
    assert.equal(selectEcBotCoreV78PreloadForRelease(legacy), EC_BOT_CORE_V78_NODE_OPTIONS);
    assert.equal(bundleFor(legacy).environment.NODE_OPTIONS, EC_BOT_CORE_V78_NODE_OPTIONS);
});

test('base canônica aprovada e sucessor atestado usam V199', () => {
    const context = globalThis.__VITALISMEN_V201_V78_OVERLAY_CONTEXT;
    assert.equal(context?.loaded, true);
    const manifest = JSON.parse(fs.readFileSync(new URL('../docs/freeze/ec-bot-core-overlay-preload-v201-20260924.json', import.meta.url), 'utf8'));
    assert.equal(assertV201OverlaySuccessorContract(manifest), true);
    assert.deepEqual([...context.authorizedFiles].sort(), [...manifest.overrides].sort());
    for (const file of [
        'tests/v181-v183-canonical-successor-v184.test.mjs',
        'tests/vsl-first-response-watchdog-v193.test.mjs'
    ]) assert.ok(context.authorizedFiles.includes(file), `${file} deve estar explicitamente autorizado`);
    assert.equal(manifest.baseCommit, canonicalBase.commit);
    assert.equal(execFileSync('git', ['rev-parse', `${manifest.baseCommit}:scripts/lib/ec-runtime-successor-v199-context.mjs`], {
        cwd: process.cwd(), encoding: 'utf8'
    }).trim(), '07b9a21089acefe972ac07500c56f3c5b95604bd');
    assert.equal(selectEcBotCoreV78PreloadForRelease(canonicalBase), EC_BOT_CORE_V199_NODE_OPTIONS);
    assert.equal(bundleFor(canonicalBase).environment.NODE_OPTIONS, EC_BOT_CORE_V199_NODE_OPTIONS);
    const successor = {
        release: '20260924T010000Z_production-20260924-abc1234',
        commit: `abc1234${'0'.repeat(33)}`,
        tree: '1'.repeat(40),
        tag: 'production-20260924-abc1234',
        successorManifestSha256: context.manifestSha256
    };
    const bundle = bundleFor(successor);
    assert.equal(bundle.environment.NODE_OPTIONS, EC_BOT_CORE_V199_NODE_OPTIONS);
    assert.match(bundle.overlay, /^NODE_OPTIONS=--import=file:\/\/\/opt\/vitalismen-automacao\/current\/scripts\/lib\/ec-runtime-successor-v199-context\.mjs$/m);
});

test('release desconhecida, manifest divergente e preload arbitrário bloqueiam', () => {
    const approved = JSON.parse(fs.readFileSync(new URL('../docs/freeze/ec-bot-core-overlay-preload-v201-20260924.json', import.meta.url), 'utf8'));
    const thirdFile = structuredClone(approved);
    thirdFile.overrides.push('tests/third-unlisted.test.mjs');
    thirdFile.protectedFiles['tests/third-unlisted.test.mjs'] = '0'.repeat(64);
    assert.throws(() => assertV201OverlaySuccessorContract(thirdFile), /override_allowlist_invalid/);
    const missing = structuredClone(approved);
    missing.overrides = missing.overrides.filter((file) => file !== 'tests/v181-v183-canonical-successor-v184.test.mjs');
    delete missing.protectedFiles['tests/v181-v183-canonical-successor-v184.test.mjs'];
    assert.throws(() => assertV201OverlaySuccessorContract(missing), /override_allowlist_invalid/);
    const alteredOverride = structuredClone(approved);
    alteredOverride.protectedFiles['tests/vsl-first-response-watchdog-v193.test.mjs'] = '0'.repeat(64);
    assert.throws(() => assertV201OverlaySuccessorContract(alteredOverride), /protected_file_invalid:tests\/vsl-first-response-watchdog-v193\.test\.mjs/);
    const alteredManifest = structuredClone(approved);
    alteredManifest.policy.failClosed = false;
    assert.throws(() => assertV201OverlaySuccessorContract(alteredManifest), /fail_closed_invalid/);
    assert.throws(() => selectEcBotCoreV78PreloadForRelease({ ...legacy, commit: '0'.repeat(40) }), /ec_bot_core_release_not_approved|ec_bot_core_successor_context_invalid/);
    assert.throws(() => bundleFor({
        release: '20260924T010000Z_production-20260924-abc1234',
        commit: `abc1234${'0'.repeat(33)}`,
        tree: '1'.repeat(40),
        tag: 'production-20260924-abc1234',
        successorManifestSha256: '0'.repeat(64)
    }), /ec_bot_core_release_not_approved/);
    assert.throws(() => buildEcBotCoreV78OverlayEnvironment({
        baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID },
        nodeOptions: '--import=file:///tmp/unknown.mjs'
    }), /ec_bot_core_preload_not_approved/);
});
