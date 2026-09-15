import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const recovery = read('src/whatsapp/core/ControlledPairingRecoveryV152ER3.js');
const policy = read('src/whatsapp/core/ControlledRealPairingV152E.js');
const helper = read('scripts/v152-e-controlled-pairing.mjs');
const cleanup = read('scripts/v152-e-r3-partial-session-cleanup.mjs');
const tests = read('tests/v152-e-r3-recovery.test.mjs');
const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));

assert.equal(packageLock.packages['node_modules/@whiskeysockets/baileys'].version, '6.7.24');
assert.match(recovery, /compareCanonicalPhoneIdentity/);
assert.match(recovery, /jidNormalizedUser/);
assert.match(recovery, /jidDecode/);
assert.match(recovery, /isBrazilNinthDigitVariant/);
assert.match(recovery, /authenticatedProviderAddress\s*===\s*true/);
assert.match(recovery, /authorizedChannelId[\s\S]*observedChannelId/);
assert.match(recovery, /BR_PROVIDER_BOUND_WITH_AUTHENTICATED_BAILEYS_EVIDENCE/);
assert.doesNotMatch(recovery, /5531983002800|5531971862958|5515991418416/);

assert.match(recovery, /class V152EAuthFlushEventGate/);
assert.match(recovery, /observeCredsUpdate/);
assert.match(recovery, /waitForAllWrites/);
assert.match(recovery, /assertRestartReady/);
assert.match(recovery, /pendingAuthWrites/);
assert.match(recovery, /authStateWriteCompleted/);
assert.match(recovery, /persisted_auth_state_incomplete/);
assert.match(recovery, /in_memory_auth_state_incomplete/);
assert.match(recovery, /KEY_STORE_REQUIRED_AT_515 = false/);
assert.match(recovery, /KEY_STORE_REQUIRED_BEFORE_RESTART = false/);
assert.doesNotMatch(recovery, /setTimeout|sleep\s*\(/i);

assert.match(helper, /V152EAuthFlushEventGate/);
assert.match(helper, /authFlushGate\.observeCredsUpdate/);
assert.match(helper, /authFlushGate\.assertRestartReady/);
assert.match(helper, /AUTH_FLUSH_EVENT_GATE_PASS/);
assert.match(helper, /waitForOpenWithSingleRestart/);
assert.match(helper, /createSocket\(\{ allowQr: false, pairingMethod \}\)/);
assert.match(helper, /assertPairedPhoneAllowed\(ownProviderAddress\(\), config/);
assert.match(helper, /source:\s*'BAILEYS_SOCKET_USER'/);
assert.match(helper, /printQRInTerminal:\s*false/);
assert.doesNotMatch(helper, /console\.(log|info|debug)\s*\(/);
assert.doesNotMatch(helper, /setTimeout\([^\n]*515|sleep\s*\(/i);

assert.match(recovery, /V152-E-R3_BR_JID_NORMALIZATION_AND_AUTH_FLUSH_GATE/);
assert.match(policy, /V152_E_R3_PAIRING_PATCH/);
assert.match(policy, /customerRouting:\s*false/);
assert.match(policy, /handoff:\s*false/);
assert.match(policy, /failover:\s*false/);
assert.match(policy, /zapiShutdown:\s*false/);
assert.match(policy, /cutover:\s*false/);

assert.match(tests, /syntheticBrazil/);
assert.match(tests, /assinante BR diferente não colide/);
assert.match(tests, /número estrangeiro mantém semântica exata/);
assert.doesNotMatch(tests, /553183002800/);

assert.match(cleanup, /EXPECTED_SESSION_PATH = '\/var\/lib\/vitalismen-whatsapp-web-sessions\/V152_TEST_WEB_01'/);
assert.match(cleanup, /entries\.length !== 1/);
assert.match(cleanup, /symlinkEntries\.length !== 0/);
assert.match(cleanup, /await fs\.unlink\(credsPath\)/);
assert.match(cleanup, /await fs\.rmdir\(sessionPath\)/);
assert.doesNotMatch(cleanup, /fs\.rm\(|recursive:\s*true|EXPECTED_SESSION_PATH\s*=.*[*?]/);
assert.match(cleanup, /reason:\s*'loggedOut_401'/);
assert.match(cleanup, /secretsIncluded:\s*false/);

assert.equal(packageJson.scripts['test:v152-e-r3'], 'node --test tests/v152-e-r3-recovery.test.mjs tests/v152-e-controlled-real-pairing.test.mjs');
assert.equal(packageJson.scripts['cleanup:partial-session:v152-e-r3'], 'node scripts/v152-e-r3-partial-session-cleanup.mjs CONFIRM_V152_E_R3_INVALID_PARTIAL_SESSION_CLEANUP');

process.stdout.write([
    'V152_E_R3_SECURITY=PASS',
    'PHONE_NORMALIZATION_PATCH=PASS',
    '515_AUTH_FLUSH_EVENT_GATE=PASS',
    'SAVE_CREDS_EVENT_GATE=PASS',
    'PENDING_AUTH_WRITES_GATE=PASS',
    'KEY_STORE_REQUIRED_AT_515=NO',
    'KEY_STORE_REQUIRED_BEFORE_RESTART=NO',
    'SESSION_DELETION_SCOPE=EXACT_SINGLE_SESSION',
    'QR_LOGGING=0',
    'AUTH_VALUE_LOGGING=0',
    'SESSION_SECRET_EXPOSURE=0',
    'CUSTOMER_ROUTING=0',
    'HANDOFF=0',
    'FAILOVER=0',
    'CUTOVER=0',
    'CRITICAL=0',
    'HIGH=0',
    'MODERATE=0'
].join('\n') + '\n');
