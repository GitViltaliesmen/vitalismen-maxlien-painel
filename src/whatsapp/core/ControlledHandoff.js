import crypto from 'node:crypto';

export class ControlledHandoff {
    constructor({ lease, registry, affinity, ledger, transferRepository, shadowGate }) {
        this.lease = lease;
        this.registry = registry;
        this.affinity = affinity;
        this.ledger = ledger;
        this.transfers = transferRepository;
        this.shadowGate = shadowGate;
    }

    async handoffCustomer({
        conversationId,
        fromChannelId,
        toChannelId,
        reason = 'v152_b_shadow_only',
        actor = 'v152-b',
        simulationSession
    }) {
        this.shadowGate.assert('simulate_route');
        if (simulationSession?.shadow !== true || typeof simulationSession.compareAndAssign !== 'function') {
            return Promise.resolve().then(() => this.shadowGate.assert('handoff'));
        }
        const target = await this.registry.get(toChannelId);
        if (target?.status !== 'ACTIVE' || target?.health?.healthy !== true || target?.draining === true) {
            throw new Error('handoff_target_not_eligible');
        }
        const current = await this.affinity.get(conversationId);
        if (current?.channelId !== fromChannelId) throw new Error('handoff_source_affinity_mismatch');
        const activeLease = await this.lease.acquire(conversationId, actor, { channelId: fromChannelId });
        try {
            const pending = await this.ledger.countPending?.(conversationId) || 0;
            if (pending > 0) throw new Error('handoff_pending_outbound');
            await this.affinity.compareAndAssign(conversationId, fromChannelId, toChannelId, { session: simulationSession });
            const timestamp = new Date();
            const transfer = {
                transferId: crypto.randomUUID(),
                conversationId,
                fromChannelId,
                toChannelId,
                leaseToken: activeLease.leaseToken,
                status: 'SIMULATED',
                reason,
                actor,
                timestamp
            };
            await this.transfers.create(transfer);
            return transfer;
        } finally {
            await this.lease.release(conversationId, activeLease.leaseToken);
        }
    }

    async simulate(input) {
        return this.handoffCustomer(input);
    }
}
