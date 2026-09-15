import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const parentCommit = 'ecf9ab51c7f65dba00f27a8b9d4d9ffb901639f3';
const sourceCommit = 'f5b84c4003279d07ca6c481ea54fb61f899bdeb6';
const manifestRelative = 'docs/freeze/ec-multinumber-shadow-reconciliation-v163-20260915.json';
const parentManifest = 'docs/freeze/ec-buy-later-operational-v162-20260915.json';
const sourceManifest = 'docs/freeze/ec-whatsapp-persistent-shadow-worker-v152-e-r4-20260912.json';
const requiredFiles = [
    'docs/MULTINUMBER_SHADOW_RECONCILIATION_V163_20260915.md',
    'ops/ecosystem.v152-e-r4.config.cjs',
    'public/qr.html',
    'scripts/guard-v163-multinumber-shadow-reconciliation.mjs',
    'scripts/lib/ec-runtime-successor-v163-multinumber-context.mjs',
    'scripts/lib/ec-runtime-successor-v163-multinumber-overrides-context.mjs',
    'scripts/v152-e-r4-persistent-shadow-worker.mjs',
    'src/routes/whatsapp.js',
    'src/whatsapp/core/ChannelRegistry.js',
    'src/whatsapp/core/PersistentShadowWorkerV152ER4.js',
    'tests/v163-multinumber-shadow-reconciliation.test.mjs'
];

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const lines = (value) => String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const changed = lines(git('diff', '--name-only', parentCommit, '--'));
const untracked = lines(git('ls-files', '--others', '--exclude-standard'));
const files = [...new Set([...changed, ...untracked])]
    .filter((file) => file !== manifestRelative)
    .sort();

for (const file of requiredFiles) {
    if (!files.includes(file)) throw new Error(`V163_REQUIRED_FILE_MISSING ${file}`);
}

const sha256 = (relative) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relative)))
    .digest('hex');
const parentManifestSha256 = sha256(parentManifest);
const sourceManifestSha256 = sha256(sourceManifest);

const manifest = {
    freezeId: 'EC_MULTINUMBER_SHADOW_RECONCILIATION_V163_20260915',
    version: 163,
    parentCommit,
    parentTree: git('rev-parse', `${parentCommit}^{tree}`),
    parentTag: 'production-20260915-ecf9ab5',
    parentManifest,
    parentManifestSha256,
    sourceCommit,
    sourceTree: git('rev-parse', `${sourceCommit}^{tree}`),
    sourceTag: 'production-20260913-f5b84c4',
    sourceManifest,
    sourceManifestSha256,
    overrides: files,
    protectedFiles: Object.fromEntries(files.map((file) => [file, sha256(file)])),
    policy: {
        phase: 'V163_MULTINUMBER_SHADOW_RECONCILIATION',
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
        existingSessionPhone: '5531983002800',
        existingSessionOutboundAuthorized: false,
        authorizedControlledTestPhone: '5515998038637',
        cutoverRequiresShadowCanary: true,
        cutoverRequiresSeparateOperatorAuthorization: true
    }
};

fs.mkdirSync(path.dirname(path.join(root, manifestRelative)), { recursive: true });
fs.writeFileSync(path.join(root, manifestRelative), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`V163_MULTINUMBER_MANIFEST_REFRESHED=YES files=${files.length}\n`);
