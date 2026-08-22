import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const successorOverrides = new Set(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []);
const parentManifestPath = 'docs/freeze/ec-repurchase-sync-preservation-v46-20260822.json';
const parentManifestSha256 = '42249b08bf742479d0c890058463ba2206ea9cee3e1370700e65f89170f3f2fd';
const manifestPath = 'docs/freeze/ec-repurchase-sqlite-serialization-v47-20260822.json';
const lineageSpecs = [
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
    ['docs/freeze/inbound-media-path-portability-v38-20260822.json', 'inbound-media-path-portability-v38-20260822', 'e9a0d920c66d0bf86c7ff122cb0a02ac615d6b0b40c492811ef94fac13e088c5'],
    ['docs/freeze/ec-direct-product-name-postsale-v39-20260822.json', 'ec-direct-product-name-postsale-v39-20260822', 'f998b597afc528795c53afb3a9736fcbbd61efdcf19a6a685053023fa689f63d'],
    ['docs/freeze/ec-engagement-internal-bucket-v40-20260822.json', 'ec-engagement-internal-bucket-v40-20260822', '535541c6fbeb55c6722fe1bd1a80766d55e6533592e4f7ea8b7458ed877765c6'],
    ['docs/freeze/panel-client-search-v41-20260822.json', 'panel-client-search-v41-20260822', 'a5f6c2a44621e3887f23b88384eea2ae3612fef54501b8a99aef5cb3201a94f7'],
    ['docs/freeze/ec-engagement-command-reply-v42-20260822.json', 'ec-engagement-command-reply-v42-20260822', '3dfb04a48226b960f42d59829c347b4ba83a45876039cc8020b4fa761386611d'],
    ['docs/freeze/ec-engagement-priority-v43-20260822.json', 'ec-engagement-priority-v43-20260822', 'ab4cecc831102ab1257f0f37b6ef8730aaab5a57e63f7759fcdcf0622ffe6034'],
    ['docs/freeze/panel-global-new-messages-v44-20260822.json', 'panel-global-new-messages-v44-20260822', '239795973a82cec2beea290e449298641b42bb8a4e0627e7a352e71509cb97c5'],
    ['docs/freeze/ec-delivered-repurchase-v45-20260822.json', 'ec-delivered-repurchase-v45-20260822', '610708aa94f6d96efc2dc544c7154fbd1c5716662217d76838f00396a93ffa92'],
    [parentManifestPath, 'ec-repurchase-sync-preservation-v46-20260822', parentManifestSha256]
].map(([filePath, freezeId, sha256]) => ({ path: filePath, freezeId, sha256 }));

const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'scripts/guard-panel-client-search-v41.mjs',
    'scripts/senior-guard.mjs',
    'src/services/adminPanelStatusService.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'tests/panel-client-search-v41.test.mjs'
];

const newProtectedFiles = [
    'approved_freezes/APPROVED_EC_REPURCHASE_SQLITE_SERIALIZATION_V47_20260822.txt',
    'docs/EC_REPURCHASE_SQLITE_SERIALIZATION_FREEZE_V47_20260822.md',
    'scripts/assert-ec-repurchase-sqlite-activation-approved-v47.mjs',
    'scripts/guard-ec-repurchase-sqlite-serialization-v47.mjs',
    'src/services/ecRepurchaseSqliteSerializationFreezeRuntimeGuardV47.js',
    'tests/ec-repurchase-sqlite-serialization-v47.test.mjs'
];

const absolute = (relativePath) => path.join(root, relativePath);
const exists = (relativePath) => fs.existsSync(absolute(relativePath));
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(absolute(relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));

for (const spec of lineageSpecs) {
    if (!exists(spec.path) || sha256(spec.path) !== spec.sha256) {
        throw new Error(`[EC-REPURCHASE-SQLITE-V47] manifesto ancestral divergente: ${spec.path}`);
    }
}
if (!exists(manifestPath)) {
    throw new Error('[EC-REPURCHASE-SQLITE-V47] manifesto V47 ausente; startup bloqueado.');
}

const lineage = lineageSpecs.map((spec) => readJson(spec.path));
const parent = lineage.at(-1);
const manifest = readJson(manifestPath);
const expectedProtectedFiles = [...declaredAncestorOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();

if (
    parent.freezeId !== 'ec-repurchase-sync-preservation-v46-20260822'
    || manifest.freezeId !== 'ec-repurchase-sqlite-serialization-v47-20260822'
    || manifest.parentFreezeId !== parent.freezeId
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.country !== 'EC'
    || manifest.operatorApproval?.status !== 'implementation_activation_and_target_resync_approved'
    || manifest.policy?.repurchaseCycleIntegerOnly !== true
    || manifest.policy?.preserveExistingOrder !== true
    || manifest.policy?.preservePurchaseEvent !== true
    || manifest.policy?.duplicateOrderAllowed !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.deployAuthorized !== true
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) {
    throw new Error('[EC-REPURCHASE-SQLITE-V47] manifesto ou política inválida; startup bloqueado.');
}

const overrides = new Set(declaredAncestorOverrides);
for (let index = 0; index < lineage.length; index += 1) {
    const current = lineage[index];
    const spec = lineageSpecs[index];
    if (current.freezeId !== spec.freezeId) {
        throw new Error(`[EC-REPURCHASE-SQLITE-V47] freeze ancestral inválido: ${spec.path}`);
    }
    if (index > 0 && current.parentFreezeId !== lineage[index - 1].freezeId) {
        throw new Error('[EC-REPURCHASE-SQLITE-V47] linhagem V28 → V46 divergente.');
    }
    const laterOverrides = new Set(overrides);
    for (const later of lineage.slice(index + 1)) {
        for (const relativePath of later.declaredParentOverrides || later.declaredAncestorOverrides || []) {
            laterOverrides.add(relativePath);
        }
    }
    for (const [relativePath, approvedHash] of Object.entries(current.protectedFiles || {})) {
        if (laterOverrides.has(relativePath) || successorOverrides.has(relativePath)) continue;
        if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[EC-REPURCHASE-SQLITE-V47] herança divergente em ${relativePath}.`);
        }
    }
}

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[EC-REPURCHASE-SQLITE-V47] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[EC-REPURCHASE-SQLITE-V47] ciclo da recompra serializado como inteiro para SQLite.');
