import crypto from 'node:crypto';

export const EC_QA_TEST_PHONE_V78 = '5515998038637';
export const EC_QA_TEST_CONTEXT_V78 = 'EC_V78_OFFICIAL_VSL_QA';
export const EC_QA_TEST_AUTHORIZATION_PHRASE_V78 = 'I_UNDERSTAND_EC_QA_RESET_V78';
export const EC_QA_TEST_RESET_VERSION = 78;
export const EC_QA_TEST_MAX_WINDOW_MS_V78 = 10 * 60 * 1000;
export const EC_QA_TEST_REQUIRED_TAGS_V78 = Object.freeze([
    'TESTE_8637_PRIORIDADE',
    'TESTE_FIXO_NAO_MEXER',
    'BOT_TESTE_LIBERADO'
]);

const clean = (value = '') => String(value ?? '').trim();
const iso = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : '';
};

export const assertExactEcQaPhoneV78 = (phone) => {
    if (typeof phone !== 'string' || phone !== EC_QA_TEST_PHONE_V78) {
        throw new Error('ec_qa_phone_must_match_exactly');
    }
    return phone;
};

const canonicalPermitPayload = (permit = {}) => ({
    version: Number(permit.version || 0),
    context: clean(permit.context),
    phone: clean(permit.phone),
    permitId: clean(permit.permitId),
    issuedAt: iso(permit.issuedAt),
    expiresAt: iso(permit.expiresAt),
    status: clean(permit.status)
});

export const calculateEcQaTestPermitSha256V78 = (permit = {}) => crypto
    .createHash('sha256')
    .update(`${JSON.stringify(canonicalPermitPayload(permit))}\n`)
    .digest('hex');

export const createEcQaTestPermitV78 = ({
    phone,
    now = new Date(),
    ttlMs = 5 * 60 * 1000,
    randomBytes = crypto.randomBytes
} = {}) => {
    assertExactEcQaPhoneV78(phone);
    const issuedAt = new Date(now);
    if (!Number.isFinite(issuedAt.getTime())) throw new Error('ec_qa_permit_time_invalid');
    const duration = Number(ttlMs);
    if (!Number.isFinite(duration) || duration <= 0 || duration > EC_QA_TEST_MAX_WINDOW_MS_V78) {
        throw new Error('ec_qa_permit_window_invalid');
    }
    const permit = {
        version: EC_QA_TEST_RESET_VERSION,
        context: EC_QA_TEST_CONTEXT_V78,
        phone: EC_QA_TEST_PHONE_V78,
        permitId: `ecqa-v78-${randomBytes(16).toString('hex')}`,
        issuedAt: issuedAt.toISOString(),
        expiresAt: new Date(issuedAt.getTime() + duration).toISOString(),
        status: 'authorized'
    };
    return Object.freeze({
        ...permit,
        sha256: calculateEcQaTestPermitSha256V78(permit)
    });
};

export const validateEcQaTestPermitV78 = (permit = {}, {
    phone,
    now = new Date()
} = {}) => {
    assertExactEcQaPhoneV78(phone);
    const failures = [];
    const canonical = canonicalPermitPayload(permit);
    const nowMs = new Date(now).getTime();
    const issuedAtMs = new Date(canonical.issuedAt).getTime();
    const expiresAtMs = new Date(canonical.expiresAt).getTime();
    if (canonical.version !== EC_QA_TEST_RESET_VERSION) failures.push('permit_version_invalid');
    if (canonical.context !== EC_QA_TEST_CONTEXT_V78) failures.push('permit_context_invalid');
    if (canonical.phone !== EC_QA_TEST_PHONE_V78) failures.push('permit_phone_invalid');
    if (!/^ecqa-v78-[a-f0-9]{32}$/.test(canonical.permitId)) failures.push('permit_id_invalid');
    if (canonical.status !== 'authorized') failures.push('permit_status_invalid');
    if (!Number.isFinite(nowMs) || !Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
        failures.push('permit_time_invalid');
    } else {
        if (issuedAtMs > nowMs) failures.push('permit_not_yet_valid');
        if (expiresAtMs <= nowMs) failures.push('permit_expired');
        if (expiresAtMs - issuedAtMs <= 0 || expiresAtMs - issuedAtMs > EC_QA_TEST_MAX_WINDOW_MS_V78) {
            failures.push('permit_window_invalid');
        }
    }
    if (clean(permit.sha256) !== calculateEcQaTestPermitSha256V78(canonical)) failures.push('permit_sha256_invalid');
    return Object.freeze({
        valid: failures.length === 0,
        failures,
        permit: canonical
    });
};

const exactStatePhone = (state = {}) => clean(state.phoneDigits) === EC_QA_TEST_PHONE_V78
    && (
        !state.chatId
        || clean(state.chatId) === `${EC_QA_TEST_PHONE_V78}@c.us`
        || clean(state.chatId) === `${EC_QA_TEST_PHONE_V78}@s.whatsapp.net`
    );

export const ecQaTestStateEligibleV78 = (state = {}) => {
    const tags = Array.isArray(state.tags) ? state.tags.map(clean) : [];
    return exactStatePhone(state)
        && state.metadata?.testOnly === true
        && state.metadata?.botTestEnabled === true
        && state.metadata?.fullFunnelTestEnabled === true
        && EC_QA_TEST_REQUIRED_TAGS_V78.every((tag) => tags.includes(tag));
};

export const planEcQaTestResetV78 = ({
    state,
    phone,
    permit,
    now = new Date()
} = {}) => {
    assertExactEcQaPhoneV78(phone);
    const permitValidation = validateEcQaTestPermitV78(permit, { phone, now });
    if (!permitValidation.valid) {
        return Object.freeze({ ready: false, idempotent: false, failures: permitValidation.failures });
    }
    if (!ecQaTestStateEligibleV78(state)) {
        return Object.freeze({ ready: false, idempotent: false, failures: ['qa_state_not_eligible'] });
    }
    const existing = state.metadata?.qaTestContextV78 || {};
    const idempotent = clean(existing.permitId) === permitValidation.permit.permitId
        && [
            'armed',
            'consumed',
            'contained'
        ].includes(clean(existing.status));
    return Object.freeze({
        ready: !idempotent,
        idempotent,
        failures: [],
        transition: idempotent ? 'noop' : 'arm',
        permitId: permitValidation.permit.permitId,
        previousHumanMode: clean(state.human?.mode),
        previousPausedUntil: iso(state.human?.pausedUntil)
    });
};

export const applyEcQaTestResetToStateV78 = ({
    state,
    phone,
    permit,
    now = new Date()
} = {}) => {
    const plan = planEcQaTestResetV78({ state, phone, permit, now });
    if (plan.failures.length) throw new Error(`ec_qa_reset_blocked:${plan.failures.join(',')}`);
    if (plan.idempotent) return Object.freeze({ changed: false, idempotent: true, state });

    const currentHuman = state.human || {};
    const currentMetadata = state.metadata || {};
    state.human = {
        ...currentHuman,
        mode: 'auto',
        pausedUntil: null
    };
    state.metadata = {
        ...currentMetadata,
        qaTestContextV78: {
            version: EC_QA_TEST_RESET_VERSION,
            context: EC_QA_TEST_CONTEXT_V78,
            phone: EC_QA_TEST_PHONE_V78,
            permitId: plan.permitId,
            status: 'armed',
            armedAt: new Date(now).toISOString(),
            expiresAt: permit.expiresAt,
            previousHumanMode: plan.previousHumanMode,
            previousPausedUntil: plan.previousPausedUntil,
            messageCount: 0,
            processedMessageIds: [],
            auditAction: 'temporary_human_hold_release_for_exact_qa'
        }
    };
    return Object.freeze({ changed: true, idempotent: false, state });
};

export const resolveEcQaTestContextV78 = (state = {}, {
    phone,
    permitId = '',
    messageId = '',
    allowConsumed = false,
    now = new Date()
} = {}) => {
    try {
        assertExactEcQaPhoneV78(phone);
    } catch {
        return Object.freeze({ ready: false, reason: 'qa_phone_invalid' });
    }
    if (!ecQaTestStateEligibleV78(state)) {
        return Object.freeze({ ready: false, reason: 'qa_state_not_eligible' });
    }
    if (clean(state.human?.mode) !== 'auto') {
        return Object.freeze({ ready: false, reason: 'qa_human_hold_active' });
    }
    const context = state.metadata?.qaTestContextV78 || {};
    if (context.version !== EC_QA_TEST_RESET_VERSION || clean(context.context) !== EC_QA_TEST_CONTEXT_V78) {
        return Object.freeze({ ready: false, reason: 'qa_context_invalid' });
    }
    if (clean(context.phone) !== EC_QA_TEST_PHONE_V78 || !/^ecqa-v78-[a-f0-9]{32}$/.test(clean(context.permitId))) {
        return Object.freeze({ ready: false, reason: 'qa_context_identity_invalid' });
    }
    const expiresAtMs = new Date(context.expiresAt).getTime();
    const nowMs = new Date(now).getTime();
    if (!Number.isFinite(expiresAtMs) || !Number.isFinite(nowMs) || expiresAtMs <= nowMs) {
        return Object.freeze({ ready: false, reason: 'qa_context_expired' });
    }
    const status = clean(context.status);
    if (status === 'armed') {
        return Object.freeze({ ready: true, reason: 'qa_context_armed', permitId: clean(context.permitId), status });
    }
    if (
        allowConsumed
        && status === 'consumed'
        && clean(permitId) === clean(context.permitId)
        && clean(messageId)
        && clean(messageId) === clean(context.consumedMessageId)
    ) {
        return Object.freeze({ ready: true, reason: 'qa_context_consumed_for_message', permitId: clean(context.permitId), status });
    }
    return Object.freeze({ ready: false, reason: `qa_context_${status || 'not_armed'}` });
};

export const consumeEcQaTestContextV78 = (state = {}, {
    phone,
    messageId,
    now = new Date()
} = {}) => {
    const context = resolveEcQaTestContextV78(state, { phone, now });
    if (!context.ready) throw new Error(`ec_qa_context_consume_blocked:${context.reason}`);
    if (!clean(messageId)) throw new Error('ec_qa_context_message_id_required');
    state.metadata = {
        ...(state.metadata || {}),
        qaTestContextV78: {
            ...(state.metadata?.qaTestContextV78 || {}),
            status: 'consumed',
            consumedAt: new Date(now).toISOString(),
            consumedMessageId: clean(messageId)
        }
    };
    return Object.freeze({ consumed: true, permitId: context.permitId, messageId: clean(messageId) });
};

export const containEcQaTestContextOnStateV78 = ({
    state,
    phone,
    permitId,
    now = new Date()
} = {}) => {
    assertExactEcQaPhoneV78(phone);
    if (!ecQaTestStateEligibleV78(state)) throw new Error('ec_qa_state_not_eligible');
    const context = state.metadata?.qaTestContextV78 || {};
    if (clean(context.permitId) !== clean(permitId) || !['armed', 'consumed', 'contained'].includes(clean(context.status))) {
        throw new Error('ec_qa_containment_identity_invalid');
    }
    if (context.status === 'contained') return Object.freeze({ changed: false, idempotent: true, state });
    if (clean(state.human?.mode) !== 'auto') {
        throw new Error('ec_qa_containment_real_human_state_protected');
    }
    state.human = {
        ...(state.human || {}),
        mode: context.previousHumanMode === 'manual' ? 'manual' : 'auto',
        pausedUntil: context.previousPausedUntil ? new Date(context.previousPausedUntil) : null
    };
    state.metadata = {
        ...(state.metadata || {}),
        qaTestContextV78: {
            ...context,
            status: 'contained',
            containedAt: new Date(now).toISOString(),
            auditAction: 'qa_context_contained_and_previous_hold_restored'
        }
    };
    return Object.freeze({ changed: true, idempotent: false, state });
};
