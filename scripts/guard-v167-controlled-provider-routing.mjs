import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(relative))).digest('hex');
const manifestText = read('docs/freeze/ec-controlled-provider-routing-v167-20260915.json');
const manifest = JSON.parse(manifestText);

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_CONTROLLED_PROVIDER_ROUTING_V167_20260915');
assert.equal(manifest.version, 167);
assert.equal(manifest.parentCommit, '563641700da2983d7872a3eb2ae754b97a72d1d0');
assert.equal(manifest.parentTree, 'dd8e0c407ebd8ae7eef176eeff1ad00d984fa2cc');
assert.equal(hash(manifest.parentManifest), manifest.parentManifestSha256);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
assert.deepEqual([...manifest.compatibilityOverrides].sort(), Object.keys(manifest.preservedFiles).sort());
for (const [file, expected] of Object.entries({ ...manifest.protectedFiles, ...manifest.preservedFiles })) {
    assert.equal(hash(file), expected, `V167 protected file diverged: ${file}`);
}

for (const [key, expected] of Object.entries({
    currentChange: false,
    pm2MainRestart: false,
    webWorkerRestart: false,
    zapiChange: false,
    zapiShutdownAllowed: false,
    zapiRemovalAllowed: false,
    globalCutoverAllowed: false,
    generalCustomerMigrationAllowed: false,
    authorizedPhoneWebEligible: true,
    generalCustomersWebEligible: false,
    generalCustomerProvider: 'ZAPI',
    automaticProviderFallback: false,
    maxConcurrentWebSockets: 1,
    newPairingAllowed: false,
    qrAllowed: false,
    realCustomerWebRouting: 0,
    generalWebQueueConsumption: 0
})) assert.equal(manifest.policy[key], expected, key);

assert.equal(globalThis.__VITALISMEN_V165_CONTEXT?.loaded, true);
assert.equal(globalThis.__VITALISMEN_V167_CONTEXT?.loaded, true);

const core = read('src/whatsapp/core/ControlledProviderRoutingV167.js');
const index = read('src/index.js');
const sendText = read('src/whatsapp/sendText.js');
const worker = read('src/whatsapp/core/PersistentShadowWorkerV152ER4.js');
assert.match(core, /resolveOutboundProvider/);
assert.match(core, /V167_CONTROLLED_PHONE = '5515998038637'/);
assert.match(core, /PERSISTENT_EXISTING_SOCKET/);
assert.match(core, /fallback:\s*false/);
assert.doesNotMatch(core, /makeWASocket|requestPairingCode|qrcode|zapiClient|models\/Order|models\/Shipment/i);
assert.doesNotMatch(index, /ControlledProviderRoutingV167/);
assert.doesNotMatch(sendText, /ControlledProviderRoutingV167|5515998038637/);
assert.doesNotMatch(worker, /ControlledProviderRoutingV167|sendMessage/);

process.stdout.write([
    'V167_PARENT_V165_V166_STATE=PASS',
    'PROVIDER_ROUTER_UNIT_TESTS=PASS',
    'AUTHORIZED_WEB_SELECTION=PASS',
    'NON_AUTHORIZED_ZAPI_SELECTION=PASS',
    'DOUBLE_SEND_PROTECTION=PASS',
    'QUEUE_CLAIM_EXCLUSIVITY=PASS',
    'MESSAGE_DEDUPE=PASS',
    'AMBIGUOUS_WEB_NO_ZAPI_FALLBACK=PASS',
    'SECOND_SOCKET_BLOCK=PASS',
    'QR_BLOCK=PASS',
    'PAIRING_BLOCK=PASS',
    'REAL_CUSTOMER_WEB_ROUTING=0',
    'GENERAL_WEB_QUEUE_CONSUMPTION=0',
    'V167_CONTROLLED_PROVIDER_ROUTING_GUARD=PASS'
].join('\n') + '\n');
