import {
    assertBotQaOutboundRecoveryV110Manifest,
    BOT_QA_OUTBOUND_RECOVERY_V110_ATTESTATION_SHA256,
    BOT_QA_OUTBOUND_RECOVERY_V110_PARENT_MANIFEST_SHA256
} from '../src/services/botQaOutboundRecoveryV110Service.js';

const result = assertBotQaOutboundRecoveryV110Manifest();
console.log('BOT_QA_OUTBOUND_RECOVERY_V110=PASS');
console.log(`PARENT_V109_MANIFEST_SHA256=${BOT_QA_OUTBOUND_RECOVERY_V110_PARENT_MANIFEST_SHA256}`);
console.log(`ATTESTATION_SHA256=${BOT_QA_OUTBOUND_RECOVERY_V110_ATTESTATION_SHA256}`);
console.log(`QA_PHONE=${result.manifest.policy.qaPhone}`);
console.log(`MAX_MESSAGES=${result.manifest.policy.maxMessages}`);
console.log(`MAX_WINDOW_MINUTES=${result.manifest.policy.maxWindowMinutes}`);
console.log('DROPI_CHANGED=NO');
console.log('POST_SALE_CHANGED=NO');
console.log('EXTERNAL_EFFECTS=0');
