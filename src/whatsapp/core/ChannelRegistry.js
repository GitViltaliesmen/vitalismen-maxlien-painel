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
    channelId: 'LEGACY_ZAPI_OLD_PRESERVED',
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
        return [LEGACY_ZAPI_PRIMARY, LEGACY_ZAPI_OLD_PRESERVED];
    }
}
