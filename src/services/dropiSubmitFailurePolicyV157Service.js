const clean = (value = '') => String(value || '').trim();

const createRequestLifecycle = (result = {}) => {
    const lifecycle = result?.lifecycle && typeof result.lifecycle === 'object'
        ? result.lifecycle
        : null;
    return lifecycle?.operation === 'create' ? lifecycle : null;
};

export const dropiManualReviewReasonForResultV157 = (result = {}) => {
    const lifecycle = createRequestLifecycle(result);
    const httpStatus = Number(result?.httpStatus || 0);

    if (lifecycle?.responseReceived && lifecycle?.bodyParsed && httpStatus > 0) return 'dropi_rejected';
    if (lifecycle?.requestDispatched) return 'dropi_submit_unconfirmed';
    return 'dropi_preflight_failed';
};

export const dropiManualReviewMessageV157 = (result = {}) => {
    const reason = dropiManualReviewReasonForResultV157(result);
    const detail = clean(result?.error || result?.message || result?.reason);
    const genericUnconfirmed = /^A Dropi nao confirmou a criacao do pedido\.?$/i.test(detail);
    if (detail && !genericUnconfirmed) return detail;
    if (reason === 'dropi_rejected') {
        return 'A Dropi recusou a requisicao de criacao. O pedido ficou bloqueado para revisao.';
    }
    if (reason === 'dropi_submit_unconfirmed') {
        return 'A criacao foi enviada, mas a resposta nao foi confirmada. Pesquise o pedido na Dropi antes de tentar novamente.';
    }
    return 'A verificacao anterior ao envio nao foi concluida. Nenhum pedido foi criado na Dropi.';
};
