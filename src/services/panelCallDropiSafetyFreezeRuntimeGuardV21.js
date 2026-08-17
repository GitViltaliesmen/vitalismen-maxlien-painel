import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/panel-call-dropi-safety-v21-20260817.json';
const parentRelativePath = 'docs/freeze/order-public-product-integrity-v20-20260817.json';
const expectedFreezeId = 'panel-call-dropi-safety-v21-20260817';
const expectedParentFreezeId = 'order-public-product-integrity-v20-20260817';
const expectedSupersededParentFiles = [
    '.github/workflows/ec-panel-quality.yml',
    '.env.example',
    'package.json',
    'public/qr.html',
    'src/index.js',
    'src/routes/zapi.js',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md'
];
const requiredProtectedFiles = [
    '.github/workflows/ec-panel-quality.yml',
    '.env.example',
    'package.json',
    'package-lock.json',
    'public/qr.html',
    'scripts/guard-panel-call-dropi-safety-v21.mjs',
    'src/index.js',
    'src/models/CallAutoReplyState.js',
    'src/models/Message.js',
    'src/routes/zapi.js',
    'src/services/audioTemplateService.js',
    'src/services/callAutoReplyPolicy.js',
    'src/services/callAutoReplySafetyService.js',
    'src/services/dropiDataNormalizationService.js',
    'src/services/droppiEcuadorService.js',
    'src/services/panelCallDropiSafetyFreezeRuntimeGuardV21.js',
    'src/services/servientregaEcuadorAgencyService.js',
    'src/services/zapiClient.js',
    'src/whatsapp/connection.js',
    'tests/panel-call-dropi-safety.test.mjs',
    'tests/panel-call-dropi-safety-v21.test.mjs',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'docs/PANEL_CALL_DROPI_SAFETY_FREEZE_V21_20260817.md',
    parentRelativePath
];
const required = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true'
    || String(process.env.PANEL_CALL_DROPI_SAFETY_FREEZE_REQUIRED || '').toLowerCase() === 'true'
    || String(process.env.ORDER_PUBLIC_PRODUCT_INTEGRITY_FREEZE_REQUIRED || '').toLowerCase() === 'true';

const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readManifest = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const sameList = (actual, expected) => (
    Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index])
);
const verifyProtectedFiles = (manifest, skipped = new Set()) => {
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (skipped.has(relativePath)) continue;
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[PANEL-CALL-DROPI-SAFETY-V21] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
};

const manifestPath = path.join(root, manifestRelativePath);
if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[PANEL-CALL-DROPI-SAFETY-V21] manifesto ausente; startup bloqueado.');
} else {
    const manifest = readManifest(manifestRelativePath);
    const parent = readManifest(parentRelativePath);
    const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();

    if (
        manifest.freezeId !== expectedFreezeId
        || manifest.status !== 'approved_frozen'
        || manifest.country !== 'EC'
        || manifest.parentFreezeId !== expectedParentFreezeId
        || parent.freezeId !== expectedParentFreezeId
        || manifest.publicationStatus !== 'candidate_not_published'
        || manifest.requiresWrittenAuthorizationToChange !== true
        || !sameList(manifest.supersededParentProtectedFiles, expectedSupersededParentFiles)
        || protectedFiles.length !== requiredProtectedFiles.length
        || requiredProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
        || manifest.protectedFiles[parentRelativePath] !== sha256(parentRelativePath)
        || manifest.policy?.callAutoReplyDefaultEnabled !== false
        || manifest.policy?.persistentCallDedupe !== true
        || manifest.policy?.oneAudioMaximum !== true
        || manifest.policy?.oneTextMaximum !== true
        || manifest.policy?.manualBottleSendRequiresConfirmation !== true
        || manifest.policy?.dropiUsesOfficialAgencyNormalizer !== true
        || manifest.policy?.dropiManualAuthorizationRequired !== true
        || manifest.policy?.pricesChanged !== false
        || manifest.policy?.productionChanged !== false
        || manifest.preservation?.v20Preserved !== true
        || manifest.preservation?.metaSendChanged !== false
        || manifest.preservation?.schedulerChanged !== false
    ) {
        throw new Error('[PANEL-CALL-DROPI-SAFETY-V21] manifesto ou politica invalida; startup bloqueado.');
    }

    verifyProtectedFiles(parent, new Set(manifest.supersededParentProtectedFiles));
    verifyProtectedFiles(manifest);
    console.log(`[PANEL-CALL-DROPI-SAFETY-V21] ${manifest.freezeId} verificado no startup.`);
}
