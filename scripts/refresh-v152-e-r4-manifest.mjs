import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const manifestRelative = 'docs/freeze/ec-whatsapp-persistent-shadow-worker-v152-e-r4-20260912.json';
const parentCommit = '33e4e69aace895dc2fe4f16f5856d1c824c96900';
const functionalCommit = String(process.env.V152_E_R4_FUNCTIONAL_COMMIT || '').trim();
if (!/^[0-9a-f]{40}$/.test(functionalCommit)) throw new Error('V152_E_R4_FUNCTIONAL_COMMIT_REQUIRED');
const functionalFiles = Object.freeze([
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'docs/WHATSAPP_PERSISTENT_SHADOW_WORKER_FREEZE_V152_E_R4_20260912.md',
    'ops/ecosystem.v152-e-r4.config.cjs',
    'package.json',
    'public/qr.html',
    'scripts/fixtures/v152-e-r4-shadow-worker-child.mjs',
    'scripts/guard-v152-e-r4-persistent-shadow-worker.mjs',
    'scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs',
    'scripts/lib/ec-runtime-successor-v152-e-r1-context.mjs',
    'scripts/lib/ec-runtime-successor-v152-e-r2-context.mjs',
    'scripts/lib/ec-runtime-successor-v152-e-r3-context.mjs',
    'scripts/lib/ec-runtime-successor-v152-e-context.mjs',
    'scripts/refresh-v152-e-r4-manifest.mjs',
    'scripts/test-v152-e-r4-supervisor-restart.mjs',
    'scripts/v152-e-r4-persistent-shadow-worker.mjs',
    'src/routes/whatsapp.js',
    'src/whatsapp/core/ChannelRegistry.js',
    'src/whatsapp/core/PersistentShadowWorkerV152ER4.js',
    'tests/v152-e-r4-connections-panel.test.mjs',
    'tests/v152-e-r4-persistent-shadow-worker.test.mjs'
].sort());

execFileSync('git', ['merge-base', '--is-ancestor', parentCommit, 'HEAD'], { cwd: root });
execFileSync('git', ['merge-base', '--is-ancestor', functionalCommit, 'HEAD'], { cwd: root });
const functionalDiff = execFileSync('git', ['diff', '--name-only', parentCommit, functionalCommit], { cwd: root, encoding: 'utf8' });
const filesAtFunctionalCommit = functionalDiff.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).sort();
const expected = [...functionalFiles].sort();
if (JSON.stringify(filesAtFunctionalCommit) !== JSON.stringify(expected)) {
    throw new Error(`V152_E_R4_FUNCTIONAL_FILESET_MISMATCH expected=${expected.length} actual=${filesAtFunctionalCommit.length}`);
}
const working = execFileSync('git', ['ls-files', '--modified', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
const committed = execFileSync('git', ['diff', '--name-only', parentCommit, 'HEAD'], { cwd: root, encoding: 'utf8' });
const files = [...new Set(`${committed}\n${working}`.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))]
    .filter((item) => item !== manifestRelative)
    .sort();
for (const file of functionalFiles) {
    if (!files.includes(file)) throw new Error(`V152_E_R4_PROTECTED_FILE_MISSING ${file}`);
}
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
    freezeId: 'EC_WHATSAPP_PERSISTENT_SHADOW_WORKER_V152_E_R4_20260912',
    parentCommit,
    parentTree: execFileSync('git', ['rev-parse', `${parentCommit}^{tree}`], { cwd: root, encoding: 'utf8' }).trim(),
    functionalCommit,
    functionalTree: execFileSync('git', ['rev-parse', `${functionalCommit}^{tree}`], { cwd: root, encoding: 'utf8' }).trim(),
    functionalHash,
    candidateTag: 'candidate-v152-e-r4-persistent-shadow-worker-20260912',
    freezeTag: 'freeze-candidate-v152-e-r4-persistent-shadow-worker-20260912',
    policy: {
        phase: 'V152-E-R4_PERSISTENT_SHADOW_WORKER',
        baseCommit: parentCommit,
        baileysVersion: '6.7.24',
        processName: 'vitalismen-whatsapp-web-shadow-v152-e-r4',
        supervisor: 'PM2_FORK_SINGLE_INSTANCE',
        sessionStorage: '/var/lib/vitalismen-whatsapp-web-sessions/V152_TEST_WEB_01',
        stateStorage: '/var/lib/vitalismen-whatsapp-web-shadow-state/V152_TEST_WEB_01/health.json',
        testChannelPhone: '5531983002800',
        channelId: 'V152_TEST_WEB_01',
        sessionNamespace: 'V152_TEST_WEB_01',
        productionPhone: '5531971862958',
        productionProvider: 'ZAPI',
        shadow: true,
        draining: true,
        weight: 0,
        capacity: 0,
        singleSocket: true,
        boundedReconnect: true,
        terminalDisconnectFailClosed: true,
        customerInboundRouting: false,
        outboundQueueConsumption: false,
        customerRouting: false,
        handoff: false,
        failover: false,
        zapiShutdown: false,
        cutover: false,
        qrGenerated: false,
        pairingCodeRequests: 0,
        pairingRequests: 0,
        newApprovalRequiredBeforePairing: true,
        newApprovalRequiredBeforeCutover: true
    },
    overrides: files,
    protectedFiles: Object.fromEntries(files.map((file) => [file, sha256(file)]))
};
fs.mkdirSync(path.dirname(path.join(root, manifestRelative)), { recursive: true });
fs.writeFileSync(path.join(root, manifestRelative), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`V152_E_R4_MANIFEST_REFRESHED=YES files=${files.length} functionalHash=${functionalHash}\n`);
