import fs from 'node:fs';

const approval = fs.readFileSync(
    'approved_freezes/APPROVED_BAILEYS_LIBSIGNAL_SECURITY_V59_20260824.txt',
    'utf8'
);
const manifest = JSON.parse(
    fs.readFileSync('docs/freeze/baileys-libsignal-security-v59-20260824.json', 'utf8')
);

if (
    !approval.includes('BAILEYS_LIBSIGNAL_SECURITY_V59_ACTIVATION_APPROVED=YES')
    || !approval.includes('OFFICIAL_ZAPI_TRANSPORT_PRESERVED=YES')
    || !approval.includes('BAILEYS_MAJOR_UPGRADE_AUTHORIZED=NO')
    || !approval.includes('BAILEYS_VERSION=6.7.24')
    || !approval.includes('LIBSIGNAL_VERSION=6.0.0')
    || !approval.includes('LIBSIGNAL_COMMIT=bcea72df9ec34d9d9140ab30619cf479c7c144c7')
    || !approval.includes('PROTOBUFJS_VERSION=7.6.5')
    || !approval.includes('PRODUCTION_AUDIT_ZERO_REQUIRED=YES')
    || !approval.includes('REAL_CLIENT_SEND_FOR_VALIDATION_AUTHORIZED=NO')
    || !approval.includes('AUTOMATIC_DROPI_AUTHORIZED=NO')
    || !approval.includes('META_PURCHASE_RESEND_AUTHORIZED=NO')
    || !approval.includes('COMMERCIAL_FUNNEL_CHANGE_AUTHORIZED=NO')
    || !approval.includes('DEPLOY_AUTHORIZED=YES')
    || manifest.status !== 'activation_approved'
    || manifest.publicationStatus !== 'authorized_for_transactional_activation'
    || manifest.policy?.dependencySecurityRepair !== true
    || manifest.policy?.directBaileysVersionChanged !== false
    || manifest.policy?.baileysMajorUpgradeAuthorized !== false
    || manifest.policy?.libsignalRuntimeSourceChanged !== false
    || manifest.policy?.officialZapiTransportPreserved !== true
    || manifest.policy?.productionAuditZeroRequired !== true
    || manifest.policy?.realClientSendAuthorized !== false
    || manifest.policy?.automaticDropiAuthorization !== false
    || manifest.policy?.metaPurchaseResendAllowed !== false
    || manifest.policy?.commercialFunnelChanged !== false
    || manifest.policy?.deployAuthorized !== true
) throw new Error('BAILEYS_LIBSIGNAL_SECURITY_V59_ACTIVATION_APPROVED=NO');

console.log('BAILEYS_LIBSIGNAL_SECURITY_V59_ACTIVATION_APPROVED=YES');
