export const isEligibleChannel = (channel) => channel?.status === 'ACTIVE'
    && channel?.health?.healthy === true
    && channel?.draining !== true
    && Number(channel?.capacity || 0) > Number(channel?.currentLoad || 0)
    && Number(channel?.weight || 0) > 0;

const stableScore = (key, channelId, weight) => {
    let hash = 2166136261;
    for (const char of `${key}:${channelId}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return (hash >>> 0) / Math.max(1, Number(weight || 1));
};

export class ChannelRouter {
    constructor({ registry, affinity, shadowGate }) {
        this.registry = registry;
        this.affinity = affinity;
        this.shadowGate = shadowGate;
    }

    async select({ conversationId, customerKey }) {
        this.shadowGate.assert('simulate_route');
        const existing = await this.affinity.get(conversationId);
        if (existing?.channelId) {
            const assigned = await this.registry.get(existing.channelId);
            return isEligibleChannel(assigned)
                ? { channel: assigned, source: 'AFFINITY', failover: false }
                : { channel: null, source: 'AFFINITY_UNAVAILABLE', failover: false, blocked: true };
        }
        const channels = (await this.registry.list({ status: 'ACTIVE' })).filter(isEligibleChannel);
        channels.sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100)
            || stableScore(customerKey || conversationId, a.channelId, a.weight) - stableScore(customerKey || conversationId, b.channelId, b.weight));
        return { channel: channels[0] || null, source: channels.length ? 'NEW_ASSIGNMENT_SIMULATION' : 'NO_ELIGIBLE_CHANNEL', failover: false };
    }
}
