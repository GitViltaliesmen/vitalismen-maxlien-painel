import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/tex-ultra-entry-unread-v22-20260818.json';
const expectedFreezeId = 'tex-ultra-entry-unread-v22-20260818';
const expectedParentFreezeId = 'panel-call-dropi-safety-v21-20260817';
const parentManifests = {
    v21: 'docs/freeze/panel-call-dropi-safety-v21-20260817.json',
    texUltraV5: 'docs/freeze/tex-ultra-panel-metrics-v5-20260815.json',
    chatsV16: 'docs/freeze/whatsapp-chats-readonly-hardening-v16-20260816.json',
    productV13: 'docs/freeze/ec-product-funnel-isolation-v13-20260815.json'
};
const supersededByParent = {
    v21: new Set([
        '.github/workflows/ec-panel-quality.yml',
        'package.json',
        'public/qr.html',
        'src/index.js',
        'tests/panel-call-dropi-safety-v21.test.mjs',
        'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
        'docs/ARQUIVOS_OFICIAIS.md'
    ]),
    texUltraV5: new Set(),
    chatsV16: new Set(),
    productV13: new Set()
};
const requiredProtectedFiles = [
    '.github/workflows/ec-panel-quality.yml',
    'package.json',
    'public/media/templates/EC/CONHECER_NECESSIDADES_CLIENTES.ogg',
    'public/qr.html',
    'scripts/assert-tex-ultra-entry-audio-approved-v22.mjs',
    'scripts/guard-tex-ultra-entry-unread-v22.mjs',
    'scripts/test-tex-ultra-initial-cadence.mjs',
    'scripts/test-tex-ultra-initial-concurrency.mjs',
    'src/index.js',
    'src/routes/whatsapp.js',
    'src/services/panelReadStateService.js',
    'src/services/texUltraEntryGreetingService.js',
    'src/services/texUltraEntryUnreadFreezeRuntimeGuardV22.js',
    'src/services/texUltraFunnelService.js',
    'src/services/texUltraInitialLayerService.js',
    'src/services/texUltraProductProfile.js',
    'tests/ec-product-funnel-isolation-v13.test.mjs',
    'tests/panel-call-dropi-safety-v21.test.mjs',
    'tests/tex-ultra-entry-unread-v22.test.mjs',
    'tests/whatsapp-chat-read-persistence-v22.test.mjs',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'docs/TEX_ULTRA_ENTRY_UNREAD_FREEZE_V22_20260818.md',
    ...Object.values(parentManifests)
];
const required = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true'
    || String(process.env.TEX_ULTRA_ENTRY_UNREAD_FREEZE_REQUIRED || '').toLowerCase() === 'true';

const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readManifest = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const verifyProtectedFiles = (manifest, skipped = new Set()) => {
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (skipped.has(relativePath)) continue;
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[TEX-ULTRA-ENTRY-UNREAD-V22] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
};

const manifestPath = path.join(root, manifestRelativePath);
if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[TEX-ULTRA-ENTRY-UNREAD-V22] manifesto ausente; startup bloqueado.');
} else {
    const manifest = readManifest(manifestRelativePath);
    const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
    if (
        manifest.freezeId !== expectedFreezeId
        || manifest.status !== 'implementation_candidate_locked'
        || manifest.country !== 'EC'
        || manifest.parentFreezeId !== expectedParentFreezeId
        || manifest.publicationStatus !== 'candidate_not_published'
        || manifest.requiresWrittenAuthorizationToChange !== true
        || protectedFiles.length !== requiredProtectedFiles.length
        || requiredProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
        || manifest.policy?.singleEntryAudio !== true
        || manifest.policy?.personalizedGreetingBeforeAudio !== true
        || manifest.policy?.audioHumanApprovalRequired !== true
        || manifest.policy?.audioHumanApprovalStatus !== 'pending_operator_listen'
        || manifest.policy?.unreadAliasAggregation !== true
        || manifest.policy?.readThroughMessageTimestamp !== true
        || manifest.policy?.productionChanged !== false
        || manifest.preservation?.metaSendChanged !== false
        || manifest.preservation?.dropiSendChanged !== false
        || manifest.preservation?.schedulerChanged !== false
    ) {
        throw new Error('[TEX-ULTRA-ENTRY-UNREAD-V22] manifesto ou politica invalida; startup bloqueado.');
    }
    for (const [key, relativePath] of Object.entries(parentManifests)) {
        const parent = readManifest(relativePath);
        if (manifest.protectedFiles[relativePath] !== sha256(relativePath)) {
            throw new Error(`[TEX-ULTRA-ENTRY-UNREAD-V22] manifesto pai divergente: ${relativePath}.`);
        }
        if (key === 'v21') verifyProtectedFiles(parent, supersededByParent[key]);
    }
    verifyProtectedFiles(manifest);
    console.log(`[TEX-ULTRA-ENTRY-UNREAD-V22] ${manifest.freezeId} verificado no startup; audio ainda aguarda aceite humano.`);
}
