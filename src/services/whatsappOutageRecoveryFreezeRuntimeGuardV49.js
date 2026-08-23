import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/whatsapp-outage-recovery-v49-20260823.json';
const parentManifestPath = 'docs/freeze/ec-multiproduct-core-v48-20260822.json';
const parentManifestSha256 = 'e56c698535fa9c3eb512693995eab4eb876a3a904b17d4af35d25ce26eec9cdb';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'src/routes/health.js',
    'src/services/ecConversationBucketService.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/ecMultiproductCoreFreezeRuntimeGuardV48.js'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_WHATSAPP_OUTAGE_RECOVERY_V49_20260823.txt',
    'docs/WHATSAPP_OUTAGE_RECOVERY_FREEZE_V49_20260823.md',
    'scripts/assert-whatsapp-outage-recovery-activation-approved-v49.mjs',
    'scripts/guard-whatsapp-outage-recovery-v49.mjs',
    'src/services/whatsappOutageRecoveryFreezeRuntimeGuardV49.js',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
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
    || manifest.freezeId !== 'whatsapp-outage-recovery-v49-20260823'
    || manifest.parentFreezeId !== 'ec-multiproduct-core-v48-20260822'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'urgent_implementation_and_activation_approved'
    || manifest.policy?.providerSubscriptionChangedByCode !== false
    || manifest.policy?.healthReadOnly !== true
    || manifest.policy?.activeFunnelReplyRouted !== true
    || manifest.policy?.automaticHistoricalReplay !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.realClientSendAuthorized !== false
    || manifest.policy?.deployAuthorized !== true
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[WHATSAPP-OUTAGE-RECOVERY-V49] manifesto ou política inválida; startup bloqueado.');
}

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...(manifest.declaredAncestorOverrides || [])
];
try {
    await import('./ecMultiproductCoreFreezeRuntimeGuardV48.js');
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
        throw new Error(`[WHATSAPP-OUTAGE-RECOVERY-V49] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[WHATSAPP-OUTAGE-RECOVERY-V49] health Z-API e respostas de etapa ativa validados.');
