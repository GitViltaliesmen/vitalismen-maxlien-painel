import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_WHATSAPP_OUTAGE_RECOVERY_V49_20260823.txt',
    'utf8'
);
const manifest = JSON.parse(
    fs.readFileSync('docs/freeze/whatsapp-outage-recovery-v49-20260823.json', 'utf8')
);

if (
    !approval.includes('WHATSAPP_OUTAGE_RECOVERY_V49_ACTIVATION_APPROVED=YES')
    || !approval.includes('PROVIDER_SUBSCRIPTION_CHANGE_BY_CODE_AUTHORIZED=NO')
    || !approval.includes('REAL_CLIENT_SEND_AUTHORIZED=NO')
    || !approval.includes('AUTOMATIC_HISTORICAL_REPLAY_AUTHORIZED=NO')
    || !approval.includes('AUTOMATIC_DROPI_AUTHORIZED=NO')
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.policy?.providerSubscriptionChangedByCode !== false
    || manifest.policy?.realClientSendAuthorized !== false
    || manifest.policy?.automaticHistoricalReplay !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.deployAuthorized !== true
) {
    throw new Error('WHATSAPP_OUTAGE_RECOVERY_V49_ACTIVATION_APPROVED=NO');
}

console.log('WHATSAPP_OUTAGE_RECOVERY_V49_ACTIVATION_APPROVED=YES');
