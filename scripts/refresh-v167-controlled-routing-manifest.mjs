import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const parentCommit = '563641700da2983d7872a3eb2ae754b97a72d1d0';
const manifestRelative = 'docs/freeze/ec-controlled-provider-routing-v167-20260915.json';
const parentManifest = 'docs/freeze/ec-web-controlled-canary-v165-20260915.json';
const parent = JSON.parse(fs.readFileSync(path.join(root, parentManifest), 'utf8'));
const changedAncestors = new Set([
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md', 'docs/ARQUIVOS_OFICIAIS.md', 'package.json',
    'scripts/guard-v163-multinumber-shadow-reconciliation.mjs',
    'scripts/guard-v164-web-shadow-activation.mjs', 'scripts/guard-v165-web-controlled-canary.mjs',
    'scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs',
    'scripts/lib/ec-runtime-successor-v165-web-canary-context.mjs',
    'scripts/lib/ec-runtime-successor-v165-web-canary-overrides-context.mjs'
]);
const compatibilityOverrides = [...new Set([
    ...(parent.compatibilityOverrides || []),
    ...Object.keys(parent.protectedFiles || {}).filter((file) => !changedAncestors.has(file))
])].sort();
const requiredFiles = [
    'docs/CONTROLLED_PROVIDER_ROUTING_V167_20260915.md',
    'scripts/guard-v167-controlled-provider-routing.mjs',
    'scripts/lib/ec-runtime-successor-v167-controlled-routing-context.mjs',
    'scripts/lib/ec-runtime-successor-v167-controlled-routing-overrides-context.mjs',
    'src/whatsapp/core/ControlledProviderRoutingV167.js',
    'tests/v167-controlled-provider-routing.test.mjs'
];

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const lines = (value) => String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const files = [...new Set([
    ...lines(git('diff', '--name-only', parentCommit, '--')),
    ...lines(git('ls-files', '--others', '--exclude-standard'))
])].filter((file) => file !== manifestRelative).sort();
for (const file of requiredFiles) {
    if (!files.includes(file)) throw new Error(`V167_REQUIRED_FILE_MISSING ${file}`);
}

const sha256 = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
const manifest = {
    freezeId: 'EC_CONTROLLED_PROVIDER_ROUTING_V167_20260915',
    version: 167,
    purpose: 'CONTROLLED_PROVIDER_ROUTING_WITH_ZAPI_FALLBACK_BASELINE',
    parentCommit,
    parentTree: git('show', '-s', '--format=%T', parentCommit),
    parentManifest,
    parentManifestSha256: sha256(parentManifest),
    overrides: files,
    protectedFiles: Object.fromEntries(files.map((file) => [file, sha256(file)])),
    compatibilityOverrides,
    preservedFiles: Object.fromEntries(compatibilityOverrides.map((file) => [file, sha256(file)])),
    policy: {
        currentChange: false,
        pm2MainRestart: false,
        webWorkerRestart: false,
        zapiChange: false,
        zapiShutdownAllowed: false,
        zapiRemovalAllowed: false,
        globalCutoverAllowed: false,
        generalCustomerMigrationAllowed: false,
        authorizedControlledTestPhone: '5515998038637',
        authorizedPhoneWebEligible: true,
        generalCustomersWebEligible: false,
        generalCustomerProvider: 'ZAPI',
        providerSelectionExclusive: true,
        queueClaimExclusive: true,
        messageDedupe: true,
        automaticProviderFallback: false,
        persistentWorkerPortOnly: true,
        maxConcurrentWebSockets: 1,
        secondSocketAllowed: false,
        newPairingAllowed: false,
        qrAllowed: false,
        pairingCodeAllowed: false,
        realCustomerWebRouting: 0,
        generalWebQueueConsumption: 0,
        inboundCommercialRouting: false,
        v165CanaryResend: false,
        v47GuardChanged: false,
        v47WorkflowChanged: false
    }
};

fs.mkdirSync(path.dirname(path.join(root, manifestRelative)), { recursive: true });
fs.writeFileSync(path.join(root, manifestRelative), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`V167_CONTROLLED_ROUTING_MANIFEST_REFRESHED=YES files=${files.length}\n`);
