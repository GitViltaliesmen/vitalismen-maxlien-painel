import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const manifestRelative = 'docs/freeze/ec-whatsapp-br-jid-auth-flush-v152-e-r3-20260912.json';
const parentCommit = '0aea21f5bf3760b09a694e4e3e6c70670cc4fc0d';
const functionalCommit = '2a52688083c079f398d4cf5c7060d99e6cf0d922';
const functionalFiles = Object.freeze([
    'package.json',
    'scripts/guard-v152-e-r3-br-jid-auth-flush.mjs',
    'scripts/v152-e-controlled-pairing.mjs',
    'scripts/v152-e-r3-partial-session-cleanup.mjs',
    'src/whatsapp/core/ControlledPairingRecoveryV152ER3.js',
    'src/whatsapp/core/ControlledRealPairingV152E.js',
    'tests/v152-e-controlled-real-pairing.test.mjs',
    'tests/v152-e-r3-recovery.test.mjs'
].sort());

execFileSync('git', ['merge-base', '--is-ancestor', parentCommit, 'HEAD'], { cwd: root });
execFileSync('git', ['merge-base', '--is-ancestor', functionalCommit, 'HEAD'], { cwd: root });
const committed = execFileSync('git', ['diff', '--name-only', parentCommit, 'HEAD'], { cwd: root, encoding: 'utf8' });
const working = execFileSync('git', ['ls-files', '--modified', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
const files = [...new Set(`${committed}\n${working}`.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))]
    .filter((item) => item !== manifestRelative)
    .filter((item) => !item.startsWith('.audit/'))
    .filter((item) => !item.startsWith('.codex-audit/'))
    .filter((item) => !item.startsWith('.wt-v126/'))
    .filter((item) => !item.startsWith('docs/evidence/'))
    .sort();
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const functionalHash = (() => {
    const hash = crypto.createHash('sha256');
    for (const file of functionalFiles) {
        hash.update(file);
        hash.update('\0');
        hash.update(fs.readFileSync(path.join(root, file)));
        hash.update('\0');
    }
    return hash.digest('hex');
})();
const manifest = {
    freezeId: 'EC_WHATSAPP_BR_JID_AUTH_FLUSH_V152_E_R3_20260912',
    parentCommit,
    parentTree: execFileSync('git', ['rev-parse', `${parentCommit}^{tree}`], { cwd: root, encoding: 'utf8' }).trim(),
    functionalCommit,
    functionalTree: execFileSync('git', ['rev-parse', `${functionalCommit}^{tree}`], { cwd: root, encoding: 'utf8' }).trim(),
    functionalHash,
    candidateTag: 'candidate-v152-e-r3-br-jid-auth-flush-20260912',
    freezeTag: 'freeze-candidate-v152-e-r3-br-jid-auth-flush-20260912',
    policy: {
        phase: 'V152-E-R3_BR_JID_NORMALIZATION_AND_AUTH_FLUSH_GATE',
        predecessorPatch: 'V152-E-R2_NATIVE_PAIRING_CODE',
        baileysVersion: '6.7.24',
        phoneNormalization: 'AUTHENTICATED_PROVIDER_EVIDENCE_ONLY',
        restartRequired515Gate: 'AUTH_FLUSH_EVENT_GATE',
        saveCredsEventGate: true,
        pendingAuthWritesGate: true,
        keyStoreRequiredAt515: false,
        keyStoreRequiredBeforeRestart: false,
        testChannelPhone: '5531983002800',
        channelId: 'V152_TEST_WEB_01',
        sessionNamespace: 'V152_TEST_WEB_01',
        invalidPartialSessionPath: '/var/lib/vitalismen-whatsapp-web-sessions/V152_TEST_WEB_01',
        invalidPartialSessionReusable: false,
        productionPhone: '5531971862958',
        productionProvider: 'ZAPI',
        shadow: true,
        draining: true,
        weight: 0,
        capacity: 0,
        customerRouting: false,
        handoff: false,
        failover: false,
        zapiShutdown: false,
        cutover: false,
        qrGenerated: false,
        pairingRequests: 0,
        whatsappWebProviderCalls: 0,
        newApprovalRequiredBeforeQr: true
    },
    overrides: files,
    protectedFiles: Object.fromEntries(files.map((file) => [file, sha256(file)]))
};
fs.mkdirSync(path.dirname(path.join(root, manifestRelative)), { recursive: true });
fs.writeFileSync(path.join(root, manifestRelative), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`V152_E_R3_MANIFEST_REFRESHED=YES files=${files.length} functionalHash=${functionalHash}\n`);
