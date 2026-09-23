import crypto from 'node:crypto';
import WhatsAppConversationLease from '../../models/WhatsAppConversationLease.js';

export class ConversationLease {
    constructor({ repository = WhatsAppConversationLease, clock = () => new Date() } = {}) {
        this.repository = repository;
        this.clock = clock;
    }

    async acquire(conversationId, holder, { ttlMs = 30000, channelId = '' } = {}) {
        const now = this.clock();
        const leaseToken = crypto.randomUUID();
        const expiresAt = new Date(now.getTime() + Math.max(1000, Number(ttlMs || 0)));
        let lease;
        try {
            lease = await this.repository.findOneAndUpdate(
                {
                    conversationId: String(conversationId),
                    $or: [{ expiresAt: { $lte: now } }, { releasedAt: { $ne: null } }, { holder: String(holder) }]
                },
                {
                    $set: {
                        holder: String(holder),
                        channelId: String(channelId),
                        leaseToken,
                        acquiredAt: now,
                        expiresAt,
                        releasedAt: null
                    },
                    $inc: { version: 1 }
                },
                { upsert: true, new: true, runValidators: true }
            );
        } catch (error) {
            if (error?.code === 11000) throw new Error('conversation_lease_busy');
            throw error;
        }
        if (!lease || lease.leaseToken !== leaseToken) throw new Error('conversation_lease_busy');
        return lease;
    }

    async release(conversationId, leaseToken) {
        const releasedAt = this.clock();
        const result = await this.repository.findOneAndUpdate(
            { conversationId: String(conversationId), leaseToken: String(leaseToken), releasedAt: null },
            { $set: { releasedAt, expiresAt: releasedAt } },
            { new: true }
        );
        if (!result) throw new Error('conversation_lease_release_mismatch');
        return result;
    }

    async recoverStale() {
        const now = this.clock();
        return this.repository.updateMany(
            { expiresAt: { $lte: now }, releasedAt: null },
            { $set: { releasedAt: now } }
        );
    }
}
