import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/protocolo-g-tex-ultra-origin-v34-20260822.json';
const ancestorSpecs = [
    ['docs/freeze/customer-data-resolution-v28-20260818.json', 'customer-data-resolution-v28-20260818', 'b86645ebfbf87d7d84ed737e596ae34f8e21b57e84e615cb5070e6583484e4a3'],
    ['docs/freeze/logistics-clean-chat-v29-20260818.json', 'logistics-clean-chat-v29-20260818', '6569acc57662ac8aba1852836d68e77382dc650c373a3f94eafb44a5358950dc'],
    ['docs/freeze/deploy-integration-v29-1-20260818.json', 'deploy-integration-v29-1-20260818', 'c2e80fa82432eadef07850948bb654a789b6d4e6b9d1e238cbe11f86bfbc4fe1'],
    ['docs/freeze/guard-alias-integration-v29-2-20260818.json', 'guard-alias-integration-v29-2-20260818', 'aa41a329514f72b2b372c622c3bd992db0e5fe6d98a26902ebaf819a5b00e4ee'],
    ['docs/freeze/media-durability-auth-v30-20260821.json', 'media-durability-auth-v30-20260821', '417f17324d9fec08459e26d3c1a64078aa180bc94c4b5baabab766794c165647'],
    ['docs/freeze/tex-ultra-how-to-use-audio-v31-20260821.json', 'tex-ultra-how-to-use-audio-v31-20260821', '55edee6253fcc750f0ed99cd46768cbd8f01bed928587d6a494c700e1418b2bd'],
    ['docs/freeze/official-whatsapp-phone-test-v32-20260821.json', 'official-whatsapp-phone-test-v32-20260821', 'ac0ad90730931ec3f15fc6a0effe424044afffa88fc59b943901262f525d1e37'],
    ['docs/freeze/panel-image-csp-blob-v33-20260821.json', 'panel-image-csp-blob-v33-20260821', '0063a02dbc6bf44fa76c5d75ffffbefa28fd47a07de70813f581e4f1f81b5dc5']
].map(([filePath, freezeId, sha256]) => ({ path: filePath, freezeId, sha256 }));

const declaredParentOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'scripts/guard-official-whatsapp-phone-v32.mjs',
    'scripts/guard-panel-image-csp-v33.mjs',
    'scripts/senior-guard.mjs',
    'src/index.js',
    'src/routes/whatsapp.js',
    'src/routes/zapi.js',
    'tests/media-durability-auth-v30.test.mjs',
    'tests/panel-call-dropi-safety-v21.test.mjs',
    'tests/panel-image-csp-v33.test.mjs'
];
const newProtectedFiles = [
    'docs/PROTOCOLO_G_TEX_ULTRA_ORIGIN_FREEZE_V34_20260822.md',
    'scripts/assert-protocolo-g-tex-ultra-activation-approved-v34.mjs',
    'scripts/guard-protocolo-g-tex-ultra-v34.mjs',
    'src/services/protocoloGTexUltraFreezeRuntimeGuardV34.js',
    'src/services/vslProductAssignmentService.js',
    'tests/protocolo-g-tex-ultra-origin-v34.test.mjs'
];

const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

for (const spec of ancestorSpecs) {
    if (!exists(spec.path) || sha256(spec.path) !== spec.sha256) {
        throw new Error(`[PROTOCOLO-G-TEX-ULTRA-V34] manifesto ancestral divergente: ${spec.path}`);
    }
}
if (!exists(manifestRelativePath)) {
    throw new Error('[PROTOCOLO-G-TEX-ULTRA-V34] manifesto V34 ausente; startup bloqueado.');
}

const ancestors = ancestorSpecs.map((spec) => readJson(spec.path));
const manifest = readJson(manifestRelativePath);
for (let index = 0; index < ancestors.length; index += 1) {
    if (ancestors[index].freezeId !== ancestorSpecs[index].freezeId) {
        throw new Error(`[PROTOCOLO-G-TEX-ULTRA-V34] freeze ancestral inválido: ${ancestorSpecs[index].path}`);
    }
    if (index > 0 && ancestors[index].parentFreezeId !== ancestors[index - 1].freezeId) {
        throw new Error('[PROTOCOLO-G-TEX-ULTRA-V34] linhagem ancestral divergente.');
    }
}
if (
    manifest.parentFreezeId !== ancestors.at(-1).freezeId
    || manifest.parentManifestSha256 !== ancestorSpecs.at(-1).sha256
) {
    throw new Error('[PROTOCOLO-G-TEX-ULTRA-V34] linhagem V28 → V34 divergente.');
}

const expectedProtectedFiles = [...declaredParentOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
if (
    manifest.freezeId !== 'protocolo-g-tex-ultra-origin-v34-20260822'
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_draft_pr_and_controlled_activation'
    || manifest.country !== 'EC'
    || manifest.baseProductionSha !== '4bd6903a9f470fb075554670348743bf3e59735c'
    || manifest.operatorApproval?.status !== 'approved_in_thread'
    || manifest.operatorApproval?.approvedAt !== '2026-08-22T00:05:46Z'
    || manifest.operatorApproval?.scope !== 'protocolo_g_tex_ultra_independent_product_origin_v34'
    || JSON.stringify(manifest.operatorApproval?.constraints || []) !== JSON.stringify([
        'protocolo_g_routes_tex_ultra',
        'legacy_vit_power_pixel_name_preserved',
        'manual_product_selection_preserved_per_customer',
        'other_vsl_products_preserved',
        'customer_data_quality_gate_preserved',
        'no_whatsapp_sends'
    ])
    || manifest.policy?.protocoloGProductKey !== 'tex_ultra_ec'
    || manifest.policy?.legacyVitPowerPixelNamePreserved !== true
    || manifest.policy?.independentVslProductRouting !== true
    || manifest.policy?.manualCustomerProductOverridePreserved !== true
    || manifest.policy?.customerDataQualityGatePreserved !== true
    || manifest.policy?.officialWhatsappPhonePreserved !== true
    || manifest.policy?.pricesChanged !== false
    || manifest.policy?.dropiChanged !== false
    || manifest.policy?.metaPixelChanged !== false
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
    throw new Error('[PROTOCOLO-G-TEX-ULTRA-V34] manifesto ou política inválida; startup bloqueado.');
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
            throw new Error(`[PROTOCOLO-G-TEX-ULTRA-V34] herança divergente em ${relativePath}.`);
        }
    }
}

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[PROTOCOLO-G-TEX-ULTRA-V34] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[PROTOCOLO-G-TEX-ULTRA-V34] origem Tex Ultra independente; seleção manual e V28–V33 preservadas.');
