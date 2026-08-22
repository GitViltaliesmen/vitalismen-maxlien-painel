import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/ec-direct-product-name-postsale-v39-20260822.json';
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
    ['docs/freeze/panel-zapi-auth-status-v37-20260822.json', 'panel-zapi-auth-status-v37-20260822', 'f10f437eb91834d77e96df9d76ec1cc31dd3b7daa7ffdc2962bbd25faf8a86e6'],
    ['docs/freeze/inbound-media-path-portability-v38-20260822.json', 'inbound-media-path-portability-v38-20260822', 'e9a0d920c66d0bf86c7ff122cb0a02ac615d6b0b40c492811ef94fac13e088c5']
].map(([filePath, freezeId, sha256]) => ({ path: filePath, freezeId, sha256 }));

const declaredParentOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'public/qr.html',
    'scripts/guard-ec-all-products-ingredients-v36.mjs',
    'scripts/guard-ec-product-ingredients-v35.mjs',
    'scripts/guard-inbound-media-path-portability-v38.mjs',
    'scripts/guard-official-whatsapp-phone-v32.mjs',
    'scripts/guard-panel-image-csp-v33.mjs',
    'scripts/guard-panel-zapi-auth-status-v37.mjs',
    'scripts/guard-protocolo-g-tex-ultra-v34.mjs',
    'scripts/senior-guard.mjs',
    'src/index.js',
    'src/routes/whatsapp.js',
    'src/routes/zapi.js',
    'src/services/agentRouter.js',
    'src/services/conversationEngine.js',
    'src/services/texUltraConfirmedPostSaleLayerService.js',
    'tests/inbound-media-path-portability-v38.test.mjs',
    'tests/media-durability-auth-v30.test.mjs',
    'tests/panel-call-dropi-safety-v21.test.mjs',
    'tests/panel-image-csp-v33.test.mjs'
];

const newProtectedFiles = [
    'approved_freezes/APPROVED_EC_DIRECT_PRODUCT_NAME_POSTSALE_V39_20260822.txt',
    'docs/EC_DIRECT_PRODUCT_NAME_POSTSALE_FREEZE_V39_20260822.md',
    'scripts/assert-ec-direct-product-name-postsale-activation-approved-v39.mjs',
    'scripts/guard-ec-direct-product-name-postsale-v39.mjs',
    'scripts/lint-js-syntax.mjs',
    'src/services/ecDirectProductInquiryService.js',
    'src/services/ecDirectProductNameFreezeRuntimeGuardV39.js',
    'tests/ec-direct-product-name-v39.test.mjs'
];

const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

for (const spec of ancestorSpecs) {
    if (!exists(spec.path) || sha256(spec.path) !== spec.sha256) {
        throw new Error(`[EC-DIRECT-PRODUCT-NAME-POSTSALE-V39] manifesto ancestral divergente: ${spec.path}`);
    }
}
if (!exists(manifestRelativePath)) {
    throw new Error('[EC-DIRECT-PRODUCT-NAME-POSTSALE-V39] manifesto V39 ausente; startup bloqueado.');
}

const ancestors = ancestorSpecs.map((spec) => readJson(spec.path));
const manifest = readJson(manifestRelativePath);
for (let index = 0; index < ancestors.length; index += 1) {
    if (ancestors[index].freezeId !== ancestorSpecs[index].freezeId) {
        throw new Error(`[EC-DIRECT-PRODUCT-NAME-POSTSALE-V39] freeze ancestral inválido: ${ancestorSpecs[index].path}`);
    }
    if (index > 0 && ancestors[index].parentFreezeId !== ancestors[index - 1].freezeId) {
        throw new Error('[EC-DIRECT-PRODUCT-NAME-POSTSALE-V39] linhagem ancestral divergente.');
    }
}
if (
    manifest.parentFreezeId !== ancestors.at(-1).freezeId
    || manifest.parentManifestSha256 !== ancestorSpecs.at(-1).sha256
) {
    throw new Error('[EC-DIRECT-PRODUCT-NAME-POSTSALE-V39] linhagem V28 → V39 divergente.');
}

const expectedProtectedFiles = [...declaredParentOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
if (
    manifest.freezeId !== 'ec-direct-product-name-postsale-v39-20260822'
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.baseProductionSha !== 'dbc3cbd1b910e27a7673b8c90c80d740478f5cec'
    || manifest.operatorApproval?.status !== 'implementation_approved'
    || manifest.operatorApproval?.approvedAt !== '2026-08-22T15:08:06Z'
    || manifest.operatorApproval?.scope !== 'ec_direct_product_name_postsale_v39'
    || manifest.operatorActivationApproval?.status !== 'approved_in_thread'
    || manifest.operatorActivationApproval?.approvedAt !== '2026-08-22T15:08:06Z'
    || manifest.operatorActivationApproval?.scope !== 'ec_direct_product_name_postsale_v39'
    || manifest.policy?.applicationRuntimeChanged !== true
    || manifest.policy?.directProductInquiryAdded !== true
    || manifest.policy?.normalPriceBeforeObjection !== true
    || manifest.policy?.promotionRequiresExplicitPriceObjection !== true
    || manifest.policy?.automaticCustomerNameAdded !== true
    || manifest.policy?.postSaleHistoryGuardAdded !== true
    || manifest.policy?.vslOriginChanged !== false
    || manifest.policy?.checkoutChanged !== false
    || manifest.policy?.dropiChanged !== false
    || manifest.policy?.metaCapiChanged !== false
    || manifest.policy?.officialPricesChanged !== false
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
    throw new Error('[EC-DIRECT-PRODUCT-NAME-POSTSALE-V39] manifesto ou política inválida; startup bloqueado.');
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
            throw new Error(`[EC-DIRECT-PRODUCT-NAME-POSTSALE-V39] herança divergente em ${relativePath}.`);
        }
    }
}

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[EC-DIRECT-PRODUCT-NAME-POSTSALE-V39] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[EC-DIRECT-PRODUCT-NAME-POSTSALE-V39] camada congelada: direto normal→objeção, nome e anti-reenvio ativos.');
