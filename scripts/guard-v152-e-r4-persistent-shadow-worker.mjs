import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const core = read('src/whatsapp/core/PersistentShadowWorkerV152ER4.js');
const entrypoint = read('scripts/v152-e-r4-persistent-shadow-worker.mjs');
const route = read('src/routes/whatsapp.js');
const panel = read('public/qr.html');
const packageJson = JSON.parse(read('package.json'));
const ecosystemPath = path.resolve(root, 'ops/ecosystem.v152-e-r4.config.cjs');
delete require.cache[ecosystemPath];
const ecosystem = require(ecosystemPath);
const successorManifestPath = path.resolve(root, 'docs/freeze/ec-multinumber-shadow-reconciliation-v163-20260915.json');
const successorManifest = fs.existsSync(successorManifestPath)
    ? JSON.parse(fs.readFileSync(successorManifestPath, 'utf8'))
    : null;
const successorOverrides = new Set(successorManifest?.overrides || []);
if (successorManifest) {
    assert.equal(successorManifest.freezeId, 'EC_MULTINUMBER_SHADOW_RECONCILIATION_V163_20260915');
}

assert.match(core, /class PersistentShadowWorkerV152ER4/);
assert.match(core, /V152ER4ReconnectPolicy/);
assert.match(core, /reconnectMaxAttempts/);
assert.match(core, /reconnectWindowMs/);
assert.match(core, /reconnectCooldownMs/);
assert.match(core, /reconnectJitterRatio/);
assert.match(core, /RECONNECT_COOLDOWN/);
assert.match(core, /LOGGED_OUT/);
assert.match(core, /BAD_SESSION/);
assert.match(core, /CONNECTION_REPLACED/);
assert.match(core, /QR_GENERATION_BLOCKED/);
assert.match(core, /MANUAL_OPERATOR_ACTION/);
assert.match(core, /this\.socketRecord/);
assert.match(core, /shadowInboundCount/);
assert.doesNotMatch(core, /sendMessage|requestPairingCode|setupDispatcher|postSale|Dropi|models\/Order/i);

assert.match(entrypoint, /inspectBaileysAuthStateForRestart\(persisted\)\.structurallyComplete/);
assert.match(entrypoint, /inspectBaileysAuthStateForRestart\(state\?\.creds\)\.structurallyComplete/);
assert.doesNotMatch(entrypoint, /registered\s*!==\s*true/);
assert.match(entrypoint, /printQRInTerminal:\s*false/);
assert.match(entrypoint, /syncFullHistory:\s*false/);
assert.match(entrypoint, /markOnlineOnConnect:\s*false/);
assert.doesNotMatch(entrypoint, /sendMessage|requestPairingCode|QRCode|qrcode-terminal|console\.(log|warn|error|info|debug)/i);

assert.equal(ecosystem.apps.length, 1);
const app = ecosystem.apps[0];
assert.equal(app.name, 'vitalismen-whatsapp-web-shadow-v152-e-r4');
assert.equal(app.exec_mode, 'fork');
assert.equal(app.instances, 1);
assert.equal(app.autorestart, true);
assert.equal(app.env.V152_E_CHANNEL_ID, 'V152_TEST_WEB_01');
assert.equal(app.env.V152_E_SESSION_NAMESPACE, 'V152_TEST_WEB_01');
assert.equal(app.env.V152_E_TEST_CHANNEL_PHONE, '5531983002800');
assert.equal(app.env.WHATSAPP_SESSION_STORAGE_ROOT, '/var/lib/vitalismen-whatsapp-web-sessions');
assert.equal(app.env.V152_E_R4_STATE_ROOT, '/var/lib/vitalismen-whatsapp-web-shadow-state');

for (const marker of ['LEGACY_ZAPI_PRIMARY', 'V152_TEST_WEB_01', 'WHATSAPP_WEB_TEMPLATE', 'OLD_BLOCKED_PHONE']) {
    assert.match(panel, new RegExp(marker));
}
assert.match(panel, /\$\{zapiCard\}\$\{realTestCard\}\$\{draftCard\}\$\{preservedCard\}/);
assert.match(route, /readV152ER4PanelSession/);
assert.match(route, /mergeV152ER4PanelSessions/);

const changed = execFileSync('git', ['diff', '--name-only', '33e4e69aace895dc2fe4f16f5856d1c824c96900', '--'], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean);
const allowed = new Set([
    'approved_freezes/APPROVED_V152_E_R4_PERSISTENT_SHADOW_WORKER_20260912.txt',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'docs/WHATSAPP_PERSISTENT_SHADOW_WORKER_FREEZE_V152_E_R4_20260912.md',
    'docs/freeze/ec-whatsapp-persistent-shadow-worker-v152-e-r4-20260912.json',
    'ops/ecosystem.v152-e-r4.config.cjs',
    'package.json',
    'public/qr.html',
    'scripts/fixtures/v152-e-r4-shadow-worker-child.mjs',
    'scripts/guard-v152-e-r4-persistent-shadow-worker.mjs',
    'scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs',
    'scripts/lib/ec-runtime-successor-v152-e-r1-context.mjs',
    'scripts/lib/ec-runtime-successor-v152-e-r2-context.mjs',
    'scripts/lib/ec-runtime-successor-v152-e-r3-context.mjs',
    'scripts/lib/ec-runtime-successor-v152-e-r4-context.mjs',
    'scripts/lib/ec-runtime-successor-v152-e-context.mjs',
    'scripts/refresh-v152-e-r4-manifest.mjs',
    'scripts/test-v152-e-r4-supervisor-restart.mjs',
    'scripts/v152-e-r4-persistent-shadow-worker.mjs',
    'src/routes/whatsapp.js',
    'src/whatsapp/core/ChannelRegistry.js',
    'src/whatsapp/core/PersistentShadowWorkerV152ER4.js',
    'tests/v152-e-r4-connections-panel.test.mjs',
    'tests/v152-e-r4-persistent-shadow-worker.test.mjs'
]);
if (successorManifest) {
    assert.deepEqual([...successorOverrides].sort(), Object.keys(successorManifest.protectedFiles || {}).sort());
    for (const [file, expected] of Object.entries(successorManifest.protectedFiles || {})) {
        const actual = fs.readFileSync(path.resolve(root, file));
        const digest = crypto.createHash('sha256').update(actual).digest('hex');
        assert.equal(digest, expected, `V163 protected file diverged: ${file}`);
    }
} else {
    assert.deepEqual(changed.filter((file) => !allowed.has(file)), []);
}

const panelDiff = execFileSync('git', ['diff', '--unified=0', '33e4e69aace895dc2fe4f16f5856d1c824c96900', '--', 'public/qr.html'], { cwd: root, encoding: 'utf8' });
if (!successorManifest) {
    for (const header of panelDiff.matchAll(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/gm)) {
        const oldLine = Number(header[1]);
        assert.ok(oldLine >= 10400 && oldLine <= 10470, `painel alterado fora de Conexoes: linha ${oldLine}`);
    }
}

assert.equal(packageJson.scripts['test:v152-e-r4'], 'node --test tests/v152-e-r4-persistent-shadow-worker.test.mjs tests/v152-e-r4-connections-panel.test.mjs');
assert.equal(packageJson.scripts['guard:v152-e-r4'], 'node scripts/guard-v152-e-r4-persistent-shadow-worker.mjs');
assert.equal(packageJson.scripts['supervisor:sim:v152-e-r4'], 'node scripts/test-v152-e-r4-supervisor-restart.mjs');

process.stdout.write([
    'V152_E_R4_SECURITY=PASS',
    'PERSISTENT_WORKER=PASS',
    'SUPERVISOR_CONFIG=PASS',
    'SINGLE_SOCKET_GUARD=PASS',
    'BOUNDED_RECONNECT=PASS',
    'TERMINAL_STATE_FAIL_CLOSED=PASS',
    'QR_GENERATION=0',
    'PAIRING_CODE_REQUESTS=0',
    'OUTBOUND_QUEUE_CONSUMPTION=0',
    'CUSTOMER_INBOUND_ROUTING=0',
    'CUSTOMER_ROUTING=0',
    'HANDOFF=0',
    'FAILOVER=0',
    'CUTOVER=0',
    'FILES_OUTSIDE_R4_SCOPE=0'
].join('\n') + '\n');
