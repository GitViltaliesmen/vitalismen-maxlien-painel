import { isEligibleChannel } from './ChannelRouter.js';

const SOURCES = new Set(['BOT', 'MANUAL', 'POSTSALE']);

export class OutboundCoordinator {
    constructor({ registry, ledger, shadowGate }) {
        this.registry = registry;
        this.ledger = ledger;
        this.shadowGate = shadowGate;
    }

    async prepare({ source, channelId, ...message }) {
        const normalizedSource = String(source || '').toUpperCase();
        if (!SOURCES.has(normalizedSource)) throw new Error('outbound_source_invalid');
        this.shadowGate.assert('simulate_route');
        const channel = await this.registry.get(channelId);
        if (!isEligibleChannel(channel)) throw new Error('outbound_channel_not_eligible');
        const reservation = await this.ledger.reserve({ ...message, channelId, provider: channel.provider });
        return {
            source: normalizedSource,
            channelId,
            provider: channel.provider,
            status: reservation.accepted ? 'SHADOW_RESERVED' : 'DUPLICATE',
            realOutbound: false,
            reservation
        };
    }

    async dispatch() {
        return Promise.resolve().then(() => this.shadowGate.assert('outbound'));
    }
}
