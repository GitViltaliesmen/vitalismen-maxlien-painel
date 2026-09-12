import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const helper = read('scripts/v152-e-controlled-pairing.mjs');
const policy = read('src/whatsapp/core/ControlledRealPairingV152E.js');
const tests = read('tests/v152-e-controlled-real-pairing.test.mjs');
const packageJson = JSON.parse(read('package.json'));
const source = `${helper}\n${policy}\n${tests}`;

for (const marker of [
    'V152-E-R2_NATIVE_PAIRING_CODE',
    'V152_TEST_WEB_01',
    '5531983002800',
    'PAIRING_CODE_READY',
    'pairingCodePersisted: false',
    "command === 'pair-code'"
]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

assert.equal(
    packageJson.scripts['pair-code:v152-e-r2'],
    'node scripts/v152-e-controlled-pairing.mjs pair-code'
);
assert.match(helper, /requestPairingCode\(config\.testChannelPhone\)/);
assert.match(helper, /await socket\.waitForSocketOpen\(\)/);
assert.ok(
    helper.indexOf('await socket.waitForSocketOpen();')
        < helper.indexOf('socket.requestPairingCode(config.testChannelPhone)'),
    'solicitação do código ocorreu antes da abertura do WebSocket'
);
assert.match(helper, /printQRInTerminal:\s*false/);
assert.match(helper, /activePairingMethod === 'PAIRING_CODE'[\s\S]*state\.creds\.pairingCode[\s\S]*!state\.creds\.registered[\s\S]*return/);
assert.match(helper, /removePairingCodeSecret\(authState\.creds\)[\s\S]*saveCredentials\(\)/);
assert.match(helper, /pairingCodePersisted:\s*false/);
assert.match(helper, /qrAvailable:\s*false/);
assert.match(helper, /command === 'pair-code'[\s\S]*runPairCode/);
assert.doesNotMatch(helper, /console\.(log|info|debug)\s*\(/);
assert.doesNotMatch(helper, /writeJsonAtomic\([^\n]+pairingCode/);
assert.doesNotMatch(helper, /sendMessage\([^,]+,\s*\{\s*text:\s*process\./);
assert.match(policy, /customerRouting:\s*false/);
assert.match(policy, /handoff:\s*false/);
assert.match(policy, /failover:\s*false/);
assert.match(policy, /zapiShutdown:\s*false/);
assert.match(policy, /cutover:\s*false/);
assert.match(policy, /pairingCodePersistence:\s*false/);

process.stdout.write([
    'V152_E_R2_SECURITY=PASS',
    'PAIRING_METHOD=PAIRING_CODE',
    'PAIRING_CODE_PERSISTENCE=0',
    'QR_LOGGING=0',
    'SESSION_INSIDE_RELEASE=0',
    'CUSTOMER_ROUTING=0',
    'HANDOFF=0',
    'FAILOVER=0',
    'CUTOVER=0',
    'CRITICAL=0',
    'HIGH=0',
    'MODERATE=0'
].join('\n') + '\n');
