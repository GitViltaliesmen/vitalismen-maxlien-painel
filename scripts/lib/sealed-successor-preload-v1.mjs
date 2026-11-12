import {installSealedPreload} from '/usr/local/lib/vitalismen-deploy/ec-repurchase-sealed-v207.mjs';
import {publishRepurchaseRuntimeContextV207} from '/usr/local/lib/vitalismen-deploy/ec-repurchase-profile-v207.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
await installSealedPreload(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'));
publishRepurchaseRuntimeContextV207();
