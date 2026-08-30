import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_RUNTIME_SUCCESSOR_V93_PARENT_COMMIT = '929062a04c7e2488eed89b570c562a424e620f05';
export const EC_RUNTIME_SUCCESSOR_V93_PARENT_TREE = 'fc6389b11bfb4bc7838f682729eb714902c73108';
export const EC_RUNTIME_SUCCESSOR_V93_PARENT_MANIFEST_SHA256 = '41a26a0d5c9e878f5f5db76ee1b4c30a64c7e409eed3614e598f666fb267dade';
export const EC_RUNTIME_SUCCESSOR_V93_PARENT_FREEZE_SHA256 = '0da5225d3e146f94d1879fcccb92d20413ef803bd850e13a020a38ef56a910ed';
export const EC_RUNTIME_SUCCESSOR_V93_PARENT_ATTESTATION_SHA256 = '571b8d697da349ccc495e55e26e7f12d51cabfe64df5c868ef6ac53232262579';
export const EC_RUNTIME_SUCCESSOR_V93_MANIFEST_PATH = 'docs/freeze/ec-runtime-successor-v93-20260830.json';
export const EC_RUNTIME_SUCCESSOR_V93_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
export const EC_RUNTIME_SUCCESSOR_V93_NODE_OPTIONS = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v93-context.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedAncestorProtectedFiles = Object.freeze([
    'ops/vitalismen-stage',
    'scripts/lib/pm2-target-env-restart-v89.mjs',
    'scripts/run-deploy-guard-ancestry-predeploy-v91.mjs',
    'src/services/deployGuardAncestryV91Service.js',
    'src/services/ecBotCoreOperationalV78Service.js',
    'src/services/ecVslDashboardIngressV90Service.js',
    'src/services/officialAuditSuccessorV92Service.js',
    'tests/ec-bot-core-control-plane-v89.test.mjs'
]);
const newProtectedFiles = Object.freeze([
    'docs/EC_RUNTIME_SUCCESSOR_FREEZE_V93_20260830.md',
    'docs/evidence/ec-runtime-successor-v93-attestation-20260830.json',
    'scripts/guard-ec-runtime-successor-v93.mjs',
    'scripts/lib/ec-runtime-successor-v93-context.mjs',
    'src/services/ecRuntimeSuccessorFreezeRuntimeGuardV93.js',
    'src/services/ecRuntimeSuccessorV93Service.js',
    'tests/ec-runtime-successor-v93.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-RUNTIME-SUCCESSOR-V93] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-RUNTIME-SUCCESSOR-V93] protected_path_outside_root');
    }
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-RUNTIME-SUCCESSOR-V93] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-RUNTIME-SUCCESSOR-V93] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV92 = () => {
    const identities = new Map([
        ['docs/freeze/official-audit-successor-v92-20260830.json', EC_RUNTIME_SUCCESSOR_V93_PARENT_MANIFEST_SHA256],
        ['docs/OFFICIAL_AUDIT_SUCCESSOR_FREEZE_V92_20260830.md', EC_RUNTIME_SUCCESSOR_V93_PARENT_FREEZE_SHA256],
        ['docs/evidence/official-audit-successor-v92-attestation-20260830.json', EC_RUNTIME_SUCCESSOR_V93_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-RUNTIME-SUCCESSOR-V93] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/official-audit-successor-v92-20260830.json', 'parent_manifest');
    if (parent.version !== 92 || parent.purpose !== 'FORWARD_SCOPED_SUCCESSOR_CONTEXT_TO_OFFICIAL_AUDIT_CHILD'
        || parent.policy?.officialAuditReadOnly !== true
        || parent.policy?.externalVslFilesChanged !== false
        || parent.policy?.pixelDatasetChanged !== false
        || parent.policy?.databaseChanged !== false) {
        throw new Error('[EC-RUNTIME-SUCCESSOR-V93] parent_policy_invalid');
    }
    const modified = new Set(modifiedAncestorProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-RUNTIME-SUCCESSOR-V93] parent_protected_file_invalid:${relativePath}`);
        }
    }
    return parent;
};

export const evaluateEcRuntimeSuccessorV93 = () => {
    const failures = [];
    const helper = readText('ops/vitalismen-stage');
    const pm2Restart = readText('scripts/lib/pm2-target-env-restart-v89.mjs');
    const predeploy = readText('scripts/run-deploy-guard-ancestry-predeploy-v91.mjs');
    const v91Service = readText('src/services/deployGuardAncestryV91Service.js');
    const operational = readText('src/services/ecBotCoreOperationalV78Service.js');
    const v90Service = readText('src/services/ecVslDashboardIngressV90Service.js');
    const v92Service = readText('src/services/officialAuditSuccessorV92Service.js');
    const successorOverrides = new Set(globalThis[EC_RUNTIME_SUCCESSOR_V93_OVERRIDE_KEY] || []);
    if (!successorOverrides.has('ops/vitalismen-stage')
        && !helper.includes('scripts/lib/ec-runtime-successor-v93-context.mjs')) failures.push('helper_v93_context_missing');
    if (!helper.includes('pm2_controller_env=(NODE_OPTIONS= npm_config_node_options= NPM_CONFIG_NODE_OPTIONS=)')) {
        failures.push('pm2_controller_clean_env_missing');
    }
    if (!helper.includes('scripts/lib/pm2-target-env-restart-v89.mjs')) failures.push('safe_programmatic_restart_missing');
    if (!successorOverrides.has('scripts/lib/pm2-target-env-restart-v89.mjs')
        && !pm2Restart.includes(EC_RUNTIME_SUCCESSOR_V93_NODE_OPTIONS)) failures.push('pm2_target_context_missing');
    if (!successorOverrides.has('src/services/ecBotCoreOperationalV78Service.js')
        && !operational.includes(EC_RUNTIME_SUCCESSOR_V93_NODE_OPTIONS)) failures.push('operational_target_context_missing');
    if (!successorOverrides.has('scripts/run-deploy-guard-ancestry-predeploy-v91.mjs')
        && !predeploy.includes("ec-runtime-successor-v93-context.mjs")) failures.push('predeploy_v93_context_missing');
    if (!v91Service.includes('if (successorOverrides.has(relativePath)) continue;')) {
        failures.push('v91_parent_successor_hash_policy_missing');
    }
    if (!v90Service.includes('modified.has(relativePath) || successorOverrides.has(relativePath)')) {
        failures.push('v90_parent_successor_hash_policy_missing');
    }
    if (!v92Service.includes('if (successorOverrides.has(relativePath)) continue;')) {
        failures.push('v92_successor_hash_policy_missing');
    }
    return Object.freeze({
        ok: failures.length === 0,
        ready: failures.length === 0,
        failures: Object.freeze(failures),
        pm2TargetContextBound: failures.length === 0
    });
};

export const assertEcRuntimeSuccessorManifestV93 = () => {
    assertParentV92();
    const manifest = readCanonicalJson(EC_RUNTIME_SUCCESSOR_V93_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'ec-runtime-successor-v93'
        || manifest.version !== 93 || manifest.parentVersion !== 'V92'
        || manifest.parentCommit !== EC_RUNTIME_SUCCESSOR_V93_PARENT_COMMIT
        || manifest.parentTree !== EC_RUNTIME_SUCCESSOR_V93_PARENT_TREE
        || manifest.purpose !== 'BIND_SUCCESSOR_CONTEXT_TO_SAFE_AND_OPERATIONAL_PM2_BOOT'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || manifest.policy?.pm2TargetOnly !== true
        || manifest.policy?.externalVslFilesChanged !== false
        || manifest.policy?.desktopPageChanged !== false
        || manifest.policy?.mobilePageChanged !== false
        || manifest.policy?.pixelDatasetChanged !== false
        || manifest.policy?.ctaChanged !== false
        || manifest.policy?.databaseChanged !== false
        || manifest.policy?.otherCountryTouched !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) {
        throw new Error('[EC-RUNTIME-SUCCESSOR-V93] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalHash) {
        throw new Error('[EC-RUNTIME-SUCCESSOR-V93] logical_bundle_invalid');
    }
    const successorOverrides = new Set(globalThis[EC_RUNTIME_SUCCESSOR_V93_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (successorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-RUNTIME-SUCCESSOR-V93] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(EC_RUNTIME_SUCCESSOR_V93_MANIFEST_PATH) });
};

export const assertEcRuntimeSuccessorV93 = () => {
    const identity = assertEcRuntimeSuccessorManifestV93();
    const result = evaluateEcRuntimeSuccessorV93();
    if (!result.ok) throw new Error(`[EC-RUNTIME-SUCCESSOR-V93] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const ecRuntimeSuccessorV93Files = Object.freeze({
    modifiedAncestorProtectedFiles,
    newProtectedFiles
});
