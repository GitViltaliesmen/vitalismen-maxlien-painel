import { installSealedPreload } from '/usr/local/lib/vitalismen-deploy/gira21x-sealed-successor-v1.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
await installSealedPreload(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));

import {publishGiraRuntimeContext} from '/usr/local/lib/vitalismen-deploy/gira21x-profile-authority-v1.mjs';
publishGiraRuntimeContext();
