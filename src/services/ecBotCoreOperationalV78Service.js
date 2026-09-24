import crypto from 'node:crypto';
import { resolveMetaCanonicalConsolidationV195 } from './metaCanonicalConsolidationV195Service.js';
import { readAuthorizedCheckpoint } from '../../scripts/lib/unified-successor-v202-r4-authority.mjs';

export const EC_BOT_CORE_V78_FLAG = 'VITALISMEN_EC_BOT_CORE_OPERATIONAL';
export const EC_BOT_CORE_V78_MODE = 'EC_BOT_CORE_OPERATIONAL';
export const EC_BOT_CORE_V78_VERSION = 78;
export const EC_BOT_CORE_V78_DATASET_ID = '1468946114265008';
export const EC_BOT_CORE_V195_CANONICAL_META_PROFILE = 'meta_canonical_920_v195';
export const EC_BOT_CORE_V195_CANONICAL_DATASET_ID = '920532663934291';
export const EC_BOT_CORE_V78_QA_PHONE = '5515998038637';
export const EC_BOT_CORE_V78_NODE_OPTIONS = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v97-context.mjs';
export const EC_BOT_CORE_V195_NODE_OPTIONS = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v195-context.mjs';
export const EC_BOT_CORE_V199_NODE_OPTIONS = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v199-context.mjs';
export const EC_BOT_CORE_R4_NODE_OPTIONS = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/unified-successor-v202-r4-preload.mjs';

const LEGACY_V78_RELEASE = '20260920T163629Z_production-20260920-8c25ed9';
const LEGACY_V78_COMMIT = '8c25ed9912abc4aabee2656cf9192420389934c6';
const LEGACY_V78_TREE = '44d310be637e71d6f6f5fb5d28f06c47f2bf7283';
const CANONICAL_BASE_COMMIT = 'e4f0f3b4afa075b9fcaf421eda8689b5a3cfd8e9';
const V201_PUBLISHED_COMMIT = '641759b160c2b91e95a3f1df371ad372a74d72e1';
const V201_PUBLISHED_TREE = '1feb02ad1a3f2ae266ef519bf33426b91ac80aa3';
const V201_MANIFEST_SHA256 = 'e8b82901e8faa4cda1d37a013fd2698401bad9c2039b702e637b88d5e4e56bee';
const successorOverlayContext = () => globalThis.__VITALISMEN_V201_V78_OVERLAY_CONTEXT;

export const selectEcBotCoreV78PreloadForRelease = ({
    release = '', commit = '', tree = '', tag = '', successorManifestSha256 = ''
} = {}) => {
    if (release === LEGACY_V78_RELEASE && commit === LEGACY_V78_COMMIT
        && tree === LEGACY_V78_TREE && tag === 'production-20260920-8c25ed9') {
        return EC_BOT_CORE_V78_NODE_OPTIONS;
    }
    const context = successorOverlayContext();
    const exactEnvelope = /^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[0-9a-f]{7}$/.test(release)
        && release.endsWith(commit.slice(0, 7))
        && tag === `production-${release.slice(0, 8)}-${commit.slice(0, 7)}`;
    if (!exactEnvelope) throw new Error('ec_bot_core_release_not_approved');
    if (commit === V201_PUBLISHED_COMMIT && tree === V201_PUBLISHED_TREE
        && successorManifestSha256 === V201_MANIFEST_SHA256
        && context?.loaded === true && context.baseCommit === CANONICAL_BASE_COMMIT
        && context.manifestSha256 === V201_MANIFEST_SHA256) {
        return EC_BOT_CORE_V199_NODE_OPTIONS;
    }
    const checkpoint = readAuthorizedCheckpoint().value;
    if (commit === checkpoint.r4OperationalCommit && tree === checkpoint.r4OperationalTree
        && successorManifestSha256 === checkpoint.r4OperationalManifestSha256
        && globalThis.__VITALISMEN_R4_OPERATIONAL_CONTEXT?.loaded === true) {
        return EC_BOT_CORE_R4_NODE_OPTIONS;
    }
    throw new Error('ec_bot_core_release_not_approved');
};

export const EC_BOT_CORE_V78_ALLOWED_WRITE_CLASSES = Object.freeze([
    'zapi_inbound_persistence',
    'zapi_ack_persistence',
    'bot_conversation_state',
    'bot_outbound_reply',
    'panel_attendance_state'
]);

export const EC_BOT_CORE_V78_ALLOWED_MUTATION_ROUTES = Object.freeze(new Set([
    '/api/zapi/webhook',
    '/api/zapi/webhook/delivery',
    '/api/zapi/webhook/received',
    '/api/whatsapp/vsl-stage',
    '/api/whatsapp/vsl-entry'
]));

export const EC_BOT_CORE_V78_REQUIRED_TRUE_FLAGS = Object.freeze([
    EC_BOT_CORE_V78_FLAG,
    'VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED',
    'VIT_POWER_FUNNEL_ACTIVE',
    'WHATSAPP_AUTO_REPLY_ENABLED',
    'ZAPI_ROUTE_INBOUND_TO_BOT',
    'ZAPI_PERSIST_INBOUND_ENABLED',
    'ZAPI_PERSIST_ACK_ENABLED',
    'VSL_STAGE_PERSIST_ENABLED',
    'WHATSAPP_FUNNEL_ENABLED',
    'WHATSAPP_EC_ONLY_INBOUND',
    'WHATSAPP_EC_ONLY_OUTBOUND'
]);

export const EC_BOT_CORE_V78_REQUIRED_FALSE_FLAGS = Object.freeze([
    'VITALISMEN_STRICT_READ_ONLY',
    'VITALISMEN_CANARY_CTRL_V77_ENABLED',
    'VITALISMEN_CANARY_V75_ENABLED',
    'WHATSAPP_CONNECT_ENABLED',
    'WHATSAPP_AUTOMATION_PILOT_ONLY',
    'WHATSAPP_PRODUCT_FOLLOWUP_ENABLED',
    'PENDING_CHECKOUT_FOLLOWUP_ENABLED',
    'ADMIN_BUY_LATER_FOLLOWUP_ENABLED',
    'POST_SALE_REPURCHASE_30D_ENABLED',
    'TEX_ULTRA_CONFIRMED_POSTSALE_QUEUE_ENABLED',
    'SHIPMENT_STATUS_DISPATCH_ENABLED',
    'SHIPMENT_PICKUP_REMINDERS_ENABLED',
    'SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED',
    'SHIPMENT_GUIDE_PRINT_DISPATCH_ENABLED',
    'PICKUP_PROOF_SWEEP_ENABLED',
    'PICKUP_PROOF_BONUS_ENABLED',
    'WHATSAPP_BACKLOG_RECOVERY_ENABLED',
    'ADMIN_PANEL_IMPORT_ENABLED',
    'ADMIN_PANEL_ATENDIMENTO_RECONCILE_ENABLED',
    'ZAPI_CHAT_WATCHDOG_ENABLED',
    'PASSIVE_FUNNEL_OBSERVER_ENABLED',
    'NITRIX_FAST_STATE_ENABLED',
    'GOOGLE_CONTACTS_SYNC_ENABLED',
    'WHATSAPP_HEALTH_ALERT_ENABLED',
    'EC_ENGAGEMENT_AUTO_REPLY_ENABLED',
    'DROPPI_EC_ACTIVE_SYNC_ENABLED',
    'META_RETRO_SEND',
    'VITALISMEN_META_PURCHASE_ENABLED',
    'POST_SALE_V66_MUTATIONS_ENABLED',
    'POST_SALE_V66_COMPATIBILITY_BRIDGE_READY'
]);

export const EC_BOT_CORE_V78_EMPTY_FLAGS = Object.freeze([
    'POST_SALE_V66_MUTATIONS_AUTHORIZATION',
    'POST_SALE_V66_BRIDGE_APPLY_APPROVED',
    'META_TEST_EVENT_CODE_EC',
    'META_TEST_EVENT_CODE',
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
    'VITALISMEN_CANARY_V77_PROFILE_SHA256',
    'WHATSAPP_AUTOMATION_ALLOWED_RECIPIENTS',
    'WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS',
    'WHATSAPP_PRIORITY_TEST_PHONES'
]);

export const EC_BOT_CORE_V78_EXACT_QA_FLAGS = Object.freeze([
    'WHATSAPP_TEST_ALLOWED_RECIPIENTS',
    'WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS'
]);

const clean = (value = '') => String(value ?? '').trim();
const isTrue = (value) => clean(value).toLowerCase() === 'true';
const isFalse = (value) => clean(value).toLowerCase() === 'false';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

const EC_BOT_CORE_V78_CONTROLLED_FLAGS = Object.freeze([
    'NODE_ENV',
    'NODE_OPTIONS',
    'SAFE_OBSERVATION_POLICY',
    'VITALISMEN_EC_BOT_CORE_PROFILE_VERSION',
    'DISABLE_SCHEDULER',
    'DROPPI_EC_ACTIVE_SYNC_MODE',
    ...EC_BOT_CORE_V78_REQUIRED_TRUE_FLAGS,
    ...EC_BOT_CORE_V78_REQUIRED_FALSE_FLAGS,
    ...EC_BOT_CORE_V78_EMPTY_FLAGS,
    ...EC_BOT_CORE_V78_EXACT_QA_FLAGS
]);

const profilePayload = (env = {}) => Object.fromEntries(
    [...new Set(EC_BOT_CORE_V78_CONTROLLED_FLAGS)]
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, clean(env[key])])
);

export const calculateEcBotCoreV78ProfileSha256 = (env = {}) => hash(
    `${JSON.stringify(profilePayload(env))}\n`
);

export const buildEcBotCoreV78OverlayEnvironment = ({
    baseEnv = {}, nodeOptions = EC_BOT_CORE_V78_NODE_OPTIONS
} = {}) => {
    if (clean(baseEnv.META_PIXEL_ID_EC) !== EC_BOT_CORE_V78_DATASET_ID) {
        throw new Error('ec_bot_core_dataset_invalid');
    }
    if (nodeOptions !== EC_BOT_CORE_V78_NODE_OPTIONS
        && (nodeOptions !== EC_BOT_CORE_V199_NODE_OPTIONS || successorOverlayContext()?.loaded !== true)
        && (nodeOptions !== EC_BOT_CORE_R4_NODE_OPTIONS
            || globalThis.__VITALISMEN_R4_OPERATIONAL_CONTEXT?.loaded !== true)) {
        throw new Error('ec_bot_core_preload_not_approved');
    }

    const env = {
        NODE_ENV: 'production',
        NODE_OPTIONS: nodeOptions,
        SAFE_OBSERVATION_POLICY: EC_BOT_CORE_V78_MODE,
        VITALISMEN_EC_BOT_CORE_PROFILE_VERSION: String(EC_BOT_CORE_V78_VERSION),
        DISABLE_SCHEDULER: '1',
        DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY'
    };
    for (const flag of EC_BOT_CORE_V78_REQUIRED_TRUE_FLAGS) env[flag] = 'true';
    for (const flag of EC_BOT_CORE_V78_REQUIRED_FALSE_FLAGS) env[flag] = 'false';
    for (const flag of EC_BOT_CORE_V78_EMPTY_FLAGS) env[flag] = '';
    for (const flag of EC_BOT_CORE_V78_EXACT_QA_FLAGS) env[flag] = EC_BOT_CORE_V78_QA_PHONE;
    env.VITALISMEN_EC_BOT_CORE_PROFILE_SHA256 = calculateEcBotCoreV78ProfileSha256(env);
    return Object.freeze({ ...env });
};

export const serializeEcBotCoreV78Overlay = (env = {}) => {
    const keys = Object.keys(env).sort();
    for (const key of keys) {
        if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /[\r\n]/.test(clean(env[key]))) {
            throw new Error(`ec_bot_core_overlay_invalid:${key}`);
        }
    }
    return `${keys.map((key) => `${key}=${clean(env[key])}`).join('\n')}\n`;
};

export const parseEcBotCoreV78Overlay = (content = '') => {
    const env = {};
    for (const line of String(content).split(/\r?\n/)) {
        if (!line) continue;
        const separator = line.indexOf('=');
        if (separator <= 0) throw new Error('ec_bot_core_overlay_line_invalid');
        const key = line.slice(0, separator);
        if (!/^[A-Z][A-Z0-9_]*$/.test(key) || Object.hasOwn(env, key)) {
            throw new Error('ec_bot_core_overlay_key_invalid');
        }
        env[key] = line.slice(separator + 1);
    }
    return env;
};

export const ecBotCoreV78Requested = (env = process.env) => isTrue(env[EC_BOT_CORE_V78_FLAG]);

export const resolveEcBotCoreV78Configuration = (env = process.env, {
    browserPixelId = clean(env.META_PIXEL_ID_EC),
    serverDatasetId = clean(env.META_PIXEL_ID_EC)
} = {}) => {
    if (!ecBotCoreV78Requested(env)) {
        return Object.freeze({ enabled: false, ready: false, mode: '', failures: [] });
    }

    const failures = [];
    const metaCanonicalV195 = resolveMetaCanonicalConsolidationV195(env);
    const expectedNodeOptions = metaCanonicalV195.enabled
        ? EC_BOT_CORE_V195_NODE_OPTIONS
        : EC_BOT_CORE_V78_NODE_OPTIONS;
    if (clean(env.NODE_ENV).toLowerCase() !== 'production') failures.push('NODE_ENV_must_be_production');
    if (clean(env.NODE_OPTIONS) !== expectedNodeOptions
        && !(clean(env.NODE_OPTIONS) === EC_BOT_CORE_V199_NODE_OPTIONS
            && successorOverlayContext()?.loaded === true)
        && !(clean(env.NODE_OPTIONS) === EC_BOT_CORE_R4_NODE_OPTIONS
            && globalThis.__VITALISMEN_R4_OPERATIONAL_CONTEXT?.loaded === true)) {
        failures.push('NODE_OPTIONS_invalid');
    }
    if (clean(env.SAFE_OBSERVATION_POLICY).toUpperCase() !== EC_BOT_CORE_V78_MODE) {
        failures.push('SAFE_OBSERVATION_POLICY_invalid');
    }
    if (clean(env.VITALISMEN_EC_BOT_CORE_PROFILE_VERSION) !== String(EC_BOT_CORE_V78_VERSION)) {
        failures.push('profile_version_invalid');
    }
    if (clean(env.DISABLE_SCHEDULER) !== '1') failures.push('DISABLE_SCHEDULER_must_be_1');
    if (clean(env.DROPPI_EC_ACTIVE_SYNC_MODE).toUpperCase() !== 'REPORT_ONLY') {
        failures.push('DROPPI_EC_ACTIVE_SYNC_MODE_must_be_REPORT_ONLY');
    }
    for (const flag of EC_BOT_CORE_V78_REQUIRED_TRUE_FLAGS) {
        if (!isTrue(env[flag])) failures.push(`${flag}_must_be_true`);
    }
    for (const flag of EC_BOT_CORE_V78_REQUIRED_FALSE_FLAGS) {
        if (!isFalse(env[flag])) failures.push(`${flag}_must_be_false`);
    }
    for (const flag of EC_BOT_CORE_V78_EMPTY_FLAGS) {
        if (clean(env[flag])) failures.push(`${flag}_must_be_empty`);
    }
    for (const flag of EC_BOT_CORE_V78_EXACT_QA_FLAGS) {
        if (clean(env[flag]) !== EC_BOT_CORE_V78_QA_PHONE) failures.push(`${flag}_must_match_exact_qa`);
    }
    if (clean(env.META_PIXEL_ID_EC) !== EC_BOT_CORE_V78_DATASET_ID) failures.push('meta_dataset_changed');
    if (clean(browserPixelId) !== EC_BOT_CORE_V78_DATASET_ID) failures.push('browser_pixel_changed');
    if (clean(serverDatasetId) !== EC_BOT_CORE_V78_DATASET_ID) failures.push('server_dataset_changed');
    if (clean(browserPixelId) !== clean(serverDatasetId)) failures.push('browser_server_dataset_mismatch');

    const expectedProfileSha256 = calculateEcBotCoreV78ProfileSha256(env);
    if (clean(env.VITALISMEN_EC_BOT_CORE_PROFILE_SHA256) !== expectedProfileSha256) {
        failures.push('profile_sha256_invalid');
    }

    return Object.freeze({
        enabled: true,
        ready: failures.length === 0,
        mode: EC_BOT_CORE_V78_MODE,
        failures,
        schedulerMutationsAllowed: false,
        dropiApplyAllowed: false,
        metaPurchaseAllowed: false,
        allowedWriteClasses: EC_BOT_CORE_V78_ALLOWED_WRITE_CLASSES
    });
};

export const assertEcBotCoreV78Configuration = (env = process.env, options = {}) => {
    const configuration = resolveEcBotCoreV78Configuration(env, options);
    if (!configuration.enabled || !configuration.ready) {
        throw new Error(`ec_bot_core_configuration_invalid:${configuration.failures.join(',') || 'not_enabled'}`);
    }
    return configuration;
};

export const ecBotCoreV78RouteDecision = ({ method = '', path = '', env = process.env } = {}) => {
    const configuration = resolveEcBotCoreV78Configuration(env);
    if (!configuration.enabled) return Object.freeze({ enforced: false, allowed: true, reason: 'bot_core_disabled' });
    if (!configuration.ready) return Object.freeze({ enforced: true, allowed: false, reason: 'bot_core_invalid_fail_closed' });
    const normalizedMethod = clean(method).toUpperCase();
    const normalizedPath = clean(path).split('?')[0].replace(/\/+$/, '') || '/';
    if (['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod)) {
        return Object.freeze({ enforced: true, allowed: true, reason: 'bot_core_read' });
    }
    const allowed = normalizedMethod === 'POST' && EC_BOT_CORE_V78_ALLOWED_MUTATION_ROUTES.has(normalizedPath);
    return Object.freeze({
        enforced: true,
        allowed,
        reason: allowed ? 'bot_core_route_allowed' : 'bot_core_route_blocked'
    });
};

export const ecBotCoreV78ExternalEffectDecision = (effect = '', env = process.env) => {
    const configuration = resolveEcBotCoreV78Configuration(env);
    if (!configuration.enabled) return { allowed: true, enforced: false, reason: 'bot_core_disabled', effect: clean(effect) };
    if (!configuration.ready) return { allowed: false, enforced: true, reason: 'bot_core_invalid_fail_closed', effect: clean(effect) };
    const normalized = clean(effect).toLowerCase();
    const allowed = ['zapi_inbound', 'zapi_outbound_reply', 'panel_attendance_state'].includes(normalized);
    return {
        allowed,
        enforced: true,
        reason: allowed ? 'bot_core_effect_allowed' : `bot_core_${normalized || 'external'}_blocked`,
        effect: normalized
    };
};

export const ecBotCoreV78BlockedResult = (effect = '', env = process.env) => {
    const decision = ecBotCoreV78ExternalEffectDecision(effect, env);
    if (decision.allowed) return null;
    return { ok: false, blocked: true, reason: decision.reason, profile: EC_BOT_CORE_V78_MODE };
};

export const expectedEcBotCoreV78HealthDataset = (metaDestination = {}) => (
    clean(metaDestination?.profile) === EC_BOT_CORE_V195_CANONICAL_META_PROFILE
        ? EC_BOT_CORE_V195_CANONICAL_DATASET_ID
        : EC_BOT_CORE_V78_DATASET_ID
);

export const assertEcBotCoreV78Health = (health = {}, metaDestination = {}) => {
    const failures = [];
    const expectedDatasetId = expectedEcBotCoreV78HealthDataset(metaDestination);
    if (health.status !== 'online') failures.push('health_not_online');
    if (health.engine !== 'Z-API') failures.push('official_transport_not_zapi');
    if (health?.zapi?.connected !== true) failures.push('zapi_not_connected');
    if (health?.zapi?.outboundBlocked === true) failures.push('zapi_outbound_blocked');
    if (health?.automationSafety?.mode !== EC_BOT_CORE_V78_MODE) failures.push('bot_core_mode_not_effective');
    if (health?.automationSafety?.botCoreOperational !== true) failures.push('bot_core_not_operational');
    if (health?.automationSafety?.mutatingSchedulers !== 0) failures.push('mutating_schedulers_not_zero');
    if (health?.automationSafety?.dropiApplyAllowed !== false) failures.push('dropi_apply_not_blocked');
    if (health?.automationSafety?.metaPurchaseAllowed !== false) failures.push('meta_purchase_not_blocked');
    if (clean(metaDestination?.datasetId) !== expectedDatasetId) failures.push('meta_dataset_invalid');
    if (clean(metaDestination?.browserPixelId) !== expectedDatasetId) failures.push('browser_pixel_invalid');
    if (metaDestination?.browserServerSynchronized !== true) failures.push('browser_server_not_synchronized');
    if (failures.length) throw new Error(`ec_bot_core_health_invalid:${failures.join(',')}`);
    return { ok: true, failures: [] };
};
