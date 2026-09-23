import 'dotenv/config';
import mongoose from 'mongoose';
import Message from '../src/models/Message.js';
import VslVisit from '../src/models/VslVisit.js';
import ContactState from '../src/models/ContactState.js';
import {
    V191_DEFAULT_HOURS,
    V191_FIRST_REPLY_SLA_SECONDS,
    V191_QUEUE_STALE_SECONDS,
    collectV191ReadOnlySnapshot,
    inspectV191LedgerByPhone
} from '../src/services/vslIngressLedgerV191Service.js';

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const argValue = (name) => {
    const prefix = `--${name}=`;
    const found = args.find((argument) => argument.startsWith(prefix));
    return found ? found.slice(prefix.length) : '';
};
const positiveInteger = (name, fallback) => {
    const raw = argValue(name);
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`INVALID_${name.toUpperCase().replace(/-/g, '_')}`);
    return parsed;
};

const days = positiveInteger('days', 0);
const hours = days ? days * 24 : positiveInteger('hours', V191_DEFAULT_HOURS);
const slaSeconds = positiveInteger('sla-seconds', V191_FIRST_REPLY_SLA_SECONDS);
const queueStaleSeconds = positiveInteger('queue-stale-seconds', V191_QUEUE_STALE_SECONDS);
const includeQa = hasFlag('include-qa');
const jsonOutput = hasFlag('json');
const inspectPhone = String(argValue('inspect-phone') || '').replace(/\D/g, '');
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';

if (!mongoUri) throw new Error('MONGODB_URI_REQUIRED');

mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);

const now = new Date();
const windowStart = new Date(now.getTime() - hours * 60 * 60 * 1000);
let result;

try {
    await mongoose.connect(mongoUri, {
        autoIndex: false,
        autoCreate: false,
        readPreference: 'primaryPreferred',
        serverSelectionTimeoutMS: 10_000,
        connectTimeoutMS: 10_000
    });
    result = await collectV191ReadOnlySnapshot({
        MessageModel: Message,
        VslVisitModel: VslVisit,
        ContactStateModel: ContactState,
        now,
        windowStart,
        slaSeconds,
        queueStaleSeconds,
        includeQa
    });
} finally {
    await mongoose.disconnect().catch(() => {});
}
const inspection = inspectPhone ? inspectV191LedgerByPhone(result, inspectPhone) : null;
const safeInspection = inspection ? {
    phoneLast4: inspection.phoneLast4,
    state: inspection.classification,
    persistedAt: inspection.persistedAt,
    firstOutboundAt: inspection.firstOutboundAt,
    providerAcceptedAt: inspection.providerAcceptedAt,
    deliveredAt: inspection.deliveredAt,
    readAt: inspection.readAt,
    firstReplyLatencyMs: inspection.firstReplyLatencyMs,
    vslLinked: inspection.vslLinked,
    lateAttributionCandidate: inspection.lateAttributionCandidate,
    watchdogFalsePositiveCandidate: inspection.watchdogFalsePositiveCandidate
} : null;

const output = {
    RESULT: 'PASS',
    MODE: 'READ_ONLY_SHADOW',
    GENERATED_AT: result.generatedAt,
    WINDOW_START: result.windowStart,
    WINDOW_HOURS: hours,
    FIRST_REPLY_SLA_SECONDS: slaSeconds,
    QUEUE_STALE_SECONDS: queueStaleSeconds,
    QA_INCLUDED: includeQa,
    ...result.summary,
    DATABASE_MUTATION_COUNT: 0,
    WHATSAPP_OUTBOUND_COUNT: 0,
    ORDER_MUTATION_COUNT: 0,
    META_EVENT_COUNT: 0,
    DROPI_MUTATION_COUNT: 0,
    ...(safeInspection ? {
        INSPECT_PHONE_LAST4: safeInspection.phoneLast4,
        INSPECT_LEDGER_STATE: safeInspection.state,
        INSPECT_PERSISTED_AT: safeInspection.persistedAt,
        INSPECT_FIRST_OUTBOUND_AT: safeInspection.firstOutboundAt,
        INSPECT_PROVIDER_ACCEPTED_AT: safeInspection.providerAcceptedAt,
        INSPECT_DELIVERED_AT: safeInspection.deliveredAt,
        INSPECT_READ_AT: safeInspection.readAt,
        INSPECT_FIRST_REPLY_LATENCY_MS: safeInspection.firstReplyLatencyMs,
        INSPECT_VSL_LINKED: safeInspection.vslLinked,
        INSPECT_LATE_ATTRIBUTION_CANDIDATE: safeInspection.lateAttributionCandidate,
        INSPECT_WATCHDOG_FALSE_POSITIVE_CANDIDATE: safeInspection.watchdogFalsePositiveCandidate
    } : {})
};

const serialized = JSON.stringify(output, null, 2);
if (inspectPhone && serialized.includes(inspectPhone)) {
    throw new Error('V191_PRIVACY_VIOLATION_FULL_PHONE');
}

if (jsonOutput) {
    console.log(serialized);
} else {
    for (const [key, value] of Object.entries(output)) {
        console.log(`${key}=${value === null || value === undefined ? 'NA' : value}`);
    }
}
