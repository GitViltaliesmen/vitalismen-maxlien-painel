const clean = (value) => String(value || '').trim();

export class CustomerAffinity {
    constructor({ contactStateRepository, channelRegistry }) {
        this.contactStateRepository = contactStateRepository;
        this.channelRegistry = channelRegistry;
    }

    async get(conversationId) {
        const state = await this.contactStateRepository.findOne({ chatId: clean(conversationId) }).lean();
        const wallet = state?.metadata?.senderWallet || {};
        const legacy = clean(wallet.channelId || wallet.assignedSessionId || state?.metadata?.lastSessionId);
        if (!legacy) return null;
        const direct = await this.channelRegistry.get(legacy);
        if (direct) return { channelId: direct.channelId, source: wallet.channelId ? 'CANONICAL' : 'LEGACY_READONLY' };
        return { channelId: 'LEGACY_ZAPI_PRIMARY', legacySessionId: legacy, source: 'LEGACY_COMPATIBILITY_MIRROR' };
    }

    async assign(conversationId, channelId, { session = null } = {}) {
        if (session?.setAffinity) return session.setAffinity(conversationId, channelId);
        return this.contactStateRepository.findOneAndUpdate(
            { chatId: clean(conversationId) },
            { $set: { 'metadata.senderWallet.channelId': clean(channelId), 'metadata.senderWallet.assignedAt': new Date() } },
            { new: true }
        );
    }

    async compareAndAssign(conversationId, fromChannelId, toChannelId, { session = null } = {}) {
        if (session?.compareAndAssign) {
            return session.compareAndAssign(conversationId, fromChannelId, toChannelId);
        }
        const updated = await this.contactStateRepository.findOneAndUpdate(
            {
                chatId: clean(conversationId),
                'metadata.senderWallet.channelId': clean(fromChannelId)
            },
            {
                $set: {
                    'metadata.senderWallet.channelId': clean(toChannelId),
                    'metadata.senderWallet.assignedAt': new Date()
                },
                $inc: { 'metadata.senderWallet.version': 1 }
            },
            { new: true, session }
        );
        if (!updated) throw new Error('affinity_compare_and_assign_conflict');
        return updated;
    }
}
