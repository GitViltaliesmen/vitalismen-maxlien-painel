import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/protocolo-g-ad-metrics-v63-20260826.json';
const parentManifestPath = 'docs/freeze/protocolo-g-conversion-v62-20260826.json';
const parentManifestSha256 = '6a042b15ffc6afd83f4a6468d61bfeef008d1ba42ec42c84a2cd7c9202c67ab3';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'public/funnel-metrics.html',
    'scripts/guard-baileys-libsignal-security-v59.mjs',
    'scripts/guard-pickup-bonus-delivery-v60.mjs',
    'scripts/senior-guard.mjs',
    'src/routes/funnelMetrics.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/funnelMetricsService.js',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_PROTOCOLO_G_AD_METRICS_V63_20260826.txt',
    'docs/PROTOCOLO_G_AD_METRICS_FREEZE_V63_20260826.md',
    'scripts/assert-protocolo-g-ad-metrics-activation-approved-v63.mjs',
    'scripts/guard-protocolo-g-ad-metrics-v63.mjs',
    'src/services/protocoloGAdMetricsFreezeRuntimeGuardV63.js',
    'tests/protocolo-g-ad-metrics-v63.test.mjs'
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
    || manifest.freezeId !== 'protocolo-g-ad-metrics-v63-20260826'
    || manifest.parentFreezeId !== 'protocolo-g-conversion-v62-20260826'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_controlled_activation'
    || manifest.country !== 'EC'
    || manifest.productKey !== 'tex_ultra_ec'
    || manifest.funnel !== 'PROTOCOLO_G'
    || manifest.policy?.measurementStartedAt !== '2026-08-26T05:13:18.000Z'
    || manifest.policy?.perAdBreakdown !== true
    || manifest.policy?.minimumLandingSample !== 20
    || manifest.policy?.vslFilesChanged !== false
    || manifest.policy?.metaAdsChanged !== false
    || manifest.policy?.commercialFlowChanged !== false
    || manifest.policy?.historicalDataMutated !== false
    || manifest.policy?.deployAuthorized !== true
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[PROTOCOLO-G-AD-METRICS-V63] manifesto ou política inválida; startup bloqueado.');

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...declaredAncestorOverrides
];
try {
    await import('./protocoloGConversionFreezeRuntimeGuardV62.js');
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
        throw new Error(`[PROTOCOLO-G-AD-METRICS-V63] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[PROTOCOLO-G-AD-METRICS-V63] leitura pós-correção por anúncio íntegra e autorizada.');
