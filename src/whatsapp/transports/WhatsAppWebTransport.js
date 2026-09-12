import { WhatsAppTransport, normalizedInbound } from '../core/WhatsAppTransport.js';
import { V152_B_SHADOW_GATE } from '../core/ShadowModeGate.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const baileysVersion = require('@whiskeysockets/baileys/package.json').version;

export class WhatsAppWebTransport extends WhatsAppTransport {
    constructor({ channelId, fixtureClient = null, gate = V152_B_SHADOW_GATE } = {}) {
        super({ provider: 'WHATSAPP_WEB', channelId });
        this.fixtureClient = fixtureClient;
        this.gate = gate;
        this.networkCalls = 0;
        this.library = Object.freeze({ name: '@whiskeysockets/baileys', version: baileysVersion });
    }

    async connect() { return this.#blocked('pairing'); }
    async disconnect() { return this.#blocked('provider_switch'); }
    async getHealth() {
        this.gate.assert(this.fixtureClient ? 'fixture' : 'read_health');
        return this.fixtureClient?.getHealth?.() || { healthy: false, status: 'DRAFT', shadow: true };
    }
    async getChannelInfo() {
        this.gate.assert(this.fixtureClient ? 'fixture' : 'read_channel');
        return { channelId: this.channelId, provider: this.provider, shadow: true, active: false, library: this.library };
    }
    async sendText(payload) { return this.#fixture('sendText', payload); }
    async sendMedia(payload) { return this.#fixture('sendMedia', payload); }
    async sendAudio(payload) { return this.#fixture('sendAudio', payload); }
    async sendDocument(payload) { return this.#fixture('sendDocument', payload); }
    async markRead(payload) { return this.#fixture('markRead', payload); }
    normalizeInbound(payload = {}) {
        this.gate.assert('normalize');
        const message = payload.message || payload.messages?.[0] || payload;
        return normalizedInbound({
            provider: this.provider,
            channelId: this.channelId,
            providerMessageId: message.id || message.key?.id,
            chatId: message.chatId || message.key?.remoteJid,
            phone: message.phone || message.key?.remoteJid,
            direction: message.key?.fromMe ? 'outbound' : 'inbound',
            type: message.type || (message.audioMessage ? 'audio' : message.imageMessage ? 'image' : 'text'),
            text: message.text || message.message?.conversation || '',
            media: message.media || null,
            timestamp: message.timestamp || message.messageTimestamp,
            raw: payload
        });
    }

    async #fixture(method, payload) {
        if (!this.fixtureClient?.[method]) return this.#blocked('outbound');
        this.gate.assert('fixture');
        return this.fixtureClient[method](payload);
    }

    #blocked(operation) {
        return Promise.resolve().then(() => this.gate.assert(operation));
    }
}
