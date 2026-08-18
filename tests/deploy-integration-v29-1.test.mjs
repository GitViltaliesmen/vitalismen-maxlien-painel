import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {
    DEPLOY_INTEGRATION_V291,
    validateDeployIntegrationLineageV291
} from '../src/services/deployIntegrationPolicyV291.js';
import {
    OFFICIAL_GITHUB_REPOSITORY,
    validateReleaseSource
} from '../scripts/release-source-policy.mjs';

const parentManifest = fs.readFileSync('docs/freeze/logistics-clean-chat-v29-20260818.json');
const actualParentManifestSha256 = crypto.createHash('sha256').update(parentManifest).digest('hex');
const lineage = (overrides = {}) => ({
    ...DEPLOY_INTEGRATION_V291,
    actualParentManifestSha256,
    ...overrides
});
const commit = 'abcdef0123456789abcdef0123456789abcdef01';
const releaseSource = (overrides = {}) => ({
    status: '',
    branch: 'production',
    commit,
    tag: 'production-20260818-abcdef0',
    tagCommit: commit,
    originUrl: `https://github.com/${OFFICIAL_GITHUB_REPOSITORY}.git`,
    remoteProductionCommit: commit,
    remoteTagCommit: commit,
    ...overrides
});

test('V29.1 aceita somente lineage V28 → V29 → V29.1 exata', () => {
    assert.equal(parentManifest.length > 0, true);
    assert.deepEqual(validateDeployIntegrationLineageV291(lineage()), {
        freezeId: DEPLOY_INTEGRATION_V291.freezeId,
        parentFreezeId: DEPLOY_INTEGRATION_V291.parentFreezeId,
        baseV28Sha: DEPLOY_INTEGRATION_V291.baseV28Sha,
        baseV29Sha: DEPLOY_INTEGRATION_V291.baseV29Sha,
        parentManifestSha256: DEPLOY_INTEGRATION_V291.parentManifestSha256
    });
});

test('V29.1 bloqueia V28 antiga, V29 sem integração e release desconhecida', () => {
    for (const freezeId of [
        'customer-data-resolution-v28-20260818',
        'logistics-clean-chat-v29-20260818',
        'release-desconhecida'
    ]) {
        assert.throws(() => validateDeployIntegrationLineageV291(lineage({ freezeId })), /lineage bloqueada/);
    }
});

test('V29.1 bloqueia SHA falso e manifesto pai divergente', () => {
    assert.throws(() => validateDeployIntegrationLineageV291(lineage({ baseV29Sha: 'f'.repeat(40) })), /SHA V29/);
    assert.throws(() => validateDeployIntegrationLineageV291(lineage({ actualParentManifestSha256: 'a'.repeat(64) })), /manifesto V29 real/);
});

test('fonte oficial aceita V29.1 válida e bloqueia SHA/tag inválidos', () => {
    assert.equal(validateReleaseSource(releaseSource()).commit, commit);
    assert.throws(() => validateReleaseSource(releaseSource({ tag: 'freeze-v29-1' })), /Deploy bloqueado/);
    assert.throws(() => validateReleaseSource(releaseSource({ tagCommit: 'f'.repeat(40) })), /Deploy bloqueado/);
    assert.throws(() => validateReleaseSource(releaseSource({ remoteProductionCommit: 'e'.repeat(40) })), /Deploy bloqueado/);
});

test('comandos de deploy usam somente o sucessor V29.1 e preservam regressão V29', () => {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    for (const scriptName of ['deploy:vps', 'deploy:ec-safe']) {
        const script = packageJson.scripts[scriptName];
        assert.match(script, /^node scripts\/guard-deploy-integration-v29-1\.mjs/);
        assert.doesNotMatch(script, /guard-customer-data-resolution-v28\.mjs/);
        assert.match(script, /tests\/logistics-clean-chat-v29\.test\.mjs/);
    }
});
