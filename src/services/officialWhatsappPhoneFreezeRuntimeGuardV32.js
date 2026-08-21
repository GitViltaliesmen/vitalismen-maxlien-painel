import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/official-whatsapp-phone-test-v32-20260821.json';
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
    },
    {
        path: 'docs/freeze/tex-ultra-how-to-use-audio-v31-20260821.json',
        freezeId: 'tex-ultra-how-to-use-audio-v31-20260821',
        sha256: '55edee6253fcc750f0ed99cd46768cbd8f01bed928587d6a494c700e1418b2bd'
    }
];
const declaredParentOverrides = [
    '.env.example',
    'AGENTS.md',
    'FREEZE_LOCK_EC.json',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'docs/WHATSAPP_POOL_ATE_6_NUMEROS.md',
    'package.json',
    'public/n/index.html',
    'public/qr.html',
    'scripts/apply-historical-client-consolidation.mjs',
    'scripts/audit-ec-nitrix-guard.mjs',
    'scripts/audit-historical-client-consolidation.mjs',
    'scripts/plan-2800-failover-rescue.mjs',
    'scripts/reconcile-whatsapp-to-unified-panel.mjs',
    'scripts/send-opt-in-rescue-bonus.mjs',
    'src/index.js',
    'src/routes/whatsapp.js',
    'tests/media-durability-auth-v30.test.mjs',
    'tests/panel-call-dropi-safety-v21.test.mjs'
];
const newProtectedFiles = [
    'approved_freezes/APPROVED_FREEZE_EC_20260821221511.md',
    'docs/OFFICIAL_WHATSAPP_PHONE_TEST_V32_20260821.md',
    'scripts/assert-official-whatsapp-phone-activation-approved-v32.mjs',
    'scripts/guard-official-whatsapp-phone-v32.mjs',
    'src/services/officialWhatsappPhoneFreezeRuntimeGuardV32.js',
    'tests/official-whatsapp-phone-v32.test.mjs'
];

const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

for (const spec of ancestorSpecs) {
    if (!exists(spec.path) || sha256(spec.path) !== spec.sha256) {
        throw new Error(`[WHATSAPP-PHONE-V32] manifesto ancestral divergente: ${spec.path}`);
    }
}
if (!exists(manifestRelativePath)) {
    throw new Error('[WHATSAPP-PHONE-V32] manifesto V32 ausente; startup bloqueado.');
}

const ancestors = ancestorSpecs.map((spec) => readJson(spec.path));
const manifest = readJson(manifestRelativePath);
for (let index = 0; index < ancestors.length; index += 1) {
    if (ancestors[index].freezeId !== ancestorSpecs[index].freezeId) {
        throw new Error(`[WHATSAPP-PHONE-V32] freeze ancestral inválido: ${ancestorSpecs[index].path}`);
    }
}
if (
    ancestors[1].parentFreezeId !== ancestors[0].freezeId
    || ancestors[2].parentFreezeId !== ancestors[1].freezeId
    || ancestors[3].parentFreezeId !== ancestors[2].freezeId
    || ancestors[4].parentFreezeId !== ancestors[3].freezeId
    || ancestors[5].parentFreezeId !== ancestors[4].freezeId
    || manifest.parentFreezeId !== ancestors[5].freezeId
    || manifest.parentManifestSha256 !== ancestorSpecs[5].sha256
) {
    throw new Error('[WHATSAPP-PHONE-V32] lineage V28 → V32 divergente.');
}

const expectedProtectedFiles = [...declaredParentOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
if (
    manifest.freezeId !== 'official-whatsapp-phone-test-v32-20260821'
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_draft_pr_and_controlled_activation'
    || manifest.country !== 'EC'
    || manifest.baseProductionSha !== '03cee3af70538862a5424d4e3e4266577eab435c'
    || manifest.operatorApproval?.status !== 'approved_in_thread'
    || manifest.operatorApproval?.approvedAt !== '2026-08-21T22:05:22Z'
    || manifest.operatorApproval?.scope !== 'correct_official_whatsapp_phone_and_enable_test_media_v32'
    || JSON.stringify(manifest.operatorApproval?.constraints || []) !== JSON.stringify([
        'no_mass_sends',
        'official_phone_only_5515991418416',
        'test_phone_only_5515998038637',
        'preserve_zapi',
        'no_customer_data_changes'
    ])
    || manifest.policy?.officialPhone !== '5515991418416'
    || manifest.policy?.testPhone !== '5515998038637'
    || manifest.policy?.zapiPreserved !== true
    || manifest.policy?.otherBrazilianOperationalPhonesAllowed !== false
    || manifest.policy?.customerDataChanged !== false
    || manifest.policy?.massSendAllowed !== false
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
    throw new Error('[WHATSAPP-PHONE-V32] manifesto ou política inválida; startup bloqueado.');
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
            throw new Error(`[WHATSAPP-PHONE-V32] herança divergente em ${relativePath}.`);
        }
    }
}

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (!exists(relativePath) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[WHATSAPP-PHONE-V32] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[WHATSAPP-PHONE-V32] número oficial 8416 e QA 8637 verificados; Z-API preservada.');
