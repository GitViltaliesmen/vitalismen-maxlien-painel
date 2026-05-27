import { openaiService } from './openaiService.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import ContactState from '../models/ContactState.js';
import Shipment from '../models/Shipment.js';
import { enrichOutboundPlan, executePreparedOutboundPlan } from './outboundComposer.js';
import { AGENT_PROFILES } from './agentProfiles.js';
import { resolveCountryAudio } from './audioTemplateService.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendText } from '../whatsapp/sendText.js';
import { sendImage } from '../whatsapp/sendImage.js';
import { getSalesMedia } from './salesMediaCatalog.js';
import { maybeHandleVitPowerAudioComplement } from './vitPowerAudioComplementService.js';
import { isInitialProductInquiry, isSimpleGreeting, looksLikeOrderDataMessage, startsWithOfficialInitialCtaMessage } from './initialFunnelTriggers.js';
import { formatAgencyOptionLine, findKnownServientregaEcuadorLocation, findServientregaEcuadorAgencies, loadServientregaEcuadorAgencies, resolveServientregaEcuadorAgency } from './servientregaEcuadorAgencyService.js';
import { buildRefillReminderText } from './shipmentMessageService.js';
import { sendPurchaseEventForOrder } from './metaConversionsService.js';
import { syncContactDraftToOnlineAdminPanel, syncOrderToOnlineAdminPanel } from './adminPanelStatusService.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseMs = (name, fallback) => {
    const value = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const randomMs = (minName, maxName, fallbackMin, fallbackMax) => {
    const min = parseMs(minName, fallbackMin);
    const max = parseMs(maxName, fallbackMax);
    const low = Math.max(0, Math.min(min, max));
    const high = Math.max(low, max);
    return low + Math.floor(Math.random() * (high - low + 1));
};

const initialFunnelStepDelayMs = (kind) => {
    if (String(process.env.INITIAL_FUNNEL_STEP_DELAY_ENABLED || 'true').toLowerCase() !== 'true') {
        return 0;
    }

    if (kind === 'audio') {
        return randomMs('INITIAL_FUNNEL_AFTER_AUDIO_MIN_MS', 'INITIAL_FUNNEL_AFTER_AUDIO_MAX_MS', 7000, 14000);
    }

    if (kind === 'image') {
        return randomMs('INITIAL_FUNNEL_AFTER_IMAGE_MIN_MS', 'INITIAL_FUNNEL_AFTER_IMAGE_MAX_MS', 6000, 12000);
    }

    return randomMs('INITIAL_FUNNEL_BEFORE_PRICE_MIN_MS', 'INITIAL_FUNNEL_BEFORE_PRICE_MAX_MS', 8000, 16000);
};

const initialFunnelInterruptCheckEnabled = () => (
    String(process.env.INITIAL_FUNNEL_INTERRUPT_CHECK_ENABLED || 'false').toLowerCase() === 'true'
);

const recordInitialFunnelStepMessage = async ({ jid, peerPhone = '', body, type = 'chat' }) => {
    if (!body) return;
    try {
        await Message.create({
            _id: `out_${Date.now()}_initial_${Math.random().toString(16).slice(2, 8)}`,
            chatId: jid,
            peerPhone: peerPhone || digitsOnly(jid),
            from: 'bot',
            to: jid,
            body,
            type,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (error) {
        console.warn('[FUNIL] Falha ao registrar passo inicial:', error.message);
    }
};

const normalizeFieldLabel = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cleanFieldValue = (value) => String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const parseMoneyValue = (value) => {
    const raw = String(value || '').replace(/[^\d.,]/g, '').trim();
    if (!raw) return 0;
    const normalized = raw.includes(',') && raw.includes('.')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(',', '.');
    const number = Number.parseFloat(normalized);
    return Number.isFinite(number) ? number : 0;
};

const ECUADOR_PROVINCES = [
    'azuay',
    'bolivar',
    'canar',
    'carchi',
    'chimborazo',
    'cotopaxi',
    'el oro',
    'esmeraldas',
    'galapagos',
    'guayas',
    'imbabura',
    'loja',
    'los rios',
    'manabi',
    'morona santiago',
    'napo',
    'orellana',
    'pastaza',
    'pichincha',
    'santa elena',
    'santo domingo',
    'sucumbios',
    'tungurahua',
    'zamora chinchipe'
];

const ECUADOR_CITY_ALIASES = [
    'guayaquil',
    'quito',
    'cuenca',
    'manta',
    'ambato',
    'loja',
    'riobamba',
    'machala',
    'portoviejo',
    'santo domingo',
    'quevedo',
    'milagro',
    'ibarra',
    'latacunga',
    'baba',
    'babahoyo',
    'esmeraldas',
    'duran',
    'samborondon',
    'daule',
    'salinas',
    'santa elena',
    'vinces',
    'cayambe',
    'tulcan',
    'san gabriel',
    'gualaceo'
];

const titleCaseFromNormalized = (value) => String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.length <= 2 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const normalizeLocationText = (value) => normalizeFieldLabel(value);

let cachedEcuadorLocationCatalog = null;
const getEcuadorLocationCatalog = () => {
    if (cachedEcuadorLocationCatalog) return cachedEcuadorLocationCatalog;
    let agencyCities = [];
    let agencyProvinces = [];
    try {
        const agencies = loadServientregaEcuadorAgencies();
        agencyCities = agencies.map((agency) => normalizeLocationText(agency.city || '')).filter(Boolean);
        agencyProvinces = agencies.map((agency) => normalizeLocationText(agency.province || '')).filter(Boolean);
    } catch (error) {
        console.warn('[FUNIL] Falha ao carregar catalogo de cidades Servientrega:', error.message);
    }
    cachedEcuadorLocationCatalog = {
        cities: [...new Set([...ECUADOR_CITY_ALIASES, ...agencyCities])],
        provinces: [...new Set([...ECUADOR_PROVINCES, ...agencyProvinces])]
    };
    return cachedEcuadorLocationCatalog;
};

const findKnownCity = (value) => {
    const normalized = normalizeLocationText(value);
    return getEcuadorLocationCatalog().cities.find((city) => new RegExp(`\\b${city.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized)) || '';
};

const findKnownProvince = (value) => {
    const normalized = normalizeLocationText(value);
    return getEcuadorLocationCatalog().provinces.find((province) => new RegExp(`\\b${province.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized)) || '';
};

const extractResidenceLocationPrefix = (text = '') => {
    const raw = cleanFieldValue(text);
    const match = raw.match(/\b(?:vivo|resido|estoy|me encuentro|estamos)\s+en\s+([^,.;\n]+)(?:[,.;\n]\s*([^,.;\n]+))?/i);
    if (!match) return { city: '', province: '' };
    const cityPart = cleanFieldValue(match[1]);
    const provincePart = cleanFieldValue(match[2] || '');
    const known = findKnownServientregaEcuadorLocation({
        city: cityPart,
        province: provincePart,
        text: [cityPart, provincePart].filter(Boolean).join(', ')
    });
    return {
        city: known.city ? titleCaseFromNormalized(normalizeLocationText(known.city)) : '',
        province: known.province ? titleCaseFromNormalized(normalizeLocationText(known.province)) : ''
    };
};

const parsePackageQuantityText = (value) => {
    const body = normalizeFieldLabel(value);
    if (/\b(6|seis)\b/.test(body)) return 6;
    if (/\b(3|tres)\b/.test(body)) return 3;
    if (/\b(2|dos)\b/.test(body)) return 2;
    if (/\b(1|un|uno|una)\b/.test(body)) return 1;
    return 0;
};

const splitReferenceFromValue = (value) => {
    const raw = cleanFieldValue(value);
    const match = raw.match(/\b(ref(?:erencia)?\.?|referencia|punto\s+de\s+referencia)\s*[:.]?\s*(.+)$/i);
    if (!match) {
        const landmarkMatch = raw.match(/\b(frente\s+(?:a|al)|cerca\s+(?:de|del)?|por\s+el\s+sector\s+de|a\s+la\s+altura\s+de|diagonal\s+a|al\s+lado\s+de|junto\s+a|referencia)\b\s*(.+)$/i);
        if (!landmarkMatch || landmarkMatch.index < 6) return { value: raw, reference: '' };
        return {
            value: cleanFieldValue(raw.slice(0, landmarkMatch.index)).replace(/[,.;-]+$/g, '').trim(),
            reference: cleanFieldValue(raw.slice(landmarkMatch.index))
        };
    }
    return {
        value: cleanFieldValue(raw.slice(0, match.index)).replace(/[,.;-]+$/g, '').trim(),
        reference: cleanFieldValue(match[2])
    };
};

const extractReferenceFromText = (text) => {
    const match = String(text || '').match(/\b(ref(?:erencia)?\.?|referencia|punto\s+de\s+referencia)\s*[:.]?\s*(.+)$/im);
    if (match?.[2]) return cleanFieldValue(match[2]);
    const landmarkMatch = String(text || '').match(/\b(frente\s+(?:a|al)|cerca\s+(?:de|del)?|por\s+el\s+sector\s+de|a\s+la\s+altura\s+de|diagonal\s+a|al\s+lado\s+de|junto\s+a)\b\s*(.+)$/im);
    return landmarkMatch?.[0] ? cleanFieldValue(landmarkMatch[0]) : '';
};

const extractLocationFromText = (value) => {
    const raw = cleanFieldValue(value);
    const normalized = normalizeLocationText(raw);
    const result = {};
    const catalog = getEcuadorLocationCatalog();
    const residenceLoc = extractResidenceLocationPrefix(raw);

    const cityMatch = raw.match(/\b(?:ciudad|cidade|canton|cant[oó]n|municipio|localidad)\s*[:.]?\s*([^\d,.;\n]+?)(?:[,.;\n]|$)/i);
    if (cityMatch?.[1]) {
        const cityCandidate = cleanFieldValue(cityMatch[1]);
        const normalizedCity = normalizeLocationText(cityCandidate);
        const knownCity = catalog.cities.find((city) => normalizedCity.includes(city));
        const knownAgencyLocation = findKnownServientregaEcuadorLocation({ city: cityCandidate, text: cityCandidate });
        result.city = knownAgencyLocation.city
            ? titleCaseFromNormalized(normalizeLocationText(knownAgencyLocation.city))
            : (knownCity ? titleCaseFromNormalized(knownCity) : cityCandidate);
    } else {
        const residenceMatch = raw.match(/\b(?:vivo|resido|estoy|soy|me encuentro)\s+en\s+([^\d,.;\n]+?)(?:[,.;\n]|$)/i);
        const residenceCity = residenceMatch?.[1] ? findKnownCity(residenceMatch[1]) : '';
        const knownCity = residenceLoc.city || residenceCity || catalog.cities.find((city) => new RegExp(`\\b${city.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized));
        if (knownCity) result.city = residenceLoc.city || titleCaseFromNormalized(knownCity);
    }

    const provinceMatch = raw.match(/\b(?:provincia|departamento|depto|estado)\s*[:.]?\s*([^\d,.;\n]+?)(?:[,.;\n]|$)/i);
    if (provinceMatch?.[1]) {
        const provinceCandidate = cleanFieldValue(provinceMatch[1]);
        const normalizedProvince = normalizeLocationText(provinceCandidate);
        const knownProvince = catalog.provinces.find((province) => normalizedProvince.includes(province));
        const knownAgencyLocation = findKnownServientregaEcuadorLocation({ province: provinceCandidate, text: provinceCandidate });
        result.province = knownAgencyLocation.province
            ? titleCaseFromNormalized(normalizeLocationText(knownAgencyLocation.province))
            : (knownProvince ? titleCaseFromNormalized(knownProvince) : provinceCandidate);
    } else {
        const residenceMatch = raw.match(/\b(?:vivo|resido|estoy|soy|me encuentro)\s+en\s+([^\d,.;\n]+?)(?:[,.;\n]|$)/i);
        const residenceProvince = residenceMatch?.[1] ? findKnownProvince(residenceMatch[1]) : '';
        const knownProvince = residenceLoc.province || residenceProvince || catalog.provinces.find((province) => new RegExp(`\\b${province.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized));
        if (knownProvince) result.province = residenceLoc.province || titleCaseFromNormalized(knownProvince);
    }

    return result;
};

const cleanAddressLocationFragments = (value) => cleanFieldValue(value)
    .replace(/\bciudad\s*[:.]?\s*[a-záéíóúñ\s]+?(?=,|\.|;|$)/ig, '')
    .replace(/\bprovincia\s*[:.]?\s*[a-záéíóúñ\s]+?(?=,|\.|;|$)/ig, '')
    .replace(new RegExp(`\\b(${ECUADOR_PROVINCES.join('|').replace(/\s+/g, '\\s+')})\\b`, 'ig'), '')
    .replace(/\s*,\s*,/g, ',')
    .replace(/^[,\s]+|[,\s.]+$/g, '')
    .trim();

const coerceCheckoutLocationFields = (fields = {}) => {
    const normalized = { ...fields };
    const provinceAsCity = normalized.province ? findKnownCity(normalized.province) : '';
    const cityAsProvince = normalized.city ? findKnownProvince(normalized.city) : '';

    if (provinceAsCity && cityAsProvince) {
        normalized.city = titleCaseFromNormalized(provinceAsCity);
        normalized.province = titleCaseFromNormalized(cityAsProvince);
        return normalized;
    }

    if (normalized.city) {
        const knownCity = findKnownCity(normalized.city);
        if (knownCity) normalized.city = titleCaseFromNormalized(knownCity);
    }
    if (normalized.province) {
        const knownProvince = findKnownProvince(normalized.province);
        if (knownProvince) normalized.province = titleCaseFromNormalized(knownProvince);
    }

    return normalized;
};

const looksLikePersonNameOnly = (text) => {
    const raw = cleanFieldValue(text);
    const normalized = normalizeFieldLabel(raw);
    if (!raw || raw.length < 5 || raw.length > 80) return false;
    if (/[0-9@:]/.test(raw)) return false;
    if (/\b(ref|referencia|direccion|dirección|endereco|ciudad|provincia|cantidad|frasco|domicilio|agencia|servientrega|calle|rua|av|avenida|casa|mz|villa)\b/i.test(normalized)) {
        return false;
    }
    const words = normalized.split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= 5;
};

const looksLikeLooseAddressLine = (text) => {
    const raw = cleanFieldValue(text);
    const normalized = normalizeFieldLabel(raw);
    if (!raw || raw.length < 5) return false;
    if (/^(para|pra)\s+(mi|meu|m[ií])?\s*(domicilio|domicilio|casa|residencia)\b/i.test(normalized)) return false;
    if (/\b(ciudad|cidade|provincia|nombre|nomre|nome|cliente|cantidad|quantidade|ref|referencia)\b/i.test(normalized)) return false;
    return /\b(rua|calle|av|avenida|casa|mz|manzana|villa|barrio|sector|via|km|lote|edificio|cooperativa|ciudadela)\b/i.test(normalized);
};

const hasLooseCheckoutDataSignal = (text) => {
    const body = normalizeFieldLabel(text);
    const signals = [
        /\b(nombre|nomre|nome|cliente)\b/,
        /\b(mi\s+)?nom(?:b|r)re\s+es\b/,
        /\b(direccion|dirección|endereco|direcao|rua|calle|av|avenida|mz|manzana|villa|casa)\b/,
        /\b(ciudad|provincia|referencia|ref)\b/,
        /\b(frente|cerca|diagonal|junto|lado|sector|mercado|supermercado|tienda|farmacia|iglesia|parque|escuela|colegio|gasolinera|unidad educativa|cancha|hospital|clinica|cl[ií]nica|upc)\b/,
        /\b(guayaquil|quito|cuenca|manta|ambato|loja|pichincha|guayas|manabi|azuay)\b/
    ];
    return signals.filter((pattern) => pattern.test(body)).length >= 1;
};

const parseDelimitedCheckoutLine = (line) => {
    const parts = String(line || '')
        .split(/\t+|\s{2,}/)
        .map((part) => cleanFieldValue(part))
        .filter(Boolean);
    if (parts.length < 3) return {};

    const firstProvince = findKnownProvince(parts[0]);
    const secondCity = findKnownCity(parts[1]);
    const firstCity = findKnownCity(parts[0]);
    const secondProvince = findKnownProvince(parts[1]);
    const fields = {};

    if (firstProvince || secondCity) {
        if (firstProvince) fields.province = titleCaseFromNormalized(firstProvince);
        if (secondCity) fields.city = titleCaseFromNormalized(secondCity);
        fields.address = parts[2];
        if (parts[3]) fields.reference = parts.slice(3).join(' ');
        return fields;
    }

    if (firstCity || secondProvince) {
        if (firstCity) fields.city = titleCaseFromNormalized(firstCity);
        if (secondProvince) fields.province = titleCaseFromNormalized(secondProvince);
        fields.address = parts[2];
        if (parts[3]) fields.reference = parts.slice(3).join(' ');
    }

    return fields;
};

const parseCheckoutOrderMessage = (text, { loose = false } = {}) => {
    if (!loose && !looksLikeOrderDataMessage(text)) return null;
    if (loose && !hasLooseCheckoutDataSignal(text) && !looksLikePersonNameOnly(text) && !parsePackageQuantityText(text)) return null;

    const fields = {};
    const lines = String(text || '').split(/\r?\n/);
    for (const line of lines) {
        const delimited = parseDelimitedCheckoutLine(line);
        if (delimited.province && !fields.province) fields.province = delimited.province;
        if (delimited.city && !fields.city) fields.city = delimited.city;
        if (delimited.address && !fields.address) fields.address = delimited.address;
        if (delimited.reference && !fields.reference) fields.reference = delimited.reference;
    }

    for (const line of lines) {
        const match = line.match(/^\s*([^:：]+)\s*[:：]\s*(.+?)\s*$/);
        if (!match) continue;
        const label = normalizeFieldLabel(match[1]);
        const value = cleanFieldValue(match[2]);
        if (!value) continue;

        if (/\b(nombre|nomre|nombres|nome|cliente|name)\b/.test(label)) fields.name = value;
        else if (/\b(telefono|telefone|celular|whatsapp|phone)\b/.test(label)) fields.phone = value;
        else if (/\b(provincia|departamento|estado|region)\b/.test(label)) fields.province = value;
        else if (/\b(ciudad|cidade|city)\b/.test(label)) fields.city = value;
        else if (/\b(direccion|dirección|endereco|direcao|address)\b/.test(label)) fields.address = value;
        else if (/\b(ref|referencia|punto de referencia|ponto de referencia|bairro|barrio)\b/.test(label)) fields.reference = value;
        else if (/\b(cantidad|quantidade|frasco|frascos|quantity)\b/.test(label)) fields.quantity = parsePackageQuantityText(value);
        else if (/\b(total|valor|precio|preco)\b/.test(label)) fields.total = parseMoneyValue(value);
    }

    if (!fields.address) {
        const looseAddress = lines
            .map((line) => cleanFieldValue(line))
            .find((line) => looksLikeLooseAddressLine(line));
        if (looseAddress) fields.address = looseAddress;
    }

    if (!fields.name) {
        const nameMatch = String(text || '').match(/\bmi\s+nom(?:b|r)re\s+es\s*[:.]?\s*([^\n,.;]+)/i);
        if (nameMatch?.[1]) fields.name = cleanFieldValue(nameMatch[1]);
    }
    if (!fields.name && loose && looksLikePersonNameOnly(text)) fields.name = cleanFieldValue(text);

    const referenceFromText = extractReferenceFromText(text);
    if (!fields.reference && referenceFromText) fields.reference = referenceFromText;

    if (fields.address) {
        const splitAddress = splitReferenceFromValue(fields.address);
        if (splitAddress.reference && !fields.reference) fields.reference = splitAddress.reference;
        const fullLocation = extractLocationFromText(text);
        if (!fields.city && fullLocation.city) fields.city = fullLocation.city;
        if (!fields.province && fullLocation.province) fields.province = fullLocation.province;
        const location = extractLocationFromText(fields.address);
        if (!fields.city && location.city) fields.city = location.city;
        if (!fields.province && location.province) fields.province = location.province;
        fields.address = cleanAddressLocationFragments(splitAddress.value || fields.address);
    } else {
        const location = extractLocationFromText(text);
        if (!fields.city && location.city) fields.city = location.city;
        if (!fields.province && location.province) fields.province = location.province;
    }

    const quantityFromText = Number.parseInt((String(text || '').match(/\b(?:cantidad|quantidade)\s*[:：]\s*(\d+)/i) || [])[1] || '', 10);
    if (!fields.quantity && Number.isFinite(quantityFromText)) fields.quantity = quantityFromText;
    if (!fields.quantity && /\b(cantidad|quantidade|frasco|frascos|botella|botellas)\b/i.test(normalizeFieldLabel(text))) {
        fields.quantity = parsePackageQuantityText(text);
    }

    fields.firstLineIsOfficialCta = startsWithOfficialInitialCtaMessage(text);
    fields.isCheckoutOrderData = true;

    const meaningfulFields = Object.entries(fields).filter(([key, value]) => (
        !['firstLineIsOfficialCta', 'isCheckoutOrderData'].includes(key) && Boolean(value)
    ));
    return meaningfulFields.length > 0 ? coerceCheckoutLocationFields(fields) : null;
};

const orderPackageLabel = ({ customerContext, quantity }) => {
    const product = 'Vit Power';
    return `${product} ${quantity} frasco${Number(quantity) > 1 ? 's' : ''}`;
};

const PRICE_TABLE_BY_COUNTRY = {
    EC: {
        1: { value: '$39', total: 39 },
        2: { value: '$70', total: 70 },
        3: { value: '$95.99', total: 95.99 },
        6: { value: '$167.99', total: 167.99 }
    }
};

const normalizePackageQuantity = (quantity) => {
    const parsed = Number.parseInt(String(quantity || ''), 10);
    return [1, 2, 3, 6].includes(parsed) ? parsed : 1;
};

const getSelectedOffer = (customerContext, parsedOrder = {}) => {
    const countryCode = 'EC';
    const quantity = normalizePackageQuantity(parsedOrder.quantity);
    const product = 'VIT POWER';
    const price = PRICE_TABLE_BY_COUNTRY[countryCode][quantity] || PRICE_TABLE_BY_COUNTRY[countryCode][1];
    return {
        product,
        quantity,
        label: `${quantity} frasco${quantity > 1 ? 's' : ''}`,
        value: price.value,
        total: price.total
    };
};

const getOneBottleOffer = (customerContext) => getSelectedOffer(customerContext, { quantity: 1 });

const getAgencyDetails = (parsedOrder = {}) => {
    const address = cleanFieldValue(parsedOrder.address);
    const reference = cleanFieldValue(parsedOrder.reference);
    const province = cleanFieldValue(parsedOrder.province);
    const city = cleanFieldValue(parsedOrder.city);
    const looksLikeAgencyName = /(agencia|servientrega|directo|norte|sur|centro|\/)/i.test(address);
    const lookup = resolveServientregaEcuadorAgency({
        city,
        province,
        agencyName: parsedOrder.agencyName || address,
        address: parsedOrder.agencyAddress || reference || address,
        text: [parsedOrder.rawAgencyDetails, address, reference].filter(Boolean).join(' ')
    });
    if (lookup.confident && lookup.best) {
        return {
            name: lookup.best.name,
            address: lookup.best.address,
            city: lookup.best.city,
            province: lookup.best.province,
            sector: lookup.best.sector,
            isAgency: true,
            validated: true
        };
    }

    return {
        name: parsedOrder.agencyName || (looksLikeAgencyName ? address : [province, city, address].filter(Boolean).join(' / ')),
        address: parsedOrder.agencyAddress || reference || address,
        isAgency: Boolean(looksLikeAgencyName || reference),
        validated: Boolean(parsedOrder.agencyValidated)
    };
};

const upsertCheckoutOrderDraft = async ({ parsedOrder, customerContext, peerPhone }) => {
    const phone = parsedOrder.phone || peerPhone || '';
    const phoneTail = digitsOnly(phone).slice(-10);
    const country = 'EC';
    const currency = 'USD';
    const query = phoneTail
        ? {
            country,
            status: { $in: ['draft', 'pending', 'confirmed'] },
            'customer.phone': { $regex: phoneTail }
        }
        : null;
    const order = query
        ? await Order.findOne(query).sort({ updatedAt: -1, createdAt: -1 })
        : null;

    const payload = {
        country,
        customer: {
            name: parsedOrder.name,
            phone,
            address: parsedOrder.address,
            city: parsedOrder.city,
            province: parsedOrder.province
        },
        package: {
            id: parsedOrder.quantity,
            label: orderPackageLabel({ customerContext, quantity: parsedOrder.quantity }),
            quantity: parsedOrder.quantity
        },
        total: parsedOrder.total,
        currency,
        source: 'whatsapp',
        status: 'draft',
        notes: parsedOrder.reference ? `Punto de referencia: ${parsedOrder.reference}` : (order?.notes || '')
    };

    if (order) {
        order.customer = payload.customer;
        order.package = payload.package;
        order.total = payload.total;
        order.currency = payload.currency;
        order.source = payload.source;
        order.notes = payload.notes;
        order.conversationMemory = {
            ...(order.conversationMemory || {}),
            funnelStage: parsedOrder.reference ? 'awaiting_order_confirmation' : 'awaiting_reference',
            currentIntent: 'purchase_intent',
            lastCustomerMessageAt: new Date()
        };
        await order.save();
        return order;
    }

    const created = new Order({
        ...payload,
        conversationMemory: {
            funnelStage: parsedOrder.reference ? 'awaiting_order_confirmation' : 'awaiting_reference',
            currentIntent: 'purchase_intent',
            lastCustomerMessageAt: new Date()
        },
        draftCreatedAt: new Date()
    });
    await created.save();
    return created;
};

const markMetaPurchaseForConfirmedOrder = async (order) => {
    if (!order || order.status !== 'confirmed') return false;
    order.tracking = order.tracking || {};
    if (order.tracking.metaPurchaseSentAt) return true;

    const result = await sendPurchaseEventForOrder(order);
    order.tracking.metaPurchaseEventId = result.eventId;
    if (result.ok) {
        order.tracking.metaPurchaseSentAt = new Date();
        order.tracking.metaPurchaseResponse = result.response;
    } else {
        order.tracking.metaPurchaseResponse = {
            ok: false,
            status: result.status,
            data: result.data,
            error: result.error
        };
        console.warn(`[META] Purchase CAPI falhou para pedido ${order.orderId}: ${result.error || result.status || 'unknown'}`);
    }
    await order.save();
    return Boolean(result.ok);
};

const CHECKOUT_DATA_COLLECTION_STAGES = new Set([
    'awaiting_customer_data',
    'awaiting_customer_name_data',
    'awaiting_city_province',
    'awaiting_home_address',
    'awaiting_reference',
    'awaiting_quantity_data'
]);

const isCheckoutDataCollectionStage = (stage) => CHECKOUT_DATA_COLLECTION_STAGES.has(stage);

const missingCheckoutFieldKeys = (parsedOrder = {}) => {
    const missing = [];
    if (!parsedOrder.name) missing.push('name');
    if (!parsedOrder.province) missing.push('province');
    if (!parsedOrder.city) missing.push('city');
    if (!parsedOrder.address) missing.push('address');
    if (!parsedOrder.quantity) missing.push('quantity');
    if (!parsedOrder.reference) missing.push('reference');
    return missing;
};

const missingCheckoutFields = (parsedOrder = {}) => {
    const labels = {
        name: 'nombre completo',
        province: 'provincia',
        city: 'ciudad',
        address: 'direccion completa',
        quantity: 'cantidad',
        reference: 'punto de referencia'
    };
    return missingCheckoutFieldKeys(parsedOrder).map((key) => labels[key]);
};

const checkoutDataStageFromMissing = (missingKeys = [], parsedOrder = {}) => {
    if (parsedOrder?.deliveryMode === 'home') {
        if (missingKeys.includes('city') || missingKeys.includes('province')) return 'awaiting_city_province';
        if (missingKeys.includes('address') || missingKeys.includes('reference')) return 'awaiting_home_address';
        if (missingKeys.includes('name')) return 'awaiting_customer_name_data';
        if (missingKeys.includes('quantity')) return 'awaiting_quantity_data';
        return 'awaiting_agency_confirmation';
    }
    if (missingKeys.includes('name')) return 'awaiting_customer_name_data';
    if (missingKeys.includes('city') || missingKeys.includes('province')) return 'awaiting_city_province';
    if (missingKeys.includes('address') || missingKeys.includes('reference')) return 'awaiting_home_address';
    if (missingKeys.includes('quantity')) return 'awaiting_quantity_data';
    return 'awaiting_agency_confirmation';
};

const normalizeOptionalPackageQuantity = (quantity) => {
    const parsed = Number.parseInt(String(quantity || ''), 10);
    return [1, 3, 6].includes(parsed) ? parsed : 0;
};

const mergeCheckoutOrderData = ({
    baseOrder = null,
    incomingOrder = null,
    selectedQuantity = 0,
    peerPhone = ''
} = {}) => {
    const merged = {
        ...(baseOrder || {}),
        ...(incomingOrder || {})
    };

    const selected = normalizeOptionalPackageQuantity(selectedQuantity);
    const incomingHasQuantity = isValidPackageQuantity(incomingOrder?.quantity);
    if (selected && !incomingHasQuantity) {
        merged.quantity = selected;
    } else if (!merged.quantity) {
        merged.quantity = selected;
    }
    if (!merged.phone && peerPhone) {
        merged.phone = peerPhone;
    }

    const location = extractLocationFromText([
        incomingOrder?.city,
        incomingOrder?.province,
        merged.address,
        merged.reference,
        incomingOrder?.address,
        incomingOrder?.reference
    ].filter(Boolean).join(' '));
    if (!merged.city && location.city) merged.city = location.city;
    if (!merged.province && location.province) merged.province = location.province;

    if (merged.address) {
        const splitAddress = splitReferenceFromValue(merged.address);
        if (!merged.reference && splitAddress.reference) merged.reference = splitAddress.reference;
        merged.address = cleanAddressLocationFragments(splitAddress.value || merged.address);
    }

    merged.firstLineIsOfficialCta = Boolean(merged.firstLineIsOfficialCta);
    merged.isCheckoutOrderData = true;
    return coerceCheckoutLocationFields(merged);
};

const shouldTryMergePendingCheckoutData = ({ text, pendingCheckoutStage, pendingCheckoutOrder }) => {
    if (!pendingCheckoutOrder) return false;
    if (!isCheckoutDataCollectionStage(pendingCheckoutStage)) return false;
    if (!cleanFieldValue(text)) return false;
    if (pendingCheckoutStage === 'awaiting_quantity_data' && parsePackageQuantityText(text)) return true;
    return hasLooseCheckoutDataSignal(text) || looksLikePersonNameOnly(text);
};

const rebuildCheckoutOrderFromRecentMessages = async ({
    chatId,
    pendingCheckoutOrder = null,
    selectedQuantity = 0,
    peerPhone = ''
} = {}) => {
    const recent = await Message.find({
        chatId,
        isFromMe: false,
        isBot: false,
        body: { $ne: '' }
    }).sort({ createdAt: -1 }).limit(14).lean();

    const ordered = recent.reverse();
    let rebuilt = {};
    for (const message of ordered) {
        const body = String(message.body || '').trim();
        if (!body) continue;
        const parsed = parseCheckoutOrderMessage(body, { loose: true });
        if (parsed) {
            rebuilt = mergeCheckoutOrderData({
                baseOrder: rebuilt,
                incomingOrder: parsed,
                selectedQuantity,
                peerPhone
            });
            continue;
        }
        if (looksLikePersonNameOnly(body)) {
            rebuilt = mergeCheckoutOrderData({
                baseOrder: rebuilt,
                incomingOrder: { name: cleanFieldValue(body), isCheckoutOrderData: true },
                selectedQuantity,
                peerPhone
            });
        }
    }

    return mergeCheckoutOrderData({
        baseOrder: pendingCheckoutOrder || {},
        incomingOrder: rebuilt,
        selectedQuantity,
        peerPhone
    });
};

const buildMissingCheckoutFieldText = ({ parsedOrder, missing, missingKeys = [] }) => {
    const firstName = cleanFieldValue(parsedOrder?.name || '').split(/\s+/)[0] || '';
    const namePrefix = firstName ? `, ${firstName}` : '';
    const isHomeDelivery = parsedOrder?.deliveryMode === 'home';

    if (isHomeDelivery && missingKeys.includes('city') && missingKeys.includes('province')) {
        return 'Entiendo, senor. Para revisar entrega a domicilio, primero me indica su ciudad y provincia?';
    }
    if (isHomeDelivery && missingKeys.includes('city')) {
        return `Gracias${namePrefix}. Solo me falta su ciudad para revisar la entrega a domicilio. Me la envia por favor?`;
    }
    if (isHomeDelivery && missingKeys.includes('province')) {
        return `Gracias${namePrefix}. Solo me falta su provincia para revisar la entrega a domicilio. Me la envia por favor?`;
    }
    if (isHomeDelivery && missingKeys.includes('address') && missingKeys.includes('reference')) {
        return `Perfecto${namePrefix}. Ahora si me envia la direccion completa de entrega y una referencia cercana? Ejemplo: frente a una farmacia, cerca de una tienda, junto a una gasolinera o al lado de una iglesia.`;
    }
    if (isHomeDelivery && missingKeys.includes('address')) {
        return `Perfecto${namePrefix}. Ahora si me envia la direccion completa de entrega?`;
    }
    if (isHomeDelivery && missingKeys.includes('reference')) {
        return `Perfecto${namePrefix}. Solo me falta una referencia cercana para ubicar bien la entrega. Puede ser frente a una farmacia, cerca de una tienda, junto a una gasolinera o al lado de una iglesia.`;
    }
    if (missingKeys.includes('name')) {
        return 'Perfecto. Para registrar su pedido, me confirma por favor su nombre completo?';
    }
    if (missingKeys.includes('city') && missingKeys.includes('province')) {
        return `Gracias${namePrefix}. Ahora me indica su ciudad y provincia?`;
    }
    if (missingKeys.includes('city')) {
        return `Gracias${namePrefix}. Solo me falta su ciudad. Me la envia por favor?`;
    }
    if (missingKeys.includes('province')) {
        return `Gracias${namePrefix}. Solo me falta su provincia. Me la envia por favor?`;
    }
    if (missingKeys.includes('address') && missingKeys.includes('reference')) {
        return `Perfecto${namePrefix}. Ahora me envia la direccion completa de entrega y una referencia cercana? Ejemplo: frente a una farmacia, cerca de una tienda, junto a una gasolinera o al lado de una iglesia.`;
    }
    if (missingKeys.includes('address')) {
        return `Perfecto${namePrefix}. Ahora me envia la direccion completa de entrega?`;
    }
    if (missingKeys.includes('reference')) {
        return `Perfecto${namePrefix}. Ya recibi sus datos del pedido. Solo me falta una referencia cercana para dejar el envio bien ubicado. Puede ser una tienda, farmacia, gasolinera, iglesia, parque o escuela cercana.`;
    }
    if (missingKeys.includes('quantity')) {
        return `Perfecto${namePrefix}. Cuantos frascos desea llevar: 1, 3 o 6?`;
    }
    return `Perfecto${namePrefix}. Ya recibi parte de sus datos. Para avanzar sin error, solo me falta: ${missing.join(', ')}. Me lo envia por favor?`;
};

const buildCheckoutDataReceivedText = (parsedOrder = {}) => {
    const firstName = cleanFieldValue(parsedOrder.name).split(/\s+/)[0] || 'cliente';
    return `Gracias, ${firstName}. Ya recibi sus datos y la agencia indicada. Le envio la informacion para que pueda confirmar con seguridad.`;
};

const buildCheckoutPackageCtaText = (customerContext, parsedOrder = {}) => {
    const offer = getSelectedOffer(customerContext, parsedOrder);
    const responseLabel = `${offer.quantity} FRASCO${offer.quantity > 1 ? 'S' : ''}`;
    return [
        `Hoy puede separar ${offer.label} de ${offer.product} por ${offer.value}.`,
        '',
        `Para confirmar, responda: *${responseLabel}*.`
    ].join('\n');
};

const buildCheckoutOrderConfirmationSummaryText = ({ parsedOrder, customerContext }) => {
    const offer = getSelectedOffer(customerContext, parsedOrder);
    const destination = [
        cleanFieldValue(parsedOrder.city),
        cleanFieldValue(parsedOrder.province)
    ].filter(Boolean).join(', ');
    const agencySource = parsedOrder.reference || parsedOrder.address || '';
    const agencyParts = splitAgencyDestination(agencySource);
    const agencyDetails = getAgencyDetails({
        ...parsedOrder,
        agencyName: parsedOrder.agencyName || agencyParts.agency || '',
        agencyAddress: parsedOrder.agencyAddress || parsedOrder.reference || parsedOrder.address || agencyParts.address || ''
    });
    const agencyName = agencyDetails.name || parsedOrder.agencyName || agencyParts.agency || '';
    const address = agencyDetails.address || parsedOrder.agencyAddress || parsedOrder.reference || parsedOrder.address || agencyParts.address || '';
    const isAgency = /(agencia|servientrega|oficina|retiro|retirar)/i.test([
        parsedOrder.address,
        parsedOrder.reference,
        parsedOrder.agencyName,
        parsedOrder.agencyAddress
    ].filter(Boolean).join(' '));
    const displayAddress = isAgency
        ? (agencyDetails.address || parsedOrder.agencyAddress || parsedOrder.reference || parsedOrder.address || agencyParts.address || '')
        : (parsedOrder.address || '');
    const displayReference = !isAgency ? cleanFieldValue(parsedOrder.reference) : '';

    const lines = [
        '✅ ¡Perfecto! Ya recibí sus datos para el pedido.',
        '',
        `👤 Cliente: ${cleanFieldValue(parsedOrder.name)}`,
        destination ? `📍 Destino: ${destination}` : '',
        isAgency && agencyName ? `🏢 Punto de Retiro: Agencia Servientrega ${agencyName}` : '',
        `🏠 Dirección: ${stripAgencyNoise(displayAddress) || 'datos recibidos'}`,
        displayReference ? `📌 Referencia: ${displayReference}` : '',
        agencyDetails.validated ? '✅ Agencia confirmada en nuestra lista oficial de Servientrega' : '',
        `📦 Pedido: ${offer.quantity} frasco${offer.quantity > 1 ? 's' : ''} de VIT POWER`,
        `💰 Total a pagar al recibir: ${offer.value}`,
        '',
        '¿Los datos son correctos para proceder con el envío hoy mismo?'
    ].filter((line) => line !== '').join('\n');

    return lines;
};

const buildCheckoutAgencyConfirmationText = ({ parsedOrder, customerContext }) => {
    const firstName = cleanFieldValue(parsedOrder.name).split(/\s+/)[0] || 'cliente';
    const offer = getSelectedOffer(customerContext, parsedOrder);
    const agency = getAgencyDetails(parsedOrder);
    return [
        `Perfecto, ${firstName}.`,
        '',
        `Le envio ${offer.label} de ${offer.product} por ${offer.value}.`,
        '',
        'Para evitar errores, confirme si la agencia es esta:',
        '',
        agency.name,
        agency.address,
        '',
        '¿Confirmo su pedido en esta agencia?'
    ].join('\n');
};

const savePendingCheckoutOrderMemory = async ({ contactStateId, agentProfile, parsedOrder, stage, orderId = null }) => {
    if (!contactStateId) return;
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${agentProfile.key}.pendingCheckoutOrder`]: {
                    ...parsedOrder,
                    stage
                },
                [`metadata.perAgentMemory.${agentProfile.key}.lastCheckoutOrderDraftId`]: orderId,
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: stage,
                [`metadata.perAgentMemory.${agentProfile.key}.lastCheckoutOrderDataAt`]: new Date()
            }
        }
    );
};

const parseCheckoutCorrectionMessage = (text = '') => {
    const body = cleanFieldValue(text);
    if (!body) return { hasCorrection: false, fields: {}, asksCorrection: false };

    const normalized = normalizeForDecision(body);
    const fields = {};
    const lines = String(text || '').split(/\r?\n/);

    for (const line of lines) {
        const match = line.match(/^\s*([^:：]+)\s*[:：]\s*(.+?)\s*$/);
        if (!match) continue;
        const label = normalizeFieldLabel(match[1]);
        const value = cleanFieldValue(match[2]);
        if (!value) continue;

        if (/^(nombre|nome|cliente|name)$/.test(label)) fields.name = value;
        else if (/^(telefono|telefone|celular|whatsapp|phone)$/.test(label)) fields.phone = value;
        else if (/^(provincia|departamento|estado|region)$/.test(label)) fields.province = value;
        else if (/^(ciudad|cidade|city)$/.test(label)) fields.city = value;
        else if (/^(direccion|endereco|direcao|address)$/.test(label)) fields.address = value;
        else if (/^(referencia|punto de referencia|ponto de referencia|bairro|barrio)$/.test(label)) fields.reference = value;
        else if (/^(cantidad|quantidade|frasco|frascos|quantity)$/.test(label)) fields.quantity = normalizePackageQuantity(value);
        else if (/^(total|valor|precio|preco)$/.test(label)) fields.total = parseMoneyValue(value);
    }

    const inlineRules = [
        ['name', /\b(?:nombre|nome|cliente)\s+(?:correcto\s+)?(?:es|seria|sera|a)\s+(.+)/i],
        ['phone', /\b(?:telefono|telefone|celular|whatsapp)\s+(?:correcto\s+)?(?:es|seria|sera|a)\s+(.+)/i],
        ['province', /\b(?:provincia|departamento|estado)\s+(?:correcta\s+)?(?:es|seria|sera|a)\s+(.+)/i],
        ['city', /\b(?:ciudad|cidade)\s+(?:correcta\s+)?(?:es|seria|sera|a)\s+(.+)/i],
        ['address', /\b(?:direccion|dirección|endereco|direcao)\s+(?:correcta\s+)?(?:es|seria|sera|a)\s+(.+)/i],
        ['reference', /\b(?:referencia|punto de referencia|bairro|barrio)\s+(?:correcta\s+)?(?:es|seria|sera|a)\s+(.+)/i],
        ['quantity', /\b(?:cantidad|quantidade)\s+(?:correcta\s+)?(?:es|seria|sera|a)\s+(\d+|uno|un|una|tres|seis)\b/i]
    ];

    for (const [field, pattern] of inlineRules) {
        if (fields[field]) continue;
        const match = body.match(pattern);
        if (!match?.[1]) continue;
        const value = cleanFieldValue(match[1]).replace(/\s+(?:y|pero)\s+.*$/i, '').trim();
        if (!value) continue;
        fields[field] = field === 'quantity' ? normalizePackageQuantity(value) : value;
    }

    const asksCorrection = /^(no|nop|negativo)\b/i.test(normalized)
        || /\b(cambiar|cambia|corrige|corregir|correccion|corrección|editar|modificar|alterar|esta mal|esta errado|incorrecto|incorrecta|no es|no esta bien)\b/i.test(normalized);

    return {
        hasCorrection: Object.keys(fields).length > 0,
        fields,
        asksCorrection
    };
};

const handlePendingCheckoutCorrection = async ({
    text,
    chatId,
    agentProfile,
    contactStateId,
    peerPhone,
    pendingCheckoutOrder,
    pendingCheckoutStage,
    customerContext,
    sessionId = null
}) => {
    if (pendingCheckoutStage !== 'awaiting_agency_confirmation' || !pendingCheckoutOrder) return false;
    if (isOrderCloseAffirmation(text)) return false;

    const correction = parseCheckoutCorrectionMessage(text);
    if (!correction.hasCorrection && !correction.asksCorrection) return false;

    if (!correction.hasCorrection) {
        const replyText = 'Claro, lo ajusto antes de enviar. Me indica exactamente que dato debo cambiar: nombre, ciudad, provincia, direccion, referencia o cantidad?';
        const sent = await sendText(chatId, replyText, null, { sessionId });
        if (!sent) return false;
        await updateContactStateAgentMemory({
            contactStateId,
            agentProfile,
            inboundText: text,
            outboundText: replyText,
            inferredIntent: 'purchase_intent',
            inferredFunnelStage: pendingCheckoutStage,
            inferredObjection: null
        });
        return true;
    }

    const correctedOrder = {
        ...pendingCheckoutOrder,
        ...correction.fields,
        stage: 'awaiting_agency_confirmation'
    };
    const offer = getSelectedOffer(customerContext, correctedOrder);
    correctedOrder.quantity = offer.quantity;
    correctedOrder.total = offer.total;

    const summaryText = [
        'Listo, ya corregi ese dato.',
        '',
        buildCheckoutOrderConfirmationSummaryText({
            parsedOrder: correctedOrder,
            customerContext
        })
    ].join('\n');

    const sent = await sendText(chatId, summaryText, null, { sessionId });
    if (!sent) return false;

    await savePendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        parsedOrder: correctedOrder,
        stage: 'awaiting_agency_confirmation',
        orderId: pendingCheckoutOrder.orderId || null
    });

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText: text,
        outboundText: summaryText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: 'awaiting_agency_confirmation',
        inferredObjection: null
    });

    console.log(`[FUNIL] Correcao pontual aplicada no checkout -> ${chatId} | campos=${Object.keys(correction.fields).join(',')}`);
    return true;
};

const clearPendingCheckoutOrderMemory = async ({ contactStateId, agentProfile, stage, orderId = null }) => {
    if (!contactStateId) return;
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${agentProfile.key}.lastCheckoutOrderDraftId`]: orderId,
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: stage,
                [`metadata.perAgentMemory.${agentProfile.key}.lastCheckoutOrderConfirmationAt`]: new Date()
            },
            $unset: {
                [`metadata.perAgentMemory.${agentProfile.key}.pendingCheckoutOrder`]: ''
            }
        }
    );
};

const sendCheckoutOrderNextStep = async ({
    jid,
    parsedOrder,
    customerContext,
    agentProfile,
    contactStateId,
    peerPhone,
    sessionId = null
}) => {
    const missingKeys = missingCheckoutFieldKeys(parsedOrder);
    const missing = missingCheckoutFields(parsedOrder);
    if (missing.length > 0) {
        const replyText = buildMissingCheckoutFieldText({ parsedOrder, missing, missingKeys });
        const stage = checkoutDataStageFromMissing(missingKeys, parsedOrder);

        const sent = await sendText(jid, replyText, null, { sessionId });
        if (!sent) return false;

        try {
            await Message.create({
                _id: `out_${Date.now()}_checkout_missing`,
                chatId: jid,
                peerPhone,
                from: 'bot',
                to: jid,
                body: replyText,
                isFromMe: true,
                isBot: true,
                timestamp: Math.floor(Date.now() / 1000)
            });
        } catch (e) { }

        await updateContactStateAgentMemory({
            contactStateId,
            agentProfile,
            inboundText: [
                parsedOrder.name,
                parsedOrder.province,
                parsedOrder.city,
                parsedOrder.address,
                parsedOrder.reference
            ].filter(Boolean).join(' | '),
            outboundText: replyText,
            inferredIntent: 'purchase_intent',
            inferredFunnelStage: stage,
            inferredObjection: null
        });

        await savePendingCheckoutOrderMemory({
            contactStateId,
            agentProfile,
            parsedOrder,
            stage,
            orderId: null
        });

        console.log(`[FUNIL] Dados do formulario incompletos -> ${jid} | etapa=${stage} | pedido=sem_pedido`);
        return true;
    }

    const order = await upsertCheckoutOrderDraft({ parsedOrder, customerContext, peerPhone });
    const offer = getSelectedOffer(customerContext, parsedOrder);
    const normalizedOrder = {
        ...parsedOrder,
        quantity: offer.quantity,
        total: offer.total,
        stage: 'awaiting_agency_confirmation'
    };
    const summaryText = buildCheckoutOrderConfirmationSummaryText({
        parsedOrder: normalizedOrder,
        customerContext
    });
    const summarySent = await sendText(jid, summaryText, null, { sessionId });
    if (!summarySent) return false;

    try {
        await Message.create({
            _id: `out_${Date.now()}_checkout_summary`,
            chatId: jid,
            peerPhone,
            from: 'bot',
            to: jid,
            body: summaryText,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText: [
            parsedOrder.name,
            parsedOrder.province,
            parsedOrder.city,
            parsedOrder.address,
            parsedOrder.reference
        ].filter(Boolean).join(' | '),
        outboundText: summaryText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: 'awaiting_agency_confirmation',
        inferredObjection: null
    });

    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${agentProfile.key}.pendingCheckoutOrder`]: normalizedOrder,
                [`metadata.perAgentMemory.${agentProfile.key}.lastCheckoutOrderDraftId`]: order?.orderId || null,
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'awaiting_agency_confirmation',
                [`metadata.perAgentMemory.${agentProfile.key}.lastCheckoutOrderDataAt`]: new Date(),
                [`metadata.perAgentMemory.${agentProfile.key}.lastCheckoutOrderSummarySentAt`]: new Date()
            }
        }
    );

    if (order) {
        order.package = {
            id: offer.quantity,
            label: orderPackageLabel({ customerContext, quantity: offer.quantity }),
            quantity: offer.quantity
        };
        order.total = offer.total;
        order.conversationMemory = {
            ...(order.conversationMemory || {}),
            funnelStage: 'awaiting_agency_confirmation',
            currentIntent: 'purchase_intent',
            selectedQuantity: offer.quantity,
            selectedValue: offer.value,
            lastBotMessageAt: new Date()
        };
        await order.save();
    }

    console.log(`[FUNIL] Dados do formulario resumidos para confirmacao -> ${jid} | etapa=awaiting_agency_confirmation | pedido=${order?.orderId || 'sem_pedido'}`);
    return true;
};

const isSelectedPackageChoice = (text, parsedOrder = {}) => {
    const body = normalizeFieldLabel(text);
    const quantity = normalizePackageQuantity(parsedOrder.quantity);
    if (quantity === 1) {
        return /^(1|un|uno|una|1 frasco|un frasco|una botella|uno|quiero 1|quiero un|quiero uno|quiero un frasco|1 frasco vit power|un frasco vit power)$/.test(body)
            || /\b1\s*frasco\b/i.test(body)
            || /\bun\s*(frasco|mes|tratamiento|producto)\b/i.test(body);
    }
    if (quantity === 2) {
        return /^(2|dos|2 frascos|dos frascos|quiero 2|quiero dos|quiero dos frascos|2 frascos vit power|dos frascos vit power)$/.test(body)
            || /\b2\s*frascos\b/i.test(body)
            || /\bdos\s*(frascos|meses|tratamientos|productos)\b/i.test(body);
    }
    if (quantity === 3) {
        return /^(3|tres|3 frascos|tres frascos|quiero 3|quiero tres|quiero tres frascos|3 frascos vit power|tres frascos vit power)$/.test(body)
            || /\b3\s*frascos\b/i.test(body)
            || /\btres\s*(frascos|meses|tratamientos|productos)\b/i.test(body);
    }
    return /^(6|seis|6 frascos|seis frascos|quiero 6|quiero seis|quiero seis frascos|6 frascos vit power|seis frascos vit power)$/.test(body)
        || /\b6\s*frascos\b/i.test(body)
        || /\bseis\s*(frascos|meses|tratamientos|productos)\b/i.test(body);
};

const isAgencyDeliveryChoice = (text) => /(ag[eê]ncia|agencia|servientrega|oficina|retiro|retirar)/i.test(String(text || ''));
const isHomeDeliveryChoice = (text) => /(domicilio|domic[íi]lio|casa|cas\b|residencia|residência|trabajo|trabalho|direccion|direcci[oó]n|entrega en casa|mi\s+cas\b)/i.test(String(text || ''));

const hasAgencyIndicationData = (text) => {
    const body = String(text || '').trim();
    if (!body) return false;
    const hasCityOrProvince = /(ciudad|provincia|quito|guayaquil|cuenca|santo domingo|machala|manta|ambato|loja|riobamba|esmeraldas|portoviejo|ibarra|quevedo|latacunga|milagro|babahoyo)/i.test(body);
    const hasAgencyHint = /(servientrega|ag[eê]ncia|agencia|oficina|centro|norte|sur|terminal|mall|avenida|av\.|calle|direcci[oó]n|direccion|referencia)/i.test(body);
    return body.length >= 12 && (hasCityOrProvince || hasAgencyHint);
};

const titleCaseDeliveryPart = (value) => String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.length <= 2 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const stripAgencyNoise = (value) => cleanFieldValue(value)
    .replace(/por\s+favor[,\s]*/gi, '')
    .replace(/env[ií]eme\s+a\s+una?\s*/gi, '')
    .replace(/env[ií]eme\s+a\s*/gi, '')
    .replace(/ag[eê]ncia\s+de\s+servientrega\s*[:：,-]?\s*/gi, '')
    .replace(/agencia\s+servientrega\s*[:：,-]?\s*/gi, '')
    .replace(/servientrega\s*[:：,-]?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,.;:\s-]+|[,.;:\s-]+$/g, '')
    .trim();

const splitAgencyDestination = (rawValue = '') => {
    const cleaned = stripAgencyNoise(rawValue);
    const parts = cleaned
        .split(',')
        .map((part) => cleanFieldValue(part).replace(/[.]+$/g, '').trim())
        .filter(Boolean);

    if (parts.length === 0) {
        return {
            destination: '',
            agency: '',
            address: ''
        };
    }

    const province = parts.length >= 2 ? parts[parts.length - 2] : '';
    const city = parts.length >= 1 ? parts[parts.length - 1] : '';
    const agency = parts[0] || '';
    const addressParts = parts.slice(1, Math.max(1, parts.length - 2));
    const address = addressParts.join(', ');

    return {
        destination: [city, province].filter(Boolean).map(titleCaseDeliveryPart).join(', '),
        agency: titleCaseDeliveryPart(agency),
        address: titleCaseDeliveryPart(address || cleaned),
        city: city ? titleCaseDeliveryPart(city) : '',
        province: province ? titleCaseDeliveryPart(province) : '',
        cleaned
    };
};

const parseAgencyDetailsMessage = (text) => {
    const fields = {};
    const lines = String(text || '').split(/\r?\n/);
    for (const line of lines) {
        const match = line.match(/^\s*([^:：]+)\s*[:：]\s*(.+?)\s*$/);
        if (!match) continue;
        const label = normalizeFieldLabel(match[1]);
        const value = cleanFieldValue(match[2]);
        if (!value) continue;

        if (/^(provincia|departamento|estado|region)$/.test(label)) fields.province = value;
        else if (/^(ciudad|cidade|city)$/.test(label)) fields.city = value;
        else if (/^(direccion|endereco|direcao|address|agencia|servientrega|oficina)$/.test(label)) fields.address = value;
        else if (/^(referencia|punto de referencia|ponto de referencia|bairro|barrio)$/.test(label)) fields.reference = value;
    }

    const raw = cleanFieldValue(text);
    const parsed = splitAgencyDestination(raw);
    if (!fields.province && parsed.province) fields.province = parsed.province;
    if (!fields.city && parsed.city) fields.city = parsed.city;
    if (!fields.address && parsed.address) fields.address = parsed.address;
    if (!fields.reference && parsed.address) fields.reference = parsed.address;
    const lookup = resolveServientregaEcuadorAgency({
        city: fields.city || parsed.city,
        province: fields.province || parsed.province,
        agencyName: parsed.agency,
        address: fields.reference || fields.address || parsed.address,
        text: raw
    });
    const fallbackOptions = lookup.suggestions?.length
        ? []
        : findServientregaEcuadorAgencies({
            city: raw,
            province: raw,
            query: raw,
            limit: 3
        });
    const agencyOptions = lookup.suggestions?.length ? lookup.suggestions : fallbackOptions;
    const matchedAgency = lookup.confident ? lookup.best : null;
    return {
        ...fields,
        province: matchedAgency?.province || fields.province,
        city: matchedAgency?.city || fields.city,
        agencyName: matchedAgency?.name || parsed.agency || fields.address || raw,
        agencyAddress: matchedAgency?.address || fields.reference || fields.address || parsed.address || raw,
        agencySector: matchedAgency?.sector || '',
        agencyWeekdayHours: matchedAgency?.weekdayHours || '',
        agencyWeekendHours: matchedAgency?.weekendHours || '',
        agencyValidated: Boolean(matchedAgency),
        agencyOptions,
        rawAgencyDetails: raw,
        cleanedAgencyDetails: parsed.cleaned || stripAgencyNoise(raw)
    };
};

const buildAgencyOptionsSelectionText = (parsedOrder = {}) => {
    const options = Array.isArray(parsedOrder.agencyOptions) ? parsedOrder.agencyOptions.slice(0, 3) : [];
    const destination = [parsedOrder.city, parsedOrder.province].filter(Boolean).join(', ');
    const letters = ['A', 'B', 'C'];
    return [
        destination
            ? `Perfecto. Para evitar error, encontre estas agencias de Servientrega en ${destination}:`
            : 'Perfecto. Para evitar error, encontre estas agencias de Servientrega:',
        '',
        ...options.map((agency, index) => formatAgencyOptionLine(agency, letters[index] || String(index + 1))),
        '',
        'Me responde con la letra de la agencia que prefiere: A, B o C. Tambien puede escribir el nombre, por ejemplo: Principal, Centro o Calle Vivar.'
    ].join('\n');
};

const buildAgencyDetailsConfirmationText = (parsedOrder = {}) => {
    const parsed = splitAgencyDestination(parsedOrder.cleanedAgencyDetails || parsedOrder.rawAgencyDetails || parsedOrder.address || parsedOrder.agencyAddress || '');
    const destination = [parsedOrder.city || parsed.city, parsedOrder.province || parsed.province].filter(Boolean).join(', ');
    const agency = parsedOrder.agencyName || parsed.agency;
    const address = parsedOrder.agencyAddress || parsedOrder.address || parsed.address;
    const lines = [
        'Perfecto, ya tengo estos datos para el retiro:'
    ];
    if (destination) lines.push(`Destino: ${destination}`);
    if (agency) lines.push(`Punto de Retiro: Agencia Servientrega ${agency}`);
    if (address) lines.push(`Direccion: ${address}`);
    if (parsedOrder.agencyValidated) lines.push('Agencia confirmada en nuestra lista oficial de Servientrega.');
    lines.push('');
    lines.push('Para completar el pedido, me envia por favor su nombre completo?');
    return lines.join('\n');
};

const buildAgencyQuantityRequestText = (parsedOrder = {}) => {
    const destination = [parsedOrder.city, parsedOrder.province].filter(Boolean).join(', ');
    const lines = [
        'Perfecto, ya deje marcada esta agencia para su retiro:'
    ];
    if (destination) lines.push(`Destino: ${destination}`);
    if (parsedOrder.agencyName) lines.push(`Punto de Retiro: Agencia Servientrega ${parsedOrder.agencyName}`);
    if (parsedOrder.agencyAddress) lines.push(`Direccion: ${parsedOrder.agencyAddress}`);
    lines.push('');
    lines.push('Ahora digame cuantos frascos desea llevar: 1, 3 o 6.');
    return lines.join('\n');
};

const buildFinalCustomerDataConfirmationText = (parsedOrder = {}) => {
    const parsed = splitAgencyDestination(parsedOrder.cleanedAgencyDetails || parsedOrder.rawAgencyDetails || parsedOrder.address || parsedOrder.agencyAddress || '');
    const destination = [parsedOrder.city || parsed.city, parsedOrder.province || parsed.province].filter(Boolean).join(', ');
    const agency = parsedOrder.agencyName || parsed.agency;
    const address = parsedOrder.agencyAddress || parsedOrder.address || parsed.address;
    const lines = [
        '✅ ¡Perfecto! Su pedido ha sido registrado con éxito.',
        ''
    ];
    lines.push(`👤 Cliente: ${parsedOrder.name || 'no informado'}`);
    if (destination) lines.push(`📍 Destino: ${destination}`);
    if (agency) lines.push(`🏢 Punto de Retiro: Agencia Servientrega ${agency}`);
    if (address) lines.push(`🏠 Dirección: ${address}`);
    if (parsedOrder.agencyValidated) lines.push('✅ Agencia confirmada en nuestra lista oficial de Servientrega');
    lines.push('');
    lines.push('¿Los datos son correctos para proceder con el envío hoy mismo?');
    return lines.join('\n');
};

const selectAgencyOptionFromText = (text, options = []) => {
    const normalized = normalizeFieldLabel(text);
    const letterMatch = normalized.match(/^(?:opcion\s+|agencia\s+|letra\s+|alternativa\s+)?([abc])$/i)
        || normalized.match(/^([abc])\b/i)
        || normalized.match(/\b(?:opcion|agencia|letra|alternativa|escojo|elijo|quiero|prefiero|la|el)\s+([abc])\b/i);
    const letterIndex = letterMatch ? ['a', 'b', 'c'].indexOf(letterMatch[1].toLowerCase()) : -1;
    if (letterIndex >= 0 && letterIndex < options.length) return options[letterIndex];

    const ordinalMap = [
        ['primera', 'primeira', 'primer', 'primero', 'uno'],
        ['segunda', 'segundo', 'dos'],
        ['tercera', 'terceira', 'tercer', 'tercero', 'tres']
    ];
    const normalizedWords = normalized.split(/\s+/).filter(Boolean);
    const ordinalIndex = ordinalMap.findIndex((words) => words.some((word) => normalizedWords.includes(word)));
    if (ordinalIndex >= 0 && ordinalIndex < options.length) return options[ordinalIndex];

    const explicitNumberMatch = normalized.match(/\b(?:opcion|agencia|alternativa|numero)\s+([1-3])\b/i);
    const number = Number.parseInt(explicitNumberMatch?.[1] || '', 10);
    if (number >= 1 && number <= options.length) return options[number - 1];

    return options.find((option) => {
        const optionText = normalizeFieldLabel(`${option.name} ${option.address} ${option.city} ${option.sector}`);
        return normalized.length >= 4 && optionText.includes(normalized);
    }) || null;
};

const isConfirmationOnlyText = (text) => {
    const body = normalizeFieldLabel(text);
    if (!body || body.length > 80) return false;
    return /^(si|sii|claro|correcto|correto|correcta|todo correcto|esta correcto|esta ok|ok esta ok|ok|okay|listo|perfecto|confirmo|confirmado|de acuerdo|dale|hagale|asi es|si gracias|ok gracias)$/.test(body);
};

const looksLikeCustomerFullName = (text) => {
    const body = cleanFieldValue(text);
    if (body.length < 5) return false;
    if (isConfirmationOnlyText(body)) return false;
    if (isAgencyDeliveryChoice(body) || isHomeDeliveryChoice(body)) return false;
    if (/(frasco|frascos|producto|vit power|precio|funciona|demora|llega|agencia|servientrega)/i.test(body)) return false;
    const words = body
        .split(/\s+/)
        .map((word) => word.replace(/[^\p{L}]/gu, ''))
        .filter((word) => word.length >= 2);
    return words.length >= 2;
};

const buildCustomerNameRetryText = () => 'Perfecto. Solo me falta su nombre completo para dejar el pedido bien registrado. Me lo envia por favor?';

const buildSelectedQuantityOrder = ({ quantity, customerContext }) => {
    const offer = getSelectedOffer(customerContext, { quantity });
    return {
        quantity: offer.quantity,
        total: offer.total,
        stage: 'awaiting_delivery_mode',
        source: 'whatsapp_package_selection'
    };
};

const confirmCustomerNameAndAskFinalApproval = async ({
    jid,
    parsedOrder,
    customerContext,
    agentProfile,
    contactStateId,
    peerPhone,
    inboundText,
    sessionId = null
}) => {
    const name = cleanFieldValue(inboundText);
    if (!looksLikeCustomerFullName(name)) {
        const replyText = buildCustomerNameRetryText();
        const sent = await sendText(jid, replyText, null, { sessionId });
        if (!sent) return false;
        try {
            await Message.create({
                _id: `out_${Date.now()}_customer_name_retry`,
                chatId: jid,
                peerPhone,
                from: 'bot',
                to: jid,
                body: replyText,
                isFromMe: true,
                isBot: true,
                timestamp: Math.floor(Date.now() / 1000)
            });
        } catch (e) { }
        await savePendingCheckoutOrderMemory({
            contactStateId,
            agentProfile,
            parsedOrder: {
                ...parsedOrder,
                stage: 'awaiting_customer_name'
            },
            stage: 'awaiting_customer_name',
            orderId: null
        });
        await updateContactStateAgentMemory({
            contactStateId,
            agentProfile,
            inboundText,
            outboundText: replyText,
            inferredIntent: 'purchase_intent',
            inferredFunnelStage: 'awaiting_customer_name',
            inferredObjection: null
        });
        console.log(`[FUNIL] Confirmacao curta rejeitada como nome; nome completo solicitado novamente -> ${jid}`);
        return true;
    }

    const offer = getSelectedOffer(customerContext, parsedOrder);
    const normalizedOrder = {
        ...parsedOrder,
        name,
        quantity: offer.quantity,
        total: offer.total,
        stage: 'awaiting_agency_confirmation'
    };
    const replyText = buildFinalCustomerDataConfirmationText(normalizedOrder);
    const sent = await sendText(jid, replyText, null, { sessionId });
    if (!sent) return false;

    try {
        await Message.create({
            _id: `out_${Date.now()}_final_data_confirm`,
            chatId: jid,
            peerPhone,
            from: 'bot',
            to: jid,
            body: replyText,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    const order = await updateOrderAfterAgencyStep({
        parsedOrder: normalizedOrder,
        customerContext,
        peerPhone,
        stage: 'awaiting_agency_confirmation'
    });

    await savePendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        parsedOrder: normalizedOrder,
        stage: 'awaiting_agency_confirmation',
        orderId: order?.orderId || null
    });

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText,
        outboundText: replyText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: 'awaiting_agency_confirmation',
        inferredObjection: null
    });

    console.log(`[FUNIL] Nome confirmado e resumo final enviado -> ${jid} | pedido=${order?.orderId || 'sem_pedido'}`);
    return true;
};

const confirmAgencyDetailsAndAskName = async ({
    jid,
    parsedOrder,
    customerContext,
    agentProfile,
    contactStateId,
    peerPhone,
    inboundText,
    sessionId = null
}) => {
    const agencyDetails = parseAgencyDetailsMessage(inboundText);
    const offer = getSelectedOffer(customerContext, parsedOrder);
    const normalizedOrder = {
        ...parsedOrder,
        ...agencyDetails,
        quantity: offer.quantity,
        total: offer.total,
        deliveryMode: 'agency',
        stage: 'awaiting_customer_name'
    };

    if (!normalizedOrder.agencyValidated && normalizedOrder.agencyOptions?.length) {
        const replyText = buildAgencyOptionsSelectionText({
            ...normalizedOrder,
            stage: 'awaiting_agency_selection'
        });
        const sent = await sendText(jid, replyText, null, { sessionId });
        if (!sent) return false;
        try {
            await Message.create({
                _id: `out_${Date.now()}_agency_options`,
                chatId: jid,
                peerPhone,
                from: 'bot',
                to: jid,
                body: replyText,
                isFromMe: true,
                isBot: true,
                timestamp: Math.floor(Date.now() / 1000)
            });
        } catch (e) { }
        await savePendingCheckoutOrderMemory({
            contactStateId,
            agentProfile,
            parsedOrder: {
                ...normalizedOrder,
                stage: 'awaiting_agency_selection'
            },
            stage: 'awaiting_agency_selection',
            orderId: null
        });
        await updateContactStateAgentMemory({
            contactStateId,
            agentProfile,
            inboundText,
            outboundText: replyText,
            inferredIntent: 'purchase_intent',
            inferredFunnelStage: 'awaiting_agency_selection',
            inferredObjection: null
        });
        console.log(`[FUNIL] Opcoes de agencia Servientrega enviadas -> ${jid}`);
        return true;
    }

    const replyText = buildAgencyDetailsConfirmationText(normalizedOrder);
    const sent = await sendText(jid, replyText, null, { sessionId });
    if (!sent) return false;

    try {
        await Message.create({
            _id: `out_${Date.now()}_agency_confirmed_ask_name`,
            chatId: jid,
            peerPhone,
            from: 'bot',
            to: jid,
            body: replyText,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    await savePendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        parsedOrder: normalizedOrder,
        stage: 'awaiting_customer_name',
        orderId: null
    });

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText,
        outboundText: replyText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: 'awaiting_customer_name',
        inferredObjection: null
    });

    console.log(`[FUNIL] Dados de agencia confirmados; nome solicitado -> ${jid}`);
    return true;
};

const confirmAgencySelectionAndAskName = async ({
    jid,
    parsedOrder,
    customerContext,
    agentProfile,
    contactStateId,
    peerPhone,
    inboundText,
    sessionId = null
}) => {
    const selected = selectAgencyOptionFromText(inboundText, parsedOrder.agencyOptions || []);
    if (!selected) {
        const replyText = buildAgencyOptionsSelectionText(parsedOrder);
        const sent = await sendText(jid, replyText, null, { sessionId });
        if (!sent) return false;
        await updateContactStateAgentMemory({
            contactStateId,
            agentProfile,
            inboundText,
            outboundText: replyText,
            inferredIntent: 'purchase_intent',
            inferredFunnelStage: 'awaiting_agency_selection',
            inferredObjection: null
        });
        return true;
    }

    const shouldResumeQuantity = parsedOrder.source === 'agency_interrupt'
        || parsedOrder.stage === 'awaiting_agency_selection_interrupt'
        || !parsedOrder.quantity;
    const offer = shouldResumeQuantity ? null : getSelectedOffer(customerContext, parsedOrder);
    const normalizedOrder = {
        ...parsedOrder,
        province: selected.province || parsedOrder.province,
        city: selected.city || parsedOrder.city,
        agencyName: selected.name,
        agencyAddress: selected.address,
        agencySector: selected.sector || '',
        agencyWeekdayHours: selected.weekdayHours || '',
        agencyWeekendHours: selected.weekendHours || '',
        agencyValidated: true,
        quantity: shouldResumeQuantity ? parsedOrder.quantity : offer.quantity,
        total: shouldResumeQuantity ? parsedOrder.total : offer.total,
        deliveryMode: 'agency',
        source: parsedOrder.source || (shouldResumeQuantity ? 'agency_interrupt' : parsedOrder.source),
        stage: shouldResumeQuantity ? 'awaiting_package_choice_after_agency' : 'awaiting_customer_name'
    };
    const replyText = shouldResumeQuantity
        ? buildAgencyQuantityRequestText(normalizedOrder)
        : buildAgencyDetailsConfirmationText(normalizedOrder);
    const sent = await sendText(jid, replyText, null, { sessionId });
    if (!sent) return false;
    try {
        await Message.create({
            _id: `out_${Date.now()}_agency_selection_confirmed`,
            chatId: jid,
            peerPhone,
            from: 'bot',
            to: jid,
            body: replyText,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    await savePendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        parsedOrder: normalizedOrder,
        stage: normalizedOrder.stage,
        orderId: null
    });
    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText,
        outboundText: replyText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: normalizedOrder.stage,
        inferredObjection: null
    });
    console.log(`[FUNIL] Agencia Servientrega escolhida -> ${jid} | etapa=${normalizedOrder.stage}`);
    return true;
};

const confirmAgencyQuantityAndAskName = async ({
    jid,
    parsedOrder,
    customerContext,
    agentProfile,
    contactStateId,
    peerPhone,
    inboundText,
    sessionId = null
}) => {
    const quantity = detectRequestedQuantity(inboundText);
    if (!quantity) return false;

    const offer = getSelectedOffer(customerContext, { quantity });
    const normalizedOrder = {
        ...parsedOrder,
        quantity: offer.quantity,
        total: offer.total,
        deliveryMode: 'agency',
        stage: 'awaiting_customer_name'
    };
    const replyText = buildAgencyDetailsConfirmationText(normalizedOrder);
    const sent = await sendText(jid, replyText, null, { sessionId });
    if (!sent) return false;

    try {
        await Message.create({
            _id: `out_${Date.now()}_agency_quantity_confirmed`,
            chatId: jid,
            peerPhone,
            from: 'bot',
            to: jid,
            body: replyText,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    await savePendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        parsedOrder: normalizedOrder,
        stage: 'awaiting_customer_name',
        orderId: null
    });
    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText,
        outboundText: replyText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: 'awaiting_customer_name',
        inferredObjection: null
    });
    console.log(`[FUNIL] Quantidade confirmada apos agencia antecipada -> ${jid} | quantidade=${offer.quantity}`);
    return true;
};

const askDeliveryModeAfterPackageSelection = async ({
    jid,
    customerContext,
    agentProfile,
    contactStateId,
    peerPhone,
    quantity,
    inboundText,
    sessionId = null
}) => {
    const pendingOrder = buildSelectedQuantityOrder({ quantity, customerContext });
    const audioSent = await sendFirstApprovedAudio({
        jid,
        countryCode: customerContext.countryCode,
        sessionId,
        baseNames: DELIVERY_MODE_AUDIO_NAMES,
        label: 'Audio pergunta agencia ou domicilio'
    });

    const fallbackText = 'Perfecto. Para enviar su pedido, me confirma si lo desea retirar en una agencia de Servientrega o recibir en su domicilio?';
    if (!audioSent) {
        const sent = await sendText(jid, fallbackText, null, { sessionId });
        if (!sent) return false;
    }

    try {
        await Message.create({
            _id: `out_${Date.now()}_delivery_mode`,
            chatId: jid,
            peerPhone,
            from: 'bot',
            to: jid,
            body: audioSent ? '[AUDIO] PERGUNTA_AGENCIA_DOMICILIO' : fallbackText,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    await savePendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        parsedOrder: pendingOrder,
        stage: 'awaiting_delivery_mode',
        orderId: null
    });

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText,
        outboundText: audioSent ? '[AUDIO] PERGUNTA_AGENCIA_DOMICILIO' : fallbackText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: 'awaiting_delivery_mode',
        inferredObjection: null
    });

    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${agentProfile.key}.selectedQuantity`]: quantity,
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'awaiting_delivery_mode',
                [`metadata.perAgentMemory.${agentProfile.key}.deliveryModeQuestionSentAt`]: new Date()
            }
        }
    );

    console.log(`[FUNIL] Pergunta agencia/domicilio enviada -> ${jid} | quantidade=${quantity} | audio=${audioSent}`);
    return true;
};

const askAgencyDetails = async ({
    jid,
    parsedOrder,
    customerContext,
    agentProfile,
    contactStateId,
    peerPhone,
    inboundText,
    sessionId = null
}) => {
    const normalizedOrder = {
        ...parsedOrder,
        deliveryMode: 'agency',
        stage: 'awaiting_agency_details'
    };
    const audioSent = await sendFirstApprovedAudio({
        jid,
        countryCode: customerContext.countryCode,
        sessionId,
        baseNames: AGENCY_DETAILS_AUDIO_NAMES,
        label: 'Audio dados agencia cidade provincia'
    });

    const fallbackText = 'Perfecto. Para enviar por agencia Servientrega, me envia por favor ciudad, provincia y la agencia o direccion de referencia donde desea retirar.';
    if (!audioSent) {
        const sent = await sendText(jid, fallbackText, null, { sessionId });
        if (!sent) return false;
    }

    try {
        await Message.create({
            _id: `out_${Date.now()}_agency_details`,
            chatId: jid,
            peerPhone,
            from: 'bot',
            to: jid,
            body: audioSent ? '[AUDIO] ENDERECO_CIDADE_PROVINCIA_AGENCIA' : fallbackText,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    await savePendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        parsedOrder: normalizedOrder,
        stage: 'awaiting_agency_details',
        orderId: null
    });

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText,
        outboundText: audioSent ? '[AUDIO] ENDERECO_CIDADE_PROVINCIA_AGENCIA' : fallbackText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: 'awaiting_agency_details',
        inferredObjection: null
    });

    console.log(`[FUNIL] Dados de agencia solicitados -> ${jid} | audio=${audioSent}`);
    return true;
};

const getPendingCheckoutStage = (pendingCheckoutOrder = {}) => {
    const order = pendingCheckoutOrder || {};
    return order.stage
    || order.funnelStage
    || order.nextStep
    || ''
};

const updateOrderAfterAgencyStep = async ({ parsedOrder, customerContext, peerPhone, stage, status = null }) => {
    const order = await upsertCheckoutOrderDraft({ parsedOrder, customerContext, peerPhone });
    if (!order) return null;
    const offer = getSelectedOffer(customerContext, parsedOrder);
    const agency = getAgencyDetails(parsedOrder);

    order.package = {
        id: offer.quantity,
        label: orderPackageLabel({ customerContext, quantity: offer.quantity }),
        quantity: offer.quantity
    };
    order.total = offer.total;
    if (status) order.status = status;
    order.notes = [
        `Agencia: ${agency.name}`,
        `Direccion agencia: ${agency.address}`
    ].join('\n');
    order.conversationMemory = {
        ...(order.conversationMemory || {}),
        funnelStage: stage,
        currentIntent: 'purchase_intent',
        selectedAgencyName: agency.name,
        selectedAgencyAddress: agency.address,
        selectedQuantity: offer.quantity,
        selectedValue: offer.value,
        lastBotMessageAt: new Date()
    };
    await order.save();
    if (order.status === 'confirmed') {
        await markMetaPurchaseForConfirmedOrder(order);
    }
    return order;
};

const sendAgencyConfirmationRequest = async ({
    jid,
    parsedOrder,
    customerContext,
    agentProfile,
    contactStateId,
    peerPhone,
    sessionId = null
}) => {
    const offer = getSelectedOffer(customerContext, parsedOrder);
    const normalizedOrder = {
        ...parsedOrder,
        quantity: offer.quantity,
        total: offer.total,
        stage: 'awaiting_agency_confirmation'
    };
    const replyText = buildCheckoutAgencyConfirmationText({ parsedOrder: normalizedOrder, customerContext });
    const sent = await sendText(jid, replyText, null, { sessionId });
    if (!sent) return false;
    await sendQuantitySelectionAudio({
        jid,
        countryCode: customerContext.countryCode,
        quantity: offer.quantity,
        sessionId,
        peerPhone
    });

    try {
        await Message.create({
            _id: `out_${Date.now()}_agency_confirm`,
            chatId: jid,
            peerPhone,
            from: 'bot',
            to: jid,
            body: replyText,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    const order = await updateOrderAfterAgencyStep({
        parsedOrder: normalizedOrder,
        customerContext,
        peerPhone,
        stage: 'awaiting_agency_confirmation'
    });

    await savePendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        parsedOrder: normalizedOrder,
        stage: 'awaiting_agency_confirmation',
        orderId: order?.orderId || null
    });

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText: `${offer.quantity} FRASCO${offer.quantity > 1 ? 'S' : ''}`,
        outboundText: replyText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: 'awaiting_agency_confirmation',
        inferredObjection: null
    });

    console.log(`[FUNIL] Confirmacao de agencia solicitada -> ${jid} | pedido=${order?.orderId || 'sem_pedido'}`);
    return true;
};

const finalizeAgencyOrder = async ({
    jid,
    parsedOrder,
    customerContext,
    agentProfile,
    contactStateId,
    peerPhone,
    sessionId = null
}) => {
    const offer = getSelectedOffer(customerContext, parsedOrder);
    const normalizedOrder = {
        ...parsedOrder,
        quantity: offer.quantity,
        total: offer.total,
        stage: 'order_closed'
    };

    const order = await updateOrderAfterAgencyStep({
        parsedOrder: normalizedOrder,
        customerContext,
        peerPhone,
        stage: 'order_closed',
        status: 'confirmed'
    });

    const thankYouText = buildOrderClosedThankYouText({
        deliveryMode: 'agency',
        customerContext
    });
    const textSent = await sendText(jid, thankYouText, null, { sessionId });
    if (!textSent) {
        console.warn(`[FUNIL] Texto de fechamento por agencia nao entregue -> ${jid} | pedido=${order?.orderId || 'sem_pedido'}`);
    }

    const { thankYouAudioSent, bonusNoticeAudioSent } = await sendOrderClosedAudios({
        jid,
        countryCode: customerContext.countryCode,
        sessionId
    });

    try {
        await Message.create({
            _id: `out_${Date.now()}_agency_closed`,
            chatId: jid,
            peerPhone,
            from: 'bot',
            to: jid,
            body: thankYouText,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    await clearPendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        stage: 'order_closed',
        orderId: order?.orderId || null
    });

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText: 'SIM',
        outboundText: thankYouText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: 'order_closed',
        inferredObjection: null
    });

    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedThankYouSentAt`]: new Date(),
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedDeliveryMode`]: 'agency',
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedAudioSent`]: thankYouAudioSent,
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedBonusNoticeAudioSent`]: bonusNoticeAudioSent,
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'order_closed',
                'metadata.lastKnownFunnelStage': 'order_closed'
            }
        }
    );

    console.log(`[FUNIL] Pedido por agencia finalizado -> ${jid} | pedido=${order?.orderId || 'sem_pedido'}`);
    return true;
};

const finalizeCheckoutOrder = async ({
    jid,
    parsedOrder,
    customerContext,
    agentProfile,
    contactStateId,
    peerPhone,
    sessionId = null
}) => {
    const offer = getSelectedOffer(customerContext, parsedOrder);
    const agency = getAgencyDetails(parsedOrder);
    const deliveryMode = parsedOrder.deliveryMode === 'agency' || agency.isAgency ? 'agency' : 'home';
    const normalizedOrder = {
        ...parsedOrder,
        deliveryMode,
        quantity: offer.quantity,
        total: offer.total,
        stage: 'order_closed'
    };

    let order = null;
    if (deliveryMode === 'agency') {
        order = await updateOrderAfterAgencyStep({
            parsedOrder: normalizedOrder,
            customerContext,
            peerPhone,
            stage: 'order_closed',
            status: 'confirmed'
        });
    } else {
        order = await upsertCheckoutOrderDraft({
            parsedOrder: normalizedOrder,
            customerContext,
            peerPhone
        });
        if (order) {
            order.status = 'confirmed';
            order.package = {
                id: offer.quantity,
                label: orderPackageLabel({ customerContext, quantity: offer.quantity }),
                quantity: offer.quantity
            };
            order.total = offer.total;
            order.notes = normalizedOrder.reference ? `Referencia: ${normalizedOrder.reference}` : order.notes;
            order.conversationMemory = {
                ...(order.conversationMemory || {}),
                activeAgent: agentProfile.key,
                funnelStage: 'order_closed',
                currentIntent: 'purchase_intent',
                selectedQuantity: offer.quantity,
                selectedValue: offer.value,
                orderClosedDeliveryMode: 'home',
                lastBotMessageAt: new Date()
            };
            await order.save();
            await markMetaPurchaseForConfirmedOrder(order);
        }
    }

    const thankYouText = buildOrderClosedThankYouText({
        deliveryMode,
        customerContext
    });
    const textSent = await sendText(jid, thankYouText, null, { sessionId });
    if (!textSent) {
        console.warn(`[FUNIL] Texto de fechamento checkout nao entregue -> ${jid} | pedido=${order?.orderId || 'sem_pedido'} | entrega=${deliveryMode}`);
        return false;
    }

    const { thankYouAudioSent, bonusNoticeAudioSent } = await sendOrderClosedAudios({
        jid,
        countryCode: customerContext.countryCode,
        sessionId
    });

    try {
        await Message.create({
            _id: `out_${Date.now()}_checkout_closed`,
            chatId: jid,
            peerPhone,
            from: 'bot',
            to: jid,
            body: thankYouText,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    await clearPendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        stage: 'order_closed',
        orderId: order?.orderId || null
    });

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText: 'SIM',
        outboundText: thankYouText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: 'order_closed',
        inferredObjection: null
    });

    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedThankYouSentAt`]: new Date(),
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedDeliveryMode`]: deliveryMode,
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedAudioSent`]: thankYouAudioSent,
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedBonusNoticeAudioSent`]: bonusNoticeAudioSent,
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'order_closed',
                'metadata.lastKnownFunnelStage': 'order_closed'
            }
        }
    );

    console.log(`[FUNIL] Pedido checkout finalizado -> ${jid} | pedido=${order?.orderId || 'sem_pedido'} | entrega=${deliveryMode}`);
    return true;
};

const finalizeQuantityConfirmationOnly = async ({
    jid,
    customerContext,
    agentProfile,
    contactStateId,
    peerPhone,
    inboundText,
    sessionId = null
}) => {
    const thankYouAudioSent = await sendFirstApprovedAudio({
        jid,
        countryCode: customerContext.countryCode,
        sessionId,
        baseNames: ORDER_CLOSED_AUDIO_NAMES,
        label: 'Audio de agradecimento apos quantidade'
    });

    const bonusNoticeAudioSent = thankYouAudioSent && ORDER_CLOSED_BONUS_AUDIO_NAMES.length > 0
        ? await sendFirstApprovedAudio({
            jid,
            countryCode: customerContext.countryCode,
            sessionId,
            baseNames: ORDER_CLOSED_BONUS_AUDIO_NAMES,
            label: 'Audio bonus apos quantidade'
        })
        : false;

    try {
        await Message.create({
            _id: `out_${Date.now()}_quantity_closed`,
            chatId: jid,
            peerPhone,
            from: 'bot',
            to: jid,
            body: '[AUDIO] AGRADECIMENTO',
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText,
        outboundText: '[AUDIO] AGRADECIMENTO',
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: 'order_closed',
        inferredObjection: null
    });

    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedThankYouSentAt`]: new Date(),
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedDeliveryMode`]: 'quantity_confirmed',
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedAudioSent`]: thankYouAudioSent,
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedBonusNoticeAudioSent`]: bonusNoticeAudioSent,
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'order_closed',
                'metadata.lastKnownFunnelStage': 'order_closed'
            }
        }
    );

    console.log(`[FUNIL] Fechamento apos quantidade confirmado -> ${jid} | agradecimento=${thankYouAudioSent} | bonus=${bonusNoticeAudioSent}`);
    return true;
};

const resolveRealChatId = (msg) => {
    const candidates = [msg.from, msg.to].filter(Boolean);
    const validId = candidates.find(c => String(c).endsWith('@s.whatsapp.net') || String(c).endsWith('@c.us'));
    return validId || msg.from || msg.to || null;
};

const inferCustomerCountry = (chatId) => {
    const digits = String(chatId || '').replace(/\D/g, '');
    if (digits.startsWith('593')) {
        return {
            country: 'Ecuador',
            countryCode: 'EC',
            phonePrefix: '593',
            product: 'Vit Power',
            priceTable: 'Vit Power: 1 frasco por 39 USD, 3 frascos por 95.99 USD, 6 frascos por 167.99 USD'
        };
    }

    return {
        country: 'Ecuador',
        countryCode: 'EC',
        phonePrefix: digits.slice(0, 4) || null,
        product: 'Vit Power',
        priceTable: 'Vit Power: 1 frasco por 39 USD, 3 frascos por 95.99 USD, 6 frascos por 167.99 USD'
    };
};

const customerContextFromCountryCode = (countryCode, fallbackPhonePrefix = null) => {
    return inferCustomerCountry('593');
};

const hasBotIntroducedItself = async (chatId) => {
    const introRegex = /soy ana (lopez|lopes)/i;
    const introMessage = await Message.findOne({
        chatId,
        isBot: true,
        body: { $regex: introRegex }
    }).sort({ createdAt: -1 });
    return !!introMessage;
};

const normalizeReplyText = (text) => String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const duplicateReplyWindowMs = () => {
    const minutes = Number(process.env.BOT_DUPLICATE_REPLY_WINDOW_MINUTES || 60);
    return Math.max(5, minutes) * 60 * 1000;
};

const shouldBlockDuplicateBotReply = ({ contactState, agentProfile, replyText }) => {
    const comparableReply = normalizeReplyText(replyText);
    if (!comparableReply) return false;

    const agentMemory = (((contactState?.metadata || {}).perAgentMemory || {})[agentProfile.key] || {});
    const lastOutboundText = normalizeReplyText(agentMemory.lastOutboundText || '');
    const lastOutboundAt = agentMemory.lastOutboundAt
        ? new Date(agentMemory.lastOutboundAt).getTime()
        : 0;

    return Boolean(
        lastOutboundText
        && lastOutboundText === comparableReply
        && lastOutboundAt
        && (Date.now() - lastOutboundAt) < duplicateReplyWindowMs()
    );
};

const ORDER_CLOSED_TAG_REGEX = /\[PEDIDO_CERRADO\]/gi;
const ORDER_CLOSED_AUDIO_NAMES = [
    'Agradecimento_Agencia_Entrega',
    'agradecimento_agencia_entrega',
    'agradecimentos_agencia_entrega',
    'Agradecimento_Agencia_01',
    'Agradecimento_Agencia',
    'AGRADECIMENTO',
    'AGRADECIMENTO_AGENCIA',
    'Pedido_Confirmado_01',
    'Pedido_Confirmado',
    'Agradecimento_Pedido',
    'Gracias_Pedido'
];
const ORDER_CLOSED_BONUS_AUDIO_NAMES = [
    'BONUS_RETIRADA'
];
const DELIVERY_MODE_AUDIO_NAMES = [
    'PERGUNTA_AGENCIA_DOMICILIO'
];
const AGENCY_DETAILS_AUDIO_NAMES = [
    'ENDERECO_CIDADE_PROVINCIA_AGENCIA'
];
const QUANTITY_SELECTION_AUDIO_NAMES = {
    1: [
        '1_BOTELLA_POR_39',
        '1_BOTELLA_POR_39_E_00',
        '1_FRASCO_POR_39',
        'UN_FRASCO_POR_39'
    ],
    3: [
        '3_BOTELLAS_POR_95_E_99'
    ],
    6: [
        '6_BOTELLAS_POR_167_E_99'
    ]
};

const sendFirstApprovedAudio = async ({ jid, countryCode, sessionId = null, baseNames = [], label = 'audio' }) => {
    for (const baseName of baseNames) {
        const audioPath = await resolveCountryAudio({ country: countryCode, baseName });
        if (!audioPath) continue;
        return sendAudio(jid, audioPath, true, { sessionId });
    }

    console.warn(`[AUDIO] ${label} aprovado nao encontrado para ${countryCode}. Esperado um destes: ${baseNames.join(', ')}`);
    return false;
};

const sendQuantitySelectionAudio = async ({
    jid,
    countryCode,
    quantity,
    sessionId = null,
    peerPhone = ''
}) => {
    if (String(process.env.QUANTITY_SELECTION_AUDIO_ENABLED || 'true').toLowerCase() !== 'true') {
        return false;
    }

    const baseNames = QUANTITY_SELECTION_AUDIO_NAMES[Number(quantity)] || [];
    if (!baseNames.length) return false;

    await sleep(randomMs('QUANTITY_SELECTION_AUDIO_MIN_MS', 'QUANTITY_SELECTION_AUDIO_MAX_MS', 2200, 5200));
    const sent = await sendFirstApprovedAudio({
        jid,
        countryCode,
        sessionId,
        baseNames,
        label: `audio_quantidade_${quantity}`
    });

    if (sent) {
        try {
            await Message.create({
                _id: `out_${Date.now()}_quantity_audio_${quantity}`,
                chatId: jid,
                peerPhone: peerPhone || digitsOnly(jid),
                from: 'bot',
                to: jid,
                body: `[AUDIO] ${baseNames[0]}`,
                type: 'audio',
                isFromMe: true,
                isBot: true,
                timestamp: Math.floor(Date.now() / 1000)
            });
        } catch (e) { }
    }

    console.log(`[FUNIL] Audio de quantidade -> ${jid} | quantidade=${quantity} | sent=${sent}`);
    return sent;
};

const sendOrderClosedAudios = async ({ jid, countryCode, sessionId = null }) => {
    if (String(process.env.ORDER_CLOSED_AUDIO_ENABLED || 'true').toLowerCase() !== 'true') {
        return { thankYouAudioSent: false, bonusNoticeAudioSent: false };
    }

    const thankYouAudioSent = await sendFirstApprovedAudio({
        jid,
        countryCode,
        sessionId,
        baseNames: ORDER_CLOSED_AUDIO_NAMES,
        label: 'Audio de agradecimento no fechamento'
    });

    const bonusNoticeAudioSent = ORDER_CLOSED_BONUS_AUDIO_NAMES.length > 0
        ? await sendFirstApprovedAudio({
            jid,
            countryCode,
            sessionId,
            baseNames: ORDER_CLOSED_BONUS_AUDIO_NAMES,
            label: 'Audio de aviso de bonus no fechamento'
        })
        : false;

    return { thankYouAudioSent, bonusNoticeAudioSent };
};

const COMMERCIAL_INITIAL_AUDIO_NAMES = {
    EC: ['Inicio_01', 'Inicio_02']
};

const buildInitialProofCaption = ({ customerContext, index }) => {
    const product = 'Vit Power';
    const captions = [
        `🔥 Mira lo que este cliente dijo de ${product}. Esto ayuda mucho a ver la confianza de quienes ya probaron el producto.`,
        `💬 Te comparto otra experiencia real con ${product}. Fijate como otros clientes cuentan su avance con el tratamiento.`,
        `✅ Otra referencia de cliente con ${product}. Lo importante es que puedas ver pruebas antes de decidir con tranquilidad.`,
        `✨ Este testimonio tambien es de ${product}. Por eso siempre te muestro experiencias reales antes de hablar de cantidad.`
    ];
    return captions[index % captions.length];
};

const buildInitialPriceText = (customerContext, selectedOrder = null) => {
    const base = [
        '💛 Estos son los valores de Vit Power:',
        '',
        '1 frasco: $39',
        '3 frascos: $95.99',
        '6 frascos: $167.99',
        '',
        '✅ El pago es contra entrega.'
    ];

    if (selectedOrder?.quantity) {
        return [...base, '', buildCheckoutPackageCtaText(customerContext, selectedOrder)].join('\n');
    }

    return [...base, 'Cuantos frascos desea llevar: 1, 3 o 6?'].join('\n');
};

const completedInitialStepsFromMemory = (agentMemory = {}) => new Set([
    ...((Array.isArray(agentMemory.initialProductPresentationSteps) ? agentMemory.initialProductPresentationSteps : [])),
    ...((Array.isArray(agentMemory.initialProductPresentationAudios)
        ? agentMemory.initialProductPresentationAudios
            .filter((item) => item?.sent)
            .map((item) => `audio:${item.baseName}`)
        : [])),
    ...((Array.isArray(agentMemory.initialProductPresentationImages)
        ? agentMemory.initialProductPresentationImages
            .filter((item) => item?.sent)
            .map((item) => `image:${item.key}`)
        : [])),
    ...(agentMemory.initialProductPresentationPriceSentAt
        ? ['text:price']
        : [])
]);

const expectedInitialStepsForCountry = () => (
    ['audio:Inicio_01', 'audio:Inicio_02', 'image:social_01', 'image:social_02', 'image:vit_power_bottle', 'text:price']
);

const countryCodeForAgentProfile = () => 'EC';

const phoneTailFilters = (phoneDigits = '') => {
    const digits = digitsOnly(phoneDigits);
    return [
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : ''
    ]
        .filter(Boolean)
        .map((tail) => ({ 'client.phone': { $regex: `${tail}$` } }));
};

const findDueRefillShipmentForGreeting = async ({ phoneDigits = '' } = {}) => {
    const phoneFilters = phoneTailFilters(phoneDigits);
    if (!phoneFilters.length) return null;

    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const overdueLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const shipments = await Shipment.find({
        country: 'EC',
        $or: phoneFilters,
        'automation.refillReminderAt': null,
        $and: [{
            $or: [
                { 'outcomes.pickedUp': true },
                { 'outcomes.delivered': true },
                { 'automation.deliveredConfirmedAt': { $ne: null } }
            ]
        }]
    }).sort({ updatedAt: -1, createdAt: -1 }).limit(5);

    return shipments.find((shipment) => {
        const dueAt = shipment.treatment?.refillReminderDueAt
            ? new Date(shipment.treatment.refillReminderDueAt)
            : null;
        const endsAt = shipment.treatment?.treatmentEndsAt
            ? new Date(shipment.treatment.treatmentEndsAt)
            : null;
        const triggerAt = dueAt || (endsAt ? new Date(endsAt.getTime() - 5 * 24 * 60 * 60 * 1000) : null);
        if (!triggerAt || Number.isNaN(triggerAt.getTime())) return false;
        return triggerAt <= soon && triggerAt >= overdueLimit;
    }) || null;
};

const maybeHandleSimpleGreetingRefill = async ({
    text,
    chatId,
    peerPhone,
    sessionId = null,
    contactStateId = null,
    agentProfile
}) => {
    if (!isSimpleGreeting(text)) return false;
    const shipment = await findDueRefillShipmentForGreeting({ phoneDigits: peerPhone || chatId });
    if (!shipment) return false;

    const reminderText = buildRefillReminderText(shipment);
    const textSent = await sendText(chatId, reminderText, null, { sessionId });
    if (!textSent) return false;

    const audioPath = await resolveCountryAudio({
        country: 'EC',
        baseName: 'TRATAMENTO_CONTINUA_NAO_EFEITO_IMEDIATO'
    });
    const audioSent = audioPath
        ? await sendAudio(chatId, audioPath, true, { sessionId })
        : false;

    const now = new Date();
    shipment.automation.refillReminderAt = now;
    shipment.automation.lastReminderAt = now;
    shipment.automation.lastReminderKind = 'refill_reminder_inbound_greeting';
    shipment.events.push({
        kind: 'refill_reminder_from_inbound_greeting',
        at: now,
        payload: { chatId, audioSent }
    });
    shipment.events = shipment.events.slice(-60);
    await shipment.save();

    try {
        await Message.create({
            _id: `out_${Date.now()}_refill_greeting`,
            chatId,
            peerPhone,
            from: 'bot',
            to: chatId,
            body: reminderText,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText: text,
        outboundText: reminderText,
        inferredIntent: 'repurchase_continuity',
        inferredFunnelStage: 'refill_reminder',
        inferredObjection: null
    });

    return true;
};

const isInitialProductPresentationDone = (agentMemory = {}, countryCode = 'EC') => {
    const completedSteps = completedInitialStepsFromMemory(agentMemory);
    return expectedInitialStepsForCountry(countryCode).every((step) => completedSteps.has(step));
};

const shouldBlockRepeatedInitialProductPresentation = ({ text, agentProfile, contactState }) => {
    const isCommercialAgent = agentProfile?.key === 'vit_power_ec';
    if (!isCommercialAgent) return false;
    if (!isInitialProductInquiry(text)) return false;

    const agentMemory = (((contactState?.metadata || {}).perAgentMemory || {})[agentProfile.key] || {});
    if (!isInitialProductPresentationDone(agentMemory, countryCodeForAgentProfile(agentProfile))) return false;

    // Form messages with order data should proceed to the order/data flow, not repeat the presentation.
    return !looksLikeOrderDataMessage(text);
};

const sendInitialProductPresentation = async ({
    jid,
    contactStateId = null,
    customerContext,
    sessionId = null,
    agentMemory = {},
    priceTextOverride = null,
    includePrice = true
}) => {
    const countryCode = 'EC';
    const audioNames = COMMERCIAL_INITIAL_AUDIO_NAMES[countryCode] || COMMERCIAL_INITIAL_AUDIO_NAMES.EC;
    const completedSteps = completedInitialStepsFromMemory(agentMemory);
    const sentAudios = [];
    const sentImages = [];
    const completedNow = [];
    const presentationStartedAt = new Date();
    const peerPhone = digitsOnly(customerContext?.phone || '') || digitsOnly(jid);
    let interrupted = false;
    const hasInboundInterrupt = async () => {
        if (!initialFunnelInterruptCheckEnabled()) return false;
        const newerInbound = await Message.exists({
            chatId: jid,
            isFromMe: false,
            isBot: false,
            createdAt: { $gt: presentationStartedAt }
        });
        let newerContactInbound = false;
        if (contactStateId) {
            const latestState = await ContactState.findById(contactStateId)
                .select('metadata.lastProcessedInboundAt metadata.perAgentMemory')
                .lean();
            const lastProcessed = latestState?.metadata?.lastProcessedInboundAt
                ? new Date(latestState.metadata.lastProcessedInboundAt)
                : null;
            const lastAgentInbound = latestState?.metadata?.perAgentMemory?.vit_power_ec?.lastInboundAt
                ? new Date(latestState.metadata.perAgentMemory.vit_power_ec.lastInboundAt)
                : null;
            newerContactInbound = Boolean(
                (lastProcessed && lastProcessed > presentationStartedAt)
                || (lastAgentInbound && lastAgentInbound > presentationStartedAt)
            );
        }
        interrupted = Boolean(newerInbound || newerContactInbound);
        return interrupted;
    };

    for (const baseName of audioNames) {
        if (await hasInboundInterrupt()) break;
        const stepKey = `audio:${baseName}`;
        if (completedSteps.has(stepKey)) {
            sentAudios.push({ baseName, sent: false, skipped: 'already_done' });
            continue;
        }
        const audioPath = await resolveCountryAudio({ country: countryCode, baseName });
        if (!audioPath) {
            console.warn(`[FUNIL] Audio inicial nao encontrado: ${countryCode}/${baseName}`);
            continue;
        }
        const sent = await sendAudio(jid, audioPath, true, { sessionId });
        sentAudios.push({ baseName, sent });
        console.log(`[FUNIL-INICIAL] audio ${baseName} -> ${jid} | sent=${sent}`);
        if (sent) {
            completedNow.push(stepKey);
            await recordInitialFunnelStepMessage({
                jid,
                peerPhone,
                body: `[AUDIO] ${baseName}`,
                type: 'audio'
            });
        }
        if (sent) await sleep(initialFunnelStepDelayMs('audio'));
    }

    const proofKeys = ['social_01', 'social_02', 'vit_power_bottle'];
    for (let index = 0; index < proofKeys.length; index += 1) {
        if (await hasInboundInterrupt()) break;
        const stepKey = `image:${proofKeys[index]}`;
        if (completedSteps.has(stepKey)) {
            sentImages.push({ key: proofKeys[index], sent: false, skipped: 'already_done' });
            continue;
        }
        const media = getSalesMedia(proofKeys[index]);
        if (!media) {
            console.warn(`[FUNIL] Prova social nao encontrada: ${proofKeys[index]}`);
            continue;
        }
        const caption = proofKeys[index].includes('bottle')
            ? media.caption
            : buildInitialProofCaption({ customerContext, index });
        const sent = await sendImage(jid, media.path, caption, { sessionId });
        sentImages.push({ key: proofKeys[index], sent });
        console.log(`[FUNIL-INICIAL] imagem ${proofKeys[index]} -> ${jid} | sent=${sent}`);
        if (sent) {
            completedNow.push(stepKey);
            await recordInitialFunnelStepMessage({
                jid,
                peerPhone,
                body: `[IMAGEM] ${proofKeys[index]}`,
                type: 'image'
            });
        }
        if (sent) await sleep(initialFunnelStepDelayMs('image'));
    }

    const priceText = includePrice
        ? (priceTextOverride || buildInitialPriceText(customerContext))
        : '';
    let priceSent = false;
    if (!includePrice) {
        priceSent = false;
    } else if (completedSteps.has('text:price') && !priceTextOverride) {
        priceSent = false;
    } else {
        if (await hasInboundInterrupt()) {
            priceSent = false;
        } else {
            await sleep(initialFunnelStepDelayMs('price'));
            if (!(await hasInboundInterrupt())) {
                priceSent = await sendText(jid, priceText, null, { sessionId });
                console.log(`[FUNIL-INICIAL] texto de preco -> ${jid} | sent=${priceSent}`);
                if (priceSent) {
                    completedNow.push('text:price');
                    await recordInitialFunnelStepMessage({
                        jid,
                        peerPhone,
                        body: priceText,
                        type: 'chat'
                    });
                }
            }
        }
    }

    let priceAudioSent = false;
    if (priceSent) {
        const priceAudioPath = await resolveCountryAudio({
            country: countryCode,
            baseName: 'TRATAMENTO_Y_PRECIOS_PROMOCAO_1_3_6'
        });
        if (priceAudioPath) {
            await sleep(initialFunnelStepDelayMs('audio'));
            if (!(await hasInboundInterrupt())) {
                priceAudioSent = await sendAudio(jid, priceAudioPath, true, { sessionId });
                console.log(`[FUNIL-INICIAL] audio TRATAMENTO_Y_PRECIOS_PROMOCAO_1_3_6 -> ${jid} | sent=${priceAudioSent}`);
                if (priceAudioSent) {
                    completedNow.push('audio:TRATAMENTO_Y_PRECIOS_PROMOCAO_1_3_6');
                    await recordInitialFunnelStepMessage({
                        jid,
                        peerPhone,
                        body: '[AUDIO] TRATAMENTO_Y_PRECIOS_PROMOCAO_1_3_6',
                        type: 'audio'
                    });
                }
            }
        }
    }

    const allCompletedSteps = [...new Set([...completedSteps, ...completedNow])];

    return {
        delivered: sentAudios.some((item) => item.sent) || sentImages.some((item) => item.sent) || priceSent || priceAudioSent,
        sentAudios,
        sentImages,
        priceSent,
        priceAudioSent,
        priceText: priceSent ? priceText : '',
        interrupted,
        completedSteps: allCompletedSteps,
        completedNow,
        isComplete: expectedInitialStepsForCountry(countryCode).every((step) => allCompletedSteps.includes(step))
    };
};

const buildCustomerMemory = async ({ chatId, customerContext, phoneDigits = '' }) => {
    const digits = digitsOnly(phoneDigits) || String(chatId || '').replace(/\D/g, '');
    const phoneTail = digits.length >= 10 ? digits.slice(-10) : digits;

    const [recentMessages, latestOrder] = await Promise.all([
        Message.find({ chatId }).sort({ createdAt: -1 }).limit(12).lean(),
        phoneTail
            ? Order.findOne({
                country: 'EC',
                'customer.phone': { $regex: phoneTail }
            }).sort({ updatedAt: -1, createdAt: -1 }).lean()
            : null
    ]);

    const history = recentMessages
        .reverse()
        .map((item) => ({
            role: item.isBot ? 'assistant' : 'user',
            content: item.body || ''
        }))
        .filter((item) => item.content.trim())
        .slice(-10);

    const customerProfile = latestOrder ? {
        orderId: latestOrder.orderId || null,
        status: latestOrder.status || null,
        name: latestOrder.customer?.name || null,
        phone: latestOrder.customer?.phone || null,
        city: latestOrder.customer?.city || null,
        province: latestOrder.customer?.province || null,
        address: latestOrder.customer?.address || null,
        productLabel: latestOrder.package?.label || null,
        packageQuantity: latestOrder.package?.quantity || null,
        total: latestOrder.total || null,
        currency: latestOrder.currency || null,
        notes: latestOrder.notes || null,
        conversationMemory: latestOrder.conversationMemory || null
    } : null;

    return { history, customerProfile };
};

const inferIntent = (text) => {
    const body = String(text || '').toLowerCase();
    if (!body.trim()) return 'unknown';
    if (/(despu[eé]s|luego|mas tarde|m[aá]s tarde|fin de mes|final de mes|quincena|cuando cobre|cuando me paguen|para despues|para despu[eé]s|solo estoy viendo|solo quiero saber)/i.test(body)) return 'buy_later';
    if (/(precio|valor|cu[aá]nto|cuanto|cost[aá]|promo)/i.test(body)) return 'price_check';
    if (/(quiero|me interesa|deseo|llevar|comprar)/i.test(body)) return 'purchase_intent';
    if (/(env[ií]o|entrega|direcci[oó]n|ciudad)/i.test(body)) return 'shipping_info';
    if (/(diabet|presi[oó]n|hiperten|cirug)/i.test(body)) return 'contraindication_question';
    return 'general_question';
};

const detectRequestedQuantity = (text) => {
    const body = normalizeFieldLabel(text);
    if (!body) return null;

    const words = body.split(/\s+/).filter(Boolean);
    const wordSet = new Set(words);
    const hasQuantityContext = /\b(frasco|frascos|botella|botellas|mes|meses|tratamiento|tratamientos|producto|productos|unidad|unidades|llevar|quiero|deseo|deme|mandeme|envie|envia|pedido)\b/i.test(body);
    const isShortQuantityReply = words.length <= 3;

    if (
        (/\b6\b/.test(body) && (hasQuantityContext || isShortQuantityReply))
        || (wordSet.has('seis') && (hasQuantityContext || isShortQuantityReply))
    ) return 6;
    if (
        (/\b3\b/.test(body) && (hasQuantityContext || isShortQuantityReply))
        || (wordSet.has('tres') && (hasQuantityContext || isShortQuantityReply))
    ) return 3;
    if (
        (/\b2\b/.test(body) && (hasQuantityContext || isShortQuantityReply))
        || (wordSet.has('dos') && (hasQuantityContext || isShortQuantityReply))
    ) return 2;
    if (
        (/\b1\b/.test(body) && (hasQuantityContext || isShortQuantityReply))
        || ((wordSet.has('un') || wordSet.has('uno') || wordSet.has('una')) && (hasQuantityContext || isShortQuantityReply))
    ) return 1;
    return null;
};

const detectPurchaseReadiness = (text) => {
    const body = String(text || '').toLowerCase();
    if (/(despu[eé]s|luego|mas tarde|m[aá]s tarde|fin de mes|final de mes|quincena|cuando cobre|cuando me paguen|pr[oó]ximo mes|otra fecha|todav[ií]a no|aun no|a[uú]n no|solo estoy viendo|solo quiero saber)/i.test(body)) {
        return 'buy_later';
    }
    if (/(env[ií]alo|env[ií]e|mande|m[aá]ndelo|prepar(e|a)|h[aá]gale|confirmo|confirmado|listo|de una|ahora|hoy|ya|si puede enviar|s[ií],? env)/i.test(body)) {
        return 'ready_now';
    }
    return 'unknown';
};

const buildQuantityConfirmationReply = ({ quantity, customerContext }) => {
    const ecPrices = { 1: '39 USD', 2: '70 USD', 3: '95.99 USD', 6: '167.99 USD' };
    const prices = ecPrices;
    const label = `${quantity} frasco${quantity > 1 ? 's' : ''}`;
    const price = prices[quantity] || '';

    return `¡Excelente decisión! Le envío ${label}${price ? ` por ${price}` : ''}. ¿Listo?`;
};

const shouldConfirmPackageQuantity = ({ text, agentMemory = {} }) => {
    const quantity = detectRequestedQuantity(text);
    if (!quantity) return 0;
    if (looksLikeOrderDataMessage(text)) return 0;
    const stage = String(agentMemory.lastFunnelStage || '');
    const hasInitialPresentation = Boolean(
        agentMemory.initialProductPresentationSentAt
        || agentMemory.initialProductPresentationPriceSentAt
        || (Array.isArray(agentMemory.initialProductPresentationSteps)
            && agentMemory.initialProductPresentationSteps.includes('text:price'))
    );
    return (hasInitialPresentation || stage === 'initial_product_presentation') ? quantity : 0;
};

const inferFunnelStage = (text, customerContext, agentProfile) => {
    const body = String(text || '').toLowerCase();
    if (detectPurchaseReadiness(text) === 'buy_later') return 'buy_later_followup';
    if (/(nombre|direccion|direcci[oó]n|ciudad|provincia|barrio|departamento|referencia)/i.test(body)) return 'collecting_customer_data';
    if (/(1 frasco|2 frascos|3 frascos|6 frascos|un frasco|dos frascos|tres frascos|seis frascos)/i.test(body)) return 'package_selection';
    if (/(precio|valor|promo|promoci[oó]n)/i.test(body)) return 'offer_presented';
    return 'qualification';
};

const inferLastObjection = (text) => {
    const body = String(text || '').toLowerCase();
    if (/(diabet)/i.test(body)) return 'diabetes';
    if (/(presi[oó]n|hiperten)/i.test(body)) return 'hypertension';
    if (/(cirug)/i.test(body)) return 'post_surgery';
    if (/(contraindica)/i.test(body)) return 'contraindications';
    if (/(confianza|funciona|verdad|real)/i.test(body)) return 'trust';
    if (/(caro|costoso|mucho)/i.test(body)) return 'price_resistance';
    return null;
};

const inferDesiredPurchaseTiming = (text) => {
    const body = String(text || '').toLowerCase();
    if (/(fin de mes|final de mes)/i.test(body)) return 'final de mes';
    if (/(quincena)/i.test(body)) return 'quincena';
    if (/(cuando cobre|cuando me paguen)/i.test(body)) return 'cuando cobre';
    if (/(pr[oó]ximo mes)/i.test(body)) return 'proximo mes';
    if (/(despu[eé]s|luego|mas tarde|m[aá]s tarde)/i.test(body)) return 'despues';
    return '';
};

const inferFollowUpAt = (timing) => {
    const now = new Date();
    if (timing === 'final de mes') {
        return new Date(now.getFullYear(), now.getMonth() + 1, 0, 10, 0, 0);
    }
    if (timing === 'quincena') {
        const day = now.getDate() <= 15 ? 15 : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return new Date(now.getFullYear(), now.getMonth(), day, 10, 0, 0);
    }
    if (timing === 'proximo mes') {
        return new Date(now.getFullYear(), now.getMonth() + 1, 5, 10, 0, 0);
    }
    return null;
};

const shouldRunInitialProductPresentation = ({ text, agentProfile, contactState }) => {
    const isCommercialAgent = agentProfile?.key === 'vit_power_ec';
    if (!isCommercialAgent) return false;
    if (!isInitialProductInquiry(text)) return false;

    const agentMemory = (((contactState?.metadata || {}).perAgentMemory || {})[agentProfile.key] || {});
    return !isInitialProductPresentationDone(agentMemory, countryCodeForAgentProfile(agentProfile));
};

const shouldRestartInitialProductPresentationAfterClosedOrder = ({ text, agentProfile, contactState }) => {
    const isCommercialAgent = agentProfile?.key === 'vit_power_ec';
    if (!isCommercialAgent) return false;
    if (!isInitialProductInquiry(text)) return false;
    if (looksLikeOrderDataMessage(text)) return false;

    const metadata = contactState?.metadata || {};
    const agentMemory = ((metadata.perAgentMemory || {})[agentProfile.key] || {});
    if (!isInitialProductPresentationDone(agentMemory, countryCodeForAgentProfile(agentProfile))) return false;

    return agentMemory.lastFunnelStage === 'order_closed'
        || metadata.lastKnownFunnelStage === 'order_closed'
        || Boolean(agentMemory.orderClosedThankYouSentAt);
};

const resetInitialProductPresentationMemory = async ({ contactStateId, agentProfile }) => {
    if (!contactStateId || !agentProfile?.key) return;
    const prefix = `metadata.perAgentMemory.${agentProfile.key}`;
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $unset: {
                [`${prefix}.initialProductPresentationSentAt`]: '',
                [`${prefix}.initialProductPresentationCompletedAt`]: '',
                [`${prefix}.initialProductPresentationPriceSentAt`]: '',
                [`${prefix}.initialProductPresentationSteps`]: '',
                [`${prefix}.initialProductPresentationAudios`]: '',
                [`${prefix}.initialProductPresentationImages`]: '',
                [`${prefix}.lastRepeatedInitialProductBlockedAt`]: '',
                [`${prefix}.lastRepeatedInitialProductText`]: '',
                [`${prefix}.repeatedInitialProductBlockedCount`]: '',
                [`${prefix}.pendingCheckoutOrder`]: ''
            },
            $set: {
                [`${prefix}.lastFunnelStage`]: 'initial_product_restart_after_closed_order',
                [`${prefix}.lastInitialProductRestartAt`]: new Date()
            }
        }
    );
};

const normalizeForDecision = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isCommercialOrderAgent = (agentProfile) => agentProfile?.key === 'vit_power_ec';

const isOrderCloseAffirmation = (text) => {
    const body = normalizeForDecision(text);
    if (!body) return false;
    if (body.length > 80) return false;
    const hasShortConfirmationNoise = body.split(/\s+/).length <= 4
        && /\b(si|sim|ok|okay|correcto|correto|correcta|listo|perfecto|confirmo|confirmado|de acuerdo|dale|hagale|acepto|bueno|bien)\b/.test(body)
        && !/\b(no|nop|negativo|mal|incorrecto|incorrecta|pregunta|duda|porque|por que|precio|cuanto|garantia|funciona)\b/.test(body);
    if (hasShortConfirmationNoise) return true;
    return /^(si|sii|claro|correcto|correto|correcta|todo correcto|esta correcto|exacto|ok|okay|listo|perfecto|confirmo|confirmado|de acuerdo|dale|hagale|asi es|si senora|si gracias|vorrecto|vorecto)$/.test(body)
        || /^(si|claro|correcto|correto|correcta|ok|listo|perfecto|confirmo|confirmado|de acuerdo|dale|hagale|ya|ahora|hoy|de una|vorrecto|vorecto)\b/.test(body)
        || /(envialo|envie|mande|mandelo|prepare|prepara|hagale|si puede enviar|si env)/i.test(body);
};

const monthNameToIndex = (value = '') => {
    const month = normalizeFieldLabel(value);
    const months = {
        enero: 0,
        fevereiro: 1,
        febrero: 1,
        marco: 2,
        marzo: 2,
        abril: 3,
        mayo: 4,
        maio: 4,
        junio: 5,
        julho: 6,
        julio: 6,
        agosto: 7,
        septiembre: 8,
        setiembre: 8,
        outubro: 9,
        octubre: 9,
        noviembre: 10,
        dezembro: 11,
        diciembre: 11
    };
    return Object.prototype.hasOwnProperty.call(months, month) ? months[month] : -1;
};

const followUpDateAt = (year, month, day) => new Date(year, month, day, 10, 0, 0);

const nextDateForDayMonth = ({ day, monthIndex }) => {
    const now = new Date();
    let year = now.getFullYear();
    let date = followUpDateAt(year, monthIndex, day);
    if (date.getTime() < now.getTime()) date = followUpDateAt(year + 1, monthIndex, day);
    return date;
};

const inferBuyLaterFollowUp = (text) => {
    const body = normalizeFieldLabel(text);
    const now = new Date();
    const explicit = body.match(/\b(?:para\s+el|el|dia|d[ií]a)\s+(\d{1,2})\s+de\s+([a-z]+)/i)
        || body.match(/\b(\d{1,2})\s+de\s+([a-z]+)/i);
    if (explicit) {
        const day = Number.parseInt(explicit[1], 10);
        const monthIndex = monthNameToIndex(explicit[2]);
        if (day >= 1 && day <= 31 && monthIndex >= 0) {
            return {
                followUpAt: nextDateForDayMonth({ day, monthIndex }),
                desiredPurchaseTiming: explicit[0]
            };
        }
    }
    const relativeDay = body.match(/\b(?:para\s+el|el|dia|d[ií]a)\s+(\d{1,2})\b/i);
    if (relativeDay) {
        const day = Number.parseInt(relativeDay[1], 10);
        if (day >= 1 && day <= 31) {
            let date = followUpDateAt(now.getFullYear(), now.getMonth(), day);
            if (date.getTime() < now.getTime()) date = followUpDateAt(now.getFullYear(), now.getMonth() + 1, day);
            return { followUpAt: date, desiredPurchaseTiming: relativeDay[0] };
        }
    }
    if (/\b(fin de mes|fin del mes|final de mes|final del mes|finales de mes)\b/i.test(body)) {
        return {
            followUpAt: followUpDateAt(now.getFullYear(), now.getMonth() + 1, 0),
            desiredPurchaseTiming: 'fin de mes'
        };
    }
    if (/\bquincena\b/i.test(body)) {
        const day = now.getDate() <= 15 ? 15 : 15;
        const monthOffset = now.getDate() <= 15 ? 0 : 1;
        return {
            followUpAt: followUpDateAt(now.getFullYear(), now.getMonth() + monthOffset, day),
            desiredPurchaseTiming: 'quincena'
        };
    }
    if (/\b(primer[a]?\s+semana|primera semana)\b/i.test(body)) {
        const monthOffset = now.getDate() <= 5 ? 0 : 1;
        return {
            followUpAt: followUpDateAt(now.getFullYear(), now.getMonth() + monthOffset, 5),
            desiredPurchaseTiming: 'primera semana'
        };
    }
    if (/\b(segund[a]?\s+semana|segunda semana)\b/i.test(body)) {
        const monthOffset = now.getDate() <= 12 ? 0 : 1;
        return {
            followUpAt: followUpDateAt(now.getFullYear(), now.getMonth() + monthOffset, 12),
            desiredPurchaseTiming: 'segunda semana'
        };
    }
    if (/\b(proximo mes|pr[oó]ximo mes)\b/i.test(body)) {
        return {
            followUpAt: followUpDateAt(now.getFullYear(), now.getMonth() + 1, 5),
            desiredPurchaseTiming: 'proximo mes'
        };
    }
    return { followUpAt: null, desiredPurchaseTiming: '' };
};

const detectDeferredPurchaseSignal = (text) => {
    const body = normalizeFieldLabel(text);
    if (!body) return null;
    if (/\b(no me mande|no me manden|no envie(?!\s+solo\s+(1|un|uno))|no despache|ya no quiero|no voy a comprar|cancelar|cancele|anular)\b/i.test(body)) {
        return { kind: 'cancel', reason: 'cliente_pediu_nao_enviar' };
    }
    const dateSignal = /\b(fin de mes|fin del mes|final de mes|final del mes|finales de mes|proximo mes|pr[oó]ximo mes|quincena|primera semana|segunda semana|para el \d{1,2}|el \d{1,2} de [a-z]+|\d{1,2} de [a-z]+|para esa fecha)\b/i.test(body);
    const moneySignal = /\b(estoy chiro|ahorita estoy chiro|no tengo plata|no tengo dinero|aun no me pagan|aun no me paga|cuando tenga el dinero|cuando tenga plata|cuando cobre|cuando me paguen)\b/i.test(body);
    const laterSignal = /\b(yo le aviso|yo te aviso|le aviso despues|le aviso despues|despues le aviso|manana conversamos|mas tarde|aun no|todavia no)\b/i.test(body);
    if (!dateSignal && !moneySignal && !laterSignal) return null;
    const timing = inferBuyLaterFollowUp(text);
    return {
        kind: moneySignal && !timing.followUpAt ? 'money_without_date' : 'buy_later',
        reason: moneySignal ? 'sem_dinheiro_agora' : laterSignal ? 'nao_fechar_agora' : 'data_futura',
        ...timing
    };
};

const buildDeferredPurchaseReply = (signal = {}) => {
    if (signal.kind === 'cancel') {
        return 'Entiendo, señor. No se preocupe, no voy a enviar nada. Dejo registrado aquí para que el pedido no avance.';
    }
    if (signal.followUpAt) {
        return 'Entiendo, señor. No se preocupe. Guarde mi número como Ana Lopez - Vit Power y dejo anotada esa fecha para volver a escribirle sin molestarlo antes.';
    }
    return 'Entiendo, señor. No se preocupe. Guarde mi número como Ana Lopez - Vit Power y cuando ya desee el producto me escribe por aquí. Si quiere, también puedo dejar anotada una fecha aproximada para recordarle sin molestarlo.';
};

const applyDeferredPurchaseSignal = async ({
    signal,
    text,
    chatId,
    peerPhone,
    contactStateId,
    agentProfile,
    pendingCheckoutOrder,
    customerProfile
}) => {
    const phoneTail = digitsOnly(peerPhone || chatId).slice(-10);
    const query = pendingCheckoutOrder?.orderId
        ? { orderId: pendingCheckoutOrder.orderId }
        : customerProfile?.orderId
            ? { orderId: customerProfile.orderId }
            : phoneTail
                ? { country: 'EC', 'customer.phone': { $regex: phoneTail } }
                : null;
    const order = query
        ? await Order.findOne(query).sort({ updatedAt: -1, createdAt: -1 })
        : null;
    const now = new Date();
    if (order) {
        order.purchaseIntent = {
            ...(order.purchaseIntent || {}),
            readiness: signal.kind === 'cancel' ? 'unknown' : 'buy_later',
            desiredPurchaseTiming: signal.desiredPurchaseTiming || signal.reason || '',
            followUpAt: signal.followUpAt || order.purchaseIntent?.followUpAt || null,
            buyLaterDetectedAt: signal.kind === 'cancel' ? order.purchaseIntent?.buyLaterDetectedAt : now
        };
        order.conversationMemory = {
            ...(order.conversationMemory || {}),
            currentIntent: signal.kind === 'cancel' ? 'cancel_requested' : 'buy_later',
            funnelStage: signal.kind === 'cancel' ? 'cancel_requested' : 'buy_later_followup',
            lastCustomerMessageAt: now,
            lastSummary: `Camada comprar depois: ${signal.reason || signal.kind}. Cliente disse: ${String(text || '').slice(0, 180)}`
        };
        order.notes = [
            order.notes || '',
            `[${now.toISOString()}] ${signal.kind === 'cancel' ? 'Pedido pausado/cancelado por fala do cliente' : 'Comprar depois detectado'}: ${String(text || '').slice(0, 220)}`
        ].filter(Boolean).join('\n').slice(-4000);
        if (signal.kind === 'cancel') order.status = 'cancelled';
        await order.save();
        syncOrderToOnlineAdminPanel(order, {
            status: signal.kind === 'cancel' ? 'cancelado' : 'comprar_depois',
            action: signal.kind === 'cancel' ? 'bot_cancel_signal' : 'bot_buy_later_signal'
        });
    } else if (signal.kind !== 'cancel') {
        syncContactDraftToOnlineAdminPanel({
            phone: peerPhone || chatId,
            status: 'comprar_depois',
            buyLaterFollowupAt: signal.followUpAt || '',
            quantity: 1
        }, {
            country: 'EC',
            note: `Comprar depois detectado: ${String(text || '').slice(0, 220)}`,
            action: 'bot_buy_later_signal',
            adminStatus: 'comprar_depois'
        });
    }
    if (contactStateId) {
        const state = await ContactState.findById(contactStateId);
        if (state) {
            state.human = {
                ...(state.human || {}),
                mode: signal.kind === 'cancel' ? 'manual' : state.human?.mode || 'auto',
                note: [
                    state.human?.note || '',
                    signal.kind === 'cancel'
                        ? `Cliente pediu nao enviar/cancelar: ${String(text || '').slice(0, 180)}`
                        : `Comprar depois (${signal.reason || 'data futura'}): ${String(text || '').slice(0, 180)}`
                ].filter(Boolean).join('\n').slice(-3000)
            };
            state.metadata = {
                ...(state.metadata || {}),
                buyLater: {
                    detectedAt: now,
                    reason: signal.reason || signal.kind,
                    originalText: String(text || '').slice(0, 300),
                    followUpAt: signal.followUpAt || null,
                    desiredPurchaseTiming: signal.desiredPurchaseTiming || ''
                },
                perAgentMemory: {
                    ...((state.metadata || {}).perAgentMemory || {}),
                    [agentProfile.key]: {
                        ...(((state.metadata || {}).perAgentMemory || {})[agentProfile.key] || {}),
                        lastIntent: signal.kind === 'cancel' ? 'cancel_requested' : 'buy_later',
                        lastFunnelStage: signal.kind === 'cancel' ? 'cancel_requested' : 'buy_later_followup',
                        lastInboundText: text
                    }
                }
            };
            await state.save();
        }
    }
    return order;
};

const looksLikeFinalOrderConfirmationPrompt = (text) => {
    const body = normalizeForDecision(text);
    if (!body) return false;

    const hasConfirmationLanguage = /(para confirmar|confirmar|confirmo tu pedido|todo correcto|esta correcto|datos|pedido)/i.test(body);
    const hasCoreData = /(nombre|cliente)/i.test(body)
        && /(provincia|departamento|ciudad)/i.test(body)
        && /(direccion|referencia)/i.test(body)
        && /(cantidad|frasco|total|valor)/i.test(body);

    return hasConfirmationLanguage && hasCoreData;
};

const hasRecentFinalOrderConfirmationPrompt = (history = []) => {
    return (history || [])
        .filter((item) => item.role === 'assistant')
        .slice(-4)
        .some((item) => looksLikeFinalOrderConfirmationPrompt(item.content));
};

const inferDeliveryModeFromCloseContext = ({ history = [], customerProfile = null }) => {
    const textParts = [
        ...(history || []).slice(-8).map((item) => item.content || ''),
        customerProfile?.notes || '',
        customerProfile?.address || ''
    ];
    const body = normalizeForDecision(textParts.join(' '));

    if (/(agencia|oficina|punto de retiro|retira|retirar|retiro|servientrega|inter rapidisimo)/i.test(body)) {
        return 'agency';
    }

    if (/(domicilio|casa|entrega en casa|a domicilio|direccion|barrio|calle|carrera|avenida|rua)/i.test(body)) {
        return 'home';
    }

    return 'home';
};

const buildOrderClosedThankYouText = ({ deliveryMode, customerContext }) => {
    const carrier = 'Servientrega';
    if (deliveryMode === 'agency') {
        return [
            'Gracias por confirmar sus datos.',
            `En breve preparamos su pedido y apenas este disponible en la agencia ${carrier}, le avisamos para que pueda retirarlo con tranquilidad.`,
            'Guarde este numero como Ana - Vit Power, porque por aqui le aviso cuando su pedido tenga guia y cuando este listo para retirar.'
        ].join('\n');
    }

    return [
        'Gracias por confirmar sus datos.',
        'En breve preparamos su pedido para entrega a domicilio. Quede atento al telefono cuando la transportadora se comunique con usted.',
        'Guarde este numero como Ana - Vit Power, porque por aqui le aviso sobre la guia, la entrega y cualquier soporte de su pedido.'
    ].join('\n');
};

const LEAKED_AUDIO_MARKER_REGEX = /\[AUDIO\]\s*(Agradecimento_Agencia_01|Agradecimento_Agencia|AGRADECIMENTO(?:_AGENCIA)?|BONUS_RETIRADA)?/gi;

const hasLeakedOrderClosedAudioMarker = (replyText = '') => (
    /\[AUDIO\]\s*(Agradecimento_Agencia_01|Agradecimento_Agencia|AGRADECIMENTO(?:_AGENCIA)?|BONUS_RETIRADA)/i.test(String(replyText || ''))
);

const removeLeakedAudioMarkers = (replyText = '') => String(replyText || '')
    .replace(LEAKED_AUDIO_MARKER_REGEX, '')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const removePhoneFromFinalConfirmation = (replyText) => {
    return String(replyText || '')
        .split('\n')
        .filter((line) => !/(^|\*|\s)(telefono|tel[eé]fono|phone|celular|whatsapp)\s*[:：-]/i.test(line))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

const addProvinceToFinalConfirmation = ({ replyText, customerContext, customerProfile }) => {
    const province = String(customerProfile?.province || '').trim();
    if (!province) return replyText;

    const normalized = normalizeForDecision(replyText);
    if (/\b(provincia|departamento)\b/i.test(normalized)) return replyText;

    const label = 'Provincia';
    const provinceLine = `- *${label}:* ${province}`;
    const lines = String(replyText || '').split('\n');
    const cityIndex = lines.findIndex((line) => /\b(ciudad|cidade)\b/i.test(normalizeForDecision(line)));
    const nameIndex = lines.findIndex((line) => /\b(nombre|nome)\b/i.test(normalizeForDecision(line)));
    const insertAt = cityIndex >= 0 ? cityIndex : (nameIndex >= 0 ? nameIndex + 1 : 1);
    lines.splice(Math.max(0, insertAt), 0, provinceLine);

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

const sanitizeFinalOrderConfirmationReply = ({ replyText, customerContext, customerProfile }) => {
    if (!looksLikeFinalOrderConfirmationPrompt(replyText)) return replyText;
    const withoutPhone = removePhoneFromFinalConfirmation(replyText);
    return addProvinceToFinalConfirmation({
        replyText: withoutPhone,
        customerContext,
        customerProfile
    });
};

const shouldCloseOrderDeterministically = ({ text, agentProfile, history }) => {
    if (!isCommercialOrderAgent(agentProfile)) return false;
    if (!isOrderCloseAffirmation(text)) return false;
    return hasRecentFinalOrderConfirmationPrompt(history);
};

const buildConversationSummary = ({ customerContext, intent, funnelStage, lastObjection, latestOrder, agentProfile }) => {
    const parts = [
        agentProfile?.key ? `agente=${agentProfile.key}` : null,
        customerContext.country ? `pais=${customerContext.country}` : null,
        customerContext.product ? `producto=${customerContext.product}` : null,
        intent ? `intencion=${intent}` : null,
        funnelStage ? `etapa=${funnelStage}` : null,
        lastObjection ? `objecion=${lastObjection}` : null,
        latestOrder?.customer?.name ? `nombre=${latestOrder.customer.name}` : null,
        latestOrder?.customer?.city ? `ciudad=${latestOrder.customer.city}` : null
    ].filter(Boolean);

    return parts.join(' | ');
};

const shouldForceAudio = ({ intent, lastObjection, agentProfile }) => {
    if (String(process.env.BOT_FAST_TEXT_ONLY || '').toLowerCase() === 'true') return false;
    return [
        'price_check',
        'purchase_intent',
        'contraindication_question'
    ].includes(intent) || !!lastObjection;
};

const shouldForceImage = ({ lastObjection, agentProfile, sentImageKeys = [] }) => {
    if (String(process.env.BOT_DISABLE_AUTO_MEDIA || '').toLowerCase() === 'true') return null;
    const isCommercialAgent = agentProfile?.key === 'vit_power_ec';
    if (!isCommercialAgent) return null;

    const missingInitialProofs = ['social_01', 'social_02'].filter((key) => !sentImageKeys.includes(key));
    if (missingInitialProofs.length > 0) {
        return missingInitialProofs;
    }

    if (lastObjection === 'trust') {
        return ['social_03', 'vit_power_bottle'];
    }

    return null;
};

const shouldUseTextOnly = ({ replyText, intent, funnelStage }) => {
    const body = String(replyText || '').toLowerCase();
    if (funnelStage === 'collecting_customer_data') return true;
    if (intent === 'shipping_info') return true;
    if (/(nombre completo|direccion completa|direcci[oó]n completa|punto de referencia|ciudad|departamento|barrio|provincia)/i.test(body)) return true;
    if (/(te envio|te envío|te mando|confirmo tu pedido|confirmo el pedido|esta de acuerdo|est[aá] de acuerdo)/i.test(body)) return true;
    if (/(3 frascos|6 frascos|1 frasco).*(39\.99|43\.99|95\.99|100\.99|167\.99|176\.99|149\.000|290\.000|510\.000)/i.test(body)) return true;
    return false;
};

const shouldUseAudioOnly = ({ intent, funnelStage, replyText, agentProfile }) => {
    if (shouldUseTextOnly({ replyText, intent, funnelStage })) return false;
    if (agentProfile?.outputStrategy === 'audio_only_preferred') return true;
    return true;
};

const determineResponseMode = ({ replyText, intent, funnelStage, agentProfile, isShortGreeting = false }) => {
    if (String(process.env.BOT_FAST_TEXT_ONLY || '').toLowerCase() === 'true') return 'text_only';
    if (isShortGreeting) return 'text_only';
    if (shouldUseTextOnly({ replyText, intent, funnelStage })) return 'text_only';
    if (shouldUseAudioOnly({ intent, funnelStage, replyText, agentProfile })) return 'audio_only';
    return 'mixed';
};

const updateOrderConversationMemory = async ({ chatId, customerContext, text, agentProfile, phoneDigits = '' }) => {
    const digits = digitsOnly(phoneDigits) || String(chatId || '').replace(/\D/g, '');
    const phoneTail = digits.length >= 10 ? digits.slice(-10) : digits;
    if (!phoneTail) return null;

    const latestOrder = await Order.findOne({
        country: 'EC',
        'customer.phone': { $regex: phoneTail }
    }).sort({ updatedAt: -1, createdAt: -1 });

    if (!latestOrder) return null;

    const intent = inferIntent(text);
    const funnelStage = inferFunnelStage(text, customerContext, agentProfile);
    const detectedObjection = inferLastObjection(text);
    const currentObjection = detectedObjection || latestOrder.conversationMemory?.lastObjection || null;
    const currentStage = latestOrder.conversationMemory?.funnelStage || '';
    const orderIsClosed = ['confirmed', 'delivered', 'picked_up', 'pickedUp'].includes(String(latestOrder.status || ''))
        || currentStage === 'order_closed';
    const wantsNewPurchase = isExplicitNewPurchaseAfterClosedOrder(text)
        && !isPostOrderCourtesyText(text)
        && !isLogisticsAfterOrderText(text);

    if (orderIsClosed && !wantsNewPurchase) {
        latestOrder.conversationMemory = {
            ...(latestOrder.conversationMemory || {}),
            currentIntent: isLogisticsAfterOrderText(text) ? 'post_order_logistics' : 'post_order_message',
            funnelStage: 'order_closed',
            activeAgent: 'vit_power_ec',
            lastCustomerMessageAt: new Date(),
            lastBotMessageAt: latestOrder.conversationMemory?.lastBotMessageAt || null,
            lastSummary: buildConversationSummary({
                customerContext,
                intent: isLogisticsAfterOrderText(text) ? 'post_order_logistics' : 'post_order_message',
                funnelStage: 'order_closed',
                lastObjection: currentObjection,
                latestOrder,
                agentProfile
            })
        };
        await latestOrder.save();
        latestOrder.$locals = {
            inferredIntent: latestOrder.conversationMemory.currentIntent,
            inferredFunnelStage: 'order_closed',
            inferredObjection: currentObjection
        };
        return latestOrder;
    }

    latestOrder.conversationMemory = {
        currentIntent: intent,
        funnelStage,
        lastObjection: currentObjection,
        activeAgent: 'vit_power_ec',
        lastCustomerMessageAt: new Date(),
        lastBotMessageAt: latestOrder.conversationMemory?.lastBotMessageAt || null,
        lastSummary: buildConversationSummary({
            customerContext,
            intent,
            funnelStage,
            lastObjection: currentObjection,
            latestOrder,
            agentProfile
        })
    };

    await latestOrder.save();
    latestOrder.$locals = {
        inferredIntent: intent,
        inferredFunnelStage: funnelStage,
        inferredObjection: currentObjection
    };

    return latestOrder;
};

const isExplicitNewPurchaseAfterClosedOrder = (text) => {
    const body = normalizeForDecision(text);
    if (!body) return false;
    if (isPostOrderCourtesyText(text) || isLogisticsAfterOrderText(text)) return false;
    if (/(funciona|funcione|sirve|garantia|garantizado|doctora|de donde|origen|demora|llega|guia|como se toma|ingrediente|composicion)/i.test(body)) {
        return false;
    }
    return /\b(quiero|deseo|necesito|comprar|compra|mandeme|mandame|envieme|enviame|deme|separeme|separame)\b.*\b(otro|otra|nuevo|nueva|pedido|producto|frasco|frascos|botella|botellas|vit power|1|2|3|6|uno|dos|tres|seis)\b/i.test(body)
        || /\b(otro|otra|nuevo|nueva)\s+(pedido|producto|frasco|frascos|botella|botellas)\b/i.test(body);
};

const getGreetingReply = ({ agentProfile, alreadyIntroduced }) => {
    const greeting = agentProfile?.greeting || AGENT_PROFILES.vit_power_ec.greeting;
    return alreadyIntroduced ? greeting.introduced : greeting.firstTouch;
};

const normalizeComparableText = (text) => String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const avoidRepeatedReply = ({ replyText, history, agentProfile }) => {
    const comparableReply = normalizeComparableText(replyText);
    if (!comparableReply) return replyText;

    const recentAssistantMessages = (history || [])
        .filter((item) => item.role === 'assistant')
        .slice(-4)
        .map((item) => normalizeComparableText(item.content));

    if (!recentAssistantMessages.includes(comparableReply)) {
        return replyText;
    }

    const suffix = ' Si quieres, te explico la promocion de hoy.';
    return `${String(replyText || '').trim()}${suffix}`;
};

const updateContactStateAgentMemory = async ({
    contactStateId,
    agentProfile,
    inboundText,
    outboundText,
    inferredIntent,
    inferredFunnelStage,
    inferredObjection,
    sentImageKeys = []
}) => {
    if (!contactStateId) return;

    const state = await ContactState.findById(contactStateId);
    if (!state) return;

    state.lastOutboundAt = new Date();
    state.metadata = {
        ...(state.metadata || {}),
        lastKnownIntent: inferredIntent,
        lastKnownFunnelStage: inferredFunnelStage,
        lastKnownObjection: inferredObjection,
        perAgentMemory: {
            ...((state.metadata || {}).perAgentMemory || {}),
            [agentProfile.key]: {
                ...(((state.metadata || {}).perAgentMemory || {})[agentProfile.key] || {}),
                lastInboundAt: state.lastInboundAt || new Date(),
                lastInboundText: inboundText,
                lastOutboundAt: new Date(),
                lastOutboundText: outboundText,
                lastIntent: inferredIntent,
                lastFunnelStage: inferredFunnelStage,
                lastObjection: inferredObjection,
                sentImageKeys: [
                    ...new Set([
                        ...((((state.metadata || {}).perAgentMemory || {})[agentProfile.key] || {}).sentImageKeys || []),
                        ...sentImageKeys
                    ])
                ]
            }
        }
    };

    await state.save();
};

const maybeHandleAgencyLookupInterrupt = async ({
    text,
    chatId,
    customerContext,
    agentProfile,
    contactStateId,
    peerPhone,
    pendingCheckoutOrder,
    pendingCheckoutStage,
    checkoutOrderData,
    sessionId = null
}) => {
    if (checkoutOrderData) return false;
    if (!isAgencyDeliveryChoice(text)) return false;
    if (isHomeDeliveryChoice(text)) return false;
    if ([
        'awaiting_agency_selection',
        'awaiting_agency_selection_interrupt',
        'awaiting_package_choice_after_agency',
        'awaiting_customer_name',
        'awaiting_agency_confirmation'
    ].includes(pendingCheckoutStage) || isCheckoutDataCollectionStage(pendingCheckoutStage)) {
        return false;
    }

    const agencyDetails = parseAgencyDetailsMessage(text);
    if (!agencyDetails.agencyValidated && !agencyDetails.agencyOptions?.length) return false;

    const hasQuantity = Boolean(pendingCheckoutOrder?.quantity);
    const normalizedOrder = {
        ...(pendingCheckoutOrder || {}),
        ...agencyDetails,
        deliveryMode: 'agency',
        source: hasQuantity ? (pendingCheckoutOrder?.source || 'whatsapp_package_selection') : 'agency_interrupt'
    };

    if (!normalizedOrder.agencyValidated && normalizedOrder.agencyOptions?.length) {
        normalizedOrder.stage = hasQuantity ? 'awaiting_agency_selection' : 'awaiting_agency_selection_interrupt';
        const replyText = buildAgencyOptionsSelectionText(normalizedOrder);
        const sent = await sendText(chatId, replyText, null, { sessionId });
        if (!sent) return false;

        try {
            await Message.create({
                _id: `out_${Date.now()}_agency_interrupt_options`,
                chatId,
                peerPhone,
                from: 'bot',
                to: chatId,
                body: replyText,
                isFromMe: true,
                isBot: true,
                timestamp: Math.floor(Date.now() / 1000)
            });
        } catch (e) { }

        await savePendingCheckoutOrderMemory({
            contactStateId,
            agentProfile,
            parsedOrder: normalizedOrder,
            stage: normalizedOrder.stage,
            orderId: null
        });
        await updateContactStateAgentMemory({
            contactStateId,
            agentProfile,
            inboundText: text,
            outboundText: replyText,
            inferredIntent: 'purchase_intent',
            inferredFunnelStage: normalizedOrder.stage,
            inferredObjection: null
        });
        console.log(`[FUNIL] Interrupcao por agencia tratada com opcoes oficiais -> ${chatId}`);
        return true;
    }

    normalizedOrder.stage = hasQuantity ? 'awaiting_customer_name' : 'awaiting_package_choice_after_agency';
    const replyText = hasQuantity
        ? buildAgencyDetailsConfirmationText(normalizedOrder)
        : buildAgencyQuantityRequestText(normalizedOrder);
    const sent = await sendText(chatId, replyText, null, { sessionId });
    if (!sent) return false;

    try {
        await Message.create({
            _id: `out_${Date.now()}_agency_interrupt_confirmed`,
            chatId,
            peerPhone,
            from: 'bot',
            to: chatId,
            body: replyText,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    await savePendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        parsedOrder: normalizedOrder,
        stage: normalizedOrder.stage,
        orderId: null
    });
    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText: text,
        outboundText: replyText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: normalizedOrder.stage,
        inferredObjection: null
    });
    console.log(`[FUNIL] Interrupcao por agencia tratada com agencia validada -> ${chatId} | etapa=${normalizedOrder.stage}`);
    return true;
};

const checkoutBridgeLine = () => {
    const variants = [
        'Le leo 😊 Para no perder su pedido, seguimos aqui:',
        'Claro, le entiendo. Dejemos esta parte lista:',
        'Perfecto, sigo con usted. Para avanzar sin error:',
        'Gracias por escribirme. Retomamos el pedido aqui:',
        'Si, claro. Para cerrar bien su envio:'
    ];
    return variants[Math.floor(Math.random() * variants.length)];
};

const pendingCheckoutFallbackText = (stage, pendingCheckoutOrder = {}) => {
    const bridge = checkoutBridgeLine();
    if (stage === 'awaiting_delivery_mode') {
        return `${bridge}\nMe confirma si desea retirar en una agencia Servientrega o recibir en su domicilio? Si es agencia, puede escribir por ejemplo: agencia Cayambe.`;
    }
    if (['awaiting_agency_selection', 'awaiting_agency_selection_interrupt'].includes(stage)) {
        return `${bridge}\n${buildAgencyOptionsSelectionText(pendingCheckoutOrder)}`;
    }
    if (stage === 'awaiting_package_choice_after_agency') {
        return `${bridge}\n${buildAgencyQuantityRequestText(pendingCheckoutOrder)}`;
    }
    if (stage === 'awaiting_customer_name') {
        return `${bridge}\n${buildCustomerNameRetryText()}`;
    }
    if (stage === 'awaiting_agency_details') {
        return `${bridge}\nPara ubicar bien la agencia, me envia ciudad, provincia y nombre o direccion de la agencia Servientrega donde desea retirar.`;
    }
    if (stage === 'awaiting_customer_data') {
        const missingKeys = missingCheckoutFieldKeys(pendingCheckoutOrder);
        return `${bridge}\n${buildMissingCheckoutFieldText({ parsedOrder: pendingCheckoutOrder, missing: missingCheckoutFields(pendingCheckoutOrder), missingKeys })}`;
    }
    if ([
        'awaiting_customer_name_data',
        'awaiting_city_province',
        'awaiting_home_address',
        'awaiting_quantity_data'
    ].includes(stage)) {
        const missingKeys = missingCheckoutFieldKeys(pendingCheckoutOrder);
        return `${bridge}\n${buildMissingCheckoutFieldText({ parsedOrder: pendingCheckoutOrder, missing: missingCheckoutFields(pendingCheckoutOrder), missingKeys })}`;
    }
    if (stage === 'awaiting_agency_confirmation') {
        return `${bridge}\nMe confirma si los datos del pedido estan correctos para proceder con el envio hoy mismo?`;
    }
    if (stage === 'awaiting_reference') {
        const missingKeys = missingCheckoutFieldKeys(pendingCheckoutOrder);
        return `${bridge}\n${buildMissingCheckoutFieldText({ parsedOrder: pendingCheckoutOrder, missing: missingCheckoutFields(pendingCheckoutOrder), missingKeys })}`;
    }
    return '';
};

const maybeHandlePendingCheckoutFallback = async ({
    text,
    chatId,
    agentProfile,
    contactStateId,
    peerPhone,
    pendingCheckoutOrder,
    pendingCheckoutStage,
    checkoutOrderData,
    sessionId = null
}) => {
    if (!pendingCheckoutOrder || checkoutOrderData) return false;
    if (!pendingCheckoutStage) return false;

    const replyText = pendingCheckoutFallbackText(pendingCheckoutStage, pendingCheckoutOrder);
    if (!replyText) return false;
    const sent = await sendText(chatId, replyText, null, { sessionId });
    if (!sent) {
        console.log(`[FUNIL] Ponte de checkout bloqueada pelo anti-spam; IA generica bloqueada -> ${chatId} | etapa=${pendingCheckoutStage}`);
        return true;
    }

    try {
        await Message.create({
            _id: `out_${Date.now()}_pending_checkout_fallback`,
            chatId,
            peerPhone,
            from: 'bot',
            to: chatId,
            body: replyText,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }

    await savePendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        parsedOrder: pendingCheckoutOrder,
        stage: pendingCheckoutStage,
        orderId: null
    });
    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText: text,
        outboundText: replyText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: pendingCheckoutStage,
        inferredObjection: null
    });
    console.log(`[FUNIL] Entrada fora do esperado mantida no checkout -> ${chatId} | etapa=${pendingCheckoutStage}`);
    return true;
};

const isPostOrderCourtesyText = (text) => {
    const body = normalizeForDecision(text);
    if (!body || body.length > 120) return false;
    return /^(gracias|muchas gracias|ok gracias|listo gracias|perfecto gracias|correcto gracias|si gracias|esta bien gracias|bendiciones|que bien|excelente gracias|perfecto|ok|listo|correcto|de acuerdo)$/.test(body)
        || /\bgracias\b/.test(body)
        || /🙏/.test(String(text || ''));
};

const looksLikeOrderClosedThankYouText = (text) => {
    const body = normalizeForDecision(text);
    if (!body) return false;
    return /(gracias por confirmar sus datos|su pedido queda confirmado|pedido.*confirmado|en breve preparamos su pedido)/i.test(body)
        && /(servientrega|agencia|guia|retirar|listo para retirar|le aviso)/i.test(body);
};

const hasRecentOrderClosedThankYou = (history = []) => {
    return (history || [])
        .filter((item) => item.role === 'assistant')
        .slice(-5)
        .some((item) => looksLikeOrderClosedThankYouText(item.content));
};

const hasOrderClosedContext = ({ contactState, agentProfile, history = [], customerProfile = null }) => {
    if (agentProfile?.key !== 'vit_power_ec') return { closed: false, closedAt: 0, agentMemory: {}, metadata: {} };
    const metadata = contactState?.metadata || {};
    const agentMemory = ((metadata.perAgentMemory || {})[agentProfile.key] || {});
    const closedAt = agentMemory.orderClosedThankYouSentAt
        ? new Date(agentMemory.orderClosedThankYouSentAt).getTime()
        : 0;
    const closed = agentMemory.lastFunnelStage === 'order_closed'
        || metadata.lastKnownFunnelStage === 'order_closed'
        || ['confirmed', 'delivered', 'picked_up', 'pickedUp'].includes(String(customerProfile?.status || ''))
        || customerProfile?.conversationMemory?.funnelStage === 'order_closed'
        || Boolean(closedAt)
        || hasRecentOrderClosedThankYou(history);
    return { closed, closedAt, agentMemory, metadata };
};

const isLogisticsAfterOrderText = (text) => {
    const body = normalizeForDecision(text);
    return /(guia|pedido|estado|estatus|status|retirar|retiro|agencia|servientrega|cuando llega|cuando retiro|listo para retirar|ya esta)/i.test(body);
};

const isPostOrderProductSupportText = (text) => {
    const body = normalizeForDecision(text);
    if (!body) return false;
    if (isPostOrderCourtesyText(text) || isLogisticsAfterOrderText(text)) return false;
    return /(funciona|funcione|sirve|garantia|garantizado|doctora|de donde|origen|demora|llega|como se toma|ingrediente|composicion|diabetes|presion|corazon|medicamento|cirugia|prostata|estafa|seguro|confiable)/i.test(body);
};

const postOrderLockWindowMs = () => {
    const hours = Number.parseInt(String(process.env.POST_ORDER_NO_REOPEN_HOURS || '24'), 10);
    return Math.max(1, Number.isFinite(hours) ? hours : 24) * 60 * 60 * 1000;
};

const maybeHandleRecentOrderClosedLock = async ({
    text,
    chatId,
    agentProfile,
    contactState,
    contactStateId,
    peerPhone,
    history = [],
    customerProfile = null,
    sessionId = null
}) => {
    if (agentProfile?.key !== 'vit_power_ec') return false;

    const { closed, closedAt, agentMemory } = hasOrderClosedContext({
        contactState,
        agentProfile,
        history,
        customerProfile
    });
    if (!closed) return false;

    if (closedAt && Date.now() - closedAt > postOrderLockWindowMs()) return false;

    if (isPostOrderProductSupportText(text)) {
        const complement = await maybeHandleVitPowerAudioComplement({
            text,
            chatId,
            peerPhone,
            contactStateId,
            contactState,
            agentProfile,
            sessionId
        });
        if (complement.handled) {
            await ContactState.updateOne(
                { _id: contactStateId },
                {
                    $set: {
                        [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'order_closed',
                        [`metadata.perAgentMemory.${agentProfile.key}.lastPostOrderSupportAt`]: new Date(),
                        [`metadata.perAgentMemory.${agentProfile.key}.lastPostOrderSupportRule`]: complement.ruleKey || '',
                        'metadata.lastKnownFunnelStage': 'order_closed'
                    }
                }
            );
            console.log(`[FUNIL] Duvida pos-fechamento respondida sem reabrir funil -> ${chatId} | rule=${complement.ruleKey || 'sem_regra'}`);
            return true;
        }
    }

    const shouldReply = isPostOrderCourtesyText(text)
        || isLogisticsAfterOrderText(text);

    if (!shouldReply || agentMemory.postOrderCourtesySentAt) {
        console.log(`[FUNIL] Trava pos-fechamento bloqueou reabertura/spam -> ${chatId}`);
        return true;
    }

    const replyText = isLogisticsAfterOrderText(text)
        ? 'Si, su pedido ya queda confirmado. Por aqui le aviso cuando tenga guia y cuando este listo para retirar en Servientrega.'
        : 'Con gusto 😊 Su pedido queda confirmado. Por aqui le aviso cuando tenga guia y cuando este listo para retirar.';
    const sent = await sendText(chatId, replyText, null, { sessionId });
    if (sent) {
        try {
            await Message.create({
                _id: `out_${Date.now()}_post_order_lock`,
                chatId,
                peerPhone,
                from: 'bot',
                to: chatId,
                body: replyText,
                isFromMe: true,
                isBot: true,
                timestamp: Math.floor(Date.now() / 1000)
            });
        } catch (e) { }
        await updateContactStateAgentMemory({
            contactStateId,
            agentProfile,
            inboundText: text,
            outboundText: replyText,
            inferredIntent: 'purchase_intent',
            inferredFunnelStage: 'order_closed',
            inferredObjection: null
        });
        await ContactState.updateOne(
            { _id: contactStateId },
            {
                $set: {
                    [`metadata.perAgentMemory.${agentProfile.key}.postOrderCourtesySentAt`]: new Date(),
                    [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'order_closed',
                    'metadata.lastKnownFunnelStage': 'order_closed'
                }
            }
        );
    }
    console.log(`[FUNIL] Trava pos-fechamento tratada; funil nao reiniciado -> ${chatId} | sent=${sent}`);
    return true;
};

export const handleAgentConversation = async (msg, agentProfile = AGENT_PROFILES.vit_power_ec) => {
    try {
        console.log(`[LOG_HANDLER_ENTER] 🚀 Processando mensagem... agente=${agentProfile.key}`);

        const text = msg.body || '';
        const jid = msg.from;

        if (!text.trim()) return;
        if (jid === 'status@broadcast' || jid.includes('@g.us') || msg.fromMe) {
            console.log('[LOG_FILTER] ❌ Mensagem ignorada (Status/Grupo/Própria)');
            return;
        }

        const chatId = resolveRealChatId(msg);
        const contactState = msg.contactStateId ? await ContactState.findById(msg.contactStateId).lean() : null;
        const peerPhone = digitsOnly(msg.senderPn) || digitsOnly(contactState?.phoneDigits) || digitsOnly(chatId);
        let customerContext = customerContextFromCountryCode('EC', peerPhone);
        const alreadyIntroduced = await hasBotIntroducedItself(chatId);
        const memoryOrder = await updateOrderConversationMemory({ chatId, customerContext, text, agentProfile, phoneDigits: peerPhone });
        const resolvedCountryCode = 'EC';
        const customerMemory = await buildCustomerMemory({ chatId, customerContext, phoneDigits: peerPhone });
        const sentImageKeys = (((contactState?.metadata || {}).perAgentMemory || {})[agentProfile.key] || {}).sentImageKeys || [];
        const agentMemorySnapshot = (((contactState?.metadata || {}).perAgentMemory || {})[agentProfile.key] || {});
        let checkoutOrderData = parseCheckoutOrderMessage(text);
        console.log(`[BOT] ✅ Trabalhando no Chat: ${chatId} | agente=${agentProfile.key}`);

        try {
            await Message.create({
                _id: msg.id || `in_${Date.now()}`,
                chatId,
                peerPhone,
                from: jid,
                to: 'bot',
                body: text,
                type: 'chat',
                isFromMe: false,
                isBot: false,
                timestamp: Math.floor(Date.now() / 1000)
            });
        } catch (dbErr) {
            if (dbErr.code !== 11000) console.error('[DB-ERROR] Erro ao salvar:', dbErr.message);
        }

        const pendingCheckoutOrder = agentMemorySnapshot.pendingCheckoutOrder || null;
        const pendingCheckoutStage = getPendingCheckoutStage(pendingCheckoutOrder);
        const memoryFunnelStage = String(agentMemorySnapshot.lastFunnelStage || '');
        const selectedQuantityInMemory = normalizeOptionalPackageQuantity(agentMemorySnapshot.selectedQuantity || 0);
        if (!checkoutOrderData && shouldTryMergePendingCheckoutData({
            text,
            pendingCheckoutStage,
            pendingCheckoutOrder
        })) {
            checkoutOrderData = parseCheckoutOrderMessage(text, { loose: true });
        }
        if (checkoutOrderData) {
            checkoutOrderData = mergeCheckoutOrderData({
                baseOrder: pendingCheckoutOrder,
                incomingOrder: checkoutOrderData,
                selectedQuantity: selectedQuantityInMemory,
                peerPhone
            });
        }
        if (
            pendingCheckoutOrder
            && isCheckoutDataCollectionStage(pendingCheckoutStage)
            && (checkoutOrderData || shouldTryMergePendingCheckoutData({ text, pendingCheckoutStage, pendingCheckoutOrder }))
        ) {
            checkoutOrderData = await rebuildCheckoutOrderFromRecentMessages({
                chatId,
                pendingCheckoutOrder,
                selectedQuantity: selectedQuantityInMemory,
                peerPhone
            });
        }
        const selectedQuantityFromPrice = [
            'awaiting_agency_selection',
            'awaiting_agency_selection_interrupt'
        ].includes(pendingCheckoutStage)
            ? 0
            : shouldConfirmPackageQuantity({
                text,
                agentMemory: agentMemorySnapshot
            });

        if (
            !pendingCheckoutOrder
            && memoryFunnelStage === 'package_selection'
            && selectedQuantityInMemory
            && isOrderCloseAffirmation(text)
        ) {
            const handled = await askDeliveryModeAfterPackageSelection({
                jid: chatId,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                quantity: selectedQuantityInMemory,
                inboundText: text,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

        const deferredPurchaseSignal = detectDeferredPurchaseSignal(text);
        if (deferredPurchaseSignal) {
            const replyText = buildDeferredPurchaseReply(deferredPurchaseSignal);
            const sent = await sendText(chatId, replyText, null, { sessionId: msg.sessionId || null });
            if (sent) {
                try {
                    await Message.create({
                        _id: `out_${Date.now()}_buy_later_${Math.random().toString(16).slice(2, 8)}`,
                        chatId,
                        peerPhone,
                        from: 'bot',
                        to: chatId,
                        body: replyText,
                        isFromMe: true,
                        isBot: true,
                        timestamp: Math.floor(Date.now() / 1000)
                    });
                } catch (e) { }
                await applyDeferredPurchaseSignal({
                    signal: deferredPurchaseSignal,
                    text,
                    chatId,
                    peerPhone,
                    contactStateId: msg.contactStateId,
                    agentProfile,
                    pendingCheckoutOrder,
                    customerProfile: customerMemory.customerProfile
                });
                await updateContactStateAgentMemory({
                    contactStateId: msg.contactStateId,
                    agentProfile,
                    inboundText: text,
                    outboundText: replyText,
                    inferredIntent: deferredPurchaseSignal.kind === 'cancel' ? 'cancel_requested' : 'buy_later',
                    inferredFunnelStage: deferredPurchaseSignal.kind === 'cancel' ? 'cancel_requested' : 'buy_later_followup',
                    inferredObjection: null
                });
                console.log(`[BUY-LATER] sinal tratado -> ${chatId} | kind=${deferredPurchaseSignal.kind} | reason=${deferredPurchaseSignal.reason || ''}`);
            }
            return;
        }

        const postOrderCourtesyHandled = await maybeHandleRecentOrderClosedLock({
            text,
            chatId,
            agentProfile,
            contactState,
            contactStateId: msg.contactStateId,
            peerPhone,
            history: customerMemory.history,
            customerProfile: customerMemory.customerProfile,
            sessionId: msg.sessionId || null
        });
        if (postOrderCourtesyHandled) return;

        const refillGreetingHandled = await maybeHandleSimpleGreetingRefill({
            text,
            chatId,
            peerPhone,
            sessionId: msg.sessionId || null,
            contactStateId: msg.contactStateId,
            agentProfile
        });
        if (refillGreetingHandled) {
            console.log(`[RECOMPRA] Saudacao simples tratada como continuidade -> ${chatId}`);
            return;
        }

        if (pendingCheckoutStage === 'awaiting_agency_confirmation' && isOrderCloseAffirmation(text)) {
            const handled = await finalizeCheckoutOrder({
                jid: chatId,
                parsedOrder: pendingCheckoutOrder,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

        const checkoutCorrectionHandled = await handlePendingCheckoutCorrection({
            text,
            chatId,
            agentProfile,
            contactStateId: msg.contactStateId,
            peerPhone,
            pendingCheckoutOrder,
            pendingCheckoutStage,
            customerContext,
            sessionId: msg.sessionId || null
        });
        if (checkoutCorrectionHandled) return;

        if (
            checkoutOrderData
            && pendingCheckoutOrder
            && isCheckoutDataCollectionStage(pendingCheckoutStage)
        ) {
            const handled = await sendCheckoutOrderNextStep({
                jid: chatId,
                parsedOrder: checkoutOrderData,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                sessionId: msg.sessionId || null
            });
            if (handled) {
                console.log(`[FUNIL] Dados parciais acumulados no checkout -> ${chatId} | etapa=${pendingCheckoutStage}`);
                return;
            }
            console.log(`[FUNIL] Coleta de checkout segurou continuidade para evitar reinicio -> ${chatId} | etapa=${pendingCheckoutStage}`);
            return;
        }

        const complement = await maybeHandleVitPowerAudioComplement({
            text,
            chatId,
            peerPhone,
            contactStateId: msg.contactStateId,
            contactState,
            agentProfile,
            sessionId: msg.sessionId || null,
            countryCode: resolvedCountryCode
        });
        if (complement.handled) {
            console.log(`[AUDIO-COMPLEMENT] regra tratada -> ${chatId} | rule=${complement.ruleKey} | skipped=${complement.skipped || 'no'}`);
            if (pendingCheckoutOrder) {
                await maybeHandlePendingCheckoutFallback({
                    text,
                    chatId,
                    agentProfile,
                    contactStateId: msg.contactStateId,
                    peerPhone,
                    pendingCheckoutOrder,
                    pendingCheckoutStage,
                    checkoutOrderData,
                    sessionId: msg.sessionId || null
                });
            }
            return;
        }

        const agencyInterruptHandled = await maybeHandleAgencyLookupInterrupt({
            text,
            chatId,
            customerContext,
            agentProfile,
            contactStateId: msg.contactStateId,
            peerPhone,
            pendingCheckoutOrder,
            pendingCheckoutStage,
            checkoutOrderData,
            sessionId: msg.sessionId || null
        });
        if (agencyInterruptHandled) return;

        if (
            pendingCheckoutStage === 'awaiting_package_choice_after_agency'
            && cleanFieldValue(text).length >= 1
            && !checkoutOrderData
        ) {
            const handled = await confirmAgencyQuantityAndAskName({
                jid: chatId,
                parsedOrder: pendingCheckoutOrder,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                inboundText: text,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

        if (selectedQuantityFromPrice) {
            const replyText = buildQuantityConfirmationReply({
                quantity: selectedQuantityFromPrice,
                customerContext
            });
            const sent = await sendText(chatId, replyText, null, { sessionId: msg.sessionId || null });
            if (!sent) return;
            await sendQuantitySelectionAudio({
                jid: chatId,
                countryCode: customerContext.countryCode,
                quantity: selectedQuantityFromPrice,
                sessionId: msg.sessionId || null,
                peerPhone
            });

            try {
                await Message.create({
                    _id: `out_${Date.now()}_quantity_confirm`,
                    chatId,
                    peerPhone,
                    from: 'bot',
                    to: chatId,
                    body: replyText,
                    isFromMe: true,
                    isBot: true,
                    timestamp: Math.floor(Date.now() / 1000)
                });
            } catch (e) { }

            await updateContactStateAgentMemory({
                contactStateId: msg.contactStateId,
                agentProfile,
                inboundText: text,
                outboundText: replyText,
                inferredIntent: 'purchase_intent',
                inferredFunnelStage: 'package_selection',
                inferredObjection: null
            });

            await ContactState.updateOne(
                { _id: msg.contactStateId },
                {
                    $set: {
                        [`metadata.perAgentMemory.${agentProfile.key}.selectedQuantity`]: selectedQuantityFromPrice,
                        [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'package_selection'
                    }
                }
            );
            console.log(`[FUNIL] Quantidade confirmada apos tabela -> ${chatId} | quantidade=${selectedQuantityFromPrice}`);
            return;
        }

        if (
            agentMemorySnapshot.lastFunnelStage === 'package_selection'
            && isOrderCloseAffirmation(text)
        ) {
            const selectedQuantity = normalizePackageQuantity(agentMemorySnapshot.selectedQuantity || 1);
            const handled = await askDeliveryModeAfterPackageSelection({
                jid: chatId,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                quantity: selectedQuantity,
                inboundText: text,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

        if (
            pendingCheckoutStage === 'awaiting_delivery_mode'
            && isAgencyDeliveryChoice(text)
            && !hasAgencyIndicationData(text)
        ) {
            const handled = await askAgencyDetails({
                jid: chatId,
                parsedOrder: pendingCheckoutOrder,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                inboundText: text,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

        if (
            pendingCheckoutStage === 'awaiting_delivery_mode'
            && isAgencyDeliveryChoice(text)
            && hasAgencyIndicationData(text)
        ) {
            const normalizedOrder = {
                ...pendingCheckoutOrder,
                deliveryMode: 'agency',
                stage: 'awaiting_agency_details'
            };
            const handled = await confirmAgencyDetailsAndAskName({
                jid: chatId,
                parsedOrder: normalizedOrder,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                inboundText: text,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

    if (
        pendingCheckoutStage === 'awaiting_delivery_mode'
        && isHomeDeliveryChoice(text)
        ) {
            const parsedHomeData = checkoutOrderData || parseCheckoutOrderMessage(text, { loose: true });
            const normalizedOrder = mergeCheckoutOrderData({
                baseOrder: pendingCheckoutOrder,
                incomingOrder: {
                    ...(parsedHomeData || {}),
                    deliveryMode: 'home',
                    stage: 'awaiting_customer_data'
                },
                selectedQuantity: selectedQuantityInMemory,
                peerPhone
            });
            if (parsedHomeData) {
                const handled = await sendCheckoutOrderNextStep({
                    jid: chatId,
                    parsedOrder: normalizedOrder,
                    customerContext,
                    agentProfile,
                    contactStateId: msg.contactStateId,
                    peerPhone,
                    sessionId: msg.sessionId || null
                });
                if (handled) {
                    console.log(`[FUNIL] Dados de domicilio lidos na mesma mensagem -> ${chatId}`);
                    return;
                }
            }

            const pendingHomeOrder = {
                ...normalizedOrder,
                deliveryMode: 'home',
                stage: 'awaiting_customer_name_data'
            };
            const missingKeys = missingCheckoutFieldKeys(pendingHomeOrder);
            const nextStage = 'awaiting_home_address';
            const replyText = [
                'Entiendo, senor 👍',
                '',
                'Si no puede retirar en agencia, entonces envieme por favor:',
                '',
                '- direccion completa',
                '- barrio o sector',
                '- referencia cercana (farmacia, tienda, gasolinera, iglesia, parque o escuela cercana)',
                '',
                'para revisar entrega a domicilio.'
            ].join('\n');
            await savePendingCheckoutOrderMemory({
                contactStateId: msg.contactStateId,
                agentProfile,
                parsedOrder: pendingHomeOrder,
                stage: nextStage,
                orderId: null
            });
            const audioSent = await sendFirstApprovedAudio({
                jid: chatId,
                countryCode: customerContext.countryCode,
                sessionId: msg.sessionId || null,
                baseNames: ['ENDERECO_ORIENTACAO', 'QUANDO_CLIENTE_PEDIR_A_DOMICILIO_REFERENCIA_COMPLETA'],
                label: 'Audio orientacao endereco domicilio'
            });
            if (audioSent) {
                await recordInitialFunnelStepMessage({
                    jid: chatId,
                    peerPhone,
                    body: '[AUDIO] ENDERECO_ORIENTACAO',
                    type: 'audio'
                });
                await updateContactStateAgentMemory({
                    contactStateId: msg.contactStateId,
                    agentProfile,
                    inboundText: text,
                    outboundText: `[AUDIO] ENDERECO_ORIENTACAO\n${replyText}`,
                    inferredIntent: 'purchase_intent',
                    inferredFunnelStage: nextStage,
                    inferredObjection: null
                });
                await sleep(1400);
            }
            const sent = await sendText(chatId, replyText, null, { sessionId: msg.sessionId || null });
            if (!sent) return;
            try {
                await Message.create({
                    _id: `out_${Date.now()}_home_details`,
                    chatId,
                    peerPhone,
                    from: 'bot',
                    to: chatId,
                    body: replyText,
                    isFromMe: true,
                    isBot: true,
                    timestamp: Math.floor(Date.now() / 1000)
                });
            } catch (e) { }
            await updateContactStateAgentMemory({
                contactStateId: msg.contactStateId,
                agentProfile,
                inboundText: text,
                outboundText: replyText,
                inferredIntent: 'purchase_intent',
                inferredFunnelStage: nextStage,
                inferredObjection: null
            });
            console.log(`[FUNIL] Dados de domicilio solicitados -> ${chatId}`);
            return;
        }

        if (
            pendingCheckoutStage === 'awaiting_home_address'
            && !checkoutOrderData
            && cleanFieldValue(text).length >= 4
        ) {
            const location = extractLocationFromText(text);
            const looksLikeOnlyCityProvince = Boolean(location.city || location.province)
                && !looksLikeLooseAddressLine(text)
                && !/\b(calle|avenida|av|mz|manzana|solar|villa|casa|numero|nro|lote|barrio|sector|referencia|ref|junto|cerca|frente|diagonal|interseccion|intersecci[oó]n|gasolinera|tienda|farmacia|iglesia|parque|escuela|colegio|upc)\b/i.test(normalizeFieldLabel(text));
            if (looksLikeOnlyCityProvince) {
                const updatedOrder = {
                    ...(pendingCheckoutOrder || {}),
                    city: pendingCheckoutOrder?.city || location.city || '',
                    province: pendingCheckoutOrder?.province || location.province || '',
                    deliveryMode: 'home',
                    stage: 'awaiting_home_address'
                };
                const replyText = 'Perfecto. Ahora envieme la direccion completa de entrega y una referencia cercana, como una tienda, farmacia, gasolinera, iglesia, parque o escuela cercana.';
                await savePendingCheckoutOrderMemory({
                    contactStateId: msg.contactStateId,
                    agentProfile,
                    parsedOrder: updatedOrder,
                    stage: 'awaiting_home_address',
                    orderId: null
                });
                await sleep(1800);
                const sent = await sendText(chatId, replyText, null, { sessionId: msg.sessionId || null });
                if (!sent) return;
                await updateContactStateAgentMemory({
                    contactStateId: msg.contactStateId,
                    agentProfile,
                    inboundText: text,
                    outboundText: replyText,
                    inferredIntent: 'purchase_intent',
                    inferredFunnelStage: 'awaiting_home_address',
                    inferredObjection: null
                });
                console.log(`[FUNIL] Cidade/provincia de domicilio recebidas; endereco solicitado -> ${chatId}`);
                return;
            }
        }

        if (
            pendingCheckoutStage === 'awaiting_agency_details'
            && cleanFieldValue(text).length >= 6
            && !checkoutOrderData
            && !isInitialProductInquiry(text)
        ) {
            const handled = await confirmAgencyDetailsAndAskName({
                jid: chatId,
                parsedOrder: pendingCheckoutOrder,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                inboundText: text,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

        if (
            ['awaiting_agency_selection', 'awaiting_agency_selection_interrupt'].includes(pendingCheckoutStage)
            && cleanFieldValue(text).length >= 1
            && !checkoutOrderData
            && !isInitialProductInquiry(text)
        ) {
            const handled = await confirmAgencySelectionAndAskName({
                jid: chatId,
                parsedOrder: pendingCheckoutOrder,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                inboundText: text,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

        if (
            pendingCheckoutStage === 'awaiting_customer_name'
            && cleanFieldValue(text).length >= 3
            && !checkoutOrderData
            && !isInitialProductInquiry(text)
        ) {
            const handled = await confirmCustomerNameAndAskFinalApproval({
                jid: chatId,
                parsedOrder: pendingCheckoutOrder,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                inboundText: text,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

        if (
            ['awaiting_package_choice', 'awaiting_one_bottle_choice'].includes(pendingCheckoutStage)
            && isSelectedPackageChoice(text, pendingCheckoutOrder)
        ) {
            const handled = await sendAgencyConfirmationRequest({
                jid: chatId,
                parsedOrder: pendingCheckoutOrder,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

        if (pendingCheckoutStage === 'awaiting_agency_confirmation' && isOrderCloseAffirmation(text)) {
            const handled = await finalizeCheckoutOrder({
                jid: chatId,
                parsedOrder: pendingCheckoutOrder,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

        if (
            pendingCheckoutOrder
            && ['awaiting_reference', 'awaiting_home_address'].includes(pendingCheckoutStage)
            && !pendingCheckoutOrder.reference
            && !checkoutOrderData
            && !isInitialProductInquiry(text)
            && cleanFieldValue(text).length >= 3
            && missingCheckoutFieldKeys(pendingCheckoutOrder).every((field) => field === 'reference')
            && !looksLikePersonNameOnly(text)
        ) {
            const completedOrder = {
                ...pendingCheckoutOrder,
                reference: cleanFieldValue(text)
            };
            const handled = await sendCheckoutOrderNextStep({
                jid: chatId,
                parsedOrder: completedOrder,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

        const pendingFallbackHandled = await maybeHandlePendingCheckoutFallback({
            text,
            chatId,
            agentProfile,
            contactStateId: msg.contactStateId,
            peerPhone,
            pendingCheckoutOrder,
            pendingCheckoutStage,
            checkoutOrderData,
            sessionId: msg.sessionId || null
        });
        if (pendingFallbackHandled) return;

        if (shouldCloseOrderDeterministically({
            text,
            agentProfile,
            history: customerMemory.history
        })) {
            const deliveryMode = inferDeliveryModeFromCloseContext({
                history: customerMemory.history,
                customerProfile: customerMemory.customerProfile
            });
            const thankYouText = buildOrderClosedThankYouText({ deliveryMode, customerContext });

            if (shouldBlockDuplicateBotReply({
                contactState,
                agentProfile,
                replyText: thankYouText
            })) {
                console.log(`[FUNIL] Fechamento repetido bloqueado -> ${chatId} | agente=${agentProfile.key}`);
                return;
            }

            const textSent = await sendText(chatId, thankYouText, null, { sessionId: msg.sessionId || null });
            if (!textSent) {
                console.warn(`[FUNIL] Agradecimento de fechamento nao entregue -> ${chatId} | agente=${agentProfile.key}`);
                return;
            }

            const orderClosedAudios = await sendOrderClosedAudios({
                jid: chatId,
                countryCode: customerContext.countryCode,
                sessionId: msg.sessionId || null
            });

            try {
                await Message.create({
                    _id: `out_${Date.now()}_order_close`,
                    chatId,
                    peerPhone,
                    from: 'bot',
                    to: chatId,
                    body: thankYouText,
                    isFromMe: true,
                    isBot: true,
                    timestamp: Math.floor(Date.now() / 1000)
                });
            } catch (e) { }

            if (memoryOrder) {
                memoryOrder.status = 'confirmed';
                memoryOrder.conversationMemory = {
                    ...(memoryOrder.conversationMemory || {}),
                    activeAgent: agentProfile.key,
                    funnelStage: 'order_closed',
                    lastBotMessageAt: new Date(),
                    orderClosedDeliveryMode: deliveryMode,
                    orderClosedAudioSent: orderClosedAudios.thankYouAudioSent,
                    orderClosedBonusNoticeAudioSent: orderClosedAudios.bonusNoticeAudioSent
                };
                await memoryOrder.save();
            }

            await updateContactStateAgentMemory({
                contactStateId: msg.contactStateId,
                agentProfile,
                inboundText: text,
                outboundText: thankYouText,
                inferredIntent: 'purchase_intent',
                inferredFunnelStage: 'order_closed',
                inferredObjection: null
            });

            if (msg.contactStateId) {
                await ContactState.updateOne(
                    { _id: msg.contactStateId },
                    {
                        $set: {
                            [`metadata.perAgentMemory.${agentProfile.key}.orderClosedThankYouSentAt`]: new Date(),
                            [`metadata.perAgentMemory.${agentProfile.key}.orderClosedDeliveryMode`]: deliveryMode,
                            [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'order_closed'
                        }
                    }
                );
            }

            console.log(`[FUNIL] Fechamento confirmado -> ${chatId} | entrega=${deliveryMode} | agente=${agentProfile.key}`);
            return;
        }

        const restartInitialProductPresentation = shouldRestartInitialProductPresentationAfterClosedOrder({
            text,
            agentProfile,
            contactState
        });

        if (!restartInitialProductPresentation && shouldBlockRepeatedInitialProductPresentation({ text, agentProfile, contactState })) {
            await ContactState.updateOne(
                { _id: msg.contactStateId },
                {
                    $set: {
                        [`metadata.perAgentMemory.${agentProfile.key}.lastRepeatedInitialProductBlockedAt`]: new Date(),
                        [`metadata.perAgentMemory.${agentProfile.key}.lastRepeatedInitialProductText`]: text,
                        [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'initial_product_presentation_already_done'
                    },
                    $inc: {
                        [`metadata.perAgentMemory.${agentProfile.key}.repeatedInitialProductBlockedCount`]: 1
                    }
                }
            );
            console.log(`[FUNIL] Entrada inicial repetida bloqueada por memoria -> ${chatId} | agente=${agentProfile.key}`);
            return;
        }

        if (restartInitialProductPresentation) {
            await resetInitialProductPresentationMemory({
                contactStateId: msg.contactStateId,
                agentProfile
            });
            console.log(`[FUNIL] Reiniciando apresentacao inicial apos pedido fechado -> ${chatId} | agente=${agentProfile.key}`);
        }

        if (
            checkoutOrderData
            || restartInitialProductPresentation
            || shouldRunInitialProductPresentation({ text, agentProfile, contactState })
        ) {
            const presentation = await sendInitialProductPresentation({
                jid: chatId,
                contactStateId: msg.contactStateId,
                customerContext,
                sessionId: msg.sessionId || null,
                agentMemory: restartInitialProductPresentation ? {} : agentMemorySnapshot,
                priceTextOverride: null,
                includePrice: !checkoutOrderData
            });

            if (!presentation.delivered) {
                console.warn(`[FUNIL] Apresentacao inicial nao entregue -> ${chatId} | agente=${agentProfile.key} | checkout=${Boolean(checkoutOrderData)} | interrupted=${Boolean(presentation.interrupted)}`);
                if (checkoutOrderData) {
                    const handled = await sendCheckoutOrderNextStep({
                        jid: chatId,
                        parsedOrder: checkoutOrderData,
                        customerContext,
                        agentProfile,
                        contactStateId: msg.contactStateId,
                        peerPhone,
                        sessionId: msg.sessionId || null
                    });
                    if (handled) return;
                }
                return;
            }

            await updateContactStateAgentMemory({
                contactStateId: msg.contactStateId,
                agentProfile,
                inboundText: text,
                outboundText: presentation.priceText || '[MIDIAS] Inicio_01 + Inicio_02 + Provas + Frasco Vit Power',
                inferredIntent: 'purchase_intent',
                inferredFunnelStage: 'initial_product_presentation',
                inferredObjection: null,
                sentImageKeys: presentation.sentImages
                    .filter((item) => item.sent)
                    .map((item) => item.key)
            });

            await ContactState.updateOne(
                { _id: msg.contactStateId },
                {
                    $set: {
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationSentAt`]: new Date(),
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationCompletedAt`]: presentation.isComplete ? new Date() : agentMemorySnapshot.initialProductPresentationCompletedAt,
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationSteps`]: presentation.completedSteps,
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationPriceSentAt`]: presentation.priceSent ? new Date() : agentMemorySnapshot.initialProductPresentationPriceSentAt,
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationAudios`]: presentation.sentAudios,
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationImages`]: presentation.sentImages,
                        [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'initial_product_presentation'
                    }
                }
            );

            console.log(`[FUNIL] Apresentacao inicial enviada -> ${chatId} | agente=${agentProfile.key}`);
            if (checkoutOrderData) {
                const handled = await sendCheckoutOrderNextStep({
                    jid: chatId,
                    parsedOrder: checkoutOrderData,
                    customerContext,
                    agentProfile,
                    contactStateId: msg.contactStateId,
                    peerPhone,
                    sessionId: msg.sessionId || null
                });
                if (handled) return;
            }
            return;
        }

        if (checkoutOrderData) {
            const handled = await sendCheckoutOrderNextStep({
                jid: chatId,
                parsedOrder: checkoutOrderData,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                peerPhone,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

        let replyText = null;
        const pureBody = text.trim().toLowerCase();
        const shortGreetings = ['oi', 'olá', 'ola', 'hola', 'opa', 'bom dia', 'boa tarde', 'boa noite'];
        const isShortGreeting = pureBody.length <= 4 || shortGreetings.includes(pureBody);

        if (isShortGreeting) {
            replyText = getGreetingReply({ agentProfile, alreadyIntroduced });
        } else {
            console.log(`[AI-START] 🤖 Consultando OpenAI... agente=${agentProfile.key}`);
            const aiResult = await openaiService.generateResponse(text, {
                ...customerContext,
                alreadyIntroduced,
                history: customerMemory.history,
                customerProfile: customerMemory.customerProfile,
                conversationMemory: memoryOrder?.conversationMemory || customerMemory.customerProfile?.conversationMemory || null,
                agentKey: agentProfile.key,
                agentMode: agentProfile.mode,
                agentPrompt: agentProfile.promptAddOn || '',
                agentSystemPrompt: agentProfile.systemPrompt || ''
            });
            replyText = avoidRepeatedReply({
                replyText: aiResult.text,
                history: customerMemory.history,
                agentProfile
            });
            replyText = sanitizeFinalOrderConfirmationReply({
                replyText,
                customerContext,
                customerProfile: customerMemory.customerProfile
            });
        }

        if (!replyText) return;
        const shouldSendOrderClosedAudio = ORDER_CLOSED_TAG_REGEX.test(replyText)
            || hasLeakedOrderClosedAudioMarker(replyText);
        ORDER_CLOSED_TAG_REGEX.lastIndex = 0;
        replyText = removeLeakedAudioMarkers(replyText.replace(ORDER_CLOSED_TAG_REGEX, ''));
        replyText = avoidRepeatedReply({
            replyText,
            history: customerMemory.history,
            agentProfile
        });

        const inferredIntent = memoryOrder?.$locals?.inferredIntent || inferIntent(text);
        const inferredFunnelStage = memoryOrder?.$locals?.inferredFunnelStage || inferFunnelStage(text, customerContext, agentProfile);
        const inferredObjection = memoryOrder?.$locals?.inferredObjection || inferLastObjection(text);
        const responseMode = determineResponseMode({
            replyText,
            intent: inferredIntent,
            funnelStage: inferredFunnelStage,
            agentProfile,
            isShortGreeting
        });
        const preparedPlan = enrichOutboundPlan({
            rawText: replyText,
            forceAudioText: shouldForceAudio({
                intent: inferredIntent,
                lastObjection: inferredObjection,
                agentProfile
            }) ? replyText : null,
            forceImageKey: shouldForceImage({
                lastObjection: inferredObjection,
                customerContext,
                agentProfile,
                sentImageKeys
            }),
            recordedAudioCountry: customerContext.countryCode,
            mode: responseMode
        });

        if (shouldBlockDuplicateBotReply({
            contactState,
            agentProfile,
            replyText: preparedPlan.cleanText || replyText
        })) {
            console.log(`[OUTBOUND-BLOCKED] resposta repetida bloqueada -> ${chatId} | agente=${agentProfile.key}`);
            return;
        }

        const outbound = await executePreparedOutboundPlan({
            jid: chatId,
            plan: preparedPlan,
            sessionId: msg.sessionId || null,
            countryCode: customerContext.countryCode
        });

        if (!outbound.delivered) return;

        const orderClosedAudios = shouldSendOrderClosedAudio
            ? await sendOrderClosedAudios({
                jid: chatId,
                countryCode: customerContext.countryCode,
                sessionId: msg.sessionId || null
            })
            : { thankYouAudioSent: false, bonusNoticeAudioSent: false };

        console.log(`[OUTBOUND-OK] ✅ Resposta enviada para ${chatId} | agente=${agentProfile.key}`);
        try {
            await Message.create({
                _id: `out_${Date.now()}`,
                chatId,
                peerPhone,
                from: 'bot',
                to: chatId,
                body: outbound.cleanText || replyText,
                isFromMe: true,
                isBot: true,
                timestamp: Math.floor(Date.now() / 1000)
            });
        } catch (e) { }

        if (memoryOrder) {
            memoryOrder.conversationMemory = {
                ...(memoryOrder.conversationMemory || {}),
                activeAgent: agentProfile.key,
                lastBotMessageAt: new Date(),
                orderClosedAudioSent: orderClosedAudios.thankYouAudioSent,
                orderClosedBonusNoticeAudioSent: orderClosedAudios.bonusNoticeAudioSent
            };
            await memoryOrder.save();
        }

        await updateContactStateAgentMemory({
            contactStateId: msg.contactStateId,
            agentProfile,
            inboundText: text,
            outboundText: outbound.cleanText || replyText,
            inferredIntent,
            inferredFunnelStage,
            inferredObjection,
            sentImageKeys: Array.isArray(preparedPlan.imageKeys) ? preparedPlan.imageKeys : []
        });
    } catch (error) {
        console.error('[BOT-FATAL-ERROR] ❌ Erro geral:', error);
    }
};
