import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_PANEL_CUSTOMER_ALIAS_REPAIR_V57_20260824.txt',
    'utf8'
);
const manifest = JSON.parse(
    fs.readFileSync('docs/freeze/panel-customer-alias-repair-v57-20260824.json', 'utf8')
);

if (
    !approval.includes('PANEL_CUSTOMER_ALIAS_REPAIR_V57_ACTIVATION_APPROVED=YES')
    || !approval.includes('EXACT_LOCAL_ALIAS_REPAIR_AUTHORIZED=YES')
    || !approval.includes('CANONICAL_CUSTOMER_STATE_COPY_AUTHORIZED=YES')
    || !approval.includes('ORDER_OR_MESSAGE_MUTATION_AUTHORIZED=NO')
    || !approval.includes('REAL_CLIENT_SEND_FOR_VALIDATION_AUTHORIZED=NO')
    || !approval.includes('META_PURCHASE_RESEND_AUTHORIZED=NO')
    || !approval.includes('AUTOMATIC_DROPI_AUTHORIZED=NO')
    || !approval.includes('PRODUCT_OR_PRICE_CHANGE_AUTHORIZED=NO')
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.policy?.exactLocalAliasRepairWithBackup !== true
    || manifest.policy?.canonicalCustomerStateCopied !== true
    || manifest.policy?.orderOrMessageMutation !== false
    || manifest.policy?.realClientCanaryAuthorized !== false
    || manifest.policy?.whatsappSendAuthorized !== false
    || manifest.policy?.metaPurchaseResendAllowed !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.deployAuthorized !== true
) throw new Error('PANEL_CUSTOMER_ALIAS_REPAIR_V57_ACTIVATION_APPROVED=NO');

console.log('PANEL_CUSTOMER_ALIAS_REPAIR_V57_ACTIVATION_APPROVED=YES');
