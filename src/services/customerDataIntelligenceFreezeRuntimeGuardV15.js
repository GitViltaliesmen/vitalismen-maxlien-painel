import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'docs', 'freeze', 'customer-data-intelligence-v15-20260815.json');
const v14ManifestPath = path.join(root, 'docs', 'freeze', 'whatsapp-auto-reject-policy-v14-20260815.json');
const v13ManifestPath = path.join(root, 'docs', 'freeze', 'ec-product-funnel-isolation-v13-20260815.json');
const v12ManifestPath = path.join(root, 'docs', 'freeze', 'ec-manual-product-lead-badge-v12-20260815.json');
const officialRuntime = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true';
const explicitlyRequired = String(process.env.TEX_ULTRA_APPROVED_FREEZE_REQUIRED || '').toLowerCase() === 'true';
const required = officialRuntime || explicitlyRequired;
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readManifest = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const verifyProtectedFiles = (manifest, skipped = new Set()) => {
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (skipped.has(relativePath)) continue;
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[CUSTOMER-DATA-INTELLIGENCE-FREEZE-V15] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
};

if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[CUSTOMER-DATA-INTELLIGENCE-FREEZE-V15] manifesto aprovado ausente; startup bloqueado.');
} else {
    const manifest = readManifest(manifestPath);
    const v14Manifest = readManifest(v14ManifestPath);
    const v13Manifest = readManifest(v13ManifestPath);
    const v12Manifest = readManifest(v12ManifestPath);
    if (
        manifest.status !== 'approved_frozen'
        || manifest.country !== 'EC'
        || manifest.publicationStatus !== 'not_published'
        || !manifest.productKeys?.includes('tex_ultra_ec')
        || !manifest.productKeys?.includes('nitrix_ec')
        || !manifest.productKeys?.includes('vit_power_ec')
        || !manifest.parentFreezeIds?.includes(v14Manifest.freezeId)
        || !v14Manifest.parentFreezeIds?.includes(v13Manifest.freezeId)
        || !v13Manifest.parentFreezeIds?.includes(v12Manifest.freezeId)
    ) {
        throw new Error('[CUSTOMER-DATA-INTELLIGENCE-FREEZE-V15] manifesto ou ascendencia invalida; startup bloqueado.');
    }

    verifyProtectedFiles(v14Manifest);
    verifyProtectedFiles(v13Manifest, new Set(manifest.supersededAncestorProtectedFiles || []));
    verifyProtectedFiles(v12Manifest, new Set(v13Manifest.supersededParentProtectedFiles || []));
    verifyProtectedFiles(manifest);
    console.log(`[CUSTOMER-DATA-INTELLIGENCE-FREEZE-V15] ${manifest.freezeId} verificado no startup.`);
}
