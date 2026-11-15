// Exact controlled QA signature. This is not a VSL visit or attribution claim.
import { resolveEcQaTestContextV78, ecQaTestStateEligibleV78 } from './ecQaTestResetV78Service.js';
export const PRINCIPAL_SDR_QA_ENTRY_V212 = 'Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?';
// The legacy recorder requires a VSL attribution even for controlled QA. A real
// persisted QA message with its own finite claim may route without inventing one.
export function principalSdrQaPersistedRoutingV212({ result, claim, approved = false } = {}) {
    return approved === true && result?.recorded === true && result?.newMessage === true
        && result.phone === '5515998038637'
        && /^[A-Za-z0-9_-]{8,128}$/.test(result.messageId || '')
        && result.providerMessageId === result.messageId
        && claim?.applicable === true && claim.allowed === true && claim.automationAllowed === true
        && claim.messageId === result.messageId
        && (claim.phase === 'initial' && result.body === PRINCIPAL_SDR_QA_ENTRY_V212 || claim.phase === 'followup');
}
export function principalSdrQaRuntimeReadyV212({ state, phone, messageId, now = new Date() } = {}) {
    if (resolveEcQaTestContextV78(state, { phone, messageId, permitId: state?.metadata?.qaTestContextV78?.permitId, allowConsumed: true, now }).ready) return true;
    // The HTTP response finalizes the claim after the inline router returns.
    // Accept only that actual in-flight claim, under the router's same lease.
    const context = state?.metadata?.qaTestContextV78 || {}, lease = state?.metadata?.processingLock || {};
    return phone === '5515998038637' && state?.phoneDigits === phone && ecQaTestStateEligibleV78(state)
        && state.human?.mode === 'auto' && (!state.human.pausedUntil || new Date(state.human.pausedUntil).getTime() <= new Date(now).getTime())
        && context.version === 78 && context.context === 'EC_V78_OFFICIAL_VSL_QA' && context.phone === phone
        && /^ecqa-v78-[a-f0-9]{32}$/.test(context.permitId || '')
        && new Date(context.expiresAt).getTime() > new Date(now).getTime()
        && context.status === 'routing' && context.routingMessageId === messageId
        && /^[A-Za-z0-9_-]{8,128}$/.test(messageId || '')
        && lease.messageId === messageId && new Date(lease.expiresAt).getTime() > new Date(now).getTime()
        && (context.routingPhase === 'initial' && context.routingSignature === PRINCIPAL_SDR_QA_ENTRY_V212
            || context.routingPhase === 'followup' && context.routingSignature === 'EC_V110_AUTHORIZED_QA_FOLLOWUP');
}
export function recognizePrincipalSdrQaIngressV212({ text, phone, connectedPhone, messageId, state, approved = false, now = new Date() }) {
    const reject = reason => ({ recognized: false, reason });
    if (!approved || phone !== '5515998038637' || state?.phoneDigits !== phone) return reject('principal_sdr_qa_not_authorized');
    if (connectedPhone !== '553171862958' || !/^[A-Za-z0-9_-]{8,128}$/.test(messageId || '')) return reject('principal_sdr_qa_provider_identity');
    if (String(text || '').replace(/\r\n/g, '\n') !== PRINCIPAL_SDR_QA_ENTRY_V212) return reject('principal_sdr_qa_signature');
    if (!resolveEcQaTestContextV78(state, { phone, now }).ready) return reject('principal_sdr_qa_window');
    return { recognized: true, reason: 'principal_sdr_controlled_qa_v212', productKey: 'vit_power_ec',
        marker: 'EC-CONTROLLED-QA-V212', signature: PRINCIPAL_SDR_QA_ENTRY_V212,
        sourceUrl: '', destinationPhone: connectedPhone, attributionClaimed: false };
}
