import crypto from 'node:crypto';

import {
    EC_QA_TEST_CONTEXT_V78,
    EC_QA_TEST_PHONE_V78,
    EC_QA_TEST_REQUIRED_TAGS_V78,
    EC_QA_TEST_RESET_VERSION
} from './ecQaTestResetV78Service.js';

export const QA_CANARY_DEDUPE_VERSION_V168A_R2 = 'V168A_R2';
export const QA_CANARY_GREETING_STEP_V168A_R2 = 'greeting';

const clean = (value = '') => String(value ?? '').trim();
const stateId = (state = {}) => clean(state._id?.toString?.() || state._id);
const exactStatePhone = (state = {}) => clean(state.phoneDigits) === EC_QA_TEST_PHONE_V78
    && (
        !state.chatId
        || clean(state.chatId) === `${EC_QA_TEST_PHONE_V78}@c.us`
        || clean(state.chatId) === `${EC_QA_TEST_PHONE_V78}@s.whatsapp.net`
    );

const qaMetadataEligible = (state = {}) => {
    const tags = Array.isArray(state.tags) ? state.tags.map(clean) : [];
    return state.metadata?.testOnly === true
        && state.metadata?.botTestEnabled === true
        && state.metadata?.fullFunnelTestEnabled === true
        && EC_QA_TEST_REQUIRED_TAGS_V78.every((tag) => tags.includes(tag));
};

const blocked = (reason) => Object.freeze({ applicable: true, allowed: false, reason });
const normal = (reason) => Object.freeze({ applicable: false, allowed: false, reason });

export const qaCanaryGenerationHashV168AR2 = ({
    contactStateId,
    permitId,
    inboundMessageId,
    stepKey
} = {}) => crypto.createHash('sha256').update(`${JSON.stringify({
    version: QA_CANARY_DEDUPE_VERSION_V168A_R2,
    contactStateId: clean(contactStateId),
    permitId: clean(permitId),
    inboundMessageId: clean(inboundMessageId),
    stepKey: clean(stepKey)
})}\n`).digest('hex');

export const resolveQaCanaryDedupeGenerationV168AR2 = ({
    state = {},
    phone = '',
    inboundMessageId = '',
    stepKey = '',
    now = new Date()
} = {}) => {
    // Deliberately literal: formatted, partial and suffix-only values never enter
    // this QA layer. Non-QA traffic keeps the existing production identity.
    if (typeof phone !== 'string' || phone !== EC_QA_TEST_PHONE_V78) {
        return normal('not_exact_qa_phone');
    }
    if (!qaMetadataEligible(state)) return normal('qa_metadata_not_eligible');

    const context = state.metadata?.qaTestContextV78;
    if (!context || !clean(context.permitId)) return normal('qa_permit_absent');
    if (!exactStatePhone(state)) return blocked('qa_state_phone_mismatch');
    if (clean(state.human?.mode) !== 'auto') return blocked('qa_human_hold_active');
    if (Number(context.version) !== EC_QA_TEST_RESET_VERSION) return blocked('qa_permit_version_mismatch');
    if (clean(context.context) !== EC_QA_TEST_CONTEXT_V78) return blocked('qa_permit_context_mismatch');
    if (clean(context.phone) !== EC_QA_TEST_PHONE_V78) return blocked('qa_permit_phone_mismatch');
    if (!/^ecqa-v78-[a-f0-9]{32}$/.test(clean(context.permitId))) return blocked('qa_permit_id_invalid');

    const expiresAtMs = new Date(context.expiresAt).getTime();
    const nowMs = new Date(now).getTime();
    if (!Number.isFinite(expiresAtMs) || !Number.isFinite(nowMs) || expiresAtMs <= nowMs) {
        return blocked('qa_permit_expired');
    }

    const messageId = clean(inboundMessageId);
    const generationStep = clean(stepKey);
    if (!messageId) return blocked('qa_inbound_message_id_required');
    if (!generationStep) return blocked('qa_step_key_required');
    if (generationStep !== QA_CANARY_GREETING_STEP_V168A_R2) return blocked('qa_step_not_authorized');
    if ((context.priorProcessedMessageIds || []).map(clean).includes(messageId)) {
        return blocked('qa_old_inbound_message_reuse');
    }

    const status = clean(context.status);
    if (!['routing', 'consumed'].includes(status)) return blocked('qa_permit_not_claimed');
    if (messageId !== clean(context.routingMessageId)) return blocked('qa_routing_message_mismatch');
    if (status === 'consumed' && messageId !== clean(context.consumedMessageId)) {
        return blocked('qa_consumed_message_mismatch');
    }

    const contactStateId = stateId(state);
    if (!contactStateId) return blocked('qa_contact_state_id_required');
    const hash = qaCanaryGenerationHashV168AR2({
        contactStateId,
        permitId: context.permitId,
        inboundMessageId: messageId,
        stepKey: generationStep
    });
    const identity = `v168a_r2_qa:${hash}`;
    return Object.freeze({
        applicable: true,
        allowed: true,
        reason: status === 'consumed' ? 'qa_same_message_idempotent_continuation' : 'qa_fresh_claim_authorized',
        identity,
        dedupeValue: identity,
        antiSpamKey: identity,
        permitId: clean(context.permitId),
        inboundMessageId: messageId,
        stepKey: generationStep,
        hash
    });
};
