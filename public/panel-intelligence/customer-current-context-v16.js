(function attachCustomerCurrentContextV16(root, factory) {
    root.VitalismenCustomerCurrentContextV16 = factory();
}(typeof window !== 'undefined' ? window : globalThis, function customerCurrentContextV16Factory() {
    'use strict';

    const SCHEMA_VERSION = 'v16.customer-current-context.readonly.1';

    const STATE_LABELS = Object.freeze({
        empty: 'SEM CLIENTE SELECIONADO',
        loading: 'CARREGANDO CONTEXTO...',
        available: 'CONTEXTO DISPONÍVEL',
        ambiguous: 'CONTEXTO AMBÍGUO',
        error: 'ERRO AO CARREGAR',
        insufficient: 'SEM DADOS SUFICIENTES',
        incompatible: 'CONTEXTO INDISPONÍVEL — VERSÃO INCOMPATÍVEL'
    });

    const CONFIDENCE_LABELS = Object.freeze({
        CONFIRMADO: 'CONFIRMADO',
        ALTA_CONFIANCA: 'ALTA CONFIANÇA',
        PROVAVEL: 'PROVÁVEL',
        AMBIGUO: 'AMBÍGUO',
        CONFLITO: 'CONFLITO',
        DESCONHECIDO: 'DESCONHECIDO'
    });

    const SOURCE_LABELS = Object.freeze({
        none: 'Sem origem comprovada',
        canonical_request: 'Telefone selecionado',
        unique_phone_tail_match: 'Correspondência única de telefone',
        phone_tail_candidate: 'Candidato por telefone',
        multiple_candidates: 'Múltiplas fontes',
        manual_field_evidence: 'Edição manual comprovada',
        customer_message: 'Mensagem do cliente',
        whatsapp_profile_name: 'Nome de perfil',
        contact_state_customer_draft: 'Ficha persistida',
        contact_state_funnel_stage: 'Estado persistido do funil',
        contact_state_human_mode: 'Modo de atendimento persistido',
        contact_state_activity: 'Atividade persistida',
        current_order: 'Pedido atual confirmado',
        current_order_snapshot: 'Resumo do pedido atual',
        explicit_current_order_link: 'Vínculo explícito do pedido',
        unique_active_order: 'Único pedido ativo',
        active_order_candidate: 'Pedido ativo candidato',
        historical_order: 'Histórico de pedidos',
        shipment_local_snapshot: 'Resumo logístico local',
        current_shipment_snapshot: 'Envio atual persistido',
        persisted_vsl_attribution: 'Atribuição VSL persistida',
        claimed_vsl_visit: 'Visita VSL atribuída',
        matched_vsl_visit: 'Visita VSL correlacionada',
        servientrega_local_catalog: 'Catálogo local Servientrega'
    });

    const CONFLICT_LABELS = Object.freeze({
        NAME_MISMATCH: 'Nomes atuais divergentes',
        LOCATION_MISMATCH: 'Localização atual divergente',
        AGENCY_MISMATCH: 'Agências atuais divergentes',
        DELIVERY_MODE_MISMATCH: 'Modalidades de entrega divergentes',
        CURRENT_PRODUCT_MISMATCH: 'Produtos atuais divergentes',
        FUNNEL_STAGE_MISMATCH: 'Etapas do funil divergentes',
        MULTIPLE_ACTIVE_ORDERS: 'Mais de um pedido ativo plausível',
        PHONE_MATCH_AMBIGUOUS: 'Telefone com mais de um candidato',
        VSL_NEGOTIATION_DIVERGENCE: 'Origem/VSL e negociação atual são diferentes'
    });

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const phoneDigits = (value) => String(value || '').replace(/\D/g, '');

    const confidenceLabel = (value) => CONFIDENCE_LABELS[String(value || '').toUpperCase()]
        || CONFIDENCE_LABELS.DESCONHECIDO;

    const confidenceClass = (value) => String(value || 'DESCONHECIDO')
        .toLowerCase()
        .replace(/_/g, '-');

    const sourceLabel = (source = {}) => SOURCE_LABELS[source?.kind] || 'Fonte estruturada';

    const formatDate = (value) => {
        if (!value) return 'Sem data comprovada';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Sem data comprovada';
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatProduct = (value = {}) => value?.name || value?.key || '';

    const formatValue = (value, { kind = '' } = {}) => {
        if (value === null || value === undefined || value === '') return 'Sem prova';
        if (kind === 'total' && Number.isFinite(Number(value))) return `USD ${Number(value).toFixed(2)}`;
        if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
        if (Array.isArray(value)) return value.map((item) => formatValue(item)).filter(Boolean).join(' · ') || 'Sem prova';
        if (typeof value === 'object') {
            if (value.name || value.key) return formatProduct(value);
            if (value.orderId) return String(value.orderId);
            if (value.status) return String(value.status);
            return 'Dado estruturado disponível';
        }
        return String(value);
    };

    const fieldHasValue = (field) => field && field.value !== null && field.value !== undefined && field.value !== '';

    const renderCandidates = (field = {}) => {
        const candidates = Array.isArray(field.candidates) ? field.candidates : [];
        if (!candidates.length) return '';
        return `
            <div class="v16-context-candidates">
                <span>Candidatos</span>
                ${candidates.map((candidate) => `
                    <div class="v16-context-candidate">
                        <strong>${escapeHtml(formatValue(candidate?.value))}</strong>
                        <small>${escapeHtml(sourceLabel(candidate?.source))} · ${escapeHtml(confidenceLabel(candidate?.confidence))}</small>
                    </div>
                `).join('')}
            </div>
        `;
    };

    const renderField = (label, field, options = {}) => {
        if (!field || typeof field !== 'object') return '';
        const confidence = confidenceLabel(field.confidence);
        const value = formatValue(field.value, options);
        return `
            <div class="v16-context-field" data-confidence="${escapeHtml(String(field.confidence || 'DESCONHECIDO'))}">
                <div class="v16-context-field-head">
                    <span>${escapeHtml(label)}</span>
                    <span class="v16-context-confidence v16-context-confidence--${escapeHtml(confidenceClass(field.confidence))}">${escapeHtml(confidence)}</span>
                </div>
                <strong class="v16-context-value">${escapeHtml(value)}</strong>
                <dl class="v16-context-provenance">
                    <div><dt>Origem</dt><dd>${escapeHtml(sourceLabel(field.source))}</dd></div>
                    <div><dt>Atualização</dt><dd>${escapeHtml(formatDate(field.updatedAt))}</dd></div>
                </dl>
                ${renderCandidates(field)}
            </div>
        `;
    };

    const renderBlock = (title, body, className = '') => `
        <section class="v16-context-block ${className}">
            <h4>${escapeHtml(title)}</h4>
            <div class="v16-context-block-body">${body || '<div class="v16-context-empty-line">Sem informação retornada.</div>'}</div>
        </section>
    `;

    const renderOrderSummary = (order = {}) => {
        const shipment = order.shipment || null;
        const items = [
            ['Pedido', order.orderId],
            ['Status', order.status],
            ['Produto', formatProduct(order.product)],
            ['Quantidade', order.quantity],
            ['Total', order.total ? `USD ${Number(order.total).toFixed(2)}` : null],
            ['Cidade', order.customer?.city],
            ['Província', order.customer?.province],
            ['Envio', shipment?.status],
            ['Rastreio', shipment?.trackingNumber],
            ['Agência', shipment?.agencyName]
        ].filter(([, value]) => value !== null && value !== undefined && value !== '');
        return `
            <div class="v16-context-order-summary">
                ${items.map(([label, value]) => `
                    <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>
                `).join('') || '<div class="v16-context-empty-line">Sem detalhes comprovados.</div>'}
            </div>
        `;
    };

    const renderCurrentOrder = (field) => {
        if (!field || typeof field !== 'object') return '';
        if (!fieldHasValue(field)) return renderField('Pedido atual', field);
        return `
            <div class="v16-context-field" data-confidence="${escapeHtml(String(field.confidence || 'DESCONHECIDO'))}">
                <div class="v16-context-field-head">
                    <span>Pedido atual</span>
                    <span class="v16-context-confidence v16-context-confidence--${escapeHtml(confidenceClass(field.confidence))}">${escapeHtml(confidenceLabel(field.confidence))}</span>
                </div>
                ${renderOrderSummary(field.value)}
                <dl class="v16-context-provenance">
                    <div><dt>Origem</dt><dd>${escapeHtml(sourceLabel(field.source))}</dd></div>
                    <div><dt>Atualização</dt><dd>${escapeHtml(formatDate(field.updatedAt))}</dd></div>
                </dl>
                ${renderCandidates(field)}
            </div>
        `;
    };

    const renderHistory = (history = []) => {
        if (!Array.isArray(history) || !history.length) return '<div class="v16-context-empty-line">Nenhum pedido histórico comprovado.</div>';
        return history.map((order) => `
            <article class="v16-context-history-item">
                ${renderOrderSummary(order)}
                <dl class="v16-context-provenance">
                    <div><dt>Origem</dt><dd>${escapeHtml(sourceLabel(order?.source))}</dd></div>
                    <div><dt>Atualização</dt><dd>${escapeHtml(formatDate(order?.updatedAt))}</dd></div>
                </dl>
                <span class="v16-context-confidence v16-context-confidence--${escapeHtml(confidenceClass(order?.confidence))}">${escapeHtml(confidenceLabel(order?.confidence))}</span>
            </article>
        `).join('');
    };

    const renderConflicts = (conflicts = []) => {
        if (!Array.isArray(conflicts) || !conflicts.length) {
            return '<div class="v16-context-empty-line">Nenhum conflito retornado.</div>';
        }
        return conflicts.map((conflict) => `
            <article class="v16-context-conflict">
                <div class="v16-context-conflict-head">
                    <strong>ATENÇÃO</strong>
                    <span>${escapeHtml(confidenceLabel(conflict?.confidence || 'CONFLITO'))}</span>
                </div>
                <p>${escapeHtml(CONFLICT_LABELS[conflict?.code] || 'Dados atuais precisam de revisão humana.')}</p>
                ${(Array.isArray(conflict?.candidates) ? conflict.candidates : []).map((candidate) => `
                    <div class="v16-context-candidate">
                        <strong>${escapeHtml(formatValue(candidate?.value))}</strong>
                        <small>${escapeHtml(sourceLabel(candidate?.source))} · ${escapeHtml(confidenceLabel(candidate?.confidence))}</small>
                    </div>
                `).join('')}
                <small>Nenhuma alteração foi realizada.</small>
            </article>
        `).join('');
    };

    const contextHasEvidence = (context = {}) => {
        const customer = context.customer || {};
        const groups = [customer.identity, customer.location, customer.currentProduct, customer.vslOrigin, customer.funnel];
        const groupHasValue = groups.some((group) => Object.values(group || {}).some(fieldHasValue));
        return groupHasValue
            || fieldHasValue(customer.currentOrder)
            || Boolean(customer.history?.length)
            || Boolean(customer.conflicts?.length);
    };

    const contextIsAmbiguous = (context = {}) => {
        if (context.match?.ambiguous) return true;
        const conflicts = Array.isArray(context.customer?.conflicts) ? context.customer.conflicts : [];
        return conflicts.some((conflict) => ['AMBIGUO', 'CONFLITO'].includes(String(conflict?.confidence || '').toUpperCase()));
    };

    const renderContext = (context = {}) => {
        const customer = context.customer || {};
        const identity = customer.identity || {};
        const location = customer.location || {};
        const product = customer.currentProduct || {};
        const vsl = customer.vslOrigin || {};
        const funnel = customer.funnel || {};

        return [
            renderBlock('IDENTIDADE', [
                renderField('Nome atual', identity.name),
                renderField('Nome detectado', identity.detectedName),
                renderField('Telefone', customer.phone)
            ].join('')),
            renderBlock('LOCALIZAÇÃO', [
                renderField('Cidade', location.city),
                renderField('Província', location.province),
                renderField('Endereço', location.address),
                renderField('Referência', location.reference),
                renderField('Setor', location.sector),
                renderField('Agência', location.agency),
                renderField('Modalidade', location.deliveryMode)
            ].join('')),
            renderBlock('PRODUTO ATUAL', [
                renderField('Produto atual', product.product),
                renderField('Quantidade', product.quantity),
                renderField('Total', product.total, { kind: 'total' })
            ].join('')),
            renderBlock('ORIGEM / VSL', [
                renderField('Produto de origem', vsl.product),
                renderField('Caminho', vsl.path),
                renderField('Origem', vsl.sourceUrl),
                renderField('Teste', vsl.testId),
                renderField('Variante', vsl.variant)
            ].join('')),
            renderBlock('PEDIDO ATUAL', renderCurrentOrder(customer.currentOrder)),
            renderBlock('HISTÓRICO', renderHistory(customer.history)),
            renderBlock('FUNIL', [
                renderField('Etapa', funnel.stage),
                renderField('Modo humano', funnel.humanMode),
                renderField('Última entrada', funnel.lastInboundAt),
                renderField('Última saída', funnel.lastOutboundAt)
            ].join('')),
            renderBlock('CONFLITOS', renderConflicts(customer.conflicts), 'v16-context-block--conflicts')
        ].join('');
    };

    const renderShell = ({ stateName, body = '', detail = '' } = {}) => `
        <section class="customer-current-context-v16" data-v16-context-state="${escapeHtml(stateName)}" aria-label="Contexto atual do cliente">
            <header class="v16-context-header">
                <div>
                    <span class="v16-context-eyebrow">CONTEXTO ATUAL</span>
                    <strong>${escapeHtml(STATE_LABELS[stateName] || STATE_LABELS.error)}</strong>
                </div>
                <span class="v16-context-readonly">SOMENTE LEITURA</span>
            </header>
            <p class="v16-context-note">Informações assistivas. Nenhuma alteração é aplicada ao cliente.</p>
            ${detail ? `<div class="v16-context-state-message" role="status" aria-live="polite">${escapeHtml(detail)}</div>` : ''}
            ${body ? `<div class="v16-context-grid">${body}</div>` : ''}
        </section>
    `;

    const safeErrorDetail = (error = {}) => {
        const status = Number(error?.status || error?.response?.status || 0);
        if (status === 401 || status === 403) return 'Sessão não autorizada. Entre novamente para consultar o contexto.';
        if (status === 400) return 'O telefone selecionado não pôde ser consultado com segurança.';
        return 'Não foi possível carregar o contexto. Nenhuma informação anterior foi aplicada.';
    };

    const createPanel = ({ rootElement, request }) => {
        if (!rootElement || typeof rootElement !== 'object') throw new TypeError('rootElement obrigatorio');
        if (typeof request !== 'function') throw new TypeError('request obrigatorio');

        let sequence = 0;
        let activePhone = '';
        let activeController = null;
        let renderedState = 'empty';

        const commit = (stateName, options = {}) => {
            renderedState = stateName;
            rootElement.innerHTML = renderShell({ stateName, ...options });
            if (rootElement.dataset) rootElement.dataset.v16ContextState = stateName;
        };

        const clear = () => {
            sequence += 1;
            activeController?.abort?.();
            activeController = null;
            activePhone = '';
            commit('empty', { detail: 'Selecione um cliente para consultar o contexto atual.' });
        };

        const selectPhone = async (value, { force = false } = {}) => {
            const phone = phoneDigits(value);
            if (!phone) {
                clear();
                return { state: 'empty' };
            }
            if (!force && phone === activePhone && renderedState !== 'error') {
                return { state: renderedState, skipped: true };
            }

            sequence += 1;
            const requestSequence = sequence;
            activeController?.abort?.();
            activeController = typeof AbortController === 'function' ? new AbortController() : null;
            activePhone = phone;
            commit('loading', { detail: 'Consultando fontes existentes sem modificar registros.' });

            try {
                const context = await request(`/api/customer-context/${encodeURIComponent(phone)}`, {
                    method: 'GET',
                    ...(activeController ? { signal: activeController.signal } : {})
                });
                if (requestSequence !== sequence || phone !== activePhone) return { state: 'stale', stale: true };
                if (context?.schemaVersion !== SCHEMA_VERSION) {
                    commit('incompatible', { detail: 'A resposta recebida não corresponde ao contrato protegido da Fatia 1.' });
                    return { state: 'incompatible' };
                }
                if (context?.readOnly !== true || context?.applicationAllowed !== false) {
                    commit('incompatible', { detail: 'A resposta não confirmou o contrato de somente leitura.' });
                    return { state: 'incompatible' };
                }
                const stateName = contextIsAmbiguous(context)
                    ? 'ambiguous'
                    : contextHasEvidence(context) ? 'available' : 'insufficient';
                commit(stateName, {
                    detail: stateName === 'ambiguous'
                        ? 'Há mais de uma interpretação plausível. Revise as fontes; nada foi alterado.'
                        : stateName === 'insufficient'
                            ? 'Não há prova suficiente para formar um contexto atual.'
                            : 'Contexto calculado a partir das fontes existentes.',
                    body: renderContext(context)
                });
                return { state: stateName, context };
            } catch (error) {
                if (requestSequence !== sequence || phone !== activePhone || error?.name === 'AbortError') {
                    return { state: 'stale', stale: true };
                }
                commit('error', { detail: safeErrorDetail(error) });
                return { state: 'error', error };
            }
        };

        clear();
        return Object.freeze({
            clear,
            selectPhone,
            snapshot: () => ({ state: renderedState, phone: activePhone, sequence })
        });
    };

    const mount = ({ rootElement, request } = {}) => createPanel({ rootElement, request });

    return Object.freeze({
        SCHEMA_VERSION,
        STATE_LABELS,
        createPanel,
        escapeHtml,
        renderContext,
        renderShell,
        mount
    });
}));
