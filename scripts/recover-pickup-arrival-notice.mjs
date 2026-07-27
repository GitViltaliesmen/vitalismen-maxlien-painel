import 'dotenv/config';
import mongoose from 'mongoose';
import Shipment from '../src/models/Shipment.js';
import Message from '../src/models/Message.js';
import {
    messageMatchesPickupNoticeKind,
    notifyReadyForPickup,
    shipmentProductFamily
} from '../src/services/shipmentMessageService.js';

const args = new Set(process.argv.slice(2));
const orderArg = [...args].find((arg) => arg.startsWith('--order='));
const orderId = String(orderArg || '').slice('--order='.length).trim();
const send = args.has('--send');
const allowManual = args.has('--allow-manual');

const NOTICE_FIELDS = {
    ready_for_pickup: 'readyForPickupNotifiedAt',
    day1: 'reminderDay1At',
    soft_day2: 'reminderSoftDay2At',
    day3: 'reminderDay3At',
    soft_day4: 'reminderSoftDay4At',
    day5: 'reminderDay5At',
    soft_day6: 'reminderSoftDay6At'
};

const AUDIO_BY_KIND = {
    ready_for_pickup: 'Chegou_01',
    day3: 'Chegou_02',
    day5: 'Chegou_03'
};

const phoneTail = (value = '') => String(value || '').replace(/\D/g, '').slice(-9);

const outboundMessagesForShipment = async (shipment) => {
    const tail = phoneTail(shipment?.client?.phone);
    if (!tail) return [];
    return Message.find({
        $and: [
            { $or: [{ isFromMe: true }, { isBot: true }, { from: 'bot' }] },
            {
                $or: [
                    { peerPhone: { $regex: `${tail}$` } },
                    { chatId: { $regex: tail } },
                    { to: { $regex: tail } }
                ]
            }
        ]
    }).sort({ createdAt: -1 }).limit(500).lean();
};

const hasEvidence = (shipment, messages, kind) => {
    if (messages.some((message) => messageMatchesPickupNoticeKind(message, kind))) return true;
    const audioName = AUDIO_BY_KIND[kind];
    if (audioName && (shipment?.automation?.sentAudioLog || []).some((entry) => (
        entry?.baseName === audioName && entry?.sent === true
    ))) return true;
    const eventName = {
        ready_for_pickup: 'ready_for_pickup_notified',
        day1: 'reminder_day1',
        soft_day2: 'reminder_soft_day2',
        day3: 'reminder_day3',
        soft_day4: 'reminder_soft_day4',
        day5: 'reminder_day5',
        soft_day6: 'reminder_soft_day6'
    }[kind];
    return (shipment?.events || []).some((event) => (
        event?.kind === eventName
        && event?.payload?.recoveredFromExistingNotice !== true
    ));
};

const main = async () => {
    if (!orderId) throw new Error('Informe um unico pedido com --order=ORDER_ID.');
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI ausente.');
    await mongoose.connect(process.env.MONGODB_URI);

    const shipment = await Shipment.findOne({ orderId });
    if (!shipment) throw new Error(`Shipment nao encontrado: ${orderId}`);
    if (shipment.country !== 'EC') throw new Error('Somente shipments EC podem usar esta recuperacao.');
    if (shipment.logistics?.status !== 'READY_FOR_PICKUP' || !shipment.logistics?.agencyPickup) {
        throw new Error(`Shipment fora do estado de retirada em agencia: ${shipment.logistics?.status || 'sem_status'}`);
    }
    if (shipment.outcomes?.delivered || shipment.outcomes?.pickedUp || shipment.outcomes?.returned) {
        throw new Error('Shipment ja finalizado; recuperacao bloqueada.');
    }
    if (shipment.review?.manualOnly && !allowManual) {
        throw new Error(`Shipment manualOnly (${shipment.review?.reviewStatus || 'sem_status'}); use --allow-manual somente apos revisar o motivo.`);
    }

    const messages = await outboundMessagesForShipment(shipment);
    const evidenceBefore = Object.fromEntries(
        Object.keys(NOTICE_FIELDS).map((kind) => [kind, hasEvidence(shipment, messages, kind)])
    );
    if (evidenceBefore.ready_for_pickup) {
        console.log(JSON.stringify({
            dryRun: !send,
            orderId,
            skipped: true,
            reason: 'arrival_notice_already_has_exact_evidence',
            evidenceBefore
        }, null, 2));
        return;
    }

    const staleFields = Object.entries(NOTICE_FIELDS)
        .filter(([kind, field]) => shipment.automation?.[field] && !evidenceBefore[kind])
        .map(([, field]) => field);

    if (!send) {
        console.log(JSON.stringify({
            dryRun: true,
            orderId,
            productFamily: shipmentProductFamily(shipment),
            manualOnly: Boolean(shipment.review?.manualOnly),
            reviewStatus: shipment.review?.reviewStatus || '',
            evidenceBefore,
            staleFields,
            action: 'send_one_arrival_notice_and_restart_only_false_reminder_fields'
        }, null, 2));
        return;
    }

    const sent = await notifyReadyForPickup(shipment, { force: true });
    if (!sent) throw new Error('Aviso de chegada nao foi confirmado pelo provedor.');

    const reset = {};
    for (const field of staleFields) {
        if (field !== 'readyForPickupNotifiedAt') reset[`automation.${field}`] = null;
    }
    if (Object.keys(reset).length) {
        await Shipment.updateOne({ _id: shipment._id }, { $set: reset });
    }

    const refreshed = await Shipment.findById(shipment._id).lean();
    const messagesAfter = await outboundMessagesForShipment(refreshed);
    const arrivalEvidenceAfter = hasEvidence(refreshed, messagesAfter, 'ready_for_pickup');
    if (!arrivalEvidenceAfter) {
        throw new Error('Provedor retornou sucesso, mas a evidencia persistida do aviso nao foi encontrada.');
    }

    console.log(JSON.stringify({
        dryRun: false,
        orderId,
        sent: true,
        productFamily: shipmentProductFamily(refreshed),
        arrivalEvidenceAfter,
        resetReminderFields: Object.keys(reset)
    }, null, 2));
};

main()
    .catch((error) => {
        console.error(`[PICKUP-ARRIVAL-RECOVERY] ${error.message || error}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => null);
    });
