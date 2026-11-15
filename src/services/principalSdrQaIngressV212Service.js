// Exact controlled QA signature. This is not a VSL visit or attribution claim.
import { resolveEcQaTestContextV78 } from './ecQaTestResetV78Service.js';
export const PRINCIPAL_SDR_QA_ENTRY_V212 = 'Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?';
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
