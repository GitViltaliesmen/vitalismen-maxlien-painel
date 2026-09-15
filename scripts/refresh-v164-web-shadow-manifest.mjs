import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const parentCommit = 'da4547aafb407da7259c312fdd1db46d5519cb91';
const manifestRelative = 'docs/freeze/ec-web-worker-shadow-activation-v164-20260915.json';
const parentManifest = 'docs/freeze/ec-multinumber-shadow-reconciliation-v163-20260915.json';
const compatibilityOverrides = [
    '.env.example',
    '.github/workflows/ec-panel-quality.yml',
    'ops/vitalismen-stage',
    'scripts/deploy-vps-ready.mjs',
    'scripts/guard-baileys-libsignal-security-v59.mjs',
    'scripts/guard-canary-controller-v77.mjs',
    'scripts/guard-canary-isolation-v75.mjs',
    'scripts/guard-deploy-health-bridge-semantics-v76.mjs',
    'scripts/guard-deploy-helper-v71-chain-alignment-safety-v72.mjs',
    'scripts/guard-dropi-customer-full-name-v64.mjs',
    'scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs',
    'scripts/guard-meta-partner-destination-registry-v73.mjs',
    'scripts/guard-panel-client-search-v41.mjs',
    'scripts/guard-post-sale-gargalos-v65.mjs',
    'scripts/guard-protocolo-g-ad-metrics-v63.mjs',
    'scripts/guard-protocolo-g-conversion-v62.mjs',
    'scripts/guard-vitalismen-stage-v66.mjs',
    'scripts/guard-whatsapp-outage-recovery-v49.mjs',
    'scripts/lib/canary-controller-contract-v77.mjs',
    'src/index.js',
    'src/routes/health.js',
    'src/services/ecConversationBucketService.js',
    'src/services/ecDeliveredRepurchaseService.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/ecRepurchaseSqliteSerializationFreezeRuntimeGuardV47.js',
    'src/services/canaryControllerV77Service.js',
    'src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js',
    'src/services/outboundDedupeService.js',
    'src/services/panelGlobalCustomerSearchService.js',
    'src/services/zapiClient.js',
    'src/whatsapp/sendAudio.js',
    'src/whatsapp/sendDocument.js',
    'src/whatsapp/sendImage.js',
    'src/whatsapp/sendText.js',
    'tests/funnel-metrics-service.test.mjs',
    'tests/meta-ec-protocolo-g-attribution-v61.test.mjs',
    'tests/panel-client-search-v41.test.mjs',
    'tests/whatsapp-outage-recovery-v49.test.mjs',
];
const requiredFiles = [
    'docs/WEB_WORKER_SHADOW_ACTIVATION_V164_20260915.md',
    'ops/ecosystem.v164-web-shadow.config.cjs',
    'ops/web-shadow-v164',
    'scripts/guard-v164-web-shadow-activation.mjs',
    'scripts/lib/ec-runtime-successor-v164-web-shadow-context.mjs',
    'scripts/lib/ec-runtime-successor-v164-web-shadow-overrides-context.mjs',
    'scripts/v164-pm2-snapshot.mjs',
    'scripts/v164-web-shadow-runtime-check.mjs',
    'tests/v164-web-shadow-activation.test.mjs'
];

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const lines = (value) => String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const files = [...new Set([
    ...lines(git('diff', '--name-only', parentCommit, '--')),
    ...lines(git('ls-files', '--others', '--exclude-standard'))
])].filter((file) => file !== manifestRelative).sort();
for (const file of requiredFiles) {
    if (!files.includes(file)) throw new Error(`V164_REQUIRED_FILE_MISSING ${file}`);
}

const sha256 = (relative) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relative)))
    .digest('hex');
const manifest = {
    freezeId: 'EC_WEB_WORKER_SHADOW_ACTIVATION_V164_20260915',
    version: 164,
    purpose: 'WEB_WORKER_SHADOW_ACTIVATION_AND_CANARY_READINESS',
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
        customerRealRoutingAllowed: false,
        sessionNamespace: 'V152_TEST_WEB_01',
        sessionDirectory: '/var/lib/vitalismen-whatsapp-web-sessions/V152_TEST_WEB_01',
        newPairingAllowed: false,
        qrAllowed: false,
        pairingCodeAllowed: false,
        maxConcurrentSockets: 1,
        webShadow: true,
        webDraining: true,
        webWeight: 0,
        webCapacity: 0,
        outboundEligible: false,
        inboundCommercialRouting: false,
        queueConsumption: 0,
        failoverAllowed: false,
        handoffAllowed: false,
        authorizedControlledTestPhone: '5515998038637',
        pairedIdentity: '5531983002800',
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
        sessionFilesPreservedOnRollback: true,
        v47GuardChanged: false,
        v47WorkflowChanged: false
    }
};

fs.mkdirSync(path.dirname(path.join(root, manifestRelative)), { recursive: true });
fs.writeFileSync(path.join(root, manifestRelative), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`V164_WEB_SHADOW_MANIFEST_REFRESHED=YES files=${files.length}\n`);
