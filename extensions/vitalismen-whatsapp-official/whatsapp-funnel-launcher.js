(() => {
    'use strict';

    const INSTALL_VERSION = '0.13.3';
    if (window.__vitalismenFunnelLauncherInstalled === INSTALL_VERSION) return;
    window.__vitalismenFunnelLauncherInstalled = INSTALL_VERSION;

    const LAUNCHER_HOST_ID = 'vitalismen-funnel-launcher-host';
    const OVERLAY_HOST_ID = 'vitalismen-funnel-overlay-host';
    const LAYOUT_KEY = 'vitalismenFunnelOverlayLayoutV080';
    const MIN_WIDTH = 440;
    const MIN_HEIGHT = 540;
    const HEADER_HEIGHT = 48;
    const DEFAULT_WIDTH = 540;
    const DEFAULT_HEIGHT = 820;
    let overlay = null;
    let launcherButton = null;
    let quickDefinition = null;
    let quickContextSequence = 0;
    let lastQuickSelectionSignature = '';
    let minimized = false;
    let lastExpandedHeight = 620;
    let currentStatusPhone = '';

    const quickLibrary = globalThis.VitalismenQuickPriceFunnel;
    const activeQuickProduct = globalThis.VitalismenActiveQuickPriceProduct;
    const activeQuickDefinition = () => quickLibrary?.definition(
        String(activeQuickProduct?.productKey || '').trim().toLowerCase()
    ) || null;
    quickDefinition = activeQuickDefinition();
    const sendRuntime = (message) => new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (!response?.ok) return reject(new Error(response?.error || 'Falha na extensao'));
            resolve(response.data);
        });
    });
    const api = (path) => sendRuntime({ action: 'api', request: { path, method: 'GET' } });
    const apiRequest = (path, { method = 'GET', body } = {}) => sendRuntime({
        action: 'api',
        request: { path, method, ...(body === undefined ? {} : { body }) }
    });
    const digits = (value) => String(value || '').replace(/\D/g, '');
    const normalized = (value) => String(value || '').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const chatPhone = (chat) => digits(chat?.phone || chat?.peerPhone || chat?.id);
    const chatName = (chat) => String(chat?.name || chat?.pushName || chat?.customerName || chat?.customerDraft?.name || '');
    const findChat = (chats, selection = {}) => {
        const selectedPhone = digits(selection.phone);
        const byPhone = selectedPhone ? chats.find((chat) => {
            const candidate = chatPhone(chat);
            return candidate === selectedPhone || candidate.endsWith(selectedPhone) || selectedPhone.endsWith(candidate);
        }) : null;
        if (byPhone) return byPhone;
        const selectedName = normalized(selection.name);
        if (!selectedName) return null;
        const matches = chats.filter((chat) => normalized(chatName(chat)) === selectedName);
        return matches.length === 1 ? matches[0] : null;
    };
    const launcherRoot = () => document.getElementById(LAUNCHER_HOST_ID)?.shadowRoot || null;
    const setQuickStatus = (message = '', error = false) => {
        const status = launcherRoot()?.querySelector('[data-role="quick-status"]');
        if (!status) return;
        status.textContent = message;
        status.classList.toggle('error', Boolean(error));
    };
    const renderOperationalStatus = (operationalStatus = null, phone = '') => {
        const select = launcherRoot()?.querySelector('[data-action="status-select"]');
        if (!select) return;
        currentStatusPhone = digits(phone);
        select.disabled = !currentStatusPhone;
        const automaticOption = select.querySelector('option[value=""]');
        if (automaticOption) automaticOption.textContent = operationalStatus?.manual
            ? 'Voltar ao automático'
            : `Status: ${operationalStatus?.label || 'Atendendo'}`;
        select.value = operationalStatus?.manual ? operationalStatus.key : '';
        select.title = operationalStatus?.manual
            ? `Ajuste manual: ${operationalStatus.label}`
            : `Automático pelo ${operationalStatus?.source || 'painel'}: ${operationalStatus?.label || 'Atendendo'}`;
    };
    const saveOperationalStatus = async (key) => {
        if (!currentStatusPhone) throw new Error('Selecione uma conversa com telefone.');
        const result = await apiRequest(`/api/whatsapp/chat-labels/${encodeURIComponent(currentStatusPhone)}`, {
            method: 'PATCH',
            body: { overrideStatus: key || null }
        });
        renderOperationalStatus(result.operationalStatus, currentStatusPhone);
        await sendRuntime({ action: 'syncOperationalLabels' }).catch(() => null);
        setQuickStatus(key
            ? `Status manual salvo: ${result.operationalStatus?.label || key}.`
            : `Status automático restaurado: ${result.operationalStatus?.label || 'Atendendo'}.`);
    };
    const insertQuickTextIntoComposer = (text) => {
        const input = document.querySelector('[data-testid="conversation-compose-box-input"]')
            || document.querySelector('#main footer [contenteditable="true"]');
        if (!input) throw new Error('Caixa de mensagem nao encontrada.');
        if (String(input.innerText || '').replace(/\u200B/g, '').trim()) {
            throw new Error('A caixa ja possui texto. Apague-o antes de escolher o preco.');
        }
        input.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(input);
        selection.removeAllRanges();
        selection.addRange(range);
        const inserted = document.execCommand('insertText', false, text);
        if (!inserted) {
            input.textContent = text;
            input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        }
        input.focus();
    };
    const renderQuickFunnel = () => {
        const root = launcherRoot();
        if (!root) return;
        const quickButton = root.querySelector('[data-action="quick-toggle"]');
        const offers = root.querySelector('[data-role="quick-offers"]');
        if (!quickButton || !offers) return;
        offers.replaceChildren();
        if (!quickDefinition) {
            quickButton.hidden = true;
            offers.hidden = true;
            setQuickStatus('');
            return;
        }
        quickButton.hidden = false;
        quickButton.textContent = `Preço ${quickDefinition.productName}`;
        quickButton.title = `Abrir preços rápidos de ${quickDefinition.productName}`;
        const appendLabel = (text) => {
            const label = document.createElement('span');
            label.className = 'quick-label';
            label.textContent = text;
            offers.append(label);
        };
        const appendFillButton = (item, className) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = className;
            button.textContent = item.buttonLabel;
            button.title = item.text;
            button.addEventListener('click', () => {
                try {
                    insertQuickTextIntoComposer(item.text);
                    setQuickStatus('Texto colocado na caixa. Revise e envie pelo WhatsApp.');
                } catch (error) {
                    setQuickStatus(error.message, true);
                }
            });
            offers.append(button);
        };
        appendLabel('Frascos Tex Ultra');
        quickDefinition.offers.forEach((offer) => appendFillButton(offer, 'offer'));
        if (quickDefinition.prompts?.length) {
            appendLabel('Dados do cliente');
            quickDefinition.prompts.forEach((prompt) => appendFillButton(prompt, 'prompt'));
        }
    };
    const refreshQuickContext = async (providedSelection = null) => {
        const sequence = ++quickContextSequence;
        quickDefinition = activeQuickDefinition();
        renderQuickFunnel();
        try {
            if (!quickLibrary) return;
            const selection = providedSelection || await sendRuntime({ action: 'activeChatStatus' });
            if (!selection || selection.pending) return;
            renderOperationalStatus(null, '');
            const chatData = await api('/api/whatsapp/chats?country=EC&fast=1');
            const chats = Array.isArray(chatData) ? chatData : (chatData?.chats || []);
            const chat = findChat(chats, selection);
            const phone = chatPhone(chat) || digits(selection.phone);
            const profile = phone
                ? await api(`/api/whatsapp/customer-profile/${encodeURIComponent(phone)}`).catch(() => ({}))
                : {};
            const productKey = String(chat?.vslProductKey || chat?.productKey
                || chat?.customerDraft?.productKey || chat?.assignedAgent || '').trim().toLowerCase();
            if (sequence !== quickContextSequence) return;
            quickDefinition = quickLibrary.definition(productKey) || activeQuickDefinition();
            renderQuickFunnel();
            renderOperationalStatus(profile?.operationalStatus || null, phone);
        } catch {
            if (sequence === quickContextSequence) {
                quickDefinition = activeQuickDefinition();
                renderQuickFunnel();
            }
        }
    };
    const pollQuickContext = async () => {
        try {
            const selection = await sendRuntime({ action: 'activeChatStatus' });
            const signature = selection?.pending
                ? `pending:${selection?.observedAt || ''}`
                : `${digits(selection?.phone)}|${normalized(selection?.name)}`;
            if (signature === lastQuickSelectionSignature) return;
            lastQuickSelectionSignature = signature;
            await refreshQuickContext(selection);
        } catch {
            // O proximo ciclo tenta novamente sem interferir no WhatsApp.
        }
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const saveLayout = () => {
        if (!overlay) return;
        chrome.storage.local.set({
            [LAYOUT_KEY]: {
                left: overlay.offsetLeft,
                top: overlay.offsetTop,
                width: overlay.offsetWidth,
                height: minimized ? lastExpandedHeight : overlay.offsetHeight
            }
        });
    };

    const constrainOverlay = () => {
        if (!overlay || overlay.hidden) return;
        const availableWidth = Math.max(240, window.innerWidth - 16);
        const availableHeight = Math.max(HEADER_HEIGHT, window.innerHeight - 16);
        const measuredWidth = overlay.offsetWidth || DEFAULT_WIDTH;
        const measuredHeight = overlay.offsetHeight || lastExpandedHeight || DEFAULT_HEIGHT;
        const width = Math.min(Math.max(MIN_WIDTH, measuredWidth), availableWidth);
        const height = minimized
            ? HEADER_HEIGHT
            : Math.min(Math.max(MIN_HEIGHT, measuredHeight), availableHeight);
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
        overlay.style.left = `${clamp(overlay.offsetLeft, 8, Math.max(8, window.innerWidth - overlay.offsetWidth - 8))}px`;
        overlay.style.top = `${clamp(overlay.offsetTop, 8, Math.max(8, window.innerHeight - overlay.offsetHeight - 8))}px`;
    };

    const setMinimized = (next) => {
        if (!overlay) return;
        minimized = Boolean(next);
        if (minimized) {
            lastExpandedHeight = Math.max(MIN_HEIGHT, overlay.offsetHeight);
            overlay.style.height = `${HEADER_HEIGHT}px`;
        } else {
            overlay.style.height = `${Math.min(lastExpandedHeight, window.innerHeight - 16)}px`;
        }
        overlay.classList.toggle('is-minimized', minimized);
        const button = overlay.querySelector('[data-action="minimize"]');
        if (button) {
            button.textContent = minimized ? '□' : '—';
            button.title = minimized ? 'Restaurar funil' : 'Minimizar funil';
        }
        constrainOverlay();
        saveLayout();
    };

    const hideOverlay = () => {
        if (!overlay) return;
        overlay.hidden = true;
        launcherButton?.classList.remove('is-active');
        saveLayout();
    };

    const showOverlay = () => {
        ensureOverlay().then(() => {
            overlay.hidden = false;
            if (minimized) setMinimized(false);
            if (overlay.offsetHeight < MIN_HEIGHT) {
                overlay.style.height = `${Math.min(lastExpandedHeight || DEFAULT_HEIGHT, window.innerHeight - 16)}px`;
            }
            constrainOverlay();
            launcherButton?.classList.add('is-active');
            overlay.querySelector('iframe')?.contentWindow?.postMessage(
                { source: 'vitalismen-funnel-shell', action: 'refresh' },
                '*'
            );
        });
    };

    const toggleOverlay = () => {
        if (overlay && !overlay.hidden) hideOverlay();
        else showOverlay();
    };

    const handleGeneralFunnelClick = async () => {
        const opening = !overlay || overlay.hidden;
        toggleOverlay();
        if (!opening) return;
        const auth = await sendRuntime({ action: 'authStatus' }).catch(() => null);
        if (!auth?.authenticated) {
            setQuickStatus('Sessão expirada: entre novamente no painel lateral para carregar o Funil.', true);
        }
    };

    const startDrag = (event) => {
        if (event.button !== 0 || event.target.closest('button')) return;
        if (minimized) setMinimized(false);
        const startX = event.clientX;
        const startY = event.clientY;
        const startLeft = overlay.offsetLeft;
        const startTop = overlay.offsetTop;
        overlay.setPointerCapture?.(event.pointerId);

        const move = (moveEvent) => {
            overlay.style.left = `${clamp(
                startLeft + moveEvent.clientX - startX,
                8,
                Math.max(8, window.innerWidth - overlay.offsetWidth - 8)
            )}px`;
            overlay.style.top = `${clamp(
                startTop + moveEvent.clientY - startY,
                8,
                Math.max(8, window.innerHeight - overlay.offsetHeight - 8)
            )}px`;
        };
        const end = () => {
            window.removeEventListener('pointermove', move, true);
            window.removeEventListener('pointerup', end, true);
            saveLayout();
        };
        window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerup', end, true);
        event.preventDefault();
    };

    const startResize = (event) => {
        if (event.button !== 0 || minimized) return;
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = overlay.offsetWidth;
        const startHeight = overlay.offsetHeight;

        const move = (moveEvent) => {
            overlay.style.width = `${clamp(
                startWidth + moveEvent.clientX - startX,
                MIN_WIDTH,
                window.innerWidth - overlay.offsetLeft - 8
            )}px`;
            overlay.style.height = `${clamp(
                startHeight + moveEvent.clientY - startY,
                MIN_HEIGHT,
                window.innerHeight - overlay.offsetTop - 8
            )}px`;
        };
        const end = () => {
            window.removeEventListener('pointermove', move, true);
            window.removeEventListener('pointerup', end, true);
            lastExpandedHeight = overlay.offsetHeight;
            saveLayout();
        };
        window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerup', end, true);
        event.preventDefault();
    };

    const ensureOverlay = async () => {
        if (overlay?.isConnected) return;
        let host = document.getElementById(OVERLAY_HOST_ID);
        if (!host) {
            host = document.createElement('div');
            host.id = OVERLAY_HOST_ID;
            document.body.append(host);
        }
        const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
        root.innerHTML = `
            <style>
                :host { all: initial; }
                .panel {
                    position: fixed;
                    z-index: 2147483646;
                    width: ${DEFAULT_WIDTH}px;
                    height: ${DEFAULT_HEIGHT}px;
                    left: calc(100vw - 950px);
                    top: 70px;
                    display: grid;
                    grid-template-rows: ${HEADER_HEIGHT}px minmax(0, 1fr);
                    overflow: hidden;
                    border: 1px solid #087f70;
                    border-radius: 16px;
                    background: #f7fbf9;
                    box-shadow: 0 18px 52px rgba(0, 0, 0, .32);
                    font: 13px/1.35 Arial, sans-serif;
                    color: #102c27;
                }
                .panel[hidden] { display: none; }
                .panel.is-minimized { grid-template-rows: ${HEADER_HEIGHT}px 0; }
                .bar {
                    min-width: 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 0 8px 0 14px;
                    color: #fff;
                    background: linear-gradient(135deg, #087f70, #0b9b7e);
                    cursor: move;
                    user-select: none;
                }
                .brand { flex: 1; min-width: 0; }
                .brand strong, .brand span { display: block; }
                .brand strong { font-size: 13px; }
                .brand span { font-size: 10px; opacity: .85; }
                .control {
                    width: 30px;
                    height: 30px;
                    padding: 0;
                    border: 1px solid rgba(255,255,255,.55);
                    border-radius: 50%;
                    color: #fff;
                    background: transparent;
                    cursor: pointer;
                    font: 700 15px Arial, sans-serif;
                }
                iframe {
                    width: 100%;
                    height: 100%;
                    border: 0;
                    background: #f7fbf9;
                }
                .resize {
                    position: absolute;
                    right: 0;
                    bottom: 0;
                    width: 22px;
                    height: 22px;
                    cursor: nwse-resize;
                    background: linear-gradient(135deg, transparent 48%, #087f70 49%, #087f70 57%, transparent 58%);
                }
                .is-minimized .resize { display: none; }
            </style>
            <section class="panel" hidden>
                <header class="bar">
                    <div class="brand">
                        <strong>Funil Vitalismen · v${INSTALL_VERSION}</strong>
                        <span>Arraste para qualquer lugar · uso humano</span>
                    </div>
                    <button class="control" type="button" data-action="minimize" title="Minimizar funil">—</button>
                    <button class="control" type="button" data-action="close" title="Fechar funil">×</button>
                </header>
                <iframe title="Respostas do funil Vitalismen" src="${chrome.runtime.getURL('funnel-overlay.html')}"></iframe>
                <span class="resize" title="Redimensionar"></span>
            </section>
        `;
        overlay = root.querySelector('.panel');
        const saved = await chrome.storage.local.get(LAYOUT_KEY).catch(() => ({}));
        const layout = saved?.[LAYOUT_KEY];
        if (layout) {
            const savedWidth = Number(layout.width);
            const savedHeight = Number(layout.height);
            overlay.style.left = `${Number(layout.left) || 8}px`;
            overlay.style.top = `${Number(layout.top) || 90}px`;
            overlay.style.width = `${savedWidth >= MIN_WIDTH ? savedWidth : DEFAULT_WIDTH}px`;
            overlay.style.height = `${savedHeight >= MIN_HEIGHT ? savedHeight : DEFAULT_HEIGHT}px`;
            lastExpandedHeight = savedHeight >= MIN_HEIGHT ? savedHeight : DEFAULT_HEIGHT;
        }
        root.querySelector('.bar').addEventListener('pointerdown', startDrag);
        root.querySelector('[data-action="minimize"]').addEventListener('click', () => setMinimized(!minimized));
        root.querySelector('[data-action="close"]').addEventListener('click', hideOverlay);
        root.querySelector('.resize').addEventListener('pointerdown', startResize);
    };

    const makeLauncher = () => {
        let host = document.getElementById(LAUNCHER_HOST_ID);
        if (!host) {
            host = document.createElement('span');
            host.id = LAUNCHER_HOST_ID;
        }
        const needsBuild = !host.shadowRoot || !host.shadowRoot.querySelector('[data-toolbar-version="0.13.3"]');
        if (needsBuild) {
            const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
            root.innerHTML = `
                <style>
                    :host {
                        display: flex;
                        flex: 1 0 100%;
                        width: calc(100% - 10px);
                        height: 39px;
                        min-height: 39px;
                        align-items: center;
                        margin: 0 5px;
                        overflow: hidden;
                    }
                    .toolbar {
                        display: flex;
                        align-items: center;
                        flex-wrap: nowrap;
                        gap: 6px;
                        width: 100%;
                        min-width: 0;
                        padding-bottom: 3px;
                        overflow-x: auto;
                        overflow-y: hidden;
                        scrollbar-width: thin;
                        scrollbar-color: #98b9b2 transparent;
                    }
                    .toolbar::-webkit-scrollbar { height: 4px; }
                    .toolbar::-webkit-scrollbar-thumb { border-radius: 4px; background: #98b9b2; }
                    button {
                        flex: 0 0 auto;
                        height: 30px;
                        padding: 0 14px;
                        border: 1px solid #087f70;
                        border-radius: 17px;
                        color: #075e54;
                        background: #fff;
                        cursor: pointer;
                        font: 700 12px Arial, sans-serif;
                        box-shadow: 0 1px 2px rgba(0,0,0,.08);
                    }
                    button:hover, button.is-active { color: #fff; background: #0b9b7e; }
                    button[hidden], [hidden] { display: none !important; }
                    select {
                        flex: 0 0 auto;
                        height: 30px;
                        max-width: 190px;
                        padding: 0 28px 0 11px;
                        border: 1px solid #087f70;
                        border-radius: 17px;
                        color: #075e54;
                        background: #fff;
                        font: 700 12px Arial, sans-serif;
                        cursor: pointer;
                    }
                    select:disabled { opacity: .55; cursor: default; }
                    .offers { display: flex; flex: 0 0 auto; flex-wrap: nowrap; align-items: center; gap: 5px; }
                    .quick-label { flex: 0 0 auto; margin: 0 2px 0 4px; color: #52716b; white-space: nowrap; font: 700 10px Arial, sans-serif; }
                    .offer { height: 30px; padding: 0 10px; border-color: #d6a100; color: #6c5100; background: #fff9d8; }
                    .offer:hover { color: #fff; background: #c58f00; }
                    .prompt { height: 30px; padding: 0 10px; border-color: #5b8def; color: #2454a6; background: #eef4ff; }
                    .prompt:hover { color: #fff; background: #3974d7; }
                    .status { flex: 0 0 auto; color: #52716b; white-space: nowrap; font: 600 10px Arial, sans-serif; }
                    .status:empty { display: none; }
                    .status.error { color: #b3261e; }
                </style>
                <div class="toolbar" data-toolbar-version="0.13.3">
                    <button type="button" data-action="general" title="Abrir funil geral Vitalismen">Funil</button>
                    <button type="button" data-action="quick-toggle" hidden>Preço rápido</button>
                    <select data-action="status-select" title="Status operacional do cliente" disabled>
                        <option value="">Status: Atendendo</option>
                        <option value="atendendo">Manual: Atendendo</option>
                        <option value="comprar_depois">Manual: Comprar depois</option>
                        <option value="confirmado">Manual: Confirmado</option>
                        <option value="enviado">Manual: Enviado</option>
                        <option value="em_rota">Manual: Em rota</option>
                        <option value="na_agencia">Manual: Na agência</option>
                        <option value="entregue">Manual: Entregue</option>
                        <option value="devolvido">Manual: Devolvido</option>
                        <option value="cancelado">Manual: Cancelado</option>
                    </select>
                    <div class="offers" data-role="quick-offers" hidden></div>
                    <span class="status" data-role="quick-status" aria-live="polite"></span>
                </div>
            `;
            launcherButton = root.querySelector('[data-action="general"]');
            launcherButton.addEventListener('click', handleGeneralFunnelClick);
            root.querySelector('[data-action="quick-toggle"]').addEventListener('click', (event) => {
                const offers = root.querySelector('[data-role="quick-offers"]');
                offers.hidden = !offers.hidden;
                event.currentTarget.classList.toggle('is-active', !offers.hidden);
                setQuickStatus(offers.hidden ? '' : 'Escolha uma opção para preencher a caixa de mensagem.');
            });
            root.querySelector('[data-action="status-select"]').addEventListener('change', (event) => {
                const select = event.currentTarget;
                select.disabled = true;
                saveOperationalStatus(select.value)
                    .catch((error) => setQuickStatus(error.message, true))
                    .finally(() => { select.disabled = !currentStatusPhone; });
            });
        } else {
            const previousButton = host.shadowRoot.querySelector('[data-action="general"]');
            launcherButton = previousButton.cloneNode(true);
            previousButton.replaceWith(launcherButton);
            launcherButton.addEventListener('click', handleGeneralFunnelClick);
        }
        renderQuickFunnel();
        return host;
    };

    const findComposer = () => (
        document.querySelector('#main footer')
        || document.querySelector('#main [contenteditable="true"]')?.closest('footer')
        || document.querySelector('[data-testid="conversation-compose-box-input"]')?.closest('footer')
    );

    const ensureLauncher = () => {
        const composer = findComposer();
        if (!composer) return;
        const host = makeLauncher();
        if (host.parentElement !== composer) composer.append(host);
    };

    const observer = new MutationObserver(ensureLauncher);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ensureLauncher();
    ensureOverlay();
    pollQuickContext();
    setInterval(pollQuickContext, 1800);
    window.addEventListener('resize', constrainOverlay);
    chrome.runtime.onMessage.addListener((message) => {
        if (message?.action !== 'activeWhatsAppChat' && message?.action !== 'whatsAppChatSwitchStarted') return;
        pollQuickContext();
        overlay?.querySelector('iframe')?.contentWindow?.postMessage(
            { source: 'vitalismen-funnel-shell', action: 'refresh' },
            '*'
        );
    });
})();
