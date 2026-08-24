import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_PANEL_MEDIA_PERSISTENCE_V52_20260824.txt',
    'utf8'
);
const manifest = JSON.parse(
    fs.readFileSync('docs/freeze/panel-media-persistence-v52-20260824.json', 'utf8')
);

if (
    !approval.includes('PANEL_MEDIA_PERSISTENCE_V52_ACTIVATION_APPROVED=YES')
    || !approval.includes('REAL_CLIENT_SEND_FOR_VALIDATION_AUTHORIZED=NO')
    || !approval.includes('AUTOMATIC_OUTBOUND_CHANGE_AUTHORIZED=NO')
    || !approval.includes('AUTOMATIC_DROPI_AUTHORIZED=NO')
    || !approval.includes('PRODUCT_OR_PRICE_CHANGE_AUTHORIZED=NO')
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.policy?.commercialAgencyAudioIsPickupStage !== false
    || manifest.policy?.pickupStageAudioRequiresVerifiedReady !== true
    || manifest.policy?.manualMediaUsesClientGeneratedId !== true
    || manifest.policy?.failedManualMediaDisappearsImmediately !== false
    || manifest.policy?.automaticOutboundChanged !== false
    || manifest.policy?.realClientSendForValidation !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.deployAuthorized !== true
) {
    throw new Error('PANEL_MEDIA_PERSISTENCE_V52_ACTIVATION_APPROVED=NO');
}

console.log('PANEL_MEDIA_PERSISTENCE_V52_ACTIVATION_APPROVED=YES');
