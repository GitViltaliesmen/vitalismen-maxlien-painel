export const CANARY_V75_QA_PHONE = '5515998038637';

export const CANARY_V75_FLAG = 'VITALISMEN_CANARY_V75_ENABLED';

const CANARY_RECIPIENT_LIST_FLAGS = Object.freeze([
    'WHATSAPP_AUTOMATION_ALLOWED_RECIPIENTS',
    'WHATSAPP_TEST_ALLOWED_RECIPIENTS',
    'WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS',
    'WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS',
    'WHATSAPP_PRIORITY_TEST_PHONES'
]);

const REQUIRED_TRUE_FLAGS = Object.freeze([
    'VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED',
    'VIT_POWER_FUNNEL_ACTIVE',
    'WHATSAPP_AUTO_REPLY_ENABLED',
    'ZAPI_ROUTE_INBOUND_TO_BOT',
    'WHATSAPP_FUNNEL_ENABLED',
    'SHIPMENT_STATUS_DISPATCH_ENABLED',
    'SHIPMENT_PICKUP_REMINDERS_ENABLED',
    'PICKUP_PROOF_SWEEP_ENABLED',
    'POST_SALE_V66_MUTATIONS_ENABLED',
    'POST_SALE_V66_COMPATIBILITY_BRIDGE_READY',
    'ZAPI_PERSIST_INBOUND_ENABLED',
    'ZAPI_PERSIST_ACK_ENABLED',
    'WHATSAPP_AUTOMATION_PILOT_ONLY',
    'WHATSAPP_EC_ONLY_INBOUND',
    'WHATSAPP_EC_ONLY_OUTBOUND'
]);

const REQUIRED_FALSE_FLAGS = Object.freeze([
    'VITALISMEN_STRICT_READ_ONLY',
    'WHATSAPP_PRODUCT_FOLLOWUP_ENABLED',
    'PENDING_CHECKOUT_FOLLOWUP_ENABLED',
    'POST_SALE_REPURCHASE_30D_ENABLED',
    'TEX_ULTRA_CONFIRMED_POSTSALE_QUEUE_ENABLED',
    'SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED',
    'SHIPMENT_GUIDE_PRINT_DISPATCH_ENABLED',
    'DROPPI_EC_ACTIVE_SYNC_ENABLED',
    'ADMIN_PANEL_IMPORT_ENABLED',
    'ADMIN_PANEL_ATENDIMENTO_RECONCILE_ENABLED',
    'WHATSAPP_BACKLOG_RECOVERY_ENABLED',
    'ADMIN_BUY_LATER_FOLLOWUP_ENABLED',
    'ZAPI_CHAT_WATCHDOG_ENABLED',
    'PASSIVE_FUNNEL_OBSERVER_ENABLED',
    'NITRIX_FAST_STATE_ENABLED',
    'GOOGLE_CONTACTS_SYNC_ENABLED',
    'WHATSAPP_HEALTH_ALERT_ENABLED',
    'PICKUP_PROOF_BONUS_ENABLED',
    'META_RETRO_SEND'
]);

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const clean = (value = '') => String(value || '').trim();
const isTrue = (value) => clean(value).toLowerCase() === 'true';
const isFalse = (value) => clean(value).toLowerCase() === 'false';

const uniquePhoneList = (value = '') => [...new Set(
    String(value || '')
        .split(',')
        .map((item) => digitsOnly(item))
        .filter(Boolean)
)];

const exactQaList = (value = '') => {
    const phones = uniquePhoneList(value);
    return phones.length === 1 && phones[0] === CANARY_V75_QA_PHONE;
};

export const canaryV75ExplicitlyEnabled = (env = process.env) => isTrue(env[CANARY_V75_FLAG]);

export const canaryV75EnforcementRequired = (env = process.env) => (
    canaryV75ExplicitlyEnabled(env)
    || (
        clean(env.NODE_ENV).toLowerCase() === 'production'
        && isTrue(env.VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED)
        && String(env.WHATSAPP_AUTOMATION_PILOT_ONLY || 'true').toLowerCase() !== 'false'
    )
);

export const resolveCanaryV75Configuration = (env = process.env) => {
    const enforcementRequired = canaryV75EnforcementRequired(env);
    if (!enforcementRequired) {
        return {
            enabled: false,
            ready: false,
            qaPhone: CANARY_V75_QA_PHONE,
            failures: []
        };
    }

    const failures = [];
    if (!canaryV75ExplicitlyEnabled(env)) failures.push(`${CANARY_V75_FLAG}_must_be_true`);
    if (clean(env.NODE_ENV).toLowerCase() !== 'production') failures.push('NODE_ENV_must_be_production');
    if (clean(env.DISABLE_SCHEDULER) !== '0') failures.push('DISABLE_SCHEDULER_must_be_0');
    if (clean(env.DROPPI_EC_ACTIVE_SYNC_MODE).toUpperCase() !== 'REPORT_ONLY') {
        failures.push('DROPPI_EC_ACTIVE_SYNC_MODE_must_be_REPORT_ONLY');
    }
    if (clean(env.POST_SALE_V66_MUTATIONS_AUTHORIZATION) !== 'I_UNDERSTAND_V66_OPERATIONAL_MUTATIONS') {
        failures.push('POST_SALE_V66_MUTATIONS_AUTHORIZATION_invalid');
    }
    if (clean(env.META_TEST_EVENT_CODE_EC) || clean(env.META_TEST_EVENT_CODE)) {
        failures.push('META_test_event_code_must_be_empty');
    }

    for (const flag of REQUIRED_TRUE_FLAGS) {
        if (!isTrue(env[flag])) failures.push(`${flag}_must_be_true`);
    }
    for (const flag of REQUIRED_FALSE_FLAGS) {
        if (!isFalse(env[flag])) failures.push(`${flag}_must_be_false`);
    }
    for (const flag of CANARY_RECIPIENT_LIST_FLAGS) {
        if (!exactQaList(env[flag])) failures.push(`${flag}_must_contain_only_QA`);
    }

    return {
        enabled: true,
        ready: failures.length === 0,
        qaPhone: CANARY_V75_QA_PHONE,
        failures
    };
};

export const assertCanaryV75RuntimeConfiguration = (env = process.env) => {
    const configuration = resolveCanaryV75Configuration(env);
    if (!configuration.enabled) return configuration;
    if (!configuration.ready) {
        const error = new Error(`canary_v75_configuration_invalid:${configuration.failures.join(',')}`);
        error.code = 'CANARY_V75_CONFIGURATION_INVALID';
        error.statusCode = 503;
        throw error;
    }
    return configuration;
};

export const evaluateCanaryV75Recipient = (phoneOrJid, {
    env = process.env,
    surface = 'unknown'
} = {}) => {
    const configuration = resolveCanaryV75Configuration(env);
    if (!configuration.enabled) {
        return { allowed: true, enforced: false, reason: 'canary_v75_disabled', surface };
    }
    if (!configuration.ready) {
        return { allowed: false, enforced: true, reason: 'canary_v75_configuration_invalid', surface };
    }
    const target = digitsOnly(phoneOrJid);
    if (!target) {
        return { allowed: false, enforced: true, reason: 'canary_v75_missing_recipient', surface };
    }
    const allowed = target === CANARY_V75_QA_PHONE;
    return {
        allowed,
        enforced: true,
        reason: allowed ? 'canary_v75_qa_recipient' : 'canary_v75_non_qa_recipient',
        surface
    };
};

export const assertCanaryV75Recipient = (phoneOrJid, options = {}) => {
    const decision = evaluateCanaryV75Recipient(phoneOrJid, options);
    if (decision.allowed) return decision;
    const error = new Error(decision.reason);
    error.code = 'CANARY_V75_RECIPIENT_BLOCKED';
    error.statusCode = 403;
    error.surface = decision.surface;
    throw error;
};

const exactFormattedPhoneRegex = (phone = CANARY_V75_QA_PHONE) => new RegExp(
    `^\\D*${digitsOnly(phone).split('').join('\\D*')}\\D*$`
);

export const buildCanaryV75RecipientQuery = (path = 'client.phone', env = process.env) => {
    const configuration = resolveCanaryV75Configuration(env);
    if (!configuration.enabled) return {};
    if (!configuration.ready) return { _id: { $exists: false } };
    return { [path]: exactFormattedPhoneRegex() };
};

export const canaryV75SchedulerShipmentAllowed = (shipment = {}, env = process.env) => (
    evaluateCanaryV75Recipient(shipment?.client?.phone, {
        env,
        surface: 'scheduler_candidate'
    })
);

export const evaluateCanaryV75ExternalEffect = (effect = '', env = process.env) => {
    const configuration = resolveCanaryV75Configuration(env);
    if (!configuration.enabled) {
        return { allowed: true, enforced: false, reason: 'canary_v75_disabled', effect: clean(effect) };
    }
    return {
        allowed: false,
        enforced: true,
        reason: `canary_v75_${clean(effect).toLowerCase() || 'external'}_blocked`,
        effect: clean(effect)
    };
};

export const assertCanaryV75ExternalEffectBlocked = (effect = '', env = process.env) => {
    const decision = evaluateCanaryV75ExternalEffect(effect, env);
    if (decision.allowed) return decision;
    const error = new Error(decision.reason);
    error.code = 'CANARY_V75_EXTERNAL_EFFECT_BLOCKED';
    error.statusCode = 403;
    error.effect = decision.effect;
    throw error;
};

export const canaryV75BlockedResult = (effect = '', env = process.env) => {
    const decision = evaluateCanaryV75ExternalEffect(effect, env);
    if (decision.allowed) return null;
    return {
        ok: false,
        blocked: true,
        reason: decision.reason,
        canary: 'V75'
    };
};

export const CANARY_V75_RECIPIENT_LIST_FLAGS = CANARY_RECIPIENT_LIST_FLAGS;
export const CANARY_V75_REQUIRED_TRUE_FLAGS = REQUIRED_TRUE_FLAGS;
export const CANARY_V75_REQUIRED_FALSE_FLAGS = REQUIRED_FALSE_FLAGS;
