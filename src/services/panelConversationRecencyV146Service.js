const timestampMs = (value) => {
    if (!value) return 0;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric < 100000000000 ? numeric * 1000 : numeric;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const lastRelevantConversationActivityAtV146 = ({
    lastMessage = null,
    contactState = null,
    chat = null
} = {}) => {
    const state = contactState || chat || {};
    const human = state.human || {};
    const metadata = state.metadata || {};
    const candidates = [
        lastMessage?.timestamp,
        lastMessage?.createdAt,
        state.lastInboundAt,
        state.lastOutboundAt,
        state.lastMessageAt,
        human.lastManualAt,
        metadata.lastHumanActionAt,
        metadata.lastBotActionAt,
        metadata.lastRelevantConversationActivityAt
    ].map(timestampMs).filter(Boolean);
    const latest = candidates.length ? Math.max(...candidates) : 0;
    return latest ? new Date(latest).toISOString() : '';
};

export const compareConversationRecencyV146 = (left = {}, right = {}) => {
    const leftTime = timestampMs(left.lastRelevantConversationActivityAt || left.lastActivityAt);
    const rightTime = timestampMs(right.lastRelevantConversationActivityAt || right.lastActivityAt);
    if (rightTime !== leftTime) return rightTime - leftTime;
    const unread = Number(Number(right.unreadCount || 0) > 0) - Number(Number(left.unreadCount || 0) > 0);
    if (unread) return unread;
    return Number(Number(right.unansweredCount || 0) > 0) - Number(Number(left.unansweredCount || 0) > 0);
};

export default lastRelevantConversationActivityAtV146;
