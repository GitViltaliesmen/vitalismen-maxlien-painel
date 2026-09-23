export const BUSINESS_SIGNALS = Object.freeze(['product', 'vsl', 'pickup', 'buyLater', 'engagement', 'botRouting']);

export class ProviderIndependentInboundOrchestrator {
    constructor({ handlers = {} } = {}) {
        this.handlers = handlers;
    }

    async evaluate(normalizedMessage) {
        if (!normalizedMessage?.channelId || !normalizedMessage?.providerMessageId) throw new Error('normalized_inbound_identity_required');
        const result = {};
        for (const signal of BUSINESS_SIGNALS) {
            result[signal] = this.handlers[signal]
                ? await this.handlers[signal](normalizedMessage)
                : null;
        }
        return Object.freeze({
            logicalInboundId: `${normalizedMessage.channelId}:${normalizedMessage.providerMessageId}`,
            phone: normalizedMessage.phone,
            result
        });
    }
}
