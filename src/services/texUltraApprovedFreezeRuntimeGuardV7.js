import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'docs', 'freeze', 'tex-ultra-real-legacy-order-v7-20260815.json');
const officialRuntime = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true';
const explicitlyRequired = String(process.env.TEX_ULTRA_APPROVED_FREEZE_REQUIRED || '').toLowerCase() === 'true';
const required = officialRuntime || explicitlyRequired;

if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[TEX-ULTRA-FREEZE-V7] manifesto aprovado ausente; startup bloqueado.');
} else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.status !== 'approved_frozen' || manifest.country !== 'EC' || manifest.productKey !== 'tex_ultra_ec') {
        throw new Error('[TEX-ULTRA-FREEZE-V7] manifesto invalido; startup bloqueado.');
    }
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        const absolutePath = path.join(root, relativePath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`[TEX-ULTRA-FREEZE-V7] arquivo protegido ausente: ${relativePath}`);
        }
        const actualHash = crypto.createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex');
        if (actualHash !== approvedHash) {
            throw new Error(`[TEX-ULTRA-FREEZE-V7] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
    console.log(`[TEX-ULTRA-FREEZE-V7] ${manifest.freezeId} verificado no startup.`);
}
