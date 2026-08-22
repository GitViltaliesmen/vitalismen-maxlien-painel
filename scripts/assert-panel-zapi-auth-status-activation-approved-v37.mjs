import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync(
    'docs/freeze/panel-zapi-auth-status-v37-20260822.json',
    'utf8'
));

if (
    manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_draft_pr_and_controlled_activation'
    || manifest.operatorApproval?.status !== 'approved_in_thread'
    || manifest.operatorApproval?.scope !== 'panel_zapi_auth_status_v37'
) {
    throw new Error('[PANEL-ZAPI-AUTH-STATUS-V37] deploy bloqueado: autorização explícita ausente ou divergente.');
}

console.log('[PANEL-ZAPI-AUTH-STATUS-V37] autorização explícita para correção do status autenticado verificada.');
