import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/freeze/customer-data-resolution-v28-20260818.json', 'utf8'));

if (
    manifest.freezeId !== 'customer-data-resolution-v28-20260818'
    || manifest.publicationStatus !== 'approved_for_publication'
    || manifest.operatorPublicationApproval?.status !== 'approved_in_thread'
    || manifest.operatorPublicationApproval?.scope !== 'controlled_deploy_v28_after_explicit_operator_approval'
    || !manifest.operatorPublicationApproval?.approvedAt
) {
    console.error('[CUSTOMER-DATA-RESOLUTION-V28] publicação bloqueada: a V28 exige autorização explícita posterior ao freeze local.');
    process.exit(78);
}

console.log('[CUSTOMER-DATA-RESOLUTION-V28] publicação aprovada pelo operador.');
