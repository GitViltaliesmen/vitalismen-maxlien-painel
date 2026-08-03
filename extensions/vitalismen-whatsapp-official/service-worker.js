const API_ORIGIN = 'https://ec.maxlien.shop';
const SESSION_KEYS = {
    token: 'vitalismenSessionToken',
    user: 'vitalismenSessionUser',
    activeChat: 'vitalismenActiveWhatsAppChat'
};
const LOCAL_UPDATE_ALARM = 'vitalismenLocalUpdateCheck';
const LOCAL_UPDATE_MARKER = 'vitalismenReloadRequestedFor';
const LABELS_SYNC_ALARM = 'vitalismenOperationalLabelsSync';
const LABELS_KEY = 'vitalismenWhatsAppLabelsV1';
const LABELS_META_KEY = 'vitalismenWhatsAppLabelsMetaV2';

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});

const sessionGet = (keys) => chrome.storage.session.get(keys);
const sessionSet = (values) => chrome.storage.session.set(values);
const sessionRemove = (keys) => chrome.storage.session.remove(keys);
const localGet = (keys) => chrome.storage.local.get(keys);
const localSet = (values) => chrome.storage.local.set(values);
const localRemove = (keys) => chrome.storage.local.remove(keys);
const authGet = async () => {
    const session = await sessionGet([SESSION_KEYS.token, SESSION_KEYS.user]);
    if (session[SESSION_KEYS.token]) {
        await localSet({
            [SESSION_KEYS.token]: session[SESSION_KEYS.token],
            [SESSION_KEYS.user]: session[SESSION_KEYS.user] || null
        });
        return session;
    }
    const persistent = await localGet([SESSION_KEYS.token, SESSION_KEYS.user]);
    if (persistent[SESSION_KEYS.token]) {
        await sessionSet({
            [SESSION_KEYS.token]: persistent[SESSION_KEYS.token],
            [SESSION_KEYS.user]: persistent[SESSION_KEYS.user] || null
        });
    }
    return persistent;
};
const authRemove = () => Promise.all([
    sessionRemove([SESSION_KEYS.token, SESSION_KEYS.user]),
    localRemove([SESSION_KEYS.token, SESSION_KEYS.user])
]);

chrome.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' })?.catch(() => {});

const checkLocalUpdate = async () => {
    const loadedVersion = chrome.runtime.getManifest().version;
    const response = await fetch(`${chrome.runtime.getURL('release.json')}?t=${Date.now()}`, {
        cache: 'no-store'
    });
    if (!response.ok) return { updated: false, loadedVersion };
    const release = await response.json();
    const availableVersion = String(release?.version || '');
    if (!availableVersion || availableVersion === loadedVersion) {
        await localRemove([LOCAL_UPDATE_MARKER]);
        return { updated: false, loadedVersion, availableVersion };
    }
    const stored = await localGet([LOCAL_UPDATE_MARKER]);
    if (stored[LOCAL_UPDATE_MARKER] === availableVersion) {
        return { updated: false, loadedVersion, availableVersion, reloadAlreadyRequested: true };
    }
    await localSet({ [LOCAL_UPDATE_MARKER]: availableVersion });
    setTimeout(() => chrome.runtime.reload(), 500);
    return { updated: true, loadedVersion, availableVersion };
};

const ensureLocalUpdateAlarm = () => {
    try {
        chrome.alarms.create(LOCAL_UPDATE_ALARM, {
            delayInMinutes: 1,
            periodInMinutes: 1
        });
        chrome.alarms.create(LABELS_SYNC_ALARM, {
            delayInMinutes: 0.25,
            periodInMinutes: 1
        });
    } catch {
        // A atualização também é verificada ao abrir o painel.
    }
};

const ensureWhatsAppContentScripts = async () => {
    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    await Promise.all(tabs
        .filter((tab) => Number.isInteger(tab.id))
        .map(async (tab) => {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    world: 'MAIN',
                    func: async () => {
                        const startedAt = Date.now();
                        while (document.readyState !== 'complete' && Date.now() - startedAt < 30000) {
                            await new Promise((resolve) => setTimeout(resolve, 200));
                        }
                    }
                });
                let status = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    world: 'MAIN',
                    func: () => ({
                        wpp: Boolean(window.WPP?.loader),
                        ready: Boolean(
                            (window.WPP?.isReady || window.WPP?.loader?.isReady)
                            && window.WPP?.chat?.sendTextMessage
                            && window.WPP?.chat?.sendFileMessage
                        ),
                        engineVersion: window.__vitalismenWppEngineVersion || '',
                        bridgeVersion: window.__vitalismenWppMainBridgeInstalled || ''
                    })
                });
                if (status?.[0]?.result?.wpp && status?.[0]?.result?.engineVersion !== '0.11.5') {
                    await chrome.tabs.reload(tab.id);
                    return;
                }
                if (!status?.[0]?.result?.wpp) {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        world: 'MAIN',
                        files: ['vendor/wppconnect-wa.js']
                    });
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        world: 'MAIN',
                        func: (version) => {
                            window.__vitalismenWppEngineVersion = version;
                        },
                        args: ['0.11.5']
                    });
                }
                if (status?.[0]?.result?.bridgeVersion !== '0.11.5') {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        world: 'MAIN',
                        files: ['whatsapp-main-bridge.js']
                    });
                }
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: [
                        'content-script.js',
                        'quick-price-funnel-library.js',
                        'quick-price-funnels/tex-ultra-ec.js',
                        'quick-price-active-product.js',
                        'whatsapp-funnel-launcher.js'
                    ]
                });
                const startedAt = Date.now();
                do {
                    status = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        world: 'MAIN',
                        func: () => ({
                            ready: Boolean(
                                (window.WPP?.isReady || window.WPP?.loader?.isReady)
                                && window.WPP?.chat?.sendTextMessage
                                && window.WPP?.chat?.sendFileMessage
                            )
                        })
                    });
                    if (status?.[0]?.result?.ready) break;
                    await new Promise((resolve) => setTimeout(resolve, 500));
                } while (Date.now() - startedAt < 45000);
            } catch {
                // A recarga normal do WhatsApp tambÃ©m injeta os mesmos arquivos.
            }
        }));
};

chrome.runtime.onInstalled.addListener(async () => {
    ensureLocalUpdateAlarm();
    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    await Promise.all(tabs
        .filter((tab) => Number.isInteger(tab.id))
        .map((tab) => chrome.tabs.reload(tab.id).catch(() => {})));
    setTimeout(() => ensureWhatsAppContentScripts().catch(() => {}), 2500);
});
chrome.runtime.onStartup.addListener(() => {
    ensureLocalUpdateAlarm();
    ensureWhatsAppContentScripts().catch(() => {});
    syncOperationalLabels().catch(() => {});
});
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === LOCAL_UPDATE_ALARM) checkLocalUpdate().catch(() => {});
    if (alarm.name === LABELS_SYNC_ALARM) syncOperationalLabels().catch(() => {});
});
ensureLocalUpdateAlarm();
ensureWhatsAppContentScripts().catch(() => {});

const allowedRequest = (method, path) => {
    const pathname = new URL(path, API_ORIGIN).pathname;
    if (method === 'POST' && pathname === '/api/auth/login') return true;
    if (method === 'POST' && /^\/api\/whatsapp\/contact-state\/[^/]+\/claim$/.test(pathname)) return true;
    if (method === 'PATCH' && /^\/api\/whatsapp\/contact-state\/[^/]+$/.test(pathname)) return true;
    if (method === 'PATCH' && /^\/api\/whatsapp\/chat-labels\/[^/]+$/.test(pathname)) return true;
    if (method === 'POST' && /^\/api\/integrations\/google-contacts\/(?:connect|disconnect)$/.test(pathname)) return true;
    if (method === 'POST' && /^\/api\/integrations\/google-contacts\/sync\/[^/]+\/retry$/.test(pathname)) return true;
    if (method === 'POST' && /^\/api\/integrations\/google-contacts\/sync\/[^/]+\/resolve-name$/.test(pathname)) return true;
    if (method !== 'GET') return false;
    return pathname === '/api/auth/me'
        || pathname === '/api/whatsapp/chats'
        || pathname === '/api/whatsapp/templates'
        || pathname === '/api/whatsapp/chat-labels'
        || pathname === '/api/integrations/google-contacts/status'
        || pathname === '/api/shipments/servientrega/ec/agencies'
        || pathname.startsWith('/api/whatsapp/messages/')
        || pathname.startsWith('/api/whatsapp/customer-profile/');
};

const normalizedPanelToken = (value) => {
    const token = String(value || '').trim();
    return token.length >= 40
        && token.length <= 4096
        && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
        ? token
        : '';
};

const adoptPanelToken = async (rawToken) => {
    const token = normalizedPanelToken(rawToken);
    if (!token) throw new Error('Sessão do painel inválida.');
    const response = await fetch(`${API_ORIGIN}/api/auth/me`, {
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
        },
        cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.user) throw new Error('Sessão do painel expirada.');
    const authenticated = {
        [SESSION_KEYS.token]: token,
        [SESSION_KEYS.user]: data.user
    };
    await Promise.all([sessionSet(authenticated), localSet(authenticated)]);
    syncOperationalLabels().catch(() => {});
    chrome.runtime.sendMessage({
        action: 'panelAuthAvailable',
        user: data.user
    }).catch(() => {});
    return { authenticated: true, user: data.user };
};

const importPanelSessionFromOpenTabs = async () => {
    const tabs = await chrome.tabs.query({ url: `${API_ORIGIN}/*` });
    for (const tab of tabs) {
        if (!tab?.id || !String(tab.url || '').startsWith(`${API_ORIGIN}/`)) continue;
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: (key) => window.localStorage.getItem(key) || '',
                args: ['vitalismen_admin_token']
            });
            const token = results?.[0]?.result;
            if (token) return await adoptPanelToken(token);
        } catch {
            // Continua procurando outra aba autenticada do painel.
        }
    }
    return { authenticated: false, user: null };
};

const apiRequest = async ({ path, method = 'GET', body }) => {
    const normalizedMethod = String(method).toUpperCase();
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN || !allowedRequest(normalizedMethod, url.pathname)) {
        throw new Error('A extensão bloqueou uma operação fora do modo somente leitura.');
    }

    const session = await authGet();
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (session[SESSION_KEYS.token]) {
        headers.Authorization = `Bearer ${session[SESSION_KEYS.token]}`;
    }

    const response = await fetch(url.toString(), {
        method: normalizedMethod,
        headers,
        cache: 'no-store',
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
        await authRemove();
    }
    if (!response.ok) {
        throw new Error(data.error || data.message || `Falha HTTP ${response.status}`);
    }
    return data;
};

const syncOperationalLabels = async () => {
    const session = await authGet();
    if (!session[SESSION_KEYS.token]) return { synced: false, reason: 'not_authenticated' };
    try {
        const data = await apiRequest({ path: '/api/whatsapp/chat-labels?country=EC', method: 'GET' });
        const labels = {};
        for (const item of Array.isArray(data?.labels) ? data.labels : []) {
            const phone = String(item?.phone || '').replace(/\D/g, '');
            const status = item?.operationalStatus || null;
            if (!phone || !status?.key || !status?.label) continue;
            labels[phone] = {
                key: status.key,
                label: status.label,
                color: status.color || '#0b9b7e',
                name: String(item?.name || '').trim(),
                source: status.source || 'draft',
                manual: status.manual === true,
                updatedAt: status.updatedAt || item.updatedAt || null,
                syncedAt: data.generatedAt || new Date().toISOString()
            };
        }
        await localSet({
            [LABELS_KEY]: labels,
            [LABELS_META_KEY]: {
                syncedAt: data.generatedAt || new Date().toISOString(),
                stale: false,
                count: Object.keys(labels).length
            }
        });
        return { synced: true, count: Object.keys(labels).length };
    } catch (error) {
        const current = await localGet([LABELS_META_KEY]);
        await localSet({
            [LABELS_META_KEY]: {
                ...(current[LABELS_META_KEY] || {}),
                stale: true,
                lastErrorAt: new Date().toISOString()
            }
        });
        throw error;
    }
};

const login = async ({ email, password }) => {
    const data = await apiRequest({
        path: '/api/auth/login',
        method: 'POST',
        body: { email, password }
    });
    if (!data.token) throw new Error('O servidor não devolveu uma sessão válida.');
    const authenticated = {
        [SESSION_KEYS.token]: data.token,
        [SESSION_KEYS.user]: data.user || null
    };
    await Promise.all([sessionSet(authenticated), localSet(authenticated)]);
    syncOperationalLabels().catch(() => {});
    return { user: data.user || null };
};

const openOfficialChat = async (rawPhone) => {
    const phone = String(rawPhone || '').replace(/\D/g, '');
    if (phone.length < 9 || phone.length > 15) {
        throw new Error('Telefone inválido para abrir no WhatsApp.');
    }

    const url = `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}`;
    const [existing] = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    if (existing?.id) {
        await chrome.tabs.update(existing.id, { active: true, url });
        if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
        return { reused: true };
    }
    await chrome.tabs.create({ active: true, url });
    return { reused: false };
};

const normalizeActiveChat = (selection = {}) => {
    const phone = String(selection.phone || '').replace(/\D/g, '').slice(0, 15);
    const name = String(selection.name || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    if ((!phone || phone.length < 9) && !name) return null;
    return {
        phone: phone.length >= 9 ? phone : '',
        name,
        source: ['url', 'visible_header', 'list_click'].includes(selection.source)
            ? selection.source
            : 'visible_header',
        observedAt: new Date().toISOString()
    };
};

const sendWhatsAppText = async ({ phone: rawPhone, text: rawText }) => {
    const phone = String(rawPhone || '').replace(/\D/g, '');
    const text = String(rawText || '').trim();
    if (phone.length < 9 || phone.length > 15) throw new Error('Cliente sem telefone válido.');
    if (!text) throw new Error('O texto está vazio.');
    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    const tab = tabs.find((candidate) => candidate.active) || tabs[0];
    if (!Number.isInteger(tab?.id)) throw new Error('Abra o WhatsApp Web antes de enviar.');
    await ensureWhatsAppContentScripts();
    const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: async (expectedPhone, content) => {
            const startedAt = Date.now();
            while (
                !(window.WPP?.isReady || window.WPP?.loader?.isReady)
                && Date.now() - startedAt < 45000
            ) {
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
            if (typeof window.WPP?.chat?.sendTextMessage !== 'function') {
                throw new Error('A integração do WhatsApp ainda não está pronta.');
            }
            const chat = window.WPP.chat.getActiveChat?.();
            const chatId = chat?.id?._serialized || chat?.id?.toString?.() || String(chat?.id || '');
            if (!chatId || (!chatId.includes('@c.us') && !chatId.includes('@lid'))) {
                throw new Error('Abra a conversa do cliente antes de enviar.');
            }
            const activePhone = chatId.includes('@c.us')
                ? chatId.split('@')[0].replace(/\D/g, '')
                : '';
            if (activePhone && activePhone !== expectedPhone) {
                throw new Error('A conversa aberta não corresponde ao cliente selecionado.');
            }
            await window.WPP.chat.sendTextMessage(chatId, content);
            return { chatId, kind: 'text' };
        },
        args: [phone, text]
    });
    return result?.[0]?.result || { kind: 'text' };
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const run = async () => {
        switch (message?.action) {
            case 'ensureWhatsAppIntegration':
                if (!String(sender?.url || '').startsWith('https://web.whatsapp.com/')) {
                    throw new Error('Origem não autorizada para iniciar a integração.');
                }
                ensureWhatsAppContentScripts().catch(() => {});
                return { scheduled: true };
            case 'activeWhatsAppChat': {
                if (!String(sender?.url || '').startsWith('https://web.whatsapp.com/')) {
                    throw new Error('Origem não autorizada para detectar conversa.');
                }
            const activeChat = normalizeActiveChat(message.selection);
            if (!activeChat) throw new Error('Conversa sem identificação utilizável.');
            await sessionSet({ [SESSION_KEYS.activeChat]: activeChat });
            syncOperationalLabels().catch(() => {});
            return activeChat;
        }
        case 'whatsAppChatSwitchStarted': {
            if (!String(sender?.url || '').startsWith('https://web.whatsapp.com/')) {
                throw new Error('Origem não autorizada para trocar conversa.');
            }
            const hint = normalizeActiveChat(message.selection || {});
            const pending = {
                pending: true,
                hint,
                observedAt: new Date().toISOString()
            };
            await sessionSet({ [SESSION_KEYS.activeChat]: pending });
            return pending;
        }
            case 'activeChatStatus': {
                const session = await sessionGet([SESSION_KEYS.activeChat]);
                return session[SESSION_KEYS.activeChat] || null;
            }
            case 'checkLocalUpdate':
                return checkLocalUpdate();
            case 'syncOperationalLabels':
                return syncOperationalLabels();
            case 'panelAuthCandidate':
                if (!String(sender?.url || '').startsWith(`${API_ORIGIN}/`)) {
                    throw new Error('Origem não autorizada para importar sessão.');
                }
                return adoptPanelToken(message.token);
            case 'importPanelSession':
                return importPanelSessionFromOpenTabs();
            case 'authStatus': {
                let session = await authGet();
                if (!session[SESSION_KEYS.token]) {
                    await importPanelSessionFromOpenTabs().catch(() => null);
                    session = await authGet();
                }
                return {
                    authenticated: Boolean(session[SESSION_KEYS.token]),
                    user: session[SESSION_KEYS.user] || null
                };
            }
            case 'login':
                return login(message.credentials || {});
            case 'logout':
                await authRemove();
                return { ok: true };
            case 'api':
                return apiRequest(message.request || {});
            case 'openOfficialChat':
                return openOfficialChat(message.phone);
            case 'sendWhatsAppText':
                if (sender?.id !== chrome.runtime.id) {
                    throw new Error('Origem não autorizada para enviar mensagem.');
                }
                return sendWhatsAppText(message);
            default:
                throw new Error('Ação não permitida pela extensão.');
        }
    };

    run()
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error) => sendResponse({ ok: false, error: error.message || 'Falha inesperada' }));
    return true;
});
