import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/freeze/deploy-integration-v29-1-20260818.json', 'utf8'));
const activationRequested = String(process.env.VITALISMEN_DEPLOY_ACTIVATE || '').toUpperCase() === 'YES'
    || String(process.env.EC_SAFE_DEPLOY_ACTIVATE || '').toUpperCase() === 'YES';

if (
    manifest.freezeId !== 'deploy-integration-v29-1-20260818'
    || manifest.publicationStatus !== 'approved_for_release_preparation'
    || manifest.operatorApproval?.status !== 'approved_in_thread'
    || manifest.operatorApproval?.scope !== 'prepare_and_promote_v29_1_without_activation'
    || !manifest.operatorApproval?.approvedAt
) {
    console.error('[DEPLOY-INTEGRATION-V29.1] preparação bloqueada: autorização específica ausente.');
    process.exit(78);
}

if (activationRequested) {
    console.error('[DEPLOY-INTEGRATION-V29.1] ativação bloqueada: use exclusivamente o helper root transacional com permit de uso único.');
    process.exit(78);
}

console.log('[DEPLOY-INTEGRATION-V29.1] preparação de release aprovada; ativação permanece bloqueada.');
