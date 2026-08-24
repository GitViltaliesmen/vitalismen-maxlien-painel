import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_PANEL_CUSTOMER_SELECTION_ISOLATION_V51_20260824.txt',
    'utf8'
);
const manifest = JSON.parse(
    fs.readFileSync('docs/freeze/panel-customer-selection-isolation-v51-20260824.json', 'utf8')
);

if (
    !approval.includes('PANEL_CUSTOMER_SELECTION_ISOLATION_V51_ACTIVATION_APPROVED=YES')
    || !approval.includes('REAL_CLIENT_MUTATION_FOR_VALIDATION_AUTHORIZED=NO')
    || !approval.includes('REAL_CLIENT_SEND_AUTHORIZED=NO')
    || !approval.includes('AUTOMATIC_DROPI_AUTHORIZED=NO')
    || !approval.includes('PRODUCT_OR_PRICE_CHANGE_AUTHORIZED=NO')
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.policy?.selectionScopedByEpoch !== true
    || manifest.policy?.staleSelectionWorkCanWrite !== false
    || manifest.policy?.selectionTimersInvalidated !== true
    || manifest.policy?.agencyAutosaveIdempotent !== true
    || manifest.policy?.realClientMutationForValidation !== false
    || manifest.policy?.realClientSendAuthorized !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.deployAuthorized !== true
) {
    throw new Error('PANEL_CUSTOMER_SELECTION_ISOLATION_V51_ACTIVATION_APPROVED=NO');
}

console.log('PANEL_CUSTOMER_SELECTION_ISOLATION_V51_ACTIVATION_APPROVED=YES');
