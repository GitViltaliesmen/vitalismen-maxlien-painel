import 'dotenv/config';
import mongoose from 'mongoose';

import {
    assertPostSaleTransactionalV105Configuration,
    buildPostSaleTransactionalV105Overlay
} from '../src/services/postSaleTransactionalControlPlaneV105Service.js';
import {
    decidePostSaleNotification,
    findManualHumanModeForShipment
} from '../src/services/postSaleNotificationDecisionService.js';
import {
    assertPostSaleNextEligibleMonitorV112Manifest,
    buildPostSaleNextEligibleReportV112,
    postSaleNextEligibleCandidateQueryV112
} from '../src/services/postSaleNextEligibleMonitorV112Service.js';
import {
    installStrictReadOnlyMongooseGuard,
    resolveStrictReadOnlyObservation
} from '../src/services/strictReadOnlyObservationService.js';
import Shipment from '../src/models/Shipment.js';

assertPostSaleNextEligibleMonitorV112Manifest();
const overlay = buildPostSaleTransactionalV105Overlay({ baseEnv: process.env });
Object.assign(process.env, overlay);
const profile = assertPostSaleTransactionalV105Configuration(process.env);

const readOnlyEnv = Object.freeze({
    NODE_ENV: 'production',
    VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'true',
    VITALISMEN_STRICT_READ_ONLY: 'true',
    SAFE_OBSERVATION_POLICY: 'STRICT_READ_ONLY'
});
const mutationGuard = installStrictReadOnlyMongooseGuard(mongoose, { envProvider: () => readOnlyEnv });
const nativeFetch = globalThis.fetch;
let providerCalls = 0;
globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error('POSTSALE_V112_READ_ONLY_PROVIDER_INTERLOCK');
};

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL;
if (!mongoUri) throw new Error('mongo_uri_missing');

try {
    await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
    const shipments = await Shipment.find(postSaleNextEligibleCandidateQueryV112())
        .sort({ updatedAt: 1, createdAt: 1 })
        .lean();
    const report = await buildPostSaleNextEligibleReportV112({
        shipments,
        decidePostSaleNotification,
        findManualHumanModeForShipment,
        providerCalls,
        mutationGuard
    });
    process.stdout.write(`${JSON.stringify({
        ...report,
        PROFILE_READY: profile.ready,
        READ_ONLY_POLICY: resolveStrictReadOnlyObservation(readOnlyEnv)
    }, null, 2)}\n`);
} finally {
    await mongoose.disconnect().catch(() => null);
    globalThis.fetch = nativeFetch;
}
