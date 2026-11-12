import {installSealedPreload} from '/usr/local/lib/vitalismen-deploy/ec-inbound-audio-sealed-v208-r2.mjs';
import {publishAudioRuntimeContextV208} from '/usr/local/lib/vitalismen-deploy/ec-inbound-audio-profile-v208-r2.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
await installSealedPreload(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'));
publishAudioRuntimeContextV208();
