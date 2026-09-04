import { EC_QA_TEST_REQUIRED_TAGS_V78 } from './ecQaTestResetV78Service.js';

export const EC_QA_PERMANENT_TEST_V126_PHONE = '5515998038637';
export const EC_QA_PERMANENT_TEST_V126_RESET_AUTHORIZATION = 'I_UNDERSTAND_EC_QA_8637_SAFE_RESET_V126';

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');

export const isExactEcQaPhoneV126 = (...values) => values
    .map(digitsOnly)
    .filter(Boolean)
    .some((value) => value === EC_QA_PERMANENT_TEST_V126_PHONE);

export const isEcQaPermanentTestStateV126 = (state = {}) => {
    const tags = Array.isArray(state.tags) ? state.tags.map(String) : [];
    const normalizedChatId = String(state.chatId || '').trim();
    return digitsOnly(state.phoneDigits) === EC_QA_PERMANENT_TEST_V126_PHONE
        && [
            `${EC_QA_PERMANENT_TEST_V126_PHONE}@c.us`,
            `${EC_QA_PERMANENT_TEST_V126_PHONE}@s.whatsapp.net`
        ].includes(normalizedChatId)
        && state.metadata?.testOnly === true
        && state.metadata?.outboundTestOnly === true
        && state.metadata?.botTestEnabled === true
        && state.metadata?.fullFunnelTestEnabled === true
        && state.metadata?.noDropiEver === true
        && EC_QA_TEST_REQUIRED_TAGS_V78.every((tag) => tags.includes(tag));
};

export const ecQaPermanentBotInboundAllowedV126 = ({
    state = {},
    publicVslLeadEntry = false,
    directProductInbound = false,
    persistedVslProductContext = null
} = {}) => (
    isEcQaPermanentTestStateV126(state)
    && Boolean(publicVslLeadEntry || directProductInbound || persistedVslProductContext)
);

export const ecQaPermanentClaimQueryV126 = ({
    messageId = '',
    now = new Date(),
    staleAfterMs = 3 * 60 * 1000
} = {}) => {
    const normalizedMessageId = String(messageId || '').trim();
    const current = new Date(now);
    const staleAt = new Date(current.getTime() - Math.max(60_000, Number(staleAfterMs) || 180_000));
    return {
        phoneDigits: EC_QA_PERMANENT_TEST_V126_PHONE,
        chatId: {
            $in: [
                `${EC_QA_PERMANENT_TEST_V126_PHONE}@c.us`,
                `${EC_QA_PERMANENT_TEST_V126_PHONE}@s.whatsapp.net`
            ]
        },
        'metadata.testOnly': true,
        'metadata.outboundTestOnly': true,
        'metadata.botTestEnabled': true,
        'metadata.fullFunnelTestEnabled': true,
        'metadata.noDropiEver': true,
        tags: { $all: [...EC_QA_TEST_REQUIRED_TAGS_V78] },
        $and: [
            { 'metadata.qaTestContextV78.routingMessageId': { $ne: normalizedMessageId } },
            {
                $or: [
                    { 'metadata.qaTestContextV78.status': { $ne: 'routing' } },
                    { 'metadata.qaTestContextV78.routingAt': { $lte: staleAt.toISOString() } },
                    { 'metadata.qaTestContextV78.routingAt': { $exists: false } }
                ]
            }
        ]
    };
};

const TRANSIENT_PRODUCT_TAGS = Object.freeze([
    'VSL_EC',
    'WHATSAPP_CLICK',
    'AUTHORIZED_VSL_TEST_RECIPIENT',
    'TEX_ULTRA_VSL_AB_ENTRY',
    'TEX_ULTRA_EC',
    'NITRIX_EC',
    'VIT_POWER_EC',
    'DIRECT_PRODUCT_INQUIRY'
]);

export const buildEcQaSafeResetV126 = ({ state = {}, now = new Date() } = {}) => {
    if (!state?._id || !isEcQaPermanentTestStateV126(state)) {
        return Object.freeze({ allowed: false, reason: 'qa_exact_canonical_state_required' });
    }
    const resetAt = new Date(now);
    return Object.freeze({
        allowed: true,
        reason: 'qa_transient_state_only',
        query: Object.freeze({
            _id: state._id,
            phoneDigits: EC_QA_PERMANENT_TEST_V126_PHONE,
            'metadata.testOnly': true,
            'metadata.outboundTestOnly': true,
            'metadata.botTestEnabled': true,
            'metadata.fullFunnelTestEnabled': true,
            'metadata.noDropiEver': true,
            tags: { $all: [...EC_QA_TEST_REQUIRED_TAGS_V78] }
        }),
        update: Object.freeze({
            $set: {
                countryCode: 'BR',
                'human.mode': 'auto',
                'human.pausedUntil': null,
                'human.assignedName': 'Teste 8637',
                'human.note': 'TESTE 8637: prioridade fixa no painel com bot liberado; nunca cliente comercial.',
                'metadata.testOnly': true,
                'metadata.outboundTestOnly': true,
                'metadata.botTestEnabled': true,
                'metadata.fullFunnelTestEnabled': true,
                'metadata.noDropiEver': true,
                'metadata.priorityFrozen': true,
                'metadata.priorityFrozenReason': 'NUMERO_8637_TESTE_PERMANENTE_NAO_MEXER',
                'metadata.lastHumanHoldReason': '',
                'metadata.cleanTestResetAt': resetAt,
                'metadata.cleanTestResetReason': 'safe_transient_reset_v126'
            },
            $unset: {
                'metadata.qaTestContextV78': '',
                'metadata.processingLock': '',
                'metadata.perAgentMemory': '',
                'metadata.ecDirectProductInquiry': '',
                'metadata.customerDraft': '',
                'metadata.lastKnownFunnelStage': '',
                'metadata.lastKnownFunnelBucket': '',
                'metadata.lastComplementAt': '',
                'metadata.lastComplementKey': '',
                'metadata.automationHoldAt': '',
                'metadata.automationHoldReason': '',
                'metadata.automationHandoffSuggestedAt': '',
                'metadata.automationHandoffSuggestedNote': '',
                'metadata.automationHandoffSuggestedReason': '',
                'metadata.publicVslLeadEntry': '',
                'metadata.vslEntryPanelLead': '',
                'metadata.vslEntryPanelLeadAt': '',
                'metadata.vslEntryMessage': '',
                'metadata.vslProductKey': '',
                'metadata.vslProductName': '',
                'metadata.vslProductSource': '',
                'metadata.vslTestId': '',
                'metadata.vslVariant': '',
                'metadata.productKey': '',
                'metadata.productName': '',
                'metadata.productMedia': '',
                'metadata.productSource': '',
                'metadata.productRouteLock': ''
            },
            $pull: {
                tags: { $in: [...TRANSIENT_PRODUCT_TAGS] }
            }
        })
    });
};
