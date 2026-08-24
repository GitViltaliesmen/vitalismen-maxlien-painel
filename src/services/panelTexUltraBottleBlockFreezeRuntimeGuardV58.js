import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/panel-tex-ultra-bottle-block-v58-20260824.json';
const parentManifestPath = 'docs/freeze/panel-customer-alias-repair-v57-20260824.json';
const parentManifestSha256 = '5ec04a8e005e08df215c05e8926811329a89ed0743366948d43db57962371ffa';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'public/qr.html',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'tests/ec-product-funnel-isolation-v13.test.mjs',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_PANEL_TEX_ULTRA_BOTTLE_BLOCK_V58_20260824.txt',
    'docs/PANEL_TEX_ULTRA_BOTTLE_BLOCK_FREEZE_V58_20260824.md',
    'public/media/sales/ec/tex_ultra.png',
    'scripts/assert-panel-tex-ultra-bottle-block-activation-approved-v58.mjs',
    'scripts/guard-panel-tex-ultra-bottle-block-v58.mjs',
    'src/services/panelTexUltraBottleBlockFreezeRuntimeGuardV58.js',
    'tests/panel-tex-ultra-bottle-block-v58.test.mjs'
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
    || manifest.freezeId !== 'panel-tex-ultra-bottle-block-v58-20260824'
    || manifest.parentFreezeId !== 'panel-customer-alias-repair-v57-20260824'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'urgent_block_repair_audit_freeze_and_activation_approved'
    || manifest.policy?.officialBottlePathRepair !== true
    || manifest.policy?.fullB01SequencePreserved !== true
    || manifest.policy?.promotionalPricesChanged !== false
    || manifest.policy?.realClientSendAuthorized !== false
    || manifest.policy?.qaPhoneCanaryAuthorized !== true
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.metaPurchaseResendAllowed !== false
    || manifest.policy?.otherProductMediaChanged !== false
    || manifest.policy?.deployAuthorized !== true
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[PANEL-TEX-ULTRA-BOTTLE-V58] manifesto ou politica invalida; startup bloqueado.');

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...(manifest.declaredAncestorOverrides || [])
];
try {
    await import('./panelCustomerAliasRepairFreezeRuntimeGuardV57.js');
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
        throw new Error(`[PANEL-TEX-ULTRA-BOTTLE-V58] alteracao nao autorizada em ${relativePath}.`);
    }
}

console.log('[PANEL-TEX-ULTRA-BOTTLE-V58] frasco oficial e continuidade do B01 validados.');
