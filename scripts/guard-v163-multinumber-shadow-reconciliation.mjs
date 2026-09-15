import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(relative))).digest('hex');
const manifestText = read('docs/freeze/ec-multinumber-shadow-reconciliation-v163-20260915.json');
const manifest = JSON.parse(manifestText);

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_MULTINUMBER_SHADOW_RECONCILIATION_V163_20260915');
assert.equal(manifest.version, 163);
assert.equal(manifest.parentCommit, 'ecf9ab51c7f65dba00f27a8b9d4d9ffb901639f3');
assert.equal(manifest.parentTree, 'a8d48bde705ae669aeea9ac7dad1d46d9f8a0763');
assert.equal(manifest.sourceCommit, 'f5b84c4003279d07ca6c481ea54fb61f899bdeb6');
assert.equal(manifest.sourceTree, '6b5f06f21738aadb16902e62c41d6086d98a6aa2');
assert.equal(hash(manifest.parentManifest), manifest.parentManifestSha256);
assert.equal(hash(manifest.sourceManifest), manifest.sourceManifestSha256);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
for (const [relative, expected] of Object.entries(manifest.protectedFiles)) {
    assert.equal(hash(relative), expected, `V163 protected file diverged: ${relative}`);
}

const policy = manifest.policy;
for (const [key, expected] of Object.entries({
    workspaceOnly: true,
    productionChanged: false,
    deploymentExecuted: false,
    restartExecuted: false,
    pairingExecuted: false,
    newPairingRequired: false,
    webWorkerActivationExecuted: false,
    webWorkerShadow: true,
    webWorkerDraining: true,
    webWorkerWeight: 0,
    webWorkerCapacity: 0,
    customerInboundRouting: false,
    outboundQueueConsumption: false,
    customerRouting: false,
    handoff: false,
    failover: false,
    cutover: false,
    zapiProductionProviderPreserved: true,
    zapiShutdownExecuted: false,
    zapiRemovalExecuted: false,
    existingSessionOutboundAuthorized: false,
    cutoverRequiresShadowCanary: true,
    cutoverRequiresSeparateOperatorAuthorization: true
})) assert.equal(policy[key], expected, key);

assert.equal(globalThis.__VITALISMEN_V162_CONTEXT?.loaded, true);
assert.equal(globalThis.__VITALISMEN_V152_E_R4_CONTEXT?.loaded, true);
assert.equal(globalThis.__VITALISMEN_V163_CONTEXT?.loaded, true);

const core = read('src/whatsapp/core/PersistentShadowWorkerV152ER4.js');
const entrypoint = read('scripts/v152-e-r4-persistent-shadow-worker.mjs');
const registry = read('src/whatsapp/core/ChannelRegistry.js');
const route = read('src/routes/whatsapp.js');
const panel = read('public/qr.html');
assert.doesNotMatch(core, /sendMessage|requestPairingCode|setupDispatcher|models\/Order/i);
assert.doesNotMatch(entrypoint, /sendMessage|requestPairingCode|QRCode|qrcode-terminal/i);
assert.match(entrypoint, /printQRInTerminal:\s*false/);
assert.match(registry, /channelId:\s*'LEGACY_ZAPI_PRIMARY'/);
assert.match(registry, /status:\s*'ACTIVE'/);
assert.match(registry, /channelId:\s*'V152_TEST_WEB_01'/);
assert.match(route, /mergeV152ER4PanelSessions/);
assert.match(panel, /data-v152-e-r4-channel="V152_TEST_WEB_01"/);

process.stdout.write([
    'V163_PARENT_V162=PASS',
    'V163_SOURCE_R4=PASS',
    'MULTINUMBER_CODE_RECONCILED=YES',
    'WEB_WORKER_ACTIVATED=NO',
    'NEW_PAIRING_REQUIRED=NO',
    'OUTBOUND_QUEUE_CONSUMPTION=0',
    'CUSTOMER_INBOUND_ROUTING=0',
    'ZAPI_PRODUCTION_PROVIDER_PRESERVED=YES',
    'ZAPI_SHUTDOWN_EXECUTED=NO',
    'PRODUCTION_CHANGED=NO',
    'V163_MULTINUMBER_SHADOW_RECONCILIATION=PASS'
].join('\n') + '\n');
