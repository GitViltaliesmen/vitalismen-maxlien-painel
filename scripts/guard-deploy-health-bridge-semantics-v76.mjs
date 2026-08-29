import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
    assertDeployHelperBridgeSemanticsSourceV76
} from './lib/deploy-health-bridge-semantics-contract-v76.mjs';

await import('../src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestPath = 'docs/freeze/deploy-health-bridge-semantics-v76-20260828.json';
const parentManifestPath = 'docs/freeze/canary-isolation-safety-v75-20260828.json';
const manifest = json(manifestPath);
const v77Manifest = json('docs/freeze/canary-controller-safety-v77-20260828.json');
const v77hManifest = json('docs/freeze/canary-controller-pm2-stdin-hotfix-v77h-20260829.json');
const v77h2Manifest = json('docs/freeze/canary-controller-health-policy-reset-v77h2-20260829.json');
const v78Manifest = json('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json');
const packageJson = json('package.json');
const helper = read('ops/vitalismen-stage');
const health = read('src/routes/health.js');
const architecture = read('docs/ARQUITETURA_AUTOMACAO_OFICIAL.md');
const officialFiles = read('docs/ARQUIVOS_OFICIAIS.md');
const freeze = read('docs/DEPLOY_HEALTH_BRIDGE_SEMANTICS_FREEZE_V76_20260828.md');

assert.equal(sha256(parentManifestPath), '56551c343f24591f6b76dd7a01fe89736d2f43b59d0b51e7701887bc8d377ffb');
assert.equal(manifest.freezeId, 'deploy-health-bridge-semantics-v76');
assert.equal(manifest.parentFreezeId, 'canary-isolation-safety-v75');
assert.equal(manifest.parentManifestSha256, sha256(parentManifestPath));
assert.equal(manifest.policy.contractVersion, 76);
assert.equal(manifest.policy.runtimeGuardChainVersion, 71);
assert.equal(manifest.policy.dataCompatibilityVersion, 66);
assert.equal(manifest.policy.persistentBridgeCompleteRequired, true);
assert.equal(manifest.policy.operationalBridgeReady, false);
assert.equal(manifest.policy.mutationsEnabled, false);
assert.equal(manifest.policy.mutatingSchedulers, 0);
assert.equal(manifest.policy.dropiMode, 'REPORT_ONLY');
assert.equal(manifest.policy.dropiApplyAllowed, false);

for (const [file, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    const actualHash = sha256(file);
    if (
        v77Manifest.declaredAncestorOverrides?.includes(file)
        && v77Manifest.protectedFiles?.[file] === actualHash
    ) continue;
    if (
        v77hManifest.declaredAncestorOverrides?.includes(file)
        && v77hManifest.protectedFiles?.[file] === actualHash
    ) continue;
    if (
        v77h2Manifest.declaredAncestorOverrides?.includes(file)
        && v77h2Manifest.protectedFiles?.[file] === actualHash
    ) continue;
    if (
        v78Manifest.declaredAncestorOverrides?.includes(file)
        && v78Manifest.protectedFiles?.[file] === actualHash
    ) continue;
    assert.equal(actualHash, approvedHash, `arquivo protegido V76 divergente: ${file}`);
}

const contract = assertDeployHelperBridgeSemanticsSourceV76(helper);
assert.equal(contract.healthPersistentBridgeRequired, true);
assert.equal(contract.operationalBridgeReady, false);
assert.equal(contract.mutatingSchedulers, 0);
assert.equal(contract.dropiMode, 'REPORT_ONLY');
assert.match(health, /compatibilityBridgeComplete: compatibilityState\?\.bridgeComplete === true/);
assert.match(health, /dataCompatibilityVersion: Number\(compatibilityState\?\.dataCompatibilityVersion \|\| 0\)/);
assert.match(health, /minimumRuntimeVersion: Number\(compatibilityState\?\.minRuntimeVersion \|\| 0\)/);

assert.equal(
    packageJson.scripts['guard:runtime-chain-v71'],
    'node src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js'
);
assert.equal(
    packageJson.scripts['guard:deploy-health-v76'],
    'node src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js && node scripts/guard-deploy-health-bridge-semantics-v76.mjs && node --test tests/deploy-health-bridge-semantics-v76.test.mjs'
);
assert.match(packageJson.scripts['guard:predeploy-v71'], /guard:deploy-health-v76/);
for (const document of [architecture, officialFiles, freeze]) {
    assert.match(document, /deploy-health-bridge-semantics-v76/);
    assert.match(document, /bridgeComplete=true/);
    assert.match(document, /POST_SALE_V66_COMPATIBILITY_BRIDGE_READY=false/);
}

console.log('DEPLOY_HEALTH_BRIDGE_SEMANTICS_V76_STATIC=OK');
console.log('PERSISTENT_BRIDGE_COMPLETE=TRUE');
console.log('OPERATIONAL_BRIDGE_READY=FALSE');
console.log('MUTATIONS_ENABLED=FALSE');
console.log('MUTATING_SCHEDULERS=0');
console.log('DROPI_MODE=REPORT_ONLY');
console.log('REMOTE_MUTATIONS_EXECUTED=0');
