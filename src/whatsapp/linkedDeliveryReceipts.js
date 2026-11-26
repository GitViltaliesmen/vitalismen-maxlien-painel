import Message from '../models/Message.js';

// The panel uses 1=accepted, 2=delivered, 3=read. Baileys uses
// 2=server ack, 3=delivery ack, 4/5=read/played. Never store its raw value.
const statusFromBaileys = (status) => ({
    2: { ack: 1, deliveryStatus: 'sent', providerStatus: 'server_ack' },
    3: { ack: 2, deliveryStatus: 'delivered', providerStatus: 'delivery_ack' },
    4: { ack: 3, deliveryStatus: 'read', providerStatus: 'read' },
    5: { ack: 3, deliveryStatus: 'read', providerStatus: 'played' }
})[Number(status)] || null;

const receiptDate = (value) => {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 0
        ? new Date(seconds * 1000)
        : new Date();
};

export const applyLinkedDeliveryReceipt = async ({ key, update, receipt } = {}, model = Message) => {
    const providerMessageId = String(key?.id || '').trim();
    if (!key?.fromMe || !providerMessageId || providerMessageId.length > 160) return { applied: false, reason: 'not_outbound_message' };
    if (String(key.remoteJid || '').endsWith('@g.us') || String(key.remoteJid || '') === 'status@broadcast') {
        return { applied: false, reason: 'not_customer_chat' };
    }
    const hasRead = Number(receipt?.readTimestamp || 0) > 0;
    const hasDelivery = Number(receipt?.receiptTimestamp || 0) > 0;
    const status = hasRead
        ? statusFromBaileys(4)
        : hasDelivery
            ? statusFromBaileys(3)
            : statusFromBaileys(update?.status);
    if (!status) return { applied: false, reason: 'no_delivery_evidence' };

    const filter = {
        provider: 'baileys', providerMessageId, isFromMe: true,
        $or: [{ ack: { $exists: false } }, { ack: { $lt: status.ack } }]
    };
    const at = receiptDate(hasRead ? receipt.readTimestamp : hasDelivery ? receipt.receiptTimestamp : null);
    const fields = {
        ack: status.ack,
        deliveryStatus: status.deliveryStatus,
        providerStatus: status.providerStatus,
        sendError: ''
    };
    if (status.ack >= 2) fields.deliveredAt = at;
    if (status.ack >= 3) fields.readAt = at;
    const result = await model.updateMany(filter, { $set: fields });
    return { applied: Boolean(result.modifiedCount), reason: result.modifiedCount ? 'receipt_persisted' : 'message_missing_or_not_newer' };
};
