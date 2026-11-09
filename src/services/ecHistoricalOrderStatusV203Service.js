const clean = value => String(value ?? '').trim();
export const ecPhoneV203 = value => {
    let digits = clean(value).replace(/\D/g, '');
    if (/^09\d{8}$/.test(digits)) digits = `593${digits.slice(1)}`;
    else if (/^9\d{8}$/.test(digits)) digits = `593${digits}`;
    return /^5939\d{8}$/.test(digits) ? digits : '';
};
const terminal = Object.freeze({ entregue: 'delivered', retirado: 'delivered', delivered: 'delivered', devolvido: 'returned', returned: 'returned', nao_retirado: 'returned' });
export const manualTerminalStatusV203 = value => terminal[clean(value).toLowerCase()] || '';
const validAuditV203 = audit => audit?.version === 203 && audit.source === 'authenticated_operator'
    && ['delivered', 'returned'].includes(audit.status) && Boolean(ecPhoneV203(audit.phone))
    && /^[a-f0-9]{24}$/i.test(clean(audit.actorId)) && Boolean(audit.recordedAt)
    && Number.isFinite(new Date(audit.recordedAt).getTime());
export const manualHistoricalMetadataV203 = (metadata = {}, audit) => {
    if (!validAuditV203(audit)) throw new Error('manual_historical_audit_invalid');
    const next = { ...metadata, manualHistoricalStatusV203: audit,
        manualHistoricalStatusHistoryV203: [...(metadata.manualHistoricalStatusHistoryV203 || []), audit].slice(-200) };
    const holds = [...(metadata.manualReturnHoldsV203 || []), metadata.manualReturnHoldV203].filter(Boolean);
    const byOrder = new Map(holds.map(hold => [`${ecPhoneV203(hold.phone)}:${hold.orderId || ''}`, hold]));
    const key = `${ecPhoneV203(audit.phone)}:${audit.orderId || ''}`;
    if (audit.status === 'returned') byOrder.set(key, { ...audit, active: true });
    else if (byOrder.get(key)?.active === true) {
        const previousHold = byOrder.get(key);
        next.manualReturnResolutionV203 = { previousHold, correction: audit };
        byOrder.set(key, { ...previousHold, active: false, resolvedBy: audit });
    }
    next.manualReturnHoldsV203 = [...byOrder.values()];
    next.manualReturnHoldV203 = next.manualReturnHoldsV203.find(hold => hold.active === true) || null;
    return next;
};
export const manualShipmentTerminalReviewV203 = ({ order, shipment, audit } = {}) => {
    if (!shipment) return null;
    const peer = ecPhoneV203(audit?.phone);
    if (!validAuditV203(audit) || !order?.orderId || order.country !== 'EC' || shipment.country !== 'EC'
        || order.orderId !== shipment.orderId || audit.orderId !== order.orderId
        || ecPhoneV203(order.customer?.phone) !== peer || ecPhoneV203(shipment.client?.phone) !== peer
        || !shipment._id) throw new Error('manual_historical_shipment_scope_invalid');
    return { filter: { _id: shipment._id, country: 'EC', orderId: order.orderId, 'client.phone': shipment.client.phone },
        update: { $set: { 'review.manualOnly': true, 'review.reviewStatus': 'manual_terminal_recorded_v203',
            'review.reviewReason': [shipment.review?.reviewReason, `Historico ${audit.status} registrado manualmente; avisos deste envio suspensos.`].filter(Boolean).join('\n'),
            'review.resolvedAt': new Date(audit.recordedAt), 'review.resolvedSource': 'authenticated_operator_v203',
            'review.resolvedEvidence': audit }, $push: { 'review.resolutionHistory': { $each: [audit], $slice: -200 } } } };
};
export const manualHistoricalRequestV203 = ({ method = '', path = '', body = {} } = {}) => {
    if (clean(method).toUpperCase() !== 'PATCH' || !/^\/api\/orders\/EC-[A-Za-z0-9-]{1,95}$/.test(clean(path).split('?')[0].replace(/\/+$/, ''))) return null;
    const status = terminal[clean(body.status).toLowerCase()];
    if (!status) return null;
    if (Object.keys(body).some(key => !['status', 'notes', 'package', 'total'].includes(key))) return null;
    if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 3000)) return null;
    if (body.package !== undefined) {
        if (!body.package || typeof body.package !== 'object' || Array.isArray(body.package)) return null;
        if (Object.keys(body.package).some(key => !['quantity', 'id'].includes(key))) return null;
        const quantity = Number(body.package.quantity ?? body.package.id);
        if (![1, 2, 3, 6].includes(quantity) || (body.package.id !== undefined && Number(body.package.id) !== quantity)) return null;
    }
    if (body.total !== undefined && (!Number.isFinite(Number(body.total)) || Number(body.total) <= 0 || Number(body.total) > 10000 || Math.abs(Number(body.total) * 100 - Math.round(Number(body.total) * 100)) > 0.000001)) return null;
    return Object.freeze({ operation: 'manual-historical-status-v203', status });
};

const shipState = row => clean(row?.logistics?.status).toUpperCase().replace(/[\s-]+/g, '_');
const returned = row => Boolean(row?.outcomes?.returned || row?.outcomes?.prepaidOnly || row?.automation?.returnedNotifiedAt || ['DEVUELTO', 'RETURNED', 'RETORNADO'].includes(shipState(row)));
const delivered = row => Boolean(row?.outcomes?.pickedUp || row?.outcomes?.delivered || row?.automation?.deliveredConfirmedAt || ['ENTREGADO', 'DELIVERED', 'PICKED_UP', 'PICKEDUP'].includes(shipState(row)));
export const historicalEligibilityV203 = ({ phone, country = 'EC', currentOrderId = '', orders = [], shipments = [], legacyLeads = [], manualReturnHolds = [], unavailable = false } = {}) => {
    const peer = ecPhoneV203(phone);
    const deny = (reason, paymentMode, evidence = []) => ({ eligible: false, reason, paymentMode, evidence, requiresManualAuthorization: true });
    if (country !== 'EC' || !peer) return deny('valid_ec_phone_required', 'blocked');
    const same = value => ecPhoneV203(value) === peer;
    const ownedShips = shipments.filter(row => same(row?.client?.phone));
    const ownedOrders = orders.filter(row => same(row?.customer?.phone));
    const ownedLeads = legacyLeads.filter(row => same(row.phone_e164 || row.phone));
    const conflicts = ownedShips.filter(row => returned(row) && delivered(row));
    if (conflicts.length) return deny('conflicting_delivery_and_return_history', 'manual_review', conflicts.map(row => ({ source: 'shipment', orderId: row.orderId })));
    const returns = [
        ...manualReturnHolds.filter(audit => audit?.active === true && audit.status === 'returned' && validAuditV203(audit) && same(audit.phone)).map(audit => ({ source: 'manual_return_hold_v203', orderId: audit.orderId })),
        ...ownedShips.filter(returned).map(row => ({ source: 'shipment', orderId: row.orderId })),
        ...ownedOrders.filter(row => clean(row.status).toLowerCase() === 'returned').map(row => ({ source: 'order', orderId: row.orderId })),
        ...ownedLeads.filter(row => ['devolvido', 'nao_retirado', 'não_retirado'].includes(clean(row.status).toLowerCase())).map(row => ({ source: 'legacy_lead', leadId: row.id }))
    ];
    if (returns.length) return deny('previous_order_not_picked_up', 'prepaid_only', returns);
    if (ownedLeads.some(row => Number(row.blocked) === 1)) return deny('customer_manually_blocked', 'manual_review');
    if (unavailable) return deny('historical_evidence_unavailable', 'manual_review');
    const manuallyDelivered = new Set(ownedOrders.filter(row => {
        const audit = row.manualHistoricalStatusV203;
        return row.status === 'delivered' && audit?.version === 203 && audit.source === 'authenticated_operator'
            && audit.status === 'delivered' && audit.orderId === row.orderId && same(audit.phone)
            && /^[a-f0-9]{24}$/i.test(clean(audit.actorId)) && Number.isFinite(new Date(audit.recordedAt).getTime());
    }).map(row => row.orderId));
    const activeShips = ownedShips.filter(row => row.orderId !== currentOrderId && !manuallyDelivered.has(row.orderId) && !delivered(row) && !['CANCELADO', 'CANCELLED', 'CANCELED'].includes(shipState(row)));
    if (activeShips.length) return deny('active_shipment_until_dropi_delivery', 'blocked_until_pickup', activeShips.map(row => ({ source: 'shipment', orderId: row.orderId })));
    const activeOrders = ownedOrders.filter(row => row.orderId !== currentOrderId && ['draft', 'pending', 'confirmed', 'processing', 'shipped'].includes(row.status));
    if (activeOrders.length) return deny('previous_active_order_requires_review', 'manual_review', activeOrders.map(row => ({ source: 'order', orderId: row.orderId })));
    const hasDelivery = ownedShips.some(delivered) || ownedOrders.some(row => row.status === 'delivered') || ownedLeads.some(row => row.status === 'entregue');
    return { eligible: true, reason: hasDelivery ? 'previous_delivery_confirmed' : 'no_previous_shipment', paymentMode: 'cash_on_delivery', evidence: [] };
};
