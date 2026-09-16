import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
    assertV168aPrGuardContract,
    V168A_PR_GUARD_INTEGRATION_FILE,
    V168A_PR_PROTECTED_FILE,
    V168A_PR_SUCCESSOR_SHA256
} from '../scripts/lib/ec-runtime-successor-v168a-pr-context.mjs';

const readJson = (relative) => JSON.parse(fs.readFileSync(relative, 'utf8'));
const manifest = readJson('docs/freeze/ec-v148-browser-pixel-guard-successor-v168a-pr-20260916.json');
const parentV148 = readJson('docs/freeze/ec-meta-funnel-v148-20260910.json');
const parentV153 = readJson('docs/freeze/ec-audio-postsale-recovery-v153-20260913.json');
const hashFile = (relative) => crypto.createHash('sha256').update(fs.readFileSync(relative)).digest('hex');
const guardIntegrationHashes = {
    [V168A_PR_GUARD_INTEGRATION_FILE]: hashFile(V168A_PR_GUARD_INTEGRATION_FILE)
};
const valid = (overrides = {}) => ({
    manifest: structuredClone(manifest),
    parentV148: structuredClone(parentV148),
    parentV153: structuredClone(parentV153),
    currentFileSha256: V168A_PR_SUCCESSOR_SHA256,
    guardIntegrationHashes: { ...guardIntegrationHashes },
    ...overrides
});

test('V168A-P-R aceita somente a transição criptográfica V148 autorizada', () => {
    const result = assertV168aPrGuardContract(valid());
    assert.deepEqual(Object.keys(result.protectedFiles), [V168A_PR_PROTECTED_FILE]);
    assert.equal(manifest.authorizedOverrideFilesCount, 1);
});

test('V168A-P-R bloqueia SHA parental ou sucessor divergente', () => {
    const oldMismatch = valid();
    oldMismatch.parentV148.protectedFiles[V168A_PR_PROTECTED_FILE] = '0'.repeat(64);
    assert.throws(() => assertV168aPrGuardContract(oldMismatch));
    assert.throws(() => assertV168aPrGuardContract(valid({ currentFileSha256: 'f'.repeat(64) })));
});

test('V168A-P-R bloqueia segundo arquivo, Web, Z-API, wildcard e contagem maior que um', () => {
    for (const forbidden of [
        'src/routes/whatsapp.js',
        'src/services/zapiClient.js',
        'src/whatsapp/core/PersistentShadowWorkerV152ER4.js',
        'src/services/*.js'
    ]) {
        const attempt = valid();
        attempt.manifest.authorizedOverrideFiles.push(forbidden);
        attempt.manifest.overrides.push(forbidden);
        attempt.manifest.protectedFiles[forbidden] = 'a'.repeat(64);
        attempt.manifest.authorizedOverrideFilesCount = 2;
        assert.throws(() => assertV168aPrGuardContract(attempt));
    }
});

test('V168A-P-R bloqueia troca do Dataset CAPI e integração de guard não atestada', () => {
    const datasetMutation = valid();
    datasetMutation.manifest.policy.canonicalCapiDataset = '920532663934291';
    assert.throws(() => assertV168aPrGuardContract(datasetMutation));

    const integrationMutation = valid();
    integrationMutation.guardIntegrationHashes[V168A_PR_GUARD_INTEGRATION_FILE] = 'b'.repeat(64);
    assert.throws(() => assertV168aPrGuardContract(integrationMutation));
});
