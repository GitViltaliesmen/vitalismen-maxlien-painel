import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

import ContactState from '../src/models/ContactState.js';
import Order from '../src/models/Order.js';
import { syncOrderToOnlineAdminPanel } from '../src/services/adminPanelStatusService.js';
import {
    authorizedAgencyOrderAddress,
    CUSTOMER_DATA_STATUS,
    resolveCustomerDataDraft
} from '../src/services/customerDataResolutionService.js';

const args = new Map(process.argv.slice(2).map((item) => {
    const [key, ...rest] = item.replace(/^--/, '').split('=');
    return [key, rest.join('=') || true];
}));
const orderId = String(args.get('order-id') || '').trim();
const apply = args.has('apply');
const confirmation = String(args.get('confirm') || '');
const backupPath = String(args.get('backup') || '');
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';
const REQUIRED_CONFIRMATION = 'TEX_ULTRA_AGENCY_ORDER_V54_CONTROLLED_REPAIR';

if (!mongoUri) throw new Error('MONGODB_URI/MONGO_URI ausente.');
if (!/^EC-[A-Z0-9-]+$/.test(orderId)) throw new Error('--order-id EC exato é obrigatório.');
if (apply && confirmation !== REQUIRED_CONFIRMATION) {
    throw new Error(`Aplicação bloqueada: use --confirm=${REQUIRED_CONFIRMATION}.`);
}
if (apply && (!backupPath || !path.isAbsolute(backupPath))) {
    throw new Error('Aplicação bloqueada: informe --backup=/caminho/absoluto.json.');
}

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const phoneTail = (value = '') => digitsOnly(value).slice(-9);
const jsonSafe = (value) => JSON.parse(JSON.stringify(value));

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });

try {
    const order = await Order.findOne({ orderId }).lean();
    if (!order) throw new Error(`Pedido ${orderId} não encontrado.`);
    if (order.country !== 'EC' || order.tracking?.productKey !== 'tex_ultra_ec') {
        throw new Error('Reparo bloqueado: pedido não é Tex Ultra Ecuador.');
    }
    if (order.delivery?.mode !== 'agency') {
        throw new Error('Reparo bloqueado: modalidade atual não é agência.');
    }
    const tail = phoneTail(order.customer?.phone);
    if (!tail) throw new Error('Reparo bloqueado: telefone EC ausente.');

    const state = await ContactState.findOne({
        countryCode: 'EC',
        $or: [
            { phoneDigits: { $regex: `${tail}$` } },
            { chatId: { $regex: tail } },
            { 'metadata.customerDraft.phone': { $regex: `${tail}$` } }
        ]
    }).sort({ updatedAt: -1, lastInboundAt: -1 }).lean();
    if (!state) throw new Error('ContactState correspondente não encontrado.');

    const rawAgencyEvidence = String(
        order.customerDataResolution?.fields?.agency?.raw_value
        || order.customer?.address
        || order.delivery?.agencyName
        || ''
    ).trim();
    const resolved = resolveCustomerDataDraft({
        conversationPhone: order.customer?.phone,
        source: 'customer_confirmation',
        sourceMessageId: order.customerDataResolution?.fields?.agency?.source_message_id || '',
        confirmedByCustomerFields: ['deliveryMode', 'agency'],
        draft: {
            country: 'EC',
            name: order.customer?.name || '',
            phone: order.customer?.phone || '',
            city: order.customer?.city || '',
            province: order.customer?.province || '',
            deliveryMode: 'agency',
            agencyName: rawAgencyEvidence,
            quantity: order.package?.quantity || order.package?.id || 0,
            total: order.total || 0
        }
    });
    const agency = resolved.resolution.fields?.agency || {};
    if (
        resolved.resolution.orderDataReady !== true
        || agency.validation_status !== CUSTOMER_DATA_STATUS.VERIFIED
        || !resolved.draft.agencyId
        || !resolved.draft.agencyName
        || !resolved.draft.agencyAddress
    ) {
        throw new Error(`Reparo bloqueado: agência não foi resolvida de forma única (${resolved.resolution.blockedReasons?.join(', ') || 'sem motivo'}).`);
    }

    const canonicalAddress = authorizedAgencyOrderAddress({
        agencyName: resolved.draft.agencyName,
        agencyAddress: resolved.draft.agencyAddress,
        city: resolved.draft.city,
        province: resolved.draft.province
    });
    if (!canonicalAddress) throw new Error('Reparo bloqueado: endereço canônico vazio.');

    const report = {
        ok: true,
        mode: apply ? 'CONTROLLED_APPLY' : 'DRY_RUN',
        orderId,
        phoneTail: tail,
        before: {
            address: order.customer?.address || '',
            reference: order.customer?.reference || '',
            agencyId: order.delivery?.agencyId || '',
            agencyName: order.delivery?.agencyName || '',
            qualityScore: order.customerDataResolution?.qualityScore ?? null,
            metaPurchaseSentAt: order.tracking?.metaPurchaseSentAt || null,
            dropiOrderId: order.dropiOrderId || ''
        },
        after: {
            address: canonicalAddress,
            reference: '',
            agencyId: resolved.draft.agencyId,
            agencyName: resolved.draft.agencyName,
            agencyAddress: resolved.draft.agencyAddress,
            qualityScore: resolved.resolution.qualityScore,
            orderDataReady: resolved.resolution.orderDataReady
        },
        preserved: {
            status: order.status,
            quantity: order.package?.quantity || order.package?.id || 0,
            total: order.total,
            metaPurchaseSentAt: order.tracking?.metaPurchaseSentAt || null,
            dropiOrderId: order.dropiOrderId || '',
            noWhatsappSend: true,
            noMetaResend: true,
            noDropiSubmit: true
        }
    };

    if (apply) {
        const backup = {
            generatedAt: new Date().toISOString(),
            confirmation,
            report,
            order: jsonSafe(order),
            contactState: jsonSafe(state)
        };
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { mode: 0o600 });

        const repairedAt = new Date().toISOString();
        const orderResult = await Order.updateOne(
            {
                _id: order._id,
                orderId,
                country: 'EC',
                'tracking.productKey': 'tex_ultra_ec',
                'delivery.mode': 'agency'
            },
            {
                $set: {
                    'customer.address': canonicalAddress,
                    'customer.reference': '',
                    'delivery.agencyId': resolved.draft.agencyId,
                    'delivery.agencyName': resolved.draft.agencyName,
                    customerDataResolution: resolved.resolution
                }
            }
        );
        if (orderResult.matchedCount !== 1 || orderResult.modifiedCount !== 1) {
            throw new Error(`Falha ao atualizar pedido: matched=${orderResult.matchedCount}, modified=${orderResult.modifiedCount}.`);
        }

        const stateResult = await ContactState.updateOne(
            { _id: state._id, countryCode: 'EC' },
            {
                $set: {
                    customerDataResolution: resolved.resolution,
                    'metadata.customerDraft.address': canonicalAddress,
                    'metadata.customerDraft.address_raw': '',
                    'metadata.customerDraft.reference': '',
                    'metadata.customerDraft.reference_raw': '',
                    'metadata.customerDraft.deliveryMode': 'agency',
                    'metadata.customerDraft.agencyId': resolved.draft.agencyId,
                    'metadata.customerDraft.agencyName': resolved.draft.agencyName,
                    'metadata.customerDraft.agencyAddress': resolved.draft.agencyAddress,
                    'metadata.customerDraft.dataQuality': resolved.draft.dataQuality,
                    'metadata.customerDraft.updatedAt': repairedAt,
                    'metadata.texUltraAgencyRepairV54': {
                        orderId,
                        repairedAt,
                        previousAddress: order.customer?.address || '',
                        previousReference: order.customer?.reference || '',
                        source: 'authorized_registry_controlled_repair'
                    }
                }
            }
        );
        if (stateResult.matchedCount !== 1) throw new Error('Falha ao atualizar ContactState correspondente.');

        const repairedOrder = await Order.findOne({ orderId });
        const panelSync = syncOrderToOnlineAdminPanel(repairedOrder, { action: 'tex_ultra_agency_repair_v54' });
        if (!panelSync?.ok) throw new Error(`Sincronização do painel falhou: ${panelSync?.reason || panelSync?.error || 'unknown'}.`);

        const verifiedOrder = await Order.findOne({ orderId }).lean();
        const verifiedState = await ContactState.findById(state._id).lean();
        report.backupPath = backupPath;
        report.applyResult = {
            orderMatched: orderResult.matchedCount,
            orderModified: orderResult.modifiedCount,
            stateMatched: stateResult.matchedCount,
            stateModified: stateResult.modifiedCount,
            panelSync,
            verifiedOrderAddress: verifiedOrder?.customer?.address || '',
            verifiedOrderReference: verifiedOrder?.customer?.reference || '',
            verifiedStateAgencyId: verifiedState?.metadata?.customerDraft?.agencyId || '',
            verifiedStateAgencyName: verifiedState?.metadata?.customerDraft?.agencyName || '',
            verifiedMetaPurchaseSentAt: verifiedOrder?.tracking?.metaPurchaseSentAt || null,
            verifiedDropiOrderId: verifiedOrder?.dropiOrderId || ''
        };
    }

    console.log(JSON.stringify(report, null, 2));
} finally {
    await mongoose.disconnect().catch(() => null);
}
