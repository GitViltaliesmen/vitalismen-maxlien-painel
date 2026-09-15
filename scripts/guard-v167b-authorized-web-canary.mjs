#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const require = createRequire(import.meta.url);

const core = read('src/whatsapp/core/AuthorizedWebCanaryV167B.js');
const worker = read('scripts/v167b-authorized-web-worker.mjs');
const runner = read('scripts/v167b-authorized-web-canary.mjs');
const wrapper = read('ops/web-canary-v167b');
const docs = read('docs/AUTHORIZED_WEB_CANARY_V167B_20260915.md');
const ecosystemPath = path.join(root, 'ops/ecosystem.v167b-authorized-web.config.cjs');
delete require.cache[ecosystemPath];
const ecosystem = require(ecosystemPath);

assert.equal(ecosystem.apps.length, 1);
const app = ecosystem.apps[0];
assert.equal(app.name, 'vitalismen-whatsapp-web-shadow-v164');
assert.equal(app.instances, 1);
assert.equal(app.script, path.join(root, 'scripts', 'v167b-authorized-web-worker.mjs'));
assert.equal(app.env.V167B_AUTHORIZED_PHONE, '5515998038637');
assert.equal(app.env.V167B_SOCKET_PATH, '/run/vitalismen-whatsapp-web-v167b.sock');
assert.equal(app.env.WHATSAPP_SESSION_STORAGE_ROOT, '/var/lib/vitalismen-whatsapp-web-sessions');

assert.match(core, /V167B_EVENT_KEY = 'V167B_AUTHORIZED_WEB_CANARY_5515998038637'/);
assert.match(core, /V167B_TEXT = 'Prueba técnica controlada V167B por WhatsApp Web\. No requiere respuesta comercial\.'/);
assert.match(core, /V167B_SOCKET_PATH = '\/run\/vitalismen-whatsapp-web-v167b\.sock'/);
assert.match(core, /v167WebWorkerReady/);
assert.match(core, /DUPLICATE_BLOCKED/);
assert.match(core, /PROVIDER_RESULT_AMBIGUOUS/);
assert.doesNotMatch(core, /zapiPort|sendText|sendAudio|sendImage|sendVideo/);

assert.match(worker, /PersistentShadowWorkerV152ER4/);
assert.match(worker, /printQRInTerminal: false/);
assert.match(worker, /emitOwnEvents: false/);
assert.match(worker, /maxConcurrentSockets: 1/);
assert.match(worker, /generalOutboundQueueConsumption: 0/);
assert.doesNotMatch(worker, /zapiClient|ZAPI_TOKEN|pairingCode/);

assert.match(runner, /UnifiedMessageLedger/);
assert.match(runner, /ControlledOutboundCoordinatorV167/);
assert.match(runner, /queueStatus: 'PENDING'/);
assert.match(runner, /queueStatus: 'CLAIMED'/);
assert.match(runner, /queueStatus: 'COMPLETED'/);
assert.match(runner, /queueAttemptCount: 0/);
assert.match(runner, /zapiSendAttempts \+= 1/);
assert.match(runner, /retryAllowed: false/);
assert.match(runner, /CONFIRM_ONE_WEB_MESSAGE_TO_5515998038637/);
assert.doesNotMatch(runner, /deleteMany|updateMany|bulkWrite/);

assert.match(wrapper, /current_before="\$\(current_target\)"/);
assert.match(wrapper, /assert_main_unchanged/);
assert.match(wrapper, /pm2 delete "\$process_web"/);
assert.match(wrapper, /ecosystem\.v167b-authorized-web\.config\.cjs/);
assert.match(wrapper, /ecosystem\.v164-web-shadow\.config\.cjs/);
assert.match(wrapper, /trap - ERR[\s\S]*for _ in \$\(seq 1 45\)/);
assert.match(wrapper, /if \[\[ -z "\$identity" \]\]; then[\s\S]*rollback_on_error/);
assert.doesNotMatch(wrapper, /pm2 restart "\$process_main"|systemctl restart|ln -sfn/);

assert.match(docs, /Z-API continua online/);
assert.match(docs, /clientes gerais continuam inelegíveis para Web/);
assert.match(docs, /não existe retry automático/i);

process.stdout.write('V167B_AUTHORIZED_WEB_CANARY_GUARD=PASS\n');
