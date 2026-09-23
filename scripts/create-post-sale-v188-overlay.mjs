import fs from 'node:fs';
import path from 'node:path';

import {
    buildPostSaleFullOperationalV188Overlay,
    serializePostSaleFullOperationalV188Overlay
} from '../src/services/postSaleFullOperationalV188Service.js';

const target = path.resolve(String(process.argv[2] || ''));
if (!target || target === path.parse(target).root) throw new Error('post_sale_v188_overlay_target_invalid');

const serialized = serializePostSaleFullOperationalV188Overlay(
    buildPostSaleFullOperationalV188Overlay()
);
fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
fs.writeFileSync(target, serialized, { mode: 0o400, flag: 'wx' });
process.stdout.write('POST_SALE_V188_OVERLAY=CREATED\n');
