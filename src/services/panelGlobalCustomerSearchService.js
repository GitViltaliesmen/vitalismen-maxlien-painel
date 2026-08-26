import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';
import { projectPanelCustomerReadModel } from './panelCustomerReadModelService.js';

export const PANEL_GLOBAL_SEARCH_LIMIT_MAX = 20;
export const PANEL_GLOBAL_SEARCH_QUERY_MAX = 80;

const clean = (value = '') => String(value || '').trim().replace(/\s+/g, ' ');
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');
const escapeRegex = (value = '') => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unique = (items = []) => [...new Set(items.filter(Boolean))];
const normalizeName = (value = '') => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const describePanelGlobalSearchQuery = (value = '') => {
    const raw = clean(value).slice(0, PANEL_GLOBAL_SEARCH_QUERY_MAX);
    const digits = digitsOnly(raw);
    const phoneLike = Boolean(raw) && raw.replace(/[\s()+\-./]/g, '').replace(/\d/g, '') === '';
    if (!raw) return Object.freeze({ valid: false, kind: 'empty', raw, digits: '', reason: 'empty_query' });
    if (phoneLike) {
        return Object.freeze({
            valid: digits.length >= 3,
            kind: digits.length >= 3 ? 'numeric' : 'numeric_too_short',
            raw,
            digits,
            reason: digits.length >= 3 ? '' : 'minimum_three_digits'
        });
    }
    if (/^EC-[A-Z0-9-]{2,}$/i.test(raw)) {
        return Object.freeze({ valid: true, kind: 'order', raw, digits, reason: '' });
    }
    const normalized = normalizeName(raw);
    return Object.freeze({
        valid: normalized.length >= 2,
        kind: normalized.length >= 2 ? 'name' : 'name_too_short',
        raw,
        digits,
        normalized,
        reason: normalized.length >= 2 ? '' : 'minimum_two_characters'
    });
};

const ecuadorPhoneVariants = (value = '') => {
    const digits = digitsOnly(value);
    if (!digits) return [];
    const variants = [digits];
    if (/^5939\d{8}$/.test(digits)) variants.push(digits.slice(3), `0${digits.slice(3)}`);
    else if (/^09\d{8}$/.test(digits)) variants.push(digits.slice(1), `593${digits.slice(1)}`);
    else if (/^9\d{8}$/.test(digits)) variants.push(`0${digits}`, `593${digits}`);
    return unique(variants);
};

const phoneTails = (value = '') => {
    const variants = ecuadorPhoneVariants(value);
    const digits = digitsOnly(value);
    return unique([
        ...variants,
        digits.length >= 9 ? digits.slice(-9) : '',
        digits.length >= 10 ? digits.slice(-10) : ''
    ]).filter((item) => item.length >= 3);
};

const canonicalPhone = (...values) => {
    const candidates = values.map(digitsOnly).filter((value) => value.length >= 8);
    const international = candidates.find((value) => /^5939\d{8}$/.test(value));
    if (international) return international;
    const local = candidates.find((value) => /^09\d{8}$/.test(value) || /^9\d{8}$/.test(value));
    if (local) return `593${local.replace(/^0/, '')}`;
    return candidates[0] || '';
};

const suffixClauses = (field, values = []) => unique(values)
    .map((value) => digitsOnly(value))
    .filter((value) => value.length >= 3)
    .map((value) => ({ [field]: { $regex: new RegExp(`${value}$`) } }));

const namePrefixRegex = (value = '') => new RegExp(`^${escapeRegex(clean(value))}`, 'i');
const orderPrefixRegex = (value = '') => new RegExp(`^${escapeRegex(clean(value))}`, 'i');

const baseQueriesForDescriptor = (descriptor) => {
    if (descriptor.kind === 'numeric') {
        const tails = phoneTails(descriptor.digits);
        const exactNumeric = unique([descriptor.digits, ...ecuadorPhoneVariants(descriptor.digits)]);
        return {
            contact: {
                countryCode: 'EC',
                $or: [
                    { phoneDigits: { $in: exactNumeric } },
                    { 'metadata.lastSenderPn': { $in: exactNumeric } },
                    { 'metadata.customerDraft.phone': { $in: exactNumeric } },
                    ...suffixClauses('phoneDigits', tails),
                    ...suffixClauses('metadata.lastSenderPn', tails),
                    ...suffixClauses('metadata.customerDraft.phone', tails)
                ]
            },
            order: {
                country: 'EC',
                $or: [
                    { 'customer.phone': { $in: exactNumeric } },
                    ...suffixClauses('customer.phone', tails),
                    { dropiOrderId: { $in: exactNumeric } },
                    { trackingNumber: { $in: exactNumeric } }
                ]
            },
            shipment: {
                country: 'EC',
                $or: [
                    { 'client.phone': { $in: exactNumeric } },
                    ...suffixClauses('client.phone', tails),
                    { 'logistics.trackingNumber': { $in: exactNumeric } },
                    { 'raw.manualDropiOrderId': { $in: exactNumeric } },
                    { 'raw.latestDroppiPayload.dropiOrderId': { $in: exactNumeric } },
                    { 'raw.droppiOrder.id': { $in: exactNumeric } }
                ]
            }
        };
    }
    if (descriptor.kind === 'order') {
        const regex = orderPrefixRegex(descriptor.raw);
        return {
            contact: {
                countryCode: 'EC',
                $or: [
                    { 'metadata.customerDraft.orderId': regex },
                    { 'metadata.customerDraft.sourceOrderId': regex }
                ]
            },
            order: { country: 'EC', orderId: regex },
            shipment: { country: 'EC', orderId: regex }
        };
    }
    const regex = namePrefixRegex(descriptor.raw);
    return {
        contact: {
            countryCode: 'EC',
            $or: [
                { 'metadata.customerDraft.name': regex },
                { 'metadata.profileName': regex },
                { 'metadata.verifiedCustomerName': regex },
                { 'metadata.submittedName': regex }
            ]
        },
        order: { country: 'EC', 'customer.name': regex },
        shipment: { country: 'EC', 'client.name': regex }
    };
};

const directNumericOrderMatch = (descriptor, order = null, shipment = null) => {
    if (descriptor.kind !== 'numeric') return false;
    const queryDigits = descriptor.digits;
    return [
        order?.dropiOrderId,
        order?.trackingNumber,
        shipment?.logistics?.trackingNumber,
        shipment?.raw?.manualDropiOrderId,
        shipment?.raw?.latestDroppiPayload?.dropiOrderId,
        shipment?.raw?.droppiOrder?.id
    ].map(digitsOnly).some((value) => value && value === queryDigits);
};

const matchedOrderIdForEntity = (descriptor, order = null, shipment = null) => {
    if (descriptor.kind === 'order') return clean(order?.orderId || shipment?.orderId);
    if (directNumericOrderMatch(descriptor, order, shipment)) return clean(order?.orderId || shipment?.orderId);
    return '';
};

const resultGroupKey = ({ descriptor, state = null, order = null, shipment = null } = {}) => {
    const preferredOrderId = matchedOrderIdForEntity(descriptor, order, shipment);
    if (preferredOrderId) return `order:${preferredOrderId}`;
    const phone = canonicalPhone(
        order?.customer?.phone,
        shipment?.client?.phone,
        state?.phoneDigits,
        state?.metadata?.lastSenderPn,
        state?.metadata?.customerDraft?.phone,
        state?.chatId
    );
    if (phone) return `phone:${phone.slice(-9)}`;
    return clean(state?.chatId) ? `chat:${state.chatId}` : '';
};

const statePhone = (state = null) => canonicalPhone(
    state?.phoneDigits,
    state?.metadata?.lastSenderPn,
    state?.metadata?.customerDraft?.phone,
    state?.chatId
);

const orderPhone = (order = null) => canonicalPhone(order?.customer?.phone);
const shipmentPhone = (shipment = null) => canonicalPhone(shipment?.client?.phone);

const relatedPhoneQuery = (field, phones = []) => ({
    $or: unique(phones.flatMap(phoneTails)).filter((tail) => tail.length >= 8)
        .map((tail) => ({ [field]: { $regex: new RegExp(`${tail}$`) } }))
});

const latestMessageForIdentity = (messages = [], { phone = '', chatIds = [] } = {}) => {
    const phoneTail = digitsOnly(phone).slice(-9);
    const idSet = new Set(chatIds.filter(Boolean));
    return (messages || []).find((message) => {
        if (idSet.has(message?.chatId) || idSet.has(message?.from) || idSet.has(message?.to)) return true;
        const messagePhone = digitsOnly(message?.peerPhone);
        return Boolean(phoneTail && messagePhone.endsWith(phoneTail));
    }) || null;
};

const preferredChatId = ({ state = null, message = null, phone = '' } = {}) => {
    const candidates = [state?.chatId, message?.chatId, message?.from, message?.to]
        .map(clean)
        .filter((value) => value
            && value !== 'bot'
            && !value.endsWith('@g.us')
            && !value.endsWith('@lid')
            && value !== 'status@broadcast');
    return candidates[0] || (phone ? `${digitsOnly(phone)}@c.us` : '');
};

export const searchPanelCustomersGlobally = async ({
    query = '',
    limit = 8,
    models = { ContactState, Order, Shipment, Message }
} = {}) => {
    const descriptor = describePanelGlobalSearchQuery(query);
    const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 8, PANEL_GLOBAL_SEARCH_LIMIT_MAX));
    if (!descriptor.valid) {
        return { query: descriptor, count: 0, results: [], reason: descriptor.reason };
    }

    const queries = baseQueriesForDescriptor(descriptor);
    const [matchedStates, matchedOrders, matchedShipments] = await Promise.all([
        models.ContactState.find(queries.contact).sort({ updatedAt: -1 }).limit(safeLimit * 3).lean(),
        models.Order.find(queries.order).sort({ updatedAt: -1, createdAt: -1 }).limit(safeLimit * 3).lean(),
        models.Shipment.find(queries.shipment).sort({ updatedAt: -1, createdAt: -1 }).limit(safeLimit * 3).lean()
    ]);

    const groups = new Map();
    const add = ({ state = null, order = null, shipment = null, matchedBy = '' } = {}) => {
        const key = resultGroupKey({ descriptor, state, order, shipment });
        if (!key) return;
        const group = groups.get(key) || {
            key,
            states: [],
            orders: [],
            shipments: [],
            matchedBy: new Set(),
            preferredOrderId: ''
        };
        if (state && !group.states.some((item) => String(item?._id) === String(state?._id))) group.states.push(state);
        if (order && !group.orders.some((item) => item?.orderId === order?.orderId)) group.orders.push(order);
        if (shipment && !group.shipments.some((item) => item?.orderId === shipment?.orderId)) group.shipments.push(shipment);
        if (matchedBy) group.matchedBy.add(matchedBy);
        group.preferredOrderId = group.preferredOrderId || matchedOrderIdForEntity(descriptor, order, shipment);
        groups.set(key, group);
    };

    matchedStates.forEach((state) => add({ state, matchedBy: descriptor.kind === 'name' ? 'contact_name' : 'contact_phone' }));
    matchedOrders.forEach((order) => add({
        order,
        matchedBy: descriptor.kind === 'order'
            ? 'order_id'
            : (directNumericOrderMatch(descriptor, order, null) ? 'dropi_or_tracking' : descriptor.kind === 'name' ? 'order_name' : 'order_phone')
    }));
    matchedShipments.forEach((shipment) => add({
        shipment,
        matchedBy: descriptor.kind === 'order'
            ? 'shipment_order_id'
            : (directNumericOrderMatch(descriptor, null, shipment) ? 'dropi_or_tracking' : descriptor.kind === 'name' ? 'shipment_name' : 'shipment_phone')
    }));

    const phones = unique([
        ...matchedStates.map(statePhone),
        ...matchedOrders.map(orderPhone),
        ...matchedShipments.map(shipmentPhone)
    ]).filter((phone) => phone.length >= 8);
    const relatedOrderQuery = phones.length ? relatedPhoneQuery('customer.phone', phones) : null;
    const relatedShipmentQuery = phones.length ? relatedPhoneQuery('client.phone', phones) : null;
    const relatedStateQuery = phones.length ? relatedPhoneQuery('phoneDigits', phones) : null;
    const [relatedOrders, relatedShipments, relatedStates] = phones.length ? await Promise.all([
        models.Order.find({ country: 'EC', ...relatedOrderQuery }).sort({ updatedAt: -1 }).limit(safeLimit * 8).lean(),
        models.Shipment.find({ country: 'EC', ...relatedShipmentQuery }).sort({ updatedAt: -1 }).limit(safeLimit * 8).lean(),
        models.ContactState.find({ countryCode: 'EC', ...relatedStateQuery }).sort({ updatedAt: -1 }).limit(safeLimit * 8).lean()
    ]) : [[], [], []];

    for (const group of groups.values()) {
        const phone = canonicalPhone(
            ...group.orders.map(orderPhone),
            ...group.shipments.map(shipmentPhone),
            ...group.states.map(statePhone)
        );
        const tail = phone.slice(-9);
        if (!tail) continue;
        relatedOrders.filter((order) => orderPhone(order).endsWith(tail)).forEach((order) => {
            if (!group.orders.some((item) => item?.orderId === order?.orderId)) group.orders.push(order);
        });
        relatedShipments.filter((shipment) => shipmentPhone(shipment).endsWith(tail)).forEach((shipment) => {
            if (!group.shipments.some((item) => item?.orderId === shipment?.orderId)) group.shipments.push(shipment);
        });
        relatedStates.filter((state) => statePhone(state).endsWith(tail)).forEach((state) => {
            if (!group.states.some((item) => String(item?._id) === String(state?._id))) group.states.push(state);
        });
    }

    const messageClauses = [];
    const allChatIds = unique([...matchedStates, ...relatedStates].map((state) => clean(state?.chatId)));
    allChatIds.forEach((chatId) => messageClauses.push({ chatId }, { from: chatId }, { to: chatId }));
    unique(phones.map((phone) => phone.slice(-9))).forEach((tail) => {
        if (tail) messageClauses.push({ peerPhone: { $regex: new RegExp(`${tail}$`) } });
    });
    const messages = messageClauses.length
        ? await models.Message.find({ $or: messageClauses }).sort({ timestamp: -1, createdAt: -1 }).limit(safeLimit * 20).lean()
        : [];

    const results = [...groups.values()].map((group) => {
        const contactState = group.states[0] || null;
        const phone = canonicalPhone(
            ...group.orders.map(orderPhone),
            ...group.shipments.map(shipmentPhone),
            ...group.states.map(statePhone)
        );
        const lastMessage = latestMessageForIdentity(messages, {
            phone,
            chatIds: group.states.map((state) => state?.chatId)
        });
        const readModel = projectPanelCustomerReadModel({
            contactState,
            orders: group.orders,
            shipments: group.shipments,
            lastMessage,
            fallbackName: contactState?.metadata?.profileName || '',
            fallbackPhone: phone,
            preferredOrderId: group.preferredOrderId
        });
        const order = readModel.order;
        const draft = readModel.customerDraft;
        return {
            id: preferredChatId({ state: contactState, message: lastMessage, phone: readModel.phoneDigits || phone }),
            phone: readModel.phone || phone,
            name: readModel.displayName,
            contactName: readModel.conversationName,
            officialOrderName: readModel.officialOrderName,
            identityDiffers: readModel.identityDiffers,
            country: 'EC',
            city: draft.city || null,
            province: draft.province || null,
            address: draft.address || null,
            reference: draft.reference || null,
            deliveryMode: draft.deliveryMode || null,
            agencyId: draft.agencyId || null,
            agencyName: draft.agencyName || null,
            orderId: readModel.selectedOrderId || draft.orderId || null,
            orderStatus: readModel.orderStatus,
            quantity: order?.package?.quantity ?? draft.quantity ?? null,
            packageLabel: order?.package?.label || null,
            total: order?.total ?? draft.total ?? null,
            currency: order?.currency || null,
            productKey: order?.tracking?.productKey || draft.productKey || null,
            productName: order?.tracking?.productName || draft.productName || draft.product || null,
            customerDraft: draft,
            logistics: readModel.logistics,
            operationalStatus: readModel.operationalStatus,
            orderCandidateCount: readModel.orderCandidateCount,
            selectionReason: readModel.selectionReason,
            profilePictureUrl: String(contactState?.metadata?.profilePictureUrl || ''),
            unreadCount: 0,
            unansweredCount: 0,
            lastMessage: lastMessage ? {
                timestamp: lastMessage.timestamp,
                isFromMe: Boolean(lastMessage.isFromMe),
                type: lastMessage.type || 'chat'
            } : null,
            tags: contactState?.tags || [],
            human: contactState?.human || { mode: 'auto' },
            conversationBucket: contactState?.conversationBucket || { value: 'attendance' },
            source: 'global_search_read_only',
            readOnly: true,
            matchedBy: [...group.matchedBy]
        };
    }).filter((item) => item.id && digitsOnly(item.phone || item.id).length >= 8)
        .sort((left, right) => {
            const leftExact = left.selectionReason === 'preferred_exact_search_match' ? 1 : 0;
            const rightExact = right.selectionReason === 'preferred_exact_search_match' ? 1 : 0;
            if (leftExact !== rightExact) return rightExact - leftExact;
            return Number(right.lastMessage?.timestamp || 0) - Number(left.lastMessage?.timestamp || 0);
        })
        .slice(0, safeLimit);

    return {
        query: descriptor,
        count: results.length,
        results,
        reason: results.length ? 'ok' : 'not_found',
        readOnly: true
    };
};

export default searchPanelCustomersGlobally;
