import { isEcuadorTexUltraProtocoloG, parseVilaliemenProtocoloGUrl } from './metaProtocoloGAttributionService.js';

const clean = value => String(value ?? '').trim();
const inWindow = (value, startAt, endAt) => {
    const at = new Date(value || 0).getTime();
    return at >= new Date(startAt).getTime() && at <= new Date(endAt).getTime();
};
const rate = (part, total) => total ? Math.round(part / total * 1000) / 10 : 0;
const sourceIsProtocoloG = record => isEcuadorTexUltraProtocoloG(record)
    || Boolean(parseVilaliemenProtocoloGUrl(record.sourceUrl || record.tracking?.sourceUrl || record.metadata?.vslSourceUrl))
    || clean(record.metadata?.vslVariant).toLowerCase() === 'protocolo_g';
const isExcluded = contact => contact.conversationBucket?.value === 'engagement'
    || clean(contact.phoneDigits).replace(/\D/g, '') === '5515998038637'
    || contact.metadata?.testOnly === true;
const explicitOrderIds = contact => [...new Set([
    contact.metadata?.customerDraft?.orderId,
    contact.metadata?.customerDraft?.currentNegotiationOrderId
].map(clean).filter(Boolean))];
const adIdentity = record => {
    const tracking = record.tracking || record.metadata?.tracking || {};
    const validId = value => { const id = clean(value); return id.includes('{{') || id.includes('}}') ? '' : id; };
    return { adId: validId(record.adId || tracking.ad_id), campaignId: validId(record.campaignId || tracking.campaign_id),
        adsetId: validId(record.adsetId || tracking.adset_id), adName: clean(tracking.utm_content), campaignName: clean(tracking.utm_campaign) };
};
const fields = ['commercialLeads', 'inbounds', 'orders', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned', 'orderValue'];

// Only joins persisted IDs. No contact-name/phone attribution and no writes.
export const buildProtocoloGCommercialMetrics = ({ visits = [], orders = [], contacts = [], shipments = [], ads = [], startAt, endAt } = {}) => {
    const visitsById = new Map(visits.map(v => [clean(v._id), v]).filter(([id]) => id));
    const visitsByKey = new Map(visits.map(v => [clean(v.visitorKey), v]).filter(([id]) => id));
    const excludedVisits = new Set();
    const excludedOrders = new Set();
    for (const contact of contacts.filter(isExcluded)) {
        if (contact.metadata?.vslVisitId) excludedVisits.add(clean(contact.metadata.vslVisitId));
        explicitOrderIds(contact).forEach(id => excludedOrders.add(id));
    }
    const coverage = { unknownOriginOrders: 0, unknownOriginContacts: 0, excludedEngagementOrQa: 0, unavailableCreativeId: true };
    const rows = new Map();
    const getRow = identity => {
        const key = identity.adId || 'SEM_ATRIBUICAO';
        if (!rows.has(key)) rows.set(key, { ...identity, attribution: identity.adId ? 'AD_ID_CAPTURED' : 'SEM_ATRIBUICAO',
            landing: 0, whatsappClicks: 0, ...Object.fromEntries(fields.map(f => [f, 0])), evidence: [] });
        return rows.get(key);
    };
    for (const ad of ads) Object.assign(getRow(ad), ad, Object.fromEntries(fields.map(f => [f, 0])),
        { attributedConversations: 0, salesCreated: 0, purchasesSent: 0 });
    const seenContacts = new Set();
    const contactsByOrder = new Map();
    for (const contact of contacts) {
        if (contact.countryCode && contact.countryCode !== 'EC') continue;
        if (isExcluded(contact)) { coverage.excludedEngagementOrQa += 1; continue; }
        const id = clean(contact._id);
        if (!id || seenContacts.has(id)) continue;
        seenContacts.add(id);
        const visit = visitsById.get(clean(contact.metadata?.vslVisitId));
        const reliableVisit = visit && !excludedVisits.has(clean(visit._id)) && contact.metadata?.metaAttributionBridge?.claimedAt;
        const source = sourceIsProtocoloG(contact) || (reliableVisit && sourceIsProtocoloG(visit));
        if (!source) { coverage.unknownOriginContacts += 1; continue; }
        explicitOrderIds(contact).forEach(orderId => {
            const list = contactsByOrder.get(orderId) || [];
            list.push(contact); contactsByOrder.set(orderId, list);
        });
        const enteredAt = contact.metadata?.metaAttributionBridge?.claimedAt || contact.firstInboundAt || contact.createdAt;
        if (!inWindow(enteredAt, startAt, endAt)) continue;
        const ownIdentity = adIdentity(contact);
        const visitIdentity = reliableVisit ? adIdentity(visit) : {};
        const conflicting = ownIdentity.adId && visitIdentity.adId && ownIdentity.adId !== visitIdentity.adId;
        const identity = conflicting ? {} : ownIdentity.adId ? ownIdentity : reliableVisit ? visitIdentity : ownIdentity;
        const row = getRow(identity);
        row.commercialLeads += 1;
        if (contact.firstInboundAt || contact.lastInboundAt) row.inbounds += 1;
        if (reliableVisit) row.attributedConversations = (row.attributedConversations || 0) + 1;
        row.evidence.push({ contactId: id, visitId: reliableVisit ? clean(visit._id) : '', kind: 'commercial_contact' });
    }
    const shipmentByOrder = new Map(shipments.map(s => [clean(s.orderId), s]));
    const seenOrders = new Set();
    for (const order of orders) {
        if (order.country && order.country !== 'EC') continue;
        const orderId = clean(order.orderId);
        if (!orderId || seenOrders.has(orderId)) continue;
        seenOrders.add(orderId);
        const visit = visitsByKey.get(clean(order.tracking?.attributionVisitorKey));
        if (excludedOrders.has(orderId) || (visit && excludedVisits.has(clean(visit._id)))) continue;
        const linkedContacts = contactsByOrder.get(orderId) || [];
        const contact = linkedContacts.length === 1 ? linkedContacts[0] : null;
        const reliableVisit = visit && (order.tracking?.attributionCorrelationStatus === 'CLAIMED' || order.tracking?.attributionMatchedAt);
        if (!sourceIsProtocoloG(order) && !(reliableVisit && sourceIsProtocoloG(visit)) && !contact) {
            coverage.unknownOriginOrders += 1; continue;
        }
        if (!inWindow(order.entryAt || order.draftCreatedAt || order.createdAt, startAt, endAt)) continue;
        const identity = adIdentity(order);
        const candidateIds = [identity.adId, reliableVisit ? adIdentity(visit).adId : '', contact ? adIdentity(contact).adId : ''].filter(Boolean);
        const ambiguous = new Set(candidateIds).size > 1
            || ['AMBIGUOUS', 'UNMATCHED'].includes(clean(order.tracking?.attributionCorrelationStatus).toUpperCase());
        const resolved = ambiguous ? {} : identity.adId ? identity : reliableVisit ? adIdentity(visit) : contact ? adIdentity(contact) : identity;
        const row = getRow(resolved);
        const shipment = shipmentByOrder.get(orderId);
        const status = clean(order.status).toLowerCase();
        row.orders += 1;
        row.salesCreated = row.orders;
        if (inWindow(order.tracking?.metaPurchaseSentAt, startAt, endAt)) row.purchasesSent = (row.purchasesSent || 0) + 1;
        const shipped = Boolean(shipment?.automation?.submittedToDroppiAt) || ['shipped', 'delivered'].includes(status);
        if (order.confirmedAt || ['confirmed', 'processing', 'shipped', 'delivered'].includes(status)) row.confirmed += 1;
        if (shipped) row.shipped += 1;
        if (status === 'delivered' || shipment?.logistics?.status === 'delivered') row.delivered += 1;
        if (status === 'cancelled' || shipment?.logistics?.status === 'cancelled') row.cancelled += 1;
        if (status === 'returned' || shipment?.logistics?.status === 'returned') row.returned += 1;
        const value = Number(order.total);
        if (Number.isFinite(value) && value > 0) row.orderValue += value;
        row.evidence.push({ orderId, contactId: clean(contact?._id), visitorKey: reliableVisit ? clean(visit.visitorKey) : '', status,
            attribution: row.attribution, source: identity.adId && !ambiguous ? 'order.tracking.ad_id' : reliableVisit && !ambiguous ? 'order.tracking.attributionVisitorKey' : 'unattributed_or_explicit_contact' });
    }
    return { semantics: 'cohort_created_in_period_current_status', coverage, ads: [...rows.values()].map(row => ({ ...row,
        orderValue: Math.round(row.orderValue * 100) / 100,
        conversationRate: rate(row.attributedConversations || 0, row.whatsappClicks),
        visitToWhatsappRate: rate(row.whatsappClicks, row.landing), whatsappToLeadRate: rate(row.commercialLeads, row.whatsappClicks),
        leadToOrderRate: rate(row.orders, row.commercialLeads), orderToConfirmedRate: rate(row.confirmed, row.orders),
        confirmedToDeliveredRate: rate(row.delivered, row.confirmed)
    })) };
};
