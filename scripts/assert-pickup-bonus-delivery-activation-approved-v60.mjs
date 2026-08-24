import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_PICKUP_BONUS_DELIVERY_V60_20260824.txt',
    'utf8'
);
const manifest = JSON.parse(
    fs.readFileSync('docs/freeze/pickup-bonus-delivery-v60-20260824.json', 'utf8')
);

if (
    !approval.includes('PICKUP_BONUS_DELIVERY_V60_ACTIVATION_APPROVED=YES')
    || !approval.includes('DEDICATED_PICKUP_BONUS_SEMANTIC_KEY=YES')
    || !approval.includes('SAME_ORDER_RETRY_REMAINS_DEDUPED=YES')
    || !approval.includes('THANK_YOU_AUDIO_REPLAY_AUTHORIZED=NO')
    || !approval.includes('HOW_TO_USE_AUDIO_REPLAY_AUTHORIZED=NO')
    || !approval.includes('EXACT_PENDING_BONUS_COMPLETION_AUTHORIZED=YES')
    || !approval.includes('MASS_HISTORICAL_REPLAY_AUTHORIZED=NO')
    || !approval.includes('AUTOMATIC_DROPI_AUTHORIZED=NO')
    || !approval.includes('META_PURCHASE_RESEND_AUTHORIZED=NO')
    || !approval.includes('PRODUCT_OR_PRICE_CHANGE_AUTHORIZED=NO')
    || !approval.includes('COMMERCIAL_FUNNEL_CHANGE_AUTHORIZED=NO')
    || !approval.includes('DEPLOY_AUTHORIZED=YES')
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.policy?.dedicatedPickupBonusSemanticKey !== true
    || manifest.policy?.sameOrderRetryRemainsDeduped !== true
    || manifest.policy?.thankYouAudioReplayAllowed !== false
    || manifest.policy?.howToUseAudioReplayAllowed !== false
    || manifest.policy?.exactPendingBonusCompletionAuthorized !== true
    || manifest.policy?.massHistoricalReplayAllowed !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.metaPurchaseResendAllowed !== false
    || manifest.policy?.productOrPriceChanged !== false
    || manifest.policy?.commercialFunnelChanged !== false
    || manifest.policy?.deployAuthorized !== true
) throw new Error('PICKUP_BONUS_DELIVERY_V60_ACTIVATION_APPROVED=NO');

console.log('PICKUP_BONUS_DELIVERY_V60_ACTIVATION_APPROVED=YES');
