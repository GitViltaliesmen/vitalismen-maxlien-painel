import fs from 'node:fs';
import path from 'node:path';

import {
    buildPostSaleFullOperationalV188Overlay,
    serializePostSaleFullOperationalV188Overlay
} from '../src/services/postSaleFullOperationalV188Service.js';

const target = path.resolve(String(process.argv[2] || ''));
if (!target || target === path.parse(target).root) throw new Error('post_sale_v188_overlay_target_invalid');

// One-time activation watermark: recover only shipments created in the last
// seven days. The protected overlay is never regenerated during a cycle.
const retroSince = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

const serialized = serializePostSaleFullOperationalV188Overlay(
    {
        ...buildPostSaleFullOperationalV188Overlay({ forwardOnlySince: retroSince.toISOString() }),
        POST_SALE_V263_ALLOWED_STAGES: 'guide,in_transit,ready_for_pickup'
    }
);
fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
fs.writeFileSync(target, serialized, { mode: 0o400, flag: 'wx' });
process.stdout.write('POST_SALE_V188_OVERLAY=CREATED\n');
