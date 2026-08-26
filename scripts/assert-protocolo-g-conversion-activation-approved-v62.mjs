import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_PROTOCOLO_G_CONVERSION_V62_20260826.txt',
    'utf8'
);
const manifest = JSON.parse(
    fs.readFileSync('docs/freeze/protocolo-g-conversion-v62-20260826.json', 'utf8')
);

if (
    !approval.includes('PROTOCOLO_G_CONVERSION_V62_ACTIVATION_APPROVED=YES')
    || !approval.includes('EARLY_SECONDARY_CTA_AT_12_MINUTES_APPROVED=YES')
    || !approval.includes('VTURB_FINAL_CTA_PRESERVED=YES')
    || !approval.includes('PROTOCOLO_G_STAGE_MEASUREMENT_APPROVED=YES')
    || !approval.includes('META_CONVERSION_FROM_STAGE_ALLOWED=NO')
    || !approval.includes('PANEL_LEAD_FROM_STAGE_ALLOWED=NO')
    || !approval.includes('SELLER_ROTATION_FROM_STAGE_ALLOWED=NO')
    || !approval.includes('WHATSAPP_AUTOMATIC_MESSAGE_ALLOWED=NO')
    || !approval.includes('META_PURCHASE_RESEND_ALLOWED=NO')
    || !approval.includes('AUTOMATIC_DROPI_ALLOWED=NO')
    || !approval.includes('PRODUCT_OR_PRICE_CHANGE_ALLOWED=NO')
    || !approval.includes('DEPLOY_AUTHORIZED=YES')
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_controlled_activation'
    || manifest.policy?.earlySecondaryCtaSeconds !== 720
    || manifest.policy?.vturbFinalCtaPreserved !== true
    || manifest.policy?.stageCreatesMetaConversion !== false
    || manifest.policy?.stageCreatesPanelLead !== false
    || manifest.policy?.stageRotatesSeller !== false
    || manifest.policy?.stageSendsWhatsapp !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.deployAuthorized !== true
) throw new Error('PROTOCOLO_G_CONVERSION_V62_ACTIVATION_APPROVED=NO');

console.log('PROTOCOLO_G_CONVERSION_V62_ACTIVATION_APPROVED=YES');
