import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_PANEL_CUSTOMER_FORM_PERSISTENCE_V55_20260824.txt',
    'utf8'
);
const manifest = JSON.parse(
    fs.readFileSync('docs/freeze/panel-customer-form-persistence-v55-20260824.json', 'utf8')
);

if (
    !approval.includes('PANEL_CUSTOMER_FORM_PERSISTENCE_V55_ACTIVATION_APPROVED=YES')
    || !approval.includes('AGENCY_ADDRESS_PERSISTENCE_CORRECTION_AUTHORIZED=YES')
    || !approval.includes('AFFECTED_RECORDS_CONTROLLED_REPAIR_AUTHORIZED=YES')
    || !approval.includes('REAL_CLIENT_SEND_FOR_VALIDATION_AUTHORIZED=NO')
    || !approval.includes('META_PURCHASE_RESEND_AUTHORIZED=NO')
    || !approval.includes('AUTOMATIC_DROPI_AUTHORIZED=NO')
    || !approval.includes('PRODUCT_OR_PRICE_CHANGE_AUTHORIZED=NO')
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.policy?.exactAffectedRecordsRepairWithBackup !== true
    || manifest.policy?.historicalDeliveredOrderMutation !== false
    || manifest.policy?.realClientCanaryAuthorized !== false
    || manifest.policy?.whatsappSendAuthorized !== false
    || manifest.policy?.metaPurchaseResendAllowed !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.deployAuthorized !== true
) {
    throw new Error('PANEL_CUSTOMER_FORM_PERSISTENCE_V55_ACTIVATION_APPROVED=NO');
}

console.log('PANEL_CUSTOMER_FORM_PERSISTENCE_V55_ACTIVATION_APPROVED=YES');
