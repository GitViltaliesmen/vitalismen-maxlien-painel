import fs from 'fs';
import path from 'path';
import Order from '../models/Order.js';
import { toWhatsAppChatId } from '../utils/phone.js';
import { sendText } from '../whatsapp/sendText.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { rewriteMessage } from './aiService.js';
import { generateAudio } from './audioService.js';
import { resolveCountryAudio } from './audioTemplateService.js';

const AUDIO01_PATH = process.env.WHATSAPP_AUDIO01_PATH
    || path.join(process.cwd(), 'public', 'media', 'templates', 'audio01.ogg');
const getAudio01Text = (country) => (
    process.env[`WHATSAPP_AUDIO01_TEXT_${country}`]
    || process.env.WHATSAPP_AUDIO01_TEXT
    || (country === 'CO'
        ? 'Hola, soy Ana Lopez del equipo de la doctora María Fernández. Muchas gracias por su interés en Superfull, un producto natural para la impotencia, disfunción eréctil, eyaculación precoz, bajo libido y falta de energía. Me alegra mucho que haya decidido dar este paso. Si tiene alguna duda, puede contar conmigo. Estoy aquí para ayudarle en todo lo que necesite. Considérame una amiga en este proceso. El motivo de mi mensaje es informarle que su pedido ya está listo para ser enviado. El envío tarda de 2 a 5 días hábiles en llegar. Los repartidores se comunicarán con usted antes de la entrega, así que por favor, confirme su dirección. Si desea agregar algún punto de referencia, barrio o detalle adicional, si aún no lo ha hecho, le agradecería que me lo comparta para que podamos garantizar una entrega más rápida y segura.'
        : 'Hola, soy Ana Lopez del equipo de la doctora María Fernández. Muchas gracias por su interés en VitPowerss, un producto natural para la impotencia, disfunción eréctil, eyaculación precoz, bajo libido y falta de energía. Me alegra mucho que haya decidido dar este paso. Si tiene alguna duda, puede contar conmigo. Estoy aquí para ayudarle en todo lo que necesite. Considérame una amiga en este proceso. El motivo de mi mensaje es informarle que su pedido ya está listo para ser enviado. El envío tarda de 2 a 5 días hábiles en llegar. Los repartidores se comunicarán con usted antes de la entrega, así que por favor, confirme su dirección. Si desea agregar algún punto de referencia, barrio o detalle adicional, si aún no lo ha hecho, le agradecería que me lo comparta para que podamos garantizar una entrega más rápida y segura.')
    || ''
);

const getAudioTemplateNames = (country) => {
    // Country-specific initial audios (mp3 sources are auto-converted to ogg in public/media/templates/{country})
    if (country === 'EC') return ['Inicio_01', 'Inicio_02'];
    // Colombia default: w_1 from "AUDIOS REFORMULADOS COLOMBIA_GERSON/w_1.mp3"
    return ['w_1'];
};

const REQUIRE_AUDIO = process.env.WHATSAPP_FUNNEL_REQUIRE_AUDIO !== '0';
const MIN_TEXT_GAP_MS = Number.parseInt(process.env.WHATSAPP_FUNNEL_MIN_TEXT_GAP_MS || '10000', 10);
const EC_AUDIO_GAP_MS = Number.parseInt(process.env.WHATSAPP_FUNNEL_EC_AUDIO_GAP_MS || '60000', 10);
const CONFIRM_DELAY_MS = Math.max(
    MIN_TEXT_GAP_MS,
    Number.parseInt(process.env.WHATSAPP_FUNNEL_CONFIRM_DELAY_MS || String(MIN_TEXT_GAP_MS), 10)
);
const OFFER_DELAY_MS = Math.max(
    MIN_TEXT_GAP_MS,
    Number.parseInt(process.env.WHATSAPP_FUNNEL_OFFER_DELAY_MS || String(MIN_TEXT_GAP_MS), 10)
);
const LOCK_MS = Number.parseInt(process.env.WHATSAPP_FUNNEL_LOCK_MS || '30000', 10);
const AUDIO_OUTPUT_DIR = path.join(process.cwd(), 'public', 'media', 'sent');

const formatTotal = (order) => {
    const currency = order.currency || (order.country === 'EC' ? 'USD' : 'COP');
    try {
        const locale = order.country === 'CO' ? 'es-CO' : 'es-EC';
        return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(order.total || 0);
    } catch {
        return `${order.total || 0} ${currency}`;
    }
};

const buildAddressConfirmText = (order) => {
    const address = (order.customer?.address || '').trim();
    const city = (order.customer?.city || '').trim();
    const combined = [address, city].filter(Boolean).join(', ');
    return `Confirme: ${combined} ¿está bien así?`;
};

const buildOfferText = (order) => {
    const label = (order.package?.label || '').trim();
    const total = formatTotal(order);
    const product = label ? label : 'tu pedido';
    return `Te envío ${product}. Cuesta ${total} todo incluido. ¿Confirmado?`;
};

const interpolate = (template, order) => {
    const address = (order.customer?.address || '').trim();
    const city = (order.customer?.city || '').trim();
    const province = (order.customer?.province || '').trim();
    const packageLabel = (order.package?.label || '').trim();
    const total = formatTotal(order);

    return String(template)
        .replaceAll('{name}', order.customer?.name || 'Cliente')
        .replaceAll('{country}', order.country || '')
        .replaceAll('{address}', address)
        .replaceAll('{city}', city)
        .replaceAll('{province}', province)
        .replaceAll('{package}', packageLabel)
        .replaceAll('{total}', total);
};

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

export const processPendingFunnelByOrderId = async (orderId) => {
    const now = new Date();
    const locked = await Order.findOneAndUpdate(
        {
            orderId,
            status: 'pending',
            $or: [
                { 'whatsappFunnel.lockUntil': { $exists: false } },
                { 'whatsappFunnel.lockUntil': { $lt: now } }
            ]
        },
        { $set: { 'whatsappFunnel.lockUntil': new Date(now.getTime() + LOCK_MS) } },
        { new: true }
    );

    if (!locked) return { ok: false, reason: 'locked' };

    const order = locked;

    const chatId = toWhatsAppChatId(order.customer?.phone, order.country);
    if (!chatId) return { ok: false, reason: 'missing_phone' };

    order.whatsappFunnel = order.whatsappFunnel || {};
    const nowMs = Date.now();

    try {
        // Step 1: initial audios (country templates) - only once each
        const audioNames = getAudioTemplateNames(order.country);
        if (!order.whatsappFunnel.audio1SentAt) {
            let audioFile = order.whatsappFunnel.audio1File;
            if (!audioFile || !fs.existsSync(audioFile)) {
                // 1) Prefer explicit audio file path (legacy)
                if (fs.existsSync(AUDIO01_PATH)) audioFile = AUDIO01_PATH;

                // 2) Prefer country template (converted from MP3 automatically)
                if (!audioFile && audioNames[0]) {
                    audioFile = await resolveCountryAudio({ country: order.country, baseName: audioNames[0] });
                }

                // 3) Fallback to TTS generation from text
                if (!audioFile) {
                    const audioText = getAudio01Text(order.country);
                    if (audioText) {
                        ensureDir(AUDIO_OUTPUT_DIR);
                        const baseText = interpolate(audioText, order);
                        const rewritten = await rewriteMessage({
                            baseMessage: baseText,
                            customerName: order.customer?.name || 'Cliente',
                            systemPrompt: "Reescribe el mensaje proporcionado ligeramente para que suene natural y variado para una nota de voz de WhatsApp. Mantén el significado central y los detalles clave exactamente como están. No agregues emojis."
                        });
                        const outPath = path.join(AUDIO_OUTPUT_DIR, `audio01_${order.orderId}_${Date.now()}.ogg`);
                        const generated = await generateAudio(rewritten || baseText, outPath);
                        if (generated) {
                            audioFile = generated;
                        }
                    }
                }
                if (audioFile) {
                    order.whatsappFunnel.audio1File = audioFile;
                    await order.save();
                }
            }

            const audioExists = Boolean(audioFile && fs.existsSync(audioFile));
            if (!audioExists && REQUIRE_AUDIO) {
                console.warn(`[FUNNEL] audio01 missing and could not be generated. Set WHATSAPP_AUDIO01_PATH and/or WHATSAPP_AUDIO01_TEXT_${order.country} (or WHATSAPP_AUDIO01_TEXT).`);
                return { ok: false, reason: 'audio_missing' };
            }

            if (!audioExists) {
                console.warn(`[FUNNEL] audio01 missing and not required. Skipping audio.`);
                order.whatsappFunnel.audio1SentAt = new Date();
                await order.save();
                return { ok: true, progressed: 'audio_skipped' };
            }

            const sent = await sendAudio(chatId, audioFile, true);
            if (!sent) return { ok: false, reason: 'send_skipped' };
            order.whatsappFunnel.audio1SentAt = new Date();
            order.whatsappNotified = true;
            await order.save();
            return { ok: true, progressed: 'audio1' };
        }

        // Step 1b: second initial audio (EC only)
        if (order.country === 'EC' && audioNames[1] && !order.whatsappFunnel.audio2SentAt) {
            const audio1Ms = order.whatsappFunnel.audio1SentAt instanceof Date ? order.whatsappFunnel.audio1SentAt.getTime() : 0;
            if (audio1Ms && (nowMs - audio1Ms) < EC_AUDIO_GAP_MS) {
                return { ok: true, progressed: 'wait_audio2' };
            }

            const audio2File = await resolveCountryAudio({ country: order.country, baseName: audioNames[1] });
            const audio2Exists = Boolean(audio2File && fs.existsSync(audio2File));
            if (!audio2Exists && REQUIRE_AUDIO) {
                console.warn(`[FUNNEL] audio02 missing for EC. Expected Inicio_02.mp3 in repo root /ec.`);
                return { ok: false, reason: 'audio_missing' };
            }

            if (audio2Exists) {
                const sent = await sendAudio(chatId, audio2File, true);
                if (!sent) return { ok: false, reason: 'send_skipped' };
            }
            order.whatsappFunnel.audio2SentAt = new Date();
            order.whatsappNotified = true;
            await order.save();
            return { ok: true, progressed: 'audio2' };
        }

        // Step 2: confirm address text
        if (!order.whatsappFunnel.addressConfirmSentAt) {
            const anchorMs = order.country === 'EC'
                ? (order.whatsappFunnel.audio2SentAt instanceof Date ? order.whatsappFunnel.audio2SentAt.getTime() : 0)
                : (order.whatsappFunnel.audio1SentAt instanceof Date ? order.whatsappFunnel.audio1SentAt.getTime() : 0);
            if (anchorMs && (nowMs - anchorMs) < CONFIRM_DELAY_MS) {
                return { ok: true, progressed: 'wait_confirm' };
            }

            const sent = await sendText(chatId, buildAddressConfirmText(order));
            if (!sent) return { ok: false, reason: 'send_skipped' };
            order.whatsappFunnel.addressConfirmSentAt = new Date();
            order.whatsappNotified = true;
            await order.save();
            return { ok: true, progressed: 'address_confirm' };
        }

        // Step 3: offer text
        if (!order.whatsappFunnel.offerSentAt) {
            const confirmSentAtMs = order.whatsappFunnel.addressConfirmSentAt instanceof Date
                ? order.whatsappFunnel.addressConfirmSentAt.getTime()
                : 0;
            if (confirmSentAtMs && (nowMs - confirmSentAtMs) < OFFER_DELAY_MS) {
                return { ok: true, progressed: 'wait_offer' };
            }

            const sent = await sendText(chatId, buildOfferText(order));
            if (!sent) return { ok: false, reason: 'send_skipped' };
            order.whatsappFunnel.offerSentAt = new Date();
            order.whatsappNotified = true;
            await order.save();
            return { ok: true, progressed: 'offer' };
        }

        return { ok: true, progressed: 'done' };
    } finally {
        await Order.updateOne(
            { orderId },
            { $unset: { 'whatsappFunnel.lockUntil': 1 } }
        );
    }
};

export const processDuePendingFunnels = async () => {
    const pending = await Order.find({
        status: 'pending',
        $or: [
            { 'whatsappFunnel.audio1SentAt': { $exists: false } },
            { 'whatsappFunnel.addressConfirmSentAt': { $exists: false } },
            { 'whatsappFunnel.offerSentAt': { $exists: false } }
        ],
        'customer.phone': { $exists: true, $ne: '' }
    }).sort({ createdAt: -1 }).limit(50);

    for (const order of pending) {
        try {
            await processPendingFunnelByOrderId(order.orderId);
        } catch (e) {
            console.error(`[FUNNEL] Failed for ${order.orderId}:`, e);
        }
    }
};
