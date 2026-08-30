import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_COMMIT = '92b710e460b3ff3631be856161bd0e307e124981';
export const OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_TREE = '965f53a1fd6e5872445086f186a169eeafd84b28';
export const OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_MANIFEST_SHA256 = '02320abe17c70b64681ad04abe97a67d0db196c8ee211a95b1cb06ed98b76448';
export const OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_FREEZE_SHA256 = 'f1cd4f73562fd0e432e1bbe4fcc08bc4ba6164acdad8eee90cafcdd09639605c';
export const OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_ATTESTATION_SHA256 = '337e9105f45a24e348df152a3d0cdd21e0f0f06a9f403858a01d5e4e0fb3d37f';
export const OFFICIAL_AUDIT_SUCCESSOR_V92_MANIFEST_PATH = 'docs/freeze/official-audit-successor-v92-20260830.json';
export const OFFICIAL_AUDIT_SUCCESSOR_V92_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedAncestorProtectedFiles = Object.freeze([
    'ops/vitalismen-stage',
    'package.json',
    'scripts/official-state-audit.mjs',
    'scripts/run-deploy-guard-ancestry-predeploy-v91.mjs',
    'scripts/senior-guard.mjs',
    'src/services/deployGuardAncestryV91Service.js'
]);
const newProtectedFiles = Object.freeze([
    'docs/OFFICIAL_AUDIT_SUCCESSOR_FREEZE_V92_20260830.md',
    'docs/evidence/official-audit-successor-v92-attestation-20260830.json',
    'scripts/guard-official-audit-successor-v92.mjs',
    'scripts/lib/official-audit-successor-v92-context.mjs',
    'src/services/officialAuditSuccessorFreezeRuntimeGuardV92.js',
    'src/services/officialAuditSuccessorV92Service.js',
    'tests/official-audit-successor-v92.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[OFFICIAL-AUDIT-SUCCESSOR-V92] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[OFFICIAL-AUDIT-SUCCESSOR-V92] protected_path_outside_root');
    }
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[OFFICIAL-AUDIT-SUCCESSOR-V92] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[OFFICIAL-AUDIT-SUCCESSOR-V92] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV91 = () => {
    const identities = new Map([
        ['docs/freeze/deploy-guard-ancestry-successor-v91-20260830.json', OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_MANIFEST_SHA256],
        ['docs/DEPLOY_GUARD_ANCESTRY_SUCCESSOR_FREEZE_V91_20260830.md', OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_FREEZE_SHA256],
        ['docs/evidence/deploy-guard-ancestry-v91-attestation-20260830.json', OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[OFFICIAL-AUDIT-SUCCESSOR-V92] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/deploy-guard-ancestry-successor-v91-20260830.json', 'parent_manifest');
    if (parent.version !== 91 || parent.purpose !== 'SCOPED_SUCCESSOR_CONTEXT_FOR_ANCESTRAL_DEPLOY_GUARDS'
        || parent.policy?.guardSubprocessOnly !== true
        || parent.policy?.externalVslFilesChanged !== false
        || parent.policy?.pixelDatasetChanged !== false
        || parent.policy?.databaseChanged !== false) {
        throw new Error('[OFFICIAL-AUDIT-SUCCESSOR-V92] parent_policy_invalid');
    }
    const modified = new Set(modifiedAncestorProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[OFFICIAL-AUDIT-SUCCESSOR-V92] parent_protected_file_invalid:${relativePath}`);
        }
    }
    return parent;
};

export const evaluateOfficialAuditSuccessorV92 = () => {
    const failures = [];
    const helper = readText('ops/vitalismen-stage');
    const packageJson = JSON.parse(readText('package.json'));
    const audit = readText('scripts/official-state-audit.mjs');
    const runner = readText('scripts/run-deploy-guard-ancestry-predeploy-v91.mjs');
    const seniorGuard = readText('scripts/senior-guard.mjs');
    const v91Service = readText('src/services/deployGuardAncestryV91Service.js');
    if (!helper.includes('scripts/lib/official-audit-successor-v92-context.mjs')) failures.push('v92_helper_context_missing');
    if (/guard:canary-controller-(?:pm2-stdin-v77h|health-policy-v77h2)/.test(packageJson.scripts?.['senior:check'] || '')) {
        failures.push('obsolete_static_canary_guards_in_senior_check');
    }
    if (!helper.includes('VITALISMEN_OFFICIAL_AUDIT_NODE_OPTIONS="$release_guard_node_options"')) {
        failures.push('official_audit_context_forwarding_missing');
    }
    if (!audit.includes('childEnv.VITALISMEN_OFFICIAL_AUDIT_NODE_OPTIONS')) failures.push('audit_child_context_read_missing');
    if (!audit.includes('childEnv.NODE_OPTIONS = successorNodeOptions')) failures.push('audit_child_node_options_missing');
    if (!audit.includes('delete childEnv.VITALISMEN_OFFICIAL_AUDIT_NODE_OPTIONS')) failures.push('audit_private_env_cleanup_missing');
    if (!runner.includes("official-audit-successor-v92-context.mjs")) failures.push('predeploy_v92_context_missing');
    if (!seniorGuard.includes("'src/services/ecVslDashboardIngressV90Service.js'")) {
        failures.push('v90_product_scoped_allowlist_missing');
    }
    if (!seniorGuard.includes("'docs/DEPLOY_GUARD_ANCESTRY_SUCCESSOR_FREEZE_V91_20260830.md'")) {
        failures.push('v91_readonly_context_allowlist_missing');
    }
    if (!v91Service.includes('if (successorOverrides.has(relativePath)) continue;')) {
        failures.push('v91_successor_hash_policy_missing');
    }
    return Object.freeze({
        ok: failures.length === 0,
        ready: failures.length === 0,
        failures: Object.freeze(failures),
        officialAuditChildContextBound: failures.length === 0
    });
};

export const assertOfficialAuditSuccessorManifestV92 = () => {
    assertParentV91();
    const manifest = readCanonicalJson(OFFICIAL_AUDIT_SUCCESSOR_V92_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'official-audit-successor-v92'
        || manifest.version !== 92 || manifest.parentVersion !== 'V91'
        || manifest.parentCommit !== OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_COMMIT
        || manifest.parentTree !== OFFICIAL_AUDIT_SUCCESSOR_V92_PARENT_TREE
        || manifest.purpose !== 'FORWARD_SCOPED_SUCCESSOR_CONTEXT_TO_OFFICIAL_AUDIT_CHILD'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || manifest.policy?.officialAuditReadOnly !== true
        || manifest.policy?.externalVslFilesChanged !== false
        || manifest.policy?.desktopPageChanged !== false
        || manifest.policy?.mobilePageChanged !== false
        || manifest.policy?.pixelDatasetChanged !== false
        || manifest.policy?.ctaChanged !== false
        || manifest.policy?.databaseChanged !== false
        || manifest.policy?.otherCountryTouched !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) {
        throw new Error('[OFFICIAL-AUDIT-SUCCESSOR-V92] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalHash) {
        throw new Error('[OFFICIAL-AUDIT-SUCCESSOR-V92] logical_bundle_invalid');
    }
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[OFFICIAL-AUDIT-SUCCESSOR-V92] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(OFFICIAL_AUDIT_SUCCESSOR_V92_MANIFEST_PATH) });
};

export const assertOfficialAuditSuccessorV92 = () => {
    const identity = assertOfficialAuditSuccessorManifestV92();
    const result = evaluateOfficialAuditSuccessorV92();
    if (!result.ok) throw new Error(`[OFFICIAL-AUDIT-SUCCESSOR-V92] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const officialAuditSuccessorV92Files = Object.freeze({
    modifiedAncestorProtectedFiles,
    newProtectedFiles
});
