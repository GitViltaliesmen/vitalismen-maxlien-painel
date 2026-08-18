import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { validateDeployIntegrationLineageV291 } from './deployIntegrationPolicyV291.js';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/deploy-integration-v29-1-20260818.json';
const parentManifestRelativePath = 'docs/freeze/logistics-clean-chat-v29-20260818.json';
const grandparentManifestRelativePath = 'docs/freeze/customer-data-resolution-v28-20260818.json';
const expectedParentManifestSha = '6569acc57662ac8aba1852836d68e77382dc650c373a3f94eafb44a5358950dc';
const expectedGrandparentManifestSha = 'b86645ebfbf87d7d84ed737e596ae34f8e21b57e84e615cb5070e6583484e4a3';
const declaredParentOverrides = [
    'package.json',
    'src/index.js',
    'tests/panel-call-dropi-safety-v21.test.mjs'
];
const newProtectedFiles = [
    'docs/DEPLOY_INTEGRATION_HOTFIX_FREEZE_V29_1_20260818.md',
    'scripts/assert-deploy-integration-approved-v29-1.mjs',
    'scripts/deploy-ec-safe.mjs',
    'scripts/deploy-vps-ready.mjs',
    'scripts/guard-deploy-integration-v29-1.mjs',
    'src/services/deployIntegrationFreezeRuntimeGuardV291.js',
    'src/services/deployIntegrationPolicyV291.js',
    'tests/deploy-integration-v29-1.test.mjs'
];

const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

for (const requiredPath of [manifestRelativePath, parentManifestRelativePath, grandparentManifestRelativePath]) {
    if (!exists(requiredPath)) throw new Error(`[DEPLOY-INTEGRATION-V29.1] manifesto ausente: ${requiredPath}`);
}
if (sha256(parentManifestRelativePath) !== expectedParentManifestSha) {
    throw new Error('[DEPLOY-INTEGRATION-V29.1] manifesto pai V29 divergente; startup bloqueado.');
}
if (sha256(grandparentManifestRelativePath) !== expectedGrandparentManifestSha) {
    throw new Error('[DEPLOY-INTEGRATION-V29.1] manifesto V28 divergente; startup bloqueado.');
}

const grandparent = readJson(grandparentManifestRelativePath);
const parent = readJson(parentManifestRelativePath);
const manifest = readJson(manifestRelativePath);
validateDeployIntegrationLineageV291({
    freezeId: manifest.freezeId,
    parentFreezeId: manifest.parentFreezeId,
    baseV28Sha: manifest.baseV28Sha,
    baseV29Sha: manifest.baseV29Sha,
    parentManifestSha256: manifest.parentManifestSha256,
    actualParentManifestSha256: sha256(parentManifestRelativePath)
});

const expectedProtectedFiles = [...declaredParentOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
if (
    grandparent.freezeId !== 'customer-data-resolution-v28-20260818'
    || parent.freezeId !== 'logistics-clean-chat-v29-20260818'
    || parent.parentFreezeId !== grandparent.freezeId
    || parent.parentManifestSha256 !== expectedGrandparentManifestSha
    || manifest.status !== 'release_preparation_candidate_locked'
    || manifest.publicationStatus !== 'approved_for_release_preparation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'approved_in_thread'
    || manifest.operatorApproval?.scope !== 'prepare_and_promote_v29_1_without_activation'
    || manifest.operatorActivationApproval?.status !== 'required_explicit'
    || manifest.policy?.v29FunctionalFreezePreserved !== true
    || manifest.policy?.exactLineageRequired !== true
    || manifest.policy?.legacyV28DeployGuardRejected !== true
    || manifest.policy?.directActivationBlocked !== true
    || manifest.policy?.transactionalRootHelperRequired !== true
    || manifest.realEffects?.deploy !== false
    || JSON.stringify([...(manifest.declaredParentOverrides || [])].sort()) !== JSON.stringify(declaredParentOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || protectedFiles.length !== expectedProtectedFiles.length
    || expectedProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
) {
    throw new Error('[DEPLOY-INTEGRATION-V29.1] manifesto ou política inválida; startup bloqueado.');
}

for (const [relativePath, approvedHash] of Object.entries(grandparent.protectedFiles || {})) {
    if ((parent.declaredParentOverrides || []).includes(relativePath)) continue;
    if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[DEPLOY-INTEGRATION-V29.1] herança V28 divergente em ${relativePath}.`);
    }
}
for (const [relativePath, approvedHash] of Object.entries(parent.protectedFiles || {})) {
    if (declaredParentOverrides.includes(relativePath)) continue;
    if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[DEPLOY-INTEGRATION-V29.1] freeze funcional V29 divergente em ${relativePath}.`);
    }
}
for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[DEPLOY-INTEGRATION-V29.1] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[DEPLOY-INTEGRATION-V29.1] lineage V28 → V29 → V29.1 verificada; ativação direta bloqueada.');
