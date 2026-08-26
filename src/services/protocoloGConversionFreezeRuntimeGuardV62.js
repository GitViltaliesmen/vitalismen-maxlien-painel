import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/protocolo-g-conversion-v62-20260826.json';
const parentManifestPath = 'docs/freeze/meta-ec-protocolo-g-attribution-v61-20260824.json';
const parentManifestSha256 = 'f1a6753ed874148d2f9e3c5c3dadeea148349b689ae1c8814af9af97e5c13026';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'public/funnel-metrics.html',
    'scripts/guard-baileys-libsignal-security-v59.mjs',
    'scripts/guard-pickup-bonus-delivery-v60.mjs',
    'scripts/senior-guard.mjs',
    'src/models/VslVisit.js',
    'src/routes/funnelMetrics.js',
    'src/routes/whatsapp.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/funnelMetricsService.js',
    'src/services/metaProtocoloGAttributionService.js',
    'tests/funnel-metrics-service.test.mjs',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_PROTOCOLO_G_CONVERSION_V62_20260826.txt',
    'docs/PROTOCOLO_G_CONVERSION_FREEZE_V62_20260826.md',
    'scripts/assert-protocolo-g-conversion-activation-approved-v62.mjs',
    'scripts/guard-protocolo-g-conversion-v62.mjs',
    'src/services/protocoloGConversionFreezeRuntimeGuardV62.js',
    'tests/protocolo-g-conversion-v62.test.mjs'
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
    || manifest.freezeId !== 'protocolo-g-conversion-v62-20260826'
    || manifest.parentFreezeId !== 'meta-ec-protocolo-g-attribution-v61-20260824'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_controlled_activation'
    || manifest.country !== 'EC'
    || manifest.productKey !== 'tex_ultra_ec'
    || manifest.funnel !== 'PROTOCOLO_G'
    || manifest.policy?.earlySecondaryCtaSeconds !== 720
    || manifest.policy?.videoDurationSeconds !== 2590
    || manifest.policy?.vturbFinalCtaPreserved !== true
    || manifest.policy?.stageCreatesMetaConversion !== false
    || manifest.policy?.stageCreatesPanelLead !== false
    || manifest.policy?.stageRotatesSeller !== false
    || manifest.policy?.stageSendsWhatsapp !== false
    || manifest.policy?.sharedVslTrackingChanged !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.checkoutOrDropiChanged !== false
    || manifest.policy?.deployAuthorized !== true
    || manifest.externalVslFiles?.before?.['routes/metaEcProtocoloGBridge.js'] !== '93aee690a85d3618dfdc6c7c632966d6a792a2c17878541a684c14a675a33a8c'
    || manifest.externalVslFiles?.after?.['routes/metaEcProtocoloGBridge.js'] !== '7722081940ceb74b21939e88b54b29f9fb05da9f9e37e87258a4edbd2149f5dd'
    || manifest.externalVslFiles?.after?.['private/vsl/protocolo-g.html'] !== '59b1d47e1c9d7613d1fc30884ce7df78080f9544c730e9435079a0aa39bdfe7b'
    || manifest.externalVslFiles?.after?.['public/assets/js/meta-ec-protocolo-g-bridge.js'] !== 'e0904cae1d97ce20b6493aad28b538650ada24c501b38e6a9e382d145e4dccd9'
    || manifest.externalVslFiles?.preserved?.['public/assets/js/tracking-protocolo-g-formulario-20260815.js'] !== 'da4a9415211991cf6669cea2734c1abecc3f516d00f6330c3feb9761ee7839f9'
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[PROTOCOLO-G-CONVERSION-V62] manifesto ou política inválida; startup bloqueado.');

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...declaredAncestorOverrides
];
try {
    await import('./metaAttributionFreezeRuntimeGuardV61.js');
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
        throw new Error(`[PROTOCOLO-G-CONVERSION-V62] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[PROTOCOLO-G-CONVERSION-V62] microcamada íntegra e autorizada.');
