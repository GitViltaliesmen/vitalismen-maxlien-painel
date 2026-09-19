import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

import Message from '../src/models/Message.js';
import { EC_QA_TEST_PHONE_V78 } from '../src/services/ecQaTestResetV78Service.js';
import { assertPostSaleFullOperationalV188Configuration } from '../src/services/postSaleFullOperationalV188Service.js';
import { getZapiStatus } from '../src/services/zapiClient.js';
import { sendText } from '../src/whatsapp/sendText.js';

const AUTHORIZATION = 'I_UNDERSTAND_V188_QA_CANARY';
const CANARY_STAGE = 'GUIDE_QA_CANARY';
const CANARY_DEDUPE_KEY = 'shipment_v188_qa_canary:guide:20260918';
const CANARY_TEXT = 'Prueba técnica QA V188 de posventa: aviso de guía validado. No corresponde a un pedido real.';
const ledgerPath = path.resolve(String(process.argv[2] || ''));

const fail = (reason) => {
    throw new Error(`post_sale_v188_qa_canary:${reason}`);
};
const zapiConnected = (status = {}) => Boolean(
    status?.connected
    || status?.smartphoneConnected
    || String(status?.error || '').toLowerCase().includes('already connected')
);
const canonical = (payload) => `${JSON.stringify(payload, null, 2)}\n`;
const writeLedger = (payload, { exclusive = false } = {}) => {
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true, mode: 0o700 });
    if (exclusive) {
        fs.writeFileSync(ledgerPath, canonical(payload), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        return;
    }
    const temporary = `${ledgerPath}.tmp.${process.pid}`;
    fs.writeFileSync(temporary, canonical(payload), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, ledgerPath);
    fs.chmodSync(ledgerPath, 0o600);
};
const loadLedger = () => {
    if (!fs.existsSync(ledgerPath)) return null;
    const stat = fs.lstatSync(ledgerPath);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('ledger_invalid');
    return JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
};

if (process.env.VITALISMEN_POSTSALE_V188_QA_CANARY !== AUTHORIZATION) fail('authorization_missing');
if (EC_QA_TEST_PHONE_V78 !== '5515998038637') fail('qa_phone_invalid');
if (!ledgerPath.startsWith(`${path.resolve('/var/lib/vitalismen-deploy')}${path.sep}`)) fail('ledger_path_invalid');
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL;
if (!mongoUri) fail('mongo_uri_missing');

const profile = assertPostSaleFullOperationalV188Configuration(process.env);
await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
try {
    const providerStatus = await getZapiStatus();
    if (!zapiConnected(providerStatus)) fail('zapi_not_connected');

    const existing = loadLedger();
    if (existing) {
        if (existing.state !== 'SENT' || !existing.providerMessageId) fail(`terminal_ledger_${existing.state || 'unknown'}`);
        const bubbleCount = await Message.countDocuments({
            provider: 'zapi',
            providerMessageId: existing.providerMessageId,
            peerPhone: EC_QA_TEST_PHONE_V78,
            isFromMe: true
        });
        if (bubbleCount !== 1) fail(`persisted_bubble_count_${bubbleCount}`);
        process.stdout.write(`${canonical({
            status: 'PASS_QA_CANARY_DEDUPED',
            qaPhone: EC_QA_TEST_PHONE_V78,
            stage: existing.stage,
            providerAccepted: true,
            providerMessageId: existing.providerMessageId,
            bubblePersisted: true,
            ledgerState: 'SENT',
            dedupeActive: true,
            duplicateSendCount: 0,
            sendExecuted: false,
            orderCreated: false,
            shipmentCreated: false,
            dropiApplied: false,
            metaPurchase: false,
            profile: profile.profile
        })}`);
        process.exit(0);
    }

    const intendedAt = new Date().toISOString();
    writeLedger({
        version: 1,
        state: 'INTENDED',
        qaPhone: EC_QA_TEST_PHONE_V78,
        stage: CANARY_STAGE,
        dedupeKey: CANARY_DEDUPE_KEY,
        intendedAt,
        providerMessageId: ''
    }, { exclusive: true });

    const sent = await sendText(`${EC_QA_TEST_PHONE_V78}@c.us`, CANARY_TEXT, null, {
        provider: 'zapi',
        sessionId: 'zapi',
        recipientDigits: EC_QA_TEST_PHONE_V78,
        humanize: false,
        returnDetails: true,
        outboundContext: 'shipment_v188_qa_canary',
        antiSpamKey: CANARY_DEDUPE_KEY,
        dedupeValue: CANARY_DEDUPE_KEY,
        allowExistingDropiOrder: false,
        sendMode: 'qa_canary_v188'
    });
    const providerMessageId = String(sent?.providerMessageId || '').trim();
    if (sent?.ok !== true || sent?.provider !== 'zapi' || !providerMessageId) {
        writeLedger({
            version: 1,
            state: sent?.providerAttempted === true ? 'AMBIGUOUS' : 'FAILED_FINAL',
            qaPhone: EC_QA_TEST_PHONE_V78,
            stage: CANARY_STAGE,
            dedupeKey: CANARY_DEDUPE_KEY,
            intendedAt,
            finalizedAt: new Date().toISOString(),
            providerMessageId,
            reason: String(sent?.error || sent?.reason || 'provider_not_accepted').slice(0, 500)
        });
        fail('provider_not_accepted');
    }

    const bubble = await Message.findOne({
        provider: 'zapi',
        providerMessageId,
        peerPhone: EC_QA_TEST_PHONE_V78,
        isFromMe: true
    }).select('_id providerMessageId').lean();
    if (!bubble) {
        writeLedger({
            version: 1,
            state: 'AMBIGUOUS',
            qaPhone: EC_QA_TEST_PHONE_V78,
            stage: CANARY_STAGE,
            dedupeKey: CANARY_DEDUPE_KEY,
            intendedAt,
            finalizedAt: new Date().toISOString(),
            providerMessageId,
            reason: 'provider_accepted_without_persisted_bubble'
        });
        fail('bubble_not_persisted');
    }

    const sentAt = new Date().toISOString();
    writeLedger({
        version: 1,
        state: 'SENT',
        qaPhone: EC_QA_TEST_PHONE_V78,
        stage: CANARY_STAGE,
        dedupeKey: CANARY_DEDUPE_KEY,
        intendedAt,
        acceptedAt: sentAt,
        finalizedAt: sentAt,
        providerMessageId,
        messageId: String(bubble._id)
    });
    process.stdout.write(`${canonical({
        status: 'PASS_QA_CANARY_SENT',
        qaPhone: EC_QA_TEST_PHONE_V78,
        stage: CANARY_STAGE,
        providerAccepted: true,
        providerMessageId,
        bubblePersisted: true,
        ledgerState: 'SENT',
        dedupeActive: true,
        duplicateSendCount: 0,
        sendExecuted: true,
        orderCreated: false,
        shipmentCreated: false,
        dropiApplied: false,
        metaPurchase: false,
        profile: profile.profile
    })}`);
} finally {
    await mongoose.disconnect();
}
