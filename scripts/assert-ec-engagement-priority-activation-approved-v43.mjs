import fs from 'node:fs';

await import('./assert-ec-engagement-command-reply-activation-approved-v42.mjs');

const approvalPath = 'approved_freezes/APPROVED_EC_ENGAGEMENT_PRIORITY_V43_20260822.txt';
if (!fs.existsSync(approvalPath)) {
    throw new Error('[EC-ENGAGEMENT-PRIORITY-V43] aprovação de ativação ausente.');
}
const approval = fs.readFileSync(approvalPath, 'utf8');
for (const required of [
    'APPROVED=true',
    'FREEZE_ID=ec-engagement-priority-v43-20260822',
    'COUNTRY=EC',
    'NO_BULK_SEND=true',
    'NO_ARTIFICIAL_CONVERSATION=true',
    'NO_EXTERNAL_WARMUP_PROJECT=true',
    'NO_REAL_TEST_MESSAGES=true',
    'NO_ORDER_WRITE=true',
    'NO_DROPI=true',
    'NO_META_CAPI=true',
    'ZERO_AI_MODEL_CALLS=true',
    'PASSIVE_BATCH_PATTERN=2,3',
    'PASSIVE_BATCH_TEXT=👍'
]) {
    if (!approval.includes(required)) {
        throw new Error(`[EC-ENGAGEMENT-PRIORITY-V43] aprovação inválida: ${required}`);
    }
}
console.log('EC_ENGAGEMENT_PRIORITY_V43_ACTIVATION_APPROVED=YES');
