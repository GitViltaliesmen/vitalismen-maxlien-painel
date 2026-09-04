import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_VERSION = 123;
export const EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_MODE = 'EC_PANEL_CUSTOMER_STATE_FIRST';
export const EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_MANIFEST_PATH = 'docs/freeze/ec-panel-customer-status-persistence-v123-20260904.json';
export const EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_PARENT_COMMIT = '09686b256302c983c0ae5fbb5f9afe2bb221b9f0';
export const EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_PARENT_TREE = '6baead7050580d21d4279729f939274584640ce4';
export const EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_PARENT_MANIFEST_SHA256 = 'a44082908f945c70c26e5781cc407fe3b1bd3c3a47410fd82b6205dba8433ab1';
export const EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_FREEZE_SHA256 = '8205e61921f90a645247e033f0b82ef6f9fb24f5b1ced55d6aede905558bb77a';
export const EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_ATTESTATION_SHA256 = '29ab49f6753fd9d84197cc7dd92ab3167103aae011dafeb8cd93b6ee6fe7a394';
export const EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_ANCESTOR_OVERRIDES = Object.freeze([
    '.github/workflows/ec-panel-quality.yml',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/routes/whatsapp.js',
    'src/services/ecPanelCustomerPersistenceV122Service.js'
]);

export const EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_NEW_PROTECTED_FILES = Object.freeze([
    'docs/EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_FREEZE_V123_20260904.md',
    'docs/evidence/ec-panel-customer-status-persistence-v123-attestation-20260904.json',
    'scripts/guard-ec-panel-customer-status-persistence-v123.mjs',
    'src/services/ecPanelCustomerStatusPersistenceFreezeRuntimeGuardV123.js',
    'src/services/ecPanelCustomerStatusPersistenceV123Service.js',
    'tests/ec-panel-customer-status-persistence-v123.test.mjs'
]);

const clean = (value = '') => String(value ?? '').trim();

export const customerStateSavedOrderSyncFailureV123 = (error = null) => {
    const code = clean(error?.code || error?.statusCode);
    const message = clean(error?.message);
    const operationBlocked = code === 'EC_BOT_CORE_V78_OPERATION_BLOCKED'
        || /^ec_bot_core_mongo_write_blocked:orders\./.test(message);
    return Object.freeze({
        ok: false,
        skipped: operationBlocked,
        failed: !operationBlocked,
        customerStateSaved: true,
        reason: operationBlocked
            ? 'customer_state_saved_order_sync_not_authorized'
            : 'customer_state_saved_order_sync_failed',
        errorCode: operationBlocked ? 'EC_BOT_CORE_V78_OPERATION_BLOCKED' : (code || 'ORDER_SYNC_FAILED')
    });
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-PANEL-STATUS-V123] protected_path_invalid');
    }
    const candidate = path.resolve(projectRoot, relativePath);
    if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${path.sep}`)) {
        throw new Error('[EC-PANEL-STATUS-V123] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-PANEL-STATUS-V123] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-PANEL-STATUS-V123] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV122 = () => {
    if (fileSha256('docs/freeze/ec-panel-customer-persistence-v122-20260904.json')
        !== EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_PARENT_MANIFEST_SHA256) {
        throw new Error('[EC-PANEL-STATUS-V123] parent_manifest_identity_invalid');
    }
    const parent = canonicalJson('docs/freeze/ec-panel-customer-persistence-v122-20260904.json', 'parent_manifest');
    if (parent.version !== 122 || parent.freezeId !== 'ec-panel-customer-persistence-v122'
        || parent.policy?.panelAuthRequired !== true
        || parent.policy?.customerStateCollectionOnly !== true
        || parent.policy?.genericOrderRoutesAllowed !== false
        || parent.policy?.whatsappOutboundChanged !== false
        || parent.policy?.dropiChanged !== false
        || parent.policy?.postSaleChanged !== false
        || parent.policy?.metaChanged !== false) {
        throw new Error('[EC-PANEL-STATUS-V123] parent_policy_invalid');
    }
    const modified = new Set(EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_ANCESTOR_OVERRIDES);
    const successorOverrides = new Set(globalThis[EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath) || successorOverrides.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[EC-PANEL-STATUS-V123] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertEcPanelCustomerStatusPersistenceV123Manifest = () => {
    assertParentV122();
    const manifest = canonicalJson(EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-panel-customer-status-persistence-v123'
        || manifest.version !== EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_VERSION
        || manifest.parentVersion !== 'V122_PRODUCTION_BASELINE'
        || manifest.parentCommit !== EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_PARENT_COMMIT
        || manifest.parentTree !== EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_PARENT_TREE
        || manifest.parentManifestSha256 !== EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'PERSIST_CUSTOMER_STATE_BEFORE_OPTIONAL_ORDER_SYNC'
        || JSON.stringify(overrides) !== JSON.stringify(EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.customerStateSavedFirst !== true
        || manifest.policy?.orderSyncFailureCanRollbackCustomerState !== false
        || manifest.policy?.allowedMongoCollections?.join(',') !== 'contactstates'
        || manifest.policy?.genericOrderRoutesAllowed !== false
        || manifest.policy?.whatsappOutboundChanged !== false
        || manifest.policy?.dropiChanged !== false
        || manifest.policy?.postSaleChanged !== false
        || manifest.policy?.metaChanged !== false
        || manifest.evidence?.sha256 !== EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_FREEZE_V123_20260904.md') !== EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_FREEZE_SHA256) {
        throw new Error('[EC-PANEL-STATUS-V123] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[EC-PANEL-STATUS-V123] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[EC-PANEL-STATUS-V123] logical_bundle_invalid');
    }
    return Object.freeze({
        ready: true,
        failures: [],
        manifest,
        overrides,
        manifestSha256: fileSha256(EC_PANEL_CUSTOMER_STATUS_PERSISTENCE_V123_MANIFEST_PATH)
    });
};
