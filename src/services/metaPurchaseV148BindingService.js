import crypto from 'node:crypto';
import MetaBusinessEvent from '../models/MetaBusinessEvent.js';
import { metaV148ActivationAt, metaV148AttributionHash, withMetaLedgerV148 } from './metaFunnelV148ContractService.js';

// Attribution stays in canonical Order.tracking. This ledger stores only its fingerprint and cycle ownership.
export const bindPurchaseAttributionV148 = async (order, {
    EventModel = MetaBusinessEvent, activationAt = metaV148ActivationAt()
} = {}) => {
    const tracking = order?.tracking || {};
    if (Number(tracking.measurementVersion) !== 148) return { ok: true, skipped: true };
    if (!activationAt || !tracking.checkoutEventId || !order.orderId) return { ok: false, reason: 'v148_checkout_cycle_not_bound' };
    const phone = String(order.customer?.phone || '').replace(/\D/g, '');
    const binding = await withMetaLedgerV148({ phase: 'purchase', eventId: tracking.checkoutEventId, orderId: String(order.orderId) }, () => EventModel.findOneAndUpdate({
        _id: tracking.checkoutEventId,
        customerPhoneSha256: crypto.createHash('sha256').update(phone).digest('hex'),
        attributionSha256: metaV148AttributionHash(tracking),
        occurredAt: { $gte: new Date(activationAt) },
        $or: [{ boundOrderId: { $exists: false } }, { boundOrderId: String(order.orderId) }]
    }, { $set: { boundOrderId: String(order.orderId) } }, { new: true }).lean());
    return binding ? { ok: true, eventId: binding._id } : { ok: false, reason: 'v148_attribution_or_order_cycle_conflict' };
};
