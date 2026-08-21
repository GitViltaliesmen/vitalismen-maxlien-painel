import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/media-durability-auth-v30-20260821.json';
const ancestorSpecs = [
    {
        path: 'docs/freeze/customer-data-resolution-v28-20260818.json',
        freezeId: 'customer-data-resolution-v28-20260818',
        sha256: 'b86645ebfbf87d7d84ed737e596ae34f8e21b57e84e615cb5070e6583484e4a3'
    },
    {
        path: 'docs/freeze/logistics-clean-chat-v29-20260818.json',
        freezeId: 'logistics-clean-chat-v29-20260818',
        sha256: '6569acc57662ac8aba1852836d68e77382dc650c373a3f94eafb44a5358950dc'
    },
    {
        path: 'docs/freeze/deploy-integration-v29-1-20260818.json',
        freezeId: 'deploy-integration-v29-1-20260818',
        sha256: 'c2e80fa82432eadef07850948bb654a789b6d4e6b9d1e238cbe11f86bfbc4fe1'
    },
    {
        path: 'docs/freeze/guard-alias-integration-v29-2-20260818.json',
        freezeId: 'guard-alias-integration-v29-2-20260818',
        sha256: 'aa41a329514f72b2b372c622c3bd992db0e5fe6d98a26902ebaf819a5b00e4ee'
    }
];
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'public/qr.html',
    'src/index.js',
    'src/models/Message.js',
    'src/routes/whatsapp.js',
    'tests/panel-call-dropi-safety-v21.test.mjs'
];
const newProtectedFiles = [
    'docs/MEDIA_DURABILITY_AUTH_FREEZE_V30_20260821.md',
    'public/panel-intelligence/authenticated-media.js',
    'scripts/assert-media-durability-activation-approved-v30.mjs',
    'scripts/guard-media-durability-auth-v30.mjs',
    'src/routes/zapi.js',
    'src/services/inboundMediaStorageService.js',
    'src/services/mediaDurabilityAuthFreezeRuntimeGuardV30.js',
    'src/services/zapiClient.js',
    'tests/inbound-media-storage.test.mjs',
    'tests/media-durability-auth-v30.test.mjs',
    'tests/panel-authenticated-media.test.mjs',
    'tests/zapi-outbound-audio-contract.test.mjs'
];

const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

for (const spec of ancestorSpecs) {
    if (!exists(spec.path) || sha256(spec.path) !== spec.sha256) {
        throw new Error(`[MEDIA-V30] manifesto ancestral divergente: ${spec.path}`);
    }
}
if (!exists(manifestRelativePath)) {
    throw new Error('[MEDIA-V30] manifesto V30 ausente; startup bloqueado.');
}

const ancestors = ancestorSpecs.map((spec) => readJson(spec.path));
const manifest = readJson(manifestRelativePath);
for (let index = 0; index < ancestors.length; index += 1) {
    if (ancestors[index].freezeId !== ancestorSpecs[index].freezeId) {
        throw new Error(`[MEDIA-V30] freeze ancestral inválido: ${ancestorSpecs[index].path}`);
    }
}
if (
    ancestors[1].parentFreezeId !== ancestors[0].freezeId
    || ancestors[2].parentFreezeId !== ancestors[1].freezeId
    || ancestors[3].parentFreezeId !== ancestors[2].freezeId
    || manifest.parentFreezeId !== ancestors[3].freezeId
    || manifest.parentManifestSha256 !== ancestorSpecs[3].sha256
) {
    throw new Error('[MEDIA-V30] lineage V28 → V29 → V29.1 → V29.2 → V30 divergente.');
}

const expectedProtectedFiles = [...declaredAncestorOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
if (
    manifest.freezeId !== 'media-durability-auth-v30-20260821'
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'draft_pr_published_activation_authorized'
    || manifest.country !== 'EC'
    || manifest.baseProductionSha !== 'b26bacdd6c72711a70834e69915285e677649f1a'
    || manifest.operatorApproval?.status !== 'approved_in_thread'
    || manifest.operatorApproval?.approvedAt !== '2026-08-21T17:24:26Z'
    || manifest.operatorApproval?.scope !== 'implement_media_durability_audit_without_deploy_or_send'
    || manifest.operatorActivationApproval?.status !== 'approved_in_thread'
    || manifest.operatorActivationApproval?.approvedAt !== '2026-08-21T18:00:25Z'
    || manifest.operatorActivationApproval?.scope !== 'activate_media_durability_v30_ec'
    || JSON.stringify(manifest.operatorActivationApproval?.constraints || []) !== JSON.stringify([
        'no_mass_sends',
        'controlled_audio_image_canary',
        'preserve_zapi_until_whatsapp_web_is_ready'
    ])
    || manifest.policy?.ancestorFreezesPreserved !== true
    || manifest.policy?.cleanChatV29Preserved !== true
    || manifest.policy?.providerIdentityPreserved !== true
    || manifest.policy?.persistentInboundStorage !== true
    || manifest.policy?.authenticatedBlobLoading !== true
    || manifest.policy?.directActivationBlocked !== false
    || manifest.policy?.commercialFlowChanged !== false
    || manifest.realEffects?.whatsappMessage !== false
    || manifest.realEffects?.order !== false
    || manifest.realEffects?.dropi !== false
    || manifest.realEffects?.metaCapi !== false
    || manifest.realEffects?.officialDatabaseWrite !== false
    || manifest.realEffects?.deploy !== false
    || manifest.realEffects?.activation !== false
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[MEDIA-V30] manifesto ou política inválida; startup bloqueado.');
}

for (let index = 0; index < ancestors.length; index += 1) {
    const laterOverrides = new Set(declaredAncestorOverrides);
    for (const later of ancestors.slice(index + 1)) {
        for (const relativePath of later.declaredParentOverrides || []) laterOverrides.add(relativePath);
    }
    for (const [relativePath, approvedHash] of Object.entries(ancestors[index].protectedFiles || {})) {
        if (laterOverrides.has(relativePath)) continue;
        if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[MEDIA-V30] herança divergente em ${relativePath}.`);
        }
    }
}

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[MEDIA-V30] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[MEDIA-V30] lineage V28 → V29 → V29.1 → V29.2 → V30 verificada; ativação controlada autorizada, sem disparos em massa.');
