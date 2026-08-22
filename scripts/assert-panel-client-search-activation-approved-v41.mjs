import fs from 'node:fs';

await import('./assert-ec-engagement-command-reply-activation-approved-v42.mjs');

const approvalPath = 'approved_freezes/APPROVED_PANEL_CLIENT_SEARCH_V41_20260822.txt';
if (!fs.existsSync(approvalPath)) {
    throw new Error('[PANEL-CLIENT-SEARCH-V41] aprovação de ativação ausente.');
}
const approval = fs.readFileSync(approvalPath, 'utf8');
for (const required of [
    'APPROVED=true',
    'FREEZE_ID=panel-client-search-v41-20260822',
    'COUNTRY=EC',
    'NO_REAL_TEST_MESSAGES=true',
    'NO_DATABASE_WRITE=true',
    'NO_COMMERCIAL_FLOW_CHANGE=true',
    'NO_EXTERNAL_PROJECT=true'
]) {
    if (!approval.includes(required)) {
        throw new Error(`[PANEL-CLIENT-SEARCH-V41] aprovação inválida: ${required}`);
    }
}
console.log('PANEL_CLIENT_SEARCH_V41_ACTIVATION_APPROVED=YES');
