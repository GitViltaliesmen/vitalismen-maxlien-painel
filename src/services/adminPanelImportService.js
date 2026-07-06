import { spawnSync } from 'child_process';
import fs from 'fs';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';
import ContactState from '../models/ContactState.js';
import { getOrderDuplicateGuard } from './orderDuplicateGuardService.js';
import { normalizeEcuadorOrderFieldsForDropi } from './dropiDataNormalizationService.js';

const ADMIN_DB_BY_COUNTRY = {
    EC: '/opt/maxlien-mvp/leads_ec.sqlite3'
};

const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const ecuadorProvinces = new Set([
    'AZUAY',
    'BOLIVAR',
    'CANAR',
    'CARCHI',
    'CHIMBORAZO',
    'COTOPAXI',
    'EL ORO',
    'ESMERALDAS',
    'GALAPAGOS',
    'GUAYAS',
    'IMBABURA',
    'LOJA',
    'LOS RIOS',
    'MANABI',
    'MORONA SANTIAGO',
    'NAPO',
    'ORELLANA',
    'PASTAZA',
    'PICHINCHA',
    'SANTA ELENA',
    'SANTO DOMINGO',
    'SANTO DOMINGO DE LOS TSACHILAS',
    'SUCUMBIOS',
    'TUNGURAHUA',
    'ZAMORA CHINCHIPE'
]);

const normalizeLocation = ({ city, province }) => {
    const cityText = String(city || '').trim();
    const provinceText = String(province || '').trim();
    const cityLooksLikeProvince = ecuadorProvinces.has(normalizeText(cityText));
    const provinceLooksLikeProvince = ecuadorProvinces.has(normalizeText(provinceText));
    if (cityLooksLikeProvince && !provinceLooksLikeProvince) {
        return { city: provinceText, province: cityText };
    }
    return { city: cityText, province: provinceText };
};

const packageLabel = (quantity) => `Vit Power ${quantity} frasco${Number(quantity) > 1 ? 's' : ''}`;

const clean = (value) => String(value || '').trim();
const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const validPackageQuantities = new Set([1, 2, 3, 6]);

const normalizePackageQuantity = (value) => {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return validPackageQuantities.has(parsed) ? parsed : 0;
};

const parseDateOrNull = (value) => {
    const raw = clean(value);
    if (!raw) return null;
    const normalized = raw.endsWith('Z') ? raw : raw.replace(' ', 'T');
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeStatusToken = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const LOCAL_PROTECTED_ORDER_STATUSES = new Set([
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'canceled',
    'returned'
]);

const LOCAL_PROTECTED_REVIEW_STATUSES = new Set([
    'conferir_pedidos',
    'finalizado'
]);

const LOCAL_PROTECTED_DRAFT_STATUSES = new Set([
    'cancelled',
    'canceled',
    'cancelado',
    'returned',
    'devolvido',
    'finalizado',
    'conferir_pedidos'
]);

const normalizeEcuadorLocalPhone = (value) => {
    const digits = digitsOnly(value);
    if (digits.startsWith('593') && digits.length > 9) return digits.slice(3);
    return digits;
};

const isValidEcuadorMobilePhone = (value) => /^9\d{8}$/.test(normalizeEcuadorLocalPhone(value));

const pickLeadPhone = (lead) => {
    const candidates = [lead.phone, lead.phone_e164]
        .map(clean)
        .filter(Boolean);
    return candidates.find(isValidEcuadorMobilePhone) || candidates[0] || '';
};

const isAgencyPickupAddress = (value) => /servientrega|agencia|concesion|retiro/i.test(
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
);

const readConfirmedAdminLeads = ({ country = 'EC', limit = 50, lookbackHours = 168 } = {}) => {
    const dbPath = ADMIN_DB_BY_COUNTRY[country];
    if (!dbPath || !fs.existsSync(dbPath)) {
        return { ok: true, skipped: true, reason: 'admin_db_not_found', leads: [] };
    }

    const python = `
import sqlite3, json, datetime
db_path = ${JSON.stringify(dbPath)}
limit = int(${JSON.stringify(limit)})
lookback_hours = int(${JSON.stringify(lookbackHours)})
now = datetime.datetime.now(datetime.timezone.utc)

def parse_dt(value):
    raw = str(value or '').strip()
    if not raw:
        return None
    try:
        if raw.endswith('Z'):
            raw = raw[:-1] + '+00:00'
        if 'T' in raw:
            dt = datetime.datetime.fromisoformat(raw)
        else:
            dt = datetime.datetime.strptime(raw.replace(' UTC', ''), '%Y-%m-%d %H:%M:%S')
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt.astimezone(datetime.timezone.utc)
    except Exception:
        return None

con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
rows = con.execute("""
    SELECT * FROM leads
    WHERE lower(coalesce(status,'')) = 'confirmado'
    ORDER BY COALESCE(created_at, updated_at, '') DESC, id DESC
    LIMIT ?
""", (max(limit * 8, 500),)).fetchall()
con.close()

out = []
for row in rows:
    data = dict(row)
    activity = parse_dt(data.get('created_at')) or parse_dt(data.get('updated_at'))
    if lookback_hours > 0 and activity and (now - activity).total_seconds() > lookback_hours * 3600:
        continue
    out.append(data)
    if len(out) >= limit:
        break

print(json.dumps({"ok": True, "count": len(out), "leads": out}, ensure_ascii=False))
`;

    const result = spawnSync('python3', ['-'], {
        input: python,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10
    });

    if (result.status !== 0) {
        return {
            ok: false,
            reason: 'admin_import_read_failed',
            error: result.stderr || result.stdout || `exit_${result.status}`,
            leads: []
        };
    }

    try {
        return JSON.parse(result.stdout || '{}');
    } catch (error) {
        return { ok: false, reason: 'admin_import_invalid_json', error: error.message, leads: [] };
    }
};

const mapLeadToOrderData = ({ lead, country }) => {
    const quantity = normalizePackageQuantity(lead.product_qty);
    const total = Number.parseFloat(String(lead.product_value || '0')) || 0;
    if (!quantity || total <= 0) {
        return null;
    }
    const normalized = normalizeEcuadorOrderFieldsForDropi({
        name: lead.name,
        phone: pickLeadPhone(lead),
        address: lead.address,
        city: lead.city,
        province: lead.province,
        quantity,
        total
    });
    const leadId = String(lead.id || '').trim();
    const eventId = clean(lead.event_id);
    const orderId = `${country}-ADMIN-${leadId}`;
    const entryAt = parseDateOrNull(lead.created_at) || parseDateOrNull(lead.updated_at) || new Date();
    return {
        orderId,
        country,
        entryAt,
        draftCreatedAt: entryAt,
        customer: {
            name: normalized.name,
            phone: normalized.phone,
            address: normalized.address,
            city: normalized.city,
            province: normalized.province
        },
        package: {
            id: normalized.quantity,
            label: packageLabel(normalized.quantity),
            quantity: normalized.quantity
        },
        total: normalized.total,
        currency: 'USD',
        status: 'confirmed',
        source: 'manual',
        dropiNormalization: normalized,
        notes: [
            'Importado automaticamente do painel online maxlien.shop',
            `Lead admin ${country} #${leadId}`,
            `Status original: ${lead.status || ''}`,
            `Criado online: ${lead.created_at || ''}`,
            `Normalizacao Dropi: ${normalized.normalizedBy}${normalized.agencyValidated ? ':agencia_validada' : ''}`,
            'Dropi exige autorizacao manual antes de enviar'
        ].join(' | ')
    };
};

const findExistingOrderForLead = async ({ orderData, lead, country }) => {
    const leadId = clean(lead.id);
    const eventId = clean(lead.event_id);
    const candidateIds = [
        leadId ? `${country}-ADMIN-${leadId}` : '',
        eventId,
        orderData.orderId
    ].filter(Boolean);

    const byId = await Order.findOne({ orderId: { $in: [...new Set(candidateIds)] } });
    if (byId) return byId;

    const phoneTail = clean(orderData.customer.phone).replace(/\D/g, '').slice(-9);
    if (!phoneTail) return null;

    return Order.findOne({
        country,
        'customer.phone': { $regex: `${phoneTail}$` },
        status: { $in: ['draft', 'pending', 'confirmed', 'processing', 'shipped'] }
    }).sort({ updatedAt: -1, createdAt: -1 });
};

const findLocalContactOverrideForLead = async ({ orderData, country }) => {
    const phoneTail = digitsOnly(orderData.customer?.phone || '').slice(-9);
    if (!phoneTail) return null;
    const contactState = await ContactState.findOne({
        countryCode: country,
        $or: [
            { phoneDigits: { $regex: `${phoneTail}$` } },
            { chatId: { $regex: phoneTail } },
            { 'metadata.customerDraft.phone': { $regex: `${phoneTail}$` } },
            { 'metadata.customerDraft.phoneE164': { $regex: `${phoneTail}$` } }
        ]
    }).sort({ updatedAt: -1, createdAt: -1 }).lean();

    const draftStatus = normalizeStatusToken(contactState?.metadata?.customerDraft?.status);
    if (LOCAL_PROTECTED_DRAFT_STATUSES.has(draftStatus)) {
        return {
            type: 'contact_draft_status',
            value: draftStatus,
            phoneTail,
            updatedAt: contactState?.updatedAt
        };
    }
    return null;
};

const getLocalImportProtection = async ({ existing, orderData, country }) => {
    const orderStatus = normalizeStatusToken(existing?.status);
    if (LOCAL_PROTECTED_ORDER_STATUSES.has(orderStatus)) {
        return { type: 'order_status', value: orderStatus };
    }

    const reviewStatus = normalizeStatusToken(existing?.reviewQueue?.status);
    if (LOCAL_PROTECTED_REVIEW_STATUSES.has(reviewStatus)) {
        return { type: 'review_queue', value: reviewStatus };
    }

    return findLocalContactOverrideForLead({ orderData, country });
};

const ensureShipmentMirror = async ({ orderData, lead }) => {
    const shipment = await Shipment.findOne({ orderId: orderData.orderId }) || new Shipment({
        orderId: orderData.orderId,
        country: orderData.country
    });

    shipment.provider = 'droppi';
    shipment.productName = 'Vit Power';
    shipment.client = {
        ...(shipment.client || {}),
        name: orderData.customer.name,
        phone: String(orderData.customer.phone || '').replace(/\D/g, ''),
        address: orderData.customer.address,
        city: orderData.customer.city,
        province: orderData.customer.province,
        reference: shipment.client?.reference || ''
    };
    shipment.logistics = {
        ...(shipment.logistics || {}),
        status: shipment.logistics?.status || 'CREATED',
        preferredCarrier: shipment.logistics?.preferredCarrier || 'SERVIENTREGA',
        agencyPickup: Boolean(orderData.dropiNormalization?.agencyPickup ?? shipment.logistics?.agencyPickup ?? isAgencyPickupAddress(orderData.customer.address)),
        agencyName: shipment.logistics?.agencyName || orderData.dropiNormalization?.agencyName || ''
    };
    const currentReview = shipment.review || {};
    const hasReviewReason = Object.prototype.hasOwnProperty.call(currentReview, 'reviewReason');
    shipment.review = {
        ...(shipment.review || {}),
        manualOnly: Boolean(shipment.review?.manualOnly || false),
        reviewStatus: shipment.review?.reviewStatus || 'awaiting_dropi_authorization',
        reviewReason: hasReviewReason ? currentReview.reviewReason : 'dropi_requires_manual_authorization'
    };
    shipment.automation = {
        ...(shipment.automation || {}),
        dropiSubmitAuthorizedAt: shipment.automation?.dropiSubmitAuthorizedAt || null,
        dropiSubmitAuthorizedBy: shipment.automation?.dropiSubmitAuthorizedBy || '',
        dropiSubmitAuthorizationNote: shipment.automation?.dropiSubmitAuthorizationNote || ''
    };
    shipment.raw = {
        ...(shipment.raw || {}),
        adminLead: lead,
        dropiNormalization: orderData.dropiNormalization || shipment.raw?.dropiNormalization || null
    };
    shipment.events.push({
        kind: 'admin_panel_auto_import',
        at: new Date(),
        payload: {
            leadId: lead.id,
            status: lead.status,
            noDropiAuto: true
        }
    });
    shipment.events = shipment.events.slice(-60);
    await shipment.save();
    return shipment;
};

export const importConfirmedAdminPanelOrders = async ({
    country = 'EC',
    limit = Number.parseInt(process.env.ADMIN_PANEL_IMPORT_LIMIT || '50', 10),
    lookbackHours = Number.parseInt(process.env.ADMIN_PANEL_IMPORT_LOOKBACK_HOURS || '168', 10)
} = {}) => {
    const readResult = readConfirmedAdminLeads({ country, limit, lookbackHours });
    if (!readResult.ok) return { ...readResult, country, imported: 0, created: 0, updated: 0 };
    if (readResult.skipped) return { ...readResult, country, imported: 0, created: 0, updated: 0 };

    let created = 0;
    let updated = 0;
    let skippedDuplicates = 0;
    let skippedInvalidQuantity = 0;
    let skippedLocalOverrides = 0;
    const imported = [];
    const localOverrides = [];

    for (const lead of readResult.leads || []) {
        const orderData = mapLeadToOrderData({ lead, country });
        if (!orderData) {
            skippedInvalidQuantity += 1;
            continue;
        }
        if (!orderData.orderId.endsWith('-')) {
            const existing = await findExistingOrderForLead({ orderData, lead, country });
            const duplicateGuard = await getOrderDuplicateGuard({
                phone: orderData.customer.phone,
                country,
                currentOrderId: existing?.orderId || orderData.orderId
            });
            if (!existing && !duplicateGuard.allowed) {
                skippedDuplicates += 1;
                continue;
            }
            if (existing) {
                const localProtection = await getLocalImportProtection({ existing, orderData, country });
                if (localProtection) {
                    skippedLocalOverrides += 1;
                    localOverrides.push({
                        leadId: lead.id,
                        orderId: existing.orderId,
                        reason: localProtection.type,
                        value: localProtection.value
                    });
                    continue;
                }
                const nextOrderData = {
                    ...orderData,
                    orderId: existing.orderId
                };
                await Order.updateOne(
                    { orderId: existing.orderId },
                    { $set: nextOrderData }
                );
                orderData.orderId = existing.orderId;
                updated += 1;
            } else {
                await Order.create(orderData);
                created += 1;
            }
            await ensureShipmentMirror({ orderData, lead });
            imported.push(orderData.orderId);
        }
    }

    return {
        ok: true,
        country,
        imported: imported.length,
        created,
        updated,
        skippedDuplicates,
        skippedInvalidQuantity,
        skippedLocalOverrides,
        localOverrides,
        orderIds: imported
    };
};
