import {isB01GenericEntry} from './vitPowerB01CoreV216Service.js';

// This classifies a verified first generic message, not a VSL visit or attribution.
// Native QA authority is supplied by the existing server verifier, never input text.
export function isVerifiedVitPowerFirstEntryV246({input={},state={},firstPersistedInbound=false,verifiedQaInitial=false}={}) {
  if (input.productKey!=='vit_power_ec'||input.sessionId!=='zapi'||state.phoneDigits!==input.phone
    ||state.vitPowerB01||!isB01GenericEntry(input.text)) return false;
  if (input.phone==='5515998038637') {
    const context=state.metadata?.qaTestContextV78||{};
    return verifiedQaInitial===true&&context.routingPhase==='initial'
      &&context.routingMessageId===input.inboundId;
  }
  return /^593[2-79]\d{8}$/.test(input.phone)&&firstPersistedInbound===true
    &&state.firstInboundText===input.text;
}
