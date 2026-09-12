import { WhatsAppTransport, normalizedInbound } from '../core/WhatsAppTransport.js';

export class MetaCloudTransportNoop extends WhatsAppTransport {
    constructor({ channelId = 'META_CLOUD_NOOP' } = {}) {
        super({ provider: 'META_CLOUD', channelId });
        this.networkCalls = 0;
    }

    async connect() { return { active: false, noop: true, networkCalls: this.networkCalls }; }
    async disconnect() { return { active: false, noop: true, networkCalls: this.networkCalls }; }
    async getHealth() { return { healthy: false, status: 'INACTIVE', networkCalls: this.networkCalls }; }
    async getChannelInfo() { return { channelId: this.channelId, provider: this.provider, active: false, networkCalls: this.networkCalls }; }
    async sendText() { return this.#blocked(); }
    async sendMedia() { return this.#blocked(); }
    async sendAudio() { return this.#blocked(); }
    async sendDocument() { return this.#blocked(); }
    async markRead() { return this.#blocked(); }
    normalizeInbound(payload = {}) { return normalizedInbound({ ...payload, provider: this.provider, channelId: this.channelId }); }

    #blocked() {
        const error = new Error('meta_cloud_transport_noop');
        error.code = 'META_CLOUD_NO_NETWORK';
        throw error;
    }
}
