(function installVitalismenDeliveryStatusV115(root) {
    const clean = (value) => String(value ?? '').trim();
    const lower = (value) => clean(value).toLowerCase();

    const classify = ({
        deliveryStatus = '',
        providerStatus = '',
        providerMessageId = '',
        providerZaapId = '',
        ack = 0,
        localOnly = false,
        sendError = ''
    } = {}) => {
        const status = lower(deliveryStatus);
        const provider = lower(providerStatus);
        const numericAck = Number(ack || 0);
        const errorText = clean(sendError);
        const providerId = clean(providerMessageId || providerZaapId);

        if (localOnly) return Object.freeze({ code: 'LOCAL_ONLY', detail: 'somente no painel; envio externo não comprovado' });
        if (status === 'unconfirmed' && provider === 'ambiguous') {
            return Object.freeze({ code: 'UNCERTAIN', detail: errorText || 'confira no celular antes de tentar novamente' });
        }
        if (status === 'request_failed' && providerId) {
            return Object.freeze({ code: 'UNCERTAIN', detail: 'há ID de envio, mas falta confirmação; confira no celular antes de tentar novamente' });
        }
        if (['request_failed', 'unconfirmed'].includes(status)) {
            return Object.freeze({
                code: 'REQUEST_FAILED',
                detail: errorText || 'requisição não confirmada pelo servidor'
            });
        }
        if (['failed', 'error', 'final_failed'].includes(status) || numericAck < 0) {
            return Object.freeze({
                code: 'FAILED',
                detail: errorText || provider || 'falha confirmada pelo WhatsApp'
            });
        }
        if (errorText) return Object.freeze({ code: 'REQUEST_FAILED', detail: errorText });
        if (numericAck >= 3 || ['read', 'played'].includes(status)) {
            return Object.freeze({
                code: 'READ',
                detail: provider.includes('inferred_read')
                    ? 'leitura inferida por resposta posterior do cliente'
                    : 'lido pelo cliente'
            });
        }
        if (numericAck >= 2 || status === 'delivered') {
            return Object.freeze({ code: 'DELIVERED', detail: 'entregue ao cliente' });
        }
        if (numericAck >= 1) {
            return Object.freeze({ code: 'SENT', detail: 'envio confirmado por callback' });
        }
        if (status === 'sent' && provider === 'sent' && providerId) {
            return Object.freeze({ code: 'SENT', detail: 'aceito pelo dispositivo vinculado; entrega ao cliente ainda não comprovada' });
        }
        if (['provider_accepted', 'pending_confirmation'].includes(status)) {
            return providerId
                ? Object.freeze({ code: 'PROVIDER_ACCEPTED', detail: 'aceito pelo provedor anterior; entrega ao cliente não comprovada' })
                : Object.freeze({ code: 'REQUEST_FAILED', detail: 'resposta sem ID do provedor' });
        }
        if (status === 'sending') return Object.freeze({ code: 'SENDING', detail: 'enviando' });
        return Object.freeze({ code: 'UNKNOWN', detail: '' });
    };

    root.VitalismenDeliveryStatusV115 = Object.freeze({ classify });
})(globalThis);
