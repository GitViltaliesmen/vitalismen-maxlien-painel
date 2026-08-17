import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const successorManifestRelativePath = 'docs/freeze/operational-mode-zapi-health-reconciliation-v16-20260816.json';
const parentManifestRelativePath = 'docs/freeze/whatsapp-chats-readonly-hardening-v16-20260816.json';
const v16ManifestRelativePath = 'docs/freeze/customer-current-context-v16-20260816.json';
const v15ManifestRelativePath = 'docs/freeze/customer-data-intelligence-v15-20260815.json';
const v14ManifestRelativePath = 'docs/freeze/whatsapp-auto-reject-policy-v14-20260815.json';
const v13ManifestRelativePath = 'docs/freeze/ec-product-funnel-isolation-v13-20260815.json';
const v12ManifestRelativePath = 'docs/freeze/ec-manual-product-lead-badge-v12-20260815.json';
const successorManifestPath = path.join(root, successorManifestRelativePath);
const officialRuntime = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true';
const explicitlyRequired = String(process.env.OPERATIONAL_MODE_ZAPI_HEALTH_FREEZE_REQUIRED || '').toLowerCase() === 'true';
const required = officialRuntime || explicitlyRequired;
const expectedFreezeId = 'operational-mode-zapi-health-reconciliation-v16-20260816';
const expectedParentFreezeId = 'whatsapp-chats-readonly-hardening-v16-20260816';
const expectedDirectSupersededFiles = ['package.json', 'src/index.js'];
const requiredProtectedFiles = [
    'AGENTS.md',
    'package.json',
    'src/index.js',
    'src/routes/health.js',
    'src/services/operationalModeZapiHealthFreezeRuntimeGuardV16.js',
    'scripts/guard-operational-mode-zapi-health-v16.mjs',
    'scripts/senior-guard.mjs',
    'scripts/official-state-audit.mjs',
    'tests/operational-mode-zapi-health.test.mjs',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/OPERATIONAL_MODE_ZAPI_HEALTH_RECONCILIATION_FREEZE_V16_20260816.md',
    parentManifestRelativePath,
    'FREEZE_EC_8637_ZAPI_PUBLIC_RESET_20260622.md',
    'FREEZE_EC_VSL_ZAPI_AUTORESOLVER_20260623.md',
    'FREEZE_EC_MANUAL_SEND_1621_RECOVERY_20260623.md'
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
            throw new Error(`[OPERATIONAL-MODE-ZAPI-HEALTH-FREEZE-V16] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
};

if (!fs.existsSync(successorManifestPath)) {
    if (required) {
        throw new Error('[OPERATIONAL-MODE-ZAPI-HEALTH-FREEZE-V16] manifesto sucessor ausente; startup bloqueado.');
    }
} else {
    const manifest = readManifest(successorManifestRelativePath);
    const parentManifest = readManifest(parentManifestRelativePath);
    const v16Manifest = readManifest(v16ManifestRelativePath);
    const v15Manifest = readManifest(v15ManifestRelativePath);
    const v14Manifest = readManifest(v14ManifestRelativePath);
    const v13Manifest = readManifest(v13ManifestRelativePath);
    const v12Manifest = readManifest(v12ManifestRelativePath);
    const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
    const v15SkippedFiles = new Set(v16Manifest.supersededParentProtectedFiles || []);
    const parentRouteSupersession = parentManifest.supersededAncestorProtectedFiles?.[0]?.relativePath;
    if (parentRouteSupersession) v15SkippedFiles.add(parentRouteSupersession);

    if (
        manifest.freezeId !== expectedFreezeId
        || manifest.status !== 'implementation_candidate_locked'
        || manifest.country !== 'EC'
        || manifest.parentFreezeId !== expectedParentFreezeId
        || manifest.parentFreezeId !== parentManifest.freezeId
        || manifest.publicationStatus !== 'not_published'
        || manifest.productionUnchanged !== true
        || manifest.requiresWrittenAuthorizationToChange !== true
        || manifest.policy?.modeContractStrict !== true
        || manifest.policy?.operationalModePreserved !== true
        || manifest.policy?.observationModePreserved !== true
        || manifest.policy?.isolatedFunnelFlagChangesAllowed !== false
        || manifest.policy?.officialTransport !== 'zapi'
        || manifest.policy?.baileysRequiredWhenZapiHealthy !== false
        || manifest.policy?.healthReadOnly !== true
        || manifest.policy?.databaseWritesAllowed !== false
        || manifest.policy?.externalSendsAllowed !== false
        || manifest.policy?.productionUnchanged !== true
        || !sameList(manifest.supersededParentProtectedFiles, expectedDirectSupersededFiles)
        || (manifest.supersededAncestorProtectedFiles || []).length !== 0
        || protectedFiles.length !== requiredProtectedFiles.length
        || requiredProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
        || manifest.protectedFiles[parentManifestRelativePath] !== sha256(parentManifestRelativePath)
        || parentManifest.freezeId !== expectedParentFreezeId
        || parentManifest.parentFreezeId !== v16Manifest.freezeId
        || v16Manifest.parentFreezeId !== v15Manifest.freezeId
        || !v15Manifest.parentFreezeIds?.includes(v14Manifest.freezeId)
        || !v14Manifest.parentFreezeIds?.includes(v13Manifest.freezeId)
        || !v13Manifest.parentFreezeIds?.includes(v12Manifest.freezeId)
    ) {
        throw new Error('[OPERATIONAL-MODE-ZAPI-HEALTH-FREEZE-V16] manifesto sucessor, politica ou ascendencia invalida; startup bloqueado.');
    }

    verifyProtectedFiles(v14Manifest);
    verifyProtectedFiles(v13Manifest, new Set(v15Manifest.supersededAncestorProtectedFiles || []));
    verifyProtectedFiles(v12Manifest, new Set(v13Manifest.supersededParentProtectedFiles || []));
    verifyProtectedFiles(v15Manifest, v15SkippedFiles);
    verifyProtectedFiles(v16Manifest, new Set(parentManifest.supersededParentProtectedFiles || []));
    verifyProtectedFiles(parentManifest, new Set(manifest.supersededParentProtectedFiles));
    verifyProtectedFiles(manifest);
    console.log(`[OPERATIONAL-MODE-ZAPI-HEALTH-FREEZE-V16] ${manifest.freezeId} verificado no startup.`);
}
