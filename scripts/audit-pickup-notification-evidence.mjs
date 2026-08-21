import 'dotenv/config';
import mongoose from 'mongoose';
import Shipment from '../src/models/Shipment.js';
import Message from '../src/models/Message.js';
import {
    messageMatchesPickupNoticeKind,
    pickupHowToUseAudioForShipment,
    shipmentProductFamily
} from '../src/services/shipmentMessageService.js';

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

const messageQueryForShipment = (shipment) => {
    const tail = phoneTail(shipment?.client?.phone);
    if (!tail) return { _id: null };
    return {
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
    };
};

const audioEvidence = (shipment, kind) => {
    const baseName = AUDIO_BY_KIND[kind];
    if (!baseName) return false;
    return (shipment?.automation?.sentAudioLog || []).some((entry) => (
        entry?.baseName === baseName && entry?.sent === true
    ));
};

const eventEvidence = (shipment, kind) => {
    const expectedKind = {
        ready_for_pickup: 'ready_for_pickup_notified',
        day1: 'reminder_day1',
        soft_day2: 'reminder_soft_day2',
        day3: 'reminder_day3',
        soft_day4: 'reminder_soft_day4',
        day5: 'reminder_day5',
        soft_day6: 'reminder_soft_day6'
    }[kind];
    return (shipment?.events || []).some((event) => (
        event?.kind === expectedKind
        && event?.payload?.recoveredFromExistingNotice !== true
    ));
};

const recoveredEventEvidence = (shipment, kind) => {
    const expectedKind = {
        ready_for_pickup: 'ready_for_pickup_notified',
        day1: 'reminder_day1',
        soft_day2: 'reminder_soft_day2',
        day3: 'reminder_day3',
        soft_day4: 'reminder_soft_day4',
        day5: 'reminder_day5',
        soft_day6: 'reminder_soft_day6'
    }[kind];
    return (shipment?.events || []).some((event) => (
        event?.kind === expectedKind
        && event?.payload?.recoveredFromExistingNotice === true
        && Boolean(event?.payload?.sourceMessageId)
    ));
};

const ledgerEvidence = (shipment, kind) => (
    (shipment?.notificationLedger || []).some((entry) => (
        entry?.notification_type === kind
        && Boolean(entry?.provider_message_id)
        && Boolean(entry?.sent_at || entry?.delivered_at || entry?.read_at)
    ))
);

const main = async () => {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI ausente.');
    }
    await mongoose.connect(process.env.MONGODB_URI);

    const shipments = await Shipment.find({
        country: 'EC',
        'logistics.status': 'READY_FOR_PICKUP',
        'logistics.agencyPickup': true,
        'outcomes.delivered': { $ne: true },
        'outcomes.pickedUp': { $ne: true },
        'outcomes.returned': { $ne: true }
    }).sort({ updatedAt: -1 }).lean();

    const results = [];
    for (const shipment of shipments) {
        const messages = await Message.find(messageQueryForShipment(shipment))
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();
        const notices = {};
        for (const [kind, field] of Object.entries(NOTICE_FIELDS)) {
            const markedAt = shipment?.automation?.[field] || null;
            const exactMessage = messages.some((message) => messageMatchesPickupNoticeKind(message, kind));
            const exactAudio = audioEvidence(shipment, kind);
            const exactEvent = eventEvidence(shipment, kind);
            const recoveredEvent = recoveredEventEvidence(shipment, kind);
            const exactLedger = ledgerEvidence(shipment, kind);
            const hasEvidence = exactMessage || exactAudio || exactEvent || recoveredEvent || exactLedger;
            notices[kind] = {
                marked: Boolean(markedAt),
                markedAt,
                evidence: hasEvidence,
                message: exactMessage,
                audio: exactAudio,
                event: exactEvent,
                recoveredEvent,
                ledger: exactLedger,
                falsePositive: Boolean(markedAt) && !hasEvidence
            };
        }
        results.push({
            orderId: shipment.orderId,
            trackingNumber: shipment?.logistics?.trackingNumber || '',
            productFamily: shipmentProductFamily(shipment),
            howToUseAudio: pickupHowToUseAudioForShipment(shipment),
            manualOnly: Boolean(shipment?.review?.manualOnly),
            reviewStatus: shipment?.review?.reviewStatus || '',
            notices
        });
    }

    const falsePositiveOrders = results.filter((item) => (
        Object.values(item.notices).some((notice) => notice.falsePositive)
    ));
    const missingArrivalOrders = results.filter((item) => !item.notices.ready_for_pickup.evidence);

    console.log(JSON.stringify({
        dryRun: true,
        generatedAt: new Date().toISOString(),
        totals: {
            activeAgencyPickup: results.length,
            falsePositiveOrders: falsePositiveOrders.length,
            missingArrivalOrders: missingArrivalOrders.length,
            manualOnlyOrders: results.filter((item) => item.manualOnly).length
        },
        results
    }, null, 2));
};

const runSelfTest = () => {
    const recoveredFixture = {
        events: [{
            kind: 'ready_for_pickup_notified',
            payload: {
                recoveredFromExistingNotice: true,
                sourceMessageId: 'provider-message-fixture'
            }
        }],
        notificationLedger: [{
            notification_type: 'ready_for_pickup',
            provider_message_id: 'provider-message-fixture',
            sent_at: new Date('2026-08-21T13:42:11Z')
        }]
    };
    if (!recoveredEventEvidence(recoveredFixture, 'ready_for_pickup')) {
        throw new Error('evento recuperado valido nao foi reconhecido');
    }
    if (!ledgerEvidence(recoveredFixture, 'ready_for_pickup')) {
        throw new Error('notification ledger valido nao foi reconhecido');
    }
    if (ledgerEvidence({ notificationLedger: [{ notification_type: 'ready_for_pickup' }] }, 'ready_for_pickup')) {
        throw new Error('ledger sem comprovante foi aceito');
    }
    console.log('PICKUP_NOTIFICATION_EVIDENCE_AUDIT_SELF_TEST=OK');
};

if (process.argv.includes('--self-test')) {
    runSelfTest();
} else {
    main()
        .catch((error) => {
            console.error(`[PICKUP-EVIDENCE-AUDIT] ${error.message || error}`);
            process.exitCode = 1;
        })
        .finally(async () => {
            await mongoose.disconnect().catch(() => null);
        });
}
