(() => {
    const STAGES = [
        'novo',
        'qualificando',
        'oferta',
        'coleta_dados',
        'aguardando_confirmacao',
        'confirmado',
        'logistica',
        'pos_venda',
        'recompra'
    ];

    const LABELS = {
        novo: 'Novo contato',
        qualificando: 'Qualificando',
        oferta: 'Oferta',
        coleta_dados: 'Coleta de dados',
        aguardando_confirmacao: 'Aguardando confirmação',
        confirmado: 'Confirmado',
        logistica: 'Logística',
        pos_venda: 'Pós-venda',
        recompra: 'Recompra',
        comprar_depois: 'Comprar depois',
        perdido: 'Perdido',
        nao_contatar: 'Não contatar'
    };

    const digits = (value) => String(value || '').replace(/\D/g, '');
    const normalized = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
    const isOutgoing = (message) => (
        message?.isFromMe === true
        || message?.fromMe === true
        || message?.direction === 'outbound'
        || message?.direction === 'outgoing'
        || message?.sender === 'bot'
    );
    const messageBody = (message) => String(
        message?.body || message?.text || message?.caption || message?.content || ''
    );
    const hasOfferSignal = (messages) => messages.some((message) => (
        isOutgoing(message)
        && /\b(precio|valor|oferta|frasco|frascos|botella|botellas|usd|\$)\b/i.test(messageBody(message))
    ));
    const timestamp = (value) => {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
            return numeric < 1e12 ? numeric * 1000 : numeric;
        }
        const parsed = new Date(value || 0).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
    };
    const latestAt = (messages, outgoing) => messages
        .filter((message) => isOutgoing(message) === outgoing)
        .reduce((latest, message) => Math.max(
            latest,
            timestamp(message?.timestamp || message?.createdAt || message?.updatedAt)
        ), 0);
    const usefulName = (value, phone) => {
        const name = String(value || '').trim();
        return Boolean(name && name !== phone && digits(name) !== digits(phone));
    };

    const analyze = ({ draft = {}, profile = {}, messages = [], now = Date.now() } = {}) => {
        const order = profile.activeOrder || {};
        const customer = order.customer || {};
        const phone = draft.phone || profile.primaryPhone || '';
        const data = {
            product: draft.productKey || draft.productName || draft.product || '',
            quantity: order.quantity || draft.quantity || '',
            total: order.total ?? draft.total ?? '',
            name: customer.name || draft.name || profile.displayName || '',
            city: customer.city || draft.city || '',
            province: customer.province || customer.state || draft.province || '',
            address: customer.address || customer.agency || draft.address || draft.agency || '',
            reference: customer.reference || draft.reference || ''
        };
        const orderStatus = normalized(order.shippingStatus || order.status || draft.status);
        const missing = [];
        if (!data.product) missing.push('produto');
        if (!data.quantity) missing.push('quantidade');
        if (!usefulName(data.name, phone)) missing.push('nome');
        if (!data.city) missing.push('cidade');
        if (!data.province) missing.push('província');
        if (!data.address) missing.push('entrega');
        if (!data.reference) missing.push('referência');

        let stage = 'novo';
        if (['nao_contatar', 'bloqueado', 'opt_out'].includes(orderStatus)) stage = 'nao_contatar';
        else if (['perdido', 'desistente', 'cancelado', 'cancelled', 'returned'].includes(orderStatus)) stage = 'perdido';
        else if (['comprar_depois', 'buy_later'].includes(orderStatus)) stage = 'comprar_depois';
        else if (['recompra', 'repurchase'].includes(orderStatus)) stage = 'recompra';
        else if (['entregue', 'delivered', 'retirado', 'picked_up'].includes(orderStatus)) stage = 'pos_venda';
        else if (
            ['pedido_enviado', 'sent', 'shipped', 'in_transit', 'ready_for_pickup'].includes(orderStatus)
            || order.dropiOrderId
        ) stage = 'logistica';
        else if (['confirmado', 'confirmed', 'order_closed'].includes(orderStatus)) stage = 'confirmado';
        else if (data.product && data.quantity && !missing.some((field) => (
            ['nome', 'cidade', 'província', 'entrega'].includes(field)
        ))) stage = 'aguardando_confirmacao';
        else if (data.quantity) stage = 'coleta_dados';
        else if (data.product || hasOfferSignal(messages)) stage = 'oferta';
        else if (messages.length) stage = 'qualificando';

        const nextActions = {
            novo: 'Responder o novo cliente',
            qualificando: 'Identificar produto e intenção',
            oferta: 'Apresentar pacote e confirmar quantidade',
            coleta_dados: 'Coletar somente o próximo dado faltante',
            aguardando_confirmacao: 'Revisar resumo e pedir confirmação',
            confirmado: 'Revisar pedido para autorização operacional',
            logistica: 'Acompanhar Dropi, guia ou retirada',
            pos_venda: 'Realizar acompanhamento pós-venda',
            recompra: 'Abrir nova oportunidade sem duplicar o pedido',
            comprar_depois: 'Aguardar a data combinada',
            perdido: 'Registrar motivo da perda',
            nao_contatar: 'Não enviar novas mensagens'
        };

        const lastInboundAt = latestAt(messages, false)
            || timestamp(profile.stats?.lastInboundAt);
        const lastOutboundAt = latestAt(messages, true)
            || timestamp(profile.stats?.lastOutboundAt);
        const unanswered = lastInboundAt > lastOutboundAt;
        const blocked = ['nao_contatar', 'perdido'].includes(stage);
        const priority = blocked
            ? 'Bloqueado'
            : (unanswered || stage === 'aguardando_confirmacao')
                ? 'P1 Agora'
                : ['oferta', 'coleta_dados', 'confirmado'].includes(stage)
                    ? 'P2 Hoje'
                    : 'P3 Acompanhar';
        const anchor = Math.max(lastInboundAt, lastOutboundAt);
        const ageMinutes = anchor ? Math.max(0, Math.floor((Number(now) - anchor) / 60000)) : null;
        const progressIndex = STAGES.includes(stage) ? STAGES.indexOf(stage) : 0;

        return {
            mode: 'shadow',
            stage,
            stageLabel: LABELS[stage] || stage,
            priority,
            nextAction: nextActions[stage],
            missing,
            unanswered,
            ageMinutes,
            progress: Math.round((progressIndex / (STAGES.length - 1)) * 100)
        };
    };

    globalThis.VitalismenFunnelShadow = Object.freeze({ analyze, STAGES, LABELS });
})();
