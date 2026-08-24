import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/tex-ultra-delivery-closure-v54-20260824.json';
const parentManifestPath = 'docs/freeze/post-sale-health-recovery-v53-20260824.json';
const parentManifestSha256 = 'b28b607bad84af601a9699da2396faa1183805f815ce9cfd41a0385591f16fae';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'src/services/customerDataResolutionService.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/servientregaEcuadorAgencyService.js',
    'src/services/texUltraFunnelService.js',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_TEX_ULTRA_DELIVERY_CLOSURE_V54_20260824.txt',
    'docs/TEX_ULTRA_DELIVERY_CLOSURE_FREEZE_V54_20260824.md',
    'scripts/assert-tex-ultra-delivery-closure-activation-approved-v54.mjs',
    'scripts/guard-tex-ultra-delivery-closure-v54.mjs',
    'scripts/repair-tex-ultra-agency-order-v54.mjs',
    'src/services/texUltraDeliveryClosureFreezeRuntimeGuardV54.js',
    'tests/tex-ultra-delivery-closure-v54.test.mjs'
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
    || manifest.freezeId !== 'tex-ultra-delivery-closure-v54-20260824'
    || manifest.parentFreezeId !== 'post-sale-health-recovery-v53-20260824'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'explicit_correction_authorized'
    || manifest.policy?.canonicalAgencyRegistryOnly !== true
    || manifest.policy?.agencyReferenceNotApplicable !== true
    || manifest.policy?.ambiguousAgencyRequiresLetterSelection !== true
    || manifest.policy?.homeModeAloneIsNotAddress !== true
    || manifest.policy?.structuredConfirmationCorrections !== true
    || manifest.policy?.exactOrderRepairWithBackup !== true
    || manifest.policy?.realClientCanaryAuthorized !== false
    || manifest.policy?.metaPurchaseResendAllowed !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.deployAuthorized !== true
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[TEX-ULTRA-DELIVERY-V54] manifesto ou política inválida; startup bloqueado.');
}

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...(manifest.declaredAncestorOverrides || [])
];
try {
    await import('./postSaleHealthRecoveryFreezeRuntimeGuardV53.js');
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
        throw new Error(`[TEX-ULTRA-DELIVERY-V54] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[TEX-ULTRA-DELIVERY-V54] agência, domicílio, confirmação e reparo controlado validados.');
