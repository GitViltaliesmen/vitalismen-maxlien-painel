import { publicLogisticsStateV29 } from './logisticsCommunicationV29.js';
import { resolveOperationalChatStatus } from './operationalChatStatusService.js';
import { isRepurchaseOrderV146, isTerminalOrderV146 } from './ecCommercialCycleV146Service.js';

const ORDER_TERMINAL_STATUSES = new Set(['delivered', 'cancelled', 'returned']);
const LOGISTICS_TERMINAL_STATUSES = new Set(['DELIVERED', 'PICKED_UP', 'RETURNED']);

const clean = (value = '') => String(value || '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');
const dateMs = (...values) => {
    for (const value of values) {
        if (!value) continue;
        const parsed = new Date(value).getTime();
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};

const validDisplayName = (value = '') => {
    const name = clean(value).replace(/\s+/g, ' ');
    if (!name || name.length < 2 || name.length > 120) return '';
    if (/^\+?\d{7,}$/.test(name) || /@(?:c\.us|s\.whatsapp\.net|lid)$/i.test(name)) return '';
    return name;
};

const contactConversationName = (state = {}, lastMessage = null, fallback = '') => {
    const metadata = state?.metadata || {};
    const conflictName = metadata.identityConflict?.status === 'IDENTITY_CONFLICT'
        ? metadata.identityConflict.currentName
        : '';
    return [
        conflictName,
        metadata.manualNameLock?.active ? metadata.manualNameLock.name : '',
        metadata.verifiedCustomerName,
        metadata.submittedName,
        metadata.profileName,
        metadata.customerDraft?.name,
        lastMessage?.notifyName,
        fallback
    ].map(validDisplayName).find(Boolean) || clean(fallback);
};

const shipmentCanonicalStatus = (shipment = null) => (
    shipment ? publicLogisticsStateV29(shipment)?.status || 'UNKNOWN' : 'UNKNOWN'
);

const entityActivityMs = ({ order = null, shipment = null } = {}) => Math.max(
    dateMs(shipment?.logistics?.lastStatusAt, shipment?.updatedAt, shipment?.createdAt),
    dateMs(order?.updatedAt, order?.confirmedAt, order?.entryAt, order?.createdAt)
);

const entityPriority = ({ order = null, shipment = null } = {}) => {
    const orderStatus = clean(order?.status).toLowerCase();
    const logisticsStatus = shipmentCanonicalStatus(shipment);
    const activeShipment = Boolean(shipment?.orderId) && !LOGISTICS_TERMINAL_STATUSES.has(logisticsStatus);
    const activeOrder = Boolean(order?.orderId) && !ORDER_TERMINAL_STATUSES.has(orderStatus);
    const shipmentProof = Boolean(
        shipment?.logistics?.trackingNumber
        || shipment?.automation?.submittedToDroppiAt
        || shipment?.raw?.manualDropiOrderId
        || shipment?.raw?.latestDroppiPayload?.dropiOrderId
    );
    if (activeShipment && shipmentProof) return 6;
    if (activeOrder && shipment) return 5;
    if (activeOrder) return 4;
    if (shipment && LOGISTICS_TERMINAL_STATUSES.has(logisticsStatus)) return 3;
    if (order && ORDER_TERMINAL_STATUSES.has(orderStatus)) return 2;
    return order || shipment ? 1 : 0;
};

export const selectAuthoritativePanelOrder = ({ orders = [], shipments = [], preferredOrderId = '' } = {}) => {
    const orderById = new Map((orders || [])
        .filter((order) => clean(order?.orderId))
        .map((order) => [clean(order.orderId), order]));
    const shipmentByOrderId = new Map();
    (shipments || []).forEach((shipment) => {
        const orderId = clean(shipment?.orderId);
        if (!orderId) return;
        const current = shipmentByOrderId.get(orderId);
        if (!current || entityActivityMs({ shipment }) > entityActivityMs({ shipment: current })) {
            shipmentByOrderId.set(orderId, shipment);
        }
    });

    const orderIds = new Set([...orderById.keys(), ...shipmentByOrderId.keys()]);
    const preferred = clean(preferredOrderId);
    const candidates = [...orderIds].map((orderId) => {
        const order = orderById.get(orderId) || null;
        const shipment = shipmentByOrderId.get(orderId) || null;
        return {
            orderId,
            order,
            shipment,
            priority: entityPriority({ order, shipment }) + (preferred && preferred === orderId ? 100 : 0),
            activityMs: entityActivityMs({ order, shipment })
        };
    }).sort((left, right) => (
        right.priority - left.priority
        || right.activityMs - left.activityMs
        || String(right.orderId).localeCompare(String(left.orderId))
    ));

    const selected = candidates[0] || null;
    return Object.freeze({
        order: selected?.order || null,
        shipment: selected?.shipment || null,
        selectedOrderId: selected?.orderId || '',
        selectionReason: selected
            ? (preferred && preferred === selected.orderId
                ? 'preferred_exact_search_match'
                : `priority_${selected.priority}_latest_authoritative_entity`)
            : 'no_order_or_shipment',
        candidateCount: candidates.length,
        candidates: candidates.map((item) => ({
            orderId: item.orderId,
            priority: item.priority,
            activityAt: item.activityMs ? new Date(item.activityMs) : null
        }))
    });
};

export const panelStatusFromOperationalStatus = (operational = {}, draftStatus = '') => {
    const key = clean(operational?.key).toLowerCase();
    if (key === 'comprar_depois') return 'comprar_depois';
    if (key === 'confirmado') return 'confirmado';
    if (['enviado', 'em_rota', 'na_agencia'].includes(key)) return 'pedido_enviado';
    if (key === 'entregue') return 'entregue';
    if (key === 'devolvido') return 'devolvido';
    if (key === 'cancelado') return 'cancelado';
    return clean(draftStatus).toLowerCase() || 'novo';
};

export const projectPanelCustomerReadModel = ({
    contactState = null,
    orders = [],
    shipments = [],
    lastMessage = null,
    fallbackName = '',
    fallbackPhone = '',
    preferredOrderId = ''
} = {}) => {
    const selection = selectAuthoritativePanelOrder({ orders, shipments, preferredOrderId });
    const order = selection.order;
    const shipment = selection.shipment;
    const draft = contactState?.metadata?.customerDraft || {};
    const officialOrderName = validDisplayName(order?.customer?.name || shipment?.client?.name || '');
    const conversationName = contactConversationName(contactState || {}, lastMessage, fallbackName || fallbackPhone);
    const displayName = officialOrderName || conversationName || clean(fallbackPhone);
    const operationalStatus = resolveOperationalChatStatus({ contactState, order, shipment });
    const draftStatus = clean(draft.status).toLowerCase();
    const draftOrderId = clean(draft.currentNegotiationOrderId || draft.orderId);
    const historicalOrderId = clean(
        draft.historicalOrderId
        || draft.previousOrderId
        || (isTerminalOrderV146(order) ? order?.orderId : '')
        || (shipment && LOGISTICS_TERMINAL_STATUSES.has(shipmentCanonicalStatus(shipment)) ? shipment?.orderId : '')
    );
    const freshCommercialCycle = Boolean(
        draft.newCommercialCycle === true
        || draftStatus === 'recompra'
        || (historicalOrderId && draftOrderId && draftOrderId !== historicalOrderId)
        || isRepurchaseOrderV146(order, historicalOrderId)
    );
    const draftIsNewer = dateMs(draft.updatedAt) > entityActivityMs({ order, shipment });
    const draftWinsEditableFields = freshCommercialCycle || draftIsNewer;
    const projectedStatus = freshCommercialCycle && draftStatus
        ? draftStatus
        : panelStatusFromOperationalStatus(operationalStatus, draft.status);
    const phone = clean(
        (draftWinsEditableFields ? draft.phone : '')
        || order?.customer?.phone
        || shipment?.client?.phone
        || draft.phone
        || fallbackPhone
    );
    const logistics = publicLogisticsStateV29(shipment);
    const editable = (draftValue, orderValue, shipmentValue = '') => (
        draftWinsEditableFields
            ? clean(draftValue)
            : clean(orderValue || shipmentValue || draftValue)
    );
    const projectedDraft = {
        ...draft,
        ...((draftWinsEditableFields && validDisplayName(draft.name))
            ? { name: validDisplayName(draft.name) }
            : (officialOrderName ? { name: officialOrderName } : {})),
        ...(phone ? { phone } : {}),
        city: editable(draft.city, order?.customer?.city, shipment?.client?.city),
        province: editable(draft.province, order?.customer?.province, shipment?.client?.province),
        address: editable(draft.address, order?.customer?.address, shipment?.client?.address),
        reference: editable(draft.reference, order?.customer?.reference, shipment?.client?.reference),
        deliveryMode: editable(draft.deliveryMode, order?.delivery?.mode),
        agencyId: editable(draft.agencyId, order?.delivery?.agencyId),
        agencyName: editable(draft.agencyName, order?.delivery?.agencyName, shipment?.logistics?.agencyName),
        quantity: draftWinsEditableFields ? (draft.quantity ?? '') : (order?.package?.quantity ?? draft.quantity ?? ''),
        total: draftWinsEditableFields ? (draft.total ?? '') : (order?.total ?? draft.total ?? ''),
        orderId: freshCommercialCycle
            ? draftOrderId
            : clean(order?.orderId || shipment?.orderId || draft.orderId),
        currentNegotiationOrderId: freshCommercialCycle ? draftOrderId : clean(draft.currentNegotiationOrderId),
        historicalOrderId,
        status: projectedStatus
    };

    return Object.freeze({
        version: 146,
        phone,
        phoneDigits: digitsOnly(phone),
        displayName,
        conversationName,
        officialOrderName,
        identityDiffers: Boolean(
            officialOrderName
            && conversationName
            && officialOrderName.localeCompare(conversationName, undefined, { sensitivity: 'base' }) !== 0
        ),
        order,
        shipment,
        selectedOrderId: selection.selectedOrderId,
        orderCandidateCount: selection.candidateCount,
        selectionReason: selection.selectionReason,
        operationalStatus,
        orderStatus: projectedStatus,
        historicalOrderId,
        freshCommercialCycle,
        logistics,
        customerDraft: projectedDraft
    });
};

export default projectPanelCustomerReadModel;
