import { installSealedPreload } from '/usr/local/lib/vitalismen-deploy/sealed-successor-v1.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
await installSealedPreload(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
