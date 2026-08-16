const elements = Object.fromEntries(
    [
        'loginView', 'appView', 'loginForm', 'emailInput', 'passwordInput', 'loginButton',
        'loginError', 'logoutButton', 'operatorName', 'syncStatus', 'refreshButton',
        'searchInput', 'clientCount', 'clientList', 'listView', 'historyView', 'backButton',
        'customerName', 'customerPhone', 'openWhatsAppButton', 'messageList', 'appError',
        'detectedChatBanner', 'detectedChatText', 'profileOrderId', 'profileOrderStatus',
        'profileQuantity', 'profileTotal', 'profileStats', 'humanControlTitle',
        'humanControlStatus', 'claimButton', 'customerForm', 'analyzeButton', 'analysisResult',
        'funnelStage', 'funnelPriority', 'funnelProgressBar', 'funnelAge',
        'funnelNextAction', 'funnelMissing',
        'productFunnelTabs', 'productFunnelSearch', 'productFunnelCategories',
        'productFunnelList', 'productFunnelCount', 'productFunnelCopyStatus',
        'productFunnelPanel', 'productFunnelDragHandle', 'openProductFunnelButton',
        'minimizeProductFunnelButton', 'closeProductFunnelButton', 'productFunnelResizeHandle',
        'toggleProductFunnelSizeButton',
        'draftName', 'draftPhone', 'draftCountry', 'draftProduct', 'draftAddress',
        'draftCity', 'draftProvince', 'draftReference', 'draftQuantity', 'draftTotal',
        'draftStatus', 'buyLaterSchedule', 'draftBuyLaterFollowupAt', 'addBuyLaterScheduleButton',
        'saveDraftButton', 'saveStatus', 'historyDetails', 'autoSaveState',
        'texUltraKitSection', 'orderKitOptions', 'orderReadiness', 'orderSummary',
        'markPurchaseButton', 'metaPurchaseStatus',
        'agencySuggestions', 'agencySuggestionsState', 'agencySearchInput',
        'agencySuggestionList', 'prevAgencyBatchBtn', 'sendAgencyListBtn',
        'nextAgencyBatchBtn', 'googleContactsCard', 'googleContactsStatus',
        'googleConnectButton', 'googleDisconnectButton', 'googleContactStatus',
        'retryGoogleContactButton', 'resolveGoogleContactNameButton'
    ].map((id) => [id, document.getElementById(id)])
);

const state = {
    chats: [],
    selectedChat: null,
    messages: [],
    profile: {},
    suggestions: {},
    authenticated: false,
    formDirty: false,
    manualFieldIds: new Set(),
    autoSaveTimer: null,
    autoSaveInFlight: false,
    autoSaveQueued: false,
    lastAutoSaveFingerprint: '',
    chatTimer: null,
    messageTimer: null,
    activeChatTimer: null,
    chatRefreshInFlight: false,
    activeSelectionSignature: '',
    ignoredSelectionSignature: '',
    selectionEpoch: 0,
    funnelAnalysis: null,
    productFunnelCategory: 'todos',
    productFunnelOpen: false,
    productFunnelMinimized: false,
    productFunnelFitForm: false,
    agencySuggestionsAll: [],
    agencySuggestions: [],
    agencySuggestionOffset: 0,
    agencyLookupTimer: null,
    agencyLookupKey: '',
    agencyIntroSentPhones: new Set(),
    metaPurchase: null,
    metaPurchaseInFlight: false,
    user: null,
    googleContacts: null,
    googleStatusTimer: null
};

const orderCatalog = globalThis.VitalismenOrderCatalog;
const agencyCatalog = globalThis.VitalismenAgencyCatalog;
const agencyBatch = globalThis.VitalismenAgencyBatch;
const customerDataNormalizer = globalThis.VitalismenCustomerDataNormalizer;

const send = (message) => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response?.ok) return reject(new Error(response?.error || 'Falha na extensão'));
        resolve(response.data);
    });
});

const apiRequest = (path, { method = 'GET', body } = {}) => send({
    action: 'api',
    request: { path, method, ...(body === undefined ? {} : { body }) }
});
const api = (path) => apiRequest(path);
const digits = (value) => String(value || '').replace(/\D/g, '');
const normalizedText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
const chatPhone = (chat) => digits(chat?.phone || chat?.peerPhone || chat?.id);
const countryFromPhone = (phone) => {
    const normalized = digits(phone);
    if (normalized.startsWith('55')) return 'BR';
    if (normalized.startsWith('593')) return 'EC';
    if (normalized.startsWith('502')) return 'GT';
    return 'EC';
};
const dateTimeLocalValue = (value) => {
    const date = dateValue(value);
    if (!date) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
};
const dateTimeIsoValue = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};
const BUY_LATER_MIN_LEAD_MS = 5 * 60 * 1000;
const buyLaterMinimumLocalValue = (now = Date.now()) => (
    dateTimeLocalValue(Math.ceil((now + BUY_LATER_MIN_LEAD_MS) / 60000) * 60000)
);
const buyLaterMaximumLocalValue = (now = Date.now()) => {
    const date = new Date(now);
    date.setMonth(11, 31);
    date.setHours(23, 59, 0, 0);
    return dateTimeLocalValue(date);
};
const defaultBuyLaterLocalValue = (now = Date.now()) => {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    const yearEnd = new Date(now);
    yearEnd.setMonth(11, 31);
    yearEnd.setHours(23, 59, 0, 0);
    return dateTimeLocalValue(date <= yearEnd ? date : yearEnd);
};
const chatName = (chat) => {
    const value = String(
        chat?.name || chat?.pushName || chat?.customerName || chat?.customerDraft?.name || chatPhone(chat) || 'Cliente'
    );
    if (digits(value)) return value;
    return customerDataNormalizer?.formatPersonName?.(value) || value;
};
const initials = (value) => String(value || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';
const dateValue = (value) => {
    if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
        return new Date(numeric < 1e12 ? numeric * 1000 : numeric);
    }
    const parsed = new Date(value || 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const shortTime = (value) => {
    const date = dateValue(value);
    if (!date) return '';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
const showError = (message = '') => {
    elements.appError.textContent = message;
    elements.appError.classList.toggle('hidden', !message);
};
const setProfileValue = (element, value) => {
    element.textContent = String(value ?? '').trim() || '—';
};
const setInputValue = (element, value) => {
    element.value = String(value ?? '').trim();
};
const clearTimers = () => {
    clearInterval(state.chatTimer);
    clearInterval(state.messageTimer);
    clearInterval(state.activeChatTimer);
    clearTimeout(state.autoSaveTimer);
    clearInterval(state.googleStatusTimer);
    state.chatTimer = null;
    state.messageTimer = null;
    state.activeChatTimer = null;
    state.autoSaveTimer = null;
    state.googleStatusTimer = null;
};

const setAuthenticated = (authenticated, user = null) => {
    state.authenticated = authenticated;
    state.user = authenticated ? user : null;
    elements.loginView.classList.toggle('hidden', authenticated);
    elements.appView.classList.toggle('hidden', !authenticated);
    elements.logoutButton.classList.toggle('hidden', !authenticated);
    elements.operatorName.textContent = user?.name || user?.email || 'Atendimento EC';
    if (!authenticated) {
        clearTimers();
        state.chats = [];
        state.selectedChat = null;
        state.manualFieldIds.clear();
        state.lastAutoSaveFingerprint = '';
        state.productFunnelOpen = false;
        applyProductFunnelLayout();
    }
};

const GOOGLE_CONTACT_SYNC_LABELS = {
    pending: 'Agenda: pendente',
    syncing: 'Agenda: salvando…',
    synced: 'Agenda: contato salvo',
    conflict: 'Agenda: revisar contato existente',
    error: 'Agenda: erro; nova tentativa disponível',
    skipped: 'Agenda: não aplicável'
};

const renderGoogleContactSync = (sync = null) => {
    const status = String(sync?.status || '');
    elements.googleContactStatus.textContent = GOOGLE_CONTACT_SYNC_LABELS[status]
        || 'Agenda: será salva após pedido confirmado';
    elements.googleContactStatus.dataset.status = status || 'waiting';
    elements.retryGoogleContactButton.classList.toggle('hidden', !['conflict', 'error'].includes(status));
    elements.retryGoogleContactButton.title = sync?.lastError || '';
    elements.resolveGoogleContactNameButton.classList.toggle(
        'hidden',
        status !== 'conflict' || state.user?.role !== 'admin'
    );
    elements.resolveGoogleContactNameButton.title = status === 'conflict'
        ? `Substituir “${sync?.existingName || 'nome atual'}” por “${sync?.name || 'nome da ficha'}”`
        : '';
};

const renderGoogleIntegration = (integration = {}) => {
    state.googleContacts = integration;
    const isAdmin = state.user?.role === 'admin';
    if (!integration.configured) {
        elements.googleContactsStatus.textContent = 'VPS aguardando credenciais seguras';
    } else if (integration.connected) {
        const pending = Number(integration.counts?.pending || 0);
        const conflict = Number(integration.counts?.conflict || 0);
        elements.googleContactsStatus.textContent = `${integration.accountEmail}${pending ? ` • ${pending} pendente(s)` : ''}${conflict ? ` • ${conflict} revisão(ões)` : ''}${integration.lastError ? ' • verificar conexão' : ''}`;
    } else {
        elements.googleContactsStatus.textContent = integration.lastError || 'Conta ainda não conectada';
    }
    elements.googleConnectButton.classList.toggle('hidden', !isAdmin);
    elements.googleConnectButton.textContent = integration.connected ? 'Reconectar' : 'Conectar';
    elements.googleDisconnectButton.classList.toggle('hidden', !isAdmin || !integration.connected);
};

const loadGoogleIntegration = async () => {
    if (!state.authenticated) return;
    try {
        renderGoogleIntegration(await api('/api/integrations/google-contacts/status'));
    } catch (error) {
        elements.googleContactsStatus.textContent = error.message;
    }
};

const appendBadge = (container, label) => {
    if (!label) return;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = label;
    container.append(badge);
};
const chatTimestamp = (chat) => (
    chat?.timestamp || chat?.updatedAt || chat?.lastInboundAt || chat?.lastOutboundAt || chat?.createdAt
);

const renderChats = () => {
    const query = elements.searchInput.value.trim().toLowerCase();
    const filtered = state.chats.filter((chat) => (
        !query || `${chatName(chat)} ${chatPhone(chat)}`.toLowerCase().includes(query)
    ));
    elements.clientCount.textContent = String(filtered.length);
    elements.clientList.replaceChildren();

    if (!filtered.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = query ? 'Nenhum cliente encontrado.' : 'Nenhum cliente disponível.';
        elements.clientList.append(empty);
        return;
    }

    filtered.forEach((chat) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'client-item';

        const avatar = document.createElement('span');
        avatar.className = 'avatar';
        avatar.textContent = initials(chatName(chat));

        const copy = document.createElement('span');
        copy.className = 'client-copy';
        const name = document.createElement('strong');
        name.textContent = chatName(chat);
        const phone = document.createElement('span');
        phone.textContent = `+${chatPhone(chat)}`;
        const badges = document.createElement('span');
        badges.className = 'badges';
        appendBadge(badges, chat?.productName || chat?.productKey);
        appendBadge(badges, chat?.human?.mode === 'manual' ? 'Humano' : '');
        appendBadge(badges, chat?.orderStatus || chat?.status);
        copy.append(name, phone, badges);

        const time = document.createElement('span');
        time.className = 'client-time';
        time.textContent = shortTime(chatTimestamp(chat));
        button.append(avatar, copy, time);
        button.addEventListener('click', () => selectChat(chat));
        elements.clientList.append(button);
    });
};

const loadChats = async ({ quiet = false } = {}) => {
    if (state.chatRefreshInFlight) return;
    state.chatRefreshInFlight = true;
    if (!quiet) elements.syncStatus.textContent = 'Atualizando clientes…';
    try {
        const data = await api('/api/whatsapp/chats?country=EC&fast=1');
        state.chats = Array.isArray(data) ? data : (Array.isArray(data?.chats) ? data.chats : []);
        const selectedPhone = chatPhone(state.selectedChat);
        const refreshedChat = selectedPhone
            ? state.chats.find((chat) => chatPhone(chat) === selectedPhone)
            : null;
        if (refreshedChat) {
            state.selectedChat = {
                ...state.selectedChat,
                ...refreshedChat,
                customerDraft: {
                    ...(state.selectedChat?.customerDraft || {}),
                    ...(refreshedChat.customerDraft || {})
                }
            };
            applyLiveOrderStatus(refreshedChat);
        }
        renderChats();
        elements.syncStatus.textContent = `Backend sincronizado • ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        showError('');
    } catch (error) {
        showError(error.message);
        if (/login|sess|token|401|403/i.test(error.message)) setAuthenticated(false);
    } finally {
        state.chatRefreshInFlight = false;
    }
};

const messageBody = (message) => {
    const value = message?.body || message?.text || message?.caption || message?.content;
    if (typeof value === 'string' && value.trim()) return value.trim();
    return `[${String(message?.type || message?.messageType || 'mídia')}]`;
};
const isOutgoing = (message) => (
    message?.isFromMe === true
    || message?.fromMe === true
    || message?.direction === 'outbound'
    || message?.direction === 'outgoing'
    || message?.sender === 'bot'
);
const renderMessages = (messages) => {
    elements.messageList.replaceChildren();
    if (!messages.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'Ainda não há mensagens salvas para este cliente.';
        elements.messageList.append(empty);
        return;
    }
    messages.forEach((message) => {
        const bubble = document.createElement('article');
        bubble.className = `message${isOutgoing(message) ? ' outgoing' : ''}`;
        const body = document.createElement('p');
        body.textContent = messageBody(message);
        const time = document.createElement('small');
        time.textContent = shortTime(message?.timestamp || message?.createdAt);
        bubble.append(body, time);
        elements.messageList.append(bubble);
    });
};

const productNameForKey = (key) => ({
    vit_power_ec: 'Vit Power Ecuador',
    nitrix_ec: 'Nitrix Oxide Ecuador',
    tex_ultra_ec: 'Tex Ultra Ecuador'
})[key] || '';
const safeProductKey = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64);
const ensureDraftProductOption = (productKey, productName = '') => {
    const key = safeProductKey(productKey);
    if (!key || !elements.draftProduct) return '';
    const existing = [...elements.draftProduct.options].find((option) => option.value === key);
    if (existing) {
        if (productName && !existing.dataset.fixedLabel) existing.textContent = productName;
        return key;
    }
    const option = document.createElement('option');
    option.value = key;
    option.textContent = String(productName || key).trim();
    option.dataset.vslProduct = 'true';
    elements.draftProduct.append(option);
    return key;
};
const selectedProductName = (productKey) => {
    const key = safeProductKey(productKey);
    const option = [...(elements.draftProduct?.options || [])].find((candidate) => candidate.value === key);
    return productNameForKey(key) || String(option?.textContent || '').trim();
};
const authoritativeProductFromChat = ({ chat = {}, draft = {}, order = {}, suggestion = {} } = {}) => {
    const candidates = [
        [draft.productKey, draft.productName || draft.product],
        [productKeyFromText(order.productName || order.package?.label), order.productName || order.package?.label],
        [chat.productKey, chat.productName],
        [chat.vslProductKey, chat.vslProductName],
        [chat.assignedAgent, chat.productName],
        [productKeyFromText(draft.productName || draft.product), draft.productName || draft.product],
        [suggestion.productKey, productNameForKey(suggestion.productKey)]
    ];
    for (const [candidateKey, candidateName] of candidates) {
        const key = safeProductKey(candidateKey);
        if (key) return { productKey: key, productName: String(candidateName || productNameForKey(key) || key).trim() };
    }
    return { productKey: '', productName: '' };
};
const productKeyFromText = (value) => {
    const text = normalizedText(value);
    if (/\btex ultra\b/.test(text)) return 'tex_ultra_ec';
    if (/\bnitrix\b|\boxido nitrico\b/.test(text)) return 'nitrix_ec';
    if (/\bvit power\b|\bvitpower\b/.test(text)) return 'vit_power_ec';
    return '';
};
const quantityFromWord = (value) => ({
    uno: '1',
    una: '1',
    un: '1',
    dos: '2',
    tres: '3',
    seis: '6'
})[normalizedText(value)] || digits(value);

const inferDraftFromMessages = (messages = []) => {
    if (globalThis.VitalismenConversationData?.extract) {
        return globalThis.VitalismenConversationData.extract(messages);
    }
    const lines = messages
        .filter((message) => !isOutgoing(message))
        .flatMap((message) => messageBody(message).split(/\r?\n/))
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter((line) => line && !line.startsWith('['))
        .slice(-120);
    const suggestion = {};

    for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index];
        const name = line.match(/(?:mi nombre es|me llamo|nombre(?: completo)?)\s*[:,-]?\s*([\p{L}][\p{L}\s.'-]{4,69})$/iu);
        const city = line.match(/(?:ciudad|cant[oó]n)\s*[:,-]?\s*([\p{L}\s.'-]{2,45})$/iu);
        const province = line.match(/provincia\s*[:,-]?\s*([\p{L}\s.'-]{2,45})$/iu);
        const reference = line.match(/(?:referencia|punto de referencia)\s*[:,-]?\s*(.{3,100})$/iu);
        const address = line.match(/(?:direcci[oó]n|domicilio|agencia|servientrega|calle|avenida|avda\.?)\s*[:,-]?\s*(.{5,150})$/iu);
        const quantity = line.match(/\b(1|2|3|6|uno|una|un|dos|tres|seis)\s*(?:frascos?|botellas?|unidades?)\b/iu);
        const total = line.match(/(?:usd|\$|d[oó]lares?)\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)/iu)
            || line.match(/([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:usd|d[oó]lares?)/iu);

        if (!suggestion.name && name) suggestion.name = name[1].trim();
        if (!suggestion.city && city) suggestion.city = city[1].trim();
        if (!suggestion.province && province) suggestion.province = province[1].trim();
        if (!suggestion.reference && reference) suggestion.reference = reference[1].trim();
        if (!suggestion.address && address) {
            suggestion.address = /^(calle|avenida|servientrega)/i.test(line)
                ? line.slice(0, 160)
                : address[1].trim();
        }
        if (!suggestion.quantity && quantity) suggestion.quantity = quantityFromWord(quantity[1]);
        if (!suggestion.total && total) suggestion.total = total[1].replace(',', '.');
        if (!suggestion.productKey) suggestion.productKey = productKeyFromText(line);
    }

    const conversationText = lines.join('\n');
    if (!suggestion.name) {
        const match = conversationText.match(
            /(?:mi+\s+nombre(?:\s+es)?|me\s+llamo|nombre\s+completo)\s*[:,-]?\s*([\p{L}][\p{L}\s.'-]{2,60}?)(?=\s+(?:c[eé]dula|ci\b|tel[eé]fono|direcci[oó]n|ciudad|provincia|servientrega)\b|[,;\n]|$)/iu
        );
        if (match) suggestion.name = match[1].trim();
    }
    if (!suggestion.city || !suggestion.province) {
        const location = conversationText.match(
            /(?:ciudad|cant[oó]n)\s*(?:\/\s*provincia)?\s*[:,-]?\s*([\p{L}\s.'-]{2,45})\s*[,/]\s*([\p{L}\s.'-]{2,45})(?=$|\n|[,;])/imu
        );
        if (location) {
            if (!suggestion.city) suggestion.city = location[1].trim();
            if (!suggestion.province) suggestion.province = location[2].trim();
        }
    }
    if (!suggestion.address) {
        const delivery = conversationText.match(
            /(servientrega\s+.{4,130}?)(?=\s+(?:ciudad|cant[oó]n|provincia|referencia)\b|\n|$)/iu
        );
        if (delivery) suggestion.address = delivery[1].trim();
    }
    return suggestion;
};

const renderHumanControl = (human = {}) => {
    const claimed = human?.mode === 'manual';
    elements.claimButton.textContent = claimed ? 'Humano no comando' : 'Assumir';
    elements.claimButton.disabled = claimed;
    elements.humanControlStatus.textContent = claimed
        ? `Atendimento manual protegido${human.assignedName ? ` por ${human.assignedName}` : ''}.`
        : 'Assuma o cliente antes de responder.';
    elements.claimButton.closest('.human-control')?.classList.toggle('claimed', claimed);
};

const normalizedDraftStatus = (value) => ({
    confirmed: 'confirmado',
    confirmado: 'confirmado',
    processing: 'pedido_enviado',
    submitted: 'pedido_enviado',
    sent: 'pedido_enviado',
    shipped: 'pedido_enviado',
    enviado: 'pedido_enviado',
    pedido_enviado: 'pedido_enviado',
    delivered: 'entregue',
    entregue: 'entregue',
    cancelled: 'cancelado',
    canceled: 'cancelado',
    cancelado: 'cancelado',
    new: 'novo',
    novo: 'novo',
    attending: 'atendendo',
    atendendo: 'atendendo',
    buy_later: 'comprar_depois',
    comprar_depois: 'comprar_depois',
    repurchase: 'recompra',
    recompra: 'recompra',
    returned: 'devolvido',
    devolvido: 'devolvido'
})[normalizedText(value).replace(/\s+/g, '_')] || 'atendendo';

const applyLiveOrderStatus = (chat = {}) => {
    if (!state.selectedChat || !elements.draftStatus) return;
    const rawStatus = chat.orderStatus || chat.customerDraft?.status || chat.status || '';
    if (!String(rawStatus).trim()) return;
    const nextStatus = normalizedDraftStatus(rawStatus);
    const currentStatus = normalizedDraftStatus(elements.draftStatus.value);
    const authoritativeStatuses = new Set(['pedido_enviado', 'entregue', 'cancelado', 'devolvido']);
    if (nextStatus === currentStatus) return;
    if (state.formDirty && !authoritativeStatuses.has(nextStatus)) return;

    state.selectedChat.customerDraft = {
        ...(state.selectedChat.customerDraft || {}),
        status: nextStatus
    };
    setInputValue(elements.draftStatus, nextStatus);
    setProfileValue(elements.profileOrderStatus, nextStatus);
    renderOrderRegistration();
    renderFunnelShadow();
    setAutoSaveState('saved', `Status atualizado pelo backend às ${shortTime(Date.now())}`);
};

const formatFunnelAge = (minutes) => {
    if (!Number.isFinite(minutes)) return '';
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
    return `${Math.floor(minutes / 1440)} d`;
};

const funnelDraftSnapshot = () => ({
    name: elements.draftName.value,
    phone: elements.draftPhone.value,
    country: elements.draftCountry.value,
    productKey: elements.draftProduct.value,
    address: elements.draftAddress.value,
    city: elements.draftCity.value,
    province: elements.draftProvince.value,
    reference: elements.draftReference.value,
    quantity: elements.draftQuantity.value,
    total: elements.draftTotal.value,
    status: elements.draftStatus.value,
    buyLaterFollowupAt: dateTimeIsoValue(elements.draftBuyLaterFollowupAt?.value)
});

const renderBuyLaterSchedule = () => {
    const enabled = elements.draftStatus?.value === 'comprar_depois';
    elements.buyLaterSchedule?.classList.toggle('hidden', !enabled);
    if (elements.draftBuyLaterFollowupAt) {
        elements.draftBuyLaterFollowupAt.required = enabled;
        elements.draftBuyLaterFollowupAt.min = buyLaterMinimumLocalValue();
        elements.draftBuyLaterFollowupAt.max = buyLaterMaximumLocalValue();
        if (enabled && !elements.draftBuyLaterFollowupAt.value) {
            elements.draftBuyLaterFollowupAt.value = defaultBuyLaterLocalValue();
        }
        const value = elements.draftBuyLaterFollowupAt.value;
        if (elements.addBuyLaterScheduleButton) {
            elements.addBuyLaterScheduleButton.disabled = !enabled
                || !value
                || value < elements.draftBuyLaterFollowupAt.min
                || value > elements.draftBuyLaterFollowupAt.max;
        }
    }
};

const validateBuyLaterSchedule = (draft = {}) => {
    if (draft.status !== 'comprar_depois') return { ok: true, error: '' };
    const parsed = new Date(draft.buyLaterFollowupAt || '');
    if (Number.isNaN(parsed.getTime())) {
        return { ok: false, error: 'Informe a data e a hora combinadas para “Comprar depois”.' };
    }
    if (parsed.getTime() <= Date.now()) {
        return { ok: false, error: 'A data de “Comprar depois” precisa estar no futuro.' };
    }
    if (parsed.getFullYear() !== new Date().getFullYear()) {
        return { ok: false, error: 'Escolha uma data dentro do ano atual.' };
    }
    return { ok: true, error: '' };
};

const orderSummaryText = (draft = {}) => {
    const product = productNameForKey(draft.productKey) || 'Produto não selecionado';
    const quantity = draft.quantity ? `${draft.quantity} frasco${draft.quantity === '1' ? '' : 's'}` : 'quantidade pendente';
    const total = draft.total ? `USD ${String(draft.total).replace('.', ',')}` : 'valor pendente';
    const customer = draft.name || 'cliente pendente';
    const location = [draft.city, draft.province].filter(Boolean).join(' / ') || 'local pendente';
    return `Resumo: ${product} · ${quantity} · ${total}\nCliente: ${customer} · ${location}`;
};

const setMetaPurchaseState = (purchase = null) => {
    state.metaPurchase = purchase;
    renderOrderRegistration();
};

const renderOrderRegistration = () => {
    if (!orderCatalog) return;
    const draft = funnelDraftSnapshot();
    const texUltraActive = draft.productKey === orderCatalog.CURRENT_PRODUCT_KEY;
    const kit = orderCatalog.kitForQuantity(draft.quantity);
    const missing = orderCatalog.missingConfirmedFields(draft);
    const validation = orderCatalog.validateForSave(draft);
    const confirmed = draft.status === 'confirmado';
    const purchaseSent = state.metaPurchase?.sent === true;

    elements.texUltraKitSection?.classList.toggle('hidden', !texUltraActive);
    elements.draftTotal.readOnly = texUltraActive;
    elements.draftTotal.classList.toggle('price-locked', texUltraActive);
    elements.orderKitOptions?.querySelectorAll('[data-kit-quantity]').forEach((button) => {
        button.classList.toggle('active', texUltraActive && button.dataset.kitQuantity === draft.quantity);
    });

    elements.orderSummary.textContent = orderSummaryText(draft);
    elements.orderReadiness.classList.remove('ready', 'blocked');
    if (confirmed && validation.ok) {
        elements.orderReadiness.textContent = '✓ Pedido conferido e pronto para cadastrar.';
        elements.orderReadiness.classList.add('ready');
    } else if (confirmed) {
        elements.orderReadiness.textContent = `Não é possível cadastrar ainda: ${validation.issues.join('; ')}.`;
        elements.orderReadiness.classList.add('blocked');
    } else if (!missing.length && validation.ok) {
        elements.orderReadiness.textContent = 'Ficha completa. Confirme com o cliente e altere o status para “Confirmado”.';
        elements.orderReadiness.classList.add('ready');
    } else {
        const pending = [
            ...missing,
            ...(texUltraActive && !kit ? ['kit Tex Ultra'] : [])
        ];
        elements.orderReadiness.textContent = `Em atendimento · falta: ${[...new Set(pending)].join(', ') || 'revisão final'}.`;
    }
    elements.saveDraftButton.textContent = confirmed ? 'Cadastrar pedido confirmado' : 'Salvar ficha em atendimento';
    if (elements.markPurchaseButton) {
        elements.markPurchaseButton.disabled = state.metaPurchaseInFlight || purchaseSent || !confirmed || !validation.ok;
        elements.markPurchaseButton.classList.toggle('sent', purchaseSent);
        elements.markPurchaseButton.textContent = state.metaPurchaseInFlight
            ? 'Marcando compra...'
            : purchaseSent
                ? 'Compra marcada ✓'
                : 'Marcar compra';
    }
    if (elements.metaPurchaseStatus) {
        elements.metaPurchaseStatus.classList.remove('success', 'error');
        if (purchaseSent) {
            elements.metaPurchaseStatus.textContent = state.metaPurchase?.alreadySent
                ? 'Este pedido já tinha o Purchase registrado. Nenhum evento foi duplicado.'
                : 'Purchase aceito pela Meta e vinculado a este pedido.';
            elements.metaPurchaseStatus.classList.add('success');
        } else if (state.metaPurchase?.error) {
            elements.metaPurchaseStatus.textContent = state.metaPurchase.error;
            elements.metaPurchaseStatus.classList.add('error');
        } else if (!confirmed) {
            elements.metaPurchaseStatus.textContent = 'Altere o status para “Confirmado” para liberar.';
        } else if (!validation.ok) {
            elements.metaPurchaseStatus.textContent = `Falta: ${validation.issues.join('; ')}.`;
        } else {
            elements.metaPurchaseStatus.textContent = 'Envia Purchase com os dados disponíveis deste cliente.';
        }
    }
};

const syncCatalogPricing = ({ force = false } = {}) => {
    if (!orderCatalog) return;
    const productKey = elements.draftProduct.value;
    const expected = orderCatalog.expectedPrice(productKey, elements.draftQuantity.value);
    if (productKey === orderCatalog.CURRENT_PRODUCT_KEY && expected) {
        const currentIsValid = orderCatalog.isExpectedPrice(productKey, elements.draftQuantity.value, elements.draftTotal.value);
        if (force || !currentIsValid) elements.draftTotal.value = expected;
    }
    renderOrderRegistration();
};

const autoSaveFields = [
    'name', 'phone', 'country', 'productKey', 'productName', 'product',
    'address', 'city', 'province', 'reference', 'quantity', 'total', 'status', 'buyLaterFollowupAt'
];

const customerDraftFromForm = () => {
    const productKey = elements.draftProduct.value;
    const phone = elements.draftPhone.value.trim();
    const rawName = elements.draftName.value.trim();
    const name = digits(rawName) && digits(rawName) === digits(phone) ? '' : rawName;
    const customerDraft = {
        name,
        phone,
        country: elements.draftCountry.value,
        productKey,
        productName: selectedProductName(productKey),
        product: selectedProductName(productKey),
        address: elements.draftAddress.value.trim(),
        city: elements.draftCity.value.trim(),
        province: elements.draftProvince.value.trim(),
        reference: elements.draftReference.value.trim(),
        quantity: elements.draftQuantity.value,
        total: elements.draftTotal.value.trim().replace(',', '.'),
        status: elements.draftStatus.value,
        buyLaterFollowupAt: elements.draftStatus.value === 'comprar_depois'
            ? dateTimeIsoValue(elements.draftBuyLaterFollowupAt?.value)
            : ''
    };
    return customerDataNormalizer?.normalizeCustomerData?.(customerDraft) || customerDraft;
};

const autoSaveFingerprint = (draft = {}) => JSON.stringify(Object.fromEntries(
    autoSaveFields.map((field) => [field, String(draft[field] ?? '').trim()])
));

const autoSaveHasCustomerData = (draft = {}) => [
    draft.name,
    draft.address,
    draft.city,
    draft.province,
    draft.reference,
    draft.quantity,
    draft.total
].some((value) => String(value || '').trim());

const setAutoSaveState = (kind, text) => {
    elements.autoSaveState.classList.remove('saving', 'saved', 'paused');
    if (kind) elements.autoSaveState.classList.add(kind);
    elements.autoSaveState.textContent = text;
};

const performAutomaticDraftSave = async ({ force = false } = {}) => {
    state.autoSaveTimer = null;
    if (!state.authenticated || !state.selectedChat) return;
    if (state.autoSaveInFlight) {
        state.autoSaveQueued = true;
        return;
    }
    const phone = chatPhone(state.selectedChat);
    const epoch = state.selectionEpoch;
    const customerDraft = customerDraftFromForm();
    if (!phone || (!force && !autoSaveHasCustomerData(customerDraft))) return;
    const buyLaterValidation = validateBuyLaterSchedule(customerDraft);
    if (!buyLaterValidation.ok) {
        setAutoSaveState('paused', 'Aguardando data de “Comprar depois”');
        return;
    }
    if (customerDraft.status === 'confirmado') {
        setAutoSaveState('paused', 'Confirmação exige clique humano em “Cadastrar pedido confirmado”');
        return;
    }

    const fingerprint = autoSaveFingerprint(customerDraft);
    const persistedFingerprint = autoSaveFingerprint(state.selectedChat.customerDraft || {});
    if (fingerprint === state.lastAutoSaveFingerprint || fingerprint === persistedFingerprint) {
        setAutoSaveState('saved', 'Dados automáticos sincronizados');
        return;
    }

    state.autoSaveInFlight = true;
    state.autoSaveQueued = false;
    setAutoSaveState('saving', 'Gravando dados automáticos…');
    try {
        const result = await apiRequest(`/api/whatsapp/contact-state/${encodeURIComponent(phone)}`, {
            method: 'PATCH',
            body: {
                country: customerDraft.country,
                customerDraft
            }
        });
        if (!selectionIsCurrent(phone, epoch)) return;
        const savedDraft = result?.state?.metadata?.customerDraft || customerDraft;
        state.selectedChat.customerDraft = savedDraft;
        state.selectedChat.productKey = savedDraft.productKey || customerDraft.productKey;
        state.selectedChat.productName = savedDraft.productName || customerDraft.productName;
        state.lastAutoSaveFingerprint = autoSaveFingerprint(savedDraft);
        setAutoSaveState('saved', `Dados gravados automaticamente às ${shortTime(Date.now())}`);
        elements.saveStatus.textContent = 'Dados do cliente salvos. Pedido ainda não confirmado.';
        send({ action: 'syncOperationalLabels' }).catch(() => null);
        showError('');
    } catch (error) {
        setAutoSaveState('paused', 'Falha na gravação automática');
        showError(`Gravação automática: ${error.message}`);
    } finally {
        state.autoSaveInFlight = false;
        if (state.autoSaveQueued) queueAutomaticDraftSave(350);
    }
};

const queueAutomaticDraftSave = (delay = 1200) => {
    clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = setTimeout(() => {
        performAutomaticDraftSave().catch((error) => {
            setAutoSaveState('paused', 'Falha na gravação automática');
            showError(`Gravação automática: ${error.message}`);
        });
    }, delay);
};

const clearAgencySuggestions = (message = 'Digite a cidade') => {
    clearTimeout(state.agencyLookupTimer);
    state.agencySuggestionsAll = [];
    state.agencySuggestions = [];
    state.agencySuggestionOffset = 0;
    state.agencyLookupKey = '';
    elements.agencySuggestions?.classList.add('hidden');
    elements.agencySuggestionList?.replaceChildren();
    if (elements.agencySuggestionsState) elements.agencySuggestionsState.textContent = message;
    if (elements.sendAgencyListBtn) {
        elements.sendAgencyListBtn.disabled = true;
        elements.sendAgencyListBtn.textContent = 'Enviar 4';
    }
    if (elements.prevAgencyBatchBtn) elements.prevAgencyBatchBtn.disabled = true;
    if (elements.nextAgencyBatchBtn) elements.nextAgencyBatchBtn.disabled = true;
};

const agencyLine = (agency = {}) => [
    agency.name ? `Servientrega ${agency.name}` : 'Servientrega',
    agency.address,
    [agency.city, agency.province].filter(Boolean).join(', ')
].filter(Boolean).join(' - ');

const agencyIntroLine = () => {
    const name = elements.draftName.value.trim();
    return `${name ? `${name}, ` : 'Señor/a, '}por favor, elija una de las agencias a continuación:`;
};

const agencyOptionLine = (agency = {}, absoluteNumber = 1) => {
    const clean = (value, fallback) => {
        const text = String(value || '').trim();
        return text && !/^(undefined|null)$/i.test(text) ? text : fallback;
    };
    const agencyName = clean(agency.name, '');
    return [
        `Opción ${absoluteNumber}`,
        `Agencia: ${agencyName ? `Servientrega ${agencyName}` : 'Servientrega'}`,
        `Dirección / Referencia: ${clean(agency.address, 'Dirección de la agencia')}`,
        `Ciudad / Provincia: ${clean([agency.city, agency.province].filter(Boolean).join(', '), 'Ciudad, Provincia')}`
    ].join('\n');
};

const applyAgencySuggestion = (agency) => {
    if (!agency) return;
    if (agency.city) elements.draftCity.value = agency.city;
    if (agency.province) elements.draftProvince.value = agency.province;
    elements.draftAddress.value = agencyLine(agency);
    ['draftCity', 'draftProvince', 'draftAddress'].forEach((id) => state.manualFieldIds.add(id));
    state.formDirty = true;
    renderOrderRegistration();
    queueAutomaticDraftSave(500);
    elements.saveStatus.textContent = 'Agência aplicada à ficha. A referência informada foi preservada.';
};

const sendAgencyMessagesToCustomer = async (
    agencies = [],
    { button = null, startNumber = 1, advanceBatch = false } = {}
) => {
    const phone = chatPhone(state.selectedChat);
    const selectedAgencies = agencies.filter(Boolean).slice(0, 4);
    if (!phone) throw new Error('Selecione o cliente antes de enviar agências.');
    if (!selectedAgencies.length) throw new Error('Nenhuma agência disponível neste lote.');
    const sendIntro = !state.agencyIntroSentPhones.has(phone);
    const messages = agencyBatch.buildMessages({
        agencies: selectedAgencies,
        startNumber,
        includeIntro: sendIntro,
        intro: agencyIntroLine(),
        formatOption: agencyOptionLine
    });
    const originalLabel = button?.textContent || '';
    if (button) {
        button.disabled = true;
        button.textContent = 'Enviando…';
    }
    try {
        for (let index = 0; index < messages.length; index += 1) {
            await send({
                action: 'sendWhatsAppText',
                phone,
                text: messages[index]
            });
            if (sendIntro && index === 0) state.agencyIntroSentPhones.add(phone);
            if (index < messages.length - 1) {
                await new Promise((resolve) => window.setTimeout(resolve, 350));
            }
        }
        elements.saveStatus.textContent = selectedAgencies.length > 1
            ? `Agências ${startNumber}–${startNumber + selectedAgencies.length - 1} enviadas.`
            : `Agência ${startNumber} enviada.`;
        if (advanceBatch) {
            state.agencySuggestionOffset += selectedAgencies.length;
            renderAgencySuggestionPage();
        }
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalLabel;
        }
    }
};

const renderAgencySuggestionPage = () => {
    const allAgencies = state.agencySuggestionsAll || [];
    const total = allAgencies.length;
    const offset = Math.min(state.agencySuggestionOffset || 0, total);
    const visibleAgencies = allAgencies.slice(offset, offset + 4);
    state.agencySuggestionOffset = offset;
    state.agencySuggestions = visibleAgencies;
    elements.agencySuggestions?.classList.remove('hidden');
    elements.agencySuggestionList?.replaceChildren();

    if (!visibleAgencies.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = total
            ? 'Todas as agências encontradas já foram exibidas.'
            : 'Nenhuma agência encontrada para esta cidade.';
        elements.agencySuggestionList?.append(empty);
        elements.agencySuggestionsState.textContent = total ? `${total} encontradas` : 'Nenhuma encontrada';
        elements.sendAgencyListBtn.disabled = true;
        elements.sendAgencyListBtn.textContent = total ? 'Sem próximas' : 'Enviar 4';
        elements.prevAgencyBatchBtn.disabled = offset <= 0;
        elements.nextAgencyBatchBtn.disabled = true;
        return;
    }

    elements.agencySuggestionsState.textContent = `${offset + 1}–${offset + visibleAgencies.length} de ${total}`;
    elements.sendAgencyListBtn.disabled = !state.selectedChat;
    elements.sendAgencyListBtn.textContent = `Enviar ${offset + 1}–${offset + visibleAgencies.length}`;
    elements.prevAgencyBatchBtn.disabled = offset <= 0;
    elements.nextAgencyBatchBtn.disabled = offset + visibleAgencies.length >= total;

    visibleAgencies.forEach((agency, index) => {
        const absoluteNumber = agencyBatch.optionNumber(offset, index);
        const row = document.createElement('div');
        row.className = 'agency-suggestion';
        const applyButton = document.createElement('button');
        applyButton.type = 'button';
        applyButton.className = 'agency-suggestion-main';
        const title = document.createElement('strong');
        const number = document.createElement('span');
        number.className = 'agency-number';
        number.textContent = String(absoluteNumber);
        title.append(number, document.createTextNode(agency.name || 'Servientrega'));
        const address = document.createElement('span');
        address.textContent = agency.address || '';
        const location = document.createElement('span');
        location.textContent = [agency.city, agency.province].filter(Boolean).join(' / ');
        applyButton.append(title, address, location);
        applyButton.addEventListener('click', () => applyAgencySuggestion(agency));

        const sendButton = document.createElement('button');
        sendButton.type = 'button';
        sendButton.className = 'agency-send-btn';
        sendButton.textContent = 'Enviar';
        sendButton.addEventListener('click', () => {
            applyAgencySuggestion(agency);
            sendAgencyMessagesToCustomer([agency], {
                button: sendButton,
                startNumber: absoluteNumber
            }).catch((error) => {
                elements.saveStatus.textContent = error.message;
            });
        });
        row.append(applyButton, sendButton);
        elements.agencySuggestionList?.append(row);
    });
};

const lookupAgencySuggestions = ({ immediate = false } = {}) => {
    clearTimeout(state.agencyLookupTimer);
    const run = async () => {
        if (!state.selectedChat || elements.draftCountry.value !== 'EC') {
            clearAgencySuggestions('Disponível somente para Equador');
            return;
        }
        let city = elements.draftCity.value.trim();
        let province = elements.draftProvince.value.trim();
        const reference = elements.draftReference.value.trim();
        const search = elements.agencySearchInput?.value.trim() || reference;
        if (city.length < 3 && province.length < 3 && search.length < 3) {
            clearAgencySuggestions('Digite cidade ou ponto de referência');
            return;
        }
        const key = `${city}|${province}|${search}`;
        if (!immediate && key === state.agencyLookupKey) return;
        state.agencyLookupKey = key;
        elements.agencySuggestions.classList.remove('hidden');
        elements.agencySuggestionsState.textContent = 'Buscando…';
        elements.agencySuggestionList.replaceChildren();
        try {
            const resolvedLocation = await agencyCatalog.resolveLocationFromUrl(
                chrome.runtime.getURL('agencia_LISTA.json'),
                { city, province }
            );
            if ((city || province) && !resolvedLocation.matched) {
                state.agencySuggestionsAll = [];
                state.agencySuggestionOffset = 0;
                renderAgencySuggestionPage();
                return;
            }
            if (resolvedLocation.matched) {
                city = resolvedLocation.city || city;
                province = resolvedLocation.province || province;
                const locationChanged = elements.draftCity.value !== city
                    || elements.draftProvince.value !== province;
                if (locationChanged) {
                    setInputValue(elements.draftCity, city);
                    setInputValue(elements.draftProvince, province);
                    renderOrderRegistration();
                    renderFunnelShadow();
                    queueAutomaticDraftSave();
                }
            }
            state.agencySuggestionsAll = await agencyCatalog.searchFromUrl(
                chrome.runtime.getURL('agencia_LISTA.json'),
                { city, province, query: search, limit: 500 }
            );
            state.agencySuggestionOffset = 0;
            renderAgencySuggestionPage();
        } catch (error) {
            try {
                const payload = await api(
                    `/api/shipments/servientrega/ec/agencies?city=${encodeURIComponent(city)}`
                    + `&province=${encodeURIComponent(province)}&q=${encodeURIComponent(search)}&limit=10`
                );
                state.agencySuggestionsAll = Array.isArray(payload?.agencies) ? payload.agencies : [];
                state.agencySuggestionOffset = 0;
                renderAgencySuggestionPage();
            } catch (fallbackError) {
                elements.agencySuggestionsState.textContent = 'Erro na busca';
                const failure = document.createElement('div');
                failure.className = 'empty';
                failure.textContent = fallbackError.message || error.message;
                elements.agencySuggestionList.replaceChildren(failure);
            }
        }
    };
    if (immediate) return run();
    state.agencyLookupTimer = setTimeout(() => run().catch(() => {}), 450);
    return Promise.resolve();
};

const activeProductFunnelKey = () => {
    const selected = elements.draftProduct.value;
    return globalThis.VitalismenProductFunnel?.PRODUCTS?.[selected]
        ? selected
        : '';
};

const mountProductFunnelAtRoot = () => {
    const panel = elements.productFunnelPanel;
    if (panel && panel.parentElement !== document.body) document.body.append(panel);
};

const applyProductFunnelLayout = () => {
    const panel = elements.productFunnelPanel;
    if (!panel) return;
    panel.classList.toggle('closed', !state.productFunnelOpen);
    panel.classList.toggle('minimized', state.productFunnelMinimized);
    panel.classList.toggle('fit-customer-form', state.productFunnelFitForm);
    if (!state.productFunnelFitForm && panel.dataset.compactWidth) {
        panel.style.width = panel.dataset.compactWidth;
    }
    panel.style.height = state.productFunnelMinimized
        ? 'auto'
        : (panel.dataset.expandedHeight || '');
    elements.openProductFunnelButton?.classList.toggle('active', state.productFunnelOpen);
    if (elements.toggleProductFunnelSizeButton) {
        elements.toggleProductFunnelSizeButton.textContent = state.productFunnelFitForm ? '↙' : '↗';
        elements.toggleProductFunnelSizeButton.title = state.productFunnelFitForm
            ? 'Usar modo móvel compacto'
            : 'Usar tamanho da ficha';
    }
    if (elements.minimizeProductFunnelButton) {
        elements.minimizeProductFunnelButton.textContent = state.productFunnelMinimized ? '□' : '—';
        elements.minimizeProductFunnelButton.setAttribute(
            'aria-label',
            state.productFunnelMinimized ? 'Restaurar funil' : 'Minimizar funil'
        );
    }
};

const saveProductFunnelLayout = () => {
    const panel = elements.productFunnelPanel;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    chrome.storage.local.set({
        vitalismenProductFunnelLayout: {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: state.productFunnelFitForm
                ? Number(panel.dataset.compactWidth || 360)
                : Math.round(rect.width),
            height: state.productFunnelMinimized
                ? Number(panel.dataset.expandedHeight || 0)
                : Math.round(rect.height),
            fitForm: state.productFunnelFitForm,
            minimized: state.productFunnelMinimized
        }
    });
};

const restoreProductFunnelLayout = () => {
    chrome.storage.local.get('vitalismenProductFunnelLayout', (stored) => {
        const layout = stored?.vitalismenProductFunnelLayout;
        if (!layout || !elements.productFunnelPanel) {
            applyProductFunnelLayout();
            return;
        }
        const panel = elements.productFunnelPanel;
        const requestedWidth = Number(layout.width) || panel.getBoundingClientRect().width || 360;
        const panelWidth = Math.max(
            Math.min(280, window.innerWidth - 24),
            Math.min(requestedWidth, window.innerWidth - 16)
        );
        const left = Math.max(8, Math.min(Number(layout.left) || 8, window.innerWidth - panelWidth - 8));
        const top = Math.max(8, Math.min(Number(layout.top) || 190, window.innerHeight - 52));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.width = `${panelWidth}px`;
        panel.dataset.compactWidth = `${panelWidth}px`;
        const requestedHeight = Number(layout.height) || 0;
        if (requestedHeight) {
            const panelHeight = Math.max(260, Math.min(requestedHeight, window.innerHeight - top - 8));
            panel.dataset.expandedHeight = `${panelHeight}px`;
        }
        panel.style.maxHeight = `calc(100vh - ${top + 8}px)`;
        state.productFunnelMinimized = Boolean(layout.minimized);
        state.productFunnelFitForm = layout.fitForm === undefined ? true : Boolean(layout.fitForm);
        applyProductFunnelLayout();
    });
};

const enableProductFunnelDragging = () => {
    const handle = elements.productFunnelDragHandle;
    const panel = elements.productFunnelPanel;
    if (!handle || !panel) return;
    let drag = null;

    handle.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button')) return;
        if (state.productFunnelFitForm) {
            state.productFunnelFitForm = false;
            applyProductFunnelLayout();
        }
        const rect = panel.getBoundingClientRect();
        drag = {
            pointerId: event.pointerId,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            width: Math.min(rect.width, window.innerWidth - 16)
        };
        panel.style.width = `${drag.width}px`;
        panel.style.left = `${rect.left}px`;
        panel.style.top = `${rect.top}px`;
        panel.classList.add('dragging');
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    handle.addEventListener('pointermove', (event) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const maxLeft = Math.max(8, window.innerWidth - drag.width - 8);
        const nextLeft = Math.max(8, Math.min(event.clientX - drag.offsetX, maxLeft));
        const nextTop = Math.max(8, Math.min(event.clientY - drag.offsetY, window.innerHeight - 52));
        panel.style.left = `${Math.round(nextLeft)}px`;
        panel.style.top = `${Math.round(nextTop)}px`;
        panel.style.maxHeight = `calc(100vh - ${Math.round(nextTop) + 8}px)`;
    });

    const finishDrag = (event) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        drag = null;
        panel.classList.remove('dragging');
        saveProductFunnelLayout();
    };
    handle.addEventListener('pointerup', finishDrag);
    handle.addEventListener('pointercancel', finishDrag);
    handle.addEventListener('dblclick', () => {
        state.productFunnelMinimized = !state.productFunnelMinimized;
        applyProductFunnelLayout();
        saveProductFunnelLayout();
    });
    window.addEventListener('resize', () => {
        const rect = panel.getBoundingClientRect();
        const width = Math.min(rect.width, window.innerWidth - 16);
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        const top = Math.max(8, Math.min(rect.top, window.innerHeight - 52));
        panel.style.width = `${width}px`;
        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
        panel.style.maxHeight = `calc(100vh - ${Math.round(top) + 8}px)`;
    });
};

const enableProductFunnelResizing = () => {
    const handle = elements.productFunnelResizeHandle;
    const panel = elements.productFunnelPanel;
    if (!handle || !panel) return;
    let resize = null;

    handle.addEventListener('pointerdown', (event) => {
        if (state.productFunnelMinimized) return;
        const rect = panel.getBoundingClientRect();
        resize = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            width: rect.width,
            height: rect.height,
            left: rect.left,
            top: rect.top
        };
        handle.setPointerCapture(event.pointerId);
        panel.classList.add('dragging');
        event.preventDefault();
        event.stopPropagation();
    });

    handle.addEventListener('pointermove', (event) => {
        if (!resize || resize.pointerId !== event.pointerId) return;
        const minWidth = Math.min(280, window.innerWidth - 16);
        const maxWidth = Math.max(minWidth, window.innerWidth - resize.left - 8);
        const minHeight = Math.min(260, window.innerHeight - resize.top - 8);
        const maxHeight = Math.max(minHeight, window.innerHeight - resize.top - 8);
        const width = Math.max(minWidth, Math.min(resize.width + event.clientX - resize.startX, maxWidth));
        const height = Math.max(minHeight, Math.min(resize.height + event.clientY - resize.startY, maxHeight));
        panel.style.width = `${Math.round(width)}px`;
        panel.dataset.compactWidth = `${Math.round(width)}px`;
        panel.style.height = `${Math.round(height)}px`;
        panel.style.maxHeight = `${Math.round(maxHeight)}px`;
        panel.dataset.expandedHeight = `${Math.round(height)}px`;
    });

    const finishResize = (event) => {
        if (!resize || resize.pointerId !== event.pointerId) return;
        resize = null;
        panel.classList.remove('dragging');
        saveProductFunnelLayout();
    };
    handle.addEventListener('pointerup', finishResize);
    handle.addEventListener('pointercancel', finishResize);
};

const renderProductFunnel = () => {
    const library = globalThis.VitalismenProductFunnel;
    if (!library || !elements.productFunnelList) return;
    const productKey = activeProductFunnelKey();
    const stage = state.funnelAnalysis?.stage || '';
    const items = library.list({
        productKey,
        category: state.productFunnelCategory,
        search: elements.productFunnelSearch.value,
        stage
    });

    elements.productFunnelTabs.querySelectorAll('[data-product]').forEach((button) => {
        const active = button.dataset.product === productKey;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
    elements.productFunnelCategories.querySelectorAll('[data-category]').forEach((button) => {
        button.classList.toggle('active', button.dataset.category === state.productFunnelCategory);
    });
    elements.productFunnelCount.textContent = String(items.length);
    elements.productFunnelList.replaceChildren();

    if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'empty-funnel';
        empty.textContent = 'Nenhuma resposta encontrada para este filtro.';
        elements.productFunnelList.append(empty);
        return;
    }

    items.forEach((item) => {
        const card = document.createElement('article');
        card.className = `funnel-response-card${item.recommended ? ' recommended' : ''}`;

        const code = document.createElement('span');
        code.className = 'response-code';
        code.textContent = item.code;

        const copy = document.createElement('div');
        copy.className = 'response-copy';
        const title = document.createElement('strong');
        title.textContent = item.title;
        const preview = document.createElement('span');
        preview.textContent = item.preview;
        copy.append(title, preview);
        if (item.recommended) {
            const recommended = document.createElement('span');
            recommended.className = 'recommended-label';
            recommended.textContent = 'Recomendada agora';
            copy.append(recommended);
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'copy-response-button';
        button.textContent = 'Enviar';
        button.addEventListener('click', async () => {
            button.disabled = true;
            try {
                const finalText = library.resolve(item, funnelDraftSnapshot());
                await send({
                    action: 'sendWhatsAppText',
                    phone: chatPhone(state.selectedChat),
                    text: finalText
                });
                elements.productFunnelCopyStatus.textContent = `${item.code} enviado na conversa aberta.`;
                button.textContent = 'Enviado ✓';
                setTimeout(() => {
                    button.textContent = 'Enviar';
                    button.disabled = false;
                }, 1600);
            } catch (error) {
                elements.productFunnelCopyStatus.textContent = `${error.message} Tente novamente.`;
                button.disabled = false;
            }
        });

        card.append(code, copy, button);
        elements.productFunnelList.append(card);
    });
};

const renderFunnelShadow = () => {
    if (!state.selectedChat || !globalThis.VitalismenFunnelShadow) return;
    const result = globalThis.VitalismenFunnelShadow.analyze({
        draft: funnelDraftSnapshot(),
        profile: state.profile,
        messages: state.messages
    });
    state.funnelAnalysis = result;
    elements.funnelStage.textContent = result.stageLabel;
    elements.funnelPriority.textContent = result.priority;
    elements.funnelPriority.dataset.priority = result.priority.split(' ')[0].toLowerCase();
    elements.funnelProgressBar.style.width = `${result.progress}%`;
    elements.funnelAge.textContent = result.ageMinutes === null
        ? ''
        : `Há ${formatFunnelAge(result.ageMinutes)}`;
    elements.funnelNextAction.textContent = result.nextAction;
    elements.funnelMissing.replaceChildren();
    const missing = result.missing.length ? result.missing : ['Ficha essencial completa'];
    missing.forEach((label) => {
        const chip = document.createElement('span');
        chip.textContent = label;
        chip.className = result.missing.length ? 'missing-chip' : 'complete-chip';
        elements.funnelMissing.append(chip);
    });
    renderProductFunnel();
};

const populateSmartForm = () => {
    if (!state.selectedChat) return;
    const draft = state.selectedChat.customerDraft || {};
    const profile = state.profile || {};
    const order = profile.activeOrder || {};
    const customer = order.customer || {};
    const suggestion = customerDataNormalizer?.normalizeCustomerData?.(state.suggestions || {})
        || state.suggestions
        || {};
    const authoritativeProduct = authoritativeProductFromChat({
        chat: state.selectedChat,
        draft,
        order,
        suggestion
    });
    const productKey = ensureDraftProductOption(
        authoritativeProduct.productKey,
        authoritativeProduct.productName
    );
    const selectedPhone = chatPhone(state.selectedChat);
    const existingName = customer.name || draft.name || '';
    const preferExplicitName = customerDataNormalizer?.shouldPreferExplicitPersonName?.({
        currentName: existingName,
        detectedName: suggestion.name,
        detectedSource: suggestion.nameSource,
        manual: state.manualFieldIds.has('draftName')
    }) || false;
    const detectedName = preferExplicitName
        ? suggestion.name
        : customer.name || draft.name || suggestion.name || profile.displayName || chatName(state.selectedChat);
    const safeDetectedName = digits(detectedName) === selectedPhone ? '' : detectedName;
    let applied = 0;
    const applyValue = (element, value) => {
        const fieldByElementId = {
            draftName: 'name',
            draftAddress: 'address',
            draftCity: 'city',
            draftProvince: 'province',
            draftReference: 'reference'
        };
        const field = fieldByElementId[element.id];
        const normalized = field
            ? customerDataNormalizer?.normalizeCustomerData?.({ [field]: value })?.[field]
            : value;
        const next = String(normalized ?? '').trim();
        const manuallyProtected = state.manualFieldIds.has(element.id);
        if (state.formDirty && (manuallyProtected || element.value || !next)) return;
        if (element.value !== next) {
            setInputValue(element, next);
            if (next) applied += 1;
        }
    };

    applyValue(elements.draftName, safeDetectedName);
    applyValue(elements.draftPhone, `+${selectedPhone}`);
    applyValue(
        elements.draftCountry,
        profile.countryCode || draft.country || state.selectedChat.country || countryFromPhone(chatPhone(state.selectedChat))
    );
    applyValue(elements.draftProduct, productKey);
    applyValue(elements.draftAddress, customer.address || customer.agency || draft.address || draft.agency || suggestion.address);
    applyValue(elements.draftCity, customer.city || draft.city || suggestion.city);
    applyValue(elements.draftProvince, customer.province || customer.state || draft.province || suggestion.province);
    applyValue(elements.draftReference, customer.reference || draft.reference || suggestion.reference);
    applyValue(elements.draftQuantity, order.quantity || draft.quantity || suggestion.quantity);
    applyValue(elements.draftTotal, order.total ?? draft.total ?? suggestion.total);
    applyValue(elements.draftStatus, normalizedDraftStatus(order.status || draft.status));
    applyValue(elements.draftBuyLaterFollowupAt, dateTimeLocalValue(draft.buyLaterFollowupAt));
    renderBuyLaterSchedule();
    syncCatalogPricing();
    renderFunnelShadow();
    if (elements.draftCountry.value === 'EC' && elements.draftCity.value.trim().length >= 3) {
        lookupAgencySuggestions();
    } else if (elements.draftCountry.value !== 'EC') {
        clearAgencySuggestions('Disponível somente para Equador');
    }
    if (applied || autoSaveFingerprint(customerDraftFromForm()) !== autoSaveFingerprint(draft)) {
        queueAutomaticDraftSave();
    }
};

const renderProfile = (profile = {}) => {
    const draft = state.selectedChat?.customerDraft || {};
    const order = profile.activeOrder || {};
    const total = order.total !== null && order.total !== undefined
        ? `${order.currency || 'USD'} ${order.total}`
        : (draft.total ? `${draft.currency || 'USD'} ${draft.total}` : '');
    state.profile = profile;
    renderGoogleContactSync(profile.googleContactSync || null);
    setProfileValue(elements.profileOrderId, order.orderId || draft.orderId);
    setProfileValue(elements.profileOrderStatus, order.shippingStatus || order.status || draft.status);
    setProfileValue(elements.profileQuantity, order.quantity || draft.quantity);
    setProfileValue(elements.profileTotal, total);
    setProfileValue(
        elements.profileStats,
        `${Number(profile.stats?.inboundCount || 0)} recebidas • ${Number(profile.stats?.outboundCount || 0)} enviadas`
    );
    if (order.tracking?.metaPurchaseSentAt || order.metaPurchaseSentAt) {
        state.metaPurchase = {
            sent: true,
            alreadySent: true,
            eventId: order.tracking?.metaPurchaseEventId || order.metaPurchaseEventId || order.orderId || ''
        };
    }
    renderHumanControl(state.selectedChat?.human || {});
    populateSmartForm();
    renderFunnelShadow();
};

const selectionIsCurrent = (phone, epoch) => (
    epoch === state.selectionEpoch
    && phone
    && phone === chatPhone(state.selectedChat)
);

const loadProfile = async ({ phone = chatPhone(state.selectedChat), epoch = state.selectionEpoch } = {}) => {
    if (!phone) return renderProfile({});
    try {
        const profile = await api(`/api/whatsapp/customer-profile/${encodeURIComponent(phone)}`);
        if (!selectionIsCurrent(phone, epoch)) return;
        renderProfile(profile);
    } catch (error) {
        if (!selectionIsCurrent(phone, epoch)) return;
        renderProfile({});
        showError(error.message);
    }
};

const loadMessages = async ({
    quiet = false,
    phone = chatPhone(state.selectedChat),
    epoch = state.selectionEpoch
} = {}) => {
    if (!phone) return showError('Este cadastro não possui telefone válido.');
    if (!quiet) elements.messageList.textContent = 'Carregando histórico…';
    try {
        const data = await api(`/api/whatsapp/messages/${encodeURIComponent(phone)}?fast=1&limit=80`);
        if (!selectionIsCurrent(phone, epoch)) return;
        state.messages = Array.isArray(data) ? data : (Array.isArray(data?.messages) ? data.messages : []);
        state.suggestions = inferDraftFromMessages(state.messages);
        renderMessages(state.messages);
        populateSmartForm();
        renderFunnelShadow();
        showError('');
    } catch (error) {
        if (!selectionIsCurrent(phone, epoch)) return;
        showError(error.message);
    }
};

const selectChat = async (chat, { detected = false } = {}) => {
    const currentPhone = chatPhone(state.selectedChat);
    const nextPhone = chatPhone(chat);
    const alreadyOpen = currentPhone
        && nextPhone
        && currentPhone === nextPhone
        && !elements.historyView.classList.contains('hidden');

    state.selectedChat = chat;
    elements.customerName.textContent = chatName(chat);
    elements.customerPhone.textContent = `+${nextPhone}`;
    elements.listView.classList.add('hidden');
    elements.historyView.classList.remove('hidden');
    state.productFunnelOpen = false;
    state.productFunnelMinimized = false;
    state.productFunnelFitForm = false;
    applyProductFunnelLayout();
    renderProductFunnel();
    if (alreadyOpen) return;

    const epoch = ++state.selectionEpoch;
    state.messages = [];
    state.profile = {};
    state.suggestions = {};
    state.formDirty = false;
    state.manualFieldIds.clear();
    state.lastAutoSaveFingerprint = autoSaveFingerprint(chat.customerDraft || {});
    state.autoSaveQueued = false;
    state.metaPurchase = null;
    state.metaPurchaseInFlight = false;
    clearTimeout(state.autoSaveTimer);
    setAutoSaveState('', 'Gravação automática ativa');
    elements.analysisResult.classList.add('hidden');
    elements.saveStatus.textContent = '';
    clearAgencySuggestions();
    elements.historyDetails.open = false;
    clearInterval(state.messageTimer);
    await Promise.all([
        loadMessages({ phone: nextPhone, epoch }),
        loadProfile({ phone: nextPhone, epoch })
    ]);
    if (!selectionIsCurrent(nextPhone, epoch)) return;
    state.messageTimer = setInterval(() => loadMessages({
        quiet: true,
        phone: nextPhone,
        epoch
    }), 15000);
    if (detected) elements.syncStatus.textContent = 'Sincronizado com a conversa oficial';
};

const samePhone = (left, right) => {
    const a = digits(left);
    const b = digits(right);
    if (!a || !b) return false;
    return a === b;
};
const findChatForSelection = (selection) => {
    if (selection.phone) {
        const byPhone = state.chats.find((chat) => samePhone(chatPhone(chat), selection.phone));
        if (byPhone) return byPhone;
    }
    const targetName = normalizedText(selection.name);
    if (!targetName) return null;
    const exact = state.chats.filter((chat) => normalizedText(chatName(chat)) === targetName);
    return exact.length === 1 ? exact[0] : null;
};
const syncActiveSelection = async (selection) => {
    if (!selection || selection.pending || !state.authenticated) return;
    const signature = `${digits(selection.phone)}|${normalizedText(selection.name)}`;
    if (!signature) return;
    const sameSelectionAlreadyVisible = signature === state.activeSelectionSignature
        && !elements.historyView.classList.contains('hidden')
        && samePhone(chatPhone(state.selectedChat), selection.phone);
    if (sameSelectionAlreadyVisible) return;
    if (selection.source === 'list_click') state.ignoredSelectionSignature = '';
    state.activeSelectionSignature = signature;
    elements.detectedChatBanner.classList.remove('hidden');
    elements.detectedChatText.textContent = [
        selection.name,
        selection.phone ? `+${selection.phone}` : ''
    ].filter(Boolean).join(' • ');
    if (signature === state.ignoredSelectionSignature && selection.source !== 'list_click') return;

    let chat = findChatForSelection(selection);
    if (!chat && selection.phone) {
        chat = { phone: selection.phone, name: selection.name || selection.phone, customerDraft: {} };
    }
    if (!chat) {
        showError('Conversa detectada, mas o nome ainda não corresponde a um cliente único no backend.');
        return;
    }
    showError('');
    await selectChat(chat, { detected: true });
};

const beginChatSwitch = (selection = null) => {
    if (!state.authenticated) return;
    ++state.selectionEpoch;
    clearInterval(state.messageTimer);
    state.messageTimer = null;
    state.selectedChat = null;
    state.messages = [];
    state.profile = {};
    state.suggestions = {};
    state.formDirty = false;
    state.manualFieldIds.clear();
    state.lastAutoSaveFingerprint = '';
    state.autoSaveQueued = false;
    clearTimeout(state.autoSaveTimer);
    state.activeSelectionSignature = '';
    elements.listView.classList.add('hidden');
    elements.historyView.classList.remove('hidden');
    state.productFunnelOpen = false;
    state.productFunnelMinimized = false;
    state.productFunnelFitForm = false;
    applyProductFunnelLayout();
    elements.customerName.textContent = 'Identificando cliente…';
    elements.customerPhone.textContent = selection?.phone ? `+${digits(selection.phone)}` : 'Aguarde';
    elements.syncStatus.textContent = 'Lendo conversa selecionada…';
    elements.messageList.textContent = 'Carregando o histórico correto…';
    elements.detectedChatBanner.classList.remove('hidden');
    elements.detectedChatText.textContent = 'Trocando de cliente com segurança…';
    elements.analysisResult.classList.add('hidden');
    elements.saveStatus.textContent = '';
    [
        elements.draftName, elements.draftPhone, elements.draftAddress,
        elements.draftCity, elements.draftProvince, elements.draftReference,
        elements.draftTotal
    ].forEach((element) => setInputValue(element, ''));
    setInputValue(elements.draftCountry, countryFromPhone(selection?.phone));
    setInputValue(elements.draftProduct, '');
    setInputValue(elements.draftQuantity, '');
    setInputValue(elements.draftStatus, 'atendendo');
    renderProfile({});
};
const pollActiveSelection = async () => {
    const selection = await send({ action: 'activeChatStatus' }).catch(() => null);
    if (selection) await syncActiveSelection(selection);
};
const startAuthenticatedApp = async (user = null) => {
    const alreadyRunning = state.authenticated && state.chatTimer && state.activeChatTimer;
    setAuthenticated(true, user);
    if (alreadyRunning) return;
    clearTimers();
    await loadGoogleIntegration();
    state.googleStatusTimer = setInterval(loadGoogleIntegration, 60000);
    await loadChats();
    state.chatTimer = setInterval(() => loadChats({ quiet: true }), 3500);
    await pollActiveSelection();
    state.activeChatTimer = setInterval(pollActiveSelection, 1500);
};

elements.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    elements.loginError.textContent = '';
    elements.loginButton.disabled = true;
    try {
        const data = await send({
            action: 'login',
            credentials: {
                email: elements.emailInput.value.trim(),
                password: elements.passwordInput.value
            }
        });
        elements.passwordInput.value = '';
        await startAuthenticatedApp(data.user);
    } catch (error) {
        elements.loginError.textContent = error.message;
    } finally {
        elements.loginButton.disabled = false;
    }
});
elements.logoutButton.addEventListener('click', async () => {
    await send({ action: 'logout' }).catch(() => {});
    setAuthenticated(false);
});
elements.refreshButton.addEventListener('click', () => loadChats());
elements.googleConnectButton?.addEventListener('click', async () => {
    try {
        elements.googleConnectButton.disabled = true;
        const result = await apiRequest('/api/integrations/google-contacts/connect', { method: 'POST', body: {} });
        if (!/^https:\/\/accounts\.google\.com\//.test(String(result.authUrl || ''))) {
            throw new Error('URL de autorização Google inválida.');
        }
        await chrome.tabs.create({ url: result.authUrl, active: true });
        elements.googleContactsStatus.textContent = 'Conclua a autorização na nova aba';
    } catch (error) {
        showError(error.message);
    } finally {
        elements.googleConnectButton.disabled = false;
    }
});
elements.googleDisconnectButton?.addEventListener('click', async () => {
    if (!window.confirm('Desconectar o Google Contatos? Nenhum contato será apagado.')) return;
    try {
        await apiRequest('/api/integrations/google-contacts/disconnect', { method: 'POST', body: {} });
        await loadGoogleIntegration();
    } catch (error) {
        showError(error.message);
    }
});
elements.retryGoogleContactButton?.addEventListener('click', async () => {
    const phone = chatPhone(state.selectedChat);
    if (!phone) return;
    try {
        elements.retryGoogleContactButton.disabled = true;
        await apiRequest(`/api/integrations/google-contacts/sync/${encodeURIComponent(phone)}/retry`, { method: 'POST', body: {} });
        await loadProfile();
    } catch (error) {
        showError(error.message);
    } finally {
        elements.retryGoogleContactButton.disabled = false;
    }
});
elements.resolveGoogleContactNameButton?.addEventListener('click', async () => {
    const phone = chatPhone(state.selectedChat);
    const sync = state.profile?.googleContactSync || {};
    if (!phone || sync.status !== 'conflict') return;
    if (!window.confirm(`Atualizar o nome existente “${sync.existingName || ''}” para “${sync.name || ''}” no Google Contatos?`)) return;
    try {
        elements.resolveGoogleContactNameButton.disabled = true;
        await apiRequest(`/api/integrations/google-contacts/sync/${encodeURIComponent(phone)}/resolve-name`, { method: 'POST', body: {} });
        await loadProfile();
    } catch (error) {
        showError(error.message);
    } finally {
        elements.resolveGoogleContactNameButton.disabled = false;
    }
});
elements.searchInput.addEventListener('input', renderChats);
elements.backButton.addEventListener('click', () => {
    clearInterval(state.messageTimer);
    state.messageTimer = null;
    state.ignoredSelectionSignature = state.activeSelectionSignature;
    state.selectedChat = null;
    state.messages = [];
    state.profile = {};
    state.suggestions = {};
    state.formDirty = false;
    state.manualFieldIds.clear();
    state.lastAutoSaveFingerprint = '';
    state.autoSaveQueued = false;
    clearTimeout(state.autoSaveTimer);
    state.productFunnelOpen = false;
    applyProductFunnelLayout();
    elements.historyView.classList.add('hidden');
    elements.listView.classList.remove('hidden');
});
elements.openWhatsAppButton.addEventListener('click', async () => {
    if (!state.selectedChat) return;
    elements.openWhatsAppButton.disabled = true;
    try {
        await send({ action: 'openOfficialChat', phone: chatPhone(state.selectedChat) });
        showError('');
    } catch (error) {
        showError(error.message);
    } finally {
        elements.openWhatsAppButton.disabled = false;
    }
});
elements.openProductFunnelButton.addEventListener('click', () => {
    state.productFunnelOpen = true;
    state.productFunnelMinimized = false;
    state.productFunnelFitForm = true;
    applyProductFunnelLayout();
    renderProductFunnel();
    saveProductFunnelLayout();
});
elements.toggleProductFunnelSizeButton.addEventListener('click', () => {
    if (!state.productFunnelFitForm) {
        const rect = elements.productFunnelPanel.getBoundingClientRect();
        elements.productFunnelPanel.dataset.compactWidth = `${Math.round(rect.width)}px`;
        elements.productFunnelPanel.dataset.expandedHeight = `${Math.round(rect.height)}px`;
    }
    state.productFunnelFitForm = !state.productFunnelFitForm;
    state.productFunnelMinimized = false;
    applyProductFunnelLayout();
    saveProductFunnelLayout();
});
elements.minimizeProductFunnelButton.addEventListener('click', () => {
    state.productFunnelMinimized = !state.productFunnelMinimized;
    applyProductFunnelLayout();
    saveProductFunnelLayout();
});
elements.closeProductFunnelButton.addEventListener('click', () => {
    state.productFunnelOpen = false;
    applyProductFunnelLayout();
});
elements.productFunnelTabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-product]');
    if (!button) return;
    elements.draftProduct.value = button.dataset.product;
    state.formDirty = true;
    state.manualFieldIds.add('draftProduct');
    elements.productFunnelCopyStatus.textContent = `${button.textContent.trim()} selecionado.`;
    syncCatalogPricing({ force: true });
    renderFunnelShadow();
    queueAutomaticDraftSave();
});
elements.productFunnelCategories.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.productFunnelCategory = button.dataset.category;
    renderProductFunnel();
});
elements.productFunnelSearch.addEventListener('input', renderProductFunnel);
elements.customerForm.addEventListener('input', (event) => {
    if (event.target?.id === 'agencySearchInput') return;
    state.formDirty = true;
    if (event.target?.id && !event.target.readOnly) state.manualFieldIds.add(event.target.id);
    renderOrderRegistration();
    renderFunnelShadow();
    queueAutomaticDraftSave();
});
['draftCity', 'draftProvince', 'draftReference'].forEach((id) => {
    elements[id].addEventListener('input', () => lookupAgencySuggestions());
});
const normalizeCustomerFieldOnBlur = (id, field) => {
    elements[id]?.addEventListener('blur', () => {
        const normalized = customerDataNormalizer?.normalizeCustomerData?.({
            [field]: elements[id].value
        })?.[field];
        if (typeof normalized === 'string' && elements[id].value !== normalized) {
            setInputValue(elements[id], normalized);
            renderOrderRegistration();
            renderFunnelShadow();
            queueAutomaticDraftSave();
        }
        if (id === 'draftCity' || id === 'draftProvince' || id === 'draftReference') {
            lookupAgencySuggestions({ immediate: true });
        }
    });
};
[
    ['draftName', 'name'],
    ['draftAddress', 'address'],
    ['draftCity', 'city'],
    ['draftProvince', 'province'],
    ['draftReference', 'reference']
].forEach(([id, field]) => normalizeCustomerFieldOnBlur(id, field));
elements.agencySearchInput?.addEventListener('input', () => lookupAgencySuggestions());
elements.draftCountry.addEventListener('change', () => {
    if (elements.draftCountry.value === 'EC') lookupAgencySuggestions({ immediate: true });
    else clearAgencySuggestions('Disponível somente para Equador');
});
elements.prevAgencyBatchBtn?.addEventListener('click', () => {
    state.agencySuggestionOffset = Math.max(0, state.agencySuggestionOffset - 4);
    renderAgencySuggestionPage();
});
elements.nextAgencyBatchBtn?.addEventListener('click', () => {
    state.agencySuggestionOffset = Math.min(
        state.agencySuggestionsAll.length,
        state.agencySuggestionOffset + 4
    );
    renderAgencySuggestionPage();
});
elements.sendAgencyListBtn?.addEventListener('click', () => {
    sendAgencyMessagesToCustomer(state.agencySuggestions, {
        button: elements.sendAgencyListBtn,
        startNumber: state.agencySuggestionOffset + 1,
        advanceBatch: true
    }).catch((error) => {
        elements.saveStatus.textContent = error.message;
    });
});
elements.draftProduct.addEventListener('change', () => {
    state.formDirty = true;
    state.manualFieldIds.add('draftProduct');
    syncCatalogPricing({ force: true });
    renderFunnelShadow();
    queueAutomaticDraftSave();
});
elements.draftQuantity.addEventListener('change', () => {
    syncCatalogPricing({ force: true });
    renderFunnelShadow();
    queueAutomaticDraftSave();
});
elements.draftStatus.addEventListener('change', () => {
    if (elements.draftStatus.value !== 'comprar_depois' && elements.draftBuyLaterFollowupAt) {
        elements.draftBuyLaterFollowupAt.value = '';
    }
    renderBuyLaterSchedule();
    renderOrderRegistration();
    queueAutomaticDraftSave();
});
elements.addBuyLaterScheduleButton?.addEventListener('click', async () => {
    const customerDraft = customerDraftFromForm();
    const validation = validateBuyLaterSchedule(customerDraft);
    if (!validation.ok) {
        elements.draftBuyLaterFollowupAt?.focus();
        showError(validation.error);
        return;
    }
    clearTimeout(state.autoSaveTimer);
    elements.addBuyLaterScheduleButton.disabled = true;
    elements.addBuyLaterScheduleButton.textContent = 'Adicionando…';
    try {
        await performAutomaticDraftSave({ force: true });
    } finally {
        elements.addBuyLaterScheduleButton.textContent = 'Adicionar';
        renderBuyLaterSchedule();
    }
});
elements.orderKitOptions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-kit-quantity]');
    if (!button) return;
    elements.draftProduct.value = orderCatalog.CURRENT_PRODUCT_KEY;
    elements.draftQuantity.value = button.dataset.kitQuantity;
    state.formDirty = true;
    state.manualFieldIds.add('draftProduct');
    state.manualFieldIds.add('draftQuantity');
    state.manualFieldIds.add('draftTotal');
    syncCatalogPricing({ force: true });
    elements.saveStatus.textContent = `Kit de ${button.dataset.kitQuantity} frasco${button.dataset.kitQuantity === '1' ? '' : 's'} selecionado.`;
    renderFunnelShadow();
    queueAutomaticDraftSave();
});
elements.analyzeButton.addEventListener('click', () => {
    state.suggestions = inferDraftFromMessages(state.messages);
    const mappings = [
        ['draftName', 'name'],
        ['draftAddress', 'address'],
        ['draftCity', 'city'],
        ['draftProvince', 'province'],
        ['draftReference', 'reference'],
        ['draftQuantity', 'quantity'],
        ['draftTotal', 'total'],
        ['draftProduct', 'productKey']
    ];
    let applied = 0;
    mappings.forEach(([elementKey, suggestionKey]) => {
        const value = state.suggestions[suggestionKey];
        if (!elements[elementKey].value && value) {
            elements[elementKey].value = value;
            applied += 1;
        }
    });
    state.formDirty = true;
    syncCatalogPricing();
    renderFunnelShadow();
    queueAutomaticDraftSave(250);
    elements.analysisResult.textContent = applied
        ? `${applied} campo(s) sugerido(s). Revise antes de salvar.`
        : 'Nenhum campo novo foi encontrado; complete manualmente o que faltar.';
    elements.analysisResult.classList.remove('hidden');
});
elements.claimButton.addEventListener('click', async () => {
    if (!state.selectedChat) return;
    const phone = chatPhone(state.selectedChat);
    elements.claimButton.disabled = true;
    try {
        const result = await apiRequest(`/api/whatsapp/contact-state/${encodeURIComponent(phone)}/claim`, {
            method: 'POST',
            body: { note: 'Atendimento humano pelo WhatsApp Web oficial e extensão Vitalismen.' }
        });
        state.selectedChat.human = result?.state?.human || { mode: 'manual' };
        renderHumanControl(state.selectedChat.human);
        elements.saveStatus.textContent = 'Humano no comando. Bot pausado para este cliente.';
        showError('');
    } catch (error) {
        elements.claimButton.disabled = false;
        showError(error.message);
    }
});
const persistCustomerDraft = async ({ markPurchase = false } = {}) => {
    if (!state.selectedChat) return;
    const phone = chatPhone(state.selectedChat);
    const customerDraft = customerDraftFromForm();
    const buyLaterValidation = validateBuyLaterSchedule(customerDraft);
    if (!buyLaterValidation.ok) {
        elements.draftBuyLaterFollowupAt?.focus();
        showError(buyLaterValidation.error);
        renderOrderRegistration();
        return;
    }
    const validation = orderCatalog?.validateForSave(customerDraft) || { ok: true, issues: [] };
    if (!validation.ok) {
        elements.saveStatus.textContent = '';
        showError(`Revise a ficha: ${validation.issues.join('; ')}.`);
        renderOrderRegistration();
        return;
    }
    if (markPurchase && customerDraft.status !== 'confirmado') {
        showError('Altere o status para “Confirmado” antes de marcar a compra.');
        renderOrderRegistration();
        return;
    }
    clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = null;
    elements.saveDraftButton.disabled = true;
    state.metaPurchaseInFlight = markPurchase;
    renderOrderRegistration();
    elements.saveStatus.textContent = 'Salvando no backend…';
    try {
        const result = await apiRequest(`/api/whatsapp/contact-state/${encodeURIComponent(phone)}`, {
            method: 'PATCH',
            body: {
                mode: 'manual',
                assignedName: 'WhatsApp Oficial',
                country: customerDraft.country,
                customerDraft
            }
        });
        state.selectedChat.customerDraft = result?.state?.metadata?.customerDraft || customerDraft;
        state.selectedChat.productKey = customerDraft.productKey;
        state.selectedChat.productName = customerDraft.productName;
        state.selectedChat.human = result?.state?.human || { mode: 'manual' };
        state.formDirty = false;
        state.manualFieldIds.clear();
        state.lastAutoSaveFingerprint = autoSaveFingerprint(state.selectedChat.customerDraft);
        renderHumanControl(state.selectedChat.human);
        setAutoSaveState('saved', `Dados confirmados às ${shortTime(Date.now())}`);
        const orderId = result?.operationalOrderSync?.orderId || '';
        const purchase = result?.operationalOrderSync?.purchase || {};
        const acceptedByMeta = purchase.ok === true && Boolean(purchase.eventId);
        const previouslyAccepted = purchase.alreadySent === true
            || Boolean(
                purchase.eventId
                && !purchase.error
                && Number(purchase.response?.events_received || 0) > 0
            );
        if (acceptedByMeta || previouslyAccepted) {
            setMetaPurchaseState({
                sent: true,
                alreadySent: purchase.alreadySent === true || (!purchase.ok && previouslyAccepted),
                eventId: purchase.eventId,
                sentAt: purchase.sentAt || ''
            });
        } else if (markPurchase) {
            const reason = purchase.error
                || result?.operationalOrderSync?.reason
                || 'A Meta não confirmou o Purchase. Verifique a configuração do Pixel no servidor.';
            setMetaPurchaseState({ sent: false, error: reason });
            throw new Error(reason);
        }
        elements.saveStatus.textContent = orderId
            ? (acceptedByMeta || previouslyAccepted
                ? `Pedido ${orderId} salvo e Purchase confirmado pela Meta. Nenhum pedido Dropi foi enviado.`
                : `Pedido ${orderId} cadastrado. Nenhum pedido Dropi foi enviado automaticamente.`)
            : 'Ficha salva no backend. Nenhuma mensagem foi enviada.';
        showError('');
        await send({ action: 'syncOperationalLabels' }).catch(() => null);
        await loadProfile();
    } catch (error) {
        elements.saveStatus.textContent = '';
        showError(error.message);
    } finally {
        elements.saveDraftButton.disabled = false;
        state.metaPurchaseInFlight = false;
        renderOrderRegistration();
    }
};

elements.customerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await persistCustomerDraft();
});
elements.markPurchaseButton?.addEventListener('click', () => persistCustomerDraft({ markPurchase: true }));

chrome.runtime.onMessage.addListener((message) => {
    if (message?.action === 'whatsAppChatSwitchStarted') {
        beginChatSwitch(message.selection);
        return;
    }
    if (message?.action === 'activeWhatsAppChat') {
        syncActiveSelection(message.selection).catch((error) => showError(error.message));
        return;
    }
    if (message?.action === 'panelAuthAvailable') {
        startAuthenticatedApp(message.user).catch((error) => showError(error.message));
    }
});

mountProductFunnelAtRoot();
enableProductFunnelDragging();
enableProductFunnelResizing();
restoreProductFunnelLayout();

(async () => {
    await send({ action: 'checkLocalUpdate' }).catch(() => null);
    const auth = await send({ action: 'authStatus' }).catch(() => ({ authenticated: false }));
    setAuthenticated(auth.authenticated, auth.user);
    if (!auth.authenticated) return;
    await startAuthenticatedApp(auth.user);
})();
