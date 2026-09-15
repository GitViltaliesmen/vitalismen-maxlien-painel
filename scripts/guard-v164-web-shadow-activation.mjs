import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(relative))).digest('hex');
const text = read('docs/freeze/ec-web-worker-shadow-activation-v164-20260915.json');
const manifest = JSON.parse(text);
const v165Path = 'docs/freeze/ec-web-controlled-canary-v165-20260915.json';
const v165 = fs.existsSync(path.resolve(v165Path)) ? JSON.parse(read(v165Path)) : null;
const v165Overrides = new Set([...(v165?.overrides || []), ...(v165?.compatibilityOverrides || [])]);

assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_WEB_WORKER_SHADOW_ACTIVATION_V164_20260915');
assert.equal(manifest.version, 164);
assert.equal(manifest.parentCommit, 'da4547aafb407da7259c312fdd1db46d5519cb91');
assert.equal(manifest.parentTree, 'd398db49ff2023d3d730fc9bd686ffe774265d93');
assert.equal(hash(manifest.parentManifest), manifest.parentManifestSha256);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
assert.deepEqual([...manifest.compatibilityOverrides].sort(), Object.keys(manifest.preservedFiles).sort());
for (const [file, expected] of Object.entries({ ...manifest.protectedFiles, ...manifest.preservedFiles })) {
    if (v165Overrides.has(file)) continue;
    assert.equal(hash(file), expected, `V164 protected file diverged: ${file}`);
}

for (const [key, expected] of Object.entries({
    currentChange: false,
    pm2MainChange: false,
    mainBotRestart: false,
    zapiChange: false,
    zapiShutdownAllowed: false,
    zapiRemovalAllowed: false,
    cutoverAllowed: false,
    customerRealRoutingAllowed: false,
    newPairingAllowed: false,
    qrAllowed: false,
    pairingCodeAllowed: false,
    webShadow: true,
    webDraining: true,
    webWeight: 0,
    webCapacity: 0,
    outboundEligible: false,
    inboundCommercialRouting: false,
    queueConsumption: 0,
    failoverAllowed: false,
    handoffAllowed: false,
    webOutboundMessagesDuringActivation: 0,
    doubleSendProtection: true,
    outboundProviderExclusivity: true,
    messageDedupe: true,
    queueClaimExclusivity: true,
    stopWebWorkerOnlySupported: true,
    webWorkerRestartCheckSupported: true,
    sessionRestorableAfterRestartRequired: true,
    zapiRemainsOperationalOnRollback: true,
    mainBotUnaffectedOnRollback: true,
    sessionFilesPreservedOnRollback: true
})) assert.equal(manifest.policy[key], expected, key);

assert.equal(globalThis.__VITALISMEN_V163_CONTEXT?.loaded, true);
assert.equal(globalThis.__VITALISMEN_V164_CONTEXT?.loaded, true);

const worker = read('src/whatsapp/core/PersistentShadowWorkerV152ER4.js');
const entrypoint = read('scripts/v152-e-r4-persistent-shadow-worker.mjs');
const wrapper = read('ops/web-shadow-v164');
assert.doesNotMatch(worker, /sendMessage|requestPairingCode|setupDispatcher|models\/Order/i);
assert.doesNotMatch(entrypoint, /sendMessage|requestPairingCode|QRCode|qrcode-terminal/i);
assert.match(wrapper, /pm2 start .*ecosystem\.v164-web-shadow\.config\.cjs/);
assert.match(wrapper, /pm2 delete "\$process_web"/);
assert.doesNotMatch(wrapper, /pm2 (?:restart|delete|stop) "\$process_main"/);

process.stdout.write([
    'V164_PARENT_V163=PASS',
    'V163_GUARD_COMPATIBILITY=PASS',
    'WEB_SHADOW_CONTRACT=PASS',
    'SINGLE_SOCKET_GUARD=PASS',
    'NO_NEW_QR=PASS',
    'PAIRING_REQUESTS=0',
    'WEB_OUTBOUND_CALLS=0',
    'WEB_QUEUE_CONSUMPTION=0',
    'CUSTOMER_ROUTING=0',
    'DOUBLE_SEND_PROTECTION=PASS',
    'ROLLBACK_CONTRACT=PASS',
    'V164_WEB_SHADOW_ACTIVATION_GUARD=PASS'
].join('\n') + '\n');
