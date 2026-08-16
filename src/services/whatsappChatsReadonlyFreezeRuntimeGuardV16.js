import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const successorManifestRelativePath = 'docs/freeze/whatsapp-chats-readonly-hardening-v16-20260816.json';
const v16ManifestRelativePath = 'docs/freeze/customer-current-context-v16-20260816.json';
const v15ManifestRelativePath = 'docs/freeze/customer-data-intelligence-v15-20260815.json';
const v14ManifestRelativePath = 'docs/freeze/whatsapp-auto-reject-policy-v14-20260815.json';
const v13ManifestRelativePath = 'docs/freeze/ec-product-funnel-isolation-v13-20260815.json';
const v12ManifestRelativePath = 'docs/freeze/ec-manual-product-lead-badge-v12-20260815.json';
const successorManifestPath = path.join(root, successorManifestRelativePath);
const officialRuntime = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true';
const explicitlyRequired = String(process.env.WHATSAPP_CHATS_READONLY_FREEZE_REQUIRED || '').toLowerCase() === 'true';
const required = officialRuntime || explicitlyRequired;
const expectedFreezeId = 'whatsapp-chats-readonly-hardening-v16-20260816';
const expectedParentFreezeId = 'customer-current-context-v16-20260816';
const expectedAncestorFreezeId = 'customer-data-intelligence-v15-20260815';
const protectedRoute = 'src/routes/whatsapp.js';
const expectedHistoricalRouteHash = '83647d60603d1cefe8ff43f4407caea3bc333ed07080d46b5396a611b4b35c75';
const expectedDirectSupersededFiles = ['package.json', 'src/index.js'];
const requiredProtectedFiles = [
    'package.json',
    'src/index.js',
    protectedRoute,
    'src/services/whatsappChatsReadonlyFreezeRuntimeGuardV16.js',
    'scripts/guard-whatsapp-chats-readonly-v16.mjs',
    'tests/whatsapp-chats-readonly.test.mjs',
    'docs/WHATSAPP_CHATS_READONLY_HARDENING_FREEZE_V16_20260816.md',
    v16ManifestRelativePath
];

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
            throw new Error(`[WHATSAPP-CHATS-READONLY-FREEZE-V16] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
};

if (!fs.existsSync(successorManifestPath)) {
    if (required) {
        throw new Error('[WHATSAPP-CHATS-READONLY-FREEZE-V16] manifesto sucessor ausente; startup bloqueado.');
    }
} else {
    const manifest = readManifest(successorManifestRelativePath);
    const v16Manifest = readManifest(v16ManifestRelativePath);
    const v15Manifest = readManifest(v15ManifestRelativePath);
    const v14Manifest = readManifest(v14ManifestRelativePath);
    const v13Manifest = readManifest(v13ManifestRelativePath);
    const v12Manifest = readManifest(v12ManifestRelativePath);
    const ancestorSupersessions = manifest.supersededAncestorProtectedFiles || [];
    const ancestorRule = ancestorSupersessions[0] || {};
    const successorProtectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
    const v15SkippedFiles = new Set(v16Manifest.supersededParentProtectedFiles || []);
    v15SkippedFiles.add(protectedRoute);

    if (
        manifest.freezeId !== expectedFreezeId
        || manifest.status !== 'implementation_candidate_locked'
        || manifest.country !== 'EC'
        || manifest.parentFreezeId !== expectedParentFreezeId
        || manifest.parentFreezeId !== v16Manifest.freezeId
        || manifest.publicationStatus !== 'not_published'
        || manifest.productionUnchanged !== true
        || manifest.requiresWrittenAuthorizationToChange !== true
        || manifest.policy?.route !== 'GET /api/whatsapp/chats'
        || manifest.policy?.readOnly !== true
        || manifest.policy?.databaseWritesAllowed !== false
        || manifest.policy?.responseContractChanged !== false
        || manifest.policy?.markReadChanged !== false
        || manifest.policy?.externalCallsAdded !== false
        || manifest.policy?.productionUnchanged !== true
        || manifest.policy?.fastReadOnly !== true
        || manifest.policy?.enrichedReadOnly !== true
        || manifest.policy?.productCalculationPreserved !== true
        || manifest.policy?.persistenceRequiresExplicitOptIn !== true
        || manifest.policy?.profileCachePersistenceOnGet !== false
        || manifest.policy?.customerContextV16Changed !== false
        || !sameList(manifest.supersededParentProtectedFiles, expectedDirectSupersededFiles)
        || ancestorSupersessions.length !== 1
        || ancestorRule.freezeId !== expectedAncestorFreezeId
        || ancestorRule.relativePath !== protectedRoute
        || ancestorRule.historicalHash !== expectedHistoricalRouteHash
        || ancestorRule.reason !== 'hardening autorizado para impedir persistência em GET /api/whatsapp/chats'
        || successorProtectedFiles.length !== requiredProtectedFiles.length
        || requiredProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
        || !Object.hasOwn(manifest.protectedFiles || {}, v16ManifestRelativePath)
        || manifest.protectedFiles[v16ManifestRelativePath] !== sha256(v16ManifestRelativePath)
        || v15Manifest.freezeId !== expectedAncestorFreezeId
        || v15Manifest.protectedFiles?.[protectedRoute] !== expectedHistoricalRouteHash
        || ancestorRule.historicalHash !== v15Manifest.protectedFiles?.[protectedRoute]
        || ancestorRule.replacementHash !== manifest.protectedFiles?.[protectedRoute]
        || ancestorRule.replacementHash !== sha256(protectedRoute)
        || v16Manifest.parentFreezeId !== v15Manifest.freezeId
        || !v15Manifest.parentFreezeIds?.includes(v14Manifest.freezeId)
        || !v14Manifest.parentFreezeIds?.includes(v13Manifest.freezeId)
        || !v13Manifest.parentFreezeIds?.includes(v12Manifest.freezeId)
        || !sameList(v16Manifest.supersededParentProtectedFiles, ['package.json', 'src/index.js', 'public/qr.html'])
    ) {
        throw new Error('[WHATSAPP-CHATS-READONLY-FREEZE-V16] manifesto sucessor, politica ou ascendencia invalida; startup bloqueado.');
    }

    verifyProtectedFiles(v14Manifest);
    verifyProtectedFiles(v13Manifest, new Set(v15Manifest.supersededAncestorProtectedFiles || []));
    verifyProtectedFiles(v12Manifest, new Set(v13Manifest.supersededParentProtectedFiles || []));
    verifyProtectedFiles(v15Manifest, v15SkippedFiles);
    verifyProtectedFiles(v16Manifest, new Set(manifest.supersededParentProtectedFiles));
    verifyProtectedFiles(manifest);
    console.log(`[WHATSAPP-CHATS-READONLY-FREEZE-V16] ${manifest.freezeId} verificado no startup.`);
}
