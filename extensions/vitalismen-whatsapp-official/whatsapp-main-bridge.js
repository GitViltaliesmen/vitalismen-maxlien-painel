(() => {
    'use strict';

    const BRIDGE_VERSION = '0.11.5';
    if (window.__vitalismenWppMainBridgeInstalled === BRIDGE_VERSION) return;
    window.__vitalismenWppMainBridgeInstalled = BRIDGE_VERSION;

    const OVERLAY_HOST_ID = 'vitalismen-funnel-overlay-host';
    const overlayFrame = () => document
        .getElementById(OVERLAY_HOST_ID)
        ?.shadowRoot
        ?.querySelector('iframe');
    const reply = (requestId, payload) => {
        overlayFrame()?.contentWindow?.postMessage({
            source: 'vitalismen-wpp-main-bridge',
            action: 'sendResult',
            requestId,
            ...payload
        }, '*');
    };
    const hasSendFunctions = () => (
        typeof window.WPP?.chat?.getActiveChat === 'function'
        && typeof window.WPP?.chat?.sendTextMessage === 'function'
        && typeof window.WPP?.chat?.sendFileMessage === 'function'
    );
    const isWppReady = () => Boolean(
        (window.WPP?.isReady || window.WPP?.loader?.isReady)
        && hasSendFunctions()
    );
    const wppReady = async (timeout = 45000) => {
        const startedAt = Date.now();
        while (!isWppReady() && Date.now() - startedAt < timeout) {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (isWppReady()) return;
        const loaderType = window.WPP?.loader?.loaderType || 'indisponível';
        const injected = Boolean(window.WPP?.loader?.isInjected);
        throw new Error(
            `Integração do WhatsApp indisponível (motor ${loaderType}, injetado: ${injected ? 'sim' : 'não'}). `
            + 'Atualize a extensão e recarregue esta aba.'
        );
    };
    const activeChatId = (expectedPhone = '') => {
        const chat = window.WPP?.chat?.getActiveChat?.();
        const id = chat?.id?._serialized || chat?.id?.toString?.() || String(chat?.id || '');
        if (!id || (!id.includes('@c.us') && !id.includes('@lid'))) {
            throw new Error('Abra a conversa do cliente antes de enviar.');
        }
        const expected = String(expectedPhone || '').replace(/\D/g, '');
        const active = id.includes('@c.us') ? id.split('@')[0].replace(/\D/g, '') : '';
        if (expected && active && expected !== active) {
            throw new Error('A conversa aberta mudou. Selecione novamente o cliente antes de enviar.');
        }
        return id;
    };
    const sendMessage = async (message) => {
        await wppReady();
        const chatId = activeChatId(message.phone);
        if (message.kind === 'text') {
            const text = String(message.text || '').trim();
            if (!text) throw new Error('O texto está vazio.');
            await window.WPP.chat.sendTextMessage(chatId, text);
            return { chatId, kind: 'text' };
        }
        if (!(message.buffer instanceof ArrayBuffer) || !message.buffer.byteLength) {
            throw new Error('O arquivo de mídia está vazio.');
        }
        const kind = ['audio', 'image', 'video', 'document'].includes(message.kind)
            ? message.kind
            : 'document';
        const mimeType = String(message.mimeType || 'application/octet-stream');
        const filename = String(message.filename || `arquivo-${Date.now()}`);
        const file = new File([message.buffer], filename, { type: mimeType });
        const options = {
            type: kind,
            filename,
            mimetype: mimeType
        };
        if (kind === 'audio') {
            options.isPtt = true;
            options.waveform = true;
        }
        if (kind === 'image' || kind === 'video') {
            options.isViewOnce = message.viewOnce === true;
        }
        await window.WPP.chat.sendFileMessage(chatId, file, options);
        return { chatId, kind, filename };
    };

    window.addEventListener('message', async (event) => {
        const frame = overlayFrame();
        const message = event.data;
        if (
            event.source !== frame?.contentWindow
            || message?.source !== 'vitalismen-funnel-overlay'
            || message?.action !== 'sendThroughWpp'
        ) return;
        try {
            const result = await sendMessage(message);
            reply(message.requestId, { ok: true, result });
        } catch (error) {
            reply(message.requestId, {
                ok: false,
                error: error?.message || 'O WhatsApp Web não confirmou o envio.'
            });
        }
    });
})();
