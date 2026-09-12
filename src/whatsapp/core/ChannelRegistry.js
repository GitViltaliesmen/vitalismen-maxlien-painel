import WhatsAppChannel from '../../models/WhatsAppChannel.js';

const digits = (value) => String(value || '').replace(/\D/g, '');

export const LEGACY_ZAPI_PRIMARY = Object.freeze({
    channelId: 'LEGACY_ZAPI_PRIMARY',
    provider: 'ZAPI',
    phoneNumber: '5531971862958',
    providerAddress: '',
    displayName: 'Z-API Ecuador principal',
    status: 'ACTIVE',
    health: { healthy: true, detail: 'compatibility_mirror' },
    priority: 1,
    weight: 1,
    capacity: 1,
    currentLoad: 0,
    draining: false,
    sessionNamespace: 'legacy-zapi-primary',
    version: 1,
    compatibilityMirror: true,
    preserved: true
});

export const LEGACY_ZAPI_OLD_PRESERVED = Object.freeze({
    channelId: 'OLD_BLOCKED_PHONE',
    provider: 'ZAPI',
    phoneNumber: '5515991418416',
    displayName: 'Z-API anterior preservado',
    status: 'BLOCKED',
    health: { healthy: false, detail: 'preserved_not_routable' },
    priority: 999,
    weight: 0,
    capacity: 0,
    currentLoad: 0,
    draining: true,
    sessionNamespace: 'legacy-zapi-old-preserved',
    version: 1,
    compatibilityMirror: true,
    preserved: true
});

export const WHATSAPP_WEB_TEMPLATE = Object.freeze({
    channelId: 'WHATSAPP_WEB_TEMPLATE',
    provider: 'WHATSAPP_WEB',
    phoneNumber: '',
    providerAddress: '',
    displayName: 'WhatsApp Web test template',
    status: 'DRAFT',
    health: { healthy: false, detail: 'PAIRING_PENDING_REAL_TEST_CHANNEL' },
    priority: 0,
    weight: 0,
    capacity: 0,
    currentLoad: 0,
    draining: true,
    sessionNamespace: 'v152-test-web-01',
    version: 1,
    compatibilityMirror: false,
    preserved: false,
    shadow: true
});

export const V152_TEST_WEB_01 = Object.freeze({
    channelId: 'V152_TEST_WEB_01',
    provider: 'WHATSAPP_WEB',
    phoneNumber: '5531983002800',
    providerAddress: '',
    displayName: 'WhatsApp Web V152-E-R1 test channel',
    status: 'PAIRING',
    health: { healthy: false, detail: 'PAIRING' },
    priority: 0,
    weight: 0,
    capacity: 0,
    currentLoad: 0,
    draining: true,
    sessionNamespace: 'V152_TEST_WEB_01',
    version: 1,
    compatibilityMirror: false,
    preserved: false,
    shadow: true
});

export class ChannelRegistry {
    constructor({ repository = WhatsAppChannel } = {}) {
        this.repository = repository;
    }

    async get(channelId) {
        return this.repository.findOne({ channelId: String(channelId) }).lean();
    }

    async list(filter = {}) {
        return this.repository.find(filter).sort({ priority: 1, channelId: 1 }).lean();
    }

    async registerDraft(input = {}) {
        if (!input.channelId || !input.provider) throw new Error('channel_identity_required');
        return this.repository.findOneAndUpdate(
            { channelId: String(input.channelId) },
            { $setOnInsert: { ...input, phoneNumber: digits(input.phoneNumber), status: 'DRAFT', version: 1 } },
            { upsert: true, new: true, runValidators: true }
        );
    }

    static projection() {
        return [LEGACY_ZAPI_PRIMARY, LEGACY_ZAPI_OLD_PRESERVED, WHATSAPP_WEB_TEMPLATE];
    }

    static v152ER1Projection({ connected = false } = {}) {
        const testChannel = {
            ...V152_TEST_WEB_01,
            status: connected ? 'CONNECTED' : 'PAIRING',
            health: { healthy: connected, detail: connected ? 'PASS' : 'PAIRING' }
        };
        return [LEGACY_ZAPI_PRIMARY, LEGACY_ZAPI_OLD_PRESERVED, Object.freeze(testChannel)];
    }
}
