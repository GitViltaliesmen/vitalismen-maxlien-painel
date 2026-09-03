import {
    assertBotQaMultiturnRecoveryV111Manifest,
    BOT_QA_MULTITURN_RECOVERY_V111_ATTESTATION_SHA256,
    BOT_QA_MULTITURN_RECOVERY_V111_PARENT_MANIFEST_SHA256
} from '../src/services/botQaMultiturnRecoveryV111Service.js';

const result = assertBotQaMultiturnRecoveryV111Manifest();
console.log('BOT_QA_MULTITURN_RECOVERY_V111=PASS');
console.log(`PARENT_V110_MANIFEST_SHA256=${BOT_QA_MULTITURN_RECOVERY_V111_PARENT_MANIFEST_SHA256}`);
console.log(`ATTESTATION_SHA256=${BOT_QA_MULTITURN_RECOVERY_V111_ATTESTATION_SHA256}`);
console.log(`QA_PHONE=${result.manifest.policy.qaPhone}`);
console.log('CALLBACKS_CONSUME_QA_LEDGER=NO');
console.log('DROPI_CHANGED=NO');
console.log('POST_SALE_CHANGED=NO');
console.log('EXTERNAL_EFFECTS=0');
