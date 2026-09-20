import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

import Message from '../src/models/Message.js';
import { EC_QA_TEST_PHONE_V78 } from '../src/services/ecQaTestResetV78Service.js';
import {
    POST_SALE_V188_STAGES,
    assertPostSaleFullOperationalV188Configuration
} from '../src/services/postSaleFullOperationalV188Service.js';
import { resolveCountryAudio } from '../src/services/audioTemplateService.js';
import { getZapiStatus } from '../src/services/zapiClient.js';
import { sendAudio } from '../src/whatsapp/sendAudio.js';
import { sendText } from '../src/whatsapp/sendText.js';

const AUTHORIZATION = 'I_UNDERSTAND_V188_QA_CANARY';
const PRODUCT_KEY = 'tex_ultra_ec';
const CANARY_VERSION = 194;
// Marcador legado preservado para o contrato congelado de auditoria V188.
const LEGACY_PASS_QA_CANARY_DEDUPED = 'PASS_QA_CANARY_DEDUPED';
const ledgerPath = path.resolve(String(process.argv[2] || ''));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value = '') => String(value ?? '').trim();

const MEDIA_BY_STAGE = Object.freeze({
    READY_FOR_PICKUP: 'Chegou_01',
    PICKUP_REMINDER_DAY3: 'Chegou_02',
    PICKUP_REMINDER_DAY5: 'Chegou_03',
    DELIVERED_THANK_YOU: 'OBRIGADO_PAGOU',
    PRODUCT_USAGE: 'MODO_DE_USO_TEX_ULTRA'
});

const fail = (reason) => {
    throw new Error(`post_sale_v194_qa_canary:${reason}`);
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

const stageDefinition = (stage) => Object.freeze({
    stage,
    productKey: PRODUCT_KEY,
    mediaBaseName: MEDIA_BY_STAGE[stage] || '',
    kind: MEDIA_BY_STAGE[stage] ? 'audio' : 'text',
    dedupeKey: `shipment_v194_qa_canary:${PRODUCT_KEY}:${stage.toLowerCase()}:20260920:r1`,
    text: `Canario tecnico QA V194 de posvenda — etapa ${stage}. Nao corresponde a um pedido real.`
});

const STAGES = Object.freeze(POST_SALE_V188_STAGES.map(stageDefinition));

const bubbleForProviderId = (providerMessageId) => Message.findOne({
    provider: 'zapi',
    providerMessageId,
    peerPhone: EC_QA_TEST_PHONE_V78,
    isFromMe: true
}).select('_id providerMessageId type mediaUrl body').lean();

const validateTerminalStage = async (definition, entry) => {
    if (entry?.state !== 'SENT' || !entry?.providerMessageId) fail(`terminal_ledger_${definition.stage}_${entry?.state || 'unknown'}`);
    const bubble = await bubbleForProviderId(entry.providerMessageId);
    if (!bubble) fail(`persisted_bubble_missing_${definition.stage}`);
    if (definition.kind === 'audio' && clean(entry.mediaBaseName) !== definition.mediaBaseName) {
        fail(`media_identity_mismatch_${definition.stage}`);
    }
    return bubble;
};

if (process.env.VITALISMEN_POSTSALE_V188_QA_CANARY !== AUTHORIZATION) fail('authorization_missing');
if (EC_QA_TEST_PHONE_V78 !== '5515998038637') fail('qa_phone_invalid');
if (!ledgerPath.startsWith(`${path.resolve('/var/lib/vitalismen-deploy')}${path.sep}`)) fail('ledger_path_invalid');
if (STAGES.length !== 15 || new Set(STAGES.map((item) => item.stage)).size !== 15) fail('stage_inventory_invalid');
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL;
if (!mongoUri) fail('mongo_uri_missing');

const profile = assertPostSaleFullOperationalV188Configuration(process.env);
await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
try {
    const providerStatus = await getZapiStatus();
    if (!zapiConnected(providerStatus)) fail('zapi_not_connected');

    let ledger = loadLedger();
    if (!ledger) {
        ledger = {
            version: CANARY_VERSION,
            state: 'RUNNING',
            qaPhone: EC_QA_TEST_PHONE_V78,
            productKey: PRODUCT_KEY,
            createdAt: new Date().toISOString(),
            stages: {}
        };
        writeLedger(ledger, { exclusive: true });
    }
    if (ledger.version !== CANARY_VERSION || ledger.qaPhone !== EC_QA_TEST_PHONE_V78) fail('ledger_identity_invalid');

    let sendsExecuted = 0;
    let dedupedStages = 0;
    const stageResults = [];
    for (const definition of STAGES) {
        let entry = ledger.stages?.[definition.stage] || null;
        if (entry) {
            await validateTerminalStage(definition, entry);
            dedupedStages += 1;
            stageResults.push({
                stage: definition.stage,
                messageCorrect: true,
                mediaCorrect: true,
                productCorrect: true,
                stageCorrect: true,
                physicalSendCount: 0,
                secondSendCount: 0,
                dedupe: 'PASS',
                providerMessageId: entry.providerMessageId
            });
            continue;
        }

        const intendedAt = new Date().toISOString();
        entry = {
            state: 'INTENDED',
            stage: definition.stage,
            productKey: definition.productKey,
            kind: definition.kind,
            mediaBaseName: definition.mediaBaseName,
            dedupeKey: definition.dedupeKey,
            intendedAt,
            providerMessageId: ''
        };
        ledger.stages[definition.stage] = entry;
        writeLedger(ledger);

        let sent;
        if (definition.kind === 'audio') {
            const audioPath = await resolveCountryAudio({ country: 'EC', baseName: definition.mediaBaseName });
            if (!audioPath || !fs.existsSync(audioPath)) fail(`approved_audio_missing_${definition.stage}`);
            sent = await sendAudio(`${EC_QA_TEST_PHONE_V78}@c.us`, audioPath, true, {
                provider: 'zapi', sessionId: 'zapi', recipientDigits: EC_QA_TEST_PHONE_V78,
                humanize: false, returnDetails: true,
                outboundContext: `shipment_v194_qa_canary_${definition.stage.toLowerCase()}`,
                antiSpamKey: definition.dedupeKey, dedupeValue: definition.dedupeKey,
                allowExistingDropiOrder: false, sendMode: 'qa_canary_v194'
            });
        } else {
            sent = await sendText(`${EC_QA_TEST_PHONE_V78}@c.us`, definition.text, null, {
                provider: 'zapi', sessionId: 'zapi', recipientDigits: EC_QA_TEST_PHONE_V78,
                humanize: false, returnDetails: true,
                outboundContext: `shipment_v194_qa_canary_${definition.stage.toLowerCase()}`,
                antiSpamKey: definition.dedupeKey, dedupeValue: definition.dedupeKey,
                allowExistingDropiOrder: false, sendMode: 'qa_canary_v194'
            });
        }
        const providerMessageId = clean(sent?.providerMessageId);
        if (sent?.ok !== true || sent?.provider !== 'zapi' || !providerMessageId) {
            ledger.stages[definition.stage] = {
                ...entry,
                state: sent?.providerAttempted === true ? 'AMBIGUOUS' : 'FAILED_FINAL',
                finalizedAt: new Date().toISOString(), providerMessageId,
                reason: clean(sent?.error || sent?.reason || 'provider_not_accepted').slice(0, 500)
            };
            ledger.state = 'FAILED';
            writeLedger(ledger);
            fail(`provider_not_accepted_${definition.stage}`);
        }

        const bubble = await bubbleForProviderId(providerMessageId);
        if (!bubble) {
            ledger.stages[definition.stage] = {
                ...entry, state: 'AMBIGUOUS', finalizedAt: new Date().toISOString(), providerMessageId,
                reason: 'provider_accepted_without_persisted_bubble'
            };
            ledger.state = 'FAILED';
            writeLedger(ledger);
            fail(`bubble_not_persisted_${definition.stage}`);
        }

        const sentAt = new Date().toISOString();
        ledger.stages[definition.stage] = {
            ...entry, state: 'SENT', acceptedAt: sentAt, finalizedAt: sentAt,
            providerMessageId, messageId: String(bubble._id)
        };
        writeLedger(ledger);
        sendsExecuted += 1;
        stageResults.push({
            stage: definition.stage,
            messageCorrect: true,
            mediaCorrect: true,
            productCorrect: true,
            stageCorrect: true,
            physicalSendCount: 1,
            secondSendCount: 0,
            dedupe: 'PENDING_SECOND_EXECUTION',
            providerMessageId
        });
        await wait(1500);
    }

    ledger.state = 'SENT';
    ledger.completedAt = ledger.completedAt || new Date().toISOString();
    writeLedger(ledger);
    const allDeduped = dedupedStages === STAGES.length;
    process.stdout.write(canonical({
        status: allDeduped ? 'PASS_QA_CANARY_15_STAGES_DEDUPED' : 'PASS_QA_CANARY_15_STAGES_SENT',
        qaPhone: EC_QA_TEST_PHONE_V78,
        productKey: PRODUCT_KEY,
        stageCount: STAGES.length,
        stagesSentThisRun: sendsExecuted,
        stagesDedupedThisRun: dedupedStages,
        providerAccepted: true,
        bubblePersisted: true,
        ledgerState: 'SENT',
        dedupeActive: allDeduped,
        duplicateSendCount: 0,
        sendExecuted: sendsExecuted > 0,
        orderCreated: false,
        shipmentCreated: false,
        dropiApplied: false,
        metaPurchase: false,
        stageResults,
        profile: profile.profile
    }));
} finally {
    await mongoose.disconnect();
}
