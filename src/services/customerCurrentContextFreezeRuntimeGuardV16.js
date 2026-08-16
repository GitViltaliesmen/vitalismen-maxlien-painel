import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'docs', 'freeze', 'customer-current-context-v16-20260816.json');
const v15ManifestPath = path.join(root, 'docs', 'freeze', 'customer-data-intelligence-v15-20260815.json');
const v14ManifestPath = path.join(root, 'docs', 'freeze', 'whatsapp-auto-reject-policy-v14-20260815.json');
const v13ManifestPath = path.join(root, 'docs', 'freeze', 'ec-product-funnel-isolation-v13-20260815.json');
const v12ManifestPath = path.join(root, 'docs', 'freeze', 'ec-manual-product-lead-badge-v12-20260815.json');
const officialRuntime = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true';
const explicitlyRequired = String(process.env.CUSTOMER_CURRENT_CONTEXT_V16_FREEZE_REQUIRED || '').toLowerCase() === 'true';
const required = officialRuntime || explicitlyRequired;
const requiredProtectedFiles = [
    'package.json',
    'src/index.js',
    'src/routes/customerContext.js',
    'src/services/customerCurrentContextService.js',
    'src/services/customerCurrentContextFreezeRuntimeGuardV16.js',
    'scripts/guard-customer-current-context-v16.mjs',
    'tests/customer-current-context.test.mjs',
    'tests/customer-current-context-route.test.mjs',
    'docs/ESPECIFICACAO_V16_CONTEXTO_ATUAL_CLIENTE.md',
    'docs/CUSTOMER_CURRENT_CONTEXT_FREEZE_V16_20260816.md',
    'docs/freeze/customer-data-intelligence-v15-20260815.json'
];
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readManifest = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const verifyProtectedFiles = (manifest, skipped = new Set()) => {
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (skipped.has(relativePath)) continue;
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[CUSTOMER-CURRENT-CONTEXT-FREEZE-V16] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
};

if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[CUSTOMER-CURRENT-CONTEXT-FREEZE-V16] manifesto candidato ausente; startup bloqueado.');
} else {
    const manifest = readManifest(manifestPath);
    const v15Manifest = readManifest(v15ManifestPath);
    const v14Manifest = readManifest(v14ManifestPath);
    const v13Manifest = readManifest(v13ManifestPath);
    const v12Manifest = readManifest(v12ManifestPath);
    const superseded = new Set(manifest.supersededParentProtectedFiles || []);
    if (
        manifest.status !== 'implementation_candidate_locked'
        || manifest.country !== 'EC'
        || manifest.publicationStatus !== 'not_published'
        || manifest.productionUnchanged !== true
        || manifest.parentFreezeId !== v15Manifest.freezeId
        || !manifest.policy?.readOnly
        || manifest.policy?.applicationAllowed !== false
        || requiredProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
        || !superseded.has('src/index.js')
        || !superseded.has('package.json')
        || !v15Manifest.parentFreezeIds?.includes(v14Manifest.freezeId)
        || !v14Manifest.parentFreezeIds?.includes(v13Manifest.freezeId)
        || !v13Manifest.parentFreezeIds?.includes(v12Manifest.freezeId)
    ) {
        throw new Error('[CUSTOMER-CURRENT-CONTEXT-FREEZE-V16] manifesto candidato ou ascendencia invalida; startup bloqueado.');
    }

    verifyProtectedFiles(v14Manifest);
    verifyProtectedFiles(v13Manifest, new Set(v15Manifest.supersededAncestorProtectedFiles || []));
    verifyProtectedFiles(v12Manifest, new Set(v13Manifest.supersededParentProtectedFiles || []));
    verifyProtectedFiles(v15Manifest, superseded);
    verifyProtectedFiles(manifest);
    console.log(`[CUSTOMER-CURRENT-CONTEXT-FREEZE-V16] ${manifest.freezeId} verificado no startup.`);
}
