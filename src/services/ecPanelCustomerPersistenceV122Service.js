import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_PANEL_CUSTOMER_PERSISTENCE_V122_VERSION = 122;
export const EC_PANEL_CUSTOMER_PERSISTENCE_V122_MODE = 'EC_PANEL_AUTHENTICATED_CUSTOMER_PERSISTENCE';
export const EC_PANEL_CUSTOMER_PERSISTENCE_V122_MANIFEST_PATH = 'docs/freeze/ec-panel-customer-persistence-v122-20260904.json';
export const EC_PANEL_CUSTOMER_PERSISTENCE_V122_PARENT_COMMIT = '434efbe0eff321ed2ad324da2b8ccc04b9b912e1';
export const EC_PANEL_CUSTOMER_PERSISTENCE_V122_PARENT_TREE = '614bb080f1b6696c625f0b92c137f89ab5b7e181';
export const EC_PANEL_CUSTOMER_PERSISTENCE_V122_PARENT_MANIFEST_SHA256 = 'd251dd93d470c6854066637484d13a0baddd7ad09dc082050568922ac1571edb';
export const EC_PANEL_CUSTOMER_PERSISTENCE_V122_FREEZE_SHA256 = 'bc0da3cce9ff45e89df4267204ff523b610c0c8278c7d46f45de03537d2b49b7';
export const EC_PANEL_CUSTOMER_PERSISTENCE_V122_ATTESTATION_SHA256 = '19b6b6b06985ac647ba0711f59511a04b7bc9271281050bd2e457df7e2892dfa';
export const EC_PANEL_CUSTOMER_PERSISTENCE_V122_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const EC_PANEL_CUSTOMER_PERSISTENCE_V122_ANCESTOR_OVERRIDES = Object.freeze([
    '.github/workflows/ec-panel-quality.yml',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/services/dropiTotalResolutionV121Service.js',
    'src/services/ecBotCoreRuntimeIntegrationV78Service.js'
]);

export const EC_PANEL_CUSTOMER_PERSISTENCE_V122_NEW_PROTECTED_FILES = Object.freeze([
    'docs/EC_PANEL_CUSTOMER_PERSISTENCE_FREEZE_V122_20260904.md',
    'docs/evidence/ec-panel-customer-persistence-v122-attestation-20260904.json',
    'scripts/guard-ec-panel-customer-persistence-v122.mjs',
    'src/services/ecPanelCustomerPersistenceFreezeRuntimeGuardV122.js',
    'src/services/ecPanelCustomerPersistenceV122Service.js',
    'tests/ec-panel-customer-persistence-v122.test.mjs'
]);

const clean = (value = '') => String(value ?? '').trim();
const isTrue = (value) => clean(value).toLowerCase() === 'true';
const normalizedPath = (value = '') => clean(value).split('?')[0].replace(/\/+$/, '') || '/';

export const ecPanelCustomerPersistenceV122Requested = (env = process.env) => (
    isTrue(env.VITALISMEN_EC_BOT_CORE_OPERATIONAL)
);

export const resolveEcPanelCustomerPersistenceV122Configuration = (env = process.env) => {
    const enabled = ecPanelCustomerPersistenceV122Requested(env);
    const failures = [];
    if (enabled && clean(env.PANEL_AUTH_DISABLED).toLowerCase() !== 'false') {
        failures.push('PANEL_AUTH_DISABLED_must_be_false');
    }
    return Object.freeze({
        enabled,
        ready: enabled && failures.length === 0,
        mode: enabled ? EC_PANEL_CUSTOMER_PERSISTENCE_V122_MODE : '',
        failures
    });
};

export const ecPanelCustomerPersistenceV122Operation = ({ method = '', path: route = '' } = {}) => {
    const normalizedMethod = clean(method).toUpperCase();
    const routePath = normalizedPath(route);
    if (
        normalizedMethod === 'POST'
        && /^\/api\/whatsapp\/contact-state\/[^/]+\/resolve-customer-data$/.test(routePath)
    ) return 'authenticated-customer-data-preview';
    if (
        normalizedMethod === 'PATCH'
        && /^\/api\/whatsapp\/contact-state\/[^/]+$/.test(routePath)
    ) return 'authenticated-customer-state-persist';
    return '';
};

export const ecPanelCustomerPersistenceV122RouteDecision = ({
    method = '',
    path: route = '',
    env = process.env
} = {}) => {
    const configuration = resolveEcPanelCustomerPersistenceV122Configuration(env);
    if (!configuration.enabled) {
        return Object.freeze({
            enforced: false,
            allowed: false,
            reason: 'ec_panel_customer_v122_not_requested',
            operation: ''
        });
    }
    if (!configuration.ready) {
        return Object.freeze({
            enforced: true,
            allowed: false,
            reason: 'ec_panel_customer_v122_invalid_fail_closed',
            operation: ''
        });
    }
    const operation = ecPanelCustomerPersistenceV122Operation({ method, path: route });
    return Object.freeze({
        enforced: true,
        allowed: Boolean(operation),
        reason: operation ? 'ec_panel_customer_v122_route_allowed' : 'ec_panel_customer_v122_route_blocked',
        operation
    });
};

export const ecPanelCustomerPersistenceV122MongoAllowed = ({
    method = '',
    path: route = '',
    collection = '',
    context = null,
    env = process.env
} = {}) => {
    const decision = ecPanelCustomerPersistenceV122RouteDecision({ method, path: route, env });
    return Boolean(
        decision.allowed
        && decision.operation === 'authenticated-customer-state-persist'
        && context?.panelCustomerPersistenceV122 === true
        && context?.panelCustomerPersistenceOperation === decision.operation
        && clean(collection).toLowerCase() === 'contactstates'
    );
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-PANEL-CUSTOMER-V122] protected_path_invalid');
    }
    const candidate = path.resolve(projectRoot, relativePath);
    if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${path.sep}`)) {
        throw new Error('[EC-PANEL-CUSTOMER-V122] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-PANEL-CUSTOMER-V122] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-PANEL-CUSTOMER-V122] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV121 = () => {
    if (fileSha256('docs/freeze/dropi-total-resolution-v121-20260904.json')
        !== EC_PANEL_CUSTOMER_PERSISTENCE_V122_PARENT_MANIFEST_SHA256) {
        throw new Error('[EC-PANEL-CUSTOMER-V122] parent_manifest_identity_invalid');
    }
    const parent = canonicalJson('docs/freeze/dropi-total-resolution-v121-20260904.json', 'parent_manifest');
    if (parent.version !== 121 || parent.freezeId !== 'dropi-total-resolution-v121'
        || parent.policy?.manualAuthorizationPerOrderRequired !== true
        || parent.policy?.automaticRetryAfterAmbiguousFailure !== false
        || parent.policy?.historicalBackfillAllowed !== false
        || parent.policy?.whatsappOutboundChanged !== false
        || parent.policy?.postSaleArchitectureChanged !== false
        || parent.policy?.metaChanged !== false) {
        throw new Error('[EC-PANEL-CUSTOMER-V122] parent_policy_invalid');
    }
    const modified = new Set(EC_PANEL_CUSTOMER_PERSISTENCE_V122_ANCESTOR_OVERRIDES);
    const successorOverrides = new Set(globalThis[EC_PANEL_CUSTOMER_PERSISTENCE_V122_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath) || successorOverrides.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[EC-PANEL-CUSTOMER-V122] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertEcPanelCustomerPersistenceV122Manifest = () => {
    assertParentV121();
    const manifest = canonicalJson(EC_PANEL_CUSTOMER_PERSISTENCE_V122_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-panel-customer-persistence-v122'
        || manifest.version !== EC_PANEL_CUSTOMER_PERSISTENCE_V122_VERSION
        || manifest.parentVersion !== 'V121_PRODUCTION_BASELINE'
        || manifest.parentCommit !== EC_PANEL_CUSTOMER_PERSISTENCE_V122_PARENT_COMMIT
        || manifest.parentTree !== EC_PANEL_CUSTOMER_PERSISTENCE_V122_PARENT_TREE
        || manifest.parentManifestSha256 !== EC_PANEL_CUSTOMER_PERSISTENCE_V122_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'RESTORE_AUTHENTICATED_CUSTOMER_FORM_AND_STATUS_PERSISTENCE'
        || JSON.stringify(overrides) !== JSON.stringify(EC_PANEL_CUSTOMER_PERSISTENCE_V122_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(EC_PANEL_CUSTOMER_PERSISTENCE_V122_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.panelAuthRequired !== true
        || manifest.policy?.allowedRouteCount !== 2
        || manifest.policy?.customerPreviewWriteAllowed !== false
        || manifest.policy?.customerStateCollectionOnly !== true
        || manifest.policy?.genericOrderRoutesAllowed !== false
        || manifest.policy?.whatsappOutboundChanged !== false
        || manifest.policy?.dropiChanged !== false
        || manifest.policy?.postSaleChanged !== false
        || manifest.policy?.metaChanged !== false
        || manifest.evidence?.sha256 !== EC_PANEL_CUSTOMER_PERSISTENCE_V122_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/EC_PANEL_CUSTOMER_PERSISTENCE_FREEZE_V122_20260904.md') !== EC_PANEL_CUSTOMER_PERSISTENCE_V122_FREEZE_SHA256) {
        throw new Error('[EC-PANEL-CUSTOMER-V122] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[EC_PANEL_CUSTOMER_PERSISTENCE_V122_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[EC-PANEL-CUSTOMER-V122] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[EC-PANEL-CUSTOMER-V122] logical_bundle_invalid');
    }
    return Object.freeze({
        ready: true,
        failures: [],
        manifest,
        overrides,
        manifestSha256: fileSha256(EC_PANEL_CUSTOMER_PERSISTENCE_V122_MANIFEST_PATH)
    });
};
