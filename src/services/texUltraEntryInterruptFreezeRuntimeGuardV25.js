import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/tex-ultra-entry-interrupt-v25-20260818.json';
const parentManifestRelativePath = 'docs/freeze/buy-later-date-reminder-v24-20260818.json';
const expectedFreezeId = 'tex-ultra-entry-interrupt-v25-20260818';
const expectedParentFreezeId = 'buy-later-date-reminder-v24-20260818';
const additionalProtectedFiles = [
    'docs/TEX_ULTRA_ENTRY_INTERRUPT_FREEZE_V25_20260818.md',
    'docs/freeze/buy-later-date-reminder-v24-20260818.json',
    'scripts/assert-tex-ultra-entry-interrupt-approved-v25.mjs',
    'scripts/guard-tex-ultra-entry-interrupt-v25.mjs',
    'src/services/texUltraEntryInterruptFreezeRuntimeGuardV25.js',
    'tests/tex-ultra-entry-interrupt-v25.test.mjs'
];

const required = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true'
    || String(process.env.TEX_ULTRA_ENTRY_INTERRUPT_FREEZE_REQUIRED || '').toLowerCase() === 'true';
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const parentPath = path.join(root, parentManifestRelativePath);
const manifestPath = path.join(root, manifestRelativePath);
if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[TEX-ULTRA-INTERRUPT-V25] manifesto ausente; startup bloqueado.');
} else {
    if (!fs.existsSync(parentPath)) {
        throw new Error('[TEX-ULTRA-INTERRUPT-V25] manifesto pai V24 ausente; startup bloqueado.');
    }
    const parent = readJson(parentManifestRelativePath);
    const manifest = readJson(manifestRelativePath);
    const requiredProtectedFiles = [...new Set([
        ...Object.keys(parent.protectedFiles || {}),
        ...additionalProtectedFiles
    ])].sort();
    const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
    if (
        parent.freezeId !== expectedParentFreezeId
        || manifest.freezeId !== expectedFreezeId
        || manifest.parentFreezeId !== expectedParentFreezeId
        || manifest.status !== 'implementation_candidate_locked'
        || manifest.publicationStatus !== 'approved_for_publication'
        || manifest.country !== 'EC'
        || manifest.requiresWrittenAuthorizationToChange !== true
        || manifest.operatorApproval?.status !== 'approved_in_thread'
        || manifest.operatorApproval?.scope !== 'tex_ultra_entry_emoji_rotation_timing_and_customer_interrupt'
        || manifest.operatorPublicationApproval?.status !== 'approved_in_thread'
        || manifest.operatorPublicationApproval?.approvedAt !== '2026-08-18T14:12:47Z'
        || manifest.operatorPublicationApproval?.scope !== 'controlled_deploy_v25_test_phone_5515998038637'
        || manifest.policy?.greetingTextPreserved !== true
        || manifest.policy?.oneLeadingEmoji !== true
        || manifest.policy?.emojiRotationNoConsecutiveRepeat !== true
        || manifest.policy?.minimumTotalCadenceMs !== 90000
        || manifest.policy?.maximumTotalCadenceMs !== 112000
        || manifest.policy?.customerInboundStopsRemainingCadence !== true
        || manifest.policy?.queuedSendRechecksInbound !== true
        || manifest.policy?.knownQuestionAnsweredDeterministically !== true
        || manifest.policy?.unknownQuestionHumanHandoff !== true
        || manifest.policy?.productionChanged !== false
        || protectedFiles.length !== requiredProtectedFiles.length
        || requiredProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
    ) {
        throw new Error('[TEX-ULTRA-INTERRUPT-V25] manifesto ou politica invalida; startup bloqueado.');
    }
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[TEX-ULTRA-INTERRUPT-V25] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
    console.log(`[TEX-ULTRA-INTERRUPT-V25] ${expectedFreezeId} verificado; publicacao controlada aprovada, sem ativacao automatica.`);
}
