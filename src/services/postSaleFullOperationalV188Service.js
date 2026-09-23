import crypto from 'node:crypto';

import {
    POST_SALE_STAGES,
    V66_MUTATION_AUTHORIZATION
} from './postSaleSafetyV66Service.js';

export const POST_SALE_FULL_OPERATIONAL_V188_VERSION = 188;
export const POST_SALE_FULL_OPERATIONAL_V188_FLAG = 'VITALISMEN_EC_POSTSALE_FULL_OPERATIONAL_V188';
export const POST_SALE_FULL_OPERATIONAL_V188_PROFILE = 'EC_POST_SALE_FULL_OPERATIONAL_V188';

export const POST_SALE_V188_ALLOWED_WRITE_CLASSES = Object.freeze([
    'post_sale_ledger',
    'post_sale_notification_lock',
    'post_sale_outbound',
    'post_sale_schedule_state',
    'post_sale_logistics_state',
    'post_sale_dropi_tracking_state'
]);

export const POST_SALE_V188_STAGES = Object.freeze([
    POST_SALE_STAGES.GUIDE,
    POST_SALE_STAGES.IN_TRANSIT,
    POST_SALE_STAGES.READY_FOR_PICKUP,
    POST_SALE_STAGES.RETURNED,
    POST_SALE_STAGES.PICKUP_REMINDER_DAY1,
    POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY2,
    POST_SALE_STAGES.PICKUP_REMINDER_DAY3,
    POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY4,
    POST_SALE_STAGES.PICKUP_REMINDER_DAY5,
    POST_SALE_STAGES.PICKUP_REMINDER_SOFT_DAY6,
    POST_SALE_STAGES.PICKUP_PROOF_REQUEST,
    POST_SALE_STAGES.DELIVERED_THANK_YOU,
    POST_SALE_STAGES.PICKUP_BONUS,
    POST_SALE_STAGES.PRODUCT_USAGE,
    POST_SALE_STAGES.TREATMENT_REFILL_REMINDER
]);

const EXPECTED_PROFILE = Object.freeze({
    [POST_SALE_FULL_OPERATIONAL_V188_FLAG]: 'true',
    VITALISMEN_EC_POSTSALE_FULL_OPERATIONAL_PROFILE_VERSION: '188',
    SAFE_OBSERVATION_POLICY: POST_SALE_FULL_OPERATIONAL_V188_PROFILE,
    // O executor é um processo separado. O PM2 continua em BOT CORE, mas esta
    // identidade não pode ser reutilizada aqui porque a V78 exige todos os
    // schedulers desligados e um write context HTTP próprio.
    VITALISMEN_EC_BOT_CORE_OPERATIONAL: 'false',
    VITALISMEN_STRICT_READ_ONLY: 'false',
    VITALISMEN_EC_POSTSALE_TRANSACTIONAL_OPERATIONAL: 'true',
    POST_SALE_TRANSACTIONAL_AT_MOST_ONCE_V116_ENABLED: 'true',
    POST_SALE_V66_MUTATIONS_ENABLED: 'true',
    POST_SALE_V66_MUTATIONS_AUTHORIZATION: V66_MUTATION_AUTHORIZATION,
    POST_SALE_V66_COMPATIBILITY_BRIDGE_READY: 'true',
    POST_SALE_V66_BRIDGE_APPLY_APPROVED: '',
    DISABLE_SCHEDULER: '1',
    SHIPMENT_STATUS_DISPATCH_ENABLED: 'true',
    SHIPMENT_STATUS_DISPATCH_ACTIONS: 'guide,in_transit,ready_for_pickup,returned',
    SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT: '1',
    SHIPMENT_STATUS_DISPATCH_ADAPTIVE_ENABLED: 'false',
    // A V116 exige limite positivo para materializar a reserva at-most-once.
    // A quota é escopada por cliente+pedido+shipment+evento+template.
    SHIPMENT_STATUS_DISPATCH_DAILY_LIMIT: '1',
    SHIPMENT_STATUS_DISPATCH_DAILY_LIMIT_PER_SESSION: '0',
    SHIPMENT_STATUS_DISPATCH_HOURLY_LIMIT_PER_SESSION: '0',
    SHIPMENT_STATUS_DISPATCH_SPREAD_ENABLED: 'false',
    SHIPMENT_STATUS_DISPATCH_REFRESH_BEFORE_SEND: 'true',
    SHIPMENT_STATUS_DISPATCH_REFRESH_LIMIT: '1',
    SHIPMENT_STATUS_DISPATCH_CARRIER_REFRESH_ENABLED: 'true',
    SHIPMENT_STATUS_DISPATCH_TIME_ZONE: 'America/Guayaquil',
    SHIPMENT_STATUS_DISPATCH_WINDOW_START: '08:00',
    SHIPMENT_STATUS_DISPATCH_WINDOW_END: '19:00',
    SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED: 'true',
    SHIPMENT_CARRIER_STATUS_SWEEP_BATCH_LIMIT: '6',
    SHIPMENT_CARRIER_STATUS_SWEEP_INTERVAL_MINUTES: '60',
    DROPPI_PAYMENT_CLAIM_NOTIFY_ENABLED: 'false',
    DROPPI_PAYMENT_CLAIM_LIVE_CHECK_ENABLED: 'false',
    SHIPMENT_PICKUP_REMINDERS_ENABLED: 'true',
    SHIPMENT_PICKUP_REMINDER_BATCH_LIMIT: '1',
    PICKUP_PROOF_SWEEP_ENABLED: 'true',
    POST_SALE_REPURCHASE_30D_ENABLED: 'false',
    POST_SALE_REFILL_V188_ENABLED: 'true',
    POST_SALE_REFILL_V188_BATCH_LIMIT: '1',
    POST_SALE_REPURCHASE_DELAY_DAYS_1: '25',
    POST_SALE_REPURCHASE_DELAY_DAYS_2: '50',
    POST_SALE_REPURCHASE_DELAY_DAYS_3: '70',
    TEX_ULTRA_CONFIRMED_POSTSALE_QUEUE_ENABLED: 'false',
    SHIPMENT_GUIDE_PRINT_DISPATCH_ENABLED: 'false',
    WHATSAPP_BACKLOG_RECOVERY_ENABLED: 'false',
    DROPPI_EC_ACTIVE_SYNC_ENABLED: 'false',
    DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY',
    VITALISMEN_META_PURCHASE_ENABLED: 'false',
    META_RETRO_SEND: 'false',
    WHATSAPP_CONNECT_ENABLED: 'false',
    POST_SALE_V188_CYCLE_OUTBOUND_LIMIT: '1',
    POST_SALE_V194_FORWARD_ONLY_ENABLED: 'true',
    POST_SALE_DROPI_TRACKING_RECONCILER_V194_ENABLED: 'true',
    POST_SALE_DROPI_TRACKING_BATCH_LIMIT: '8',
    POST_SALE_DROPI_TRACKING_DAILY_LIMIT: '12'
});

const clean = (value = '') => String(value ?? '').trim();
const sha256 = (value = '') => crypto.createHash('sha256').update(value).digest('hex');

const profilePayload = (env = {}) => Object.fromEntries(
    Object.keys(EXPECTED_PROFILE)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, clean(env[key])])
);

export const calculatePostSaleV188ProfileSha256 = (env = {}) => sha256(
    `${JSON.stringify(profilePayload(env))}\n`
);

export const buildPostSaleFullOperationalV188Overlay = ({ forwardOnlySince = new Date().toISOString() } = {}) => {
    const overlay = { ...EXPECTED_PROFILE };
    const cutoff = new Date(forwardOnlySince);
    if (!Number.isFinite(cutoff.getTime())) throw new Error('post_sale_v194_forward_only_since_invalid');
    overlay.POST_SALE_V194_FORWARD_ONLY_SINCE = cutoff.toISOString();
    overlay.POST_SALE_V188_ALLOWED_WRITE_CLASSES = POST_SALE_V188_ALLOWED_WRITE_CLASSES.join(',');
    overlay.POST_SALE_V188_PROFILE_SHA256 = calculatePostSaleV188ProfileSha256(overlay);
    return Object.freeze(overlay);
};

export const serializePostSaleFullOperationalV188Overlay = (env = {}) => {
    const keys = Object.keys(env).sort((left, right) => left.localeCompare(right));
    for (const key of keys) {
        if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /[\r\n]/.test(clean(env[key]))) {
            throw new Error(`post_sale_v188_overlay_invalid:${key}`);
        }
    }
    return `${keys.map((key) => `${key}=${clean(env[key])}`).join('\n')}\n`;
};

export const resolvePostSaleFullOperationalV188Configuration = (env = process.env) => {
    const enabled = clean(env[POST_SALE_FULL_OPERATIONAL_V188_FLAG]).toLowerCase() === 'true';
    if (!enabled) return Object.freeze({ enabled: false, ready: false, failures: ['v188_not_enabled'] });
    const expected = buildPostSaleFullOperationalV188Overlay({
        forwardOnlySince: clean(env.POST_SALE_V194_FORWARD_ONLY_SINCE)
    });
    const failures = [];
    for (const [key, value] of Object.entries(expected)) {
        if (clean(env[key]) !== value) failures.push(`${key}_invalid`);
    }
    const allowedWriteClasses = clean(env.POST_SALE_V188_ALLOWED_WRITE_CLASSES)
        .split(',').map((item) => clean(item)).filter(Boolean);
    if (allowedWriteClasses.includes('*')) failures.push('wildcard_write_class_forbidden');
    if (JSON.stringify(allowedWriteClasses) !== JSON.stringify(POST_SALE_V188_ALLOWED_WRITE_CLASSES)) {
        failures.push('allowed_write_classes_invalid');
    }
    return Object.freeze({
        enabled,
        ready: failures.length === 0,
        failures,
        profile: POST_SALE_FULL_OPERATIONAL_V188_PROFILE,
        stages: POST_SALE_V188_STAGES,
        allowedWriteClasses,
        cycleOutboundLimit: 1,
        timeZone: 'America/Guayaquil',
        sendWindow: '08:00-19:00',
        dropiMode: 'REPORT_ONLY',
        metaPurchase: false,
        baileys: false,
        globalBacklogRecovery: false
    });
};

export const assertPostSaleFullOperationalV188Configuration = (env = process.env) => {
    const result = resolvePostSaleFullOperationalV188Configuration(env);
    if (!result.ready) throw new Error(`post_sale_v188_configuration_invalid:${result.failures.join(',')}`);
    return result;
};

const minutesInGuayaquil = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Guayaquil',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
    return (hour * 60) + minute;
};

export const isPostSaleV188SendWindowOpen = (date = new Date()) => {
    const minutes = minutesInGuayaquil(date);
    return minutes >= (8 * 60) && minutes < (19 * 60);
};
