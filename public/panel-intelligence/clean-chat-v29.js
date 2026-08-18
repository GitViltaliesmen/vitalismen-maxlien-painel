(function exposeVitalismenCleanChatV29(root, factory) {
    const api = factory();
    root.VitalismenCleanChatV29 = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
    'use strict';

    const ATTENDANTS = Object.freeze({
        ana_lopez: Object.freeze({
            attendant_id: 'ana_lopez',
            display_name: 'Ana López',
            avatar: '',
            initials: 'AL',
            active: true
        })
    });

    const clean = (value) => String(value ?? '').trim();
    const lower = (value) => clean(value).toLowerCase();
    const nested = (value, ...paths) => {
        for (const path of paths) {
            const result = path.split('.').reduce((current, part) => current?.[part], value);
            if (clean(result)) return clean(result);
        }
        return '';
    };

    const hashText = (value = '') => {
        let hash = 2166136261;
        for (const char of String(value || '')) {
            hash ^= char.charCodeAt(0);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    };

    const normalizedTimestamp = (message = {}) => {
        const raw = message.timestamp ?? message.createdAt ?? message.localCreatedAt ?? '';
        const numeric = Number(raw);
        if (Number.isFinite(numeric) && numeric > 0) return String(numeric < 100000000000 ? numeric * 1000 : numeric);
        const parsed = Date.parse(raw);
        return Number.isFinite(parsed) ? String(parsed) : '0';
    };

    const mediaFingerprint = (message = {}) => {
        const attachments = Array.isArray(message.mediaAttachments) ? message.mediaAttachments : [];
        return [
            message.mediaUrl,
            message.mediaPreviewUrl,
            ...attachments.flatMap((item) => [item.mediaUrl, item.mediaPreviewUrl, item.type])
        ].map(clean).filter(Boolean).join('|');
    };

    const senderRole = (message = {}) => {
        const explicit = lower(message.senderRole || message.sender_role || message.role);
        const type = lower(message.type || message.eventType || message.event_type);
        const from = lower(message.from);
        if (explicit === 'system' || ['system', 'event', 'status', 'sync', 'health', 'log'].includes(type) || from === 'system') return 'system';
        if (explicit === 'bot' || message.isBot === true || from === 'bot') return 'bot';
        if (explicit === 'human' || explicit === 'attendant') return 'human';
        return message.isFromMe ? 'human' : 'client';
    };

    const canonicalMessageIdentity = (message = {}) => {
        const providerId = nested(
            message,
            'providerMessageId', 'provider_message_id',
            'providerPayload.messageId', 'providerPayload.message_id', 'providerPayload.id',
            'provider_payload.messageId', 'provider_payload.message_id', 'provider_payload.id'
        );
        if (providerId) return `provider:${providerId}`;

        const messageId = nested(message, 'messageId', 'message_id', '_id');
        if (messageId) return `message:${messageId}`;

        const externalId = nested(message, 'externalId', 'external_id', 'providerZaapId', 'provider_zaap_id');
        if (externalId) return `external:${externalId}`;

        const clientId = nested(message, 'clientGeneratedId', 'client_generated_id');
        if (clientId) return `client:${clientId}`;

        const composite = [
            senderRole(message),
            message.isFromMe ? 'out' : 'in',
            lower(message.type || 'chat'),
            normalizedTimestamp(message),
            hashText(clean(message.body)),
            hashText(mediaFingerprint(message)),
            clean(message.chatId || message.peerPhone || message.from || message.to)
        ].join('|');
        return `composite:${composite}`;
    };

    const messageIdentityAliases = (message = {}) => [...new Set([
        nested(message, 'providerMessageId', 'provider_message_id', 'providerPayload.messageId', 'provider_payload.messageId')
            ? `provider:${nested(message, 'providerMessageId', 'provider_message_id', 'providerPayload.messageId', 'provider_payload.messageId')}` : '',
        nested(message, 'messageId', 'message_id', '_id')
            ? `message:${nested(message, 'messageId', 'message_id', '_id')}` : '',
        nested(message, 'externalId', 'external_id', 'providerZaapId', 'provider_zaap_id')
            ? `external:${nested(message, 'externalId', 'external_id', 'providerZaapId', 'provider_zaap_id')}` : '',
        nested(message, 'clientGeneratedId', 'client_generated_id')
            ? `client:${nested(message, 'clientGeneratedId', 'client_generated_id')}` : '',
        canonicalMessageIdentity(message)
    ].filter(Boolean))];

    const deliveryRank = (message = {}) => {
        const status = lower(message.deliveryStatus || message.delivery_status || message.providerStatus);
        const ack = Number(message.ack || 0);
        if (status === 'read' || status === 'played' || ack >= 3) return 4;
        if (status === 'delivered' || ack === 2) return 3;
        if (['sent', 'pending_confirmation'].includes(status) || ack === 1) return 2;
        if (['sending', 'pending', 'queued'].includes(status)) return 1;
        if (['failed', 'error', 'final_failed', 'unconfirmed'].includes(status) || ack < 0) return -1;
        return 0;
    };

    const messageRichness = (message = {}) => [
        message.body,
        message.mediaUrl,
        message.mediaPreviewUrl,
        message.notifyName,
        message.providerMessageId,
        message.quotedBody,
        message.attendantId,
        message.senderRole
    ].filter((value) => clean(value)).length + (Array.isArray(message.mediaAttachments) ? message.mediaAttachments.length : 0);

    const mergeMessageRecords = (current = {}, incoming = {}) => {
        const primary = messageRichness(incoming) >= messageRichness(current) ? incoming : current;
        const secondary = primary === incoming ? current : incoming;
        const higherDelivery = deliveryRank(incoming) >= deliveryRank(current) ? incoming : current;
        const aliases = [...new Set([
            ...(current.presentationAliases || []),
            ...(incoming.presentationAliases || []),
            current._id,
            incoming._id,
            current.clientGeneratedId,
            incoming.clientGeneratedId
        ].map(clean).filter(Boolean))];
        return {
            ...secondary,
            ...primary,
            body: clean(primary.body) ? primary.body : secondary.body,
            mediaUrl: clean(primary.mediaUrl) ? primary.mediaUrl : secondary.mediaUrl,
            mediaPreviewUrl: clean(primary.mediaPreviewUrl) ? primary.mediaPreviewUrl : secondary.mediaPreviewUrl,
            mediaAttachments: (primary.mediaAttachments?.length ? primary.mediaAttachments : secondary.mediaAttachments) || [],
            providerMessageId: nested(primary, 'providerMessageId', 'provider_message_id') || nested(secondary, 'providerMessageId', 'provider_message_id'),
            externalId: nested(primary, 'externalId', 'external_id') || nested(secondary, 'externalId', 'external_id'),
            clientGeneratedId: nested(primary, 'clientGeneratedId', 'client_generated_id') || nested(secondary, 'clientGeneratedId', 'client_generated_id'),
            deliveryStatus: higherDelivery.deliveryStatus || higherDelivery.delivery_status || primary.deliveryStatus || secondary.deliveryStatus,
            providerStatus: higherDelivery.providerStatus || primary.providerStatus || secondary.providerStatus,
            ack: Math.max(Number(current.ack || 0), Number(incoming.ack || 0)),
            deliveredAt: current.deliveredAt || incoming.deliveredAt,
            readAt: current.readAt || incoming.readAt,
            sendError: deliveryRank(higherDelivery) >= 1 ? '' : (higherDelivery.sendError || primary.sendError || secondary.sendError || ''),
            presentationAliases: aliases,
            presentationIdentity: canonicalMessageIdentity(primary)
        };
    };

    const isTechnicalMessage = (message = {}) => {
        if (senderRole(message) === 'system') return true;
        const provider = lower(message.provider);
        const delivery = lower(message.deliveryStatus || message.delivery_status);
        const body = clean(message.body);
        if (provider === 'zapi_chat_watchdog' || delivery === 'system') return true;
        if (message.metadata?.technicalEvent === true || message.metadata?.systemEvent === true) return true;
        return /^(?:\[PAINEL\]|\[SYSTEM\]|SYSTEM:|SYNC:|HEALTH:|ALERTA:\s*o WhatsApp conectado)/i.test(body);
    };

    const containsPickupAuthorizationLanguage = (text = '') => /\b(?:ya\s+(?:lo\s+)?puede\s+(?:retirar|recoger|ir)|puede\s+(?:acercarse|retirar|recoger)|vaya\s+a\s+la\s+agencia|esta\s+(?:listo|disponible)\s+para\s+(?:retiro|retirar|recoger)|pedido\s+(?:listo|disponible)\s+para\s+(?:retiro|retirar)|(?:su\s+)?pedido\s+(?:ya\s+)?esta\s+disponible|ya\s+esta\s+en\s+agencia)\b/i.test(
        clean(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    );

    const isGuideMediaCandidate = (value = '') => /\b(?:guia|factura|invoice|tracking|rastreo)\b/i.test(
        clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );

    const presentMessages = (messages = []) => {
        const groups = [];
        for (const raw of Array.isArray(messages) ? messages : []) {
            const aliases = messageIdentityAliases(raw);
            const existing = groups.find((group) => aliases.some((alias) => group.aliases.has(alias)));
            if (!existing) {
                groups.push({
                    aliases: new Set(aliases),
                    message: {
                        ...raw,
                        presentationIdentity: canonicalMessageIdentity(raw),
                        presentationAliases: [clean(raw._id)].filter(Boolean)
                    }
                });
            } else {
                aliases.forEach((alias) => existing.aliases.add(alias));
                existing.message = mergeMessageRecords(existing.message, raw);
                existing.message.presentationIdentity = canonicalMessageIdentity(existing.message);
            }
        }
        const merged = groups.map((group) => group.message);
        const visible = merged.filter((message) => !isTechnicalMessage(message));
        const technical = merged.filter(isTechnicalMessage);
        return Object.freeze({
            visible,
            technical,
            duplicatesCollapsed: Math.max(0, (Array.isArray(messages) ? messages.length : 0) - merged.length),
            totalRecords: Array.isArray(messages) ? messages.length : 0,
            totalBubbles: visible.length
        });
    };

    const initialsForName = (name = '', fallback = 'C') => {
        const words = clean(name)
            .replace(/[^\p{L}\p{N}\s'’-]+/gu, ' ')
            .split(/\s+/)
            .filter(Boolean)
            .filter((word) => !/^\d+$/.test(word));
        if (!words.length) return fallback;
        return words.slice(0, 2).map((word) => [...word][0]?.toUpperCase() || '').join('') || fallback;
    };

    const validAvatarUrl = (value = '') => {
        const url = clean(value);
        return /^(?:https:\/\/|data:image\/|blob:|\/)/i.test(url) ? url : '';
    };

    const avatarDescriptor = ({ role = 'client', name = '', avatar = '', attendantId = '', imageFailed = false } = {}) => {
        const normalizedRole = lower(role) || 'client';
        if (normalizedRole === 'system') return Object.freeze({ role: 'system', displayName: 'Sistema', initials: 'SYS', avatar: '', active: false });
        if (normalizedRole === 'bot') return Object.freeze({ role: 'bot', displayName: 'Bot Vitalismen', initials: 'BT', avatar: '', active: true });
        if (normalizedRole === 'human') {
            const explicitAttendantId = clean(attendantId);
            const configured = ATTENDANTS[explicitAttendantId] || (!explicitAttendantId ? ATTENDANTS.ana_lopez : null);
            const displayName = clean(name) || configured?.display_name || 'Atendente';
            return Object.freeze({
                role: 'human',
                attendantId: configured?.attendant_id || explicitAttendantId,
                displayName,
                initials: configured?.initials || initialsForName(displayName, 'AT'),
                avatar: imageFailed ? '' : (validAvatarUrl(avatar) || validAvatarUrl(configured?.avatar)),
                active: configured?.active !== false
            });
        }
        const displayName = clean(name) || 'Cliente';
        return Object.freeze({
            role: 'client',
            displayName,
            initials: initialsForName(displayName, 'C'),
            avatar: imageFailed ? '' : validAvatarUrl(avatar),
            active: true
        });
    };

    return Object.freeze({
        ATTENDANTS,
        senderRole,
        canonicalMessageIdentity,
        messageIdentityAliases,
        mergeMessageRecords,
        isTechnicalMessage,
        containsPickupAuthorizationLanguage,
        isGuideMediaCandidate,
        presentMessages,
        initialsForName,
        avatarDescriptor,
        validAvatarUrl
    });
});
