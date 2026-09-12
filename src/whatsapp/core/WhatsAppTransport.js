export const WHATSAPP_TRANSPORT_METHODS = Object.freeze([
    'connect',
    'disconnect',
    'getHealth',
    'getChannelInfo',
    'sendText',
    'sendMedia',
    'sendAudio',
    'sendDocument',
    'markRead',
    'normalizeInbound'
]);

export class WhatsAppTransport {
    constructor({ provider, channelId }) {
        if (!provider || !channelId) throw new Error('transport_identity_required');
        this.provider = String(provider).toUpperCase();
        this.channelId = String(channelId);
    }

    async connect() { throw new Error('transport_method_not_implemented:connect'); }
    async disconnect() { throw new Error('transport_method_not_implemented:disconnect'); }
    async getHealth() { throw new Error('transport_method_not_implemented:getHealth'); }
    async getChannelInfo() { throw new Error('transport_method_not_implemented:getChannelInfo'); }
    async sendText() { throw new Error('transport_method_not_implemented:sendText'); }
    async sendMedia() { throw new Error('transport_method_not_implemented:sendMedia'); }
    async sendAudio() { throw new Error('transport_method_not_implemented:sendAudio'); }
    async sendDocument() { throw new Error('transport_method_not_implemented:sendDocument'); }
    async markRead() { throw new Error('transport_method_not_implemented:markRead'); }
    normalizeInbound() { throw new Error('transport_method_not_implemented:normalizeInbound'); }
}

export const assertWhatsAppTransport = (transport) => {
    for (const method of WHATSAPP_TRANSPORT_METHODS) {
        if (typeof transport?.[method] !== 'function') {
            throw new TypeError(`invalid_whatsapp_transport:${method}`);
        }
    }
    return transport;
};

export const normalizedInbound = ({
    provider,
    channelId,
    providerMessageId,
    chatId,
    phone,
    direction = 'inbound',
    type = 'text',
    text = '',
    media = null,
    timestamp,
    raw = null
}) => ({
    provider: String(provider || '').toUpperCase(),
    channelId: String(channelId || ''),
    providerMessageId: String(providerMessageId || ''),
    chatId: String(chatId || ''),
    phone: String(phone || '').replace(/\D/g, ''),
    direction,
    type,
    text: String(text || ''),
    media,
    timestamp: Number(timestamp || Date.now()),
    raw
});
