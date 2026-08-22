import fs from 'node:fs';

await import('./assert-ec-engagement-priority-activation-approved-v43.mjs');

const approvalPath = 'approved_freezes/APPROVED_PANEL_GLOBAL_NEW_MESSAGES_V44_20260822.txt';
if (!fs.existsSync(approvalPath)) {
    throw new Error('[PANEL-GLOBAL-NEW-MESSAGES-V44] aprovação de ativação ausente.');
}
const approval = fs.readFileSync(approvalPath, 'utf8');
for (const required of [
    'APPROVED=true',
    'FREEZE_ID=panel-global-new-messages-v44-20260822',
    'COUNTRY=EC',
    'GLOBAL_COMMERCIAL_NEW_MESSAGES=true',
    'ENGAGEMENT_EXCLUDED=true',
    'DEFAULT_RETURN_BUCKET=attendance',
    'NO_REAL_TEST_MESSAGES=true',
    'NO_DATABASE_WRITE=true',
    'NO_COMMERCIAL_FLOW_CHANGE=true',
    'NO_ORDER_WRITE=true',
    'NO_DROPI=true',
    'NO_META_CAPI=true',
    'NO_EXTERNAL_PROJECT=true'
]) {
    if (!approval.includes(required)) {
        throw new Error(`[PANEL-GLOBAL-NEW-MESSAGES-V44] aprovação inválida: ${required}`);
    }
}
console.log('PANEL_GLOBAL_NEW_MESSAGES_V44_ACTIVATION_APPROVED=YES');
