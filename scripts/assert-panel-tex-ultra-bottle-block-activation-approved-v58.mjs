import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_PANEL_TEX_ULTRA_BOTTLE_BLOCK_V58_20260824.txt',
    'utf8'
);
const manifest = JSON.parse(
    fs.readFileSync('docs/freeze/panel-tex-ultra-bottle-block-v58-20260824.json', 'utf8')
);

if (
    !approval.includes('PANEL_TEX_ULTRA_BOTTLE_BLOCK_V58_ACTIVATION_APPROVED=YES')
    || !approval.includes('OFFICIAL_BOTTLE_PATH_REPAIR_AUTHORIZED=YES')
    || !approval.includes('FULL_B01_SEQUENCE_PRESERVED=YES')
    || !approval.includes('PROMOTIONAL_PRICES_CHANGED=NO')
    || !approval.includes('REAL_CLIENT_SEND_FOR_VALIDATION_AUTHORIZED=NO')
    || !approval.includes('QA_PHONE_CANARY_AUTHORIZED=YES')
    || !approval.includes('AUTOMATIC_DROPI_AUTHORIZED=NO')
    || !approval.includes('META_PURCHASE_RESEND_AUTHORIZED=NO')
    || !approval.includes('OTHER_PRODUCT_MEDIA_CHANGED=NO')
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.policy?.officialBottlePathRepair !== true
    || manifest.policy?.fullB01SequencePreserved !== true
    || manifest.policy?.promotionalPricesChanged !== false
    || manifest.policy?.realClientSendAuthorized !== false
    || manifest.policy?.qaPhoneCanaryAuthorized !== true
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.metaPurchaseResendAllowed !== false
    || manifest.policy?.otherProductMediaChanged !== false
    || manifest.policy?.deployAuthorized !== true
) throw new Error('PANEL_TEX_ULTRA_BOTTLE_BLOCK_V58_ACTIVATION_APPROVED=NO');

console.log('PANEL_TEX_ULTRA_BOTTLE_BLOCK_V58_ACTIVATION_APPROVED=YES');
