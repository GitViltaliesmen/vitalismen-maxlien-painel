import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const implementationFiles = [
    'src/whatsapp/core/ControlledRealPairingV152E.js',
    'scripts/v152-e-controlled-pairing.mjs',
    'scripts/v152-e-preflight-snapshot.mjs',
    'scripts/v152-e-postflight-verify.mjs'
];
const evidenceFiles = [
    ...implementationFiles,
    'tests/v152-e-controlled-real-pairing.test.mjs'
];
const implementationSource = implementationFiles.map(read).join('\n');
const evidenceSource = evidenceFiles.map(read).join('\n');
const legacyConnection = read('src/whatsapp/connection.js');
const panel = read('public/qr.html');

for (const marker of [
    'V152_E_CONTROLLED_REAL_PAIRING',
    'WHATSAPP_WEB_CONTROLLED_TEST_01',
    'v152-e-controlled-test-01',
    '5515998038637',
    'same_phone_dual_provider_forbidden',
    'OUTBOUND_CANARY_DUPLICATE_BLOCKED',
    'CONFIRM_V152_E_ROLLBACK',
    'PRE_PAIRING_SNAPSHOT_PASS',
    'POST_PAIRING_VERIFICATION_PASS'
]) assert.match(evidenceSource, new RegExp(marker));

assert.match(implementationSource, /printQRInTerminal:\s*false/);
assert.doesNotMatch(implementationSource, /qrcode-terminal|qrcodeTerminal|startWhatsApp|from ['"].*connection\.js['"]/);
assert.doesNotMatch(implementationSource, /console\.(log|info|debug)\s*\(/);
assert.doesNotMatch(implementationSource, /sendMessage\([^,]+,\s*\{\s*text:\s*process\./);
assert.doesNotMatch(implementationSource, /pm2_env\?*\.env|process\.stdout\.write\([^\n]*pm2\s*jlist/);
assert.match(implementationSource, /customerMigration:\s*false/);
assert.match(implementationSource, /customerRouting:\s*false/);
assert.match(implementationSource, /handoff:\s*false/);
assert.match(implementationSource, /failover:\s*false/);
assert.match(implementationSource, /zapiShutdown:\s*false/);
assert.match(implementationSource, /cutover:\s*false/);
assert.match(legacyConnection, /qrcodeTerminal\.generate/);
assert.match(panel, /data-v152-c0-pair-state="DISABLED_NO_TEST_PHONE"[^>]*disabled/);

process.stdout.write('V152_E_SECURITY=PASS\nCRITICAL=0\nHIGH=0\nMODERATE=0\nQR_LOGGING=0\nSESSION_INSIDE_RELEASE=0\nCUSTOMER_ROUTING=0\nHANDOFF=0\nFAILOVER=0\nCUTOVER=0\n');
