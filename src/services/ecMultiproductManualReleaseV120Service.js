import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_MULTIPRODUCT_MANUAL_RELEASE_V120_VERSION = 120;
export const EC_MULTIPRODUCT_MANUAL_RELEASE_V120_MODE = 'EC_AUTHENTICATED_CONTACT_AND_MULTIPRODUCT_DROPI';
export const EC_MULTIPRODUCT_MANUAL_RELEASE_V120_MANIFEST_PATH = 'docs/freeze/ec-multiproduct-manual-release-v120-20260904.json';
export const EC_MULTIPRODUCT_MANUAL_RELEASE_V120_PARENT_COMMIT = '12a29c7cb26b1473e1104049aded40daa2386315';
export const EC_MULTIPRODUCT_MANUAL_RELEASE_V120_PARENT_TREE = '35cd2311592bc1ae846d25ceea8a6c31ba28dbda';
export const EC_MULTIPRODUCT_MANUAL_RELEASE_V120_PARENT_MANIFEST_SHA256 = '5ce91e0b95d02fdea8f76ae6cf38afc95985c9c5af956bbcc062172f156758de';
export const EC_MULTIPRODUCT_MANUAL_RELEASE_V120_FREEZE_SHA256 = '4bb204949afe0b1cf6ab006c123aa7e4b18dfd0be3abee9f115ffca70c774fb1';
export const EC_MULTIPRODUCT_MANUAL_RELEASE_V120_ATTESTATION_SHA256 = '1155b5dc190dea70dd846990cd7825f8b130082a657af27eb607867d785ac94b';
export const EC_MULTIPRODUCT_MANUAL_RELEASE_V120_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const EC_MULTIPRODUCT_MANUAL_RELEASE_V120_ANCESTOR_OVERRIDES = Object.freeze([
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/services/droppiEcuadorBrowserService.js',
    'src/services/botQaMultiturnRecoveryV111Service.js',
    'src/services/ecBotCoreRuntimeIntegrationV78Service.js',
    'src/services/protocoloGSuccessorGuardV101Service.js'
]);

export const EC_MULTIPRODUCT_MANUAL_RELEASE_V120_NEW_PROTECTED_FILES = Object.freeze([
    'docs/DROPI_MULTIPRODUCT_MANUAL_RELEASE_FREEZE_V120_20260904.md',
    'docs/evidence/ec-multiproduct-manual-release-v120-attestation-20260904.json',
    'scripts/guard-ec-multiproduct-manual-release-v120.mjs',
    'src/services/ecMultiproductManualReleaseFreezeRuntimeGuardV120.js',
    'src/services/ecMultiproductManualReleaseV120Service.js',
    'tests/ec-multiproduct-manual-release-v120.test.mjs'
]);

const clean = (value = '') => String(value ?? '').trim();
const isTrue = (value) => clean(value).toLowerCase() === 'true';
const normalizedPath = (value = '') => clean(value).split('?')[0].replace(/\/+$/, '') || '/';

export const resolveEcMultiproductManualReleaseV120Configuration = (env = process.env) => {
    const enabled = isTrue(env.VITALISMEN_EC_BOT_CORE_OPERATIONAL);
    const failures = [];
    if (enabled && clean(env.PANEL_AUTH_DISABLED).toLowerCase() !== 'false') {
        failures.push('PANEL_AUTH_DISABLED_must_be_false');
    }
    return Object.freeze({
        enabled,
        ready: enabled && failures.length === 0,
        mode: enabled ? EC_MULTIPRODUCT_MANUAL_RELEASE_V120_MODE : '',
        failures
    });
};

export const ecMultiproductManualReleaseV120RouteDecision = ({
    method = '',
    path = '',
    env = process.env
} = {}) => {
    const configuration = resolveEcMultiproductManualReleaseV120Configuration(env);
    if (!configuration.enabled) {
        return Object.freeze({ enforced: false, allowed: false, reason: 'ec_multiproduct_v120_not_requested' });
    }
    if (!configuration.ready) {
        return Object.freeze({ enforced: true, allowed: false, reason: 'ec_multiproduct_v120_invalid_fail_closed' });
    }
    const allowed = clean(method).toUpperCase() === 'POST'
        && normalizedPath(path) === '/api/whatsapp/contacts';
    return Object.freeze({
        enforced: true,
        allowed,
        operation: allowed ? 'authenticated-contact-upsert' : '',
        reason: allowed ? 'ec_multiproduct_v120_route_allowed' : 'ec_multiproduct_v120_route_blocked'
    });
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-MULTIPRODUCT-V120] protected_path_invalid');
    }
    const candidate = path.resolve(projectRoot, relativePath);
    if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${path.sep}`)) {
        throw new Error('[EC-MULTIPRODUCT-V120] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-MULTIPRODUCT-V120] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-MULTIPRODUCT-V120] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV119 = () => {
    if (fileSha256('docs/freeze/ec-manual-dropi-release-v119-20260903.json')
        !== EC_MULTIPRODUCT_MANUAL_RELEASE_V120_PARENT_MANIFEST_SHA256) {
        throw new Error('[EC-MULTIPRODUCT-V120] parent_manifest_identity_invalid');
    }
    const parent = canonicalJson('docs/freeze/ec-manual-dropi-release-v119-20260903.json', 'parent_manifest');
    if (parent.version !== 119 || parent.freezeId !== 'ec-manual-dropi-release-v119'
        || parent.policy?.persistentAuthorizationRequired !== true
        || parent.policy?.automaticDispatchAllowed !== false
        || parent.policy?.automaticRetryAfterAmbiguousFailure !== false) {
        throw new Error('[EC-MULTIPRODUCT-V120] parent_policy_invalid');
    }
    const successorOverrides = Array.isArray(globalThis[EC_MULTIPRODUCT_MANUAL_RELEASE_V120_OVERRIDE_KEY])
        ? globalThis[EC_MULTIPRODUCT_MANUAL_RELEASE_V120_OVERRIDE_KEY]
        : [];
    const modified = new Set([
        ...EC_MULTIPRODUCT_MANUAL_RELEASE_V120_ANCESTOR_OVERRIDES,
        ...successorOverrides
    ]);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[EC-MULTIPRODUCT-V120] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertEcMultiproductManualReleaseV120Manifest = () => {
    assertParentV119();
    const manifest = canonicalJson(EC_MULTIPRODUCT_MANUAL_RELEASE_V120_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-multiproduct-manual-release-v120'
        || manifest.version !== EC_MULTIPRODUCT_MANUAL_RELEASE_V120_VERSION
        || manifest.parentVersion !== 'V119_PRODUCTION_BASELINE'
        || manifest.parentCommit !== EC_MULTIPRODUCT_MANUAL_RELEASE_V120_PARENT_COMMIT
        || manifest.parentTree !== EC_MULTIPRODUCT_MANUAL_RELEASE_V120_PARENT_TREE
        || manifest.parentManifestSha256 !== EC_MULTIPRODUCT_MANUAL_RELEASE_V120_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'RESTORE_AUTHENTICATED_CONTACT_UPSERT_AND_AUTHORITATIVE_MULTIPRODUCT_DROPI'
        || JSON.stringify(overrides) !== JSON.stringify(EC_MULTIPRODUCT_MANUAL_RELEASE_V120_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(EC_MULTIPRODUCT_MANUAL_RELEASE_V120_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.panelAuthRequired !== true
        || manifest.policy?.allowedAdditionalPostRouteCount !== 1
        || manifest.policy?.allowedProducts?.join('|') !== 'tex_ultra_ec|nitrix_ec|vit_power_ec'
        || manifest.policy?.manualAuthorizationPerOrderRequired !== true
        || manifest.policy?.automaticDispatchAllowed !== false
        || manifest.policy?.automaticRetryAfterAmbiguousFailure !== false
        || manifest.policy?.authoritativeCatalogAndQuoteRequired !== true
        || manifest.policy?.verifiedDropiOrderIdRequired !== true
        || manifest.policy?.historicalBackfillAllowed !== false
        || manifest.policy?.whatsappOutboundChanged !== false
        || manifest.policy?.postSaleChanged !== false
        || manifest.policy?.metaChanged !== false
        || manifest.evidence?.sha256 !== EC_MULTIPRODUCT_MANUAL_RELEASE_V120_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/DROPI_MULTIPRODUCT_MANUAL_RELEASE_FREEZE_V120_20260904.md') !== EC_MULTIPRODUCT_MANUAL_RELEASE_V120_FREEZE_SHA256) {
        throw new Error('[EC-MULTIPRODUCT-V120] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[EC_MULTIPRODUCT_MANUAL_RELEASE_V120_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[EC-MULTIPRODUCT-V120] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[EC-MULTIPRODUCT-V120] logical_bundle_invalid');
    }
    return Object.freeze({
        ready: true,
        failures: [],
        manifest,
        overrides,
        manifestSha256: fileSha256(EC_MULTIPRODUCT_MANUAL_RELEASE_V120_MANIFEST_PATH)
    });
};
