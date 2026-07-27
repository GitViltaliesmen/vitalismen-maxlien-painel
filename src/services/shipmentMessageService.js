import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { sendText } from '../whatsapp/sendText.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendDocument } from '../whatsapp/sendDocument.js';
import { sendImage } from '../whatsapp/sendImage.js';
import { toWhatsAppChatId } from '../utils/phone.js';
import Shipment from '../models/Shipment.js';
import Order from '../models/Order.js';
import Message from '../models/Message.js';
import OutboundDedupe from '../models/OutboundDedupe.js';
import { downloadDroppiEcuadorInvoicePdf } from './droppiEcuadorBrowserService.js';
import { resolveCountryAudio } from './audioTemplateService.js';
import { VIT_POWER_PICKUP_BONUS_TEXT } from './vitPowerEvolvedWorkflow.js';
import { markSenderWalletDelivered } from '../whatsapp/sessionRouter.js';
import { syncOrderToOnlineAdminPanel } from './adminPanelStatusService.js';

const BONUS_URL = process.env.PICKUP_BONUS_URL || 'https://zapgersonecvo.cloud';
const BONUS_TEXT_VARIANTS = [
    `🔥 Un regalo solo para ti...
Un bonus para calentar la noche y preparar la llegada de momentos mas ardientes.
Contenido exclusivo solo para adultos...
Normalmente cuesta $40 al mes, pero para ti, como cliente especial, te lo envio como un bono gratuito.
Solo si estas listo para dejarte llevar...

BONUS: ${BONUS_URL}`,
    `🔥 Tu bonus especial ya esta liberado...
Como ya retiraste tu pedido, te dejo este acceso exclusivo para adultos.
Es un contenido pensado para encender el ambiente y preparar una noche mas intensa.
Normalmente tiene valor mensual de $40, pero hoy va gratis para ti como cliente especial.

BONUS: ${BONUS_URL}`,
    `🎁 Promesa cumplida...
Aqui tienes tu bonus privado, exclusivo para adultos.
Es un regalo para disfrutar con calma, subir el clima y preparar momentos mas ardientes.
Este acceso normalmente cuesta $40 al mes, pero para ti queda liberado sin costo.

BONUS: ${BONUS_URL}`,
    `🔥 Ya puedes entrar a tu regalo...
Este bonus es contenido adulto, reservado solo para clientes especiales.
La idea es ayudarte a crear un clima mas caliente y dejar la noche con otra energia.
Normalmente vale $40 mensuales, pero hoy te lo envio gratis.

BONUS: ${BONUS_URL}`,
    `🎁 Gracias por retirar tu pedido.
Ahora te libero el bonus prometido: un acceso exclusivo para adultos.
Es un contenido especial para calentar el ambiente y preparar momentos mas intensos.
Su valor normal es $40 al mes, pero para ti queda como regalo.

BONUS: ${BONUS_URL}`,
    `🔥 Tu acceso VIP esta listo...
Este bonus es solo para adultos y fue separado como regalo por haber retirado tu pedido.
Usalo cuando quieras crear un clima mas ardiente y dejarte llevar con calma.
Normalmente cuesta $40 al mes, pero para ti va gratuito.

BONUS: ${BONUS_URL}`,
    `🎁 Aqui esta tu bonus gratuito...
Es un contenido adulto, privado y especial para clientes que ya retiraron su producto.
La propuesta es simple: calentar la noche y preparar momentos mas intensos.
Este acceso suele costar $40 mensuales, pero hoy es tu regalo.

BONUS: ${BONUS_URL}`,
    `🔥 Regalo desbloqueado...
Ya que confirmaste el retiro, te envio tu bonus exclusivo para adultos.
Es un extra para subir la temperatura, entrar en el clima y disfrutar sin prisa.
Normalmente tiene costo de $40 al mes, pero para ti queda gratis.

BONUS: ${BONUS_URL}`
];
const PICKUP_BONUS_TEXT_OVERRIDE = process.env.PICKUP_BONUS_TEXT || '';
const SOFT_REMINDER_TEXT = 'Hola, te escribo para recordarte suavemente tu pedido. Si ya lo retiraste o recibiste, me avisas por favor.';
const PREPAID_ONLY_TEXT = 'Hola, como este pedido no fue retirado y termino en devolucion, nuestro sistema ahora solo libera nuevos envios con pago anticipado por tarjeta, boleto o transferencia. Si desea, le envio el valor y le ayudo con ese proceso.';
const SAVE_CONTACT_LINE = 'Por favor guarde/anote este numero como Valeria Zambrano para recibir aqui la guia, el aviso de retiro y su bonus.';
const SHIPMENT_MIN_MESSAGE_GAP_MS = Number.parseInt(process.env.SHIPMENT_MIN_MESSAGE_GAP_MS || '1800000', 10);
const SHIPMENT_AUDIO_DELAY_MIN_MS = Number.parseInt(process.env.SHIPMENT_AUDIO_DELAY_MIN_MS || '7000', 10);
const SHIPMENT_AUDIO_DELAY_MAX_MS = Number.parseInt(process.env.SHIPMENT_AUDIO_DELAY_MAX_MS || '17000', 10);
const SHIPMENT_EC_PICKUP_AUDIO_APPROVED = process.env.SHIPMENT_EC_PICKUP_AUDIO_APPROVED === 'true';
const SHIPMENT_FILES_DIR = path.join(process.cwd(), 'public', 'media', 'shipments');
const GUIDE_PRINT_DIR = path.join(SHIPMENT_FILES_DIR, 'guide-prints');
const DAY_MS = 24 * 60 * 60 * 1000;
const SHIPMENT_PICKUP_REMINDER_MAX_AGE_DAYS = Math.max(6, Number.parseInt(process.env.SHIPMENT_PICKUP_REMINDER_MAX_AGE_DAYS || '10', 10) || 10);
const SHIPMENT_GLOBAL_NOTICE_LOCK_DAYS = Math.max(1, Number.parseInt(process.env.SHIPMENT_GLOBAL_NOTICE_LOCK_DAYS || '10', 10) || 10);
const PICKUP_PROOF_DISPATCH_LOCK_MS = Math.max(
    60_000,
    Number.parseInt(process.env.PICKUP_PROOF_DISPATCH_LOCK_MS || '300000', 10) || 300_000
);
const PICKUP_AUDIO_BY_KIND = {
    guia: 'CONFIRMACION_Y_REGALITO_ESPECIAL',
    ready_for_pickup: process.env.SHIPMENT_PICKUP_READY_AUDIO
        || process.env.SHIPMENT_PICKUP_REMINDER_AUDIO_DAY1
        || 'Chegou_01',
    day3: process.env.SHIPMENT_PICKUP_REMINDER_AUDIO_DAY3 || 'Chegou_02',
    day5: process.env.SHIPMENT_PICKUP_REMINDER_AUDIO_DAY5 || 'Chegou_03'
};
const AUDIO_ONLY_REMINDER_KINDS = new Set(['day3', 'day5']);
const PICKUP_PROOF_TEXT_REGEX = /\b(ya\s+(lo\s+)?(retire|retir[eé]|recogi|recog[ií])|retir[eé]\s+(mi\s+)?pedido|ya\s+tengo\s+(el\s+)?producto|me\s+entregaron|comprobante\s+de\s+retiro|foto\s+del\s+(producto|retiro|comprobante)|guia\s+de\s+retiro)\b/i;
const PICKUP_PROOF_FUTURE_TEXT_REGEX = /\bcuando\s+ya\s+(lo\s+)?(retire|retir[eé]|recoja|recoga|recog[ií])\b/i;

export const isPickupProofText = (text = '') => {
    const body = String(text || '');
    return PICKUP_PROOF_TEXT_REGEX.test(body) && !PICKUP_PROOF_FUTURE_TEXT_REGEX.test(body);
};
const PICKUP_REMINDER_SCHEDULE = [
    { kind: 'day1', field: 'reminderDay1At', days: 1 },
    { kind: 'soft_day2', field: 'reminderSoftDay2At', days: 2 },
    { kind: 'day3', field: 'reminderDay3At', days: 3 },
    { kind: 'soft_day4', field: 'reminderSoftDay4At', days: 4 },
    { kind: 'day5', field: 'reminderDay5At', days: 5 },
    { kind: 'soft_day6', field: 'reminderSoftDay6At', days: 6 }
];
const PICKUP_NOTICE_FIELDS_BY_KIND = {
    ready_for_pickup: 'readyForPickupNotifiedAt',
    day1: 'reminderDay1At',
    soft_day2: 'reminderSoftDay2At',
    day3: 'reminderDay3At',
    soft_day4: 'reminderSoftDay4At',
    day5: 'reminderDay5At',
    soft_day6: 'reminderSoftDay6At'
};
const PICKUP_NOTICE_EVENT_BY_KIND = {
    ready_for_pickup: 'ready_for_pickup_notified',
    day1: 'reminder_day1',
    soft_day2: 'reminder_soft_day2',
    day3: 'reminder_day3',
    soft_day4: 'reminder_soft_day4',
    day5: 'reminder_day5',
    soft_day6: 'reminder_soft_day6'
};
const PICKUP_NOTICE_MESSAGE_PATTERNS_BY_KIND = {
    ready_for_pickup: [
        /\*PEDIDO LISTO PARA RETIRO\*/i,
        /\*PEDIDO PARA RETIRO\*/i,
        /\*SU PEDIDO ESTA EN AGENCIA\*/i,
        /\*AVISO DE RETIRO SERVIENTREGA\*/i,
        /^\[AUDIO\]\s*Chegou_01\b/i
    ],
    day1: [
        /^Hola\. Su pedido esta para retiro en agencia\./i
    ],
    soft_day2: [
        /Si ya retiro, envieme una foto del retiro\./i
    ],
    day3: [
        /^\[AUDIO\]\s*Chegou_02\b/i
    ],
    soft_day4: [
        /Puede acercarse a Servientrega\./i
    ],
    day5: [
        /^\[AUDIO\]\s*Chegou_03\b/i
    ],
    soft_day6: [
        /^Ultimo aviso\. Su pedido sigue para retiro en agencia\./i
    ]
};

const shipmentProductText = (shipment = {}) => [
    shipment?.productName,
    shipment?.raw?.productKey,
    shipment?.raw?.productName,
    shipment?.raw?.latestDroppiPayload?.productName,
    shipment?.raw?.latestDroppiPayload?.productKey
].filter(Boolean).join(' ').toLowerCase();

export const shipmentProductFamily = (shipment = {}) => {
    const value = shipmentProductText(shipment);
    if (/tex[\s_-]*ultra|texultra/.test(value)) return 'tex_ultra';
    if (/nitrix/.test(value)) return 'nitrix';
    if (/vit[\s_-]*power|vitpower/.test(value)) return 'vit_power';
    return 'unknown';
};

export const pickupNoticeMessagePatternsForKind = (kind = '') => (
    PICKUP_NOTICE_MESSAGE_PATTERNS_BY_KIND[kind] || []
);

export const messageMatchesPickupNoticeKind = (message = {}, kind = '') => {
    const body = String(message?.body || '');
    return pickupNoticeMessagePatternsForKind(kind).some((pattern) => pattern.test(body));
};

export const pickupLogisticsAudioForShipment = (_shipment = {}, kind = '') => {
    const configured = PICKUP_AUDIO_BY_KIND[kind];
    return Array.isArray(configured) ? configured.filter(Boolean) : [configured].filter(Boolean);
};

export const pickupHowToUseAudioForShipment = (shipment = {}) => {
    const family = shipmentProductFamily(shipment);
    if (family === 'vit_power') return 'COMO_SE_TOMA_VIT_POWER';
    if (family === 'nitrix') return 'NITRIX_USO_OXIDE_EC';
    return '';
};

const chooseStableVariant = (items, key = '') => {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (list.length === 0) return '';
    const hash = crypto.createHash('sha1').update(String(key || Date.now())).digest('hex');
    const index = Number.parseInt(hash.slice(0, 8), 16) % list.length;
    return list[index];
};

const resolveChatId = (shipment) => toWhatsAppChatId(shipment?.client?.phone || '', shipment?.country || 'EC');

const shipmentPhoneDigits = (shipment = {}) => String(shipment?.client?.phone || '').replace(/\D/g, '');
const shipmentPhoneTailClauses = (shipment = {}) => {
    const digits = shipmentPhoneDigits(shipment);
    const tails = [
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : ''
    ].filter(Boolean);
    return [...new Set(tails)].map((tail) => ({ 'client.phone': { $regex: `${tail}$` } }));
};
const shipmentMessagePhoneClauses = (shipment = {}, chatId = '') => {
    const digits = shipmentPhoneDigits(shipment) || String(chatId || '').replace(/\D/g, '');
    const tails = [
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : ''
    ].filter(Boolean);
    return [...new Set(tails)].flatMap((tail) => ([
        { peerPhone: { $regex: `${tail}$` } },
        { chatId: { $regex: tail } },
        { from: { $regex: tail } }
    ]));
};
const globalNoticeSinceDate = () => new Date(Date.now() - (SHIPMENT_GLOBAL_NOTICE_LOCK_DAYS * DAY_MS));
const noticeRecoveryDate = (value = null) => {
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
};

const shipmentOutboundOptions = (shipment) => ({
    sessionId: shipment?.automation?.sessionId || null,
    country: shipment?.country || 'EC',
    allowExistingDropiOrder: true,
    outboundContext: 'shipment_status'
});

const zapiOwnerPhoneDigits = () => String(
    process.env.ZAPI_PHONE
    || process.env.ZAPI_DEFAULT_PHONE
    || process.env.ZAPI_OPERATION_PHONE
    || process.env.ZAPI_CONNECTED_PHONE
    || process.env.WHATSAPP_DEFAULT_SESSION_ID
).replace(/\D/g, '');

const publicMediaUrlForPath = (filePath = '') => {
    const source = String(filePath || '').trim();
    if (!source) return '';
    if (/^https?:\/\//i.test(source)) return source;
    const publicRoot = path.join(process.cwd(), 'public');
    const cleanSource = source.split('?')[0];
    if (cleanSource.startsWith(publicRoot)) {
        return `/${path.relative(publicRoot, cleanSource).replace(/\\/g, '/')}`;
    }
    return '';
};

const sendResultOk = (result) => result === true || result?.ok === true;

const persistShipmentOutboundMessage = async ({
    shipment,
    chatId,
    kind = 'shipment',
    type = 'chat',
    body = '',
    mediaPath = '',
    sentResult = null
} = {}) => {
    if (!shipment?._id || !chatId || !sendResultOk(sentResult)) return null;
    const now = new Date();
    const providerMessageId = sentResult?.providerMessageId || '';
    const providerZaapId = sentResult?.providerZaapId || '';
    const messageId = providerMessageId
        || providerZaapId
        || `shipment_${kind}_${shipment._id}_${now.getTime()}_${crypto.randomBytes(3).toString('hex')}`;
    const mediaUrl = publicMediaUrlForPath(mediaPath);
    const messageType = type || (mediaUrl ? 'document' : 'chat');
    const hasMedia = Boolean(mediaUrl) || messageType !== 'chat';

    await Message.updateOne(
        { _id: messageId },
        {
            $setOnInsert: {
                _id: messageId,
                chatId,
                peerPhone: shipmentPhoneDigits(shipment),
                from: 'bot',
                to: chatId,
                body: String(body || ''),
                type: messageType,
                hasMedia,
                mediaUrl,
                mediaPreviewUrl: mediaUrl,
                timestamp: Math.floor(now.getTime() / 1000),
                sessionId: sentResult?.provider === 'zapi' ? 'zapi' : (shipment?.automation?.sessionId || ''),
                ownerPhoneDigits: zapiOwnerPhoneDigits(),
                isFromMe: true,
                isBot: true,
                orderId: shipment?.orderId || ''
            },
            $set: {
                ack: 1,
                deliveryStatus: 'sent',
                sendError: '',
                provider: sentResult?.provider || 'zapi',
                providerMessageId,
                providerZaapId,
                providerStatus: sentResult?.providerStatus || 'queued',
                providerPayload: sentResult?.providerPayload || {}
            }
        },
        { upsert: true }
    ).catch((error) => {
        console.warn(`[SHIPMENT] Falha ao registrar bolha ${kind} ${shipment.orderId}:`, error.message);
    });

    return messageId;
};

const sendShipmentText = async (shipment, chatId, text, options = {}) => {
    const sent = await sendText(chatId, text, null, {
        ...shipmentOutboundOptions(shipment),
        ...options,
        returnDetails: true
    });
    if (!sendResultOk(sent)) return false;
    await persistShipmentOutboundMessage({
        shipment,
        chatId,
        kind: options.kind || 'shipment_text',
        type: 'chat',
        body: text,
        sentResult: sent
    });
    return sent;
};

const resolveInvoiceSource = (shipment) => {
    if (shipment?.logistics?.invoicePath && fs.existsSync(shipment.logistics.invoicePath)) {
        return shipment.logistics.invoicePath;
    }
    if (shipment?.logistics?.invoiceUrl) return shipment.logistics.invoiceUrl;
    return '';
};

const ensureShipmentFilesDir = () => {
    if (!fs.existsSync(SHIPMENT_FILES_DIR)) {
        fs.mkdirSync(SHIPMENT_FILES_DIR, { recursive: true });
    }
};

const downloadRemoteInvoiceToLocal = async (shipment) => {
    const remoteUrl = shipment?.logistics?.invoiceUrl || '';
    if (!/^https?:\/\//i.test(remoteUrl)) return '';

    try {
        ensureShipmentFilesDir();
        const response = await fetch(remoteUrl);
        if (!response.ok) {
            console.warn(`[SHIPMENT] Falha ao baixar guia remota (${response.status}) para shipment ${shipment.orderId}`);
            return '';
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (!buffer.length) return '';

        const filename = `${shipment.orderId || 'shipment'}_${shipment.logistics?.trackingNumber || Date.now()}.pdf`;
        const targetPath = path.join(SHIPMENT_FILES_DIR, filename);
        fs.writeFileSync(targetPath, buffer);

        shipment.logistics.invoicePath = targetPath;
        await shipment.save();
        return targetPath;
    } catch (error) {
        console.warn(`[SHIPMENT] Falha ao baixar guia remota para shipment ${shipment.orderId}:`, error.message);
        return '';
    }
};

const ensureInvoiceAvailableLocally = async (shipment) => {
    const currentSource = resolveInvoiceSource(shipment);
    if (currentSource && fs.existsSync(currentSource)) return currentSource;

    let localPath = await downloadRemoteInvoiceToLocal(shipment);
    if (localPath && fs.existsSync(localPath)) return localPath;

    if (shipment?.country === 'EC' && shipment?.provider === 'droppi') {
        const browserDownload = await downloadDroppiEcuadorInvoicePdf({ shipment });
        if (browserDownload?.ok && browserDownload.path && fs.existsSync(browserDownload.path)) {
            return browserDownload.path;
        }
    }

    return localPath;
};

const sendShipmentInvoicePdf = async (shipment, chatId, caption) => {
    const invoiceSource = resolveInvoiceSource(shipment);
    if (!invoiceSource) return { sent: false, reason: 'missing_invoice_source' };

    const localInvoicePath = await ensureInvoiceAvailableLocally(shipment);
    const documentSource = localInvoicePath && fs.existsSync(localInvoicePath) ? localInvoicePath : '';
    if (!documentSource) return { sent: false, reason: 'invoice_unavailable_locally' };

    const sent = await sendDocument(
        chatId,
        documentSource,
        path.basename(String(documentSource).split('?')[0]),
        caption,
        {
            ...shipmentOutboundOptions(shipment),
            outboundContext: 'shipment_invoice_pdf',
            returnDetails: true
        }
    );
    if (sendResultOk(sent)) {
        await persistShipmentOutboundMessage({
            shipment,
            chatId,
            kind: 'shipment_invoice_pdf',
            type: 'document',
            body: caption,
            mediaPath: documentSource,
            sentResult: sent
        });
    }
    return {
        sent: sendResultOk(sent),
        reason: sendResultOk(sent) ? 'ok' : (sent?.reason || sent?.error || 'send_failed'),
        path: documentSource,
        providerMessageId: sent?.providerMessageId || '',
        providerZaapId: sent?.providerZaapId || '',
        providerStatus: sent?.providerStatus || ''
    };
};

const buildMessageHash = ({ kind, text, trackingNumber }) => crypto
    .createHash('sha1')
    .update(`${kind}|${trackingNumber || ''}|${text}`)
    .digest('hex');

const hasAlreadySentHash = (shipment, hash) => Array.isArray(shipment?.automation?.sentMessageHashes)
    && shipment.automation.sentMessageHashes.includes(hash);

const registerSentHash = (shipment, hash) => {
    shipment.automation.sentMessageHashes = Array.isArray(shipment.automation.sentMessageHashes)
        ? shipment.automation.sentMessageHashes
        : [];
    if (!shipment.automation.sentMessageHashes.includes(hash)) {
        shipment.automation.sentMessageHashes.push(hash);
    }
    shipment.automation.sentMessageHashes = shipment.automation.sentMessageHashes.slice(-80);
};

const hasMinGapElapsed = (shipment) => {
    const lastAt = shipment?.automation?.lastReminderAt?.getTime?.() || 0;
    if (!lastAt) return true;
    return (Date.now() - lastAt) >= SHIPMENT_MIN_MESSAGE_GAP_MS;
};

const resolveShipmentAudio = async (shipment, baseName) => {
    if (!baseName) return null;
    const country = shipment?.country || 'EC';
    const primary = await resolveCountryAudio({ country, baseName });
    if (primary && fs.existsSync(primary)) return primary;
    return null;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randomDelayMs = (minMs, maxMs) => {
    const min = Math.max(0, Number(minMs) || 0);
    const max = Math.max(min, Number(maxMs) || min);
    return min + Math.floor(Math.random() * ((max - min) + 1));
};

const registerAudioAttempt = async (shipment, entry) => {
    if (!shipment?._id) return;
    await Shipment.updateOne(
        { _id: shipment._id },
        {
            $set: { 'automation.lastAudioAt': entry.at },
            $push: {
                'automation.sentAudioLog': {
                    $each: [entry],
                    $slice: -120
                }
            }
        }
    );
};

const sendShipmentAudioFile = async (shipment, chatId, audioPath, {
    kind = 'shipment_audio',
    baseName = '',
    dedupeValue = '',
    force = false
} = {}) => {
    const sent = await sendAudio(chatId, audioPath, true, {
        ...shipmentOutboundOptions(shipment),
        ...(dedupeValue ? { dedupeValue } : {}),
        bypassDedupe: force,
        returnDetails: true
    });
    if (!sendResultOk(sent)) return false;
    await persistShipmentOutboundMessage({
        shipment,
        chatId,
        kind,
        type: 'audio',
        body: baseName ? `[AUDIO] ${baseName}` : '',
        mediaPath: audioPath,
        sentResult: sent
    });
    return sent;
};

const sendShipmentAudio = async (shipment, chatId, kind, { force = false } = {}) => {
    const baseNames = pickupLogisticsAudioForShipment(shipment, kind);
    if (!baseNames.length) {
        return {
            sentAny: false,
            requested: [],
            sent: [],
            failed: []
        };
    }

    let sentAny = false;
    const detail = {
        sentAny: false,
        requested: baseNames,
        sent: [],
        failed: []
    };

    for (let index = 0; index < baseNames.length; index += 1) {
        const baseName = baseNames[index];
        if (shipment?.country === 'EC' && !SHIPMENT_EC_PICKUP_AUDIO_APPROVED) {
            console.warn(`[SHIPMENT] Audio ${baseName} bloqueado para EC. Defina SHIPMENT_EC_PICKUP_AUDIO_APPROVED=true apenas depois de validar os audios corretos.`);
            detail.failed.push({ baseName, reason: 'audio_not_approved' });
            await registerAudioAttempt(shipment, {
                kind,
                baseName,
                at: new Date(),
                sent: false,
                reason: 'audio_not_approved'
            });
            continue;
        }

        const audioPath = await resolveShipmentAudio(shipment, baseName);
        if (!audioPath) {
            detail.failed.push({ baseName, reason: 'audio_not_found' });
            await registerAudioAttempt(shipment, {
                kind,
                baseName,
                at: new Date(),
                sent: false,
                reason: 'audio_not_found'
            });
            continue;
        }

        const sent = await sendShipmentAudioFile(shipment, chatId, audioPath, {
            kind: `shipment_audio_${kind}`,
            baseName,
            force
        });
        sentAny = sendResultOk(sent) || sentAny;
        if (sendResultOk(sent)) {
            detail.sent.push(baseName);
            detail.sentDetails = [
                ...(detail.sentDetails || []),
                {
                    baseName,
                    providerMessageId: sent.providerMessageId || '',
                    providerZaapId: sent.providerZaapId || '',
                    providerStatus: sent.providerStatus || ''
                }
            ];
        } else {
            detail.failed.push({ baseName, reason: sent?.reason || sent?.error || 'send_failed' });
        }
        await registerAudioAttempt(shipment, {
            kind,
            baseName,
            at: new Date(),
            sent: sendResultOk(sent),
            reason: sendResultOk(sent) ? 'sent' : 'send_failed',
            sessionId: shipment.automation?.sessionId || null,
            providerMessageId: sent?.providerMessageId || '',
            providerZaapId: sent?.providerZaapId || ''
        });
        if (sendResultOk(sent) && index < baseNames.length - 1) {
            await wait(randomDelayMs(SHIPMENT_AUDIO_DELAY_MIN_MS, SHIPMENT_AUDIO_DELAY_MAX_MS));
        }
    }
    detail.sentAny = sentAny;
    return detail;
};

const isAgencyPickup = (shipment) => Boolean(shipment?.logistics?.agencyPickup);

const shipmentVariantKey = (shipment, kind) => [
    shipment?.logistics?.trackingNumber || '',
    shipment?.client?.phone || '',
    kind
].join('|');

const renderShipmentTextVariant = (variants, shipment, kind, params) => {
    const variant = chooseStableVariant(variants, shipmentVariantKey(shipment, kind));
    return typeof variant === 'function' ? variant(params) : String(variant || '');
};

const withSaveContactReminder = (text = '') => {
    const body = String(text || '').trim();
    if (!body) return SAVE_CONTACT_LINE;
    if (/guarde este numero|guardar este numero|ana - vit power/i.test(body)) return body;
    return `${body}\n\n${SAVE_CONTACT_LINE}`;
};

const pickupAgencyLine = (shipment) => {
    const agency = [
        shipment?.logistics?.agencyName,
        shipment?.client?.address
    ].map((value) => String(value || '').trim()).find(Boolean);
    return agency ? `\nAgencia: ${agency}.` : '';
};

export const buildShipmentGuideText = (shipment) => {
    const name = shipment?.client?.name || 'cliente';
    const tracking = shipment?.logistics?.trackingNumber || '';
    const carrier = shipment?.logistics?.distributionCompany || shipment?.logistics?.chosenCarrier || 'la transportadora';
    if (isAgencyPickup(shipment)) {
        return withSaveContactReminder(renderShipmentTextVariant([
            ({ name, carrier, tracking }) => `Hola ${name} 😊 buenas noticias: su pedido ya fue enviado por ${carrier}. Su guia es ${tracking}. Apenas aparezca disponible en agencia, le aviso por aqui para que pueda retirarlo tranquilo.`,
            ({ name, carrier, tracking }) => `${name}, ya tenemos movimiento de su pedido 📦 Fue enviado por ${carrier} con guia ${tracking}. Ahora solo debe esperar el aviso nuestro o de Servientrega para retirarlo en agencia.`,
            ({ name, carrier, tracking }) => `Listo, ${name} ✅ Su pedido ya salio por ${carrier}. Guia: ${tracking}. Le recomiendo guardar este numero, porque por aqui le aviso cuando este listo para retirar en agencia.`,
            ({ name, carrier, tracking }) => `Hola ${name} 🙌 le confirmo que su pedido ya tiene guia ${tracking} por ${carrier}. Apenas la agencia lo tenga disponible, le escribo para que pase a retirarlo.`
        ], shipment, 'guide_agency', { name, carrier, tracking }));
    }
    return withSaveContactReminder(renderShipmentTextVariant([
        ({ name, carrier, tracking }) => `Hola ${name} 😊 su pedido ya fue enviado por ${carrier}. Su guia es ${tracking}. Por favor este pendiente del telefono cuando la transportadora se comunique para la entrega.`,
        ({ name, carrier, tracking }) => `${name}, buenas noticias 📦 su pedido ya esta en camino por ${carrier}. Guia: ${tracking}. Le aviso por aqui cualquier novedad y tambien puede recibir contacto de la transportadora.`,
        ({ name, carrier, tracking }) => `Listo, ${name} ✅ ya se genero la guia ${tracking} por ${carrier}. Ahora queda atento al telefono para coordinar la entrega en casa.`,
        ({ name, carrier, tracking }) => `Hola ${name} 🙌 le confirmo el envio de su pedido. Transportadora: ${carrier}. Guia: ${tracking}. Si la transportadora llama, por favor responda para evitar retrasos.`
    ], shipment, 'guide_home', { name, carrier, tracking }));
};

export const buildReadyForPickupText = (shipment) => {
    const name = shipment?.client?.name || 'cliente';
    const tracking = shipment?.logistics?.trackingNumber || '';
    const carrier = shipment?.logistics?.distributionCompany || shipment?.logistics?.chosenCarrier || 'la transportadora';
    const agencyLine = pickupAgencyLine(shipment);
    return renderShipmentTextVariant([
        ({ name, tracking, agencyLine }) => `*PEDIDO LISTO PARA RETIRO*\n\nHola ${name}. Su pedido ya esta disponible en agencia Servientrega.\nGuia: *${tracking}*.${agencyLine}\n\nPor favor acerquese con su documento de identidad y esta guia.`,
        ({ name, tracking, agencyLine }) => `*PEDIDO PARA RETIRO*\n\n${name}, ya puede retirar su pedido en Servientrega.\nGuia: *${tracking}*.${agencyLine}\n\nLleve su documento y muestre esta guia en la agencia.`,
        ({ name, tracking, agencyLine }) => `*SU PEDIDO ESTA EN AGENCIA*\n\nListo, ${name}. Servientrega ya lo tiene disponible para retiro.\nGuia: *${tracking}*.${agencyLine}\n\nRetire con su documento de identidad.`,
        ({ name, tracking, agencyLine }) => `*AVISO DE RETIRO SERVIENTREGA*\n\n${name}, su pedido esta listo para retirar.\nGuia: *${tracking}*.${agencyLine}\n\nGuarde este mensaje para mostrarlo en agencia.`
    ], shipment, 'ready_for_pickup', { name, carrier, tracking, agencyLine });
};

export const buildInTransitText = (shipment) => {
    const name = shipment?.client?.name || 'cliente';
    const tracking = shipment?.logistics?.trackingNumber || '';
    const carrier = shipment?.logistics?.distributionCompany || shipment?.logistics?.chosenCarrier || 'la transportadora';
    const trackingLine = tracking ? ` Guia: ${tracking}.` : '';
    if (isAgencyPickup(shipment)) {
        return withSaveContactReminder(renderShipmentTextVariant([
            ({ name, carrier, trackingLine }) => `Hola ${name} 😊 su pedido ya aparece en ruta por ${carrier}.${trackingLine} Apenas este disponible en agencia, le aviso por aqui para que pueda retirarlo tranquilo.`,
            ({ name, carrier, trackingLine }) => `${name}, le confirmo movimiento de su pedido 📦 Ya esta en ruta con ${carrier}.${trackingLine} Cuando la agencia lo libere para retiro, le escribo aqui.`,
            ({ name, carrier, trackingLine }) => `Buenas noticias, ${name} ✅ su pedido ya esta avanzando por ${carrier}.${trackingLine} Guarde este numero porque por aqui le aviso el momento correcto para retirar.`
        ], shipment, 'in_transit_agency', { name, carrier, trackingLine }));
    }
    return withSaveContactReminder(renderShipmentTextVariant([
        ({ name, carrier, trackingLine }) => `Hola ${name} 😊 su pedido ya esta en ruta por ${carrier}.${trackingLine} Por favor este pendiente del telefono cuando la transportadora se comunique para la entrega.`,
        ({ name, carrier, trackingLine }) => `${name}, buenas noticias 📦 su pedido ya tiene movimiento con ${carrier}.${trackingLine} Le aviso por aqui cualquier novedad.`,
        ({ name, carrier, trackingLine }) => `Listo, ${name} ✅ su pedido ya esta en camino por ${carrier}.${trackingLine} Si la transportadora llama, por favor responda para evitar retrasos.`
    ], shipment, 'in_transit_home', { name, carrier, trackingLine }));
};

const buildReminderTextBody = (shipment, kind) => {
    const tracking = shipment?.logistics?.trackingNumber || '';
    const agency = isAgencyPickup(shipment);
    const guideLine = tracking ? ` Guia: ${tracking}.` : '';
    const lightPickupText = `Hola. Su pedido sigue para retiro en agencia.${guideLine}`;
    if (agency && kind === 'day1') {
        return `Hola. Su pedido esta para retiro en agencia.${guideLine}`;
    }
    if (agency && kind === 'soft_day2') {
        return `${lightPickupText}\n\nSi ya retiro, envieme una foto del retiro.`;
    }
    if (agency && kind === 'day3') {
        return '';
    }
    if (agency && kind === 'soft_day4') {
        return `${lightPickupText}\n\nPuede acercarse a Servientrega.`;
    }
    if (agency && kind === 'day5') {
        return '';
    }
    if (agency && kind === 'soft_day6') {
        return `Ultimo aviso. Su pedido sigue para retiro en agencia.${guideLine}`;
    }
    if (kind === 'day1') {
        return `Hola. Su pedido ya esta en camino.${guideLine}`;
    }
    if (kind === 'soft_day2') {
        return `Si ya recibio su pedido, me confirma por favor.${guideLine}`;
    }
    if (kind === 'day3') {
        return `Hola. Este pendiente de la llamada de la transportadora.${guideLine}`;
    }
    if (kind === 'soft_day4') {
        return `Me confirma si ya recibio su pedido?${guideLine}`;
    }
    if (kind === 'day5') {
        return `Ultimo aviso de entrega.${guideLine}`;
    }
    return SOFT_REMINDER_TEXT;
};

export const buildReminderText = (shipment, kind) => buildReminderTextBody(shipment, kind).trim();

export const buildPickupProofText = () => (
    'Perfecto. Envieme una foto del producto o del comprobante de retiro.'
);

export const buildPickupBonusText = (shipment = null) => {
    if (PICKUP_BONUS_TEXT_OVERRIDE.trim()) return withSaveContactReminder(PICKUP_BONUS_TEXT_OVERRIDE.trim());
    if (shipment?.country === 'EC' || !shipment?.country) return withSaveContactReminder(VIT_POWER_PICKUP_BONUS_TEXT);
    return withSaveContactReminder(chooseStableVariant(BONUS_TEXT_VARIANTS, shipment?.orderId || shipment?.logistics?.trackingNumber || ''));
};

export const buildRefillReminderText = (shipment) => {
    const units = Number(shipment?.treatment?.unitsPurchased || 1) || 1;
    const unitsLabel = `${units} frasco${units > 1 ? 's' : ''}`;
    return withSaveContactReminder(`Hola, señor 😊 Vi que compro ${unitsLabel} de Vit Power y ya le tenemos reservada una oferta especial para que pueda completar el tratamiento con tranquilidad.\n\nLe envio tambien una orientacion sobre el tiempo de resultado. Si desea continuar, le ayudo a separar su recompra por aqui.\n\nAl cerrar esta recompra, le voy a liberar un regalo especial para usted.`);
};

export const repurchaseReminderDelayDaysForUnits = (unitsValue = 1) => {
    const units = Math.max(1, Number.parseInt(String(unitsValue || 1), 10) || 1);
    if (units <= 1) return Number.parseInt(process.env.POST_SALE_REPURCHASE_DELAY_DAYS_1 || '25', 10);
    if (units === 2) return Number.parseInt(process.env.POST_SALE_REPURCHASE_DELAY_DAYS_2 || '50', 10);
    return Number.parseInt(process.env.POST_SALE_REPURCHASE_DELAY_DAYS_3 || '70', 10);
};

const appendEvent = async (shipmentId, kind, payload = {}) => {
    await Shipment.updateOne(
        { _id: shipmentId },
        {
            $push: {
                events: {
                    $each: [{
                        kind,
                        at: new Date(),
                        payload
                    }],
                    $slice: -60
                }
            }
        }
    );
};

const appendPartialAttachmentEvents = async (shipmentId, action, parts = {}) => {
    const failures = [];
    if (parts.invoice && parts.invoice.reason && parts.invoice.reason !== 'missing_invoice_source' && parts.invoice.sent !== true) {
        failures.push({
            part: 'invoice_pdf',
            reason: parts.invoice.reason,
            path: parts.invoice.path || ''
        });
    }
    if (parts.audio && Array.isArray(parts.audio.failed) && parts.audio.failed.length) {
        failures.push({
            part: 'audio',
            reason: 'audio_failed',
            failed: parts.audio.failed
        });
    }
    for (const failure of failures) {
        await appendEvent(shipmentId, 'partial_attachment_failed', {
            action,
            ...failure
        });
    }
    return failures;
};

const GUIDE_PRINT_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const GUIDE_PRINT_PDF_EXTENSIONS = new Set(['.pdf']);

const sanitizeGuidePrintPart = (value = '') => String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

const ensureGuidePrintDir = () => {
    if (!fs.existsSync(GUIDE_PRINT_DIR)) {
        fs.mkdirSync(GUIDE_PRINT_DIR, { recursive: true });
    }
};

const guidePrintPublicUrl = (filePath = '') => {
    const normalized = String(filePath || '').split(path.sep).join('/');
    const marker = '/public/';
    const index = normalized.indexOf(marker);
    if (index >= 0) return `/${normalized.slice(index + marker.length)}`;
    return `/media/shipments/guide-prints/${path.basename(filePath)}`;
};

const guidePrintOutputPathForShipment = (shipment = {}) => {
    ensureGuidePrintDir();
    const order = sanitizeGuidePrintPart(shipment.orderId || 'shipment');
    const tracking = sanitizeGuidePrintPart(shipment?.logistics?.trackingNumber || Date.now());
    return path.join(GUIDE_PRINT_DIR, `${order}_${tracking}.png`);
};

const isImageSource = (source = '') => GUIDE_PRINT_IMAGE_EXTENSIONS.has(path.extname(String(source).split('?')[0]).toLowerCase());
const isPdfSource = (source = '') => GUIDE_PRINT_PDF_EXTENSIONS.has(path.extname(String(source).split('?')[0]).toLowerCase());

const optimizeGuidePrintImage = async (inputPath, outputPath) => {
    try {
        const sharpModule = await import('sharp');
        const sharp = sharpModule.default || sharpModule;
        await sharp(inputPath)
            .rotate()
            .resize({ width: 1100, withoutEnlargement: true })
            .png({ compressionLevel: 9, adaptiveFiltering: true })
            .toFile(outputPath);
        return true;
    } catch (error) {
        if (inputPath !== outputPath) {
            fs.copyFileSync(inputPath, outputPath);
        }
        return false;
    }
};

const runProcess = (command, args = []) => new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => resolve({ ok: false, error: error.message }));
    child.on('close', (code) => resolve({ ok: code === 0, code, error: stderr.trim() }));
});

const renderPdfWithPdftoppm = async (pdfPath, outputPath) => {
    const outputPrefix = outputPath.replace(/\.png$/i, '');
    const generatedPath = `${outputPrefix}.png`;
    const result = await runProcess('pdftoppm', [
        '-png',
        '-singlefile',
        '-f',
        '1',
        '-l',
        '1',
        '-r',
        '180',
        pdfPath,
        outputPrefix
    ]);
    if (!result.ok || !fs.existsSync(generatedPath)) {
        return { ok: false, reason: result.error || 'pdftoppm_failed' };
    }
    if (generatedPath !== outputPath) {
        fs.renameSync(generatedPath, outputPath);
    }
    return { ok: true };
};

const renderPdfFirstPageToImage = async (pdfPath, outputPath) => {
    const popplerResult = await renderPdfWithPdftoppm(pdfPath, outputPath).catch((error) => ({
        ok: false,
        reason: error?.message || 'pdftoppm_failed'
    }));
    if (popplerResult.ok) return;

    const playwright = await import('playwright');
    const chromium = playwright.chromium || playwright.default?.chromium;
    if (!chromium) throw new Error('playwright_chromium_unavailable');

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
        const page = await browser.newPage({
            viewport: { width: 900, height: 1300 },
            deviceScaleFactor: 2
        });
        const fileUrl = `file://${path.resolve(pdfPath).split(path.sep).join('/')}`;
        await page.setContent(`
            <html>
              <body style="margin:0;background:#fff;overflow:hidden;">
                <embed src="${fileUrl}" type="application/pdf" style="display:block;width:900px;height:1300px;border:0;background:#fff;" />
              </body>
            </html>
        `, { waitUntil: 'load' });
        await page.waitForTimeout(1800);
        await page.screenshot({ path: outputPath, type: 'png', fullPage: false });
    } finally {
        await browser.close().catch(() => null);
    }
};

export const ensureGuidePrintImage = async (shipment, { force = false } = {}) => {
    if (!shipment?._id) {
        return { ok: false, reason: 'invalid_shipment' };
    }

    const existingPath = shipment?.logistics?.guidePrintPath || '';
    if (!force && existingPath && fs.existsSync(existingPath)) {
        return {
            ok: true,
            path: existingPath,
            url: shipment.logistics.guidePrintUrl || guidePrintPublicUrl(existingPath),
            generated: false
        };
    }

    const now = new Date();
    const outputPath = guidePrintOutputPathForShipment(shipment);
    const tempPath = outputPath.replace(/\.png$/i, `.tmp-${Date.now()}.png`);

    try {
        const invoiceSource = resolveInvoiceSource(shipment);
        if (!invoiceSource) {
            throw new Error('missing_invoice_source');
        }

        let sourcePath = invoiceSource && fs.existsSync(invoiceSource) ? invoiceSource : '';
        if (!sourcePath) {
            sourcePath = await ensureInvoiceAvailableLocally(shipment);
        }
        if (!sourcePath || !fs.existsSync(sourcePath)) {
            throw new Error('invoice_unavailable_locally');
        }

        if (isImageSource(sourcePath)) {
            await optimizeGuidePrintImage(sourcePath, outputPath);
        } else if (isPdfSource(sourcePath) || !isImageSource(sourcePath)) {
            await renderPdfFirstPageToImage(sourcePath, tempPath);
            await optimizeGuidePrintImage(tempPath, outputPath);
        }

        if (!fs.existsSync(outputPath)) {
            throw new Error('guide_print_not_created');
        }

        const publicUrl = guidePrintPublicUrl(outputPath);
        shipment.logistics.guidePrintPath = outputPath;
        shipment.logistics.guidePrintUrl = publicUrl;
        shipment.automation.guidePrintLastAttemptAt = now;
        shipment.automation.guidePrintLastError = '';
        await shipment.save();
        await appendEvent(shipment._id, 'guide_print_generated', {
            trackingNumber: shipment.logistics?.trackingNumber || '',
            sourcePath,
            guidePrintPath: outputPath,
            guidePrintUrl: publicUrl
        });
        return { ok: true, path: outputPath, url: publicUrl, generated: true };
    } catch (error) {
        const reason = error?.message || 'guide_print_failed';
        await Shipment.updateOne(
            { _id: shipment._id },
            {
                $set: {
                    'automation.guidePrintLastAttemptAt': now,
                    'automation.guidePrintLastError': reason
                }
            }
        );
        await appendEvent(shipment._id, 'guide_print_generation_failed', {
            trackingNumber: shipment?.logistics?.trackingNumber || '',
            reason
        });
        return { ok: false, reason };
    } finally {
        if (fs.existsSync(tempPath)) {
            fs.rmSync(tempPath, { force: true });
        }
    }
};

export const notifyGuidePrintImage = async (shipment, { force = false } = {}) => {
    const chatId = resolveChatId(shipment);
    if (!chatId) return { success: false, imageSent: false, reason: 'invalid_chat' };
    if (!force && shipment?.automation?.guidePrintNotifiedAt) {
        return { success: false, imageSent: false, reason: 'already_notified' };
    }

    const image = await ensureGuidePrintImage(shipment, { force: false });
    if (!image.ok || !image.path) {
        return { success: false, imageSent: false, reason: image.reason || 'guide_print_unavailable' };
    }

    const existingGuidePrintMessage = !force
        ? await Message.findOne({
            orderId: shipment?.orderId || '',
            isFromMe: true,
            isBot: true,
            type: 'image',
            $or: [
                { mediaUrl: image.url || '' },
                { mediaUrl: shipment?.logistics?.guidePrintUrl || '' }
            ].filter((item) => Object.values(item)[0])
        }).sort({ createdAt: -1 }).lean().catch(() => null)
        : null;
    if (existingGuidePrintMessage) {
        const recoveredAt = existingGuidePrintMessage.createdAt || new Date();
        await Shipment.updateOne(
            { _id: shipment._id },
            {
                $set: {
                    'automation.guidePrintNotifiedAt': recoveredAt,
                    'automation.guidePrintLastAttemptAt': new Date(),
                    'automation.guidePrintLastError': '',
                    'automation.lastReminderAt': shipment?.automation?.lastReminderAt || recoveredAt,
                    'automation.lastReminderKind': shipment?.automation?.lastReminderKind || 'guide_print'
                }
            }
        );
        await appendEvent(shipment._id, 'guide_print_recovered_existing_message', {
            trackingNumber: shipment?.logistics?.trackingNumber || '',
            guidePrintUrl: image.url || '',
            messageId: existingGuidePrintMessage._id || ''
        });
        return {
            success: false,
            imageSent: false,
            reason: 'already_notified_existing_message',
            guidePrintUrl: image.url || ''
        };
    }

    const sent = await sendImage(chatId, image.path, '', {
        ...shipmentOutboundOptions(shipment),
        outboundContext: 'shipment_guide_print',
        returnDetails: true,
        bypassDedupe: force
    });
    if (!sent?.ok) {
        const reason = sent?.error || sent?.reason || 'image_send_failed';
        await Shipment.updateOne(
            { _id: shipment._id },
            {
                $set: {
                    'automation.guidePrintLastAttemptAt': new Date(),
                    'automation.guidePrintLastError': reason
                }
            }
        );
        await appendEvent(shipment._id, 'guide_print_failed', {
            trackingNumber: shipment?.logistics?.trackingNumber || '',
            guidePrintUrl: image.url || '',
            reason
        });
        return { success: false, imageSent: false, reason };
    }

    const now = new Date();
    const providerMessageId = sent.providerMessageId || sent.providerZaapId || `guide_print_${shipment._id}_${now.getTime()}`;
    const peerPhone = shipmentPhoneDigits(shipment);
    await Message.updateOne(
        { _id: providerMessageId },
        {
            $setOnInsert: {
                _id: providerMessageId,
                chatId,
                peerPhone,
                from: 'bot',
                to: chatId,
                body: '',
                type: 'image',
                hasMedia: true,
                mediaUrl: image.url || '',
                timestamp: Math.floor(now.getTime() / 1000),
                sessionId: shipment?.automation?.sessionId || zapiOwnerPhoneDigits(),
                ownerPhoneDigits: zapiOwnerPhoneDigits(),
                isFromMe: true,
                isBot: true,
                orderId: shipment?.orderId || ''
            },
            $set: {
                ack: 1,
                deliveryStatus: 'sent',
                sendError: '',
                provider: sent.provider || 'zapi',
                providerMessageId: sent.providerMessageId || '',
                providerZaapId: sent.providerZaapId || '',
                providerStatus: sent.providerStatus || 'queued',
                providerPayload: sent.providerPayload || {}
            }
        },
        { upsert: true }
    ).catch((error) => {
        console.warn(`[SHIPMENT] Falha ao registrar bolha do print da guia ${shipment.orderId}:`, error.message);
    });
    await Shipment.updateOne(
        { _id: shipment._id },
        {
            $set: {
                'automation.guidePrintNotifiedAt': now,
                'automation.guidePrintLastAttemptAt': now,
                'automation.guidePrintLastError': '',
                'automation.lastReminderAt': now,
                'automation.lastReminderKind': 'guide_print'
            }
        }
    );
    await appendEvent(shipment._id, 'guide_print_notified', {
        trackingNumber: shipment?.logistics?.trackingNumber || '',
        guidePrintUrl: image.url || '',
        provider: sent.provider || '',
        providerMessageId: sent.providerMessageId || '',
        providerZaapId: sent.providerZaapId || '',
        providerStatus: sent.providerStatus || ''
    });
    return {
        success: true,
        imageSent: true,
        reason: 'ok',
        guidePrintUrl: image.url || '',
        provider: sent.provider || '',
        providerMessageId: sent.providerMessageId || '',
        providerZaapId: sent.providerZaapId || ''
    };
};

const existingOutboundMessageQuery = (chatId, patterns = []) => {
    const digits = String(chatId || '').replace(/\D/g, '');
    const chatIds = [chatId];
    if (digits) {
        chatIds.push(`${digits}@s.whatsapp.net`, `${digits}@c.us`);
        if (digits.length >= 9) chatIds.push(new RegExp(`${digits.slice(-9)}`));
    }
    return {
        $or: [{ fromMe: true }, { isFromMe: true }, { from: 'bot' }],
        chatId: { $in: [...new Set(chatIds.filter(Boolean))] },
        ...(patterns.length ? { $and: patterns.map((pattern) => ({ body: pattern })) } : {})
    };
};

const findExistingPickupBonusMessage = async (chatId, { since = null } = {}) => Message.findOne({
    ...existingOutboundMessageQuery(chatId, [
    /bonus|regalo/i,
    /zapgersonecvo\.cloud|contenido|gratis/i
    ]),
    ...(since ? { createdAt: { $gte: since } } : {})
}).sort({ createdAt: -1 }).lean().catch(() => null);

const findExistingPickupBonusDedupe = async (chatId, { since = null } = {}) => {
    const digits = String(chatId || '').replace(/\D/g, '');
    const tails = [
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : ''
    ].filter(Boolean);
    if (!tails.length) return null;

    return OutboundDedupe.findOne({
        kind: 'text',
        status: 'sent',
        label: /bonus|regalo|zapgersonecvo\.cloud|contenido exclusivo/i,
        ...(since ? { $or: [
            { sentAt: { $gte: since } },
            { updatedAt: { $gte: since } },
            { createdAt: { $gte: since } }
        ] } : {}),
        ...(since
            ? { $and: [{ $or: [...new Set(tails)].map((tail) => ({ phoneDigits: { $regex: `${tail}$` } })) }] }
            : { $or: [...new Set(tails)].map((tail) => ({ phoneDigits: { $regex: `${tail}$` } })) })
    }).sort({ updatedAt: -1, createdAt: -1 }).lean().catch(() => null);
};

const deliveredReferenceDate = (shipment = {}) => {
    const candidates = [
        shipment.automation?.deliveredConfirmedAt,
        shipment.logistics?.lastStatusAt,
        ...(Array.isArray(shipment.events)
            ? shipment.events
                .filter((event) => /delivered|entregado|pickup_bonus|pickup_confirmed/i.test(String(event?.kind || '')))
                .map((event) => event.at)
            : []),
        shipment.updatedAt
    ];
    for (const value of candidates) {
        const parsed = value ? new Date(value) : null;
        if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
};

const findExistingGlobalShipmentNotice = async ({ shipment, chatId, kind }) => {
    const trackingNumber = String(shipment?.logistics?.trackingNumber || '').trim();
    const phoneClauses = shipmentPhoneTailClauses(shipment);
    const messagePhoneClauses = shipmentMessagePhoneClauses(shipment, chatId);
    const field = PICKUP_NOTICE_FIELDS_BY_KIND[kind];
    const eventKind = PICKUP_NOTICE_EVENT_BY_KIND[kind];
    const since = globalNoticeSinceDate();
    if (!trackingNumber || !field || !phoneClauses.length) return null;

    const shipmentNoticeClauses = [];
    if (eventKind) {
        shipmentNoticeClauses.push({
            events: {
                $elemMatch: {
                    kind: eventKind,
                    at: { $gte: since },
                    'payload.recoveredFromExistingNotice': { $ne: true }
                }
            }
        });
    }
    if (!shipmentNoticeClauses.length) return null;

    const existingShipment = await Shipment.findOne({
        _id: { $ne: shipment._id },
        country: shipment.country || 'EC',
        'logistics.trackingNumber': trackingNumber,
        $and: [
            { $or: phoneClauses },
            { $or: shipmentNoticeClauses }
        ]
    }).sort({ updatedAt: -1, createdAt: -1 }).lean().catch(() => null);
    if (existingShipment) {
        const existingAt = existingShipment.events?.find?.((event) => (
            event?.kind === eventKind
            && event?.payload?.recoveredFromExistingNotice !== true
        ))?.at
            || existingShipment.updatedAt
            || existingShipment.createdAt;
        return {
            source: 'shipment_global_notice',
            orderId: existingShipment.orderId || '',
            trackingNumber,
            at: noticeRecoveryDate(existingAt)
        };
    }

    if (!messagePhoneClauses.length) return null;
    const messagePatterns = pickupNoticeMessagePatternsForKind(kind);
    if (!messagePatterns.length) return null;
    const existingMessage = await Message.findOne({
        $and: [
            { $or: [{ fromMe: true }, { isFromMe: true }, { from: 'bot' }] },
            { $or: messagePhoneClauses },
            { createdAt: { $gte: since } },
            { $or: messagePatterns.map((pattern) => ({ body: pattern })) }
        ]
    }).sort({ createdAt: -1 }).lean().catch(() => null);
    if (!existingMessage) return null;
    return {
        source: 'message_global_notice',
        messageId: existingMessage._id || '',
        trackingNumber,
        at: noticeRecoveryDate(existingMessage.createdAt || existingMessage.timestamp)
    };
};

const persistAutomationUpdate = async (shipmentId, setFields = {}, hash = '') => {
    const update = {
        ...(Object.keys(setFields).length ? { $set: setFields } : {})
    };

    if (hash) {
        update.$push = {
            'automation.sentMessageHashes': {
                $each: [hash],
                $slice: -80
            }
        };
    }

    await Shipment.updateOne({ _id: shipmentId }, update);
};

const recoverExistingGlobalShipmentNotice = async ({ shipment, kind, hash, existing }) => {
    const field = PICKUP_NOTICE_FIELDS_BY_KIND[kind];
    const eventKind = PICKUP_NOTICE_EVENT_BY_KIND[kind] || `notice_${kind}_recovered`;
    if (!field || !existing) return false;
    const recoveredAt = noticeRecoveryDate(existing.at);
    const setFields = {
        [`automation.${field}`]: recoveredAt,
        'automation.lastReminderAt': recoveredAt,
        'automation.lastReminderKind': kind,
        'automation.lastGlobalNoticeRecoveryAt': new Date(),
        'automation.lastGlobalNoticeRecoveryReason': existing.source || 'global_notice_lock'
    };
    if (kind === 'ready_for_pickup') {
        setFields['automation.guiaNotifiedAt'] = shipment.automation?.guiaNotifiedAt || recoveredAt;
    }
    await persistAutomationUpdate(shipment._id, setFields, hash);
    await appendEvent(shipment._id, eventKind, {
        recoveredFromExistingNotice: true,
        source: existing.source || '',
        sourceOrderId: existing.orderId || '',
        sourceMessageId: existing.messageId || '',
        trackingNumber: existing.trackingNumber || shipment.logistics?.trackingNumber || ''
    });
    console.warn(`[SHIPMENT] aviso duplicado bloqueado por trava global -> order=${shipment.orderId} tracking=${shipment.logistics?.trackingNumber || ''} kind=${kind} source=${existing.source || 'global'}`);
    return true;
};


export const notifyShipmentGuideGenerated = async (shipment, { force = false } = {}) => {
    const chatId = resolveChatId(shipment);
    if (!chatId || (!force && shipment.automation.guiaNotifiedAt)) {
        return { success: false, textSent: false, invoiceSent: false, reason: 'already_notified_or_invalid_chat' };
    }
    const text = buildShipmentGuideText(shipment);
    const hash = buildMessageHash({
        kind: 'guia',
        text,
        trackingNumber: shipment.logistics.trackingNumber
    });
    if (!force && hasAlreadySentHash(shipment, hash)) {
        return { success: false, textSent: false, invoiceSent: false, reason: 'duplicate_hash' };
    }
    if (!force && !hasMinGapElapsed(shipment)) {
        return { success: false, textSent: false, invoiceSent: false, reason: 'min_gap_not_elapsed' };
    }

    const textSent = await sendShipmentText(shipment, chatId, text, {
        kind: 'shipment_guide_text',
        bypassDedupe: force
    });
    if (!textSent) {
        return { success: false, textSent: false, invoiceSent: false, reason: 'text_send_failed' };
    }

    const invoiceResult = await sendShipmentInvoicePdf(
        shipment,
        chatId,
        `Guia/factura PDF de su pedido${shipment.logistics?.trackingNumber ? ` ${shipment.logistics.trackingNumber}` : ''}. Guarde este archivo junto con el aviso de envio.`
    );
    const invoiceSent = invoiceResult.sent;
    if (invoiceResult.reason !== 'missing_invoice_source' && !invoiceSent) {
        console.warn(`[SHIPMENT] Falha ao enviar fatura PDF para shipment ${shipment.orderId}: ${invoiceResult.reason}`);
    }
    const guideAudioSent = await sendShipmentAudio(shipment, chatId, 'guia', { force });
    const partialAttachmentFailures = await appendPartialAttachmentEvents(shipment._id, 'guide', {
        invoice: invoiceResult,
        audio: guideAudioSent
    });

    const now = new Date();
    await persistAutomationUpdate(shipment._id, {
        'automation.guiaNotifiedAt': now,
        'automation.lastReminderAt': now,
        'automation.lastReminderKind': 'guia'
    }, hash);
    await appendEvent(shipment._id, 'guia_notified', {
        trackingNumber: shipment.logistics.trackingNumber,
        audio: guideAudioSent,
        invoiceSent,
        invoiceReason: invoiceResult.reason,
        primaryTextSent: true,
        partialAttachmentFailures
    });
    return {
        success: true,
        textSent: true,
        invoiceSent,
        partialAttachmentFailures,
        reason: 'ok'
    };
};

export const notifyReadyForPickup = async (shipment, { force = false } = {}) => {
    const chatId = resolveChatId(shipment);
    if (!chatId || (!force && shipment.automation.readyForPickupNotifiedAt)) return false;
    const text = buildReadyForPickupText(shipment);
    const hash = buildMessageHash({
        kind: 'ready_for_pickup',
        text,
        trackingNumber: shipment.logistics.trackingNumber
    });
    if (!force && hasAlreadySentHash(shipment, hash)) return false;
    if (!force) {
        const existingNotice = await findExistingGlobalShipmentNotice({ shipment, chatId, kind: 'ready_for_pickup' });
        if (existingNotice) {
            return recoverExistingGlobalShipmentNotice({
                shipment,
                kind: 'ready_for_pickup',
                hash,
                existing: existingNotice
            });
        }
    }
    if (!force && !hasMinGapElapsed(shipment)) return false;

    const sent = await sendShipmentText(shipment, chatId, text, {
        kind: 'shipment_ready_for_pickup_text',
        bypassDedupe: force
    });
    if (!sent) return false;
    const invoiceResult = await sendShipmentInvoicePdf(
        shipment,
        chatId,
        `Guia/factura PDF para retirar su pedido${shipment.logistics?.trackingNumber ? ` ${shipment.logistics.trackingNumber}` : ''} en Servientrega.`
    );
    if (invoiceResult.reason !== 'missing_invoice_source' && !invoiceResult.sent) {
        console.warn(`[SHIPMENT] Falha ao reenviar fatura no aviso de retirada ${shipment.orderId}: ${invoiceResult.reason}`);
    }
    const audioSent = await sendShipmentAudio(shipment, chatId, 'ready_for_pickup', { force });
    const partialAttachmentFailures = await appendPartialAttachmentEvents(shipment._id, 'ready_for_pickup', {
        invoice: invoiceResult,
        audio: audioSent
    });

    const now = new Date();
    await persistAutomationUpdate(shipment._id, {
        'automation.guiaNotifiedAt': shipment.automation?.guiaNotifiedAt || now,
        'automation.readyForPickupNotifiedAt': now,
        'automation.lastReminderAt': now,
        'automation.lastReminderKind': 'ready_for_pickup'
    }, hash);
    await appendEvent(shipment._id, 'ready_for_pickup_notified', {
        audio: audioSent,
        shortNotice: true,
        invoiceSent: invoiceResult.sent,
        invoiceReason: invoiceResult.reason,
        primaryTextSent: true,
        partialAttachmentFailures
    });
    return true;
};

export const notifyShipmentInTransit = async (shipment) => {
    const chatId = resolveChatId(shipment);
    if (!chatId || shipment.automation.inTransitNotifiedAt) return false;
    const text = buildInTransitText(shipment);
    const hash = buildMessageHash({
        kind: 'in_transit',
        text,
        trackingNumber: shipment.logistics.trackingNumber
    });
    if (hasAlreadySentHash(shipment, hash)) return false;
    if (!hasMinGapElapsed(shipment)) return false;

    const sent = await sendShipmentText(shipment, chatId, text, {
        kind: 'shipment_in_transit_text'
    });
    if (!sent) return false;

    const now = new Date();
    await persistAutomationUpdate(shipment._id, {
        'automation.inTransitNotifiedAt': now,
        'automation.lastReminderAt': now,
        'automation.lastReminderKind': 'in_transit'
    }, hash);
    await appendEvent(shipment._id, 'in_transit_notified', {
        status: shipment.logistics?.status || '',
        trackingNumber: shipment.logistics?.trackingNumber || ''
    });
    return true;
};

export const notifyShipmentReminder = async (shipment, kind) => {
    const chatId = resolveChatId(shipment);
    if (!chatId) return false;
    const text = buildReminderText(shipment, kind);
    const audioOnly = AUDIO_ONLY_REMINDER_KINDS.has(kind) && isAgencyPickup(shipment);
    const hash = buildMessageHash({
        kind,
        text: audioOnly ? `audio:${PICKUP_AUDIO_BY_KIND[kind] || kind}` : text,
        trackingNumber: shipment.logistics.trackingNumber
    });
    if (hasAlreadySentHash(shipment, hash)) return false;
    const existingNotice = await findExistingGlobalShipmentNotice({ shipment, chatId, kind });
    if (existingNotice) {
        return recoverExistingGlobalShipmentNotice({
            shipment,
            kind,
            hash,
            existing: existingNotice
        });
    }
    if (!hasMinGapElapsed(shipment)) return false;

    let sent = true;
    if (!audioOnly) {
        sent = await sendShipmentText(shipment, chatId, text, {
            kind: `shipment_reminder_${kind}_text`
        });
        if (!sent) return false;
    }
    const audioSent = await sendShipmentAudio(shipment, chatId, kind);
    if (audioOnly && !audioSent?.sentAny) return false;

    const now = new Date();
    const setFields = {
        'automation.lastReminderAt': now,
        'automation.lastReminderKind': kind
    };
    if (kind === 'day1') setFields['automation.reminderDay1At'] = now;
    if (kind === 'soft_day2') setFields['automation.reminderSoftDay2At'] = now;
    if (kind === 'day3') setFields['automation.reminderDay3At'] = now;
    if (kind === 'soft_day4') setFields['automation.reminderSoftDay4At'] = now;
    if (kind === 'day5') setFields['automation.reminderDay5At'] = now;
    if (kind === 'soft_day6') setFields['automation.reminderSoftDay6At'] = now;
    await persistAutomationUpdate(shipment._id, setFields, hash);
    await appendEvent(shipment._id, `reminder_${kind}`, { audio: audioSent, audioOnly });
    return true;
};

export const notifyShipmentReturned = async (shipment) => {
    const chatId = resolveChatId(shipment);
    if (!chatId || shipment.automation.returnedNotifiedAt) return false;
    const returnedText = withSaveContactReminder(PREPAID_ONLY_TEXT);
    const hash = buildMessageHash({
        kind: 'returned',
        text: returnedText,
        trackingNumber: shipment.logistics.trackingNumber
    });
    if (hasAlreadySentHash(shipment, hash)) return false;
    if (!hasMinGapElapsed(shipment)) return false;

    const sent = await sendShipmentText(shipment, chatId, returnedText, {
        kind: 'shipment_returned_text'
    });
    if (!sent) return false;

    const now = new Date();
    await Shipment.updateOne(
        { _id: shipment._id },
        {
            $set: {
                'outcomes.returned': true,
                'outcomes.prepaidOnly': true,
                'review.manualOnly': true,
                'review.reviewStatus': 'prepaid_only_required',
                'review.reviewReason': 'previous_order_not_picked_up',
                'automation.returnedNotifiedAt': now,
                'automation.prepaidOnlyNotifiedAt': now
            },
            $push: {
                'automation.sentMessageHashes': {
                    $each: [hash],
                    $slice: -80
                }
            }
        }
    );
    await appendEvent(shipment._id, 'returned_notified', {
        customerRestriction: 'prepaid_only_required'
    });
    return true;
};

export const notifyPickupProofRequest = async (shipment) => {
    const chatId = resolveChatId(shipment);
    if (!chatId) return false;

    const text = buildPickupProofText();
    const hash = buildMessageHash({
        kind: 'pickup_proof_request',
        text,
        trackingNumber: shipment.logistics.trackingNumber
    });
    if (hasAlreadySentHash(shipment, hash)) return false;
    if (!hasMinGapElapsed(shipment)) return false;

    const sent = await sendShipmentText(shipment, chatId, text, {
        kind: 'shipment_pickup_proof_request_text'
    });
    if (!sent) return false;

    const now = new Date();
    await persistAutomationUpdate(shipment._id, {
        'automation.pickupProofRequestedAt': now,
        'automation.lastReminderAt': now,
        'automation.lastReminderKind': 'pickup_proof_request'
    }, hash);
    await appendEvent(shipment._id, 'pickup_proof_requested');
    return true;
};

export const notifyPickupBonus = async (shipment) => {
    const chatId = resolveChatId(shipment);
    if (!chatId || shipment.automation.bonusNotifiedAt) return false;

    const text = buildPickupBonusText(shipment);
    const bonusDedupeScope = [
        'pickup_bonus',
        shipment.orderId || '',
        shipment.logistics?.trackingNumber || ''
    ].filter(Boolean).join('|');
    const hash = buildMessageHash({
        kind: 'pickup_bonus',
        text,
        trackingNumber: shipment.logistics.trackingNumber
    });
    const deliveredAt = deliveredReferenceDate(shipment);
    const existingBonus = deliveredAt
        ? (await findExistingPickupBonusMessage(chatId, { since: deliveredAt })
            || await findExistingPickupBonusDedupe(chatId, { since: deliveredAt }))
        : null;
    if (existingBonus) {
        const now = new Date();
        const existingAt = existingBonus.createdAt || existingBonus.updatedAt || now;
        await persistAutomationUpdate(shipment._id, {
            'automation.bonusNotifiedAt': existingAt,
            'automation.lastReminderAt': existingAt,
            'automation.lastReminderKind': 'pickup_bonus'
        }, hash);
        await appendEvent(shipment._id, 'pickup_bonus_notified', {
            bonusUrl: BONUS_URL,
            recoveredFromExistingMessage: true,
            messageId: existingBonus._id || '',
            messageAt: existingAt || null,
            source: existingBonus.kind ? 'outbound_dedupe' : 'message'
        });
        return true;
    }
    if (hasAlreadySentHash(shipment, hash)) return false;

    const thankYouAudioPath = await resolveCountryAudio({ country: shipment.country || 'EC', baseName: 'OBRIGADO_PAGOU' });
    const thankYouAudioSent = thankYouAudioPath
        ? await sendShipmentAudioFile(shipment, chatId, thankYouAudioPath, {
            kind: 'shipment_pickup_bonus_thank_you_audio',
            baseName: 'OBRIGADO_PAGOU',
            dedupeValue: `${thankYouAudioPath}|${bonusDedupeScope}`
        })
        : false;

    const sent = await sendShipmentText(shipment, chatId, text, {
        kind: 'shipment_pickup_bonus_text',
        dedupeValue: `${text}|${bonusDedupeScope}`
    });
    if (!sent) return false;
    const howToUseAudioBaseName = pickupHowToUseAudioForShipment(shipment);
    const howToUseAudioPath = howToUseAudioBaseName
        ? await resolveCountryAudio({ country: shipment.country || 'EC', baseName: howToUseAudioBaseName })
        : '';
    const howToUseAudioSent = howToUseAudioPath
        ? await sendShipmentAudioFile(shipment, chatId, howToUseAudioPath, {
            kind: 'shipment_pickup_bonus_how_to_use_audio',
            baseName: howToUseAudioBaseName,
            dedupeValue: `${howToUseAudioPath}|${bonusDedupeScope}`
        })
        : false;

    const now = new Date();
    await persistAutomationUpdate(shipment._id, {
        'automation.bonusNotifiedAt': now,
        'automation.lastReminderAt': now,
        'automation.lastReminderKind': 'pickup_bonus'
    }, hash);
    await appendEvent(shipment._id, 'pickup_bonus_notified', { bonusUrl: BONUS_URL, thankYouAudioSent, howToUseAudioSent });
    return true;
};

const calculateTreatmentDates = (shipment, pickedAt) => {
    const units = Number(shipment.treatment?.unitsPurchased || 1) || 1;
    const daysPerUnit = Number(shipment.treatment?.daysPerUnit || 30) || 30;
    const treatmentEndsAt = new Date(pickedAt.getTime() + (units * daysPerUnit * 24 * 60 * 60 * 1000));
    const refillReminderDueAt = new Date(pickedAt.getTime() + (repurchaseReminderDelayDaysForUnits(units) * DAY_MS));
    return { treatmentEndsAt, refillReminderDueAt };
};

const phoneQueryForChatId = (chatId) => {
    const digits = String(chatId || '').replace(/\D/g, '');
    const tails = [
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : ''
    ].filter(Boolean);

    return [...new Set(tails)].map((tail) => ({
        'client.phone': { $regex: `${tail}$` }
    }));
};

const digitsOnlyForShipment = (value = '') => String(value || '').replace(/\D/g, '');

const findOrderForPickupShipment = async (shipment = {}) => {
    const direct = await Order.findOne({ orderId: shipment.orderId }).catch(() => null);
    if (direct) return direct;

    const trackingNumber = String(shipment.logistics?.trackingNumber || '').trim();
    const phoneDigits = digitsOnlyForShipment(shipment.client?.phone);
    if (!trackingNumber || phoneDigits.length < 8) return null;

    const phoneTail = phoneDigits.slice(-9);
    return Order.findOne({
        country: shipment.country || 'EC',
        trackingNumber,
        'customer.phone': { $regex: `${phoneTail}$` }
    }).sort({ updatedAt: -1 }).catch(() => null);
};

const messagePhoneQueryForShipment = (shipment = {}) => {
    const digits = String(shipment.client?.phone || '').replace(/\D/g, '');
    const tails = [
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : ''
    ].filter(Boolean);

    return [...new Set(tails)].flatMap((tail) => ([
        { peerPhone: { $regex: `${tail}$` } },
        { chatId: { $regex: tail } },
        { from: { $regex: tail } }
    ]));
};

const findPickupProofMessageForShipment = async (shipment, { since = null } = {}) => {
    const phoneClauses = messagePhoneQueryForShipment(shipment);
    if (!phoneClauses.length) return null;

    const createdAt = since ? { $gte: since } : {};
    const candidates = await Message.find({
        $and: [
            { $or: phoneClauses },
            {
                $or: [
                    { hasMedia: true, type: { $in: ['image', 'video', 'document'] } },
                    { body: PICKUP_PROOF_TEXT_REGEX }
                ]
            }
        ],
        isFromMe: false,
        isBot: false,
        ...(since ? { createdAt } : {})
    }).sort({ createdAt: -1 }).limit(10).lean();

    return candidates.find((message) => {
        if (message.hasMedia && ['image', 'video', 'document'].includes(String(message.type || ''))) return true;
        return isPickupProofText(message.body || '');
    }) || null;
};

const confirmPickupFromProof = async ({
    shipment,
    chatId,
    messageId = '',
    proofKind = 'pickup_proof_received_from_whatsapp',
    sessionId = '',
    dryRun = false
}) => {
    if (!shipment) return { handled: false, reason: 'missing_shipment' };
    if (shipment.outcomes?.pickedUp && shipment.automation?.bonusNotifiedAt) {
        return { handled: false, reason: 'already_processed' };
    }

    if (dryRun) {
        return {
            handled: true,
            dryRun: true,
            orderId: shipment.orderId,
            chatId,
            messageId,
            proofKind
        };
    }

    const lockNow = new Date();
    const lockedShipment = await Shipment.findOneAndUpdate(
        {
            _id: shipment._id,
            'automation.bonusNotifiedAt': null,
            $or: [
                { 'automation.pickupProofDispatchLockedUntil': { $exists: false } },
                { 'automation.pickupProofDispatchLockedUntil': null },
                { 'automation.pickupProofDispatchLockedUntil': { $lte: lockNow } }
            ]
        },
        {
            $set: {
                'automation.pickupProofDispatchLockedUntil': new Date(lockNow.getTime() + PICKUP_PROOF_DISPATCH_LOCK_MS),
                'automation.pickupProofLastAttemptAt': lockNow,
                'automation.pickupProofLastError': ''
            }
        },
        { new: true }
    );
    if (!lockedShipment) {
        return { handled: false, reason: 'pickup_proof_locked_or_already_processed' };
    }
    shipment = lockedShipment;

    const pickedAt = new Date();
    const { treatmentEndsAt, refillReminderDueAt } = calculateTreatmentDates(shipment, pickedAt);

    shipment.logistics.status = 'ENTREGADO';
    shipment.logistics.lastStatusAt = pickedAt;
    shipment.outcomes.pickedUp = true;
    shipment.outcomes.delivered = true;
    shipment.outcomes.returned = false;
    shipment.outcomes.prepaidOnly = false;
    shipment.automation.deliveredConfirmedAt = pickedAt;
    shipment.automation.prepaidOnlyNotifiedAt = null;
    if (sessionId && !shipment.automation.sessionId) shipment.automation.sessionId = sessionId;
    shipment.proof.agencyReceiptPhotoUrl = messageId ? `whatsapp:${messageId}` : shipment.proof.agencyReceiptPhotoUrl;
    shipment.proof.pickupProofReceivedAt = new Date();
    shipment.treatment.treatmentEndsAt = treatmentEndsAt;
    shipment.treatment.refillReminderDueAt = refillReminderDueAt;
    shipment.review.manualOnly = false;
    shipment.review.reviewReason = '';
    shipment.review.reviewStatus = 'pickup_confirmed';
    shipment.events.push({
        kind: proofKind,
        at: new Date(),
        payload: {
            chatId,
            messageId,
            pickedAt,
            customerEligibility: 'released_for_new_order'
        }
    });
    shipment.events = shipment.events.slice(-60);
    try {
        await shipment.save();

        const order = await findOrderForPickupShipment(shipment);
        if (order) {
            order.status = 'delivered';
            order.shippingStatus = 'ENTREGADO';
            if (shipment.logistics?.trackingNumber) order.trackingNumber = shipment.logistics.trackingNumber;
            order.notes = [
                order.notes || '',
                `[${pickedAt.toISOString()}] Retirada confirmada automaticamente por comprovante WhatsApp. Bonus-retirada liberado.`
            ].filter(Boolean).join('\n');
            await order.save();
            syncOrderToOnlineAdminPanel(order, { status: 'delivered', action: 'pickup_proof_auto_confirmed' });
        }

        const bonusSent = await notifyPickupBonus(shipment);
        await markSenderWalletDelivered({ jid: chatId, phone: shipment.client?.phone });
        await Shipment.updateOne(
            { _id: shipment._id },
            {
                $set: {
                    'automation.pickupProofDispatchLockedUntil': null,
                    'automation.pickupProofLastError': ''
                }
            }
        );
        return { handled: true, orderId: shipment.orderId, bonusSent, orderSynced: Boolean(order) };
    } catch (error) {
        await Shipment.updateOne(
            { _id: shipment._id },
            {
                $set: {
                    'automation.pickupProofDispatchLockedUntil': null,
                    'automation.pickupProofLastError': String(error?.message || error || 'pickup_proof_processing_failed').slice(0, 500)
                }
            }
        ).catch(() => null);
        throw error;
    }
};

export const handlePickupProofInbound = async ({ chatId, messageId = '', sessionId = '' }) => {
    if (!chatId) return { handled: false, reason: 'missing_chat' };

    const shipment = await Shipment.findOne({
        $and: [
            { $or: phoneQueryForChatId(chatId) },
            {
                $or: [
                    { 'automation.pickupProofRequestedAt': { $ne: null } },
                    { 'automation.readyForPickupNotifiedAt': { $ne: null } },
                    { 'review.reviewStatus': 'awaiting_pickup_proof' }
                ]
            }
        ],
        'logistics.agencyPickup': true,
        'automation.bonusNotifiedAt': null
    }).sort({ updatedAt: -1 });

    if (!shipment) return { handled: false, reason: 'no_matching_shipment' };

    return confirmPickupFromProof({
        shipment,
        chatId,
        messageId,
        proofKind: 'pickup_proof_received_from_whatsapp',
        sessionId
    });
};

export const processPickupProofSweep = async ({ limit = 50, dryRun = true } = {}) => {
    const shipments = await Shipment.find({
        country: 'EC',
        'logistics.agencyPickup': true,
        'outcomes.pickedUp': { $ne: true },
        'automation.bonusNotifiedAt': null,
        $or: [
            { 'automation.readyForPickupNotifiedAt': { $ne: null } },
            { 'automation.pickupProofRequestedAt': { $ne: null } },
            { 'review.reviewStatus': 'awaiting_pickup_proof' }
        ]
    }).sort({ updatedAt: -1 }).limit(Math.max(1, Math.min(Number(limit) || 50, 200)));

    const results = [];
    let processed = 0;
    let confirmed = 0;
    let bonusSent = 0;

    for (const shipment of shipments) {
        processed += 1;
        const since = shipment.automation?.readyForPickupNotifiedAt
            || shipment.automation?.pickupProofRequestedAt
            || new Date(Date.now() - (30 * DAY_MS));
        const proof = await findPickupProofMessageForShipment(shipment, { since });
        if (!proof) {
            results.push({ orderId: shipment.orderId, matched: false, reason: 'no_proof_message' });
            continue;
        }

        const result = await confirmPickupFromProof({
            shipment,
            chatId: proof.chatId,
            messageId: proof._id,
            proofKind: proof.hasMedia ? 'pickup_proof_sweep_media' : 'pickup_proof_sweep_text',
            sessionId: shipment.automation?.sessionId || '',
            dryRun
        });
        if (result.handled) confirmed += 1;
        if (result.bonusSent) bonusSent += 1;
        results.push({
            orderId: shipment.orderId,
            matched: true,
            proofMessageId: proof._id,
            proofType: proof.type,
            proofText: String(proof.body || '').slice(0, 120),
            result
        });
    }

    return {
        dryRun,
        processed,
        confirmed,
        bonusSent,
        results
    };
};

export const notifyTreatmentRefillReminder = async (shipment) => {
    const chatId = resolveChatId(shipment);
    if (!chatId || shipment.automation.refillReminderAt) return false;

    const text = buildRefillReminderText(shipment);
    const hash = buildMessageHash({
        kind: 'refill_reminder',
        text,
        trackingNumber: shipment.logistics.trackingNumber
    });
    if (hasAlreadySentHash(shipment, hash)) return false;
    if (!hasMinGapElapsed(shipment)) return false;

    const sent = await sendShipmentText(shipment, chatId, text, {
        kind: 'shipment_refill_reminder_text'
    });
    if (!sent) return false;

    const tempoAudioPath = await resolveCountryAudio({ country: shipment.country || 'EC', baseName: 'TEMPO_RESULTADO_VIT_POWER' });
    const audioSent = tempoAudioPath
        ? await sendShipmentAudioFile(shipment, chatId, tempoAudioPath, {
            kind: 'shipment_refill_reminder_audio',
            baseName: 'TEMPO_RESULTADO_VIT_POWER',
            dedupeValue: `refill_reminder_audio|TEMPO_RESULTADO_VIT_POWER|${shipment.orderId || shipment.logistics?.trackingNumber || ''}`
        })
        : false;

    const now = new Date();
    const setFields = {
        'automation.refillReminderAt': now,
        'automation.lastReminderAt': now,
        'automation.lastReminderKind': 'refill_reminder'
    };
    if (audioSent) setFields['automation.lastAudioAt'] = now;
    await persistAutomationUpdate(shipment._id, setFields, hash);
    await appendEvent(shipment._id, 'refill_reminder_notified', { audioSent });
    return true;
};

export const getPendingShipmentReminders = async () => {
    const now = new Date();
    const oldestReadyForPickupAt = new Date(now.getTime() - (SHIPMENT_PICKUP_REMINDER_MAX_AGE_DAYS * DAY_MS));
    const shipments = await Shipment.find({
        country: 'EC',
        'client.phone': { $exists: true, $ne: '' },
        'logistics.status': 'READY_FOR_PICKUP',
        'logistics.agencyPickup': true,
        'logistics.trackingNumber': { $exists: true, $ne: '' },
        'automation.readyForPickupNotifiedAt': { $ne: null, $gte: oldestReadyForPickupAt },
        'outcomes.delivered': false,
        'outcomes.pickedUp': false,
        'outcomes.returned': false,
        'outcomes.prepaidOnly': false
    }).sort({ 'automation.readyForPickupNotifiedAt': 1 }).limit(200);

    return shipments
        .map((shipment) => {
            const due = getDuePickupReminderStep(shipment, now);
            return due ? { shipment, ...due } : null;
        })
        .filter(Boolean);
};

export const getDuePickupReminderStep = (shipment, now = new Date()) => {
    const anchor = shipment?.automation?.readyForPickupNotifiedAt;
    const anchorTime = anchor?.getTime?.();
    if (!anchorTime) return null;

    for (const step of PICKUP_REMINDER_SCHEDULE) {
        if (shipment.automation?.[step.field]) continue;
        const dueAt = new Date(anchorTime + (step.days * DAY_MS));
        if (now.getTime() >= dueAt.getTime()) {
            return { kind: step.kind, field: step.field, dueAt };
        }
        return null;
    }

    return null;
};

export const processShipmentPickupReminders = async ({
    limit = Number.parseInt(process.env.SHIPMENT_PICKUP_REMINDER_BATCH_LIMIT || '3', 10),
    dryRun = false,
    now = new Date()
} = {}) => {
    const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit || 3), 10) || 3, 10));
    const pending = await getPendingShipmentReminders();
    const allDueItems = pending
        .filter((item) => item?.dueAt && item.dueAt.getTime() <= now.getTime());
    const dueItems = allDueItems.slice(0, safeLimit);

    const result = {
        dryRun,
        candidates: allDueItems.length,
        selected: dueItems.length,
        processed: 0,
        sent: 0,
        items: dueItems.map(({ shipment, kind, dueAt }) => ({
            orderId: shipment.orderId,
            phoneTail: String(shipment.client?.phone || '').slice(-4),
            trackingNumber: shipment.logistics?.trackingNumber || '',
            kind,
            dueAt
        }))
    };

    if (dryRun) return result;

    for (const item of dueItems) {
        result.processed += 1;
        const sent = await notifyShipmentReminder(item.shipment, item.kind);
        if (sent) result.sent += 1;
    }

    return result;
};
