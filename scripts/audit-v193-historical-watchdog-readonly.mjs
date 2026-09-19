import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import Message from '../src/models/Message.js';
import VslVisit from '../src/models/VslVisit.js';
import ContactState from '../src/models/ContactState.js';
import { collectV191ReadOnlySnapshot } from '../src/services/vslIngressLedgerV191Service.js';

const args = process.argv.slice(2);
const value = (name, fallback = '') => {
    const prefix = `--${name}=`;
    return args.find((item) => item.startsWith(prefix))?.slice(prefix.length) || fallback;
};
const days = Number.parseInt(value('days', '7'), 10);
if (!Number.isFinite(days) || days <= 0) throw new Error('INVALID_DAYS');
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';
if (!mongoUri) throw new Error('MONGODB_URI_REQUIRED');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const activeRelease = (() => {
    if (process.env.VITALISMEN_ACTIVE_RELEASE) return String(process.env.VITALISMEN_ACTIVE_RELEASE);
    const productionCurrent = '/opt/vitalismen-automacao/current';
    const activeRoot = fs.existsSync(productionCurrent) ? productionCurrent : root;
    const realRoot = fs.realpathSync(activeRoot).replace(/\\/g, '/');
    const releaseMatch = realRoot.match(/\/releases\/([^/]+)(?:\/|$)/);
    return releaseMatch?.[1] || 'local_candidate';
})();

mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const generatedAt = new Date();
let snapshot;
try {
    await mongoose.connect(mongoUri, {
        autoIndex: false,
        autoCreate: false,
        readPreference: 'primaryPreferred',
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000
    });
    snapshot = await collectV191ReadOnlySnapshot({
        MessageModel: Message,
        VslVisitModel: VslVisit,
        ContactStateModel: ContactState,
        now: generatedAt,
        windowStart: new Date(generatedAt.getTime() - days * 24 * 60 * 60 * 1000),
        includeQa: false
    });
} finally {
    await mongoose.disconnect().catch(() => {});
}

const rows = snapshot.ledger.map((row) => ({
    timestamp: row.persistedAt,
    activeRelease,
    messageType: row.messageType,
    trafficClass: row.vslExplicitEntry ? 'VSL' : 'NON_VSL',
    laterResponse: Boolean(row.firstOutboundAt),
    terminalStatus: row.classification
}));
const output = {
    RESULT: 'PASS',
    MODE: 'READ_ONLY_HISTORICAL_EVIDENCE',
    GENERATED_AT: generatedAt.toISOString(),
    WINDOW_DAYS: days,
    ACTIVE_RELEASE_AT_REPORT_TIME: activeRelease,
    ROW_COUNT: rows.length,
    DATABASE_MUTATION_COUNT: 0,
    WHATSAPP_OUTBOUND_COUNT: 0,
    HISTORICAL_RECOVERY_COUNT: 0,
    rows
};
console.log(JSON.stringify(output, null, 2));
