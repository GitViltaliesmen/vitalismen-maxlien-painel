import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/tex-ultra-vsl-payload-v27-20260818.json';
const parentManifestRelativePath = 'docs/freeze/tex-ultra-strong-intent-v26-20260818.json';
const expectedFreezeId = 'tex-ultra-vsl-payload-v27-20260818';
const expectedParentFreezeId = 'tex-ultra-strong-intent-v26-20260818';
const expectedParentManifestSha = '2b55a9aa30fab90ea98103f562ce471ba476e0eeede4ce3d951d0c74c0758ce0';
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
    'docs/TEX_ULTRA_VSL_PAYLOAD_FREEZE_V27_20260818.md',
    'scripts/assert-tex-ultra-vsl-payload-approved-v27.mjs',
    'scripts/guard-tex-ultra-vsl-payload-v27.mjs',
    'src/services/texUltraVslPayloadFreezeRuntimeGuardV27.js',
    'tests/tex-ultra-vsl-payload-v27.test.mjs'
];

const required = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true'
    || String(process.env.TEX_ULTRA_VSL_PAYLOAD_FREEZE_REQUIRED || '').toLowerCase() === 'true';
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const parentPath = path.join(root, parentManifestRelativePath);
const manifestPath = path.join(root, manifestRelativePath);
if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[TEX-ULTRA-VSL-PAYLOAD-V27] manifesto ausente; startup bloqueado.');
} else {
    if (!fs.existsSync(parentPath) || sha256(parentManifestRelativePath) !== expectedParentManifestSha) {
        throw new Error('[TEX-ULTRA-VSL-PAYLOAD-V27] manifesto pai V26 ausente ou divergente; startup bloqueado.');
    }
    const parent = readJson(parentManifestRelativePath);
    const manifest = readJson(manifestRelativePath);
    const expectedProtectedFiles = [...declaredParentOverrides, ...newProtectedFiles].sort();
    const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
    const publicationStatusAllowed = manifest.publicationStatus === 'local_candidate_not_authorized'
        || (
            manifest.publicationStatus === 'approved_for_publication'
            && manifest.operatorPublicationApproval?.status === 'approved_in_thread'
            && manifest.operatorPublicationApproval?.scope === 'controlled_deploy_v27_test_phone_5515998038637'
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
        || manifest.operatorApproval?.scope !== 'accept_official_multiline_vsl_payload_without_changing_vsl'
        || manifest.policy?.exactOfficialMultilinePayload !== true
        || manifest.policy?.captureNameCityProvinceOnly !== true
        || manifest.policy?.captureBeforeCadence !== true
        || manifest.policy?.preserveExistingDraftValues !== true
        || manifest.policy?.skipKnownFieldsAfterQuantity !== true
        || manifest.policy?.v26BehaviorPreserved !== true
        || manifest.policy?.vslChanged !== false
        || manifest.policy?.productionChanged !== false
        || JSON.stringify([...(manifest.declaredParentOverrides || [])].sort()) !== JSON.stringify(declaredParentOverrides)
        || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
        || protectedFiles.length !== expectedProtectedFiles.length
        || expectedProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
        || declaredParentOverrides.some((relativePath) => !Object.hasOwn(parent.protectedFiles || {}, relativePath))
    ) {
        throw new Error('[TEX-ULTRA-VSL-PAYLOAD-V27] manifesto ou politica invalida; startup bloqueado.');
    }
    for (const [relativePath, approvedHash] of Object.entries(parent.protectedFiles || {})) {
        if (declaredParentOverrides.includes(relativePath)) continue;
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[TEX-ULTRA-VSL-PAYLOAD-V27] heranca V26 divergente em ${relativePath}; startup bloqueado.`);
        }
    }
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[TEX-ULTRA-VSL-PAYLOAD-V27] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
    const publicationMessage = manifest.publicationStatus === 'approved_for_publication'
        ? 'publicacao controlada aprovada, sem ativacao automatica'
        : 'publicacao permanece bloqueada ate autorizacao explicita da V27';
    console.log(`[TEX-ULTRA-VSL-PAYLOAD-V27] ${expectedFreezeId} verificado; ${publicationMessage}.`);
}
