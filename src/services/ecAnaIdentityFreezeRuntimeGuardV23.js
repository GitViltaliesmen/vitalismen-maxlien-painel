import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/ec-ana-identity-v23-20260818.json';
const expectedFreezeId = 'ec-ana-identity-v23-20260818';
const expectedParentFreezeId = 'tex-ultra-entry-unread-v22-20260818';
const requiredProtectedFiles = [
    '.env.example',
    '.github/workflows/ec-panel-quality.yml',
    'AGENTS.md',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'docs/EC_ANA_IDENTITY_FREEZE_V23_20260818.md',
    'docs/TEX_ULTRA_ENTRY_UNREAD_FREEZE_V22_20260818.md',
    'docs/freeze/ec-product-funnel-isolation-v13-20260815.json',
    'docs/freeze/panel-call-dropi-safety-v21-20260817.json',
    'docs/freeze/tex-ultra-entry-unread-v22-20260818.json',
    'docs/freeze/tex-ultra-panel-metrics-v5-20260815.json',
    'docs/freeze/whatsapp-chats-readonly-hardening-v16-20260816.json',
    'extensions/vitalismen-whatsapp-official/legacy-funnel-library.js',
    'package.json',
    'public/media/templates/EC/CONHECER_NECESSIDADES_CLIENTES.ogg',
    'public/qr.html',
    'scripts/assert-ec-ana-media-approved-v23.mjs',
    'scripts/assert-tex-ultra-entry-audio-approved-v22.mjs',
    'scripts/audit-ec-ana-identity.mjs',
    'scripts/audit-ec-nitrix-guard.mjs',
    'scripts/guard-ec-ana-identity-v23.mjs',
    'scripts/guard-tex-ultra-entry-unread-v22.mjs',
    'scripts/plan-2800-failover-rescue.mjs',
    'scripts/test-tex-ultra-initial-cadence.mjs',
    'scripts/test-tex-ultra-initial-concurrency.mjs',
    'src/index.js',
    'src/routes/whatsapp.js',
    'src/services/adminBuyLaterFollowupService.js',
    'src/services/agentProfiles.js',
    'src/services/aiRouter.js',
    'src/services/audioService.js',
    'src/services/audioTemplateService.js',
    'src/services/conversationEngine.js',
    'src/services/ecAnaIdentityFreezeRuntimeGuardV23.js',
    'src/services/nitrixFastStateService.js',
    'src/services/nitrixProductProfile.js',
    'src/services/openaiService.js',
    'src/services/panelReadStateService.js',
    'src/services/passiveFunnelObserverService.js',
    'src/services/shipmentMessageService.js',
    'src/services/texUltraEntryGreetingService.js',
    'src/services/texUltraEntryUnreadFreezeRuntimeGuardV22.js',
    'src/services/texUltraFunnelService.js',
    'src/services/texUltraInitialLayerService.js',
    'src/services/texUltraProductProfile.js',
    'src/services/vitPowerAudioComplementService.js',
    'src/services/vitPowerEvolvedWorkflow.js',
    'tests/ec-ana-identity-v23.test.mjs',
    'tests/ec-product-funnel-isolation-v13.test.mjs',
    'tests/panel-call-dropi-safety-v21.test.mjs',
    'tests/tex-ultra-entry-unread-v22.test.mjs',
    'tests/whatsapp-chat-read-persistence-v22.test.mjs'
];

const required = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true'
    || String(process.env.EC_ANA_IDENTITY_FREEZE_REQUIRED || '').toLowerCase() === 'true';
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');

const manifestPath = path.join(root, manifestRelativePath);
if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[EC-ANA-IDENTITY-V23] manifesto ausente; startup bloqueado.');
} else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
    if (
        manifest.freezeId !== expectedFreezeId
        || manifest.parentFreezeId !== expectedParentFreezeId
        || manifest.status !== 'implementation_candidate_locked'
        || manifest.publicationStatus !== 'approved_for_publication'
        || manifest.country !== 'EC'
        || manifest.requiresWrittenAuthorizationToChange !== true
        || manifest.operatorApproval?.status !== 'approved_in_thread'
        || manifest.operatorApproval?.approvedAt !== '2026-08-18T04:01:11Z'
        || manifest.operatorApproval?.scope !== 'official_agent_ana_lopez_and_active_audio_library'
        || manifest.policy?.officialAgent !== 'Ana López'
        || manifest.policy?.allActiveTextUsesOfficialAgent !== true
        || manifest.policy?.legacyIdentityRemovedFromRuntime !== true
        || manifest.policy?.legacyNitrixIdentityAudiosQuarantined !== true
        || manifest.policy?.panelAvatarMode !== 'initials_AL'
        || manifest.policy?.texUltraEntryAudioApprovalStatus !== 'approved_by_operator'
        || manifest.policy?.unlabelledAudioHumanAuditStatus !== 'approved_by_operator'
        || manifest.policy?.productionChanged !== false
        || protectedFiles.length !== requiredProtectedFiles.length
        || requiredProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
    ) {
        throw new Error('[EC-ANA-IDENTITY-V23] manifesto ou politica invalida; startup bloqueado.');
    }
    const parent = JSON.parse(fs.readFileSync(path.join(root, 'docs/freeze/tex-ultra-entry-unread-v22-20260818.json'), 'utf8'));
    if (parent.freezeId !== expectedParentFreezeId) {
        throw new Error('[EC-ANA-IDENTITY-V23] manifesto pai V22 invalido.');
    }
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[EC-ANA-IDENTITY-V23] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
    console.log(`[EC-ANA-IDENTITY-V23] ${manifest.freezeId} verificado; identidade e audios aprovados pelo operador, candidato ainda nao publicado.`);
}
