import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestRelativePath = 'docs/freeze/buy-later-date-reminder-v24-20260818.json';
const parentManifestRelativePath = 'docs/freeze/ec-ana-identity-v23-20260818.json';
const expectedFreezeId = 'buy-later-date-reminder-v24-20260818';
const expectedParentFreezeId = 'ec-ana-identity-v23-20260818';
const additionalProtectedFiles = [
    'docs/BUY_LATER_DATE_REMINDER_FREEZE_V24_20260818.md',
    'docs/freeze/ec-ana-identity-v23-20260818.json',
    'public/leads-window.html',
    'scripts/guard-buy-later-date-reminder-v24.mjs',
    'src/models/ContactState.js',
    'src/services/buyLaterConfirmationService.js',
    'src/services/buyLaterDateReminderFreezeRuntimeGuardV24.js',
    'src/services/schedulerService.js',
    'tests/buy-later-date-reminder-v24.test.mjs'
];

const required = String(process.env.VITALISMEN_OFFICIAL_ONLY || '').toLowerCase() === 'true'
    || String(process.env.BUY_LATER_DATE_REMINDER_FREEZE_REQUIRED || '').toLowerCase() === 'true';
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const parentPath = path.join(root, parentManifestRelativePath);
const manifestPath = path.join(root, manifestRelativePath);
if (!fs.existsSync(manifestPath)) {
    if (required) throw new Error('[BUY-LATER-V24] manifesto ausente; startup bloqueado.');
} else {
    if (!fs.existsSync(parentPath)) {
        throw new Error('[BUY-LATER-V24] manifesto pai V23 ausente; startup bloqueado.');
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
        || manifest.operatorRequest?.status !== 'requested_in_thread'
        || manifest.operatorRequest?.scope !== 'buy_later_date_and_single_d4_d3_reminder'
        || manifest.operatorApproval?.status !== 'approved_in_thread'
        || manifest.operatorApproval?.approvedAt !== '2026-08-18T05:21:30Z'
        || manifest.operatorApproval?.scope !== 'publish_v24_after_successful_audit'
        || manifest.policy?.timezone !== 'America/Guayaquil'
        || manifest.policy?.requiresDesiredOrderDate !== true
        || manifest.policy?.oneReminderPerDateAndProduct !== true
        || manifest.policy?.maxAutomaticAttempts !== 1
        || manifest.policy?.persistentLockAndSentReceipt !== true
        || manifest.policy?.historyCheckedBeforeSend !== true
        || manifest.policy?.productRouteIsolated !== true
        || manifest.policy?.createsOrder !== false
        || manifest.policy?.sendsDropi !== false
        || manifest.policy?.sendsMeta !== false
        || manifest.policy?.sendsMedia !== false
        || manifest.policy?.productionChanged !== false
        || protectedFiles.length !== requiredProtectedFiles.length
        || requiredProtectedFiles.some((relativePath) => !Object.hasOwn(manifest.protectedFiles || {}, relativePath))
    ) {
        throw new Error('[BUY-LATER-V24] manifesto ou politica invalida; startup bloqueado.');
    }
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (!fs.existsSync(path.join(root, relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[BUY-LATER-V24] alteracao nao autorizada em ${relativePath}; startup bloqueado.`);
        }
    }
    console.log(`[BUY-LATER-V24] ${expectedFreezeId} verificado; publicacao aprovada pelo operador, sem ativacao automatica.`);
}
