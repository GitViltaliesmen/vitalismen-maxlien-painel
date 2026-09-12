import crypto from 'node:crypto';
import Message from '../../models/Message.js';
import OutboundDedupe from '../../models/OutboundDedupe.js';

const clean = (value) => String(value || '').trim();
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const VALID_KINDS = new Set(['text', 'audio', 'image', 'video', 'document']);

export const messageDedupeKey = ({ logicalMessageId, phone, kind, contentFingerprint }) => {
    const normalizedKind = clean(kind).toLowerCase();
    if (!VALID_KINDS.has(normalizedKind)) throw new Error('unsupported_ledger_message_kind');
    return `v152:${hash(`${clean(logicalMessageId)}|${clean(phone).replace(/\D/g, '')}|${normalizedKind}|${clean(contentFingerprint)}`)}`;
};

export class UnifiedMessageLedger {
    constructor({ messageRepository = Message, dedupeRepository = OutboundDedupe, clock = () => new Date() } = {}) {
        this.messages = messageRepository;
        this.dedupes = dedupeRepository;
        this.clock = clock;
    }

    async reserve({ logicalMessageId, channelId, provider, providerMessageId = '', phone, kind, contentFingerprint, payload = {} }) {
        const dedupeKey = messageDedupeKey({ logicalMessageId, phone, kind, contentFingerprint });
        const now = this.clock();
        const result = await this.dedupes.findOneAndUpdate(
            { key: dedupeKey },
            {
                $setOnInsert: {
                    key: dedupeKey,
                    logicalMessageId: clean(logicalMessageId),
                    channelId: clean(channelId),
                    provider: clean(provider).toUpperCase(),
                    providerMessageId: clean(providerMessageId),
                    phoneDigits: clean(phone).replace(/\D/g, ''),
                    kind: clean(kind).toLowerCase(),
                    fingerprint: clean(contentFingerprint),
                    status: 'reserved',
                    firstReservedAt: now
                }
            },
            { upsert: true, new: true, includeResultMetadata: true }
        );
        const created = !result?.lastErrorObject?.updatedExisting;
        if (!created) return { accepted: false, duplicate: true, dedupeKey, record: result?.value || result };
        const id = clean(payload._id) || `shadow:${hash(dedupeKey).slice(0, 32)}`;
        await this.messages.findOneAndUpdate(
            { _id: id },
            { $setOnInsert: { ...payload, _id: id, logicalMessageId, channelId, provider, providerMessageId, dedupeKey, queueStatus: 'PENDING' } },
            { upsert: true, new: true }
        );
        return { accepted: true, duplicate: false, dedupeKey, messageId: id };
    }

    async countPending(conversationId) {
        return this.messages.countDocuments({
            chatId: clean(conversationId),
            queueStatus: { $in: ['PENDING', 'CLAIMED'] }
        });
    }
}
