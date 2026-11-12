import {installSealedPreload} from '/usr/local/lib/vitalismen-deploy/gira21x-stripe-prepaid-sealed-v1.mjs';
import {publishPrepaidRuntimeContextV1} from '/usr/local/lib/vitalismen-deploy/gira21x-stripe-prepaid-profile-v1.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
await installSealedPreload(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'));
publishPrepaidRuntimeContextV1();
