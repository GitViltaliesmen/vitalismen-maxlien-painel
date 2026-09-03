import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEPLOY_GUARD_ANCESTRY_V91_PARENT_COMMIT = '66c7d9db10509643a914c92044dd954617870727';
export const DEPLOY_GUARD_ANCESTRY_V91_PARENT_TREE = '054517ac70bead118d8874bf94be7862672895cb';
export const DEPLOY_GUARD_ANCESTRY_V91_PARENT_MANIFEST_SHA256 = '321ac50d2bd28d8a0487b325bc6448741b4f7ef8eeb21497d30db0aef19d97f6';
export const DEPLOY_GUARD_ANCESTRY_V91_PARENT_FREEZE_SHA256 = '5e4cbfcc06c53e429ba8e96da31fdda398a44c90121c6ab3e5c7f48796535ff7';
export const DEPLOY_GUARD_ANCESTRY_V91_PARENT_ATTESTATION_SHA256 = '63e01b91ee92f8b0e5a6db0cfb05cca1869c2e0c251a47eedf09a93e4301e273';
export const DEPLOY_GUARD_ANCESTRY_V91_MANIFEST_PATH = 'docs/freeze/deploy-guard-ancestry-successor-v91-20260830.json';
export const DEPLOY_GUARD_ANCESTRY_V91_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedAncestorProtectedFiles = Object.freeze([
    'ops/vitalismen-stage',
    'package.json',
    'src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js'
]);
const newProtectedFiles = Object.freeze([
    'docs/DEPLOY_GUARD_ANCESTRY_SUCCESSOR_FREEZE_V91_20260830.md',
    'docs/evidence/deploy-guard-ancestry-v91-attestation-20260830.json',
    'scripts/guard-deploy-guard-ancestry-v91.mjs',
    'scripts/lib/deploy-guard-ancestry-v91-successor-context.mjs',
    'scripts/run-deploy-guard-ancestry-predeploy-v91.mjs',
    'src/services/deployGuardAncestryFreezeRuntimeGuardV91.js',
    'src/services/deployGuardAncestryV91Service.js',
    'tests/deploy-guard-ancestry-v91.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[DEPLOY-GUARD-ANCESTRY-V91] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[DEPLOY-GUARD-ANCESTRY-V91] protected_path_outside_root');
    }
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[DEPLOY-GUARD-ANCESTRY-V91] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[DEPLOY-GUARD-ANCESTRY-V91] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV90 = () => {
    const identities = new Map([
        ['docs/freeze/ec-vsl-dashboard-ingress-v90-20260830.json', DEPLOY_GUARD_ANCESTRY_V91_PARENT_MANIFEST_SHA256],
        ['docs/EC_VSL_DASHBOARD_INGRESS_FREEZE_V90_20260830.md', DEPLOY_GUARD_ANCESTRY_V91_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-vsl-dashboard-ingress-v90-attestation-20260830.json', DEPLOY_GUARD_ANCESTRY_V91_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[DEPLOY-GUARD-ANCESTRY-V91] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/ec-vsl-dashboard-ingress-v90-20260830.json', 'parent_manifest');
    if (parent.version !== 90 || parent.purpose !== 'EC_PROTOCOLO_G_DASHBOARD_INGRESS_WITHOUT_UNARMED_AUTOMATION'
        || parent.policy?.externalVslFilesChanged !== false
        || parent.policy?.mutatingSchedulersAllowed !== false
        || parent.policy?.dropiApplyAllowed !== false
        || parent.policy?.metaPurchaseAllowed !== false) {
        throw new Error('[DEPLOY-GUARD-ANCESTRY-V91] parent_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[DEPLOY_GUARD_ANCESTRY_V91_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (successorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[DEPLOY-GUARD-ANCESTRY-V91] parent_protected_file_invalid:${relativePath}`);
        }
    }
    return parent;
};

export const evaluateDeployGuardAncestryV91 = () => {
    const failures = [];
    const helper = readText('ops/vitalismen-stage');
    const successorOverrides = new Set(globalThis[DEPLOY_GUARD_ANCESTRY_V91_OVERRIDE_KEY] || []);
    const helperHasSuccessor = successorOverrides.has('ops/vitalismen-stage');
    const contextPath = 'scripts/lib/deploy-guard-ancestry-v91-successor-context.mjs';
    if (!helper.includes('successor_guard_node_options()')) failures.push('scoped_preload_builder_missing');
    if (!helperHasSuccessor) {
        if (!helper.includes(`$candidate_dir/${contextPath}`)) failures.push('candidate_context_path_missing');
        if (!helper.includes('npm_config_node_options="$release_guard_node_options"')) {
            failures.push('release_guard_context_missing');
        }
        if (!helper.includes('npm_config_node_options="$candidate_guard_node_options"')) {
            failures.push('published_candidate_guard_context_missing');
        }
    }
    const packageJson = JSON.parse(readText('package.json'));
    if (packageJson.scripts?.['guard:predeploy-v71'] !== 'node scripts/run-deploy-guard-ancestry-predeploy-v91.mjs') {
        failures.push('successor_predeploy_entry_missing');
    }
    const v77h2Guard = readText('src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js');
    if (!v77h2Guard.includes("!successorOverrides.has('ops/vitalismen-stage')")) {
        failures.push('v77h2_scoped_successor_exception_missing');
    }
    if (helper.includes('NODE_OPTIONS="--import=./scripts/lib/ec-bot-core-readiness-v79-successor-context.mjs"')) {
        failures.push('relative_ancestral_preload_reintroduced');
    }
    return Object.freeze({
        ok: failures.length === 0,
        ready: failures.length === 0,
        failures: Object.freeze(failures),
        helperChangedOnlyForGuardContext: failures.length === 0
    });
};

export const assertDeployGuardAncestryManifestV91 = () => {
    assertParentV90();
    const manifest = readCanonicalJson(DEPLOY_GUARD_ANCESTRY_V91_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'deploy-guard-ancestry-successor-v91'
        || manifest.version !== 91 || manifest.parentVersion !== 'V90'
        || manifest.parentCommit !== DEPLOY_GUARD_ANCESTRY_V91_PARENT_COMMIT
        || manifest.parentTree !== DEPLOY_GUARD_ANCESTRY_V91_PARENT_TREE
        || manifest.purpose !== 'SCOPED_SUCCESSOR_CONTEXT_FOR_ANCESTRAL_DEPLOY_GUARDS'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || manifest.policy?.externalVslFilesChanged !== false
        || manifest.policy?.desktopPageChanged !== false
        || manifest.policy?.mobilePageChanged !== false
        || manifest.policy?.pixelDatasetChanged !== false
        || manifest.policy?.ctaChanged !== false
        || manifest.policy?.databaseChanged !== false
        || manifest.policy?.colombiaTouched !== false
        || manifest.policy?.guardSubprocessOnly !== true
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) {
        throw new Error('[DEPLOY-GUARD-ANCESTRY-V91] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalHash) {
        throw new Error('[DEPLOY-GUARD-ANCESTRY-V91] logical_bundle_invalid');
    }
    const successorOverrides = new Set(globalThis[DEPLOY_GUARD_ANCESTRY_V91_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (successorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[DEPLOY-GUARD-ANCESTRY-V91] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(DEPLOY_GUARD_ANCESTRY_V91_MANIFEST_PATH) });
};

export const assertDeployGuardAncestryV91 = () => {
    const identity = assertDeployGuardAncestryManifestV91();
    const result = evaluateDeployGuardAncestryV91();
    if (!result.ok) throw new Error(`[DEPLOY-GUARD-ANCESTRY-V91] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const deployGuardAncestryV91Files = Object.freeze({
    modifiedAncestorProtectedFiles,
    newProtectedFiles
});
