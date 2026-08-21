import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/tex-ultra-how-to-use-audio-v31-20260821.json';
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
    },
    {
        path: 'docs/freeze/media-durability-auth-v30-20260821.json',
        freezeId: 'media-durability-auth-v30-20260821',
        sha256: '417f17324d9fec08459e26d3c1a64078aa180bc94c4b5baabab766794c165647'
    }
];
const declaredParentOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'src/index.js',
    'src/services/audioTemplateService.js',
    'src/services/shipmentMessageService.js',
    'src/services/texUltraFunnelService.js',
    'src/services/texUltraProductProfile.js',
    'tests/media-durability-auth-v30.test.mjs',
    'tests/panel-call-dropi-safety-v21.test.mjs',
    'tests/shipment-pickup-notification.test.mjs'
];
const newProtectedFiles = [
    'docs/TEX_ULTRA_HOW_TO_USE_AUDIO_FREEZE_V31_20260821.md',
    'public/media/templates/EC/MODO_DE_USO_TEX_ULTRA.mp3',
    'public/media/templates/EC/MODO_DE_USO_TEX_ULTRA.ogg',
    'scripts/assert-tex-ultra-how-to-use-activation-approved-v31.mjs',
    'scripts/guard-tex-ultra-how-to-use-v31.mjs',
    'src/services/texUltraHowToUseAudioFreezeRuntimeGuardV31.js',
    'src/services/texUltraHowToUseAudioService.js',
    'tests/tex-ultra-how-to-use-audio-v31.test.mjs'
];

const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

for (const spec of ancestorSpecs) {
    if (!exists(spec.path) || sha256(spec.path) !== spec.sha256) {
        throw new Error(`[TEX-ULTRA-USO-V31] manifesto ancestral divergente: ${spec.path}`);
    }
}
if (!exists(manifestRelativePath)) {
    throw new Error('[TEX-ULTRA-USO-V31] manifesto V31 ausente; startup bloqueado.');
}

const ancestors = ancestorSpecs.map((spec) => readJson(spec.path));
const manifest = readJson(manifestRelativePath);
for (let index = 0; index < ancestors.length; index += 1) {
    if (ancestors[index].freezeId !== ancestorSpecs[index].freezeId) {
        throw new Error(`[TEX-ULTRA-USO-V31] freeze ancestral inválido: ${ancestorSpecs[index].path}`);
    }
}
if (
    ancestors[1].parentFreezeId !== ancestors[0].freezeId
    || ancestors[2].parentFreezeId !== ancestors[1].freezeId
    || ancestors[3].parentFreezeId !== ancestors[2].freezeId
    || ancestors[4].parentFreezeId !== ancestors[3].freezeId
    || manifest.parentFreezeId !== ancestors[4].freezeId
    || manifest.parentManifestSha256 !== ancestorSpecs[4].sha256
) {
    throw new Error('[TEX-ULTRA-USO-V31] lineage V28 → V29 → V29.1 → V29.2 → V30 → V31 divergente.');
}

const expectedProtectedFiles = [...declaredParentOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
if (
    manifest.freezeId !== 'tex-ultra-how-to-use-audio-v31-20260821'
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_draft_pr_and_controlled_activation'
    || manifest.country !== 'EC'
    || manifest.productKey !== 'tex_ultra_ec'
    || manifest.baseProductionSha !== '7cd02383911f4660a577d84e58c58d0d00396d27'
    || manifest.operatorApproval?.status !== 'approved_in_thread'
    || manifest.operatorApproval?.approvedAt !== '2026-08-21T19:24:02Z'
    || manifest.operatorApproval?.scope !== 'implement_and_activate_tex_ultra_how_to_use_audio_v31_ec'
    || JSON.stringify(manifest.operatorApproval?.constraints || []) !== JSON.stringify([
        'no_mass_sends',
        'tex_ultra_only',
        'preserve_zapi',
        'real_inbound_canary_required_for_v30_provider_proof'
    ])
    || manifest.policy?.sharedPersistentDedupe !== true
    || manifest.policy?.pickupTrigger !== true
    || manifest.policy?.usageQuestionTrigger !== true
    || manifest.policy?.otherProductsPreserved !== true
    || manifest.policy?.v30Preserved !== true
    || manifest.policy?.commercialCoreChanged !== false
    || manifest.realEffectsAtFreeze?.whatsappMessage !== false
    || manifest.realEffectsAtFreeze?.massSend !== false
    || manifest.realEffectsAtFreeze?.order !== false
    || manifest.realEffectsAtFreeze?.dropi !== false
    || manifest.realEffectsAtFreeze?.metaCapi !== false
    || manifest.realEffectsAtFreeze?.officialDatabaseWrite !== false
    || manifest.realEffectsAtFreeze?.deploy !== false
    || JSON.stringify([...(manifest.declaredParentOverrides || [])].sort()) !== JSON.stringify(declaredParentOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[TEX-ULTRA-USO-V31] manifesto ou política inválida; startup bloqueado.');
}

for (let index = 0; index < ancestors.length; index += 1) {
    const laterOverrides = new Set(declaredParentOverrides);
    for (const later of ancestors.slice(index + 1)) {
        for (const relativePath of later.declaredParentOverrides || later.declaredAncestorOverrides || []) {
            laterOverrides.add(relativePath);
        }
    }
    for (const [relativePath, approvedHash] of Object.entries(ancestors[index].protectedFiles || {})) {
        if (laterOverrides.has(relativePath)) continue;
        if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[TEX-ULTRA-USO-V31] herança divergente em ${relativePath}.`);
        }
    }
}

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[TEX-ULTRA-USO-V31] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[TEX-ULTRA-USO-V31] lineage V28 → V31 verificada; áudio Tex Ultra isolado e ativação controlada autorizada.');
