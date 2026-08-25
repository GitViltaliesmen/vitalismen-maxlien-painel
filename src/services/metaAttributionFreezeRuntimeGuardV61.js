import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/meta-ec-protocolo-g-attribution-v61-20260824.json';
const parentManifestPath = 'docs/freeze/pickup-bonus-delivery-v60-20260824.json';
const parentManifestSha256 = '7e3166f4539a8ee0b85663c9d6fa82ed8c7f4e1c7c34aa10ce08ff1c98f3895c';
const declaredAncestorOverrides = [
    '.env.example',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'public/funnel-metrics.html',
    'scripts/guard-baileys-libsignal-security-v59.mjs',
    'scripts/guard-pickup-bonus-delivery-v60.mjs',
    'scripts/senior-guard.mjs',
    'src/models/Order.js',
    'src/models/VslVisit.js',
    'src/routes/funnelMetrics.js',
    'src/routes/whatsapp.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/funnelMetricsService.js',
    'src/services/metaAttributionBridgeService.js',
    'src/services/metaAttributionService.js',
    'src/services/metaConversionsService.js',
    'tests/funnel-metrics-route.test.mjs',
    'tests/funnel-metrics-service.test.mjs',
    'tests/meta-attribution-bridge.test.mjs',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'docs/META_EC_PROTOCOLO_G_ATTRIBUTION_FREEZE_V61_20260824.md',
    'scripts/assert-meta-ec-protocolo-g-attribution-activation-approved-v61.mjs',
    'scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs',
    'src/models/MetaAttributionCorrelation.js',
    'src/services/metaAttributionFreezeRuntimeGuardV61.js',
    'src/services/metaProtocoloGAttributionService.js',
    'tests/meta-ec-protocolo-g-attribution-v61.test.mjs'
];
const absolute = (relativePath) => path.join(root, relativePath);
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(absolute(relativePath)))
    .digest('hex');
const manifest = JSON.parse(fs.readFileSync(absolute(manifestPath), 'utf8'));
const expectedProtectedFiles = [...declaredAncestorOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();

if (
    sha256(parentManifestPath) !== parentManifestSha256
    || manifest.freezeId !== 'meta-ec-protocolo-g-attribution-v61-20260824'
    || manifest.parentFreezeId !== 'pickup-bonus-delivery-v60-20260824'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'local_candidate_review_pending'
    || manifest.publicationStatus !== 'deploy_blocked_pending_written_approval'
    || manifest.country !== 'EC'
    || manifest.datasetId !== '2048099902484149'
    || manifest.operatorApproval?.status !== 'local_implementation_and_tests_authorized'
    || manifest.policy?.externalIdCanonical !== true
    || manifest.policy?.correlationWindowSeconds !== 120
    || manifest.policy?.orderLookbackDays !== 30
    || manifest.policy?.uniqueCandidateRequired !== true
    || manifest.policy?.structuredCampaignIds !== true
    || manifest.policy?.fbpIsAdAttribution !== false
    || manifest.policy?.fbpRenewsAttributionTtl !== false
    || manifest.policy?.attributionCapturedAtAuditOnly !== true
    || manifest.policy?.expiredAdFieldsReconstructed !== false
    || manifest.policy?.canonicalPurchaseSourceUrl !== 'https://vilaliemen.shop/protocolo-g'
    || manifest.policy?.colombiaReadOnly !== true
    || manifest.policy?.zapiChanged !== false
    || manifest.policy?.whatsappMessageChanged !== false
    || manifest.policy?.checkoutDropiChanged !== false
    || manifest.policy?.deployAuthorized !== false
    || manifest.localContractGate?.status !== 'passed'
    || manifest.localContractGate?.fixturePath !== '/home/codex/workspaces/VILALIEMEN_PROTOCOLO_G_OFICIAL/tests/fixtures/meta-ec-protocolo-g-maxlien-payload.json'
    || manifest.localContractGate?.fixtureSha256 !== 'ce253997d309e5ab921f94506a119302d3bf12d5560aa1fdac8b5c9ee4b5afe8'
    || manifest.localContractGate?.vilaliemenCommit !== 'ad0ad71bda41e52cbfb4462527b2a38c31005718'
    || manifest.localContractGate?.vilaliemenBranch !== 'codex/meta-ec-protocolo-g-bridge'
    || manifest.localContractGate?.exactFixtureRequired !== true
    || manifest.localContractGate?.realMetaSent !== false
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[META-EC-PROTOCOLO-G-V61] manifesto ou política inválida; startup bloqueado.');

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...declaredAncestorOverrides
];
try {
    await import('./pickupBonusDeliveryFreezeRuntimeGuardV60.js');
} finally {
    if (inheritedSuccessorOverrides.length > 0) {
        globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = inheritedSuccessorOverrides;
    } else {
        delete globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES;
    }
}

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[META-EC-PROTOCOLO-G-V61] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[META-EC-PROTOCOLO-G-V61] candidato local íntegro; deploy continua bloqueado.');
