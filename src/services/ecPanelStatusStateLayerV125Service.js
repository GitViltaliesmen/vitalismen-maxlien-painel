import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_PANEL_STATUS_STATE_LAYER_V125_VERSION = 125;
export const EC_PANEL_STATUS_STATE_LAYER_V125_MANIFEST_PATH = 'docs/freeze/ec-panel-status-state-layer-v125-20260904.json';
export const EC_PANEL_STATUS_STATE_LAYER_V125_PARENT_COMMIT = '264e9715a33c89e81e40f998dc69647bbaee072e';
export const EC_PANEL_STATUS_STATE_LAYER_V125_PARENT_TREE = '568588fc92c19227c3962578d9059eebdb259521';
export const EC_PANEL_STATUS_STATE_LAYER_V125_PARENT_MANIFEST_SHA256 = '54ddabf105a37641457c0f8e74e3ba6f716220d2c7787d25f5ea03cbf0bb756a';
export const EC_PANEL_STATUS_STATE_LAYER_V125_FREEZE_SHA256 = '7499d2e166933d127cfd820c537b2ab5921b92a7b0e09668000a97225bb34267';
export const EC_PANEL_STATUS_STATE_LAYER_V125_ATTESTATION_SHA256 = '9c6b99d324ac212d615639df3a8fb368aab9299743920df321fe779aaf4b3da8';
export const EC_PANEL_STATUS_STATE_LAYER_V125_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const EC_PANEL_STATUS_STATE_LAYER_V125_ANCESTOR_OVERRIDES = Object.freeze([
    '.github/workflows/ec-panel-quality.yml',
    'public/qr.html',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/routes/whatsapp.js',
    'src/services/ecPanelCustomerStateOnlyV124Service.js',
    'tests/ec-panel-customer-status-persistence-v123.test.mjs'
]);

export const EC_PANEL_STATUS_STATE_LAYER_V125_NEW_PROTECTED_FILES = Object.freeze([
    'docs/EC_PANEL_STATUS_STATE_LAYER_FREEZE_V125_20260904.md',
    'docs/evidence/ec-panel-status-state-layer-v125-attestation-20260904.json',
    'scripts/guard-ec-panel-status-state-layer-v125.mjs',
    'src/services/ecPanelStatusStateLayerFreezeRuntimeGuardV125.js',
    'src/services/ecPanelStatusStateLayerV125Service.js',
    'tests/ec-panel-status-state-layer-v125.test.mjs'
]);

export const customerStateResponseV125 = ({
    state,
    unifiedSync,
    operationalOrderSync,
    customerDataBlockedResponse = null
} = {}) => ({
    success: true,
    state,
    unifiedSync,
    operationalOrderSync,
    ...(customerDataBlockedResponse ? {
        customerStateSaved: true,
        orderBlocked: true,
        warning: customerDataBlockedResponse.error || 'customer_data_not_ready',
        message: 'Status e ficha salvos. O pedido continua bloqueado ate completar os dados obrigatorios.',
        customerDataResolution: customerDataBlockedResponse.customerDataResolution || null,
        customerDraft: customerDataBlockedResponse.customerDraft || null
    } : {})
});

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-PANEL-STATUS-STATE-V125] protected_path_invalid');
    }
    const candidate = path.resolve(projectRoot, relativePath);
    if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${path.sep}`)) {
        throw new Error('[EC-PANEL-STATUS-STATE-V125] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-PANEL-STATUS-STATE-V125] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-PANEL-STATUS-STATE-V125] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV124 = () => {
    if (fileSha256('docs/freeze/ec-panel-customer-state-only-v124-20260904.json')
        !== EC_PANEL_STATUS_STATE_LAYER_V125_PARENT_MANIFEST_SHA256) {
        throw new Error('[EC-PANEL-STATUS-STATE-V125] parent_manifest_identity_invalid');
    }
    const parent = canonicalJson('docs/freeze/ec-panel-customer-state-only-v124-20260904.json', 'parent_manifest');
    if (parent.version !== 124 || parent.freezeId !== 'ec-panel-customer-state-only-v124'
        || parent.policy?.ordinaryCustomerSaveStateOnly !== true
        || parent.policy?.explicitOrderActionRequired !== true
        || parent.policy?.genericOrderRoutesAllowed !== false
        || parent.policy?.whatsappOutboundChanged !== false
        || parent.policy?.dropiChanged !== false
        || parent.policy?.postSaleChanged !== false
        || parent.policy?.metaChanged !== false) {
        throw new Error('[EC-PANEL-STATUS-STATE-V125] parent_policy_invalid');
    }
    const modified = new Set(EC_PANEL_STATUS_STATE_LAYER_V125_ANCESTOR_OVERRIDES);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[EC-PANEL-STATUS-STATE-V125] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertEcPanelStatusStateLayerV125Manifest = () => {
    assertParentV124();
    const manifest = canonicalJson(EC_PANEL_STATUS_STATE_LAYER_V125_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-panel-status-state-layer-v125'
        || manifest.version !== EC_PANEL_STATUS_STATE_LAYER_V125_VERSION
        || manifest.parentVersion !== 'V124_PRODUCTION_BASELINE'
        || manifest.parentCommit !== EC_PANEL_STATUS_STATE_LAYER_V125_PARENT_COMMIT
        || manifest.parentTree !== EC_PANEL_STATUS_STATE_LAYER_V125_PARENT_TREE
        || manifest.parentManifestSha256 !== EC_PANEL_STATUS_STATE_LAYER_V125_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'PERSIST_OPERATOR_STATUS_WHILE_BLOCKING_INCOMPLETE_ORDER'
        || JSON.stringify(overrides) !== JSON.stringify(EC_PANEL_STATUS_STATE_LAYER_V125_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(EC_PANEL_STATUS_STATE_LAYER_V125_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.operatorStatusAlwaysPersists !== true
        || manifest.policy?.incompleteOrderRemainsBlocked !== true
        || manifest.policy?.genericOrderRoutesAllowed !== false
        || manifest.policy?.whatsappOutboundChanged !== false
        || manifest.policy?.dropiChanged !== false
        || manifest.policy?.postSaleChanged !== false
        || manifest.policy?.metaChanged !== false
        || manifest.evidence?.sha256 !== EC_PANEL_STATUS_STATE_LAYER_V125_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/EC_PANEL_STATUS_STATE_LAYER_FREEZE_V125_20260904.md') !== EC_PANEL_STATUS_STATE_LAYER_V125_FREEZE_SHA256) {
        throw new Error('[EC-PANEL-STATUS-STATE-V125] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[EC_PANEL_STATUS_STATE_LAYER_V125_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[EC-PANEL-STATUS-STATE-V125] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[EC-PANEL-STATUS-STATE-V125] logical_bundle_invalid');
    }
    return Object.freeze({ ready: true, failures: [], manifest, overrides });
};
