import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_EC_DELIVERED_REPURCHASE_V45_20260822.txt',
    'utf8'
);
const required = [
    'APPROVED=true',
    'FREEZE_ID=ec-delivered-repurchase-v45-20260822',
    'COUNTRY=EC',
    'SCOPE=delivered_customer_new_repurchase_order_commit_publish_transactional_activation',
    'PREVIOUS_ORDER_IMMUTABLE=true',
    'NEW_ORDER_PREFIX=EC-RECOMPRA-',
    'PANEL_AUTH_REQUIRED=true',
    'DELIVERY_EVIDENCE_REQUIRED=true',
    'NO_AUTOMATIC_DROPI_AUTHORIZATION=true'
];

for (const item of required) {
    if (!approval.includes(item)) {
        throw new Error(`[EC-DELIVERED-REPURCHASE-V45] ativação bloqueada: autorização divergente (${item}).`);
    }
}

console.log('EC_DELIVERED_REPURCHASE_V45_ACTIVATION_APPROVED=YES');
