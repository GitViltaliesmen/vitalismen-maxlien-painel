import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const parentCommit = '4a036a6d91dc027402855613a1c02ff55b55ae3a';
const manifestRelative = 'docs/freeze/ec-web-controlled-canary-v165-20260915.json';
const parentManifest = 'docs/freeze/ec-web-worker-shadow-activation-v164-20260915.json';
const parent = JSON.parse(fs.readFileSync(path.join(root, parentManifest), 'utf8'));
const compatibilityOverrides = [...new Set([
    ...(parent.compatibilityOverrides || []),
    ...Object.keys(parent.protectedFiles || {}).filter((file) => ![
        'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
        'docs/ARQUIVOS_OFICIAIS.md',
        'package.json',
        'scripts/guard-v163-multinumber-shadow-reconciliation.mjs',
        'scripts/guard-v164-web-shadow-activation.mjs',
        'scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs',
        'scripts/lib/ec-runtime-successor-v164-web-shadow-context.mjs',
        'scripts/lib/ec-runtime-successor-v164-web-shadow-overrides-context.mjs'
    ].includes(file))
])].sort();
const requiredFiles = [
    'docs/WEB_CONTROLLED_CANARY_V165_20260915.md',
    'ops/web-canary-v165',
    'scripts/guard-v165-web-controlled-canary.mjs',
    'scripts/lib/ec-runtime-successor-v165-web-canary-context.mjs',
    'scripts/lib/ec-runtime-successor-v165-web-canary-overrides-context.mjs',
    'scripts/v165-operational-health-check.mjs',
    'scripts/v165-web-controlled-canary.mjs',
    'src/whatsapp/core/ControlledOutboundCanaryV165.js',
    'tests/v165-web-controlled-canary.test.mjs'
];

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const lines = (value) => String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const files = [...new Set([
    ...lines(git('diff', '--name-only', parentCommit, '--')),
    ...lines(git('ls-files', '--others', '--exclude-standard'))
])].filter((file) => file !== manifestRelative).sort();
for (const file of requiredFiles) {
    if (!files.includes(file)) throw new Error(`V165_REQUIRED_FILE_MISSING ${file}`);
}

const sha256 = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
const manifest = {
    freezeId: 'EC_WEB_CONTROLLED_CANARY_V165_20260915',
    version: 165,
    purpose: 'CONTROLLED_WEB_OUTBOUND_CANARY',
    parentCommit,
    parentTree: git('rev-parse', `${parentCommit}^{tree}`),
    parentManifest,
    parentManifestSha256: sha256(parentManifest),
    overrides: files,
    protectedFiles: Object.fromEntries(files.map((file) => [file, sha256(file)])),
    compatibilityOverrides,
    preservedFiles: Object.fromEntries(compatibilityOverrides.map((file) => [file, sha256(file)])),
    policy: {
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
        provider: 'WHATSAPP_WEB',
        authorizedControlledTestPhone: '5515998038637',
        pairedIdentity: '5531983002800',
        sessionNamespace: 'V152_TEST_WEB_01',
        ledgerDirectory: '/var/lib/vitalismen-whatsapp-web-canary-v165',
        webCanaryMaxMessages: 1,
        webCanaryMaxAttempts: 1,
        maxConcurrentSockets: 1,
        newPairingAllowed: false,
        qrAllowed: false,
        pairingCodeAllowed: false,
        queueConsumption: 0,
        customerRouting: 0,
        automaticRetry: false,
        zapiCanarySendCalls: 0,
        v47GuardChanged: false,
        v47WorkflowChanged: false
    }
};

fs.mkdirSync(path.dirname(path.join(root, manifestRelative)), { recursive: true });
fs.writeFileSync(path.join(root, manifestRelative), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`V165_WEB_CANARY_MANIFEST_REFRESHED=YES files=${files.length}\n`);
