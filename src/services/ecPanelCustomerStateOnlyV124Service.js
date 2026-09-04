import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_PANEL_CUSTOMER_STATE_ONLY_V124_VERSION = 124;
export const EC_PANEL_CUSTOMER_STATE_ONLY_V124_MANIFEST_PATH = 'docs/freeze/ec-panel-customer-state-only-v124-20260904.json';
export const EC_PANEL_CUSTOMER_STATE_ONLY_V124_PARENT_COMMIT = 'bc0164b9628a62d05e7a066ac2b1c5974e0181ef';
export const EC_PANEL_CUSTOMER_STATE_ONLY_V124_PARENT_TREE = '4c87550546aef88d2b33a09d739f0ce9094b1873';
export const EC_PANEL_CUSTOMER_STATE_ONLY_V124_PARENT_MANIFEST_SHA256 = '4794ae09a6c4b6ad4f65170e858a06f6243bb17c8d59d6f7b9144aa409d59563';
export const EC_PANEL_CUSTOMER_STATE_ONLY_V124_FREEZE_SHA256 = 'e9aa5564f1838c269b850aae307e0a34fb8e6f80acac13d35d7077dc9230683a';
export const EC_PANEL_CUSTOMER_STATE_ONLY_V124_ATTESTATION_SHA256 = '4ad3e9c3241a3aa6aef6aefcdeeb8a7850b310fa24eb424723559bfac7eeb5c5';
export const EC_PANEL_CUSTOMER_STATE_ONLY_V124_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const EC_PANEL_CUSTOMER_STATE_ONLY_V124_ANCESTOR_OVERRIDES = Object.freeze([
    '.github/workflows/ec-panel-quality.yml',
    'public/qr.html',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/services/ecPanelCustomerStatusPersistenceV123Service.js'
]);

export const EC_PANEL_CUSTOMER_STATE_ONLY_V124_NEW_PROTECTED_FILES = Object.freeze([
    'docs/EC_PANEL_CUSTOMER_STATE_ONLY_FREEZE_V124_20260904.md',
    'docs/evidence/ec-panel-customer-state-only-v124-attestation-20260904.json',
    'scripts/guard-ec-panel-customer-state-only-v124.mjs',
    'src/services/ecPanelCustomerStateOnlyFreezeRuntimeGuardV124.js',
    'src/services/ecPanelCustomerStateOnlyV124Service.js',
    'tests/ec-panel-customer-state-only-v124.test.mjs'
]);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-PANEL-STATE-ONLY-V124] protected_path_invalid');
    }
    const candidate = path.resolve(projectRoot, relativePath);
    if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${path.sep}`)) {
        throw new Error('[EC-PANEL-STATE-ONLY-V124] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-PANEL-STATE-ONLY-V124] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-PANEL-STATE-ONLY-V124] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV123 = () => {
    if (fileSha256('docs/freeze/ec-panel-customer-status-persistence-v123-20260904.json')
        !== EC_PANEL_CUSTOMER_STATE_ONLY_V124_PARENT_MANIFEST_SHA256) {
        throw new Error('[EC-PANEL-STATE-ONLY-V124] parent_manifest_identity_invalid');
    }
    const parent = canonicalJson('docs/freeze/ec-panel-customer-status-persistence-v123-20260904.json', 'parent_manifest');
    if (parent.version !== 123 || parent.freezeId !== 'ec-panel-customer-status-persistence-v123'
        || parent.policy?.customerStateSavedFirst !== true
        || parent.policy?.orderSyncFailureCanRollbackCustomerState !== false
        || parent.policy?.genericOrderRoutesAllowed !== false
        || parent.policy?.whatsappOutboundChanged !== false
        || parent.policy?.dropiChanged !== false
        || parent.policy?.postSaleChanged !== false
        || parent.policy?.metaChanged !== false) {
        throw new Error('[EC-PANEL-STATE-ONLY-V124] parent_policy_invalid');
    }
    const modified = new Set(EC_PANEL_CUSTOMER_STATE_ONLY_V124_ANCESTOR_OVERRIDES);
    const successorOverrides = new Set(globalThis[EC_PANEL_CUSTOMER_STATE_ONLY_V124_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath) || successorOverrides.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[EC-PANEL-STATE-ONLY-V124] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertEcPanelCustomerStateOnlyV124Manifest = () => {
    assertParentV123();
    const manifest = canonicalJson(EC_PANEL_CUSTOMER_STATE_ONLY_V124_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-panel-customer-state-only-v124'
        || manifest.version !== EC_PANEL_CUSTOMER_STATE_ONLY_V124_VERSION
        || manifest.parentVersion !== 'V123_PRODUCTION_BASELINE'
        || manifest.parentCommit !== EC_PANEL_CUSTOMER_STATE_ONLY_V124_PARENT_COMMIT
        || manifest.parentTree !== EC_PANEL_CUSTOMER_STATE_ONLY_V124_PARENT_TREE
        || manifest.parentManifestSha256 !== EC_PANEL_CUSTOMER_STATE_ONLY_V124_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'SEPARATE_CUSTOMER_SAVE_FROM_EXPLICIT_ORDER_ACTIONS'
        || JSON.stringify(overrides) !== JSON.stringify(EC_PANEL_CUSTOMER_STATE_ONLY_V124_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(EC_PANEL_CUSTOMER_STATE_ONLY_V124_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.ordinaryCustomerSaveStateOnly !== true
        || manifest.policy?.explicitOrderActionRequired !== true
        || manifest.policy?.genericOrderRoutesAllowed !== false
        || manifest.policy?.whatsappOutboundChanged !== false
        || manifest.policy?.dropiChanged !== false
        || manifest.policy?.postSaleChanged !== false
        || manifest.policy?.metaChanged !== false
        || manifest.evidence?.sha256 !== EC_PANEL_CUSTOMER_STATE_ONLY_V124_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/EC_PANEL_CUSTOMER_STATE_ONLY_FREEZE_V124_20260904.md') !== EC_PANEL_CUSTOMER_STATE_ONLY_V124_FREEZE_SHA256) {
        throw new Error('[EC-PANEL-STATE-ONLY-V124] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[EC_PANEL_CUSTOMER_STATE_ONLY_V124_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[EC-PANEL-STATE-ONLY-V124] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[EC-PANEL-STATE-ONLY-V124] logical_bundle_invalid');
    }
    return Object.freeze({ ready: true, failures: [], manifest, overrides });
};
