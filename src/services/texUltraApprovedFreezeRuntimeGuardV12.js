import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'docs', 'freeze', 'ec-manual-product-lead-badge-v12-20260815.json');
const parentManifestPath = path.join(root, 'docs', 'freeze', 'ec-manual-product-dropi-sync-v11-20260815.json');
const officialRuntime = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true';
const explicitlyRequired = String(process.env.TEX_ULTRA_APPROVED_FREEZE_REQUIRED || '').toLowerCase() === 'true';
const required = officialRuntime || explicitlyRequired;
const sha256 = (relativePath) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex');

if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[EC-MANUAL-PRODUCT-LEAD-BADGE-FREEZE-V12] manifesto aprovado ausente; startup bloqueado.');
} else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const parentManifest = JSON.parse(fs.readFileSync(parentManifestPath, 'utf8'));
    if (
        manifest.status !== 'approved_frozen'
        || manifest.country !== 'EC'
        || manifest.productKey !== 'tex_ultra_ec'
        || !manifest.parentFreezeIds?.includes(parentManifest.freezeId)
    ) {
        throw new Error('[EC-MANUAL-PRODUCT-LEAD-BADGE-FREEZE-V12] manifesto invalido; startup bloqueado.');
    }
    const supersededParentFiles = new Set(manifest.supersededParentProtectedFiles || []);
    for (const [relativePath, approvedHash] of Object.entries(parentManifest.protectedFiles || {})) {
        if (supersededParentFiles.has(relativePath)) continue;
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[EC-MANUAL-PRODUCT-LEAD-BADGE-FREEZE-V12] regressao no freeze v11: ${relativePath}`);
        }
    }
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[EC-MANUAL-PRODUCT-LEAD-BADGE-FREEZE-V12] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
    console.log(`[EC-MANUAL-PRODUCT-LEAD-BADGE-FREEZE-V12] ${manifest.freezeId} verificado no startup.`);
}
