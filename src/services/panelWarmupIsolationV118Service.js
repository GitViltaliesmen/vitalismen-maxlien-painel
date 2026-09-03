export const PANEL_WARMUP_ISOLATION_V118_QA_PHONE = '5515998038637';

const QA_PANEL_ONLY_EXCLUSIONS = new Set([
    'protected_test_contact',
    'commercial_intent',
    'support_intent'
]);

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');

export const isPanelWarmupIsolationQaV118 = (state = {}) => (
    digitsOnly(state.phoneDigits || state.phone || state.chatId) === PANEL_WARMUP_ISOLATION_V118_QA_PHONE
);

export const panelWarmupManualEngagementBlockersV118 = ({
    state = {},
    hardExclusions = []
} = {}) => {
    const exclusions = Array.isArray(hardExclusions) ? hardExclusions.map(String) : [];
    if (!isPanelWarmupIsolationQaV118(state)) return exclusions;
    return exclusions.filter((exclusion) => !QA_PANEL_ONLY_EXCLUSIONS.has(exclusion));
};

export const shouldPreservePanelWarmupManualEngagementV118 = ({
    state = {},
    hardExclusions = []
} = {}) => (
    isPanelWarmupIsolationQaV118(state)
    && String(state.conversationBucket?.value || '') === 'engagement'
    && Boolean(state.conversationBucket?.manualSelectedAt)
    && panelWarmupManualEngagementBlockersV118({ state, hardExclusions }).length === 0
);

export const panelWarmupQaReplyAllowedV118 = (state = {}) => !isPanelWarmupIsolationQaV118(state);
