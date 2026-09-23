import crypto from 'node:crypto';
import fs from 'node:fs';
import mongoose from 'mongoose';
import Message from '../src/models/Message.js';
import {
    reconcilePendingZapiDeliveryV155,
    rememberUnmatchedZapiDeliveryV155,
    zapiDeliveryEvidenceFromLogV155
} from '../src/services/zapiDeliveryCallbackReconciliationV155Service.js';

const clean = (value = '') => String(value || '').trim();
const digits = (value = '') => clean(value).replace(/\D/g, '');
const mode = clean(process.argv[2] || 'plan').toLowerCase();
const providerMessageId = clean(process.argv[3]);
const logPath = clean(process.env.V155_ZAPI_CALLBACK_LOG || '/root/.pm2/logs/vitalismen-automation-out.log');
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL;
const authorized = clean(process.env.V155_ZAPI_CALLBACK_RECONCILIATION_AUTHORIZATION) === 'I_UNDERSTAND_V155_SINGLE_MESSAGE';

if (!['plan', 'run'].includes(mode) || !/^[A-Za-z0-9._:-]{8,160}$/.test(providerMessageId)) {
    throw new Error('usage: node scripts/reconcile-zapi-delivery-callback-v155.mjs plan|run PROVIDER_MESSAGE_ID');
}
if (mode === 'run' && !authorized) throw new Error('V155_ZAPI_CALLBACK_RECONCILIATION_AUTHORIZATION_REQUIRED');
if (!mongoUri) throw new Error('mongo_uri_missing');

const logText = fs.readFileSync(logPath, 'utf8');
const evidence = zapiDeliveryEvidenceFromLogV155(logText, providerMessageId);
if (!evidence.found || !['delivered', 'read'].includes(evidence.strongest.deliveryStatus)) {
    throw new Error(`v155_real_delivered_or_read_callback_required:${evidence.reason || 'status_not_confirmed'}`);
}

await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
try {
    const rows = await Message.find({ providerMessageId });
    if (rows.length !== 1) throw new Error(`v155_exact_single_message_required:${rows.length}`);
    const message = rows[0];
    if (clean(message.provider).toLowerCase() !== 'zapi') throw new Error('v155_zapi_message_required');
    const messagePhone = digits(message.peerPhone || message.chatId || message.to);
    if (!messagePhone || messagePhone !== evidence.strongest.phone) throw new Error('v155_callback_phone_mismatch');

    const base = {
        mode,
        readOnly: mode === 'plan',
        providerCalls: 0,
        messagesSent: 0,
        providerMessageId,
        callbackOccurrences: evidence.occurrences,
        callbackStatus: evidence.strongest.deliveryStatus,
        callbackAck: evidence.strongest.ack,
        callbackObservedAt: evidence.strongest.observedAt,
        callbackEvidenceSha256: crypto.createHash('sha256')
            .update(`${providerMessageId}|${evidence.strongest.phone}|${evidence.strongest.deliveryStatus}|${evidence.strongest.observedAt}`)
            .digest('hex'),
        phoneSuffix: messagePhone.slice(-4),
        beforeDeliveryStatus: clean(message.deliveryStatus),
        beforeAck: message.ack ?? null
    };
    if (mode === 'plan') {
        process.stdout.write(`${JSON.stringify({ ...base, wouldReconcile: true }, null, 2)}\n`);
        process.exitCode = 0;
    } else {
        rememberUnmatchedZapiDeliveryV155({
            providerMessageId,
            ...evidence.strongest,
            providerStatus: `reconciled_from_real_callback_v155:${evidence.strongest.providerStatus}`
        });
        const result = await reconcilePendingZapiDeliveryV155(message);
        if (!result.reconciled) throw new Error(`v155_reconciliation_failed:${result.reason}`);
        process.stdout.write(`${JSON.stringify({
            ...base,
            reconciled: true,
            afterDeliveryStatus: clean(message.deliveryStatus),
            afterAck: message.ack ?? null
        }, null, 2)}\n`);
    }
} finally {
    await mongoose.disconnect().catch(() => null);
}
