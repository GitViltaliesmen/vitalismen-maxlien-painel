import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/guard-alias-integration-v29-2-20260818.json';
const ancestorSpecs = [
    {
        path: 'docs/freeze/customer-data-resolution-v28-20260818.json',
        freezeId: 'customer-data-resolution-v28-20260818',
        sha256: 'b86645ebfbf87d7d84ed737e596ae34f8e21b57e84e615cb5070e6583484e4a3'
    },
    {
        path: 'docs/freeze/logistics-clean-chat-v29-20260818.json',
        freezeId: 'logistics-clean-chat-v29-20260818',
        sha256: '6569acc57662ac8aba1852836d68e77382dc650c373a3f94eafb44a5358950dc'
    },
    {
        path: 'docs/freeze/deploy-integration-v29-1-20260818.json',
        freezeId: 'deploy-integration-v29-1-20260818',
        sha256: 'c2e80fa82432eadef07850948bb654a789b6d4e6b9d1e238cbe11f86bfbc4fe1'
    }
];
const declaredParentOverrides = [
    'package.json',
    'src/index.js',
    'tests/panel-call-dropi-safety-v21.test.mjs'
];
const newProtectedFiles = [
    'docs/GUARD_ALIAS_INTEGRATION_FREEZE_V29_2_20260818.md',
    'scripts/assert-guard-alias-integration-approved-v29-2.mjs',
    'scripts/guard-alias-integration-v29-2.mjs',
    'src/services/guardAliasIntegrationFreezeRuntimeGuardV292.js',
    'tests/guard-alias-integration-v29-2.test.mjs'
];

const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

for (const spec of ancestorSpecs) {
    if (!exists(spec.path) || sha256(spec.path) !== spec.sha256) {
        throw new Error(`[GUARD-ALIAS-V29.2] manifesto ancestral divergente: ${spec.path}`);
    }
}
if (!exists(manifestRelativePath)) {
    throw new Error('[GUARD-ALIAS-V29.2] manifesto V29.2 ausente; startup bloqueado.');
}

const ancestors = ancestorSpecs.map((spec) => readJson(spec.path));
const manifest = readJson(manifestRelativePath);
for (let index = 0; index < ancestors.length; index += 1) {
    if (ancestors[index].freezeId !== ancestorSpecs[index].freezeId) {
        throw new Error(`[GUARD-ALIAS-V29.2] freeze ancestral inválido: ${ancestorSpecs[index].path}`);
    }
}
if (
    ancestors[1].parentFreezeId !== ancestors[0].freezeId
    || ancestors[2].parentFreezeId !== ancestors[1].freezeId
    || manifest.parentFreezeId !== ancestors[2].freezeId
    || manifest.parentManifestSha256 !== ancestorSpecs[2].sha256
) {
    throw new Error('[GUARD-ALIAS-V29.2] lineage V28 → V29 → V29.1 → V29.2 divergente.');
}

const expectedProtectedFiles = [...declaredParentOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
if (
    manifest.freezeId !== 'guard-alias-integration-v29-2-20260818'
    || manifest.status !== 'release_preparation_authorized_activation_locked'
    || manifest.publicationStatus !== 'release_train_authorized'
    || manifest.country !== 'EC'
    || manifest.baseV291Sha !== '0c2c23a3c1f3bb270e258822c185000f5cea2601'
    || manifest.operatorApproval?.status !== 'approved_in_thread'
    || manifest.operatorApproval?.approvedAt !== '2026-08-18T18:50:59Z'
    || manifest.operatorApproval?.scope !== 'implement_guard_alias_successor_without_deploy'
    || manifest.operatorPublicationApproval?.status !== 'approved_in_thread'
    || manifest.operatorPublicationApproval?.approvedAt !== '2026-08-18T21:24:36Z'
    || manifest.operatorPublicationApproval?.scope !== 'commit_push_pr_ci_backup_tag_and_staging_without_activation'
    || manifest.operatorActivationApproval?.status !== 'required_explicit'
    || manifest.policy?.ancestorFreezesPreserved !== true
    || manifest.policy?.guardAliasesUseLatestSuccessor !== true
    || manifest.policy?.sourcePromotionAuthorized !== true
    || manifest.policy?.remoteStagingAuthorized !== true
    || manifest.policy?.directActivationBlocked !== true
    || manifest.policy?.flowChanged !== false
    || manifest.realEffects?.deploy !== false
    || manifest.realEffects?.activation !== false
    || JSON.stringify([...(manifest.declaredParentOverrides || [])].sort()) !== JSON.stringify(declaredParentOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[GUARD-ALIAS-V29.2] manifesto ou política inválida; startup bloqueado.');
}

for (let index = 0; index < ancestors.length; index += 1) {
    const laterOverrides = new Set(declaredParentOverrides);
    for (const later of ancestors.slice(index + 1)) {
        for (const relativePath of later.declaredParentOverrides || []) laterOverrides.add(relativePath);
    }
    for (const [relativePath, approvedHash] of Object.entries(ancestors[index].protectedFiles || {})) {
        if (laterOverrides.has(relativePath)) continue;
        if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[GUARD-ALIAS-V29.2] herança divergente em ${relativePath}.`);
        }
    }
}

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[GUARD-ALIAS-V29.2] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[GUARD-ALIAS-V29.2] lineage V28 → V29 → V29.1 → V29.2 verificada; staging autorizado e ativação bloqueada.');
