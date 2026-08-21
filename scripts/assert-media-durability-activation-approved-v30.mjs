import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('docs/freeze/media-durability-auth-v30-20260821.json', 'utf8'));
const approval = manifest.operatorActivationApproval || {};

if (
    approval.status !== 'approved_in_thread'
    || !approval.approvedAt
    || approval.scope !== 'activate_media_durability_v30_ec'
) {
    throw new Error('[MEDIA-V30] deploy/ativação bloqueado: é necessária autorização explícita posterior ao relatório de auditoria.');
}

console.log('[MEDIA-V30] autorização explícita de ativação verificada.');
