import { spawnSync } from 'child_process';
import fs from 'fs';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';

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
    ORDER BY id DESC
    LIMIT ?
""", (max(limit * 4, limit),)).fetchall()
con.close()

out = []
for row in rows:
    data = dict(row)
    created = parse_dt(data.get('created_at')) or parse_dt(data.get('updated_at'))
    if lookback_hours > 0 and created and (now - created).total_seconds() > lookback_hours * 3600:
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
    const quantity = Number.parseInt(String(lead.product_qty || '1'), 10) || 1;
    const total = Number.parseFloat(String(lead.product_value || '0')) || 0;
    const location = normalizeLocation({
        city: lead.city,
        province: lead.province
    });
    const leadId = String(lead.id || '').trim();
    return {
        orderId: `${country}-ADMIN-${leadId}`,
        country,
        customer: {
            name: String(lead.name || '').trim(),
            phone: String(lead.phone_e164 || lead.phone || '').trim(),
            address: String(lead.address || '').trim(),
            city: location.city,
            province: location.province
        },
        package: {
            id: quantity,
            label: packageLabel(quantity),
            quantity
        },
        total,
        currency: 'USD',
        status: 'confirmed',
        source: 'manual',
        notes: [
            'Importado automaticamente do painel online maxlien.shop',
            `Lead admin ${country} #${leadId}`,
            `Status original: ${lead.status || ''}`,
            `Criado online: ${lead.created_at || ''}`,
            'Dropi exige autorizacao manual antes de enviar'
        ].join(' | ')
    };
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
        agencyPickup: shipment.logistics?.agencyPickup || isAgencyPickupAddress(orderData.customer.address),
        agencyName: shipment.logistics?.agencyName || ''
    };
    shipment.review = {
        ...(shipment.review || {}),
        manualOnly: Boolean(shipment.review?.manualOnly || false),
        reviewStatus: shipment.review?.reviewStatus || 'awaiting_dropi_authorization',
        reviewReason: shipment.review?.reviewReason || 'dropi_requires_manual_authorization'
    };
    shipment.automation = {
        ...(shipment.automation || {}),
        dropiSubmitAuthorizedAt: shipment.automation?.dropiSubmitAuthorizedAt || null,
        dropiSubmitAuthorizedBy: shipment.automation?.dropiSubmitAuthorizedBy || '',
        dropiSubmitAuthorizationNote: shipment.automation?.dropiSubmitAuthorizationNote || ''
    };
    shipment.raw = {
        ...(shipment.raw || {}),
        adminLead: lead
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
    const imported = [];

    for (const lead of readResult.leads || []) {
        const orderData = mapLeadToOrderData({ lead, country });
        if (!orderData.orderId.endsWith('-')) {
            const existing = await Order.findOne({ orderId: orderData.orderId });
            if (existing) {
                await Order.updateOne(
                    { orderId: orderData.orderId },
                    { $set: orderData }
                );
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
        orderIds: imported
    };
};
