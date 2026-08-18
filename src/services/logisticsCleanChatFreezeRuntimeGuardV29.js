import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/logistics-clean-chat-v29-20260818.json';
const parentManifestRelativePath = 'docs/freeze/customer-data-resolution-v28-20260818.json';
const expectedFreezeId = 'logistics-clean-chat-v29-20260818';
const expectedParentFreezeId = 'customer-data-resolution-v28-20260818';
const expectedParentManifestSha = 'b86645ebfbf87d7d84ed737e596ae34f8e21b57e84e615cb5070e6583484e4a3';
const declaredParentOverrides = [
    'package.json',
    'public/qr.html',
    'src/index.js',
    'src/routes/whatsapp.js',
    'src/services/conversationEngine.js',
    'tests/panel-call-dropi-safety-v21.test.mjs'
];
const newProtectedFiles = [
    'docs/LOGISTICS_CLEAN_CHAT_UX_FREEZE_V29_20260818.md',
    'public/panel-intelligence/clean-chat-v29.js',
    'scripts/guard-logistics-clean-chat-v29.mjs',
    'src/models/Message.js',
    'src/models/Shipment.js',
    'src/routes/shipments.js',
    'src/services/carrierTrackingService.js',
    'src/services/guidePrintDispatcherService.js',
    'src/services/logisticsCleanChatFreezeRuntimeGuardV29.js',
    'src/services/logisticsCommunicationV29.js',
    'src/services/shipmentLifecycleStatusService.js',
    'src/services/shipmentMessageService.js',
    'src/services/shipmentStatusDispatcherService.js',
    'tests/logistics-clean-chat-v29-integration.test.mjs',
    'tests/logistics-clean-chat-v29.test.mjs',
    'tests/shipment-pickup-notification.test.mjs'
];

const required = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true'
    || String(process.env.LOGISTICS_CLEAN_CHAT_FREEZE_REQUIRED || '').toLowerCase() === 'true';
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const parentPath = path.join(root, parentManifestRelativePath);
const manifestPath = path.join(root, manifestRelativePath);
if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[LOGISTICS-CLEAN-CHAT-V29] manifesto ausente; startup bloqueado.');
} else {
    if (!fs.existsSync(parentPath) || sha256(parentManifestRelativePath) !== expectedParentManifestSha) {
        throw new Error('[LOGISTICS-CLEAN-CHAT-V29] manifesto pai V28 ausente ou divergente; startup bloqueado.');
    }
    const parent = readJson(parentManifestRelativePath);
    const manifest = readJson(manifestRelativePath);
    const expectedProtectedFiles = [...declaredParentOverrides, ...newProtectedFiles].sort();
    const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
    if (
        parent.freezeId !== expectedParentFreezeId
        || manifest.freezeId !== expectedFreezeId
        || manifest.parentFreezeId !== expectedParentFreezeId
        || manifest.parentManifestSha256 !== expectedParentManifestSha
        || manifest.status !== 'implementation_candidate_locked'
        || manifest.publicationStatus !== 'local_candidate_not_authorized'
        || manifest.country !== 'EC'
        || manifest.baseV28Sha !== '7bd1418caf81b832f30acb7926f023df7a2e711e'
        || manifest.requiresWrittenAuthorizationToChange !== true
        || manifest.operatorApproval?.status !== 'approved_in_thread'
        || manifest.operatorApproval?.scope !== 'implement_v29_logistics_clean_chat_without_deploy'
        || manifest.policy?.v28Preserved !== true
        || manifest.policy?.oneRealMessageOneBubble !== true
        || manifest.policy?.messageHistoryPreserved !== true
        || manifest.policy?.shippedIsNotReady !== true
        || manifest.policy?.pickupRequiresVerifiedReady !== true
        || manifest.policy?.guideMediaBlockedBeforeReady !== true
        || manifest.policy?.productionChanged !== false
        || JSON.stringify([...(manifest.declaredParentOverrides || [])].sort()) !== JSON.stringify(declaredParentOverrides)
        || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
        || protectedFiles.length !== expectedProtectedFiles.length
        || expectedProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
        || declaredParentOverrides.some((relativePath) => !Object.hasOwn(parent.protectedFiles || {}, relativePath))
    ) {
        throw new Error('[LOGISTICS-CLEAN-CHAT-V29] manifesto ou política inválida; startup bloqueado.');
    }
    for (const [relativePath, approvedHash] of Object.entries(parent.protectedFiles || {})) {
        if (declaredParentOverrides.includes(relativePath)) continue;
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[LOGISTICS-CLEAN-CHAT-V29] herança V28 divergente em ${relativePath}; startup bloqueado.`);
        }
    }
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[LOGISTICS-CLEAN-CHAT-V29] alteração não autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
    console.log(`[LOGISTICS-CLEAN-CHAT-V29] ${expectedFreezeId} verificado; produção permanece bloqueada.`);
}
