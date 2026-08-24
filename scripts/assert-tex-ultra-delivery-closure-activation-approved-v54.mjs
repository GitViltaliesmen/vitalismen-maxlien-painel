import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_TEX_ULTRA_DELIVERY_CLOSURE_V54_20260824.txt',
    'utf8'
);
const manifest = JSON.parse(
    fs.readFileSync('docs/freeze/tex-ultra-delivery-closure-v54-20260824.json', 'utf8')
);

if (
    !approval.includes('TEX_ULTRA_DELIVERY_CLOSURE_V54_ACTIVATION_APPROVED=YES')
    || !approval.includes('CANONICAL_AGENCY_CORRECTION_AUTHORIZED=YES')
    || !approval.includes('JULIO_ORDER_CONTROLLED_REPAIR_AUTHORIZED=YES')
    || !approval.includes('REAL_CLIENT_SEND_FOR_VALIDATION_AUTHORIZED=NO')
    || !approval.includes('META_PURCHASE_RESEND_AUTHORIZED=NO')
    || !approval.includes('AUTOMATIC_DROPI_AUTHORIZED=NO')
    || !approval.includes('PRODUCT_OR_PRICE_CHANGE_AUTHORIZED=NO')
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.policy?.exactOrderRepairWithBackup !== true
    || manifest.policy?.realClientCanaryAuthorized !== false
    || manifest.policy?.metaPurchaseResendAllowed !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.deployAuthorized !== true
) {
    throw new Error('TEX_ULTRA_DELIVERY_CLOSURE_V54_ACTIVATION_APPROVED=NO');
}

console.log('TEX_ULTRA_DELIVERY_CLOSURE_V54_ACTIVATION_APPROVED=YES');
