import {
    getZapiStatus,
    getZapiDevice,
    sendZapiText,
    sendZapiAudio,
    sendZapiImage,
    sendZapiVideo,
    sendZapiDocument,
    normalizeZapiDevice
} from '../../services/zapiClient.js';
import { WhatsAppTransport, normalizedInbound } from '../core/WhatsAppTransport.js';
import { V152_B_SHADOW_GATE } from '../core/ShadowModeGate.js';

const defaultClient = { getZapiStatus, getZapiDevice, sendZapiText, sendZapiAudio, sendZapiImage, sendZapiVideo, sendZapiDocument };

export class ZapiWhatsAppTransport extends WhatsAppTransport {
    constructor({ channelId = 'LEGACY_ZAPI_PRIMARY', client = defaultClient, gate = V152_B_SHADOW_GATE, fixtureMode = false } = {}) {
        super({ provider: 'ZAPI', channelId });
        this.client = client;
        this.gate = gate;
        this.fixtureMode = fixtureMode === true;
    }

    async connect() { return this.#blocked('provider_switch'); }
    async disconnect() { return this.#blocked('provider_switch'); }
    async getHealth() {
        this.gate.assert(this.fixtureMode ? 'fixture' : 'read_health');
        const status = await this.client.getZapiStatus();
        return { healthy: Boolean(status?.connected), status: status?.connected ? 'ACTIVE' : 'DEGRADED', providerStatus: status };
    }
    async getChannelInfo() {
        this.gate.assert(this.fixtureMode ? 'fixture' : 'read_channel');
        const device = normalizeZapiDevice(await this.client.getZapiDevice());
        return { channelId: this.channelId, provider: this.provider, ...device };
    }
    async sendText(payload) { return this.#send('sendZapiText', payload); }
    async sendMedia(payload = {}) {
        const method = payload.kind === 'video' ? 'sendZapiVideo' : payload.kind === 'document' ? 'sendZapiDocument' : 'sendZapiImage';
        return this.#send(method, payload);
    }
    async sendAudio(payload) { return this.#send('sendZapiAudio', payload); }
    async sendDocument(payload) { return this.#send('sendZapiDocument', payload); }
    async markRead() { return this.#blocked('outbound'); }
    normalizeInbound(payload = {}) {
        this.gate.assert('normalize');
        const message = payload.message || payload;
        return normalizedInbound({
            provider: this.provider,
            channelId: this.channelId,
            providerMessageId: message.messageId || message.id || message.zaapId,
            chatId: message.chatId || message.phone,
            phone: message.phone || message.senderPhone || message.chatId,
            direction: message.fromMe ? 'outbound' : 'inbound',
            type: message.type || (message.audio ? 'audio' : message.image ? 'image' : 'text'),
            text: message.text?.message || message.message || message.body || '',
            media: message.audio || message.image || message.video || message.document || null,
            timestamp: message.momment || message.timestamp,
            raw: payload
        });
    }

    async #send(method, payload) {
        if (!this.fixtureMode) return this.#blocked('outbound');
        this.gate.assert('fixture');
        return this.client[method](payload);
    }

    #blocked(operation) {
        return Promise.resolve().then(() => this.gate.assert(operation));
    }
}
