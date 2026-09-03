import { assertBotQaMultiturnRecoveryV111Manifest } from './botQaMultiturnRecoveryV111Service.js';

const result = assertBotQaMultiturnRecoveryV111Manifest();
if (!result.ready) throw new Error('[BOT-QA-MULTITURN-V111] runtime_guard_blocked');

globalThis.__VITALISMEN_BOT_QA_MULTITURN_RECOVERY_V111 = Object.freeze({
    ready: true,
    version: 111,
    manifestSha256: result.manifestSha256
});
