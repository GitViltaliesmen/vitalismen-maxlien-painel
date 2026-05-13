import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { sendText } from '../whatsapp/sendText.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendDocument } from '../whatsapp/sendDocument.js';
import { toWhatsAppChatId } from '../utils/phone.js';
import Shipment from '../models/Shipment.js';
import Message from '../models/Message.js';
import { downloadDroppiEcuadorInvoicePdf } from './droppiEcuadorBrowserService.js';
import { resolveCountryAudio } from './audioTemplateService.js';
import { VIT_POWER_PICKUP_BONUS_TEXT } from './vitPowerEvolvedWorkflow.js';
import { markSenderWalletDelivered } from '../whatsapp/sessionRouter.js';

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
const SAVE_CONTACT_LINE = 'Por favor guarde este numero como Ana - Vit Power para recibir aqui la guia, el aviso de retiro y su bonus.';
const SHIPMENT_MIN_MESSAGE_GAP_MS = Number.parseInt(process.env.SHIPMENT_MIN_MESSAGE_GAP_MS || '1800000', 10);
const SHIPMENT_AUDIO_DELAY_MIN_MS = Number.parseInt(process.env.SHIPMENT_AUDIO_DELAY_MIN_MS || '7000', 10);
const SHIPMENT_AUDIO_DELAY_MAX_MS = Number.parseInt(process.env.SHIPMENT_AUDIO_DELAY_MAX_MS || '17000', 10);
const SHIPMENT_EC_PICKUP_AUDIO_APPROVED = process.env.SHIPMENT_EC_PICKUP_AUDIO_APPROVED === 'true';
const SHIPMENT_FILES_DIR = path.join(process.cwd(), 'public', 'media', 'shipments');
const DAY_MS = 24 * 60 * 60 * 1000;
const SHIPMENT_PICKUP_REMINDER_MAX_AGE_DAYS = Math.max(6, Number.parseInt(process.env.SHIPMENT_PICKUP_REMINDER_MAX_AGE_DAYS || '10', 10) || 10);
const PICKUP_AUDIO_BY_KIND = {
    guia: 'CONFIRMACION_Y_REGALITO_ESPECIAL',
    ready_for_pickup: ['Chegou_01', 'CONFIRMACION_Y_REGALITO_ESPECIAL'],
    day1: process.env.SHIPMENT_PICKUP_REMINDER_AUDIO_DAY1 || 'Chegou_01',
    day3: process.env.SHIPMENT_PICKUP_REMINDER_AUDIO_DAY3 || 'Chegou_02',
    day5: process.env.SHIPMENT_PICKUP_REMINDER_AUDIO_DAY5 || 'Chegou_03'
};
const AUDIO_ONLY_REMINDER_KINDS = new Set(['day1', 'day3', 'day5']);
const PICKUP_PROOF_TEXT_REGEX = /\b(ya\s+(lo\s+)?(retire|retir[eé]|recogi|recog[ií])|retir[eé]\s+(mi\s+)?pedido|ya\s+tengo\s+(el\s+)?producto|me\s+entregaron|comprobante\s+de\s+retiro|foto\s+del\s+(producto|retiro|comprobante)|guia\s+de\s+retiro)\b/i;
const PICKUP_REMINDER_SCHEDULE = [
    { kind: 'day1', field: 'reminderDay1At', days: 1 },
    { kind: 'soft_day2', field: 'reminderSoftDay2At', days: 2 },
    { kind: 'day3', field: 'reminderDay3At', days: 3 },
    { kind: 'soft_day4', field: 'reminderSoftDay4At', days: 4 },
    { kind: 'day5', field: 'reminderDay5At', days: 5 },
    { kind: 'soft_day6', field: 'reminderSoftDay6At', days: 6 }
];

const chooseStableVariant = (items, key = '') => {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (list.length === 0) return '';
    const hash = crypto.createHash('sha1').update(String(key || Date.now())).digest('hex');
    const index = Number.parseInt(hash.slice(0, 8), 16) % list.length;
    return list[index];
};

const resolveChatId = (shipment) => toWhatsAppChatId(shipment?.client?.phone || '', shipment?.country || 'EC');

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

const sendShipmentAudio = async (shipment, chatId, kind) => {
    const baseNames = Array.isArray(PICKUP_AUDIO_BY_KIND[kind])
        ? PICKUP_AUDIO_BY_KIND[kind]
        : [PICKUP_AUDIO_BY_KIND[kind]].filter(Boolean);
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

        const sent = await sendAudio(chatId, audioPath, true, {
            sessionId: shipment.automation?.sessionId || null
        });
        sentAny = Boolean(sent) || sentAny;
        if (sent) {
            detail.sent.push(baseName);
        } else {
            detail.failed.push({ baseName, reason: 'send_failed' });
        }
        await registerAudioAttempt(shipment, {
            kind,
            baseName,
            at: new Date(),
            sent: Boolean(sent),
            reason: sent ? 'sent' : 'send_failed',
            sessionId: shipment.automation?.sessionId || null
        });
        if (sent && index < baseNames.length - 1) {
            await wait(randomDelayMs(SHIPMENT_AUDIO_DELAY_MIN_MS, SHIPMENT_AUDIO_DELAY_MAX_MS));
        }
    }
    detail.sentAny = sentAny;
    return detail;
};

const isAgencyPickup = (shipment) => Boolean(shipment?.logistics?.agencyPickup);

const shipmentVariantKey = (shipment, kind) => [
    shipment?.orderId || '',
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
    return withSaveContactReminder(renderShipmentTextVariant([
        ({ name, carrier, tracking }) => `Hola ${name} 😊 su pedido ya esta listo para retiro en agencia. Guia ${tracking} por ${carrier}. Cuando lo retire, envieme una foto del producto o del comprobante y le libero su bono especial.`,
        ({ name, carrier, tracking }) => `${name}, ya puede pasar por su pedido 🙌 Esta disponible en agencia con guia ${tracking} por ${carrier}. Apenas lo retire, me envia el comprobante y activo su regalo.`,
        ({ name, carrier, tracking }) => `Buenas noticias, ${name} ✅ su pedido ya aparece para retiro en agencia. Guia: ${tracking}. Puede acercarse a Servientrega y luego me envia una foto del retiro para liberar su bono.`,
        ({ name, carrier, tracking }) => `Hola ${name} 📦 le aviso que su pedido ya esta en agencia para retirar. Guia ${tracking} por ${carrier}. Si ya lo retira hoy, me comparte el comprobante y le envio el bonus.`
    ], shipment, 'ready_for_pickup', { name, carrier, tracking }));
};

export const buildReminderText = (shipment, kind) => {
    const tracking = shipment?.logistics?.trackingNumber || '';
    const agency = isAgencyPickup(shipment);
    const lightPickupText = tracking
        ? `Hola 😊 su pedido sigue aguardando retiro en Servientrega. Guia ${tracking}. Si ya lo retiro, envieme foto del producto o de la guia de retiro para sacarlo de la lista y liberarle su bonus.`
        : 'Hola 😊 su pedido sigue aguardando retiro en Servientrega. Si ya lo retiro, envieme foto del producto o de la guia de retiro para sacarlo de la lista y liberarle su bonus.';
    if (agency && kind === 'day1') {
        return `Hola, buen dia 😊 Te confirmo que tu pedido con guia ${tracking} ya esta disponible. Queria saber si ya lo retiraste.`;
    }
    if (agency && kind === 'soft_day2') {
        return lightPickupText;
    }
    if (agency && kind === 'day3') {
        return `Hola 😊 Te recuerdo que tu pedido con guia ${tracking} sigue pendiente de retiro. Para evitar devolucion automatica de la transportadora, es importante retirarlo cuanto antes.`;
    }
    if (agency && kind === 'soft_day4') {
        return lightPickupText;
    }
    if (agency && kind === 'day5') {
        return `Hola 😊 Este es el ultimo aviso de retiro de tu pedido con guia ${tracking}. Si no se retira a tiempo, la transportadora puede devolverlo.`;
    }
    if (agency && kind === 'soft_day6') {
        return lightPickupText;
    }
    if (kind === 'day1') {
        return `Hola 😊 Tu pedido con guia ${tracking} ya esta en camino. Por favor queda atento al telefono para recibirlo en casa.`;
    }
    if (kind === 'soft_day2') {
        return `Hola 😊 Te recuerdo estar pendiente de la transportadora. Si ya recibiste el pedido con guia ${tracking}, me confirmas por favor.`;
    }
    if (kind === 'day3') {
        return `Hola 😊 Sigo atento a tu entrega con guia ${tracking}. Si la transportadora te llama, responde para evitar que el pedido vuelva a bodega.`;
    }
    if (kind === 'soft_day4') {
        return `Hola 😊 Queria confirmar si ya recibiste tu pedido con guia ${tracking}.`;
    }
    if (kind === 'day5') {
        return `Hola 😊 Ultimo recordatorio de entrega para tu pedido con guia ${tracking}. Si hubo algun problema con la transportadora, me avisas y te ayudo.`;
    }
    return SOFT_REMINDER_TEXT;
};

export const buildPickupProofText = () => (
    'Perfecto 😊 Para dejar su entrega confirmada en sistema y liberar su bono especial de retiro, envieme por favor una foto del producto y una foto del comprobante o guia de retiro que le entregaron en la agencia.'
);

export const buildPickupBonusText = (shipment = null) => {
    if (PICKUP_BONUS_TEXT_OVERRIDE.trim()) return PICKUP_BONUS_TEXT_OVERRIDE.trim();
    if (shipment?.country === 'EC' || !shipment?.country) return VIT_POWER_PICKUP_BONUS_TEXT;
    return chooseStableVariant(BONUS_TEXT_VARIANTS, shipment?.orderId || shipment?.logistics?.trackingNumber || '');
};

export const buildRefillReminderText = (shipment) => {
    const units = Number(shipment?.treatment?.unitsPurchased || 1) || 1;
    const product = shipment?.productName || 'su tratamiento';
    return `Hola 😊 Le escribo para que no interrumpa ${product}. Su tratamiento de ${units} frasco${units > 1 ? 's' : ''} esta por terminar en pocos dias. Si quiere, hoy mismo le separo su siguiente envio con un bono sorpresa para que no pare el avance y mantenga su resultado.`;
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

export const notifyShipmentGuideGenerated = async (shipment) => {
    const chatId = resolveChatId(shipment);
    if (!chatId || shipment.automation.guiaNotifiedAt) {
        return { success: false, textSent: false, invoiceSent: false, reason: 'already_notified_or_invalid_chat' };
    }
    const text = buildShipmentGuideText(shipment);
    const hash = buildMessageHash({
        kind: 'guia',
        text,
        trackingNumber: shipment.logistics.trackingNumber
    });
    if (hasAlreadySentHash(shipment, hash)) {
        return { success: false, textSent: false, invoiceSent: false, reason: 'duplicate_hash' };
    }
    if (!hasMinGapElapsed(shipment)) {
        return { success: false, textSent: false, invoiceSent: false, reason: 'min_gap_not_elapsed' };
    }

    const textSent = await sendText(chatId, text, null, {
        sessionId: shipment.automation.sessionId || null
    });
    if (!textSent) {
        return { success: false, textSent: false, invoiceSent: false, reason: 'text_send_failed' };
    }

    let invoiceSent = false;
    const invoiceSource = resolveInvoiceSource(shipment);
    if (invoiceSource) {
        const localInvoicePath = await ensureInvoiceAvailableLocally(shipment);
        const documentSource = localInvoicePath && fs.existsSync(localInvoicePath) ? localInvoicePath : '';
        if (documentSource) {
            invoiceSent = await sendDocument(
                chatId,
                documentSource,
                path.basename(String(documentSource).split('?')[0]),
                'Te comparto tambien la guia/factura en PDF.',
                { sessionId: shipment.automation.sessionId || null }
            );
        }

        if (!invoiceSent) {
            console.warn(`[SHIPMENT] Falha ao enviar fatura PDF para shipment ${shipment.orderId}`);
        }
    }
    const guideAudioSent = await sendShipmentAudio(shipment, chatId, 'guia');

    const now = new Date();
    await persistAutomationUpdate(shipment._id, {
        'automation.guiaNotifiedAt': now,
        'automation.lastReminderAt': now,
        'automation.lastReminderKind': 'guia'
    }, hash);
    await appendEvent(shipment._id, 'guia_notified', {
        trackingNumber: shipment.logistics.trackingNumber,
        audio: guideAudioSent
    });
    return {
        success: true,
        textSent: true,
        invoiceSent,
        reason: invoiceSource && !invoiceSent ? 'invoice_send_failed' : 'ok'
    };
};

export const notifyReadyForPickup = async (shipment) => {
    const chatId = resolveChatId(shipment);
    if (!chatId || shipment.automation.readyForPickupNotifiedAt) return false;
    const text = buildReadyForPickupText(shipment);
    const hash = buildMessageHash({
        kind: 'ready_for_pickup',
        text,
        trackingNumber: shipment.logistics.trackingNumber
    });
    if (hasAlreadySentHash(shipment, hash)) return false;
    if (!hasMinGapElapsed(shipment)) return false;

    const thankYouAudioPath = await resolveCountryAudio({ country: shipment.country || 'EC', baseName: 'OBRIGADO_PAGOU' });
    const thankYouAudioSent = thankYouAudioPath
        ? await sendAudio(chatId, thankYouAudioPath, true, { sessionId: shipment.automation.sessionId || null })
        : false;

    const sent = await sendText(chatId, text, null, {
        sessionId: shipment.automation.sessionId || null
    });
    if (!sent) return false;
    const audioSent = await sendShipmentAudio(shipment, chatId, 'ready_for_pickup');

    const now = new Date();
    await persistAutomationUpdate(shipment._id, {
        'automation.readyForPickupNotifiedAt': now,
        'automation.lastReminderAt': now,
        'automation.lastReminderKind': 'ready_for_pickup'
    }, hash);
    await appendEvent(shipment._id, 'ready_for_pickup_notified', { audio: audioSent });
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
    if (!hasMinGapElapsed(shipment)) return false;

    let sent = true;
    if (!audioOnly) {
        sent = await sendText(chatId, text, null, {
            sessionId: shipment.automation.sessionId || null
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
    const hash = buildMessageHash({
        kind: 'returned',
        text: PREPAID_ONLY_TEXT,
        trackingNumber: shipment.logistics.trackingNumber
    });
    if (hasAlreadySentHash(shipment, hash)) return false;
    if (!hasMinGapElapsed(shipment)) return false;

    const sent = await sendText(chatId, PREPAID_ONLY_TEXT, null, {
        sessionId: shipment.automation.sessionId || null
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

    const sent = await sendText(chatId, text, null, {
        sessionId: shipment.automation.sessionId || null
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
    const hash = buildMessageHash({
        kind: 'pickup_bonus',
        text,
        trackingNumber: shipment.logistics.trackingNumber
    });
    if (hasAlreadySentHash(shipment, hash)) return false;

    const sent = await sendText(chatId, text, null, {
        sessionId: shipment.automation.sessionId || null
    });
    if (!sent) return false;
    const howToUseAudioPath = await resolveCountryAudio({ country: shipment.country || 'EC', baseName: 'COMO_SE_TOMA_VIT_POWER' });
    const howToUseAudioSent = howToUseAudioPath
        ? await sendAudio(chatId, howToUseAudioPath, true, { sessionId: shipment.automation.sessionId || null })
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
    const refillReminderDueAt = new Date(treatmentEndsAt.getTime() - (5 * 24 * 60 * 60 * 1000));
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
    return Message.findOne({
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
    }).sort({ createdAt: -1 }).lean();
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

    const pickedAt = new Date();
    const { treatmentEndsAt, refillReminderDueAt } = calculateTreatmentDates(shipment, pickedAt);

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
    await shipment.save();

    const bonusSent = await notifyPickupBonus(shipment);
    await markSenderWalletDelivered({ jid: chatId, phone: shipment.client?.phone });
    return { handled: true, orderId: shipment.orderId, bonusSent };
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

    const sent = await sendText(chatId, text, null, {
        sessionId: shipment.automation.sessionId || null
    });
    if (!sent) return false;

    const now = new Date();
    await persistAutomationUpdate(shipment._id, {
        'automation.refillReminderAt': now,
        'automation.lastReminderAt': now,
        'automation.lastReminderKind': 'refill_reminder'
    }, hash);
    await appendEvent(shipment._id, 'refill_reminder_notified');
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

const getDuePickupReminderStep = (shipment, now = new Date()) => {
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
