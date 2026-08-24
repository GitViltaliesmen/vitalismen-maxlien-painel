import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

import ContactState from '../src/models/ContactState.js';
import Order from '../src/models/Order.js';
import { syncOrderToOnlineAdminPanel } from '../src/services/adminPanelStatusService.js';
import { resolveCustomerDataDraft } from '../src/services/customerDataResolutionService.js';
import { materializePanelAgencyAddress } from '../src/services/panelCustomerFormPersistenceService.js';

const args = new Map(process.argv.slice(2).map((item) => {
    const [key, ...rest] = item.replace(/^--/, '').split('=');
    return [key, rest.join('=') || true];
}));
const apply = args.has('apply');
const confirmation = String(args.get('confirm') || '');
const backupPath = String(args.get('backup') || '');
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';
const REQUIRED_CONFIRMATION = 'PANEL_CUSTOMER_FORM_V55_CONTROLLED_REPAIR';

const ORDER_TARGETS = Object.freeze([
    Object.freeze({
        orderId: 'EC-MT6GO9YX-4QS9',
        phoneTail: '4663',
        agencyId: 'EC-SA-84BCBB3AEE72CB9A',
        agencyName: 'Quevedo av Quito'
    }),
    Object.freeze({
        orderId: 'EC-MT6GWGA2-9ZUZ',
        phoneTail: '1150',
        agencyId: 'EC-SA-F9D9090453293FF9',
        agencyName: 'Guayaquil Los Almendros'
    })
]);
const CONTAMINATED_STATE_TARGET = Object.freeze({
    id: '6a7de6a3f24ae26732b457a8',
    chatId: '593983125541@c.us',
    phoneDigits: '593983125541',
    wrongDraftPhoneTail: '4364',
    correctDraft: Object.freeze({
        name: 'Sergio Ventura Villacís castro',
        phone: '+593983125541',
        country: 'EC',
        city: 'Muey',
        province: 'Santa Elena',
        deliveryMode: 'agency',
        agencyId: 'EC-SA-855563F6EA37BD35',
        agencyName: 'Muey Jose Luis Tamayo',
        quantity: 1,
        total: 35.99,
        status: 'delivered'
    })
});

if (!mongoUri) throw new Error('MONGODB_URI/MONGO_URI ausente.');
if (apply && confirmation !== REQUIRED_CONFIRMATION) {
    throw new Error(`Aplicação bloqueada: use --confirm=${REQUIRED_CONFIRMATION}.`);
}
if (apply && (!backupPath || !path.isAbsolute(backupPath))) {
    throw new Error('Aplicação bloqueada: informe --backup=/caminho/absoluto.json.');
}

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const phoneTail = (value = '', length = 4) => digitsOnly(value).slice(-length);
const jsonSafe = (value) => JSON.parse(JSON.stringify(value));
const agencyResolutionFor = (draft, sourceMessageId) => {
    const result = resolveCustomerDataDraft({
        draft,
        conversationPhone: draft.phone,
        source: 'human_correction',
        sourceMessageId,
        correctedByHumanFields: [
            'name',
            'phone',
            'city',
            'province',
            'deliveryMode',
            'agency',
            'quantity',
            'total'
        ]
    });
    return {
        ...result,
        draft: materializePanelAgencyAddress(result)
    };
};

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });

try {
    const orderRepairs = [];
    for (const target of ORDER_TARGETS) {
        const order = await Order.findOne({ orderId: target.orderId }).lean();
        if (!order) throw new Error(`Pedido autorizado ausente: ${target.orderId}.`);
        if (
            order.country !== 'EC'
            || order.tracking?.productKey !== 'tex_ultra_ec'
            || order.delivery?.mode !== 'agency'
            || phoneTail(order.customer?.phone) !== target.phoneTail
            || order.delivery?.agencyId !== target.agencyId
            || order.delivery?.agencyName !== target.agencyName
        ) {
            throw new Error(`Pré-condição divergente no pedido ${target.orderId}; reparo bloqueado.`);
        }
        const state = await ContactState.findOne({
            countryCode: 'EC',
            phoneDigits: { $regex: `${digitsOnly(order.customer?.phone).slice(-9)}$` }
        }).sort({ updatedAt: -1, lastInboundAt: -1 }).lean();
        if (!state) throw new Error(`ContactState do pedido ${target.orderId} não encontrado.`);

        const resolved = agencyResolutionFor({
            country: 'EC',
            name: order.customer?.name || '',
            phone: order.customer?.phone || '',
            city: order.customer?.city || '',
            province: order.customer?.province || '',
            deliveryMode: 'agency',
            agencyName: target.agencyName,
            quantity: order.package?.quantity || order.package?.id || 0,
            total: order.total || 0
        }, `repair-v55:${target.orderId}`);
        if (
            resolved.resolution.orderDataReady !== true
            || resolved.draft.agencyId !== target.agencyId
            || !resolved.draft.address
        ) {
            throw new Error(`Agência canônica do pedido ${target.orderId} não foi validada.`);
        }
        orderRepairs.push({ target, order, state, resolved });
    }

    const contaminatedState = await ContactState.findById(CONTAMINATED_STATE_TARGET.id).lean();
    if (
        !contaminatedState
        || contaminatedState.chatId !== CONTAMINATED_STATE_TARGET.chatId
        || contaminatedState.phoneDigits !== CONTAMINATED_STATE_TARGET.phoneDigits
    ) {
        throw new Error('Estado contaminado autorizado não corresponde à identidade esperada; reparo bloqueado.');
    }
    const currentDraftTail = phoneTail(contaminatedState.metadata?.customerDraft?.phone);
    const alreadyRepaired = currentDraftTail === phoneTail(CONTAMINATED_STATE_TARGET.phoneDigits);
    if (!alreadyRepaired && currentDraftTail !== CONTAMINATED_STATE_TARGET.wrongDraftPhoneTail) {
        throw new Error('Rascunho contaminado mudou desde a auditoria; reparo bloqueado.');
    }
    const contaminatedResolution = agencyResolutionFor(
        CONTAMINATED_STATE_TARGET.correctDraft,
        'repair-v55:conversation-evidence-5541'
    );
    if (
        contaminatedResolution.resolution.orderDataReady !== true
        || contaminatedResolution.draft.agencyId !== CONTAMINATED_STATE_TARGET.correctDraft.agencyId
    ) {
        throw new Error('Evidência da conversa 5541 não produziu a agência canônica esperada.');
    }

    const report = {
        ok: true,
        mode: apply ? 'CONTROLLED_APPLY' : 'DRY_RUN',
        orderRepairs: orderRepairs.map(({ target, order, resolved }) => ({
            orderId: target.orderId,
            phoneTail: target.phoneTail,
            before: {
                address: order.customer?.address || '',
                reference: order.customer?.reference || '',
                agencyId: order.delivery?.agencyId || '',
                status: order.status,
                quantity: order.package?.quantity || order.package?.id || 0,
                total: order.total,
                dropiOrderId: order.dropiOrderId || '',
                metaPurchaseSentAt: order.tracking?.metaPurchaseSentAt || null
            },
            after: {
                address: resolved.draft.address,
                reference: '',
                agencyId: resolved.draft.agencyId,
                agencyName: resolved.draft.agencyName,
                orderDataReady: resolved.resolution.orderDataReady
            }
        })),
        contaminatedStateRepair: {
            stateId: CONTAMINATED_STATE_TARGET.id,
            chatPhoneTail: phoneTail(CONTAMINATED_STATE_TARGET.phoneDigits),
            beforeDraftPhoneTail: currentDraftTail,
            afterDraftPhoneTail: phoneTail(contaminatedResolution.draft.phone),
            beforeDraftName: contaminatedState.metadata?.customerDraft?.name || '',
            afterDraftName: contaminatedResolution.draft.name,
            historicalDeliveredOrderChanged: false
        },
        preserved: {
            noWhatsappSend: true,
            noMessageMutation: true,
            noMetaResend: true,
            noDropiSubmit: true,
            noOrderCreation: true,
            historicalDeliveredOrderChanged: false
        }
    };

    if (apply) {
        const backup = {
            generatedAt: new Date().toISOString(),
            confirmation,
            report,
            orders: orderRepairs.map(({ order }) => jsonSafe(order)),
            orderContactStates: orderRepairs.map(({ state }) => jsonSafe(state)),
            contaminatedContactState: jsonSafe(contaminatedState)
        };
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { mode: 0o600 });

        report.applyResults = [];
        for (const { target, order, state, resolved } of orderRepairs) {
            const repairedAt = new Date().toISOString();
            const orderResult = await Order.updateOne(
                { _id: order._id, orderId: target.orderId },
                {
                    $set: {
                        'customer.address': resolved.draft.address,
                        'customer.reference': '',
                        'delivery.agencyId': resolved.draft.agencyId,
                        'delivery.agencyName': resolved.draft.agencyName,
                        customerDataResolution: resolved.resolution
                    }
                }
            );
            if (orderResult.matchedCount !== 1) throw new Error(`Falha ao localizar ${target.orderId} durante aplicação.`);

            const stateResult = await ContactState.updateOne(
                { _id: state._id, countryCode: 'EC' },
                {
                    $set: {
                        customerDataResolution: resolved.resolution,
                        'metadata.customerDraft.phone': resolved.draft.phone,
                        'metadata.customerDraft.address': resolved.draft.address,
                        'metadata.customerDraft.address_raw': '',
                        'metadata.customerDraft.reference': '',
                        'metadata.customerDraft.reference_raw': '',
                        'metadata.customerDraft.deliveryMode': 'agency',
                        'metadata.customerDraft.agencyId': resolved.draft.agencyId,
                        'metadata.customerDraft.agencyName': resolved.draft.agencyName,
                        'metadata.customerDraft.agencyAddress': resolved.draft.agencyAddress,
                        'metadata.customerDraft.dataQuality': resolved.draft.dataQuality,
                        'metadata.customerDraft.updatedAt': repairedAt,
                        'metadata.panelCustomerFormRepairV55': {
                            orderId: target.orderId,
                            repairedAt,
                            previousAddress: order.customer?.address || '',
                            source: 'authorized_registry_controlled_repair'
                        }
                    }
                }
            );
            if (stateResult.matchedCount !== 1) throw new Error(`Falha ao atualizar ContactState de ${target.orderId}.`);

            const repairedOrder = await Order.findOne({ orderId: target.orderId });
            const panelSync = syncOrderToOnlineAdminPanel(repairedOrder, { action: 'panel_customer_form_repair_v55' });
            if (!panelSync?.ok) {
                throw new Error(`Sincronização administrativa de ${target.orderId} falhou: ${panelSync?.reason || panelSync?.error || 'unknown'}.`);
            }
            report.applyResults.push({
                orderId: target.orderId,
                orderMatched: orderResult.matchedCount,
                orderModified: orderResult.modifiedCount,
                stateMatched: stateResult.matchedCount,
                stateModified: stateResult.modifiedCount,
                panelSync
            });
        }

        const previousDraft = contaminatedState.metadata?.customerDraft || {};
        const repairedAt = new Date().toISOString();
        const cleanDraft = {
            ...previousDraft,
            ...contaminatedResolution.draft,
            status: CONTAMINATED_STATE_TARGET.correctDraft.status,
            quantity: String(CONTAMINATED_STATE_TARGET.correctDraft.quantity),
            total: String(CONTAMINATED_STATE_TARGET.correctDraft.total),
            orderId: '',
            sourceOrderId: '',
            previousOrderId: '',
            currentNegotiationOrderId: '',
            flowDataOk: {
                nome_completo: { ok: true, value: contaminatedResolution.draft.name, label: 'Nome OK' },
                ciudad: { ok: true, value: contaminatedResolution.draft.city, label: 'Cidade OK' },
                endereco: { ok: true, value: contaminatedResolution.draft.address, label: 'Endereco registrado' },
                agencia: { ok: true, value: contaminatedResolution.draft.agencyName, label: 'Agencia autorizada' },
                provincia: { ok: true, value: contaminatedResolution.draft.province, label: 'Provincia OK' },
                quantidade: { ok: true, value: String(CONTAMINATED_STATE_TARGET.correctDraft.quantity), label: 'Quantidade OK' },
                venda_finalizada: { ok: true, value: CONTAMINATED_STATE_TARGET.correctDraft.status, label: 'Venda finalizada' }
            },
            updatedAt: repairedAt
        };
        const contaminatedStateResult = await ContactState.updateOne(
            {
                _id: contaminatedState._id,
                chatId: CONTAMINATED_STATE_TARGET.chatId,
                phoneDigits: CONTAMINATED_STATE_TARGET.phoneDigits
            },
            {
                $set: {
                    customerDataResolution: contaminatedResolution.resolution,
                    'metadata.customerDraft': cleanDraft,
                    'metadata.panelCustomerFormRepairV55': {
                        repairedAt,
                        previousDraftPhoneTail: currentDraftTail,
                        previousDraftName: previousDraft.name || '',
                        preservedHistoricalOrderId: 'EC-MSRR6ZXL-3TMI',
                        historicalOrderChanged: false,
                        source: 'conversation_identity_and_explicit_customer_evidence'
                    }
                }
            }
        );
        if (contaminatedStateResult.matchedCount !== 1) {
            throw new Error('Falha ao isolar a ficha contaminada da conversa 5541.');
        }
        report.contaminatedStateApplyResult = {
            matched: contaminatedStateResult.matchedCount,
            modified: contaminatedStateResult.modifiedCount
        };
        report.backupPath = backupPath;
    }

    console.log(JSON.stringify(report, null, 2));
} finally {
    await mongoose.disconnect().catch(() => null);
}
