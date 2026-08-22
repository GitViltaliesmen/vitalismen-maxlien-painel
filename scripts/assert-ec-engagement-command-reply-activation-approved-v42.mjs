import fs from 'node:fs';

const approvalPath = 'approved_freezes/APPROVED_EC_ENGAGEMENT_COMMAND_REPLY_V42_20260822.txt';
if (!fs.existsSync(approvalPath)) {
    throw new Error('[EC-ENGAGEMENT-COMMAND-REPLY-V42] aprovação de ativação ausente.');
}
const approval = fs.readFileSync(approvalPath, 'utf8');
for (const required of [
    'APPROVED=true',
    'FREEZE_ID=ec-engagement-command-reply-v42-20260822',
    'COUNTRY=EC',
    'NO_BULK_SEND=true',
    'NO_ARTIFICIAL_CONVERSATION=true',
    'NO_EXTERNAL_WARMUP_PROJECT=true',
    'NO_REAL_TEST_MESSAGES=true',
    'NO_ORDER_WRITE=true',
    'NO_DROPI=true',
    'NO_META_CAPI=true',
    'ZERO_AI_MODEL_CALLS=true'
]) {
    if (!approval.includes(required)) {
        throw new Error(`[EC-ENGAGEMENT-COMMAND-REPLY-V42] aprovação inválida: ${required}`);
    }
}
console.log('EC_ENGAGEMENT_COMMAND_REPLY_V42_ACTIVATION_APPROVED=YES');
