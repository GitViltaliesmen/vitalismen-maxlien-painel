import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/customer-data-resolution-v28-20260818.json';
const parentManifestRelativePath = 'docs/freeze/tex-ultra-vsl-payload-v27-20260818.json';
const expectedFreezeId = 'customer-data-resolution-v28-20260818';
const expectedParentFreezeId = 'tex-ultra-vsl-payload-v27-20260818';
const expectedParentManifestSha = '604c527b5499ea5c764f8c2ef6c2b2776f7e4ebe9bd3c06e93ae8be208854758';
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
    'docs/CUSTOMER_IDENTITY_LOCATION_DELIVERY_FREEZE_V28_20260818.md',
    'public/qr.html',
    'scripts/assert-customer-data-resolution-approved-v28.mjs',
    'scripts/guard-customer-data-resolution-v28.mjs',
    'src/models/ContactState.js',
    'src/models/Order.js',
    'src/routes/orders.js',
    'src/routes/whatsapp.js',
    'src/services/conversationEngine.js',
    'src/services/customerDataResolutionFreezeRuntimeGuardV28.js',
    'src/services/customerDataResolutionService.js',
    'tests/customer-data-resolution-v28-integration.test.mjs',
    'tests/customer-data-resolution-v28.test.mjs'
];

const required = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true'
    || String(process.env.CUSTOMER_DATA_RESOLUTION_FREEZE_REQUIRED || '').toLowerCase() === 'true';
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const parentPath = path.join(root, parentManifestRelativePath);
const manifestPath = path.join(root, manifestRelativePath);
if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[CUSTOMER-DATA-RESOLUTION-V28] manifesto ausente; startup bloqueado.');
} else {
    if (!fs.existsSync(parentPath) || sha256(parentManifestRelativePath) !== expectedParentManifestSha) {
        throw new Error('[CUSTOMER-DATA-RESOLUTION-V28] manifesto pai V27 ausente ou divergente; startup bloqueado.');
    }
    const parent = readJson(parentManifestRelativePath);
    const manifest = readJson(manifestRelativePath);
    const expectedProtectedFiles = [...declaredParentOverrides, ...newProtectedFiles].sort();
    const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
    const publicationStatusAllowed = manifest.publicationStatus === 'local_candidate_not_authorized'
        || (
            manifest.publicationStatus === 'approved_for_publication'
            && manifest.operatorPublicationApproval?.status === 'approved_in_thread'
            && manifest.operatorPublicationApproval?.scope === 'controlled_deploy_v28_after_explicit_operator_approval'
            && Boolean(manifest.operatorPublicationApproval?.approvedAt)
        );
    if (
        parent.freezeId !== expectedParentFreezeId
        || manifest.freezeId !== expectedFreezeId
        || manifest.parentFreezeId !== expectedParentFreezeId
        || manifest.parentManifestSha256 !== expectedParentManifestSha
        || manifest.status !== 'implementation_candidate_locked'
        || !publicationStatusAllowed
        || manifest.stagingStatus !== 'approved_local_synthetic_only'
        || manifest.operatorStagingApproval?.status !== 'approved_in_thread'
        || manifest.operatorStagingApproval?.scope !== 'freeze_commit_and_local_synthetic_staging_without_production'
        || !manifest.operatorStagingApproval?.approvedAt
        || manifest.country !== 'EC'
        || manifest.requiresWrittenAuthorizationToChange !== true
        || manifest.operatorApproval?.status !== 'approved_in_thread'
        || manifest.operatorApproval?.scope !== 'implement_v28_customer_identity_location_delivery_without_deploy'
        || manifest.policy?.preserveRaw !== true
        || manifest.policy?.neverInventNameSegmentation !== true
        || manifest.policy?.registryDecidesLocation !== true
        || manifest.policy?.authorizedAgencyRegistryOnly !== true
        || manifest.policy?.humanOverrideLock !== true
        || manifest.policy?.orderDataGate !== true
        || manifest.policy?.v27BehaviorPreserved !== true
        || manifest.policy?.vslChanged !== false
        || manifest.policy?.productionChanged !== false
        || JSON.stringify([...(manifest.declaredParentOverrides || [])].sort()) !== JSON.stringify(declaredParentOverrides)
        || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
        || protectedFiles.length !== expectedProtectedFiles.length
        || expectedProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
        || declaredParentOverrides.some((relativePath) => !Object.hasOwn(parent.protectedFiles || {}, relativePath))
    ) {
        throw new Error('[CUSTOMER-DATA-RESOLUTION-V28] manifesto ou política inválida; startup bloqueado.');
    }
    for (const [relativePath, approvedHash] of Object.entries(parent.protectedFiles || {})) {
        if (declaredParentOverrides.includes(relativePath)) continue;
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[CUSTOMER-DATA-RESOLUTION-V28] herança V27 divergente em ${relativePath}; startup bloqueado.`);
        }
    }
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[CUSTOMER-DATA-RESOLUTION-V28] alteração não autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
    const publicationMessage = manifest.publicationStatus === 'approved_for_publication'
        ? 'publicação controlada aprovada, sem ativação automática'
        : 'publicação permanece bloqueada até autorização explícita posterior da V28';
    console.log(`[CUSTOMER-DATA-RESOLUTION-V28] ${expectedFreezeId} verificado; ${publicationMessage}.`);
}
