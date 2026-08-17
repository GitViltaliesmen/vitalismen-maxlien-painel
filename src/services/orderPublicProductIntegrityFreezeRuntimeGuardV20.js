import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/order-public-product-integrity-v20-20260817.json';
const parentRelativePath = 'docs/freeze/meta-purchase-panel-linkage-v19-20260817.json';
const expectedFreezeId = 'order-public-product-integrity-v20-20260817';
const expectedParentFreezeId = 'meta-purchase-panel-linkage-v19-20260817';
const expectedSupersededParentFiles = [
    'package.json',
    'src/index.js',
    'src/routes/orders.js',
    'tests/meta-purchase-panel-linkage.test.mjs',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md'
];
const requiredProtectedFiles = [
    '.env.example',
    '.github/workflows/ec-panel-quality.yml',
    'package.json',
    'package-lock.json',
    'public/qr.html',
    'public/leads-window.html',
    'scripts/audit-ec-product-micro-layer.mjs',
    'scripts/guard-production-security-product-integrity-v17.mjs',
    'scripts/guard-dropi-automatic-submit-reliability-v18.mjs',
    'scripts/guard-meta-purchase-panel-linkage-v19.mjs',
    'scripts/guard-order-public-product-integrity-v20.mjs',
    'src/index.js',
    'src/routes/leads.js',
    'src/routes/observation.js',
    'src/routes/orders.js',
    'src/routes/shipments.js',
    'src/routes/whatsapp.js',
    'src/routes/zapi.js',
    'src/services/droppiEcuadorBrowserService.js',
    'src/services/ecuadorProductService.js',
    'src/services/metaConversionsService.js',
    'src/services/productionSecurityProductIntegrityFreezeRuntimeGuardV17.js',
    'src/services/dropiAutomaticSubmitReliabilityFreezeRuntimeGuardV18.js',
    'src/services/metaPurchasePanelLinkageFreezeRuntimeGuardV19.js',
    'src/services/orderPublicProductIntegrityFreezeRuntimeGuardV20.js',
    'tests/ecuador-product-unknown.test.mjs',
    'tests/panel-sensitive-routes-auth.test.mjs',
    'tests/dropi-automatic-submit-regression.test.mjs',
    'tests/meta-purchase-panel-linkage.test.mjs',
    'tests/review-v17-v19-p1.test.mjs',
    'tests/order-public-product-integrity-v20.test.mjs',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'docs/FONTE_OFICIAL_GITHUB_VPS_WINDOWS.md',
    'docs/INFRAESTRUTURA_OFICIAL.md',
    'docs/PRODUCTION_SECURITY_PRODUCT_INTEGRITY_FREEZE_V17_20260817.md',
    'docs/DROPI_AUTOMATIC_SUBMIT_RELIABILITY_FREEZE_V18_20260817.md',
    'docs/META_PURCHASE_PANEL_LINKAGE_FREEZE_V19_20260817.md',
    'docs/ORDER_PUBLIC_PRODUCT_INTEGRITY_FREEZE_V20_20260817.md',
    'docs/freeze/production-security-product-integrity-v17-20260817.json',
    'docs/freeze/dropi-automatic-submit-reliability-v18-20260817.json',
    parentRelativePath
];
const required = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true'
    || String(process.env.ORDER_PUBLIC_PRODUCT_INTEGRITY_FREEZE_REQUIRED || '').toLowerCase() === 'true'
    || String(process.env.META_PURCHASE_PANEL_LINKAGE_FREEZE_REQUIRED || '').toLowerCase() === 'true'
    || String(process.env.DROPI_AUTOMATIC_SUBMIT_RELIABILITY_FREEZE_REQUIRED || '').toLowerCase() === 'true';

const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readManifest = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const sameList = (actual, expected) => (
    Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index])
);
const verifyProtectedFiles = (manifest, skipped = new Set()) => {
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (skipped.has(relativePath)) continue;
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[ORDER-PUBLIC-PRODUCT-INTEGRITY-V20] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
};

const manifestPath = path.join(root, manifestRelativePath);
if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[ORDER-PUBLIC-PRODUCT-INTEGRITY-V20] manifesto ausente; startup bloqueado.');
} else {
    const manifest = readManifest(manifestRelativePath);
    const parent = readManifest(parentRelativePath);
    const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();

    if (
        manifest.freezeId !== expectedFreezeId
        || manifest.status !== 'approved_frozen'
        || manifest.country !== 'EC'
        || manifest.parentFreezeId !== expectedParentFreezeId
        || parent.freezeId !== expectedParentFreezeId
        || manifest.publicationStatus !== 'candidate_validated_not_published'
        || manifest.requiresWrittenAuthorizationToChange !== true
        || !sameList(manifest.supersededParentProtectedFiles, expectedSupersededParentFiles)
        || protectedFiles.length !== requiredProtectedFiles.length
        || requiredProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
        || manifest.protectedFiles[parentRelativePath] !== sha256(parentRelativePath)
        || manifest.policy?.publicOperationalStatusAllowed !== false
        || manifest.policy?.authenticatedOperationalStatusPreserved !== true
        || manifest.policy?.publicMetaPurchaseSendAllowed !== false
        || manifest.policy?.explicitProductRequiredBeforePending !== true
        || manifest.policy?.conflictingProductIdentifiersAccepted !== false
        || manifest.policy?.draftCaptureWithoutProductPreserved !== true
        || manifest.policy?.pricesChanged !== false
        || manifest.policy?.commercialFunnelChanged !== false
        || manifest.policy?.externalSendsAdded !== false
        || manifest.policy?.databaseMigrationRequired !== false
        || manifest.preservation?.metaEventIdDeduplication !== true
        || manifest.preservation?.metaPurchaseSentAtGuard !== true
        || manifest.preservation?.metaPanelLinkageV19Preserved !== true
        || manifest.preservation?.dropiV18Preserved !== true
        || manifest.preservation?.productionSecurityV17Preserved !== true
    ) {
        throw new Error('[ORDER-PUBLIC-PRODUCT-INTEGRITY-V20] manifesto ou politica invalida; startup bloqueado.');
    }

    verifyProtectedFiles(parent, new Set(manifest.supersededParentProtectedFiles));
    verifyProtectedFiles(manifest);
    console.log(`[ORDER-PUBLIC-PRODUCT-INTEGRITY-V20] ${manifest.freezeId} verificado no startup.`);
}
