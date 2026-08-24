import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/baileys-libsignal-security-v59-20260824.json';
const parentManifestPath = 'docs/freeze/panel-tex-ultra-bottle-block-v58-20260824.json';
const parentManifestSha256 = 'e146e793aaa9d126a09dc4a4f8e9fbb53d5b625aead2cbc8cfba105d57c85a3f';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package-lock.json',
    'package.json',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_BAILEYS_LIBSIGNAL_SECURITY_V59_20260824.txt',
    'docs/BAILEYS_LIBSIGNAL_SECURITY_FREEZE_V59_20260824.md',
    'scripts/assert-baileys-libsignal-security-activation-approved-v59.mjs',
    'scripts/guard-baileys-libsignal-security-v59.mjs',
    'src/services/baileysLibsignalSecurityFreezeRuntimeGuardV59.js',
    'tests/baileys-libsignal-security-v59.test.mjs'
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
    || manifest.freezeId !== 'baileys-libsignal-security-v59-20260824'
    || manifest.parentFreezeId !== 'panel-tex-ultra-bottle-block-v58-20260824'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'dependency_security_repair_audit_freeze_and_activation_approved'
    || manifest.policy?.dependencySecurityRepair !== true
    || manifest.policy?.directBaileysVersionChanged !== false
    || manifest.policy?.baileysMajorUpgradeAuthorized !== false
    || manifest.policy?.libsignalRuntimeSourceChanged !== false
    || manifest.policy?.officialZapiTransportPreserved !== true
    || manifest.policy?.productionAuditZeroRequired !== true
    || manifest.policy?.realClientSendAuthorized !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.metaPurchaseResendAllowed !== false
    || manifest.policy?.commercialFunnelChanged !== false
    || manifest.policy?.deployAuthorized !== true
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[BAILEYS-LIBSIGNAL-SECURITY-V59] manifesto ou politica invalida; startup bloqueado.');

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...(manifest.declaredAncestorOverrides || [])
];
try {
    await import('./panelTexUltraBottleBlockFreezeRuntimeGuardV58.js');
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
        throw new Error(`[BAILEYS-LIBSIGNAL-SECURITY-V59] alteracao nao autorizada em ${relativePath}.`);
    }
}

console.log('[BAILEYS-LIBSIGNAL-SECURITY-V59] cadeia 6.7.24/6.0.0/7.6.5 validada.');
