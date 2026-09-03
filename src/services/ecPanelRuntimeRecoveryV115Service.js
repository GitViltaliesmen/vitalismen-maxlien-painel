import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_PANEL_RUNTIME_RECOVERY_V115_VERSION = 115;
export const EC_PANEL_RUNTIME_RECOVERY_V115_MODE = 'EC_PANEL_AUTHENTICATED_MUTATIONS';
export const EC_PANEL_RUNTIME_RECOVERY_V115_MANIFEST_PATH = 'docs/freeze/ec-panel-runtime-recovery-v115-20260903.json';
export const EC_PANEL_RUNTIME_RECOVERY_V115_PARENT_COMMIT = '026317886960c32f8dc4c8d4cf83e51bd7f77e0f';
export const EC_PANEL_RUNTIME_RECOVERY_V115_PARENT_TREE = 'fa4863c58eff2c568ca0a2a366031660b4324fd3';
export const EC_PANEL_RUNTIME_RECOVERY_V115_PARENT_MANIFEST_SHA256 = 'cb29139d373e64438c407360cd19b907c8e1bc291e675ccc139194cb9e7e8b2d';
export const EC_PANEL_RUNTIME_RECOVERY_V115_PARENT_FREEZE_SHA256 = 'bdba0445bdb341f57f5f7b570fce23883fbde934a32a67cdd98986d82c731e86';
export const EC_PANEL_RUNTIME_RECOVERY_V115_PARENT_ATTESTATION_SHA256 = 'd8cdf157e6f1ec5504faaec45c5417e6dfd3302dd4f6a0f672ab83510802f8d8';
export const EC_PANEL_RUNTIME_RECOVERY_V115_FREEZE_SHA256 = '384462ee1a53c284341284929973ffa275f6979ac4e82c296be9e1542f2027a8';
export const EC_PANEL_RUNTIME_RECOVERY_V115_ATTESTATION_SHA256 = '9e57d2ef00dfd420c65306844efbced3b608c1406f3d84f9ec72ac0da5b61e93';
export const EC_PANEL_RUNTIME_RECOVERY_V115_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const EC_PANEL_RUNTIME_RECOVERY_V115_ANCESTOR_OVERRIDES = Object.freeze([
    'public/qr.html',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/routes/whatsapp.js',
    'src/services/ecBotCoreRuntimeIntegrationV78Service.js',
    'src/services/zapiClient.js',
    'tests/bot-qa-multiturn-recovery-v111.test.mjs'
]);

export const EC_PANEL_RUNTIME_RECOVERY_V115_NEW_PROTECTED_FILES = Object.freeze([
    'docs/EC_PANEL_RUNTIME_RECOVERY_FREEZE_V115_20260903.md',
    'docs/evidence/ec-panel-runtime-recovery-v115-attestation-20260903.json',
    'public/panel-intelligence/delivery-status-v115.js',
    'scripts/guard-ec-panel-runtime-recovery-v115.mjs',
    'src/services/ecPanelRuntimeRecoveryFreezeRuntimeGuardV115.js',
    'src/services/ecPanelRuntimeRecoveryV115Service.js',
    'tests/ec-panel-runtime-recovery-v115.test.mjs'
]);

export const EC_PANEL_RUNTIME_RECOVERY_V115_STATIC_ROUTES = Object.freeze(new Set([
    '/api/whatsapp/send'
]));

const clean = (value = '') => String(value ?? '').trim();
const isTrue = (value) => clean(value).toLowerCase() === 'true';

const normalizedPath = (value = '') => (
    clean(value).split('?')[0].replace(/\/+$/, '') || '/'
);

export const ecPanelRuntimeRecoveryV115Requested = (env = process.env) => (
    isTrue(env.VITALISMEN_EC_BOT_CORE_OPERATIONAL)
);

export const resolveEcPanelRuntimeRecoveryV115Configuration = (env = process.env) => {
    const enabled = ecPanelRuntimeRecoveryV115Requested(env);
    const failures = [];
    if (enabled && clean(env.PANEL_AUTH_DISABLED).toLowerCase() !== 'false') {
        failures.push('PANEL_AUTH_DISABLED_must_be_false');
    }
    return Object.freeze({
        enabled,
        ready: enabled && failures.length === 0,
        mode: enabled ? EC_PANEL_RUNTIME_RECOVERY_V115_MODE : '',
        failures
    });
};

export const isEcPanelRuntimeRecoveryV115Route = ({ method = '', path = '' } = {}) => {
    if (clean(method).toUpperCase() !== 'POST') return false;
    const routePath = normalizedPath(path);
    if (EC_PANEL_RUNTIME_RECOVERY_V115_STATIC_ROUTES.has(routePath)) return true;
    return /^\/api\/whatsapp\/contact-state\/[^/]+\/(?:claim|release)$/.test(routePath);
};

export const ecPanelRuntimeRecoveryV115RouteDecision = ({
    method = '',
    path = '',
    env = process.env
} = {}) => {
    const configuration = resolveEcPanelRuntimeRecoveryV115Configuration(env);
    if (!configuration.enabled) {
        return Object.freeze({
            enforced: false,
            allowed: false,
            reason: 'ec_panel_v115_not_requested'
        });
    }
    if (!configuration.ready) {
        return Object.freeze({
            enforced: true,
            allowed: false,
            reason: 'ec_panel_v115_invalid_fail_closed'
        });
    }
    const allowed = isEcPanelRuntimeRecoveryV115Route({ method, path });
    return Object.freeze({
        enforced: true,
        allowed,
        reason: allowed ? 'ec_panel_v115_route_allowed' : 'ec_panel_v115_route_blocked'
    });
};

export const assertEcPanelManualSendV115 = ({ sendMode = '', env = process.env } = {}) => {
    const configuration = resolveEcPanelRuntimeRecoveryV115Configuration(env);
    if (!configuration.enabled) return true;
    if (!configuration.ready) {
        const error = new Error('ec_panel_v115_invalid_fail_closed');
        error.statusCode = 403;
        throw error;
    }
    if (clean(sendMode) !== 'manual_panel') {
        const error = new Error('ec_panel_manual_send_mode_required');
        error.statusCode = 403;
        throw error;
    }
    return true;
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-PANEL-RUNTIME-V115] protected_path_invalid');
    }
    const candidate = path.resolve(projectRoot, relativePath);
    if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${path.sep}`)) {
        throw new Error('[EC-PANEL-RUNTIME-V115] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-PANEL-RUNTIME-V115] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-PANEL-RUNTIME-V115] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentRuntime = () => {
    const identities = new Map([
        ['docs/freeze/bot-qa-multiturn-recovery-v111-20260903.json', EC_PANEL_RUNTIME_RECOVERY_V115_PARENT_MANIFEST_SHA256],
        ['docs/BOT_QA_MULTITURN_RECOVERY_FREEZE_V111_20260903.md', EC_PANEL_RUNTIME_RECOVERY_V115_PARENT_FREEZE_SHA256],
        ['docs/evidence/bot-qa-multiturn-recovery-v111-attestation-20260903.json', EC_PANEL_RUNTIME_RECOVERY_V115_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[EC-PANEL-RUNTIME-V115] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = canonicalJson('docs/freeze/bot-qa-multiturn-recovery-v111-20260903.json', 'parent_manifest');
    if (parent.version !== 111 || parent.freezeId !== 'bot-qa-multiturn-recovery-v111'
        || parent.policy?.productionCustomerBypass !== false
        || parent.policy?.dropiChanged !== false
        || parent.policy?.postSaleChanged !== false) {
        throw new Error('[EC-PANEL-RUNTIME-V115] parent_policy_invalid');
    }
    const modified = new Set(EC_PANEL_RUNTIME_RECOVERY_V115_ANCESTOR_OVERRIDES);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[EC-PANEL-RUNTIME-V115] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertEcPanelRuntimeRecoveryV115Manifest = () => {
    assertParentRuntime();
    const manifest = canonicalJson(EC_PANEL_RUNTIME_RECOVERY_V115_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-panel-runtime-recovery-v115'
        || manifest.version !== EC_PANEL_RUNTIME_RECOVERY_V115_VERSION
        || manifest.parentVersion !== 'V113_BASELINE_V111_RUNTIME'
        || manifest.parentCommit !== EC_PANEL_RUNTIME_RECOVERY_V115_PARENT_COMMIT
        || manifest.parentTree !== EC_PANEL_RUNTIME_RECOVERY_V115_PARENT_TREE
        || manifest.parentManifestSha256 !== EC_PANEL_RUNTIME_RECOVERY_V115_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'RESTORE_AUTHENTICATED_PANEL_MUTATIONS_AND_TRUTHFUL_DELIVERY_STATUS'
        || JSON.stringify(overrides) !== JSON.stringify(EC_PANEL_RUNTIME_RECOVERY_V115_ANCESTOR_OVERRIDES)
        || JSON.stringify(modified) !== JSON.stringify(EC_PANEL_RUNTIME_RECOVERY_V115_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(EC_PANEL_RUNTIME_RECOVERY_V115_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.panelAuthRequired !== true
        || manifest.policy?.manualSendModeRequired !== true
        || manifest.policy?.allowedPostRouteCount !== 3
        || manifest.policy?.wildcardWhatsappMutationAllowed !== false
        || manifest.policy?.providerIdRequired !== true
        || manifest.policy?.callbackRequiredForDeliveryStates !== true
        || manifest.policy?.historicalBulkRelease !== false
        || manifest.policy?.dropiChanged !== false
        || manifest.policy?.postSaleChanged !== false
        || manifest.policy?.metaChanged !== false
        || manifest.evidence?.sha256 !== EC_PANEL_RUNTIME_RECOVERY_V115_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/EC_PANEL_RUNTIME_RECOVERY_FREEZE_V115_20260903.md') !== EC_PANEL_RUNTIME_RECOVERY_V115_FREEZE_SHA256) {
        throw new Error('[EC-PANEL-RUNTIME-V115] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[EC_PANEL_RUNTIME_RECOVERY_V115_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[EC-PANEL-RUNTIME-V115] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[EC-PANEL-RUNTIME-V115] logical_bundle_invalid');
    }
    return Object.freeze({
        ready: true,
        failures: [],
        manifest,
        overrides,
        manifestSha256: fileSha256(EC_PANEL_RUNTIME_RECOVERY_V115_MANIFEST_PATH)
    });
};
