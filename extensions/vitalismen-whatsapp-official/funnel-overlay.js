(() => {
    'use strict';

    const assistedLibrary = globalThis.VitalismenProductFunnel;
    const legacyLibrary = globalThis.VitalismenLegacyFunnel;
    const shadow = globalThis.VitalismenFunnelShadow;
    const elements = Object.fromEntries([
        'connectionStatus', 'clientName', 'clientPhone', 'stageBadge', 'labelButtons', 'sourceTabs',
        'productTabs', 'funnelSearch', 'typeTabs', 'categoryTabs', 'productLabel',
        'responseCount', 'responseList', 'copyStatus'
    ].map((id) => [id, document.getElementById(id)]));
    const state = {
        source: 'legacy',
        productKey: 'tex_ultra_ec',
        contentType: 'todos',
        category: 'todos',
        search: '',
        stage: '',
        chat: null,
        profile: {},
        messages: [],
        audioTemplates: []
    };
    const LABELS_KEY = 'vitalismenWhatsAppLabelsV1';
    const LABEL_DEFINITIONS = {
        atendendo: { label: 'Atendendo', color: '#0b9b7e' },
        confirmado: { label: 'Confirmado', color: '#2467c9' },
        enviado: { label: 'Enviado', color: '#7b50b3' },
        em_rota: { label: 'Em rota', color: '#bd6a00' },
        entregue: { label: 'Entregue', color: '#218739' },
        retorno: { label: 'Retorno', color: '#a3457a' },
        cancelado: { label: 'Cancelado', color: '#b33939' }
    };

    const send = (message) => new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (!response?.ok) return reject(new Error(response?.error || 'Falha na extensão'));
            resolve(response.data);
        });
    });
    const api = (path) => send({ action: 'api', request: { path, method: 'GET' } });
    const digits = (value) => String(value || '').replace(/\D/g, '');
    const normalized = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const chatPhone = (chat) => digits(chat?.phone || chat?.peerPhone || chat?.id);
    const chatName = (chat) => String(
        chat?.name || chat?.pushName || chat?.customerName || chat?.customerDraft?.name || chatPhone(chat) || 'Cliente'
    );
    const samePhone = (left, right) => digits(left) && digits(left) === digits(right);
    const productKeyFromText = (value) => {
        const text = normalized(value);
        if (text.includes('tex') && text.includes('ultra')) return 'tex_ultra_ec';
        if (text.includes('nitrix') || text.includes('nitr')) return 'nitrix_ec';
        if (text.includes('vit') && text.includes('power')) return 'vit_power_ec';
        return '';
    };
    const assetUrl = (value) => {
        const path = String(value || '').trim();
        if (!path) return '';
        if (/^https?:\/\//i.test(path) || /^blob:/i.test(path)) return path;
        if (path.startsWith('/')) return `https://ec.maxlien.shop${path}`;
        if (path.startsWith('legacy-media/') && chrome.runtime?.getURL) return chrome.runtime.getURL(path);
        return new URL(path, window.location.href).href;
    };
    const audioLabel = (template) => {
        const base = String(template?.label || template?.id || 'Áudio')
            .replace(/^EC:/i, '')
            .replace(/\.ogg$/i, '')
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const rules = [
            [/01 B BUENOS DIAS|BUENOS DIAS/i, 'Entrada manhã'],
            [/01 C BUENOS TARDES|BUENOS TARDES/i, 'Entrada tarde'],
            [/01 A BUENAS NOCHES|BUENAS NOCHES/i, 'Entrada noite'],
            [/NOME CIUDAD|NOME CIDADE|PROVINCIA/i, 'Pedir nome, cidade e província'],
            [/PERGUNTA AGENCIA DOMICILIO/i, 'Perguntar agência ou domicílio'],
            [/ENDERECO CIDADE PROVINCIA AGENCIA/i, 'Pedir dados da agência'],
            [/DOMICILIO REFERENCIA|ENDERECO ORIENTACAO/i, 'Pedir endereço e referência'],
            [/TRATAMENTO Y PRECIOS/i, 'Preços 1, 3 e 6 frascos'],
            [/FUNCIONA VIT POWER/i, 'Explicar se funciona'],
            [/DEPOIMENTO AUDIO PRODUTO/i, 'Depoimento do produto'],
            [/ENVIO AGENCIA 100 SEGURO/i, 'Segurança da agência'],
            [/TEMPO DEMORA/i, 'Tempo de entrega'],
            [/TEMPO RESULTADO/i, 'Tempo de resultado'],
            [/COMO SE TOMA/i, 'Como tomar o produto'],
            [/CLIENTES QUE LIGAM|QUANDO CLIENTE INSISTE EM LIGAR/i, 'Cliente quer ligar'],
            [/AGRADECIMENTO/i, 'Agradecimento do pedido'],
            [/BONUS RETIRADA/i, 'Bônus de retirada'],
            [/CHEGOU 01/i, 'Chegou 01 · pedido na agência'],
            [/CHEGOU 02/i, 'Chegou 02 · lembrete de retirada'],
            [/CHEGOU 03/i, 'Chegou 03 · último reforço']
        ];
        return rules.find(([pattern]) => pattern.test(base))?.[1] || base;
    };
    const findChat = (chats, selection) => {
        const byPhone = chats.find((chat) => samePhone(chatPhone(chat), selection?.phone));
        if (byPhone) return byPhone;
        const name = normalized(selection?.name);
        if (!name) return null;
        const candidates = chats.filter((chat) => normalized(chatName(chat)) === name);
        return candidates.length === 1 ? candidates[0] : null;
    };
    const draftSnapshot = () => {
        const draft = state.chat?.customerDraft || {};
        const order = state.profile?.activeOrder || {};
        const customer = order.customer || {};
        return {
            phone: chatPhone(state.chat),
            name: state.profile?.displayName || customer.name || draft.name || chatName(state.chat),
            productKey: state.productKey,
            address: customer.address || customer.agency || draft.address || draft.agency || '',
            city: customer.city || draft.city || '',
            province: customer.province || customer.state || draft.province || '',
            reference: customer.reference || draft.reference || '',
            quantity: order.quantity || draft.quantity || '',
            total: order.total ?? draft.total ?? '',
            status: order.shippingStatus || order.status || draft.status || ''
        };
    };
    const setStatus = (text, type = '') => {
        elements.connectionStatus.textContent = text;
        elements.connectionStatus.className = `status ${type}`.trim();
    };
    const setCopyStatus = (text, error = false) => {
        elements.copyStatus.textContent = text;
        elements.copyStatus.classList.toggle('error', error);
    };
    const refreshLabelButtons = async () => {
        const phone = chatPhone(state.chat);
        const stored = await chrome.storage.local.get([LABELS_KEY]);
        const selected = phone ? stored?.[LABELS_KEY]?.[phone]?.key || '' : '';
        elements.labelButtons?.querySelectorAll('[data-label]').forEach((button) => {
            button.classList.toggle('active', Boolean(selected) && button.dataset.label === selected);
        });
    };
    const saveContactLabel = async (key) => {
        const phone = chatPhone(state.chat);
        if (!phone) throw new Error('Selecione uma conversa com telefone antes de criar a etiqueta.');
        const stored = await chrome.storage.local.get([LABELS_KEY]);
        const labels = { ...(stored?.[LABELS_KEY] || {}) };
        if (!key) {
            delete labels[phone];
        } else {
            const definition = LABEL_DEFINITIONS[key];
            if (!definition) throw new Error('Etiqueta inválida.');
            labels[phone] = {
                key,
                ...definition,
                name: chatName(state.chat),
                updatedAt: new Date().toISOString()
            };
        }
        await chrome.storage.local.set({ [LABELS_KEY]: labels });
        await refreshLabelButtons();
        setCopyStatus(key
            ? `Etiqueta “${LABEL_DEFINITIONS[key].label}” aplicada ao cliente no WhatsApp.`
            : 'Etiqueta removida do cliente.');
    };
    const safeFilename = (value, fallback = 'arquivo') => String(value || fallback)
        .replace(/^EC:/i, '')
        .replace(/[^\p{L}\p{N}_.-]+/gu, '_')
        .replace(/^_+|_+$/g, '') || fallback;
    const pendingWhatsAppWebSends = new Map();
    window.addEventListener('message', (event) => {
        const message = event.data;
        if (
            event.source !== window.parent
            || message?.source !== 'vitalismen-wpp-main-bridge'
            || message?.action !== 'sendResult'
        ) return;
        const request = pendingWhatsAppWebSends.get(message.requestId);
        if (!request) return;
        pendingWhatsAppWebSends.delete(message.requestId);
        clearTimeout(request.timeout);
        if (message.ok) request.resolve(message);
        else request.reject(new Error(message.error || 'O WhatsApp Web não confirmou o envio.'));
    });
    const mediaKind = (source, typeLabel = '') => {
        const value = `${typeLabel} ${source}`.toLowerCase();
        if (/audio|\.ogg|\.opus|\.mp3|\.m4a|\.wav/.test(value)) return 'audio';
        if (/video|\.mp4|\.webm|\.mov/.test(value)) return 'video';
        if (/image|imagem|midia|mídia|\.jpe?g|\.png|\.webp|\.gif/.test(value)) return 'image';
        return 'document';
    };
    const sendThroughWhatsAppWeb = async ({
        kind,
        text = '',
        source = '',
        label = 'arquivo',
        fallbackExtension = '',
        viewOnce = false
    }) => {
        if (!chatPhone(state.chat)) throw new Error('Selecione uma conversa com telefone antes de enviar.');
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const result = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                pendingWhatsAppWebSends.delete(requestId);
                reject(new Error('A integração do WhatsApp Web demorou para confirmar o envio.'));
            }, 45000);
            pendingWhatsAppWebSends.set(requestId, { resolve, reject, timeout });
        });
        const message = {
            source: 'vitalismen-funnel-overlay',
            action: 'sendThroughWpp',
            requestId,
            kind,
            phone: chatPhone(state.chat),
            text,
            viewOnce
        };
        if (kind !== 'text') {
            const url = assetUrl(source);
            if (!url) throw new Error('Arquivo de mídia indisponível.');
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error('Não foi possível carregar a mídia da biblioteca.');
            const blob = await response.blob();
            const sourceExtension = url.match(/\.(ogg|opus|mp3|m4a|wav|jpe?g|png|webp|gif|mp4|webm|mov)(?:[?#]|$)/i)?.[1];
            const extension = sourceExtension ? `.${sourceExtension}` : fallbackExtension;
            message.filename = `${safeFilename(label).replace(/\.(ogg|opus|mp3|m4a|wav|jpe?g|png|webp|gif|mp4|webm|mov)$/i, '')}${extension}`;
            message.mimeType = blob.type || ({
                audio: 'audio/ogg',
                image: 'image/jpeg',
                video: 'video/mp4'
            }[kind] || 'application/octet-stream');
            message.buffer = await blob.arrayBuffer();
            window.parent.postMessage(message, '*', [message.buffer]);
        } else {
            window.parent.postMessage(message, '*');
        }
        return result;
    };

    const makeButton = ({ label, className = 'copy-button', onClick }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const original = label;
            button.disabled = true;
            try {
                await onClick(button);
            } catch (error) {
                button.textContent = 'Tentar';
                setCopyStatus(error.message, true);
            }
            setTimeout(() => {
                button.textContent = original;
                button.disabled = false;
            }, 1600);
        });
        return button;
    };
    const makeCardBase = (item, extraClass = '') => {
        const card = document.createElement('article');
        card.className = `card ${extraClass}`.trim();
        const code = document.createElement('span');
        code.className = 'code';
        code.textContent = item.code || item.typeLabel || '';
        const description = document.createElement('div');
        description.className = 'copy';
        const title = document.createElement('strong');
        title.textContent = item.label || 'Item do funil';
        const preview = document.createElement('span');
        preview.textContent = item.detail || item.value || '';
        description.append(title, preview);
        card.append(code, description);
        return { card, description };
    };

    const renderAudioCard = (item) => {
        const { card } = makeCardBase(item, 'audio-card');
        const button = makeButton({
            label: 'Enviar',
            className: 'copy-button download-button',
            onClick: async (control) => {
                control.textContent = 'Enviando…';
                await sendThroughWhatsAppWeb({
                    kind: 'audio',
                    source: item.mediaUrl || item.value,
                    label: item.label,
                    fallbackExtension: '.ogg'
                });
                control.textContent = 'Enviado ✓';
                setCopyStatus(`${item.code} enviado para a conversa ativa do WhatsApp.`);
            }
        });
        const player = document.createElement('audio');
        player.controls = true;
        player.preload = 'none';
        player.src = assetUrl(item.previewUrl || item.mediaUrl || item.value);
        card.append(button, player);
        return card;
    };
    const renderTextCard = (item, text) => {
        const { card } = makeCardBase(item, item.recommended ? 'recommended' : '');
        const button = makeButton({
            label: 'Enviar',
            onClick: async (control) => {
                control.textContent = 'Enviando…';
                await sendThroughWhatsAppWeb({ kind: 'text', text });
                control.textContent = 'Enviado ✓';
                setCopyStatus(`${item.code} enviado para a conversa aberta.`);
            }
        });
        card.append(button);
        return card;
    };
    const renderMediaCard = (item) => {
        const { card } = makeCardBase(item, 'media-card');
        const source = assetUrl(item.value || item.mediaUrl);
        const isVideo = item.typeLabel === 'video' || /\.(mp4|webm|mov)(?:[?#]|$)/i.test(source);
        const preview = isVideo ? document.createElement('video') : document.createElement('img');
        preview.className = 'media-preview';
        preview.src = source;
        if (isVideo) {
            preview.controls = true;
            preview.preload = 'metadata';
        } else {
            preview.loading = 'lazy';
            preview.alt = item.label || 'Mídia do funil';
        }
        const button = makeButton({
            label: 'Enviar',
            className: 'copy-button media-button',
            onClick: async (control) => {
                control.textContent = 'Enviando…';
                await sendThroughWhatsAppWeb({
                    kind: isVideo ? 'video' : 'image',
                    source: item.value || item.mediaUrl,
                    label: item.label,
                    viewOnce: item.viewOnce === true
                });
                control.textContent = 'Enviado ✓';
                setCopyStatus(`${item.code} enviado para a conversa aberta.`);
            }
        });
        card.append(button, preview);
        return card;
    };
    const renderBlockStep = (step, index) => {
        const row = document.createElement('div');
        row.className = 'block-step';
        const number = document.createElement('span');
        number.className = 'step-number';
        number.textContent = String(index + 1);
        const label = document.createElement('strong');
        label.textContent = step.label || step.type;
        row.append(number, label);
        if (step.type === 'draft') {
            row.append(makeButton({
                label: 'Enviar',
                className: 'step-button',
                onClick: async (control) => {
                    const text = legacyLibrary.resolveText(step.value, state.productKey);
                    control.textContent = 'Enviando…';
                    await sendThroughWhatsAppWeb({ kind: 'text', text });
                    control.textContent = 'Enviado ✓';
                    setCopyStatus(`Etapa ${index + 1} enviada para a conversa aberta.`);
                }
            }));
            return row;
        }
        const source = assetUrl(step.value);
        if (step.type === 'audio') {
            const player = document.createElement('audio');
            player.controls = true;
            player.preload = 'none';
            player.src = source;
            row.append(makeButton({
                label: 'Enviar',
                className: 'step-button',
                onClick: async (control) => {
                    control.textContent = 'Enviando…';
                    await sendThroughWhatsAppWeb({
                        kind: 'audio',
                        source: step.value,
                        label: step.label,
                        fallbackExtension: '.ogg'
                    });
                    control.textContent = 'Enviado ✓';
                    setCopyStatus(`Áudio da etapa ${index + 1} enviado para a conversa ativa.`);
                }
            }), player);
            return row;
        }
        const kind = mediaKind(step.value, step.typeLabel);
        const image = kind === 'video' ? document.createElement('video') : document.createElement('img');
        image.src = source;
        image.loading = 'lazy';
        image.alt = step.label || 'Mídia';
        if (kind === 'video') {
            image.controls = true;
            image.preload = 'metadata';
        }
        row.append(makeButton({
            label: 'Enviar',
            className: 'step-button',
            onClick: async (control) => {
                control.textContent = 'Enviando…';
                await sendThroughWhatsAppWeb({
                    kind,
                    source: step.value,
                    label: step.label,
                    viewOnce: step.viewOnce === true
                });
                control.textContent = 'Enviado ✓';
                setCopyStatus(`Mídia da etapa ${index + 1} enviada para a conversa aberta.`);
            }
        }), image);
        return row;
    };
    const waitBetweenBlockSteps = (ms = 900) => new Promise((resolve) => setTimeout(resolve, ms));
    const sendLegacyBlock = async (item, control) => {
        const steps = Array.isArray(item?.steps) ? item.steps : [];
        const activeSelection = await send({ action: 'activeChatStatus' }).catch(() => null);
        const targetPhone = digits(activeSelection?.phone) || chatPhone(state.chat);
        if (!targetPhone) throw new Error('Selecione uma conversa com telefone antes de enviar.');
        if (activeSelection?.pending) throw new Error('Aguarde a conversa terminar de carregar antes de enviar.');
        if (!steps.length) throw new Error('Este funil completo nao possui etapas para envio.');
        state.chat = {
            ...(state.chat || {}),
            phone: targetPhone,
            name: activeSelection?.name || chatName(state.chat)
        };
        const targetName = chatName(state.chat);
        if (!window.confirm(`Enviar o funil completo "${item.label}" com ${steps.length} etapas para ${targetName}?`)) {
            control.textContent = 'Enviar completo';
            return;
        }

        for (let index = 0; index < steps.length; index += 1) {
            const currentSelection = await send({ action: 'activeChatStatus' }).catch(() => null);
            const currentPhone = digits(currentSelection?.phone) || chatPhone(state.chat);
            if (currentSelection?.pending || currentPhone !== targetPhone) {
                throw new Error('A conversa ativa mudou. Envio interrompido para proteger o cliente.');
            }
            const step = steps[index];
            control.textContent = `Enviando ${index + 1}/${steps.length}...`;
            if (step.type === 'draft') {
                const text = legacyLibrary.resolveText(step.value, state.productKey);
                if (!text) throw new Error(`Texto vazio na etapa ${index + 1}.`);
                await sendThroughWhatsAppWeb({ kind: 'text', text });
            } else {
                const kind = step.type === 'audio' ? 'audio' : mediaKind(step.value, step.typeLabel);
                await sendThroughWhatsAppWeb({
                    kind,
                    source: step.value,
                    label: step.label,
                    fallbackExtension: step.type === 'audio' ? '.ogg' : '',
                    viewOnce: step.viewOnce === true
                });
            }
            setCopyStatus(`${item.label}: etapa ${index + 1}/${steps.length} enviada.`);
            if (index < steps.length - 1) await waitBetweenBlockSteps();
        }

        control.textContent = 'Enviado ✓';
        setCopyStatus(`Funil completo "${item.label}" enviado para ${targetName}.`);
    };
    const renderBlockCard = (item) => {
        const details = document.createElement('details');
        details.className = 'block-card';
        const summary = document.createElement('summary');
        const code = document.createElement('span');
        code.className = 'code';
        code.textContent = item.code;
        const copy = document.createElement('span');
        copy.className = 'copy';
        const title = document.createElement('strong');
        title.textContent = item.label;
        const detail = document.createElement('span');
        detail.textContent = item.detail;
        copy.append(title, detail);
        const sendAll = makeButton({
            label: 'Enviar completo',
            className: 'block-send-button',
            onClick: (control) => sendLegacyBlock(item, control)
        });
        sendAll.title = 'Enviar todas as etapas deste funil, na ordem, para a conversa ativa';
        const open = document.createElement('b');
        open.textContent = 'Ver';
        summary.append(code, copy, sendAll, open);
        const steps = document.createElement('section');
        steps.className = 'block-steps';
        item.steps.forEach((step, index) => steps.append(renderBlockStep(step, index)));
        details.append(summary, steps);
        return details;
    };

    const filterLegacyItems = (items) => {
        const typeMap = { draft: 'texto', audio: 'audio', media: 'midia', block: 'bloco' };
        const needle = normalized(state.search);
        return items.filter((item) => {
            if (state.contentType !== 'todos' && typeMap[item.type] !== state.contentType) return false;
            if (!needle) return true;
            const stepText = (item.steps || []).map((step) => `${step.label || ''} ${step.value || ''}`).join(' ');
            return normalized(`${item.code || ''} ${item.label || ''} ${item.detail || ''} ${item.typeLabel || ''} ${item.value || ''} ${stepText}`)
                .includes(needle);
        });
    };
    const renderLegacy = () => {
        const items = filterLegacyItems(legacyLibrary.list({ productKey: state.productKey }));
        elements.productLabel.textContent = `${legacyLibrary.productName(state.productKey)} · biblioteca antiga congelada`;
        elements.responseCount.textContent = String(items.length);
        elements.responseList.replaceChildren();
        if (!items.length) {
            const empty = document.createElement('p');
            empty.className = 'empty';
            empty.textContent = 'Nenhum item encontrado.';
            elements.responseList.append(empty);
            return;
        }
        items.forEach((item) => {
            if (item.type === 'audio') {
                elements.responseList.append(renderAudioCard(item));
            } else if (item.type === 'draft') {
                elements.responseList.append(renderTextCard(item, item.text || legacyLibrary.resolveText(item.value, state.productKey)));
            } else if (item.type === 'media') {
                elements.responseList.append(renderMediaCard(item));
            } else if (item.type === 'block') {
                elements.responseList.append(renderBlockCard(item));
            }
        });
    };

    const renderAssisted = () => {
        const draft = draftSnapshot();
        const textItems = assistedLibrary.list({
            productKey: state.productKey,
            category: state.category,
            search: state.search,
            stage: state.stage
        });
        const needle = normalized(state.search);
        const audioItems = state.audioTemplates.filter((item) => (
            !needle || normalized(`${audioLabel(item)} ${item.label || ''} ${item.id || ''}`).includes(needle)
        ));
        const showText = state.contentType === 'todos' || state.contentType === 'texto';
        const showAudio = state.contentType === 'todos' || state.contentType === 'audio';
        const total = (showText ? textItems.length : 0) + (showAudio ? audioItems.length : 0);
        elements.productLabel.textContent = `${assistedLibrary.productName(state.productKey)} · funil assistido`;
        elements.responseCount.textContent = String(total);
        elements.responseList.replaceChildren();
        if (!total) {
            const empty = document.createElement('p');
            empty.className = 'empty';
            empty.textContent = 'Nenhuma resposta encontrada.';
            elements.responseList.append(empty);
            return;
        }
        if (showAudio) audioItems.forEach((item, index) => {
            elements.responseList.append(renderAudioCard({
                ...item,
                code: `A${String(index + 1).padStart(2, '0')}`,
                label: audioLabel(item),
                detail: String(item.label || item.id || '').replace(/_/g, ' ')
            }));
        });
        if (showText) textItems.forEach((item) => {
            elements.responseList.append(renderTextCard(item, assistedLibrary.resolve(item, draft)));
        });
    };

    const syncTabs = () => {
        elements.sourceTabs.querySelectorAll('[data-source]').forEach((button) => {
            button.classList.toggle('active', button.dataset.source === state.source);
        });
        elements.productTabs.querySelectorAll('[data-product]').forEach((button) => {
            button.classList.toggle('active', button.dataset.product === state.productKey);
        });
        elements.categoryTabs.querySelectorAll('[data-category]').forEach((button) => {
            button.classList.toggle('active', button.dataset.category === state.category);
        });
        elements.typeTabs.querySelectorAll('[data-type]').forEach((button) => {
            button.classList.toggle('active', button.dataset.type === state.contentType);
            button.hidden = state.source === 'assisted' && ['midia', 'bloco'].includes(button.dataset.type);
        });
        elements.categoryTabs.classList.toggle('hidden', state.source === 'legacy' || state.contentType === 'audio');
    };
    const render = () => {
        const draft = draftSnapshot();
        elements.clientName.textContent = draft.name || 'Cliente selecionado';
        elements.clientPhone.textContent = draft.phone ? `+${draft.phone}` : '';
        syncTabs();
        if (state.source === 'legacy') renderLegacy();
        else renderAssisted();
    };

    const loadContext = async () => {
        setStatus('Conectando ao cliente selecionado…', 'loading');
        try {
            const auth = await send({ action: 'authStatus' });
            if (!auth?.authenticated) throw new Error('Abra o painel lateral uma vez para recuperar a sessão segura.');
            const selection = await send({ action: 'activeChatStatus' });
            if (!selection || selection.pending || (!selection.phone && !selection.name)) {
                throw new Error('Clique em uma conversa do WhatsApp para conectar o funil.');
            }
            const chatData = await api('/api/whatsapp/chats?country=EC&fast=1');
            const chats = Array.isArray(chatData) ? chatData : (chatData?.chats || []);
            state.chat = findChat(chats, selection) || {
                phone: selection.phone,
                name: selection.name || selection.phone,
                customerDraft: {}
            };
            const phone = chatPhone(state.chat);
            const [profile, messageData, templateData] = await Promise.all([
                phone
                    ? api(`/api/whatsapp/customer-profile/${encodeURIComponent(phone)}`).catch(() => ({}))
                    : Promise.resolve({}),
                phone
                    ? api(`/api/whatsapp/messages/${encodeURIComponent(phone)}?fast=1&limit=80`).catch(() => [])
                    : Promise.resolve([]),
                api('/api/whatsapp/templates?country=EC').catch(() => ({ templates: [] }))
            ]);
            state.profile = profile || {};
            state.messages = Array.isArray(messageData) ? messageData : (messageData?.messages || []);
            state.audioTemplates = Array.isArray(templateData) ? templateData : (templateData?.templates || []);
            const draft = state.chat.customerDraft || {};
            const order = state.profile.activeOrder || {};
            const productKey = draft.productKey
                || state.chat.productKey
                || productKeyFromText(draft.productName || state.chat.productName || order.productName);
            if (productKey && assistedLibrary.PRODUCTS[productKey]) state.productKey = productKey;
            const analysis = shadow?.analyze({
                draft: draftSnapshot(),
                profile: state.profile,
                messages: state.messages
            });
            state.stage = analysis?.stage || '';
            elements.stageBadge.textContent = analysis?.stageLabel || 'Funil assistido';
            await refreshLabelButtons();
            setStatus(`Conectado a +${phone}. Biblioteca antiga completa disponível.`);
            render();
        } catch (error) {
            setStatus(error.message, 'error');
            render();
        }
    };

    elements.sourceTabs.addEventListener('click', (event) => {
        const button = event.target.closest('[data-source]');
        if (!button) return;
        state.source = button.dataset.source;
        if (state.source === 'assisted' && ['midia', 'bloco'].includes(state.contentType)) state.contentType = 'todos';
        chrome.storage.local.set({ vitalismenFunnelSource: state.source });
        setCopyStatus(state.source === 'legacy'
            ? 'Funil antigo completo aberto. Todo conteúdo é enviado diretamente pelo WhatsApp Web.'
            : 'Funis assistidos atuais abertos. Todo conteúdo é enviado diretamente pelo WhatsApp Web.');
        render();
    });
    elements.labelButtons?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-label]');
        if (!button) return;
        saveContactLabel(button.dataset.label).catch((error) => setCopyStatus(error.message, true));
    });
    elements.productTabs.addEventListener('click', (event) => {
        const button = event.target.closest('[data-product]');
        if (!button) return;
        state.productKey = button.dataset.product;
        render();
    });
    elements.categoryTabs.addEventListener('click', (event) => {
        const button = event.target.closest('[data-category]');
        if (!button) return;
        state.category = button.dataset.category;
        render();
    });
    elements.typeTabs.addEventListener('click', (event) => {
        const button = event.target.closest('[data-type]');
        if (!button || button.hidden) return;
        state.contentType = button.dataset.type;
        render();
    });
    elements.funnelSearch.addEventListener('input', () => {
        state.search = elements.funnelSearch.value;
        render();
    });
    window.addEventListener('message', (event) => {
        if (event.data?.source === 'vitalismen-funnel-shell' && event.data?.action === 'refresh') {
            loadContext();
        }
    });
    chrome.runtime.onMessage.addListener((message) => {
        if (message?.action === 'activeWhatsAppChat' || message?.action === 'whatsAppChatSwitchStarted') {
            loadContext();
        }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[LABELS_KEY]) refreshLabelButtons().catch(() => {});
    });

    chrome.storage.local.get(['vitalismenFunnelSource'], (stored) => {
        if (stored?.vitalismenFunnelSource === 'assisted') state.source = 'assisted';
        render();
        loadContext();
    });
})();
