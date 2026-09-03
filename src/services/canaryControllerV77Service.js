import crypto from 'node:crypto';

import { resolveEcBotCoreV78Configuration } from './ecBotCoreOperationalV78Service.js';
import { resolvePostSaleTransactionalV105Configuration } from './postSaleTransactionalControlPlaneV105Service.js';

export const CANARY_CONTROLLER_V77_VERSION = 77;
export const CANARY_CONTROLLER_V77_FLAG = 'VITALISMEN_CANARY_CTRL_V77_ENABLED';
export const CANARY_CONTROLLER_V77_QA_PHONE = '5515998038637';
export const CANARY_CONTROLLER_V77_MAX_PERMIT_MS = 10 * 60 * 1000;
export const CANARY_CONTROLLER_V77_MAX_WINDOW_MS = 60 * 60 * 1000;
export const CANARY_CONTROLLER_V77_BASE_COMMIT = '297324afa20ae5d59fbcb6080eae2e62c4841c8b';
export const CANARY_CONTROLLER_V77_BASE_TREE = '56a2b2cdc5c3062d1b90b7906bb48c705ab7d865';
export const CANARY_CONTROLLER_V77_BASE_TAG = 'production-20260828-297324a';
export const CANARY_CONTROLLER_V77_BASE_RELEASE = '20260828T210000Z_production-20260828-297324a';

export const CANARY_CONTROLLER_V77_IDENTITY_FLAGS = Object.freeze([
    'VITALISMEN_CANARY_V77_RELEASE',
    'VITALISMEN_CANARY_V77_COMMIT',
    'VITALISMEN_CANARY_V77_TREE',
    'VITALISMEN_CANARY_V77_TAG',
    'VITALISMEN_CANARY_V77_BASELINE_RELEASE',
    'VITALISMEN_CANARY_V77_BASELINE_COMMIT',
    'VITALISMEN_CANARY_V77_BASELINE_TREE',
    'VITALISMEN_CANARY_V77_BASELINE_TAG',
    'VITALISMEN_CANARY_V77_QA_PHONE',
    'VITALISMEN_CANARY_V77_PERMIT_ID',
    'VITALISMEN_CANARY_V77_STARTED_AT',
    'VITALISMEN_CANARY_V77_EXPIRES_AT',
    'VITALISMEN_CANARY_V77_PROFILE_SHA256'
]);

const OPERATIONAL_SENTINEL_FLAGS = Object.freeze([
    'VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED',
    'VIT_POWER_FUNNEL_ACTIVE',
    'WHATSAPP_AUTO_REPLY_ENABLED',
    'ZAPI_ROUTE_INBOUND_TO_BOT',
    'WHATSAPP_FUNNEL_ENABLED',
    'SHIPMENT_STATUS_DISPATCH_ENABLED',
    'SHIPMENT_PICKUP_REMINDERS_ENABLED',
    'PICKUP_PROOF_SWEEP_ENABLED',
    'POST_SALE_V66_MUTATIONS_ENABLED',
    'ZAPI_PERSIST_INBOUND_ENABLED',
    'ZAPI_PERSIST_ACK_ENABLED'
]);

const clean = (value = '') => String(value ?? '').trim();
const isTrue = (value) => clean(value).toLowerCase() === 'true';
const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const exactSha1 = (value) => /^[0-9a-f]{40}$/.test(clean(value));
const exactSha256 = (value) => /^[0-9a-f]{64}$/.test(clean(value));
const exactRelease = (value) => /^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[0-9a-f]{7}$/.test(clean(value));
const exactTag = (value) => /^production-[0-9]{8}-[0-9a-f]{7}$/.test(clean(value));
const exactPermitId = (value) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(clean(value));

export const canaryControllerV77OperationalFlagsEnabled = (env = process.env) => (
    OPERATIONAL_SENTINEL_FLAGS.some((flag) => isTrue(env[flag]))
);

export const canaryControllerV77EnforcementRequired = (env = process.env) => {
    const botCore = resolveEcBotCoreV78Configuration(env);
    if (botCore.enabled && botCore.ready) return false;
    const postSaleTransactional = resolvePostSaleTransactionalV105Configuration(env);
    if (postSaleTransactional.enabled && postSaleTransactional.ready) return false;
    return isTrue(env.VITALISMEN_CANARY_V75_ENABLED)
        || isTrue(env[CANARY_CONTROLLER_V77_FLAG])
        || (
            clean(env.NODE_ENV).toLowerCase() === 'production'
            && canaryControllerV77OperationalFlagsEnabled(env)
        );
};

export const canonicalCanaryControllerV77ProfilePayload = (env = process.env) => {
    const keys = [
        CANARY_CONTROLLER_V77_FLAG,
        'VITALISMEN_CANARY_V75_ENABLED',
        ...CANARY_CONTROLLER_V77_IDENTITY_FLAGS.filter((key) => key !== 'VITALISMEN_CANARY_V77_PROFILE_SHA256')
    ];
    return `${keys.map((key) => `${key}=${clean(env[key])}`).join('\n')}\n`;
};

export const calculateCanaryControllerV77ProfileSha256 = (env = process.env) => (
    sha256(canonicalCanaryControllerV77ProfilePayload(env))
);

export const resolveCanaryControllerV77Runtime = (env = process.env, {
    nowMs = Date.now()
} = {}) => {
    const enforcementRequired = canaryControllerV77EnforcementRequired(env);
    if (!enforcementRequired) {
        return {
            enabled: false,
            ready: true,
            active: false,
            expired: false,
            failClosed: true,
            qaPhone: CANARY_CONTROLLER_V77_QA_PHONE,
            failures: []
        };
    }

    const failures = [];
    const canaryEnabled = isTrue(env.VITALISMEN_CANARY_V75_ENABLED);
    const controllerEnabled = isTrue(env[CANARY_CONTROLLER_V77_FLAG]);
    if (!canaryEnabled) failures.push('VITALISMEN_CANARY_V75_ENABLED_must_be_true');
    if (!controllerEnabled) failures.push(`${CANARY_CONTROLLER_V77_FLAG}_must_be_true`);

    const release = clean(env.VITALISMEN_CANARY_V77_RELEASE);
    const commit = clean(env.VITALISMEN_CANARY_V77_COMMIT).toLowerCase();
    const tree = clean(env.VITALISMEN_CANARY_V77_TREE).toLowerCase();
    const tag = clean(env.VITALISMEN_CANARY_V77_TAG);
    const baselineRelease = clean(env.VITALISMEN_CANARY_V77_BASELINE_RELEASE);
    const baselineCommit = clean(env.VITALISMEN_CANARY_V77_BASELINE_COMMIT).toLowerCase();
    const baselineTree = clean(env.VITALISMEN_CANARY_V77_BASELINE_TREE).toLowerCase();
    const baselineTag = clean(env.VITALISMEN_CANARY_V77_BASELINE_TAG);
    const qaPhone = clean(env.VITALISMEN_CANARY_V77_QA_PHONE);
    const permitId = clean(env.VITALISMEN_CANARY_V77_PERMIT_ID);
    const profileSha256 = clean(env.VITALISMEN_CANARY_V77_PROFILE_SHA256).toLowerCase();
    const startedAt = Date.parse(clean(env.VITALISMEN_CANARY_V77_STARTED_AT));
    const expiresAt = Date.parse(clean(env.VITALISMEN_CANARY_V77_EXPIRES_AT));

    if (!exactRelease(release)) failures.push('release_invalid');
    if (!exactSha1(commit)) failures.push('commit_invalid');
    if (!exactSha1(tree)) failures.push('tree_invalid');
    if (!exactTag(tag)) failures.push('tag_invalid');
    if (exactSha1(commit) && exactTag(tag) && commit.slice(0, 7) !== tag.slice(-7)) {
        failures.push('tag_commit_mismatch');
    }
    if (exactRelease(release) && exactSha1(commit) && release.slice(-7) !== commit.slice(0, 7)) {
        failures.push('release_commit_mismatch');
    }
    if (baselineRelease !== CANARY_CONTROLLER_V77_BASE_RELEASE) failures.push('baseline_release_invalid');
    if (baselineCommit !== CANARY_CONTROLLER_V77_BASE_COMMIT) failures.push('baseline_commit_invalid');
    if (baselineTree !== CANARY_CONTROLLER_V77_BASE_TREE) failures.push('baseline_tree_invalid');
    if (baselineTag !== CANARY_CONTROLLER_V77_BASE_TAG) failures.push('baseline_tag_invalid');
    if (qaPhone !== CANARY_CONTROLLER_V77_QA_PHONE) failures.push('qa_phone_invalid');
    if (!exactPermitId(permitId)) failures.push('permit_id_invalid');
    if (!exactSha256(profileSha256)) failures.push('profile_sha256_invalid');
    if (exactSha256(profileSha256) && profileSha256 !== calculateCanaryControllerV77ProfileSha256(env)) {
        failures.push('profile_sha256_mismatch');
    }

    if (!Number.isFinite(startedAt) || !Number.isFinite(expiresAt)) {
        failures.push('window_timestamp_invalid');
    } else {
        if (startedAt > nowMs + 60_000) failures.push('window_starts_in_future');
        if (expiresAt <= startedAt) failures.push('window_order_invalid');
        if (expiresAt - startedAt > CANARY_CONTROLLER_V77_MAX_WINDOW_MS) failures.push('window_exceeds_60_minutes');
        if (expiresAt <= nowMs) failures.push('window_expired');
    }

    const expired = Number.isFinite(expiresAt) && expiresAt <= nowMs;
    return {
        enabled: true,
        ready: failures.length === 0,
        active: failures.length === 0,
        expired,
        failClosed: true,
        qaPhone: CANARY_CONTROLLER_V77_QA_PHONE,
        release,
        commit,
        tree,
        tag,
        baselineRelease,
        baselineCommit,
        baselineTree,
        baselineTag,
        permitId,
        profileSha256,
        startedAt: Number.isFinite(startedAt) ? new Date(startedAt).toISOString() : null,
        expiresAt: Number.isFinite(expiresAt) ? new Date(expiresAt).toISOString() : null,
        failures
    };
};

export const assertCanaryControllerV77Startup = (env = process.env, options = {}) => {
    const state = resolveCanaryControllerV77Runtime(env, options);
    if (!state.enabled || state.ready) return state;
    const error = new Error(`canary_controller_v77_invalid:${state.failures.join(',')}`);
    error.code = 'CANARY_CONTROLLER_V77_INVALID';
    error.statusCode = 503;
    throw error;
};

export const assertCanaryControllerV77Health = (health = {}) => {
    const safety = health?.automationSafety || {};
    const failures = [];
    if (health?.status !== 'online') failures.push('health_not_online');
    if (!Array.isArray(health?.degradedReasons) || health.degradedReasons.length !== 0) {
        failures.push('health_degraded');
    }
    if (safety.strictReadOnly !== false) failures.push('strict_read_only_not_released_for_canary');
    if (safety.operationalMutationsEnabled !== true) failures.push('operational_mutations_not_enabled');
    if (safety.compatibilityBridgeComplete !== true) failures.push('persistent_bridge_incomplete');
    if (Number(safety.dataCompatibilityVersion) !== 66) failures.push('data_compatibility_invalid');
    if (Number(safety.minimumRuntimeVersion) !== 66) failures.push('minimum_runtime_invalid');
    if (safety.dropiSyncMode !== 'REPORT_ONLY') failures.push('dropi_mode_not_report_only');
    if (safety.dropiApplyAllowed !== false) failures.push('dropi_apply_allowed');
    if (failures.length > 0) {
        const error = new Error(`canary_controller_v77_health_invalid:${failures.join(',')}`);
        error.code = 'CANARY_CONTROLLER_V77_HEALTH_INVALID';
        throw error;
    }
    return { ok: true, failures: [] };
};

export const CANARY_CONTROLLER_V77_OPERATIONAL_SENTINEL_FLAGS = OPERATIONAL_SENTINEL_FLAGS;
