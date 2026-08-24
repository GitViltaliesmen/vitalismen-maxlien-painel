import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_POST_SALE_HEALTH_RECOVERY_V53_20260824.txt',
    'utf8'
);
const manifest = JSON.parse(
    fs.readFileSync('docs/freeze/post-sale-health-recovery-v53-20260824.json', 'utf8')
);

if (
    !approval.includes('POST_SALE_HEALTH_RECOVERY_V53_ACTIVATION_APPROVED=YES')
    || !approval.includes('AUTOMATIC_POSTSALE_CORRECTION_AUTHORIZED=YES')
    || !approval.includes('MASS_BACKLOG_REPLAY_AUTHORIZED=NO')
    || !approval.includes('REAL_CLIENT_SEND_FOR_VALIDATION_AUTHORIZED=NO')
    || !approval.includes('AUTOMATIC_DROPI_AUTHORIZED=NO')
    || !approval.includes('PRODUCT_OR_PRICE_CHANGE_AUTHORIZED=NO')
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.policy?.massBacklogReplayAllowed !== false
    || manifest.policy?.realClientCanaryAuthorized !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.deployAuthorized !== true
) {
    throw new Error('POST_SALE_HEALTH_RECOVERY_V53_ACTIVATION_APPROVED=NO');
}

console.log('POST_SALE_HEALTH_RECOVERY_V53_ACTIVATION_APPROVED=YES');
