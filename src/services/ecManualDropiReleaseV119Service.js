import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_MANUAL_DROPI_RELEASE_V119_VERSION = 119;
export const EC_MANUAL_DROPI_RELEASE_V119_MODE = 'EC_AUTHENTICATED_MANUAL_DROPI';
export const EC_MANUAL_DROPI_RELEASE_V119_MANIFEST_PATH = 'docs/freeze/ec-manual-dropi-release-v119-20260903.json';
export const EC_MANUAL_DROPI_RELEASE_V119_PARENT_COMMIT = '7e35a1d187a9bf65bd682ad7a67f528e753bb340';
export const EC_MANUAL_DROPI_RELEASE_V119_PARENT_TREE = '97d4657a0738437b2bad7a0a5720402c0ce051b9';
export const EC_MANUAL_DROPI_RELEASE_V119_PARENT_MANIFEST_SHA256 = 'e024223262481db8db5de2405ded2a336c65a9783ef1ec36eaa690b8ebbde457';
export const EC_MANUAL_DROPI_RELEASE_V119_FREEZE_SHA256 = '519fafef9b3d5f289e3d7cc7784b69dfe0e0e5b724d80c067cc53072f10ea369';
export const EC_MANUAL_DROPI_RELEASE_V119_ATTESTATION_SHA256 = 'e49945fa4c953cea2f893e45024846b2a8933464de9a51fb2a35f58a11a4e969';
export const EC_MANUAL_DROPI_RELEASE_V119_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const EC_MANUAL_DROPI_RELEASE_V119_ANCESTOR_OVERRIDES = Object.freeze([
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/routes/shipments.js',
    'src/services/canaryIsolationV75Service.js',
    'src/services/ecBotCoreRuntimeIntegrationV78Service.js'
]);

export const EC_MANUAL_DROPI_RELEASE_V119_NEW_PROTECTED_FILES = Object.freeze([
    'docs/DROPI_MANUAL_RELEASE_FREEZE_V119_20260903.md',
    'docs/evidence/ec-manual-dropi-release-v119-attestation-20260903.json',
    'scripts/guard-ec-manual-dropi-release-v119.mjs',
    'src/services/ecManualDropiReleaseFreezeRuntimeGuardV119.js',
    'src/services/ecManualDropiReleaseV119Service.js',
    'tests/ec-manual-dropi-release-v119.test.mjs'
]);

export const EC_MANUAL_DROPI_RELEASE_V119_COLLECTIONS = Object.freeze(new Set([
    'orders',
    'shipments',
    'contactstates'
]));

const clean = (value = '') => String(value ?? '').trim();
const isTrue = (value) => clean(value).toLowerCase() === 'true';
const normalizedPath = (value = '') => clean(value).split('?')[0].replace(/\/+$/, '') || '/';

const manualDropiRouteMatch = (path = '') => normalizedPath(path).match(
    /^\/api\/shipments\/droppi\/ec\/orders\/[^/]+\/(authorize-submit|submit)$/
);

export const resolveEcManualDropiReleaseV119Configuration = (env = process.env) => {
    const enabled = isTrue(env.VITALISMEN_EC_BOT_CORE_OPERATIONAL);
    const failures = [];
    if (enabled && clean(env.PANEL_AUTH_DISABLED).toLowerCase() !== 'false') {
        failures.push('PANEL_AUTH_DISABLED_must_be_false');
    }
    return Object.freeze({
        enabled,
        ready: enabled && failures.length === 0,
        mode: enabled ? EC_MANUAL_DROPI_RELEASE_V119_MODE : '',
        failures
    });
};

export const ecManualDropiReleaseV119RouteDecision = ({
    method = '',
    path = '',
    env = process.env
} = {}) => {
    const configuration = resolveEcManualDropiReleaseV119Configuration(env);
    if (!configuration.enabled) {
        return Object.freeze({ enforced: false, allowed: false, reason: 'ec_manual_dropi_v119_not_requested' });
    }
    if (!configuration.ready) {
        return Object.freeze({ enforced: true, allowed: false, reason: 'ec_manual_dropi_v119_invalid_fail_closed' });
    }
    const routeMatch = clean(method).toUpperCase() === 'POST' ? manualDropiRouteMatch(path) : null;
    return Object.freeze({
        enforced: true,
        allowed: Boolean(routeMatch),
        operation: routeMatch?.[1] || '',
        reason: routeMatch ? 'ec_manual_dropi_v119_route_allowed' : 'ec_manual_dropi_v119_route_blocked'
    });
};

export const ecManualDropiReleaseV119MongoAllowed = ({
    method = '',
    path = '',
    collection = '',
    context = null,
    env = process.env
} = {}) => {
    if (context?.manualDropiV119 !== true || context?.writeContext !== true) return false;
    const decision = ecManualDropiReleaseV119RouteDecision({ method, path, env });
    return decision.allowed
        && decision.operation === context.manualDropiOperation
        && EC_MANUAL_DROPI_RELEASE_V119_COLLECTIONS.has(clean(collection).toLowerCase());
};

export const ecManualDropiReleaseV119ExternalEffectAllowed = ({
    effect = '',
    context = null,
    env = process.env
} = {}) => {
    if (clean(effect).toLowerCase() !== 'dropi') return false;
    if (context?.manualDropiV119 !== true || context?.manualDropiOperation !== 'submit') return false;
    const decision = ecManualDropiReleaseV119RouteDecision({
        method: context.method,
        path: context.path,
        env
    });
    return decision.allowed && decision.operation === 'submit';
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-MANUAL-DROPI-V119] protected_path_invalid');
    }
    const candidate = path.resolve(projectRoot, relativePath);
    if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${path.sep}`)) {
        throw new Error('[EC-MANUAL-DROPI-V119] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-MANUAL-DROPI-V119] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-MANUAL-DROPI-V119] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV118 = () => {
    if (fileSha256('docs/freeze/panel-warmup-isolation-v118-20260903.json')
        !== EC_MANUAL_DROPI_RELEASE_V119_PARENT_MANIFEST_SHA256) {
        throw new Error('[EC-MANUAL-DROPI-V119] parent_manifest_identity_invalid');
    }
    const parent = canonicalJson('docs/freeze/panel-warmup-isolation-v118-20260903.json', 'parent_manifest');
    if (parent.version !== 118 || parent.freezeId !== 'panel-warmup-isolation-v118'
        || parent.policy?.whatsappOutboundAllowed !== false
        || parent.policy?.dropiMutationAllowed !== false
        || parent.policy?.metaMutationAllowed !== false) {
        throw new Error('[EC-MANUAL-DROPI-V119] parent_policy_invalid');
    }
    const modified = new Set(EC_MANUAL_DROPI_RELEASE_V119_ANCESTOR_OVERRIDES);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[EC-MANUAL-DROPI-V119] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertEcManualDropiReleaseV119Manifest = () => {
    assertParentV118();
    const manifest = canonicalJson(EC_MANUAL_DROPI_RELEASE_V119_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-manual-dropi-release-v119'
        || manifest.version !== EC_MANUAL_DROPI_RELEASE_V119_VERSION
        || manifest.parentVersion !== 'V118_PRODUCTION_BASELINE'
        || manifest.parentCommit !== EC_MANUAL_DROPI_RELEASE_V119_PARENT_COMMIT
        || manifest.parentTree !== EC_MANUAL_DROPI_RELEASE_V119_PARENT_TREE
        || manifest.parentManifestSha256 !== EC_MANUAL_DROPI_RELEASE_V119_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'RESTORE_AUTHENTICATED_TWO_STEP_MANUAL_DROPI_SUBMIT'
        || JSON.stringify(overrides) !== JSON.stringify(EC_MANUAL_DROPI_RELEASE_V119_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(EC_MANUAL_DROPI_RELEASE_V119_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.panelAuthRequired !== true
        || manifest.policy?.allowedPostRouteCount !== 2
        || manifest.policy?.persistentAuthorizationRequired !== true
        || manifest.policy?.automaticDispatchAllowed !== false
        || manifest.policy?.historicalBackfillAllowed !== false
        || manifest.policy?.authoritativeLookupBeforeCreate !== true
        || manifest.policy?.automaticRetryAfterAmbiguousFailure !== false
        || manifest.policy?.submitStatusGetWrites !== false
        || manifest.policy?.whatsappChanged !== false
        || manifest.policy?.postSaleChanged !== false
        || manifest.policy?.metaChanged !== false
        || manifest.evidence?.sha256 !== EC_MANUAL_DROPI_RELEASE_V119_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/DROPI_MANUAL_RELEASE_FREEZE_V119_20260903.md') !== EC_MANUAL_DROPI_RELEASE_V119_FREEZE_SHA256) {
        throw new Error('[EC-MANUAL-DROPI-V119] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[EC_MANUAL_DROPI_RELEASE_V119_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[EC-MANUAL-DROPI-V119] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[EC-MANUAL-DROPI-V119] logical_bundle_invalid');
    }
    return Object.freeze({
        ready: true,
        failures: [],
        manifest,
        overrides,
        manifestSha256: fileSha256(EC_MANUAL_DROPI_RELEASE_V119_MANIFEST_PATH)
    });
};
