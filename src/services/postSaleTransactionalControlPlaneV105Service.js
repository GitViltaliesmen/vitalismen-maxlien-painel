import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const POST_SALE_TRANSACTIONAL_V105_VERSION = 105;
export const POST_SALE_TRANSACTIONAL_V105_FLAG = 'VITALISMEN_EC_POSTSALE_TRANSACTIONAL_OPERATIONAL';
export const POST_SALE_TRANSACTIONAL_V105_MODE = 'EC_POST_SALE_TRANSACTIONAL';
export const POST_SALE_TRANSACTIONAL_V105_DATASET_ID = '1468946114265008';
export const POST_SALE_TRANSACTIONAL_V105_NODE_OPTIONS = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v97-context.mjs';
export const POST_SALE_TRANSACTIONAL_V105_MANIFEST_PATH = 'docs/freeze/post-sale-transactional-control-plane-v105-20260903.json';
export const POST_SALE_TRANSACTIONAL_V105_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const POST_SALE_TRANSACTIONAL_V105_PARENT_COMMIT = '3550ef487750128b0a6e5a6051693f66100e9779';
export const POST_SALE_TRANSACTIONAL_V105_PARENT_TREE = '67ecf98b63a1a5d2b07131b6fa53a3eb84670d7b';
export const POST_SALE_TRANSACTIONAL_V105_PARENT_MANIFEST_SHA256 = '3c2dc695b42e4bb4f197a2be6fc8546676af7631e8a42e11b13a9038d3e4eefa';
export const POST_SALE_TRANSACTIONAL_V105_PARENT_FREEZE_SHA256 = '4f50f53d1e2bdc8766ee00dd8bf34d727a91b7befdc55beb09fddfa43ced7611';
export const POST_SALE_TRANSACTIONAL_V105_PARENT_ATTESTATION_SHA256 = '84caf0a25cb7617a2543578a37007eaab596096a54820499166619bb67f3e08e';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const clean = (value = '') => String(value ?? '').trim();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[POST-SALE-V105] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[POST-SALE-V105] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) throw new Error(`[POST-SALE-V105] ${label}_not_canonical`);
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[POST-SALE-V105] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

export const POST_SALE_TRANSACTIONAL_V105_ANCESTOR_OVERRIDES = Object.freeze([
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/services/canaryControllerV77Service.js',
    'src/services/ecBotCoreLifecycleBootV88Service.js',
    'src/services/postSaleNotificationDecisionService.js'
]);

export const POST_SALE_TRANSACTIONAL_V105_NEW_PROTECTED_FILES = Object.freeze([
    'docs/POST_SALE_TRANSACTIONAL_CONTROL_PLANE_FREEZE_V105_20260903.md',
    'docs/evidence/post-sale-transactional-control-plane-v105-attestation-20260903.json',
    'ops/post-sale-v105',
    'scripts/guard-post-sale-transactional-control-plane-v105.mjs',
    'scripts/lib/post-sale-transactional-control-plane-v105.mjs',
    'scripts/post-sale-transactional-batch-v105.mjs',
    'src/services/postSaleTransactionalControlPlaneFreezeRuntimeGuardV105.js',
    'src/services/postSaleTransactionalControlPlaneV105Service.js',
    'tests/post-sale-transactional-control-plane-v105.test.mjs'
]);

const EXPECTED_PROFILE = Object.freeze({
    NODE_ENV: 'production',
    NODE_OPTIONS: POST_SALE_TRANSACTIONAL_V105_NODE_OPTIONS,
    SAFE_OBSERVATION_POLICY: POST_SALE_TRANSACTIONAL_V105_MODE,
    VITALISMEN_EC_POSTSALE_TRANSACTIONAL_OPERATIONAL: 'true',
    VITALISMEN_EC_POSTSALE_TRANSACTIONAL_PROFILE_VERSION: '105',
    VITALISMEN_EC_BOT_CORE_OPERATIONAL: 'false',
    VITALISMEN_STRICT_READ_ONLY: 'false',
    VITALISMEN_CANARY_V75_ENABLED: 'false',
    VITALISMEN_CANARY_CTRL_V77_ENABLED: 'false',
    VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'true',
    VIT_POWER_FUNNEL_ACTIVE: 'true',
    WHATSAPP_AUTO_REPLY_ENABLED: 'true',
    ZAPI_ROUTE_INBOUND_TO_BOT: 'true',
    ZAPI_PERSIST_INBOUND_ENABLED: 'true',
    ZAPI_PERSIST_ACK_ENABLED: 'true',
    VSL_STAGE_PERSIST_ENABLED: 'true',
    WHATSAPP_FUNNEL_ENABLED: 'true',
    WHATSAPP_EC_ONLY_INBOUND: 'true',
    WHATSAPP_EC_ONLY_OUTBOUND: 'true',
    WHATSAPP_CONNECT_ENABLED: 'false',
    WHATSAPP_AUTOMATION_PILOT_ONLY: 'false',
    DISABLE_SCHEDULER: '0',
    POST_SALE_V66_MUTATIONS_ENABLED: 'true',
    POST_SALE_V66_MUTATIONS_AUTHORIZATION: 'I_UNDERSTAND_V66_OPERATIONAL_MUTATIONS',
    POST_SALE_V66_COMPATIBILITY_BRIDGE_READY: 'true',
    POST_SALE_V66_BRIDGE_APPLY_APPROVED: '',
    SHIPMENT_STATUS_DISPATCH_ENABLED: 'true',
    SHIPMENT_STATUS_DISPATCH_ACTIONS: 'guide,in_transit,ready_for_pickup,returned,delivered_bonus',
    SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT: '1',
    SHIPMENT_STATUS_DISPATCH_ADAPTIVE_ENABLED: 'false',
    SHIPMENT_STATUS_DISPATCH_DAILY_LIMIT: '1',
    SHIPMENT_STATUS_DISPATCH_DAILY_LIMIT_PER_SESSION: '1',
    SHIPMENT_STATUS_DISPATCH_HOURLY_LIMIT_PER_SESSION: '1',
    SHIPMENT_STATUS_DISPATCH_SPREAD_ENABLED: 'false',
    SHIPMENT_STATUS_DISPATCH_REFRESH_BEFORE_SEND: 'true',
    SHIPMENT_STATUS_DISPATCH_REFRESH_LIMIT: '1',
    SHIPMENT_STATUS_DISPATCH_CARRIER_REFRESH_ENABLED: 'true',
    SHIPMENT_PICKUP_REMINDERS_ENABLED: 'false',
    PICKUP_PROOF_SWEEP_ENABLED: 'false',
    SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED: 'false',
    SHIPMENT_GUIDE_PRINT_DISPATCH_ENABLED: 'false',
    WHATSAPP_PRODUCT_FOLLOWUP_ENABLED: 'false',
    PENDING_CHECKOUT_FOLLOWUP_ENABLED: 'false',
    POST_SALE_REPURCHASE_30D_ENABLED: 'false',
    TEX_ULTRA_CONFIRMED_POSTSALE_QUEUE_ENABLED: 'false',
    DROPPI_EC_ACTIVE_SYNC_ENABLED: 'false',
    DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY',
    WHATSAPP_BACKLOG_RECOVERY_ENABLED: 'false',
    ADMIN_PANEL_IMPORT_ENABLED: 'false',
    ADMIN_PANEL_ATENDIMENTO_RECONCILE_ENABLED: 'false',
    ADMIN_BUY_LATER_FOLLOWUP_ENABLED: 'false',
    ZAPI_CHAT_WATCHDOG_ENABLED: 'false',
    PASSIVE_FUNNEL_OBSERVER_ENABLED: 'false',
    NITRIX_FAST_STATE_ENABLED: 'false',
    GOOGLE_CONTACTS_SYNC_ENABLED: 'false',
    WHATSAPP_HEALTH_ALERT_ENABLED: 'false',
    PICKUP_PROOF_BONUS_ENABLED: 'false',
    META_RETRO_SEND: 'false',
    VITALISMEN_META_PURCHASE_ENABLED: 'false',
    META_TEST_EVENT_CODE_EC: '',
    META_TEST_EVENT_CODE: '',
    WHATSAPP_AUTOMATION_ALLOWED_RECIPIENTS: '',
    WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS: '',
    WHATSAPP_PRIORITY_TEST_PHONES: ''
});

const PROFILE_IDENTITY_FLAGS = Object.freeze([
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

export const POST_SALE_TRANSACTIONAL_V105_CONTROLLED_FLAGS = Object.freeze([
    ...Object.keys(EXPECTED_PROFILE),
    ...PROFILE_IDENTITY_FLAGS,
    'VITALISMEN_EC_POSTSALE_TRANSACTIONAL_PROFILE_SHA256'
]);

const profilePayload = (env = {}) => Object.fromEntries(
    [...new Set(POST_SALE_TRANSACTIONAL_V105_CONTROLLED_FLAGS)]
        .filter((key) => key !== 'VITALISMEN_EC_POSTSALE_TRANSACTIONAL_PROFILE_SHA256')
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, clean(env[key])])
);

export const calculatePostSaleTransactionalV105ProfileSha256 = (env = {}) => sha256(
    `${JSON.stringify(profilePayload(env))}\n`
);

export const buildPostSaleTransactionalV105Overlay = ({ baseEnv = {} } = {}) => {
    if (clean(baseEnv.META_PIXEL_ID_EC) !== POST_SALE_TRANSACTIONAL_V105_DATASET_ID) {
        throw new Error('post_sale_v105_dataset_invalid');
    }
    const env = { ...EXPECTED_PROFILE };
    for (const key of PROFILE_IDENTITY_FLAGS) env[key] = '';
    env.VITALISMEN_EC_POSTSALE_TRANSACTIONAL_PROFILE_SHA256 = calculatePostSaleTransactionalV105ProfileSha256(env);
    return Object.freeze({ ...env });
};

export const serializePostSaleTransactionalV105Overlay = (env = {}) => {
    const keys = Object.keys(env).sort();
    for (const key of keys) {
        if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /[\r\n]/.test(clean(env[key]))) {
            throw new Error(`post_sale_v105_overlay_invalid:${key}`);
        }
    }
    return `${keys.map((key) => `${key}=${clean(env[key])}`).join('\n')}\n`;
};

export const resolvePostSaleTransactionalV105Configuration = (env = process.env) => {
    if (clean(env[POST_SALE_TRANSACTIONAL_V105_FLAG]).toLowerCase() !== 'true') {
        return Object.freeze({ enabled: false, ready: false, failures: [] });
    }
    const failures = [];
    const expected = buildPostSaleTransactionalV105Overlay({ baseEnv: env });
    for (const [key, value] of Object.entries(expected)) {
        if (clean(env[key]) !== value) failures.push(`${key}_invalid`);
    }
    return Object.freeze({
        enabled: true,
        ready: failures.length === 0,
        mode: POST_SALE_TRANSACTIONAL_V105_MODE,
        failures,
        batchMax: 1,
        dailyMax: 1,
        backlogEnabled: false,
        dropiMode: 'REPORT_ONLY',
        dropiApplyAllowed: false,
        metaRetroactiveAllowed: false
    });
};

export const assertPostSaleTransactionalV105Configuration = (env = process.env) => {
    const result = resolvePostSaleTransactionalV105Configuration(env);
    if (!result.enabled || !result.ready) throw new Error(`post_sale_v105_configuration_invalid:${result.failures.join(',') || 'not_enabled'}`);
    return result;
};

const assertParentV104 = () => {
    const identities = new Map([
        ['docs/freeze/dropi-manual-transport-v104-20260902.json', POST_SALE_TRANSACTIONAL_V105_PARENT_MANIFEST_SHA256],
        ['docs/DROPI_MANUAL_TRANSPORT_FREEZE_V104_20260902.md', POST_SALE_TRANSACTIONAL_V105_PARENT_FREEZE_SHA256],
        ['docs/evidence/dropi-manual-transport-v104-attestation-20260902.json', POST_SALE_TRANSACTIONAL_V105_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (fileSha256(relativePath) !== expectedHash) throw new Error(`[POST-SALE-V105] parent_identity_invalid:${relativePath}`);
    }
    const parent = canonicalJson('docs/freeze/dropi-manual-transport-v104-20260902.json', 'parent_manifest');
    if (parent.version !== 104 || parent.freezeId !== 'dropi-manual-transport-v104'
        || parent.policy?.automaticRetryAllowed !== false || parent.policy?.postSaleActivationIncluded !== false) {
        throw new Error('[POST-SALE-V105] parent_policy_invalid');
    }
    const modified = new Set(POST_SALE_TRANSACTIONAL_V105_ANCESTOR_OVERRIDES);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) throw new Error(`[POST-SALE-V105] parent_protected_file_invalid:${relativePath}`);
    }
};

export const assertPostSaleTransactionalV105Manifest = () => {
    assertParentV104();
    const manifest = canonicalJson(POST_SALE_TRANSACTIONAL_V105_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'post-sale-transactional-control-plane-v105'
        || manifest.version !== POST_SALE_TRANSACTIONAL_V105_VERSION
        || manifest.parentVersion !== 'V104'
        || manifest.parentCommit !== POST_SALE_TRANSACTIONAL_V105_PARENT_COMMIT
        || manifest.parentTree !== POST_SALE_TRANSACTIONAL_V105_PARENT_TREE
        || manifest.parentManifestSha256 !== POST_SALE_TRANSACTIONAL_V105_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'ACTIVATE_TRANSACTIONAL_POST_SALE_WITH_BATCH_ONE_AND_NO_BACKLOG'
        || JSON.stringify(overrides) !== JSON.stringify(POST_SALE_TRANSACTIONAL_V105_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(POST_SALE_TRANSACTIONAL_V105_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.batchMax !== 1
        || manifest.policy?.dailyMax !== 1
        || manifest.policy?.historicalBacklogEnabled !== false
        || manifest.policy?.dropiMode !== 'REPORT_ONLY'
        || manifest.policy?.dropiApplyAllowed !== false
        || manifest.policy?.metaRetroactiveAllowed !== false
        || manifest.policy?.humanModeManualBlocked !== true
        || manifest.policy?.chronologyGuardRequired !== true) {
        throw new Error('[POST-SALE-V105] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[POST_SALE_TRANSACTIONAL_V105_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[POST-SALE-V105] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) throw new Error('[POST-SALE-V105] logical_bundle_invalid');
    return Object.freeze({
        ready: true,
        failures: [],
        manifest,
        overrides,
        manifestSha256: fileSha256(POST_SALE_TRANSACTIONAL_V105_MANIFEST_PATH)
    });
};

export const assertPostSaleTransactionalV105Health = (health = {}) => {
    const safety = health?.automationSafety || {};
    const failures = [];
    if (health.status !== 'online') failures.push('health_not_online');
    if (health.engine !== 'Z-API' || health?.zapi?.connected !== true) failures.push('zapi_not_connected');
    if (safety.operationalMutationsEnabled !== true) failures.push('post_sale_mutations_not_enabled');
    if (safety.compatibilityBridgeComplete !== true) failures.push('compatibility_bridge_incomplete');
    if (Number(safety.dataCompatibilityVersion) !== 66 || Number(safety.minimumRuntimeVersion) !== 66) failures.push('data_compatibility_invalid');
    if (safety.dropiSyncMode !== 'REPORT_ONLY' || safety.dropiApplyAllowed !== false) failures.push('dropi_not_report_only');
    if (failures.length) throw new Error(`post_sale_v105_health_invalid:${failures.join(',')}`);
    return { ok: true, failures: [] };
};
