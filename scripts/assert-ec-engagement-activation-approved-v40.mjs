import fs from 'node:fs';

const approvalPath = 'approved_freezes/APPROVED_EC_ENGAGEMENT_INTERNAL_BUCKET_V40_20260822.txt';
if (!fs.existsSync(approvalPath)) {
    throw new Error('[EC-ENGAGEMENT-V40] aprovação de ativação ausente.');
}
const approval = fs.readFileSync(approvalPath, 'utf8');
for (const required of [
    'APPROVED=true',
    'FREEZE_ID=ec-engagement-internal-bucket-v40-20260822',
    'COUNTRY=EC',
    'NO_BULK_SEND=true',
    'NO_ARTIFICIAL_CONVERSATION=true',
    'NO_EXTERNAL_WARMUP_PROJECT=true',
    'NO_REAL_TEST_MESSAGES=true'
]) {
    if (!approval.includes(required)) {
        throw new Error(`[EC-ENGAGEMENT-V40] aprovação inválida: ${required}`);
    }
}
console.log('EC_ENGAGEMENT_INTERNAL_BUCKET_V40_ACTIVATION_APPROVED=YES');
