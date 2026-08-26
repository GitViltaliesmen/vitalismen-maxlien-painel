import 'dotenv/config';
import fs from 'node:fs';
import mongoose from 'mongoose';
import OperationalSafetyState from '../src/models/OperationalSafetyState.js';
import {
    POST_SALE_RUNTIME_VERSION,
    POST_SALE_SAFETY_STATE_ID,
    assertRuntimeSupportsPostSaleData
} from '../src/services/postSaleSafetyV66Service.js';

const runtimeArg = process.argv.find((arg) => arg.startsWith('--runtime='));
const targetMetadataArg = process.argv.find((arg) => arg.startsWith('--target-metadata='));
if (!runtimeArg && !targetMetadataArg) {
    throw new Error('Informe --runtime=<versão> no staging ou --target-metadata=<release/.release-source.json> no rollback.');
}
let targetMetadata = null;
if (targetMetadataArg) {
    const metadataPath = targetMetadataArg.slice('--target-metadata='.length);
    if (!metadataPath || !fs.existsSync(metadataPath)) {
        throw new Error('Metadata do target ausente; rollback bloqueado antes de symlink/PM2.');
    }
    targetMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    if (
        targetMetadata?.postSaleCompatibility?.requiresRollbackTargetPreflight !== true
        || !Number.isFinite(Number(targetMetadata?.postSaleCompatibility?.runtimeVersion))
    ) {
        throw new Error('Target sem classe postSaleCompatibility V66; ROLLBACK_BLOCKED.');
    }
}
const runtimeVersion = Number(
    targetMetadata?.postSaleCompatibility?.runtimeVersion
    || runtimeArg?.split('=')[1]
    || POST_SALE_RUNTIME_VERSION
);
if (!Number.isFinite(runtimeVersion) || runtimeVersion <= 0) {
    throw new Error('Runtime inválido. Use --runtime=<versão numérica>.');
}
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';
if (!mongoUri) throw new Error('MONGODB_URI/MONGO_URI ausente; ativação/rollback bloqueado sem preflight de dados.');

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 });
try {
    const compatibilityState = await OperationalSafetyState.findById(POST_SALE_SAFETY_STATE_ID).lean();
    const result = assertRuntimeSupportsPostSaleData({ runtimeVersion, compatibilityState });
    if (!result.ok) {
        throw new Error(`[POST-SALE-DATA-COMPATIBILITY] alvo bloqueado: ${result.reason}; runtime=${result.runtimeVersion}; mínimo=${result.minRuntimeVersion}.`);
    }
    process.stdout.write(`POST_SALE_DATA_COMPATIBILITY=OK runtime=${runtimeVersion} minimum=${result.minRuntimeVersion || 0}\n`);
} finally {
    await mongoose.disconnect();
}
