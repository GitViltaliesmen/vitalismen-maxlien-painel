import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
    DEPLOY_INTEGRATION_V291,
    validateDeployIntegrationLineageV291
} from '../src/services/deployIntegrationPolicyV291.js';

await import('../src/services/guardAliasIntegrationFreezeRuntimeGuardV292.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const manifest = JSON.parse(read('docs/freeze/guard-alias-integration-v29-2-20260818.json'));
const packageJson = JSON.parse(read('package.json'));
const parentManifest = fs.readFileSync('docs/freeze/deploy-integration-v29-1-20260818.json');
const parentSha = crypto.createHash('sha256').update(parentManifest).digest('hex');
const v29Manifest = fs.readFileSync('docs/freeze/logistics-clean-chat-v29-20260818.json');
const v29ManifestSha = crypto.createHash('sha256').update(v29Manifest).digest('hex');
const successor = 'node src/services/guardAliasIntegrationFreezeRuntimeGuardV292.js';

test('V29.2 herda exatamente a V29.1 e não declara mudança de fluxo', () => {
    assert.equal(parentSha, manifest.parentManifestSha256);
    assert.equal(manifest.parentFreezeId, 'deploy-integration-v29-1-20260818');
    assert.equal(manifest.policy.ancestorFreezesPreserved, true);
    assert.equal(manifest.policy.flowChanged, false);
    assert.equal(manifest.publicationStatus, 'release_train_authorized');
    assert.equal(manifest.policy.remoteStagingAuthorized, true);
    assert.equal(manifest.policy.directActivationBlocked, true);
    assert.equal(manifest.operatorActivationApproval.status, 'required_explicit');
    assert.deepEqual(manifest.declaredParentOverrides, [
        'package.json',
        'src/index.js',
        'tests/panel-call-dropi-safety-v21.test.mjs'
    ]);
});

test('V29.2 preserva a validação estrita de SHA e lineage da V29.1', () => {
    const exact = {
        ...DEPLOY_INTEGRATION_V291,
        actualParentManifestSha256: v29ManifestSha
    };
    assert.equal(validateDeployIntegrationLineageV291(exact).freezeId, DEPLOY_INTEGRATION_V291.freezeId);
    assert.throws(() => validateDeployIntegrationLineageV291({
        ...exact,
        baseV29Sha: 'f'.repeat(40)
    }), /SHA V29/);
    assert.throws(() => validateDeployIntegrationLineageV291({
        ...exact,
        actualParentManifestSha256: 'a'.repeat(64)
    }), /manifesto V29 real/);
});

test('todos os aliases obsoletos entram pelo sucessor V29.2', () => {
    for (const scriptName of [
        'guard:whatsapp-chats-readonly',
        'guard:logistics-clean-chat-v29',
        'guard:deploy-integration-v29-1',
        'guard:operational-mode-zapi-health',
        'guard:ec-nitrix',
        'guard:ec-identity',
        'guard:tex-ultra-approved',
        'guard:ec-product-funnel-isolation'
    ]) {
        const script = packageJson.scripts[scriptName] || '';
        assert.equal(script.startsWith(successor), true, scriptName);
        assert.doesNotMatch(script, /guard-customer-data-resolution-v28\.mjs/);
    }
});

test('startup usa somente o runtime sucessor V29.2', () => {
    const index = read('src/index.js');
    assert.match(index, /guardAliasIntegrationFreezeRuntimeGuardV292\.js/);
    assert.doesNotMatch(index, /deployIntegrationFreezeRuntimeGuardV291\.js/);
});

test('release train é autorizado e ativação continua bloqueada', () => {
    const result = spawnSync(process.execPath, ['scripts/assert-guard-alias-integration-approved-v29-2.mjs'], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /preparação de release autorizada/);
    for (const scriptName of ['deploy:ec-safe', 'deploy:vps']) {
        assert.match(packageJson.scripts[scriptName], /assert-guard-alias-integration-approved-v29-2\.mjs/);
    }
    assert.equal(manifest.operatorActivationApproval.status, 'required_explicit');
    assert.equal(manifest.policy.directActivationBlocked, true);
});
