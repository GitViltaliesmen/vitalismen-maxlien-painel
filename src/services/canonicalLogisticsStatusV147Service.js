import crypto from 'node:crypto';

export const CANONICAL_LOGISTICS_STATUS_V147 = Object.freeze({
    GUIDE_CREATED: 'GUIDE_CREATED',
    PICKED_UP_BY_CARRIER: 'PICKED_UP_BY_CARRIER',
    IN_TRANSIT: 'IN_TRANSIT',
    LOGISTICS_CENTER: 'LOGISTICS_CENTER',
    ENTERING_AGENCY: 'ENTERING_AGENCY',
    READY_FOR_PICKUP: 'READY_FOR_PICKUP',
    DELIVERED: 'DELIVERED',
    NOT_PICKED_UP: 'NOT_PICKED_UP',
    RETURNING: 'RETURNING',
    RETURNED: 'RETURNED',
    EXCEPTION: 'EXCEPTION',
    UNKNOWN: 'UNKNOWN'
});

const clean = (value = '') => String(value ?? '').trim();
const token = (value = '') => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
const semantic = (...values) => token(values.filter(Boolean).join(' '));

const READY_CODES = new Set([
    'READY_FOR_PICKUP', 'LISTO_PARA_RETIRO', 'DISPONIBLE_PARA_RETIRO',
    'PARA_RETIRO_EN_AGENCIA', 'DISPONIBLE_EN_AGENCIA'
]);
const DELIVERED_CODES = new Set(['DELIVERED', 'ENTREGADO', 'MERCANCIA_ENTREGADA', 'PEDIDO_ENTREGADO']);
const RETURNED_CODES = new Set(['RETURNED', 'DEVUELTO', 'ENTREGADO_AL_REMITENTE', 'DEVUELTO_AL_REMITENTE']);
const RETURNING_CODES = new Set(['RETURNING', 'EN_DEVOLUCION', 'DEVOLUCION', 'RETORNO_AL_REMITENTE']);
const NOT_PICKED_UP_CODES = new Set(['NOT_PICKED_UP', 'NO_RETIRADO', 'NO_RECOGIDO']);
const EXCEPTION_CODES = new Set(['EXCEPTION', 'NOVEDAD', 'INCIDENCIA', 'SINIESTRO', 'REPROGRAMADO']);
const GUIDE_CODES = new Set(['GUIDE_CREATED', 'GUIA_GENERADA', 'ADMITIDO', 'CREATED', 'PENDIENTE']);
const PICKED_UP_CODES = new Set(['PICKED_UP_BY_CARRIER', 'MERCANCIA_RECOGIDA', 'RECOGIDO_POR_TRANSPORTADORA']);
const CENTER_CODES = new Set(['LOGISTICS_CENTER', 'CENTRO_LOGISTICO', 'CENTRO_DE_DISTRIBUCION', 'EN_BODEGA_TRANSPORTADORA']);
const TRANSIT_CODES = new Set(['IN_TRANSIT', 'EN_TRANSITO', 'EN_RUTA', 'EN_REPARTO', 'EN_DESPACHO', 'EN_DISTRIBUCION_A_CLIENTE']);
const ENTERING_CODES = new Set(['ENTERING_AGENCY', 'INGRESANDO_EN_AGENCIA']);

const anyExact = (set, ...values) => values.map(token).some((value) => set.has(value));
const includesSemantic = (value, expressions) => expressions.some((expression) => expression.test(value));

const classify = ({ providerCode = '', providerStatus = '', providerSubstatus = '', legacyStatus = '' } = {}) => {
    const code = token(providerCode);
    const status = token(providerStatus);
    const substatus = token(providerSubstatus);
    const legacy = token(legacyStatus);
    const combined = semantic(providerStatus, providerSubstatus);

    // Provider code/status/substatus are evaluated in precedence order. Text is
    // accepted only inside the provider fields, never from panel or human copy.
    if (anyExact(RETURNED_CODES, code, status, substatus, legacy)
        || includesSemantic(combined, [/ENTREGAD[OA]_AL_REMITENTE/, /DEVUELT[OA]_AL_REMITENTE/])) return 'RETURNED';
    if (anyExact(DELIVERED_CODES, code, status, substatus, legacy)
        || includesSemantic(combined, [/MERCANCIA_ENTREGADA/, /PEDIDO_ENTREGADO/])) return 'DELIVERED';
    if (anyExact(NOT_PICKED_UP_CODES, code, status, substatus, legacy)
        || includesSemantic(combined, [/NO_RETIRAD[OA]/, /NO_RECOGID[OA]/])) return 'NOT_PICKED_UP';
    if (anyExact(RETURNING_CODES, code, status, substatus, legacy)
        || includesSemantic(combined, [/(^|_)DEVOLUCION(_|$)/, /RETORNO_AL_REMITENTE/])) return 'RETURNING';
    if (anyExact(EXCEPTION_CODES, code, status, substatus, legacy)
        || includesSemantic(combined, [/(^|_)NOVEDAD(_|$)/, /INCIDENCIA/, /SINIESTRO/])) return 'EXCEPTION';
    if (anyExact(READY_CODES, code, status, substatus, legacy)
        || includesSemantic(combined, [/DISPONIBLE_PARA_(EL_)?RETIRO/, /LIST[OA]_PARA_(EL_)?RETIRO/, /PARA_RETIRO_EN_AGENCIA/])) return 'READY_FOR_PICKUP';
    if (anyExact(ENTERING_CODES, code, status, substatus, legacy)
        || includesSemantic(combined, [/INGRESANDO_EN_AGENCIA/])) return 'ENTERING_AGENCY';
    if (anyExact(PICKED_UP_CODES, code, status, substatus, legacy)
        || includesSemantic(combined, [/MERCANCIA_RECOGIDA/, /RECOGID[OA]_POR_(LA_)?TRANSPORTADORA/])) return 'PICKED_UP_BY_CARRIER';
    if (anyExact(CENTER_CODES, code, status, substatus, legacy)
        || includesSemantic(combined, [/CENTRO_(LOGISTICO|DE_DISTRIBUCION)/, /EN_BODEGA_TRANSPORTADORA/])) return 'LOGISTICS_CENTER';
    if (anyExact(TRANSIT_CODES, code, status, substatus, legacy)
        || includesSemantic(combined, [/EN_(RUTA|TRANSITO|REPARTO|DESPACHO)/, /DISTRIBUCION_A_CLIENTE/])) return 'IN_TRANSIT';
    if (anyExact(GUIDE_CODES, code, status, substatus, legacy)
        || includesSemantic(combined, [/GUIA_GENERADA/, /GENERADO_CLIENTE_CORPORATIVO/, /PREPARAD[OA]_PARA_TRANSPORTADORA/])) return 'GUIDE_CREATED';
    return 'UNKNOWN';
};

const META = Object.freeze({
    GUIDE_CREATED: { terminal: false, canPickup: false, panelLabel: 'Guia gerada · ainda não retirar', postSaleEvent: 'P1', reminderEligible: false, reviewRequired: false },
    PICKED_UP_BY_CARRIER: { terminal: false, canPickup: false, panelLabel: 'Coletado pela transportadora · ainda não retirar', postSaleEvent: '', reminderEligible: false, reviewRequired: false },
    IN_TRANSIT: { terminal: false, canPickup: false, panelLabel: 'Em trânsito · ainda não retirar', postSaleEvent: '', reminderEligible: false, reviewRequired: false },
    LOGISTICS_CENTER: { terminal: false, canPickup: false, panelLabel: 'Centro logístico · ainda não retirar', postSaleEvent: '', reminderEligible: false, reviewRequired: false },
    ENTERING_AGENCY: { terminal: false, canPickup: false, panelLabel: 'Ingressando na agência · ainda não retirar', postSaleEvent: '', reminderEligible: false, reviewRequired: false },
    READY_FOR_PICKUP: { terminal: false, canPickup: true, panelLabel: 'Disponível para retirada', postSaleEvent: 'P2', reminderEligible: true, reviewRequired: false },
    DELIVERED: { terminal: true, canPickup: false, panelLabel: 'Entregue', postSaleEvent: 'P5', reminderEligible: false, reviewRequired: false },
    NOT_PICKED_UP: { terminal: false, canPickup: false, panelLabel: 'Não retirado · em revisão', postSaleEvent: '', reminderEligible: false, reviewRequired: true },
    RETURNING: { terminal: false, canPickup: false, panelLabel: 'Em devolução', postSaleEvent: '', reminderEligible: false, reviewRequired: true },
    RETURNED: { terminal: true, canPickup: false, panelLabel: 'Devolvido', postSaleEvent: '', reminderEligible: false, reviewRequired: false },
    EXCEPTION: { terminal: false, canPickup: false, panelLabel: 'Exceção logística · revisar', postSaleEvent: '', reminderEligible: false, reviewRequired: true },
    UNKNOWN: { terminal: false, canPickup: false, panelLabel: 'Status logístico desconhecido · revisar', postSaleEvent: '', reminderEligible: false, reviewRequired: true }
});

export const canonicalLogisticsProjectionV147 = (input = {}) => {
    const canonicalStatus = classify(input);
    const meta = META[canonicalStatus];
    return Object.freeze({
        version: 147,
        provider: clean(input.provider || 'servientrega').toLowerCase(),
        rawCode: clean(input.providerCode),
        rawStatus: clean(input.providerStatus),
        rawSubstatus: clean(input.providerSubstatus),
        canonicalStatus,
        terminal: meta.terminal,
        canPickup: meta.canPickup,
        panelLabel: meta.panelLabel,
        postSaleEvent: meta.postSaleEvent,
        reminderEligible: meta.reminderEligible,
        reviewRequired: meta.reviewRequired,
        postSaleSend: canonicalStatus !== 'UNKNOWN'
    });
};

export const canonicalLogisticsProjectionForShipmentV147 = (shipment = {}) => {
    const evidence = shipment?.logistics?.canonicalEvidence || shipment?.raw?.carrierTracking?.lastResult || {};
    const stored = token(shipment?.logistics?.canonicalStatus);
    if (META[stored] && (stored !== 'UNKNOWN' || clean(evidence.rawStatus || evidence.statusAtual || evidence.providerStatus))) {
        return Object.freeze({
            version: 147,
            provider: clean(evidence.provider || evidence.carrier || 'servientrega').toLowerCase(),
            rawCode: clean(evidence.rawCode || evidence.providerStatusCode || evidence.statusCode),
            rawStatus: clean(evidence.rawStatus || evidence.statusAtual || evidence.providerStatus),
            rawSubstatus: clean(evidence.rawSubstatus || evidence.ultimoMovimiento || evidence.providerSubstatus),
            canonicalStatus: stored,
            ...META[stored],
            postSaleSend: stored !== 'UNKNOWN'
        });
    }
    return canonicalLogisticsProjectionV147({
        provider: evidence.provider || evidence.carrier,
        providerCode: evidence.rawCode || evidence.providerStatusCode || evidence.statusCode,
        providerStatus: evidence.rawStatus || evidence.statusAtual || evidence.providerStatus,
        providerSubstatus: evidence.rawSubstatus || evidence.ultimoMovimiento || evidence.providerSubstatus,
        legacyStatus: shipment?.logistics?.status
    });
};

const canonicalIdentityValue = (value = '') => clean(value?._id || value);

export const canonicalPostSaleIdentityV147 = (shipment = {}) => {
    const customerId = canonicalIdentityValue(
        shipment?.raw?.historicalExternalReconciliation?.customerId
        || shipment?.raw?.customerId
        || shipment?.client?.customerId
    );
    const orderId = clean(shipment?.orderId);
    const shipmentId = canonicalIdentityValue(shipment?._id);
    return Object.freeze({
        customerId,
        orderId,
        shipmentId,
        valid: Boolean(customerId && orderId && shipmentId)
    });
};

export const servientregaCanonicalDeliveredV147 = (shipment = {}) => {
    const evidence = shipment?.logistics?.canonicalEvidence || {};
    const provider = token(evidence.provider || evidence.carrier || shipment?.logistics?.distributionCompany);
    const source = token(evidence.source);
    const hasProviderEvidence = Boolean(clean(
        evidence.rawCode
        || evidence.providerStatusCode
        || evidence.rawStatus
        || evidence.statusAtual
        || evidence.rawSubstatus
        || evidence.ultimoMovimiento
    ));
    if (provider !== 'SERVIENTREGA' || source !== 'CARRIER_TRACKING' || !hasProviderEvidence) return false;
    const evidenceProjection = canonicalLogisticsProjectionV147({
        provider: evidence.provider || evidence.carrier,
        providerCode: evidence.rawCode || evidence.providerStatusCode,
        providerStatus: evidence.rawStatus || evidence.statusAtual,
        providerSubstatus: evidence.rawSubstatus || evidence.ultimoMovimiento
    });
    return token(shipment?.logistics?.canonicalStatus) === 'DELIVERED'
        && evidenceProjection.canonicalStatus === 'DELIVERED';
};

export const servientregaPostSaleCompletionEligibleV147 = (shipment = {}) => (
    servientregaCanonicalDeliveredV147(shipment)
    && canonicalPostSaleIdentityV147(shipment).valid
    && shipment?.outcomes?.returned !== true
);

export const legacyLogisticsStatusForV147 = (canonicalStatus = '') => ({
    GUIDE_CREATED: 'GUIA_GENERADA',
    PICKED_UP_BY_CARRIER: 'EN_RUTA',
    IN_TRANSIT: 'EN_RUTA',
    LOGISTICS_CENTER: 'EN_RUTA',
    ENTERING_AGENCY: 'EN_RUTA',
    READY_FOR_PICKUP: 'READY_FOR_PICKUP',
    DELIVERED: 'ENTREGADO',
    NOT_PICKED_UP: 'EN_RUTA',
    RETURNING: 'EN_RUTA',
    RETURNED: 'DEVUELTO',
    EXCEPTION: 'NOVEDAD',
    UNKNOWN: ''
}[token(canonicalStatus)] || '');

export const buildPostSaleDedupeKeyV147 = ({
    customerId = '', orderId = '', shipmentId = '', canonicalEvent = '', templateId = ''
} = {}) => {
    const parts = [customerId, orderId, shipmentId, canonicalEvent, templateId].map(clean);
    if (parts.some((part) => !part)) return '';
    return `post-sale-v147:${crypto.createHash('sha256').update(parts.join('|')).digest('hex')}`;
};

export const reminderDueV147 = ({ acceptedAt = null, a10SentAt = null, a19SentAt = null, now = new Date(), canonicalStatus = '' } = {}) => {
    if (token(canonicalStatus) !== 'READY_FOR_PICKUP' || !acceptedAt) return null;
    const t0 = new Date(acceptedAt).getTime();
    const current = new Date(now).getTime();
    if (!Number.isFinite(t0) || !Number.isFinite(current)) return null;
    if (!a10SentAt && current >= t0 + (72 * 60 * 60 * 1000)) return Object.freeze({ event: 'P3', templateId: 'A10', dueAt: new Date(t0 + (72 * 60 * 60 * 1000)) });
    if (a10SentAt && !a19SentAt && current >= t0 + (120 * 60 * 60 * 1000)) return Object.freeze({ event: 'P4', templateId: 'A19', dueAt: new Date(t0 + (120 * 60 * 60 * 1000)) });
    return null;
};

export default canonicalLogisticsProjectionV147;
