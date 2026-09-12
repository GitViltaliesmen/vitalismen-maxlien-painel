export class PersistentOutboundQueue {
    constructor({ messageRepository, clock = () => new Date() }) {
        this.messages = messageRepository;
        this.clock = clock;
    }

    async claim(workerId, { leaseMs = 30000 } = {}) {
        const now = this.clock();
        return this.messages.findOneAndUpdate(
            {
                queueStatus: 'PENDING',
                $or: [{ queueLeaseUntil: null }, { queueLeaseUntil: { $lte: now } }]
            },
            {
                $set: {
                    queueStatus: 'CLAIMED',
                    queueWorkerId: String(workerId),
                    queueClaimedAt: now,
                    queueLeaseUntil: new Date(now.getTime() + Math.max(1000, Number(leaseMs || 0)))
                },
                $inc: { queueAttemptCount: 1 }
            },
            { sort: { createdAt: 1 }, new: true }
        );
    }

    async complete(messageId, workerId) {
        return this.messages.findOneAndUpdate(
            { _id: String(messageId), queueStatus: 'CLAIMED', queueWorkerId: String(workerId) },
            { $set: { queueStatus: 'COMPLETED', queueCompletedAt: this.clock(), queueLeaseUntil: null } },
            { new: true }
        );
    }
}
