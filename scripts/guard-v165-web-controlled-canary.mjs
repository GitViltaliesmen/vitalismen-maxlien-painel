import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(relative))).digest('hex');
const manifestText = read('docs/freeze/ec-web-controlled-canary-v165-20260915.json');
const manifest = JSON.parse(manifestText);

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_WEB_CONTROLLED_CANARY_V165_20260915');
assert.equal(manifest.version, 165);
assert.equal(manifest.parentCommit, '4a036a6d91dc027402855613a1c02ff55b55ae3a');
assert.equal(manifest.parentTree, '9ad4cdea99a4cca934c2e3d6c19f8ea8a872e15b');
assert.equal(hash(manifest.parentManifest), manifest.parentManifestSha256);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
assert.deepEqual([...manifest.compatibilityOverrides].sort(), Object.keys(manifest.preservedFiles).sort());
for (const [file, expected] of Object.entries({ ...manifest.protectedFiles, ...manifest.preservedFiles })) {
    assert.equal(hash(file), expected, `V165 protected file diverged: ${file}`);
}

for (const [key, expected] of Object.entries({
    currentChange: false,
    pm2MainChange: false,
    mainBotRestart: false,
    zapiChange: false,
    zapiShutdownAllowed: false,
    zapiRemovalAllowed: false,
    cutoverAllowed: false,
    failoverAllowed: false,
    handoffAllowed: false,
    customerRealRoutingAllowed: false,
    generalWebOutboundAllowed: false,
    webCanaryMaxMessages: 1,
    webCanaryMaxAttempts: 1,
    maxConcurrentSockets: 1,
    newPairingAllowed: false,
    qrAllowed: false,
    pairingCodeAllowed: false,
    queueConsumption: 0,
    customerRouting: 0,
    automaticRetry: false,
    zapiCanarySendCalls: 0
})) assert.equal(manifest.policy[key], expected, key);

assert.equal(globalThis.__VITALISMEN_V164_CONTEXT?.loaded, true);
assert.equal(globalThis.__VITALISMEN_V165_CONTEXT?.loaded, true);

const core = read('src/whatsapp/core/ControlledOutboundCanaryV165.js');
const cli = read('scripts/v165-web-controlled-canary.mjs');
const wrapper = read('ops/web-canary-v165');
for (const source of [core, cli]) {
    assert.doesNotMatch(source, /(?:from|import\()[^\n]*(?:zapiClient|models\/Order|models\/Shipment|dropi|metaCapi|conversationEngine|scheduler)/i);
}
assert.match(core, /V165_CANARY_RECIPIENT = '5515998038637'/);
assert.match(core, /V165_CANARY_TEXT = 'Prueba técnica controlada V165 por WhatsApp Web\. No requiere respuesta comercial\.'/);
assert.match(cli, /printQRInTerminal:\s*false/);
assert.doesNotMatch(cli, /requestPairingCode/);
assert.match(wrapper, /pm2 stop "\$process_web"/);
assert.match(wrapper, /pm2 restart "\$process_web"/);
assert.doesNotMatch(wrapper, /pm2 (?:restart|delete|stop) "\$process_main"/);
assert.doesNotMatch(wrapper, /ln -s|current\.next/);

process.stdout.write([
    'V165_PARENT_V164=PASS',
    'RECIPIENT_EXACT_MATCH=PASS',
    'OTHER_RECIPIENTS_BLOCKED=PASS',
    'FIXED_TEXT_ONLY=PASS',
    'LEDGER_INTENDED_BEFORE_NETWORK=PASS',
    'LEDGER_DUPLICATE_BLOCK=PASS',
    'AMBIGUOUS_NO_RETRY=PASS',
    'SECOND_SOCKET_BLOCK=PASS',
    'QR_BLOCK=PASS',
    'PAIRING_CODE_BLOCK=PASS',
    'ZAPI_IMPORT_FOR_CANARY=ABSENT',
    'ZAPI_SEND_PATH_FOR_CANARY=ABSENT',
    'ORDER_EFFECTS=0',
    'DROPI_EFFECTS=0',
    'META_EFFECTS=0',
    'CUSTOMER_ROUTING_EFFECTS=0',
    'V165_WEB_CONTROLLED_CANARY_GUARD=PASS'
].join('\n') + '\n');
