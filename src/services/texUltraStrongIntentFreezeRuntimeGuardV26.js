import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/tex-ultra-strong-intent-v26-20260818.json';
const parentManifestRelativePath = 'docs/freeze/tex-ultra-entry-interrupt-v25-20260818.json';
const expectedFreezeId = 'tex-ultra-strong-intent-v26-20260818';
const expectedParentFreezeId = 'tex-ultra-entry-interrupt-v25-20260818';
const expectedParentManifestSha = '9de0f7780682fe49984db352729c07b2385d728dadc18c1fad4c86bb5f3e135e';
const declaredParentOverrides = [
    '.github/workflows/ec-panel-quality.yml',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'src/index.js',
    'src/services/texUltraFunnelService.js',
    'tests/panel-call-dropi-safety-v21.test.mjs'
];
const newProtectedFiles = [
    'docs/TEX_ULTRA_STRONG_INTENT_FREEZE_V26_20260818.md',
    'scripts/assert-tex-ultra-strong-intent-approved-v26.mjs',
    'scripts/guard-tex-ultra-strong-intent-v26.mjs',
    'src/services/texUltraStrongIntentFreezeRuntimeGuardV26.js',
    'tests/tex-ultra-strong-intent-v26.test.mjs'
];

const required = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true'
    || String(process.env.TEX_ULTRA_STRONG_INTENT_FREEZE_REQUIRED || '').toLowerCase() === 'true';
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const parentPath = path.join(root, parentManifestRelativePath);
const manifestPath = path.join(root, manifestRelativePath);
if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[TEX-ULTRA-STRONG-INTENT-V26] manifesto ausente; startup bloqueado.');
} else {
    if (!fs.existsSync(parentPath) || sha256(parentManifestRelativePath) !== expectedParentManifestSha) {
        throw new Error('[TEX-ULTRA-STRONG-INTENT-V26] manifesto pai V25 ausente ou divergente; startup bloqueado.');
    }
    const parent = readJson(parentManifestRelativePath);
    const manifest = readJson(manifestRelativePath);
    const expectedProtectedFiles = [...declaredParentOverrides, ...newProtectedFiles].sort();
    const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
    const publicationStatusAllowed = manifest.publicationStatus === 'local_candidate_not_authorized'
        || (
            manifest.publicationStatus === 'approved_for_publication'
            && manifest.operatorPublicationApproval?.status === 'approved_in_thread'
            && manifest.operatorPublicationApproval?.scope === 'controlled_deploy_v26_test_phone_5515998038637'
            && Boolean(manifest.operatorPublicationApproval?.approvedAt)
        );
    if (
        parent.freezeId !== expectedParentFreezeId
        || manifest.freezeId !== expectedFreezeId
        || manifest.parentFreezeId !== expectedParentFreezeId
        || manifest.parentManifestSha256 !== expectedParentManifestSha
        || manifest.status !== 'implementation_candidate_locked'
        || !publicationStatusAllowed
        || manifest.country !== 'EC'
        || manifest.requiresWrittenAuthorizationToChange !== true
        || manifest.operatorApproval?.status !== 'approved_in_thread'
        || manifest.operatorApproval?.scope !== 'tex_ultra_strong_purchase_intent_and_post_offer_question_handoff'
        || manifest.policy?.strongPurchaseIntentRoutesToQuantity !== true
        || manifest.policy?.contextualQuantityRecognized !== true
        || manifest.policy?.freeQuestionHumanHandoffAfterOffer !== true
        || manifest.policy?.initialCadencePreserved !== true
        || manifest.policy?.v25GreetingAndTimingPreserved !== true
        || manifest.policy?.productionChanged !== false
        || JSON.stringify([...(manifest.declaredParentOverrides || [])].sort()) !== JSON.stringify(declaredParentOverrides)
        || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
        || protectedFiles.length !== expectedProtectedFiles.length
        || expectedProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
        || declaredParentOverrides.some((relativePath) => !Object.hasOwn(parent.protectedFiles || {}, relativePath))
    ) {
        throw new Error('[TEX-ULTRA-STRONG-INTENT-V26] manifesto ou politica invalida; startup bloqueado.');
    }
    for (const [relativePath, approvedHash] of Object.entries(parent.protectedFiles || {})) {
        if (declaredParentOverrides.includes(relativePath)) continue;
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[TEX-ULTRA-STRONG-INTENT-V26] heranca V25 divergente em ${relativePath}; startup bloqueado.`);
        }
    }
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[TEX-ULTRA-STRONG-INTENT-V26] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
    const publicationMessage = manifest.publicationStatus === 'approved_for_publication'
        ? 'publicacao controlada aprovada, sem ativacao automatica'
        : 'publicacao permanece bloqueada ate autorizacao explicita';
    console.log(`[TEX-ULTRA-STRONG-INTENT-V26] ${expectedFreezeId} verificado; ${publicationMessage}.`);
}
