import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/production-security-product-integrity-v17-20260817.json';
const parentRelativePath = 'docs/freeze/operational-mode-zapi-health-reconciliation-v16-20260816.json';
const whatsappRelativePath = 'docs/freeze/whatsapp-chats-readonly-hardening-v16-20260816.json';
const customerContextRelativePath = 'docs/freeze/customer-current-context-v16-20260816.json';
const customerDataRelativePath = 'docs/freeze/customer-data-intelligence-v15-20260815.json';
const autoRejectRelativePath = 'docs/freeze/whatsapp-auto-reject-policy-v14-20260815.json';
const funnelIsolationRelativePath = 'docs/freeze/ec-product-funnel-isolation-v13-20260815.json';
const leadBadgeRelativePath = 'docs/freeze/ec-manual-product-lead-badge-v12-20260815.json';
const expectedFreezeId = 'production-security-product-integrity-v17-20260817';
const expectedParentFreezeId = 'operational-mode-zapi-health-reconciliation-v16-20260816';
const expectedSupersededFiles = [
    'package.json',
    'src/index.js',
    'public/qr.html',
    'src/routes/whatsapp.js',
    'src/routes/zapi.js'
];
const requiredProtectedFiles = [
    '.env.example',
    'package.json',
    'package-lock.json',
    'public/qr.html',
    'scripts/audit-ec-product-micro-layer.mjs',
    'scripts/guard-production-security-product-integrity-v17.mjs',
    'src/index.js',
    'src/routes/leads.js',
    'src/routes/observation.js',
    'src/routes/orders.js',
    'src/routes/whatsapp.js',
    'src/routes/zapi.js',
    'src/services/droppiEcuadorBrowserService.js',
    'src/services/ecuadorProductService.js',
    'src/services/metaConversionsService.js',
    'src/services/productionSecurityProductIntegrityFreezeRuntimeGuardV17.js',
    'tests/ecuador-product-unknown.test.mjs',
    'tests/panel-sensitive-routes-auth.test.mjs',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'docs/FONTE_OFICIAL_GITHUB_VPS_WINDOWS.md',
    'docs/INFRAESTRUTURA_OFICIAL.md',
    'docs/PRODUCTION_SECURITY_PRODUCT_INTEGRITY_FREEZE_V17_20260817.md',
    parentRelativePath
];
const required = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true'
    || String(process.env.PRODUCTION_SECURITY_PRODUCT_INTEGRITY_FREEZE_REQUIRED || '').toLowerCase() === 'true';

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
            throw new Error(`[PRODUCTION-SECURITY-PRODUCT-INTEGRITY-V17] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
};

const manifestPath = path.join(root, manifestRelativePath);
if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[PRODUCTION-SECURITY-PRODUCT-INTEGRITY-V17] manifesto ausente; startup bloqueado.');
} else {
    const manifest = readManifest(manifestRelativePath);
    const parent = readManifest(parentRelativePath);
    const whatsapp = readManifest(whatsappRelativePath);
    const customerContext = readManifest(customerContextRelativePath);
    const customerData = readManifest(customerDataRelativePath);
    const autoReject = readManifest(autoRejectRelativePath);
    const funnelIsolation = readManifest(funnelIsolationRelativePath);
    const leadBadge = readManifest(leadBadgeRelativePath);
    const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();

    if (
        manifest.freezeId !== expectedFreezeId
        || manifest.status !== 'approved_frozen'
        || manifest.country !== 'EC'
        || manifest.parentFreezeId !== expectedParentFreezeId
        || parent.freezeId !== expectedParentFreezeId
        || manifest.publicationStatus !== 'approved_for_production'
        || manifest.requiresWrittenAuthorizationToChange !== true
        || !sameList(manifest.supersededProtectedFiles, expectedSupersededFiles)
        || protectedFiles.length !== requiredProtectedFiles.length
        || requiredProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
        || manifest.protectedFiles[parentRelativePath] !== sha256(parentRelativePath)
        || manifest.policy?.authenticatedSensitiveRoutes !== true
        || manifest.policy?.publicVslEntryPreserved !== true
        || manifest.policy?.publicZapiWhatsappLinkPreserved !== true
        || manifest.policy?.publicZapiWebhooksPreserved !== true
        || manifest.policy?.unknownProductSelectsRealProduct !== false
        || manifest.policy?.pricesChanged !== false
        || manifest.policy?.commercialFunnelChanged !== false
        || manifest.policy?.externalSendsAdded !== false
        || manifest.policy?.databaseMigrationRequired !== false
        || parent.parentFreezeId !== whatsapp.freezeId
        || whatsapp.parentFreezeId !== customerContext.freezeId
        || customerContext.parentFreezeId !== customerData.freezeId
        || !customerData.parentFreezeIds?.includes(autoReject.freezeId)
        || !autoReject.parentFreezeIds?.includes(funnelIsolation.freezeId)
        || !funnelIsolation.parentFreezeIds?.includes(leadBadge.freezeId)
    ) {
        throw new Error('[PRODUCTION-SECURITY-PRODUCT-INTEGRITY-V17] manifesto, politica ou ascendencia invalida; startup bloqueado.');
    }

    verifyProtectedFiles(autoReject, new Set(['.env.example']));
    verifyProtectedFiles(funnelIsolation, new Set(customerData.supersededAncestorProtectedFiles || []));
    verifyProtectedFiles(leadBadge, new Set(funnelIsolation.supersededParentProtectedFiles || []));

    const customerDataSkipped = new Set(customerContext.supersededParentProtectedFiles || []);
    const historicalWhatsappRoute = whatsapp.supersededAncestorProtectedFiles?.[0]?.relativePath;
    if (historicalWhatsappRoute) customerDataSkipped.add(historicalWhatsappRoute);
    customerDataSkipped.add('src/routes/zapi.js');
    verifyProtectedFiles(customerData, customerDataSkipped);

    const customerContextSkipped = new Set(whatsapp.supersededParentProtectedFiles || []);
    customerContextSkipped.add('public/qr.html');
    verifyProtectedFiles(customerContext, customerContextSkipped);

    const whatsappSkipped = new Set(parent.supersededParentProtectedFiles || []);
    whatsappSkipped.add('src/routes/whatsapp.js');
    verifyProtectedFiles(whatsapp, whatsappSkipped);
    verifyProtectedFiles(parent, new Set(['package.json', 'src/index.js', 'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md']));
    verifyProtectedFiles(manifest);
    console.log(`[PRODUCTION-SECURITY-PRODUCT-INTEGRITY-V17] ${manifest.freezeId} verificado no startup.`);
}
