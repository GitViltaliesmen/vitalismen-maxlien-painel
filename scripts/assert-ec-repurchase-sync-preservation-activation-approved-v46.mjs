import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_EC_REPURCHASE_SYNC_PRESERVATION_V46_20260822.txt',
    'utf8'
);
const required = [
    'APPROVED=true',
    'FREEZE_ID=ec-repurchase-sync-preservation-v46-20260822',
    'COUNTRY=EC',
    'PRESERVE_PREVIOUS_ORDER_ID=true',
    'PRESERVE_ENTRY_REASON=true',
    'PRESERVE_PURCHASE_EVENT=true',
    'NO_DUPLICATE_ORDER=true',
    'NO_AUTOMATIC_DROPI_AUTHORIZATION=true'
];

for (const item of required) {
    if (!approval.includes(item)) {
        throw new Error(`[EC-REPURCHASE-SYNC-V46] ativação bloqueada: autorização divergente (${item}).`);
    }
}

console.log('EC_REPURCHASE_SYNC_PRESERVATION_V46_ACTIVATION_APPROVED=YES');
