import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/inbound-media-path-portability-v38-20260822.json';
const ancestorSpecs = [
    ['docs/freeze/customer-data-resolution-v28-20260818.json', 'customer-data-resolution-v28-20260818', 'b86645ebfbf87d7d84ed737e596ae34f8e21b57e84e615cb5070e6583484e4a3'],
    ['docs/freeze/logistics-clean-chat-v29-20260818.json', 'logistics-clean-chat-v29-20260818', '6569acc57662ac8aba1852836d68e77382dc650c373a3f94eafb44a5358950dc'],
    ['docs/freeze/deploy-integration-v29-1-20260818.json', 'deploy-integration-v29-1-20260818', 'c2e80fa82432eadef07850948bb654a789b6d4e6b9d1e238cbe11f86bfbc4fe1'],
    ['docs/freeze/guard-alias-integration-v29-2-20260818.json', 'guard-alias-integration-v29-2-20260818', 'aa41a329514f72b2b372c622c3bd992db0e5fe6d98a26902ebaf819a5b00e4ee'],
    ['docs/freeze/media-durability-auth-v30-20260821.json', 'media-durability-auth-v30-20260821', '417f17324d9fec08459e26d3c1a64078aa180bc94c4b5baabab766794c165647'],
    ['docs/freeze/tex-ultra-how-to-use-audio-v31-20260821.json', 'tex-ultra-how-to-use-audio-v31-20260821', '55edee6253fcc750f0ed99cd46768cbd8f01bed928587d6a494c700e1418b2bd'],
    ['docs/freeze/official-whatsapp-phone-test-v32-20260821.json', 'official-whatsapp-phone-test-v32-20260821', 'ac0ad90730931ec3f15fc6a0effe424044afffa88fc59b943901262f525d1e37'],
    ['docs/freeze/panel-image-csp-blob-v33-20260821.json', 'panel-image-csp-blob-v33-20260821', '0063a02dbc6bf44fa76c5d75ffffbefa28fd47a07de70813f581e4f1f81b5dc5'],
    ['docs/freeze/protocolo-g-tex-ultra-origin-v34-20260822.json', 'protocolo-g-tex-ultra-origin-v34-20260822', 'aa780b5f845fc10483a83a446cc5c8b91299149d09f3e8732eae0a0be0975c94'],
    ['docs/freeze/ec-product-ingredients-v35-20260822.json', 'ec-product-ingredients-v35-20260822', '59892692a76472715d5bf0b256f65e5d8537490341277a070fb7e7f8e34cb0ae'],
    ['docs/freeze/ec-all-products-ingredients-v36-20260822.json', 'ec-all-products-ingredients-v36-20260822', '338f4591991ff48998366d7c02e92a748e98315c2da35030fff4b641246ee09a'],
    ['docs/freeze/panel-zapi-auth-status-v37-20260822.json', 'panel-zapi-auth-status-v37-20260822', 'f10f437eb91834d77e96df9d76ec1cc31dd3b7daa7ffdc2962bbd25faf8a86e6']
].map(([filePath, freezeId, sha256]) => ({ path: filePath, freezeId, sha256 }));

const declaredParentOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'scripts/guard-ec-all-products-ingredients-v36.mjs',
    'scripts/guard-ec-product-ingredients-v35.mjs',
    'scripts/guard-official-whatsapp-phone-v32.mjs',
    'scripts/guard-panel-image-csp-v33.mjs',
    'scripts/guard-panel-zapi-auth-status-v37.mjs',
    'scripts/guard-protocolo-g-tex-ultra-v34.mjs',
    'scripts/senior-guard.mjs',
    'src/index.js',
    'tests/inbound-media-storage.test.mjs',
    'tests/media-durability-auth-v30.test.mjs',
    'tests/panel-call-dropi-safety-v21.test.mjs',
    'tests/panel-image-csp-v33.test.mjs'
];
const newProtectedFiles = [
    'docs/INBOUND_MEDIA_PATH_PORTABILITY_FREEZE_V38_20260822.md',
    'scripts/assert-inbound-media-path-portability-activation-approved-v38.mjs',
    'scripts/guard-inbound-media-path-portability-v38.mjs',
    'src/services/inboundMediaPathPortabilityFreezeRuntimeGuardV38.js',
    'tests/inbound-media-path-portability-v38.test.mjs'
];

const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

for (const spec of ancestorSpecs) {
    if (!exists(spec.path) || sha256(spec.path) !== spec.sha256) {
        throw new Error(`[INBOUND-MEDIA-PATH-PORTABILITY-V38] manifesto ancestral divergente: ${spec.path}`);
    }
}
if (!exists(manifestRelativePath)) {
    throw new Error('[INBOUND-MEDIA-PATH-PORTABILITY-V38] manifesto V38 ausente; startup bloqueado.');
}

const ancestors = ancestorSpecs.map((spec) => readJson(spec.path));
const manifest = readJson(manifestRelativePath);
for (let index = 0; index < ancestors.length; index += 1) {
    if (ancestors[index].freezeId !== ancestorSpecs[index].freezeId) {
        throw new Error(`[INBOUND-MEDIA-PATH-PORTABILITY-V38] freeze ancestral inválido: ${ancestorSpecs[index].path}`);
    }
    if (index > 0 && ancestors[index].parentFreezeId !== ancestors[index - 1].freezeId) {
        throw new Error('[INBOUND-MEDIA-PATH-PORTABILITY-V38] linhagem ancestral divergente.');
    }
}
if (
    manifest.parentFreezeId !== ancestors.at(-1).freezeId
    || manifest.parentManifestSha256 !== ancestorSpecs.at(-1).sha256
) {
    throw new Error('[INBOUND-MEDIA-PATH-PORTABILITY-V38] linhagem V28 → V38 divergente.');
}

const expectedProtectedFiles = [...declaredParentOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
if (
    manifest.freezeId !== 'inbound-media-path-portability-v38-20260822'
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_controlled_activation'
    || manifest.country !== 'EC'
    || manifest.baseProductionSha !== '680e9c693270a18edd0aa7dc1031e6f09bb53b2d'
    || manifest.operatorApproval?.status !== 'implementation_approved'
    || manifest.operatorApproval?.approvedAt !== '2026-08-22T14:15:52Z'
    || manifest.operatorApproval?.scope !== 'inbound_media_path_portability_v38'
    || JSON.stringify(manifest.operatorApproval?.constraints || []) !== JSON.stringify([
        'test_only_portability_adjustment',
        'linux_production_path_contract_preserved',
        'windows_local_path_uses_native_resolver',
        'no_application_runtime_change',
        'no_whatsapp_media_funnel_price_order_or_post_sale_change',
        'no_real_effects_or_deploy'
    ])
    || manifest.operatorActivationApproval?.status !== 'approved_in_thread'
    || manifest.operatorActivationApproval?.approvedAt !== '2026-08-22T14:27:24Z'
    || manifest.operatorActivationApproval?.scope !== 'inbound_media_path_portability_v38'
    || JSON.stringify(manifest.operatorActivationApproval?.constraints || []) !== JSON.stringify([
        'commit_push_pr_ci_backup_tag_and_transactional_activation',
        'no_runtime_media_behavior_change',
        'single_use_root_permit',
        'verify_current_pm2_health_and_domain',
        'preserve_previous_release_for_rollback'
    ])
    || manifest.policy?.testOnlyChange !== true
    || manifest.policy?.applicationRuntimeChanged !== false
    || manifest.policy?.linuxProductionPathContractChanged !== false
    || manifest.policy?.windowsNativePathExpected !== true
    || manifest.policy?.testSkippedOnWindows !== false
    || manifest.policy?.pricesChanged !== false
    || manifest.policy?.mediaBehaviorChanged !== false
    || manifest.policy?.funnelChanged !== false
    || manifest.policy?.orderChanged !== false
    || manifest.policy?.postSaleChanged !== false
    || manifest.policy?.deployAuthorized !== true
    || manifest.realEffectsAtFreeze?.whatsappMessage !== false
    || manifest.realEffectsAtFreeze?.order !== false
    || manifest.realEffectsAtFreeze?.dropi !== false
    || manifest.realEffectsAtFreeze?.metaCapi !== false
    || manifest.realEffectsAtFreeze?.officialDatabaseWrite !== false
    || manifest.realEffectsAtFreeze?.deploy !== false
    || JSON.stringify([...(manifest.declaredParentOverrides || [])].sort()) !== JSON.stringify(declaredParentOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[INBOUND-MEDIA-PATH-PORTABILITY-V38] manifesto ou política inválida; startup bloqueado.');
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
            throw new Error(`[INBOUND-MEDIA-PATH-PORTABILITY-V38] herança divergente em ${relativePath}.`);
        }
    }
}

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[INBOUND-MEDIA-PATH-PORTABILITY-V38] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[INBOUND-MEDIA-PATH-PORTABILITY-V38] teste portátil; runtime de mídia e freezes V28–V37 preservados.');
