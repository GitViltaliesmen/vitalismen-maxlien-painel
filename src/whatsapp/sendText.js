import { getSock, getSocketId, getOwnPhoneDigits, waitForWhatsAppReady } from './connection.js';
import { canSendOutbound } from './outboundGuard.js';
import { recordOutboundSend, resolveOutboundSessionForJid } from './sessionRouter.js';
import { applyAfterSendPacing, applyHumanPacing, withHumanizedOutboundQueue } from './humanPacing.js';
import { humanizeWhatsAppText } from './humanizeText.js';
import {
    markOutboundDedupeFailed,
    markOutboundDedupeSent,
    reserveOutboundOnce,
    resolveOutboundPhoneDigits
} from '../services/outboundDedupeService.js';
import { checkDropiOrderBeforeOutbound } from '../services/dropiOutboundOrderGuardService.js';
import { sendZapiText, zapiConfig } from '../services/zapiClient.js';
import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';

const SEND_TEXT_TIMEOUT_MS = Number.parseInt(process.env.WHATSAPP_SEND_TEXT_TIMEOUT_MS || '45000', 10);
const HISTORY_DEDUPE_WINDOW_MINUTES = Math.max(5, Number.parseInt(process.env.WHATSAPP_HISTORY_DEDUPE_WINDOW_MINUTES || '1440', 10) || 1440);
const parseMs = (name, fallback) => {
    const value = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
};
const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms))
]);
const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const parsePhoneList = (...values) => [
    ...new Set(
        values
            .flatMap((value) => String(value || '').split(','))
            .map((item) => digitsOnly(item))
            .filter(Boolean)
    )
];
const isSamePhone = (left, right) => {
    const a = digitsOnly(left);
    const b = digitsOnly(right);
    if (!a || !b) return false;
    return a === b || a.startsWith(b) || b.startsWith(a);
};
const looksLikeRealPhoneDigits = (value = '') => /^(593|57|55)\d{8,13}$/.test(digitsOnly(value));
const looksLikeZapiRoutedPhone = (value = '') => /^(593|57)\d{8,13}$/.test(digitsOnly(value));
const zapiOperationalTestRecipients = () => parsePhoneList(
    process.env.WHATSAPP_TEST_ALLOWED_RECIPIENTS,
    process.env.WHATSAPP_PANEL_OPERATIONAL_NUMBERS,
    process.env.WHATSAPP_PRIORITY_TEST_PHONES,
    process.env.WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS
);
const isZapiOperationalTestRecipient = (phone = '') => {
    const digits = digitsOnly(phone);
    return Boolean(digits && zapiOperationalTestRecipients().some((allowed) => isSamePhone(digits, allowed)));
};
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeAntiSpamTextKey = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s$.,:;!?¿¡-]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
const normalizeHistoryText = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s$.,:;!?¿¡-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const CLIENT_VISIBLE_MARKER_LINE_REGEX = /^\s*\[(?:AUDIO|AUDIO_[^\]]+|ÁUDIO|IMAGEM|IMAGE|VIDEO|VÍDEO|MIDIAS|MÍDIAS|MEDIA|DADOS[^\]]*|ENVIAR_AUDIO_GRAVADO|GERAR_AUDIO)[^\]]*\].*$/i;
const CLIENT_VISIBLE_INLINE_MARKER_REGEX = /\[(?:AUDIO|AUDIO_[^\]]+|ÁUDIO|IMAGEM|IMAGE|VIDEO|VÍDEO|MIDIAS|MÍDIAS|MEDIA|DADOS[^\]]*|ENVIAR_AUDIO_GRAVADO|GERAR_AUDIO)[^\]]*\]\s*[:=-]?\s*/gi;

const sanitizeClientVisibleText = (value = '') => {
    const lines = String(value || '')
        .split(/\r?\n/)
        .filter((line) => !CLIENT_VISIBLE_MARKER_LINE_REGEX.test(line));
    return lines
        .join('\n')
        .replace(CLIENT_VISIBLE_INLINE_MARKER_REGEX, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};
const historyRepeatKey = (text = '') => {
    const body = normalizeHistoryText(text);
    if (!body) return '';
    const guideMatch = body.match(/\b(?:guia|guia numero|numero de guia|tracking)\s*(?:es|numero|nro|num|:|#|-)?\s*(\d{5,})\b/);
    const readyPickupNotice = (
        /\b(pedido\s+listo\s+para\s+retiro|pedido\s+para\s+retiro|aviso\s+de\s+retiro|ya\s+puede\s+retirar|puede\s+acercarse|acerquese|lleve\s+su\s+documento|muestre\s+esta\s+guia|retir[aeiou]?\s+(?:su|mi|el)?\s*pedido|retirarlo|retirar\s+en\s+agencia|comprobante\s+de\s+retiro)\b/.test(body)
        || /\b(?:su\s+pedido|pedido)\s+(?:ya\s+)?(?:esta|aparece)\s+(?:listo|disponible)\s+(?:para\s+retiro|en\s+agencia)\b/.test(body)
        || /\b(?:su\s+pedido|pedido)\s+(?:ya\s+)?(?:esta|sigue)\s+para\s+retiro\b/.test(body)
    );
    const guideGeneratedNotice = (
        /\b(ya\s+fue\s+enviado|ya\s+salio|ya\s+se\s+genero\s+la\s+guia|se\s+genero\s+la\s+guia|ya\s+tiene\s+guia|tiene\s+guia|guia\s+generada|le\s+confirmo\s+el\s+envio|fue\s+enviado\s+por|salio\s+por)\b/.test(body)
        || (/\bguia\b/.test(body) && /\b(transportadora|en\s+camino|enviado|envio|ruta|servientrega)\b/.test(body))
    );
    if (readyPickupNotice) {
        return guideMatch ? `logistics_ready_for_pickup:${guideMatch[1]}` : 'logistics_ready_for_pickup';
    }
    if (guideGeneratedNotice) {
        return guideMatch ? `logistics_guide:${guideMatch[1]}` : 'logistics_guide';
    }
    if (/(pedido ya quedo registrado|pedido esta registrado|su pedido quedo registrado|su pedido ya esta registrado|apenas tenga la guia|novedad de servientrega)/.test(body)) return 'order_registered_waiting_guide';
    if (/(le envio|envio|enviamos)\s+(?:1|2|3|6|un|una|dos|tres|seis)\s+(?:botella|botellas|frasco|frascos)/.test(body)
        && /(listo|de acuerdo|esta correcto|esta bien)/.test(body)) return 'ask_value_confirmation';
    if (/\b(cual es su nombre completo|nombre completo|nombre y apellido)\b/.test(body)) return 'ask_name';
    if (/\bque dia desea que le escribamos nuevamente\b/.test(body)) return 'ask_followup_date';
    if (/(cuantos frascos|indiqueme cuantos frascos|elige la cantidad|escoja la cantidad|1\s*3\s*o\s*6|1\s*,\s*3\s*o\s*6)/.test(body)) return 'ask_quantity';
    if (/(esta bien para usted reservar|me confirma si esta de acuerdo|le parece bien|confirma.*valor|confirmar.*cantidad)/.test(body) && /frasco/.test(body)) return 'ask_value_confirmation';
    if (/(puedo enviar su pedido por una agencia de servientrega|agencia servientrega cercana|prefiere agencia|prefiere domicilio|agencia o domicilio|por agencia o domicilio)/.test(body)) return 'ask_delivery_mode';
    if (/(elija una de las agencias|escoja una de las agencias|responda solo con la letra|a\)\s*servientrega|b\)\s*servientrega)/.test(body)) return 'ask_agency_selection';
    if (/(envieme|envienos|indiqueme|proporcione|cual es|por favor.*(?:direccion|barrio|sector|referencia))/.test(body)
        && /(direccion completa|direccion exacta|barrio|sector|referencia cercana|punto de referencia)/.test(body)) return 'ask_home_address';
    if (/(autoriza el despacho|revise.*datos.*correctos|si todo esta bien|confirma.*despacho|confirmar.*pedido)/.test(body)) return 'ask_final_confirmation';
    if (/(pedido quedo confirmado|gracias por confirmar sus datos|su pedido fue confirmado|venta confirmada)/.test(body)) return 'order_closed_confirmation';
    if (/(cual es|indiqueme|en que|por favor.*provincia|escriba.*provincia)/.test(body) && /\bprovincia\b/.test(body)) return 'ask_province';
    if (/(cual es|indiqueme|en que|por favor.*ciudad|escriba.*ciudad)/.test(body) && /\bciudad\b/.test(body)) return 'ask_city';
    return body.length >= 25 ? `exactish:${body.slice(0, 220)}` : '';
};
const recentHistoryPhoneClauses = ({ targetJid, recipientDigits }) => {
    const clauses = [];
    const jid = String(targetJid || '').trim();
    const digits = digitsOnly(recipientDigits) || digitsOnly(jid);
    if (jid) clauses.push({ chatId: jid }, { to: jid }, { from: jid });
    if (digits.length >= 8) {
        const tail = digits.slice(-10);
        const tailRegex = new RegExp(`${escapeRegex(tail)}(?:\\D|$)`);
        clauses.push(
            { peerPhone: digits },
            { peerPhone: { $regex: `${escapeRegex(tail)}$` } },
            { chatId: { $regex: tailRegex } },
            { to: { $regex: tailRegex } },
            { from: { $regex: tailRegex } }
        );
    }
    return clauses;
};
const hasRecentHistoryRepeat = async ({ targetJid, recipientDigits, body }) => {
    const key = historyRepeatKey(body);
    if (!key || Message?.db?.readyState !== 1) return { blocked: false, key };
    const phoneClauses = recentHistoryPhoneClauses({ targetJid, recipientDigits });
    if (!phoneClauses.length) return { blocked: false, key };
    const since = new Date(Date.now() - HISTORY_DEDUPE_WINDOW_MINUTES * 60 * 1000);
    const currentNormalized = normalizeHistoryText(body);
    try {
        const recentMessages = await Message.find({
            $and: [
                { $or: phoneClauses },
                { $or: [{ isFromMe: true }, { isBot: true }, { from: 'bot' }] },
                { $or: [{ createdAt: { $gte: since } }, { updatedAt: { $gte: since } }] }
            ],
            body: { $type: 'string', $ne: '' }
        })
            .sort({ createdAt: -1, timestamp: -1 })
            .limit(40)
            .select({ body: 1, createdAt: 1, timestamp: 1 })
            .lean();
        const repeated = recentMessages.find((message) => {
            const previousBody = message?.body || '';
            return historyRepeatKey(previousBody) === key || normalizeHistoryText(previousBody) === currentNormalized;
        });
        return repeated ? { blocked: true, key } : { blocked: false, key };
    } catch (error) {
        console.warn(`[LOG_SEND_HISTORY_GUARD_WARN] falha ao consultar historico anti-repeticao -> ${targetJid}: ${error.message}`);
        return { blocked: false, key };
    }
};
const shouldUseZapiForText = ({ targetJid, recipientDigits, options = {} }) => {
    if (!zapiConfig().enabled) return false;
    const phone = digitsOnly(recipientDigits) || digitsOnly(targetJid);
    if (!looksLikeZapiRoutedPhone(phone) && !isZapiOperationalTestRecipient(phone)) return false;
    const country = String(options.country || '').toUpperCase();
    return options.provider === 'zapi'
        || options.sessionId === 'zapi'
        || options.sendMode === 'manual_panel'
        || ['EC', 'CO'].includes(country);
};
const zapiFailoverEnabled = () => String(process.env.OUTBOUND_ZAPI_FAILOVER_ENABLED || 'true').toLowerCase() !== 'false';
const shouldTryZapiTextFailover = ({ targetJid, recipientDigits, options = {}, reason = '' } = {}) => {
    if (!zapiFailoverEnabled() || options.zapiFailoverAttempt === true) return false;
    if (options.provider === 'zapi' || options.sessionId === 'zapi') return false;
    if (!zapiConfig().enabled) return false;
    const phone = digitsOnly(recipientDigits) || digitsOnly(targetJid);
    if (!looksLikeZapiRoutedPhone(phone) && !isZapiOperationalTestRecipient(phone)) return false;
    const value = String(reason || '').toLowerCase();
    return !value || /timeout|not.*ready|ready|closed|unauthorized_session|blocked_session|session|socket|connection|baileys|send_text/.test(value);
};
const recordZapiFailover = async ({ targetJid, recipientDigits = '', kind = 'text', reason = '', status = '', providerMessageId = '' } = {}) => {
    const phone = digitsOnly(recipientDigits) || digitsOnly(targetJid);
    if (!phone) return;
    const tails = [phone, phone.length >= 9 ? phone.slice(-9) : '', phone.length >= 10 ? phone.slice(-10) : ''].filter(Boolean);
    const or = [
        { chatId: targetJid },
        { phoneDigits: phone },
        ...tails.map((tail) => ({ phoneDigits: { $regex: `${tail}$` } }))
    ];
    await ContactState.updateOne(
        { $or: or },
        {
            $set: {
                'metadata.senderWallet.fallbackToZapiAt': new Date(),
                'metadata.senderWallet.fallbackToZapiKind': kind,
                'metadata.senderWallet.fallbackToZapiReason': String(reason || '').slice(0, 500),
                'metadata.senderWallet.fallbackToZapiStatus': status,
                ...(providerMessageId ? { 'metadata.senderWallet.fallbackToZapiProviderMessageId': providerMessageId } : {})
            },
            $inc: {
                'metadata.senderWallet.fallbackToZapiCount': 1
            }
        }
    ).catch((error) => console.warn(`[OUTBOUND-ZAPI-FAILOVER] falha ao registrar failover ${targetJid}: ${error.message}`));
};
const failoverWasSent = (result) => (result === true || result?.ok === true);
const normalizeOutboundJid = async (jid, recipientDigits = '') => {
    const resolvedDigits = await resolveOutboundPhoneDigits({ jid, recipientDigits });
    if (String(jid || '').endsWith('@lid') && looksLikeRealPhoneDigits(resolvedDigits)) {
        return {
            jid: `${digitsOnly(resolvedDigits)}@s.whatsapp.net`,
            recipientDigits: digitsOnly(resolvedDigits),
            normalizedFromLid: true
        };
    }
    return {
        jid,
        recipientDigits: digitsOnly(recipientDigits) || (looksLikeRealPhoneDigits(resolvedDigits) ? digitsOnly(resolvedDigits) : ''),
        normalizedFromLid: false
    };
};

/**
 * Enterprise Text Wrapper for Baileys
 * Provides standardized error handling and formatting for plain text responses
 */
export const sendText = async (jid, text, quotedMsg = null, options = {}) => {
    const normalized = await normalizeOutboundJid(jid, options.recipientDigits || '');
    const targetJid = normalized.jid;
    const recipientDigits = options.recipientDigits || normalized.recipientDigits || '';
    const route = await resolveOutboundSessionForJid({ requestedSessionId: options.sessionId || null, jid: targetJid, country: options.country || '' });
    const sessionId = route.sessionId;
    const ownDigits = getOwnPhoneDigits(sessionId);
    const humanizedText = options.humanize === false
        ? String(text || '').trim()
        : humanizeWhatsAppText(text, { jid: targetJid, sessionId });
    const finalText = sanitizeClientVisibleText(humanizedText);
    if (!finalText) {
        console.warn(`[TEXT-GUARD] texto bloqueado por conter apenas marcador tecnico -> ${targetJid}`);
        return false;
    }
    if (finalText !== humanizedText) {
        console.warn(`[TEXT-GUARD] marcador tecnico removido antes do envio -> ${targetJid}`);
    }
    const bypassDedupe = options.bypassDedupe === true || options.force === true;
    const bypassTextDedupe = bypassDedupe && options.allowTextDedupeBypass === true;
    const antiSpamKey = options.antiSpamKey
        || options.outboundContext
        || `auto_text:${normalizeAntiSpamTextKey(finalText)}`;
    if (normalized.normalizedFromLid) {
        console.log(`[OUTBOUND-JID] LID normalizado para numero real -> ${jid} => ${targetJid}`);
    }
    const guard = canSendOutbound({ jid: targetJid, text: finalText, sessionId, ownDigits, kind: 'text', recipientDigits, bypassDedupe: bypassTextDedupe, reserveDedupe: false });
    if (!guard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] texto bloqueado -> ${targetJid} | reason=${guard.reason}`);
        if (shouldTryZapiTextFailover({ targetJid, recipientDigits, options, reason: guard.reason })) {
            console.warn(`[OUTBOUND-ZAPI-FAILOVER] texto bloqueado por sessao; tentando Z-API -> ${targetJid} | reason=${guard.reason}`);
            await recordZapiFailover({ targetJid, recipientDigits, kind: 'text', reason: guard.reason, status: 'retrying' });
            const failover = await sendText(targetJid, finalText, quotedMsg, {
                ...options,
                sessionId: 'zapi',
                provider: 'zapi',
                zapiFailoverAttempt: true,
                humanize: false,
                allowHistoryDedupeBypass: true,
                outboundContext: `${options.outboundContext || 'auto_text'}_zapi_failover`
            });
            await recordZapiFailover({
                targetJid,
                recipientDigits,
                kind: 'text',
                reason: guard.reason,
                status: failoverWasSent(failover) ? 'sent' : 'failed',
                providerMessageId: failover?.providerMessageId || ''
            });
            return failover;
        }
        return false;
    }
    const dropiGuard = await checkDropiOrderBeforeOutbound({
        jid: targetJid,
        recipientDigits,
        text: finalText,
        allowExistingDropiOrder: options.allowExistingDropiOrder === true,
        outboundContext: options.outboundContext || ''
    });
    if (!dropiGuard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] texto bloqueado por pedido Dropi existente -> ${targetJid} | reason=${dropiGuard.reason} | order=${dropiGuard.orderId || ''} | tracking=${dropiGuard.trackingNumber || ''}`);
        return false;
    }
    if (!bypassTextDedupe && options.allowHistoryDedupeBypass !== true) {
        const historyGuard = await hasRecentHistoryRepeat({ targetJid, recipientDigits, body: finalText });
        if (historyGuard.blocked) {
            console.log(`[LOG_SEND_BLOCKED] texto repetido bloqueado por historico -> ${targetJid} | reason=history_repeat | key=${historyGuard.key}`);
            return false;
        }
    }
    const duplicateGuard = await reserveOutboundOnce({
        jid: targetJid,
        recipientDigits,
        sessionId,
        kind: 'text',
        value: options.dedupeValue || finalText,
        label: finalText,
        antiSpamKey,
        bypass: bypassTextDedupe
    });
    if (!duplicateGuard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] texto repetido bloqueado rigidamente -> ${targetJid} | reason=${duplicateGuard.reason} | phone=${duplicateGuard.phoneDigits || ''}`);
        return false;
    }

    if (shouldUseZapiForText({ targetJid, recipientDigits, options })) {
        try {
            const phone = digitsOnly(recipientDigits) || digitsOnly(targetJid);
            const response = await sendZapiText({
                phone,
                message: finalText,
                messageId: options.providerMessageId || options.messageId || '',
                delayMessage: null,
                delayTyping: null
            });
            console.log(`[LOG_SEND_USING_ZAPI] Texto enfileirado na Z-API -> ${phone} | Tamanho: ${finalText.length} chars | messageId=${response?.messageId || response?.id || ''}`);
            recordOutboundSend({ sessionId: 'zapi', jid: targetJid });
            await markOutboundDedupeSent({ key: duplicateGuard.key, semanticKey: duplicateGuard.semanticKey });
            const details = {
                ok: true,
                provider: 'zapi',
                providerMessageId: response?.messageId || response?.id || '',
                providerZaapId: response?.zaapId || '',
                providerStatus: 'queued',
                providerPayload: response
            };
            return options.returnDetails === true ? details : true;
        } catch (error) {
            const detail = error?.response?.data || error.message || 'zapi_send_failed';
            console.error(`[OUTBOUND-ZAPI-ERROR] Falha ao enviar texto pela Z-API para ${targetJid}:`, detail);
            await markOutboundDedupeFailed({
                key: duplicateGuard.key,
                semanticKey: duplicateGuard.semanticKey,
                error: typeof detail === 'string' ? detail : JSON.stringify(detail)
            });
            return options.returnDetails === true
                ? {
                    ok: false,
                    provider: 'zapi',
                    providerStatus: 'failed',
                    error: typeof detail === 'string' ? detail : JSON.stringify(detail),
                    providerPayload: detail
                }
                : false;
        }
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        const sock = getSock(sessionId);
        const sId = getSocketId(sessionId);

        try {
            const readySock = sock || await waitForWhatsAppReady(12000, sessionId);
            const payload = { text: finalText };
            const normalizedQuotedMsg = quotedMsg
                ? {
                    ...quotedMsg,
                    key: {
                        ...(quotedMsg.key || {}),
                        remoteJid: targetJid
                    }
                }
                : null;
            const messageOptions = normalizedQuotedMsg ? { quoted: normalizedQuotedMsg } : undefined;

            const firstResponseSla = options.firstResponseSla === true;
            const pacingMinMs = firstResponseSla
                ? parseMs('WHATSAPP_FIRST_RESPONSE_MIN_MS', 10000)
                : null;
            const pacingMaxMs = firstResponseSla
                ? parseMs('WHATSAPP_FIRST_RESPONSE_MAX_MS', 45000)
                : null;
            const sendMode = options.sendMode || '';
            const { pacing, afterSendMs } = await withHumanizedOutboundQueue(targetJid, async () => {
                const pacing = await applyHumanPacing({
                    sock: readySock,
                    jid: targetJid,
                    kind: 'text',
                    text: finalText,
                    minMs: pacingMinMs,
                    maxMs: pacingMaxMs,
                    sendMode
                });
                await withTimeout(
                    readySock.sendMessage(targetJid, payload, messageOptions),
                    Number.isFinite(SEND_TEXT_TIMEOUT_MS) && SEND_TEXT_TIMEOUT_MS > 0 ? SEND_TEXT_TIMEOUT_MS : 45000,
                    'send_text'
                );
                const afterSendMs = options.skipAfterSendPacing === true
                    ? 0
                    : await applyAfterSendPacing({ kind: 'text', text: finalText, sendMode });
                return { pacing, afterSendMs };
            }, {
                bypassGlobalQueue: firstResponseSla,
                globalGapMinMs: firstResponseSla ? 0 : null,
                globalGapMaxMs: firstResponseSla ? 0 : null,
                sendMode
            });
            console.log(`[LOG_SEND_USING_SOCKET] [socketId=${sId}] 📤 Texto disparado -> ${targetJid} | Tamanho: ${finalText.length} chars | pacing=${pacing.waitedMs}ms/${pacing.presence} | after=${afterSendMs}ms | tentativa=${attempt} | session=${sessionId || 'auto'}`);
            recordOutboundSend({ sessionId, jid: targetJid });
            await markOutboundDedupeSent({ key: duplicateGuard.key, semanticKey: duplicateGuard.semanticKey });
            return options.returnDetails === true
                ? { ok: true, provider: 'baileys', providerStatus: 'sent' }
                : true;
        } catch (error) {
            console.error(`[OUTBOUND-ERROR] ❌ Falha ao enviar texto para ${targetJid} | tentativa=${attempt}:`, error);
            if (attempt === 2) {
                await markOutboundDedupeFailed({ key: duplicateGuard.key, semanticKey: duplicateGuard.semanticKey, error: error.message });
                if (shouldTryZapiTextFailover({ targetJid, recipientDigits, options, reason: error.message })) {
                    console.warn(`[OUTBOUND-ZAPI-FAILOVER] texto falhou por Baileys; tentando Z-API -> ${targetJid} | reason=${error.message}`);
                    await recordZapiFailover({ targetJid, recipientDigits, kind: 'text', reason: error.message, status: 'retrying' });
                    const failover = await sendText(targetJid, finalText, quotedMsg, {
                        ...options,
                        sessionId: 'zapi',
                        provider: 'zapi',
                        zapiFailoverAttempt: true,
                        humanize: false,
                        allowHistoryDedupeBypass: true,
                        outboundContext: `${options.outboundContext || 'auto_text'}_zapi_failover`
                    });
                    await recordZapiFailover({
                        targetJid,
                        recipientDigits,
                        kind: 'text',
                        reason: error.message,
                        status: failoverWasSent(failover) ? 'sent' : 'failed',
                        providerMessageId: failover?.providerMessageId || ''
                    });
                    return failover;
                }
                return options.returnDetails === true
                    ? { ok: false, provider: 'baileys', providerStatus: 'failed', error: error.message }
                    : false;
            }
            await waitForWhatsAppReady(15000, sessionId).catch(() => null);
        }
    }
    return false;
};
