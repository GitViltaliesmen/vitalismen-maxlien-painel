import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

import {
    buildPostSaleTransactionalV105Overlay,
    serializePostSaleTransactionalV105Overlay
} from '../src/services/postSaleTransactionalControlPlaneV105Service.js';

const target = path.resolve(String(process.argv[2] || ''));
if (!target || target === path.parse(target).root) throw new Error('post_sale_v116_overlay_target_invalid');

const overlay = {
    ...buildPostSaleTransactionalV105Overlay({ baseEnv: process.env }),
    POST_SALE_TRANSACTIONAL_AT_MOST_ONCE_V116_ENABLED: 'true'
};
const serialized = serializePostSaleTransactionalV105Overlay(overlay);
fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
fs.writeFileSync(target, serialized, { mode: 0o400, flag: 'wx' });
process.stdout.write('POST_SALE_V116_OVERLAY=CREATED\n');
