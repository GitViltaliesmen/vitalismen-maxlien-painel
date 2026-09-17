import VslVisit from '../models/VslVisit.js';
import {
    applyCurrentProductToState,
    vslProductAssignmentPolicy
} from './vslProductAssignmentService.js';
import { getEcuadorProductInfoByKey, isEcuadorProductKey } from './ecuadorProductService.js';

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const clean = (value = '') => String(value || '').trim();
const PRELEAD_WINDOW_MS = 24 * 60 * 60 * 1000;

const productLabel = (visit = {}) => {
    const product = getEcuadorProductInfoByKey(visit.productKey);
    return clean(visit.productName || product?.displayName || product?.name || 'Produto EC');
};

export const isPendingVslPrelead = (visit = {}, { now = new Date() } = {}) => {
    const clickedAt = new Date(visit.lastClickAt || 0).getTime();
    const reference = new Date(now).getTime();
    return String(visit.country || '').toUpperCase() === 'EC'
        && isEcuadorProductKey(visit.productKey)
        && Number(visit.clickCount || 0) > 0
        && !digitsOnly(visit.customerPhone)
        && Number.isFinite(clickedAt)
        && Number.isFinite(reference)
        && clickedAt >= reference - PRELEAD_WINDOW_MS
        && clickedAt <= reference + 30_000;
};

export const projectVslPreleadPanelChat = (visit = {}) => {
    if (!isPendingVslPrelead(visit)) return null;
    const id = clean(visit._id?.toString?.() || visit._id || visit.visitorKey);
    if (!id) return null;
    const label = productLabel(visit);
    const entryAt = visit.lastClickAt || visit.lastSeenAt || visit.createdAt || visit.firstSeenAt || null;
    return {
        id: `vsl-prelead:${id}`,
        phone: '',
        name: `VSL · ${label.replace(/ Ecuador$/i, '').toUpperCase()}`,
        contactName: clean(visit.customerName),
        country: 'EC',
        entryAt,
        firstInboundAt: null,
        lastInboundAt: null,
        lastOutboundAt: null,
        lastActivityAt: entryAt,
        createdAt: visit.createdAt || visit.firstSeenAt || entryAt,
        updatedAt: visit.updatedAt || visit.lastSeenAt || entryAt,
        unreadCount: 0,
        unansweredCount: 0,
        lastMessage: null,
        isGroup: false,
        orderId: null,
        orderStatus: 'novo',
        operationalStatus: { key: 'novo', label: 'Novo' },
        productKey: visit.productKey,
        productName: label,
        vslProductKey: visit.productKey,
        vslProductName: label,
        vslPath: clean(visit.path),
        vslPrelead: true,
        vslVisitId: id,
        vslVisitorId: clean(visit.externalId || visit.visitorId),
        vslSessionId: clean(visit.sessionId),
        tags: ['VSL_EC', 'VSL_PRELEAD', 'AGUARDANDO_WHATSAPP'],
        human: { mode: 'auto', assignedName: 'Aguardando WhatsApp' },
        conversationBucket: {
            value: 'attendance',
            source: 'vsl_prelead_provider_independent',
            confidence: 'high',
            reasons: ['vsl_entry_waiting_whatsapp']
        },
        customerDraft: {
            name: clean(visit.customerName),
            phone: '',
            country: 'EC',
            status: 'novo',
            source: 'vsl_prelead_provider_independent',
            productKey: visit.productKey,
            productName: label,
            vslEntryMessage: clean(visit.vslEntryMessage || visit.lastWhatsappMessage || visit.lastEntryMessage),
            entryAt
        }
    };
};

export const listPendingVslPreleadPanelChats = async ({
    country = 'EC',
    limit = 80,
    now = new Date(),
    VisitModel = VslVisit
} = {}) => {
    if (String(country || '').toUpperCase() !== 'EC') return [];
    const since = new Date(new Date(now).getTime() - PRELEAD_WINDOW_MS);
    const visits = await VisitModel.find({
        country: 'EC',
        clickCount: { $gt: 0 },
        lastClickAt: { $gte: since },
        productKey: { $in: ['tex_ultra_ec', 'nitrix_ec', 'vit_power_ec'] },
        $or: [
            { customerPhone: '' },
            { customerPhone: { $exists: false } }
        ]
    }).sort({ lastClickAt: -1, updatedAt: -1 }).limit(Math.min(100, Math.max(1, Number(limit) || 80))).lean();
    return visits.map((visit) => projectVslPreleadPanelChat(visit)).filter(Boolean);
};

export const mergeClaimedVslPreleadIntoContactState = ({ state, claim, at = new Date() } = {}) => {
    if (!state || claim?.ok !== true || claim?.claimed !== true || !isEcuadorProductKey(claim.productKey)) return false;
    const now = new Date(at);
    const product = getEcuadorProductInfoByKey(claim.productKey);
    const productName = clean(claim.productName || product?.displayName || product?.name);
    const assignment = vslProductAssignmentPolicy({ state, incomingProductKey: claim.productKey });
    if (!assignment.preserveOperatorSelection) {
        applyCurrentProductToState({
            state,
            productKey: claim.productKey,
            productName,
            productMedia: product?.media || '',
            source: 'canonical_vsl_prelead_claim',
            at: now
        });
    }
    const draft = state.metadata?.customerDraft || {};
    state.metadata = {
        ...(state.metadata || {}),
        vslVisitId: claim.visitId,
        vslVisitorId: claim.visitorId,
        vslSessionId: claim.sessionId || '',
        vslSourceUrl: claim.sourceUrl || '',
        vslPath: claim.path || '',
        vslProductKey: claim.productKey,
        vslProductName: productName,
        vslProductSource: 'canonical_vsl_prelead_claim',
        vslEntryPanelLead: true,
        vslPhonePending: false,
        publicVslLeadEntry: true,
        tracking: {
            ...(state.metadata?.tracking || {}),
            ...(claim.tracking || {})
        },
        ...(!assignment.preserveOperatorSelection ? {
            productKey: claim.productKey,
            productName,
            productSource: 'canonical_vsl_prelead_claim'
        } : {}),
        customerDraft: {
            ...draft,
            name: draft.name || claim.customerName || '',
            city: draft.city || claim.customerCity || '',
            province: draft.province || claim.customerProvince || '',
            status: draft.status || 'novo',
            source: 'canonical_vsl_prelead_claim',
            ...(!assignment.preserveOperatorSelection ? {
                productKey: claim.productKey,
                productName
            } : {}),
            updatedAt: now.toISOString()
        }
    };
    state.tags = [...new Set([...(state.tags || []), 'VSL_EC', 'WHATSAPP_CLICK', 'VSL_PRELEAD_CONSOLIDATED'])];
    state.markModified?.('metadata');
    return true;
};

