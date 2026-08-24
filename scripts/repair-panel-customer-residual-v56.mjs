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
const REQUIRED_CONFIRMATION = 'PANEL_CUSTOMER_RESIDUAL_V56_CONTROLLED_REPAIR';
const HISTORICAL_ORDER_ID = 'EC-MSWR401B-KNHS';

const ORDER_TARGETS = Object.freeze([
    Object.freeze({
        orderId: 'EC-MT6FF9N1-AFWE', stateId: '6a8b77644cddfe06c12135ee', phoneTail: '2327',
        agencyId: 'EC-SA-F9D9090453293FF9', agencyName: 'Guayaquil Los Almendros',
        expectedAddress: 'Servientrega Guayaquil Los Almendros - Cdla. Los Almendros mz o Solar 34 - Frente a Deprati Sur - Guayaquil, Guayas',
        dropiOrderId: '6675217', metaPurchaseSentAt: '2026-08-23T23:16:41.751Z'
    }),
    Object.freeze({
        orderId: 'EC-MT6FJHIS-YRQQ', stateId: '6a8b76eb4cddfe06c1212e1b', phoneTail: '7428',
        agencyId: 'EC-SA-89242AA72A017177', agencyName: 'Duran Panorama Av. Principal',
        expectedAddress: 'Servientrega Duran Panorama Av. Principal - Cdla Panorama mz g sl 12 - Diagonal Upc - Duran, Guayas',
        dropiOrderId: '6675258', metaPurchaseSentAt: '2026-08-23T23:19:58.570Z'
    }),
    Object.freeze({
        orderId: 'EC-MT6H0NR2-SBM5', stateId: '6a8b8650d7396ec77470e114', phoneTail: '1401',
        agencyId: 'EC-SA-74C0445652FEDAD9', agencyName: 'Puyo Principal',
        expectedAddress: 'Servientrega Puyo Principal - 9 de Octubre S/n y Lucindo Ortega - Puyo, Pastaza',
        dropiOrderId: '6675170', metaPurchaseSentAt: '2026-08-24T00:01:19.452Z'
    }),
    Object.freeze({
        orderId: 'EC-MT6KIOUM-EGZK', stateId: '6a8b9f381a6615e503f2a04e', phoneTail: '4756',
        agencyId: 'EC-SA-7E527F5859F3E600', agencyName: 'San Camilo Mexico',
        expectedAddress: 'Servientrega San Camilo Mexico - Mexico 111 y Juan Montalvo - San Camilo, Los Rios',
        dropiOrderId: '6675122', metaPurchaseSentAt: '2026-08-24T01:39:19.501Z'
    })
]);

const STATE_TARGETS = Object.freeze({
    segundo: Object.freeze({
        id: '6a828e50ba6ae6336992a83b',
        chatId: '593994885201@c.us',
        phoneDigits: '593994885201',
        contaminatedPhoneDigits: '593991886060',
        name: 'Segundo Bermeo'
    }),
    charly: Object.freeze({
        id: '6a8291c5ba6ae6336992d830',
        chatId: '593991886060@c.us',
        phoneDigits: '593991886060',
        contaminatedName: 'Segundo Bermeo',
        name: 'Charly'
    })
});

if (!mongoUri) throw new Error('MONGODB_URI/MONGO_URI ausente.');
if (apply && confirmation !== REQUIRED_CONFIRMATION) {
    throw new Error(`Aplicacao bloqueada: use --confirm=${REQUIRED_CONFIRMATION}.`);
}
if (apply && (!backupPath || !path.isAbsolute(backupPath))) {
    throw new Error('Aplicacao bloqueada: informe --backup=/caminho/absoluto.json.');
}

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const phoneTail = (value = '', length = 4) => digitsOnly(value).slice(-length);
const iso = (value) => value ? new Date(value).toISOString() : '';
const jsonSafe = (value) => JSON.parse(JSON.stringify(value));
const stableJson = (value) => JSON.stringify(jsonSafe(value));
const resolveAgencyDraft = (draft, sourceMessageId) => {
    const result = resolveCustomerDataDraft({
        draft,
        conversationPhone: draft.phone,
        source: 'human_correction',
        sourceMessageId,
        correctedByHumanFields: ['name', 'phone', 'city', 'province', 'deliveryMode', 'agency', 'quantity', 'total']
    });
    return { ...result, draft: materializePanelAgencyAddress(result) };
};
const resolveIncompleteDraft = (draft, sourceMessageId) => resolveCustomerDataDraft({
    draft,
    conversationPhone: draft.phone,
    source: 'human_correction',
    sourceMessageId,
    correctedByHumanFields: ['name', 'phone']
});

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });

try {
    const orderRepairs = [];
    for (const target of ORDER_TARGETS) {
        const [order, state] = await Promise.all([
            Order.findOne({ orderId: target.orderId }).lean(),
            ContactState.findById(target.stateId).lean()
        ]);
        if (!order || !state) throw new Error(`Alvo autorizado ausente: ${target.orderId}/${target.stateId}.`);
        if (
            order.country !== 'EC'
            || order.tracking?.productKey !== 'tex_ultra_ec'
            || order.delivery?.mode !== 'agency'
            || phoneTail(order.customer?.phone) !== target.phoneTail
            || order.delivery?.agencyId !== target.agencyId
            || order.delivery?.agencyName !== target.agencyName
            || order.status !== 'processing'
            || String(order.dropiOrderId || '') !== target.dropiOrderId
            || iso(order.tracking?.metaPurchaseSentAt) !== target.metaPurchaseSentAt
            || !['', target.expectedAddress].includes(String(order.customer?.address || ''))
            || phoneTail(state.phoneDigits || state.chatId) !== target.phoneTail
        ) {
            throw new Error(`Pre-condicao divergente em ${target.orderId}; reparo bloqueado.`);
        }
        const resolved = resolveAgencyDraft({
            country: 'EC',
            name: order.customer?.name || '',
            phone: order.customer?.phone || '',
            city: order.customer?.city || '',
            province: order.customer?.province || '',
            deliveryMode: 'agency',
            agencyName: target.agencyName,
            quantity: order.package?.quantity || 0,
            total: order.total || 0
        }, `repair-v56:${target.orderId}`);
        if (
            resolved.resolution.orderDataReady !== true
            || resolved.draft.agencyId !== target.agencyId
            || resolved.draft.address !== target.expectedAddress
        ) throw new Error(`Agencia canonica divergente em ${target.orderId}.`);
        orderRepairs.push({ target, order, state, resolved });
    }

    const [segundoState, charlyState, historicalOrder] = await Promise.all([
        ContactState.findById(STATE_TARGETS.segundo.id).lean(),
        ContactState.findById(STATE_TARGETS.charly.id).lean(),
        Order.findOne({ orderId: HISTORICAL_ORDER_ID }).lean()
    ]);
    if (!segundoState || !charlyState || !historicalOrder) throw new Error('Fichas cruzadas ou pedido historico ausentes.');
    if (
        segundoState.chatId !== STATE_TARGETS.segundo.chatId
        || ![STATE_TARGETS.segundo.contaminatedPhoneDigits, STATE_TARGETS.segundo.phoneDigits].includes(segundoState.phoneDigits)
        || segundoState.metadata?.lastSenderPn !== STATE_TARGETS.segundo.phoneDigits
        || ![STATE_TARGETS.segundo.contaminatedPhoneDigits, STATE_TARGETS.segundo.phoneDigits].includes(digitsOnly(segundoState.metadata?.customerDraft?.phone))
        || charlyState.chatId !== STATE_TARGETS.charly.chatId
        || charlyState.phoneDigits !== STATE_TARGETS.charly.phoneDigits
        || charlyState.metadata?.lastSenderPn !== STATE_TARGETS.charly.phoneDigits
        || ![STATE_TARGETS.charly.contaminatedName, STATE_TARGETS.charly.name].includes(String(charlyState.metadata?.customerDraft?.name || ''))
        || historicalOrder.customer?.phone !== '+593991886060'
        || historicalOrder.customer?.name !== 'Segundo Bermeo'
        || historicalOrder.status !== 'shipped'
        || String(historicalOrder.dropiOrderId || '') !== '6571770'
    ) throw new Error('Identidade auditada 5201/6060 mudou; reparo bloqueado.');

    const segundoResolution = resolveAgencyDraft({
        country: 'EC', name: 'Segundo Bermeo', phone: '+593994885201',
        city: 'Guayaquil', province: 'Guayas', deliveryMode: 'agency',
        agencyName: 'Guayaquil Km 7.5 Via Daule', quantity: 3, total: 80.99
    }, 'repair-v56:conversation-evidence-5201');
    if (
        segundoResolution.resolution.orderDataReady !== true
        || segundoResolution.draft.agencyId !== 'EC-SA-0E7EA5EF5C0629C0'
        || segundoResolution.draft.address !== 'Servientrega Guayaquil km 7.5 Via Daule - Via Daule km 7.5 S/n av Juan Tanca Marengo 1 mz 11 sl 8 Junto a Industrias Toni - Guayaquil, Guayas'
    ) throw new Error('Evidencia da conversa 5201 nao resolveu a agencia esperada.');

    const charlyResolution = resolveIncompleteDraft({
        country: 'EC', name: 'Charly', phone: '+593991886060', city: '', province: '',
        address: '', reference: '', deliveryMode: '', agencyName: '', quantity: '', total: ''
    }, 'repair-v56:conversation-evidence-6060');
    if (
        charlyResolution.resolution.orderDataReady !== false
        || JSON.stringify(charlyResolution.resolution.blockedReasons) !== JSON.stringify([
            'CITY_NOT_CANONICAL', 'PROVINCE_NOT_RESOLVED', 'DELIVERY_MODE_REQUIRED'
        ])
    ) throw new Error('Ficha incompleta 6060 nao foi bloqueada como esperado.');

    const historicalBefore = stableJson(historicalOrder);
    const report = {
        ok: true,
        mode: apply ? 'CONTROLLED_APPLY' : 'DRY_RUN',
        orderRepairs: orderRepairs.map(({ target, order, resolved }) => ({
            orderId: target.orderId,
            stateId: target.stateId,
            phoneTail: target.phoneTail,
            beforeAddress: order.customer?.address || '',
            afterAddress: resolved.draft.address,
            preserved: {
                status: order.status, quantity: order.package?.quantity || 0, total: order.total,
                dropiOrderId: order.dropiOrderId, metaPurchaseSentAt: iso(order.tracking?.metaPurchaseSentAt)
            }
        })),
        crossedStates: {
            segundo: { stateId: STATE_TARGETS.segundo.id, phoneTail: '5201', orderLinksAfter: [] },
            charly: { stateId: STATE_TARGETS.charly.id, phoneTail: '6060', orderDataReady: false, orderLinksAfter: [] },
            historicalOrderId: HISTORICAL_ORDER_ID,
            historicalShippedOrderChanged: false
        },
        preserved: {
            noWhatsappSend: true, noMessageMutation: true, noMetaResend: true,
            noDropiSubmit: true, noOrderCreation: true, historicalShippedOrderChanged: false
        }
    };

    if (apply) {
        const backup = {
            generatedAt: new Date().toISOString(), confirmation, report,
            orders: orderRepairs.map(({ order }) => jsonSafe(order)),
            orderContactStates: orderRepairs.map(({ state }) => jsonSafe(state)),
            crossedContactStates: [jsonSafe(segundoState), jsonSafe(charlyState)],
            historicalOrder: jsonSafe(historicalOrder)
        };
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { mode: 0o600 });
        fs.chmodSync(backupPath, 0o600);

        report.applyResults = [];
        for (const { target, order, state, resolved } of orderRepairs) {
            const repairedAt = new Date().toISOString();
            const [orderResult, stateResult] = await Promise.all([
                Order.updateOne(
                    { _id: order._id, orderId: target.orderId, status: order.status, dropiOrderId: target.dropiOrderId },
                    { $set: {
                        'customer.address': resolved.draft.address,
                        'customer.reference': '',
                        'delivery.agencyId': resolved.draft.agencyId,
                        'delivery.agencyName': resolved.draft.agencyName,
                        customerDataResolution: resolved.resolution
                    } }
                ),
                ContactState.updateOne(
                    { _id: state._id, countryCode: 'EC' },
                    { $set: {
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
                        'metadata.panelCustomerResidualRepairV56': {
                            orderId: target.orderId, repairedAt,
                            previousAddress: order.customer?.address || '',
                            source: 'authorized_exact_residual_repair'
                        }
                    } }
                )
            ]);
            if (orderResult.matchedCount !== 1 || stateResult.matchedCount !== 1) {
                throw new Error(`Falha ao aplicar reparo exato em ${target.orderId}.`);
            }
            const repairedOrder = await Order.findOne({ orderId: target.orderId });
            const panelSync = syncOrderToOnlineAdminPanel(repairedOrder, { action: 'panel_customer_residual_repair_v56' });
            if (!panelSync?.ok) throw new Error(`Sync administrativo falhou em ${target.orderId}: ${panelSync?.reason || panelSync?.error || 'unknown'}.`);
            report.applyResults.push({
                orderId: target.orderId,
                orderModified: orderResult.modifiedCount,
                stateModified: stateResult.modifiedCount,
                panelSync
            });
        }

        const repairedAt = new Date().toISOString();
        const segundoDraft = {
            ...segundoResolution.draft,
            status: 'atendendo', quantity: '3', total: '80.99',
            orderId: '', sourceOrderId: '', previousOrderId: '', currentNegotiationOrderId: '',
            product: 'Tex Ultra Ecuador', productKey: 'tex_ultra_ec', productName: 'Tex Ultra Ecuador',
            productMedia: '/media/sales/ec/tex_ultra.png', buyLaterFollowupAt: '',
            flowDataOk: {
                nome_completo: { ok: true, value: segundoResolution.draft.name, label: 'Nome OK' },
                ciudad: { ok: true, value: segundoResolution.draft.city, label: 'Cidade OK' },
                endereco: { ok: true, value: segundoResolution.draft.address, label: 'Endereco registrado' },
                agencia: { ok: true, value: segundoResolution.draft.agencyName, label: 'Agencia autorizada' },
                provincia: { ok: true, value: segundoResolution.draft.province, label: 'Provincia OK' },
                quantidade: { ok: true, value: '3', label: 'Quantidade OK' },
                venda_finalizada: { ok: false, value: 'atendendo', label: 'Em atendimento' }
            },
            updatedAt: repairedAt
        };
        const charlyDraft = {
            ...charlyResolution.draft,
            status: 'atendendo', quantity: '', total: '',
            orderId: '', sourceOrderId: '', previousOrderId: '', currentNegotiationOrderId: '',
            product: 'Tex Ultra Ecuador', productKey: 'tex_ultra_ec', productName: 'Tex Ultra Ecuador',
            productMedia: '/media/sales/ec/tex_ultra.png', buyLaterFollowupAt: '',
            flowDataOk: {
                nome_completo: { ok: true, value: charlyResolution.draft.name, label: 'Nome OK' },
                ciudad: { ok: false, value: '', label: 'Cidade pendente' },
                endereco: { ok: false, value: '', label: 'Endereco pendente' },
                agencia: { ok: false, value: '', label: 'Agencia pendente' },
                provincia: { ok: false, value: '', label: 'Provincia pendente' },
                quantidade: { ok: false, value: '', label: 'Quantidade pendente' },
                venda_finalizada: { ok: false, value: 'atendendo', label: 'Em atendimento' }
            },
            updatedAt: repairedAt
        };
        const [segundoResult, charlyResult] = await Promise.all([
            ContactState.updateOne(
                { _id: segundoState._id, chatId: STATE_TARGETS.segundo.chatId },
                { $set: {
                    phoneDigits: STATE_TARGETS.segundo.phoneDigits,
                    customerDataResolution: segundoResolution.resolution,
                    'metadata.lastSenderPn': STATE_TARGETS.segundo.phoneDigits,
                    'metadata.customerPhoneDigits': STATE_TARGETS.segundo.phoneDigits,
                    'metadata.customerDraft': segundoDraft,
                    'metadata.adminPanelLeadId': null,
                    'metadata.adminPanelStatus': 'atendendo',
                    'metadata.dropi': {},
                    'conversationBucket.value': 'review',
                    'conversationBucket.previousValue': segundoState.conversationBucket?.value || 'attendance',
                    'conversationBucket.source': 'controlled_data_repair_v56',
                    'conversationBucket.confidence': 'high',
                    'conversationBucket.score': 100,
                    'conversationBucket.reasons': ['historical_crossed_customer_state_isolated'],
                    'conversationBucket.classifiedAt': repairedAt,
                    'metadata.panelCustomerResidualRepairV56': {
                        repairedAt, previousPhoneDigits: segundoState.phoneDigits,
                        removedOrderId: HISTORICAL_ORDER_ID, historicalOrderChanged: false,
                        source: 'conversation_identity_and_explicit_customer_evidence'
                    }
                } }
            ),
            ContactState.updateOne(
                { _id: charlyState._id, chatId: STATE_TARGETS.charly.chatId, phoneDigits: STATE_TARGETS.charly.phoneDigits },
                { $set: {
                    customerDataResolution: charlyResolution.resolution,
                    'metadata.lastSenderPn': STATE_TARGETS.charly.phoneDigits,
                    'metadata.customerPhoneDigits': STATE_TARGETS.charly.phoneDigits,
                    'metadata.customerDraft': charlyDraft,
                    'metadata.adminPanelLeadId': null,
                    'metadata.adminPanelStatus': 'atendendo',
                    'metadata.dropi': {},
                    'conversationBucket.value': 'attendance',
                    'conversationBucket.previousValue': charlyState.conversationBucket?.value || '',
                    'conversationBucket.source': 'controlled_data_repair_v56',
                    'conversationBucket.confidence': 'high',
                    'conversationBucket.score': 100,
                    'conversationBucket.reasons': ['historical_crossed_customer_state_isolated'],
                    'conversationBucket.classifiedAt': repairedAt,
                    'metadata.panelCustomerResidualRepairV56': {
                        repairedAt, previousDraftName: charlyState.metadata?.customerDraft?.name || '',
                        removedOrderId: HISTORICAL_ORDER_ID, historicalOrderChanged: false,
                        source: 'conversation_identity_and_explicit_customer_evidence'
                    }
                } }
            )
        ]);
        if (segundoResult.matchedCount !== 1 || charlyResult.matchedCount !== 1) {
            throw new Error('Falha ao isolar as fichas 5201/6060.');
        }

        const historicalAfter = await Order.findOne({ orderId: HISTORICAL_ORDER_ID }).lean();
        if (stableJson(historicalAfter) !== historicalBefore) {
            throw new Error(`Pedido historico ${HISTORICAL_ORDER_ID} mudou; intervencao bloqueada.`);
        }
        report.crossedStates.historicalShippedOrderChanged = false;
        report.crossedStates.applyResults = {
            segundoModified: segundoResult.modifiedCount,
            charlyModified: charlyResult.modifiedCount
        };
        report.backupPath = backupPath;
    }

    console.log(JSON.stringify(report, null, 2));
} finally {
    await mongoose.disconnect().catch(() => null);
}
