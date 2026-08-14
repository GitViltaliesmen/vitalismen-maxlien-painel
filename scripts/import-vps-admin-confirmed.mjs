import { spawnSync } from 'child_process';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../src/models/Order.js';

dotenv.config();

const args = process.argv.slice(2);
const getArg = (name, fallback = '') => {
    const index = args.indexOf(name);
    if (index === -1) return fallback;
    return args[index + 1] || fallback;
};

const country = String(getArg('--country', 'EC')).trim().toUpperCase();
const limit = Math.min(Number.parseInt(getArg('--limit', '50'), 10) || 50, 500);
const ids = getArg('--ids', '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value))
    .filter(Boolean);
const dryRun = args.includes('--dry-run');

if (country !== 'EC') {
    console.error('Use --country EC');
    process.exit(1);
}

const dbPath = country === 'EC'
    ? '/opt/maxlien-mvp/leads_ec.sqlite3'
    : '/opt/maxlien-mvp/leads_co.sqlite3';

const remotePython = `
import sqlite3, json
db_path = ${JSON.stringify(dbPath)}
limit = ${JSON.stringify(limit)}
ids = ${JSON.stringify(ids)}
con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
cur = con.cursor()
if ids:
    id_list = ",".join(ids)
    sql = f"""
        SELECT id, name, phone, address, city, province, product_qty, product_value, status, created_at
        FROM leads
        WHERE id IN ({id_list})
        ORDER BY id DESC
    """
    params = []
else:
    sql = """
        SELECT id, name, phone, address, city, province, product_qty, product_value, status, created_at
        FROM leads
        WHERE lower(coalesce(status,'')) = 'confirmado'
        ORDER BY id DESC
        LIMIT ?
    """
    params = [limit]
cur.execute(sql, params)
print(json.dumps([dict(row) for row in cur.fetchall()], ensure_ascii=False))
con.close()
`;

const ssh = spawnSync(
    'ssh',
    [
        '-i',
        `${process.env.HOME}/.ssh/vps_auditoria_codex`,
        '-o',
        'BatchMode=yes',
        'root@maxlien.shop',
        'python3',
        '-'
    ],
    { input: remotePython, encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }
);

if (ssh.status !== 0) {
    console.error(ssh.stderr || ssh.stdout || 'Failed to read VPS admin leads');
    process.exit(ssh.status || 1);
}

let leads = [];
try {
    leads = JSON.parse(ssh.stdout || '[]');
} catch (error) {
    console.error('Could not parse VPS response:', error.message);
    process.exit(1);
}

const toNumber = (value, fallback = 0) => {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
};

const VALID_PACKAGE_QUANTITIES = new Set([1, 2, 3, 6]);

const normalizePackageQuantity = (value) => {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return VALID_PACKAGE_QUANTITIES.has(parsed) ? parsed : 0;
};

const packageLabel = (quantity) => {
    const qty = normalizePackageQuantity(quantity);
    if (!qty) return 'sem quantidade';
    return qty === 1 ? '1 frasco' : `${qty} frascos`;
};

const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const ecuadorDepartments = new Set([
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
    if (country === 'EC') {
        const cityLooksLikeDepartment = ecuadorDepartments.has(normalizeText(cityText));
        const provinceLooksLikeDepartment = ecuadorDepartments.has(normalizeText(provinceText));
        if (cityLooksLikeDepartment && !provinceLooksLikeDepartment) {
            return {
                city: provinceText,
                province: cityText
            };
        }
    }
    return {
        city: cityText,
        province: provinceText
    };
};

const mapLeadToOrder = (lead) => {
    const quantity = normalizePackageQuantity(lead.product_qty);
    const total = toNumber(lead.product_value, 0);
    if (!quantity || total <= 0) return null;
    const location = normalizeLocation({
        city: lead.city,
        province: lead.province
    });
    return {
        orderId: `${country}-ADMIN-${lead.id}`,
        country,
        customer: {
            name: String(lead.name || '').trim(),
            phone: String(lead.phone || '').trim(),
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
            `Importado do painel online maxlien.shop`,
            `Lead admin ${country} #${lead.id}`,
            `Status original: ${lead.status || ''}`,
            `Criado online: ${lead.created_at || ''}`
        ].join(' | ')
    };
};

const main = async () => {
    const orders = leads.map(mapLeadToOrder).filter(Boolean);
    if (dryRun) {
        console.log(JSON.stringify({ dryRun: true, count: orders.length, orders }, null, 2));
        return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    let created = 0;
    let updated = 0;

    for (const orderData of orders) {
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
    }

    await mongoose.disconnect();
    console.log(JSON.stringify({
        ok: true,
        country,
        imported: orders.length,
        created,
        updated,
        orderIds: orders.map((order) => order.orderId)
    }, null, 2));
};

main().catch(async (error) => {
    console.error(error);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore disconnect errors on fatal path
    }
    process.exit(1);
});
