import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_EC_REPURCHASE_SQLITE_SERIALIZATION_V47_20260822.txt',
    'utf8'
);
const required = [
    'APPROVED=true',
    'FREEZE_ID=ec-repurchase-sqlite-serialization-v47-20260822',
    'COUNTRY=EC',
    'REPURCHASE_CYCLE_INTEGER_ONLY=true',
    'PRESERVE_EXISTING_ORDER=true',
    'PRESERVE_PURCHASE_EVENT=true',
    'NO_DUPLICATE_ORDER=true',
    'NO_AUTOMATIC_DROPI_AUTHORIZATION=true'
];

for (const item of required) {
    if (!approval.includes(item)) {
        throw new Error(`[EC-REPURCHASE-SQLITE-V47] ativação bloqueada: autorização divergente (${item}).`);
    }
}

console.log('EC_REPURCHASE_SQLITE_SERIALIZATION_V47_ACTIVATION_APPROVED=YES');
