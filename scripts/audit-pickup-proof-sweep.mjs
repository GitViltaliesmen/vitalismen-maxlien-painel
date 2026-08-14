import 'dotenv/config';
import mongoose from 'mongoose';
import { processPickupProofSweep } from '../src/services/shipmentMessageService.js';

const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = Math.max(1, Math.min(Number.parseInt(String(limitArg || '').slice('--limit='.length), 10) || 50, 200));

const main = async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI ausente.');
    await mongoose.connect(process.env.MONGODB_URI);
    const result = await processPickupProofSweep({ limit, dryRun: true });
    console.log(JSON.stringify(result, null, 2));
};

main()
    .catch((error) => {
        console.error(`[PICKUP-PROOF-AUDIT] ${error.message || error}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => null);
    });
