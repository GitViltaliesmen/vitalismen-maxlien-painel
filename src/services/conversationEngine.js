import fs from 'fs';
import path from 'path';
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
import { getNextItemByPurpose, markPurposeItemSent } from './funnelPurposeMemoryService.js';
import { isInitialProductInquiry, isSimpleGreeting, looksLikeOrderDataMessage, startsWithOfficialInitialCtaMessage } from './initialFunnelTriggers.js';
import { formatAgencyOptionLine, formatServientregaAgency, findKnownServientregaEcuadorLocation, findServientregaEcuadorAgencies, loadServientregaEcuadorAgencies, resolveServientregaEcuadorAgency } from './servientregaEcuadorAgencyService.js';
import { buildRefillReminderText } from './shipmentMessageService.js';
import { sendPurchaseEventForOrder } from './metaConversionsService.js';
import { VIT_POWER_APPROVED_AUDIO_CANDIDATES } from './vitPowerEvolvedWorkflow.js';
import { syncContactDraftToOnlineAdminPanel } from './adminPanelStatusService.js';
import { orderLooksClosedForRepurchase } from './orderDuplicateGuardService.js';
import { searchDroppiEcuadorOrdersFromPanel, syncDroppiEcuadorFromPanel } from './droppiEcuadorBrowserService.js';
import { upsertDroppiEcuadorShipment } from './droppiEcuadorService.js';
import { analyzeAttentiveReader } from './observerAttentiveReaderService.js';
import { handleNitrixFastStateInbound } from './nitrixFastStateService.js';
import { handleTexUltraFunnelInbound } from './texUltraFunnelService.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const NITRIX_AGENT_KEY = 'nitrix_ec';
const VIT_POWER_AGENT_KEY = 'vit_power_ec';
const TEX_ULTRA_AGENT_KEY = 'tex_ultra_ec';
const NITRIX_PRODUCT_NAME = 'Nitrix Oxide Ecuador';
const TEX_ULTRA_PRODUCT_NAME = 'Tex Ultra Ecuador';
const NITRIX_BOTTLE_MEDIA = '/media/sales/ec/nitrix_bottle.png';
const normalizeProductRouteText = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s_/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const explicitlyMentionsVitPower = (value) => {
    const body = normalizeProductRouteText(value);
    return /\b(vit\s*power|vitpower|vipower|vi\s*power)\b/i.test(body);
};
const contactCameFromTexUltra = (contactState = {}) => {
    const metadata = contactState?.metadata || {};
    const draft = metadata.customerDraft || {};
    const keys = [
        metadata.productKey,
        draft.productKey,
        draft.productName,
        metadata.productName,
        metadata.vslPage,
        metadata.vslPath,
        metadata.vslSourceUrl
    ].map(normalizeProductRouteText);
    return keys.some((item) => (
        item === TEX_ULTRA_AGENT_KEY
        || item.includes('tex_ultra')
        || item.includes('tex ultra')
        || item.includes('texultra')
    )) || normalizeProductRouteText(contactState?.assignedAgent) === TEX_ULTRA_AGENT_KEY;
};
const contactCameFromNitrix = (contactState = {}) => {
    const metadata = contactState?.metadata || {};
    const draft = metadata.customerDraft || {};
    const keys = [
        metadata.productKey,
        draft.productKey,
        draft.productName,
        metadata.productName,
        metadata.vslPage,
        metadata.vslPath,
        metadata.vslSourceUrl
    ].map(normalizeProductRouteText);
    const hasNitrixContext = keys.some((item) => (
        item === NITRIX_AGENT_KEY
        || item === 'nx_ec'
        || item.includes('nitrix')
        || item.includes('nx_ec')
    ));
    if (hasNitrixContext) return true;
    const hasVitPowerContext = keys.some((item) => (
        item === VIT_POWER_AGENT_KEY
        || item.includes('vit_power')
        || item.includes('vit power')
        || item.startsWith('/m')
        || item.includes('maxlien.shop/m')
    ));
    if (hasVitPowerContext) return false;
    return normalizeProductRouteText(contactState?.assignedAgent) === NITRIX_AGENT_KEY;
};
const resolveAgentProfileForMessage = ({ text = '', contactState = {}, requestedProfile = null } = {}) => {
    // Product provenance is persistent. A word typed in a message must not
    // switch an established Nitrix client into the Vit Power funnel.
    if (contactCameFromTexUltra(contactState)) return AGENT_PROFILES[TEX_ULTRA_AGENT_KEY] || requestedProfile;
    if (contactCameFromNitrix(contactState)) return AGENT_PROFILES[NITRIX_AGENT_KEY] || requestedProfile;
    if ([NITRIX_AGENT_KEY, VIT_POWER_AGENT_KEY, TEX_ULTRA_AGENT_KEY].includes(requestedProfile?.key)) return requestedProfile;
    if (explicitlyMentionsVitPower(text)) return AGENT_PROFILES[VIT_POWER_AGENT_KEY] || requestedProfile;
    return AGENT_PROFILES[VIT_POWER_AGENT_KEY] || requestedProfile || AGENT_PROFILES[NITRIX_AGENT_KEY];
};
const noDropiBotTestPhones = () => [
    '5515998038637',
    process.env.WHATSAPP_PRIORITY_TEST_PHONES
]
    .join(',')
    .split(',')
    .map(digitsOnly)
    .filter(Boolean);
const isNoDropiBotTestPhone = (...values) => {
    const protectedPhones = noDropiBotTestPhones();
    return values
        .map(digitsOnly)
        .filter(Boolean)
        .some((candidate) => protectedPhones.some((phone) => (
            candidate === phone || candidate.endsWith(phone) || phone.endsWith(candidate)
        )));
};
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
        return randomMs('INITIAL_FUNNEL_AFTER_AUDIO_MIN_MS', 'INITIAL_FUNNEL_AFTER_AUDIO_MAX_MS', 4000, 8000);
    }

    if (kind === 'image') {
        return randomMs('INITIAL_FUNNEL_AFTER_IMAGE_MIN_MS', 'INITIAL_FUNNEL_AFTER_IMAGE_MAX_MS', 4000, 8000);
    }

    return randomMs('INITIAL_FUNNEL_BEFORE_PRICE_MIN_MS', 'INITIAL_FUNNEL_BEFORE_PRICE_MAX_MS', 4000, 8000);
};

const initialFunnelInterruptCheckEnabled = () => (
    String(process.env.INITIAL_FUNNEL_INTERRUPT_CHECK_ENABLED || 'false').toLowerCase() === 'true'
);

const publicMediaUrlFromPath = (filePath = '') => {
    const value = String(filePath || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value) || value.startsWith('/media/')) return value;
    const publicDir = path.join(process.cwd(), 'public');
    const resolved = path.resolve(value);
    if (!resolved.startsWith(publicDir)) return '';
    return `/${path.relative(publicDir, resolved).split(path.sep).join('/')}`;
};

const mediaPreviewUrlFor = (mediaUrl = '') => {
    const value = String(mediaUrl || '');
    if (!value.toLowerCase().endsWith('.ogg')) return '';
    const mp3Path = path.join(process.cwd(), 'public', value.replace(/^\//, '').replace(/\.ogg$/i, '.mp3'));
    return fs.existsSync(mp3Path) ? value.replace(/\.ogg$/i, '.mp3') : '';
};

const recordInitialFunnelStepMessage = async ({ jid, peerPhone = '', body, type = 'chat', mediaPath = '' }) => {
    if (!body) return;
    const mediaUrl = publicMediaUrlFromPath(mediaPath);
    try {
        await Message.create({
            _id: `out_${Date.now()}_initial_${Math.random().toString(16).slice(2, 8)}`,
            chatId: jid,
            peerPhone: peerPhone || digitsOnly(jid),
            from: 'bot',
            to: jid,
            body,
            type,
            hasMedia: Boolean(mediaUrl),
            mediaUrl,
            mediaPreviewUrl: mediaPreviewUrlFor(mediaUrl),
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

const SERVIENTREGA_EC_GUARDED_CITY_VARIANTS = /\b(?:sucua|sucúa)\b/gi;

const normalizeServientregaVariants = (value) => String(value || '')
    .replace(SERVIENTREGA_EC_GUARDED_CITY_VARIANTS, 'sucua')
    .replace(/\bser\s*entrega\b/gi, 'servientrega')
    .replace(/\bserentrega\b/gi, 'servientrega')
    .replace(/\bservi\s+en\s+trega\b/gi, 'servientrega')
    .replace(/\bcervi\s+en\s+trega\b/gi, 'servientrega')
    .replace(/\bse\s+ventrega\b/gi, 'servientrega')
    .replace(/\bser\s+ventrega\b/gi, 'servientrega')
    .replace(/\bservi\s+entrega\b/gi, 'servientrega')
    .replace(/\bserv\s+entrega\b/gi, 'servientrega')
    .replace(/\b(?:cer|cervi|cevi|sevi|serbi|sirvi|servent|serven|servien|servi)\s*(?:entrega|entega|entreha|entregas?)\b/gi, 'servientrega')
    .replace(/\b(?:cervientrega|cevientrega|sevientrega|serbientrega|sirvientrega|servientega|servientreha|servientregas)\b/gi, 'servientrega')
    .replace(/\b(?:cervi|cevi|sevi|serbi|sirvi|servi)\b(?=\s+(?:cercana|cerca|agencia|oficina|palenque|palanque|palanda|los\s+r[ií]os|los\s+rios))/gi, 'servientrega')
    .replace(/\bs[eé]rvi\b/gi, 'servientrega')
    .replace(/\bsanta\s+presca\b/gi, 'Santa Prisca');

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
    'atuntaqui',
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

const parsePackageQuantityText = (value) => {
    const body = normalizeFieldLabel(value)
        .replace(/\btre\b(?=\s*(botella|botellas|frasco|frascos|mes|meses|tratamiento|tratamientos|producto|productos)\b)/g, 'tres');
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
        const landmarkMatch = raw.match(/\b(frente\s+(?:a|al|ao)|cerca\s+de|al\s+lado\s+de|junto\s+a|referencia)\b\s*(.+)$/i);
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
    const landmarkMatch = String(text || '').match(/\b(frente\s+(?:a|al|ao)|cerca\s+de|al\s+lado\s+de|junto\s+a)\b\s*(.+)$/im);
    return landmarkMatch?.[0] ? cleanFieldValue(landmarkMatch[0]) : '';
};

const extractLocationFromText = (value) => {
    const raw = cleanFieldValue(value);
    const normalized = normalizeLocationText(raw);
    const result = {};

    const cityMatch = raw.match(/\bciudad\s*[:.]?\s*([a-záéíóúñ\s]+?)(?:[,.;\n]|$)/i);
    if (cityMatch?.[1]) {
        const cityCandidate = cleanFieldValue(cityMatch[1]);
        const normalizedCity = normalizeLocationText(cityCandidate);
        const knownCity = getEcuadorLocationCatalog().cities.find((city) => normalizedCity.includes(city));
        result.city = knownCity ? titleCaseFromNormalized(knownCity) : cityCandidate;
    } else {
        const knownCity = getEcuadorLocationCatalog().cities.find((city) => new RegExp(`\\b${city.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized));
        if (knownCity) result.city = titleCaseFromNormalized(knownCity);
    }

    const provinceMatch = raw.match(/\bprov[ií]ncia\s*[:.]?\s*([a-záéíóúñ\s]+?)(?:[,.;\n]|$)/i);
    if (provinceMatch?.[1]) {
        const provinceCandidate = cleanFieldValue(provinceMatch[1]);
        const normalizedProvince = normalizeLocationText(provinceCandidate);
        const knownProvince = getEcuadorLocationCatalog().provinces.find((province) => normalizedProvince.includes(province));
        result.province = knownProvince ? titleCaseFromNormalized(knownProvince) : provinceCandidate;
    } else {
        const knownProvince = getEcuadorLocationCatalog().provinces.find((province) => new RegExp(`\\b${province.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized));
        if (knownProvince) result.province = titleCaseFromNormalized(knownProvince);
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
    if (/^(si|sí|sim|ok|okay|listo|correcto|correto|correcta|correta|esta\s+bien|est[aá]\s+bien|esta\s+correcto|est[aá]\s+correcto|esta\s+correto|est[aá]\s+correto|esta\s+correcta|est[aá]\s+correcta|de\s+acuerdo|estoy\s+de\s+acuerdo|est[aá]\s+de\s+acuerdo|puede|pueden|proceda|hagalo|h[aá]galo|me\s+sirve|todo\s+bien|todo\s+ok)$/i.test(normalized)) return false;
    if (/^(no|nop|negativo)\b.*\b(es|era|seria|sería)\b/i.test(normalized)) {
        const correctionLocation = findKnownServientregaEcuadorLocation({ text: raw });
        if (findKnownCity(normalized) || correctionLocation.city || correctionLocation.province) return false;
    }
    const locationAnswer = findKnownServientregaEcuadorLocation({ text: raw });
    if ((locationAnswer.city || locationAnswer.province) && /\b(quiero|deseo|retir|retiro|retirar|agencia|servientrega|ciudad|provincia|en|ahi|all[ií])\b/i.test(normalized)) return false;
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
    if (!fields.quantity) fields.quantity = parsePackageQuantityText(text);

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

const buildRepurchaseOrderId = () => {
    const stamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `EC-RECOMPRA-${stamp}-${random}`;
};

const PRICE_TABLE_BY_COUNTRY = {
    EC: {
        1: { value: '$39', total: 39 },
        2: { value: '$70', total: 70 },
        3: { value: '$95.99', total: 95.99 },
        6: { value: '$167.99', total: 167.99 }
    }
};

const VALID_PACKAGE_QUANTITIES = [1, 2, 3, 6];

const normalizePackageQuantity = (quantity) => {
    const parsed = Number.parseInt(String(quantity || ''), 10);
    return VALID_PACKAGE_QUANTITIES.includes(parsed) ? parsed : 1;
};

const isValidPackageQuantity = (quantity) => VALID_PACKAGE_QUANTITIES.includes(Number.parseInt(String(quantity || ''), 10));

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

const ACTIVE_SHIPMENT_TERMINAL_STATUSES = new Set([
    'ENTREGADO',
    'DEVUELTO',
    'CANCELADO',
    'CANCELADO_SERVIENTREGA',
    'CANCELADO SERVIENTREGA'
]);

const shipmentLooksActiveForOrderReuse = (shipment = {}) => {
    const status = String(shipment.logistics?.status || '').trim().toUpperCase();
    if (!status || ACTIVE_SHIPMENT_TERMINAL_STATUSES.has(status)) return false;
    return Boolean(
        shipment.logistics?.trackingNumber
        || shipment.logistics?.invoiceUrl
        || shipment.logistics?.invoicePath
        || shipment.logistics?.guidePrintUrl
    );
};

const upsertCheckoutOrderDraft = async ({ parsedOrder, customerContext, peerPhone }) => {
    const phone = parsedOrder.phone || peerPhone || '';
    if (isNoDropiBotTestPhone(phone, peerPhone)) {
        console.log(`[TEST-8637] pedido ignorado para teste limpo; nunca criar/Dropi -> ${digitsOnly(phone || peerPhone)}`);
        return null;
    }
    const phoneTail = digitsOnly(phone).slice(-10);
    const country = 'EC';
    const currency = 'USD';
    const activeShipment = phoneTail
        ? (await Shipment.find({
            country,
            'client.phone': { $regex: `${phoneTail}$` }
        })
            .sort({ 'logistics.lastStatusAt': -1, updatedAt: -1, createdAt: -1 })
            .limit(8)
            .lean()
            .catch(() => []))
            .find(shipmentLooksActiveForOrderReuse)
        : null;
    const activeShipmentOrder = activeShipment?.orderId
        ? await Order.findOne({ country, orderId: activeShipment.orderId })
        : null;
    const query = phoneTail
        ? {
            country,
            status: { $in: ['draft', 'pending', 'confirmed', 'processing', 'shipped'] },
            'customer.phone': { $regex: phoneTail }
        }
        : null;
    const existingOrder = activeShipmentOrder || (query
        ? await Order.findOne(query).sort({ updatedAt: -1, createdAt: -1 })
        : null);
    const existingShipment = activeShipment && activeShipment.orderId === existingOrder?.orderId
        ? activeShipment
        : existingOrder
        ? await Shipment.findOne({ orderId: existingOrder.orderId }).lean().catch(() => null)
        : null;
    const previousDeliveredOrder = existingOrder && orderLooksClosedForRepurchase(existingOrder, existingShipment)
        ? existingOrder
        : null;
    const order = previousDeliveredOrder ? null : existingOrder;
    const protectsActiveShipment = Boolean(
        order
        && activeShipment
        && activeShipment.orderId === order.orderId
        && !orderLooksClosedForRepurchase(order, existingShipment)
    );

    const payload = {
        country,
        customer: {
            name: parsedOrder.name,
            phone,
            address: parsedOrder.address,
            reference: parsedOrder.reference || '',
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
        notes: parsedOrder.reference ? `Punto de referencia: ${parsedOrder.reference}` : (order?.notes || ''),
        entryReason: previousDeliveredOrder ? 'repeat_purchase_after_delivered' : 'new_purchase',
        previousOrderId: previousDeliveredOrder?.orderId || '',
        previousDeliveredAt: deliveredAtFromShipmentSnapshot(existingShipment)
    };

    if (order) {
        if (protectsActiveShipment) {
            order.conversationMemory = {
                ...(order.conversationMemory || {}),
                currentIntent: 'post_order_support',
                lastCustomerMessageAt: new Date(),
                protectedActiveShipmentAt: new Date(),
                protectedActiveShipmentReason: 'active_shipment_reuse_blocked_duplicate_order'
            };
            order.$locals = {
                ...(order.$locals || {}),
                protectedActiveShipment: true
            };
            await order.save();
            console.log(`[FUNIL] Pedido ativo com guia preservado; novo rascunho bloqueado -> phoneTail=${phoneTail} | pedido=${order.orderId}`);
            return order;
        }
        order.customer = payload.customer;
        order.package = payload.package;
        order.total = payload.total;
        order.currency = payload.currency;
        order.source = payload.source;
        order.notes = payload.notes;
        order.conversationMemory = {
            ...(order.conversationMemory || {}),
            funnelStage: 'awaiting_order_confirmation',
            currentIntent: 'purchase_intent',
            lastCustomerMessageAt: new Date()
        };
        await order.save();
        return order;
    }

    const created = new Order({
        ...payload,
        orderId: previousDeliveredOrder ? buildRepurchaseOrderId() : undefined,
        entryAt: new Date(),
        conversationMemory: {
            funnelStage: 'awaiting_order_confirmation',
            currentIntent: 'purchase_intent',
            lastCustomerMessageAt: new Date()
        },
        draftCreatedAt: new Date()
    });
    await created.save();
    return created;
};

const buildConfirmedSalePayload = ({ order = null, parsedOrder = {}, deliveryMode = '', agency = null } = {}) => {
    const hasAgency = Boolean(
        deliveryMode === 'agency'
        || parsedOrder.deliveryMode === 'agency'
        || agency?.isAgency
        || agency?.name
        || parsedOrder.agency
        || parsedOrder.agencyName
    );
    const customer = order?.customer || {};
    const pack = order?.package || {};
    return {
        status: 'VENDA CONFIRMADA',
        nome_cliente: parsedOrder.name || parsedOrder.customerName || customer.name || '',
        quantidade_frascos: String(parsedOrder.quantity || pack.quantity || ''),
        modalidade_envio: hasAgency ? 'Agencia Servientrega' : 'Domicilio',
        endereco_entrega: hasAgency
            ? (agency?.address || parsedOrder.agencyAddress || parsedOrder.address || customer.address || '')
            : (parsedOrder.address || customer.address || ''),
        ponto_referencia: parsedOrder.reference || customer.reference || '',
        canal: 'WhatsApp_Agilize_Codex'
    };
};

const saveConfirmedSalePayloadToContact = async ({ contactStateId, agentProfile, payload }) => {
    if (!contactStateId || !agentProfile?.key || !payload) return;
    const state = await ContactState.findById(contactStateId).lean().catch(() => null);
    const previous = (((state?.metadata || {}).perAgentMemory || {})[agentProfile.key] || {}).conversationState || {};
    const conversationState = {
        phone: state?.phoneDigits || previous.phone || '',
        name: payload.nome_cliente || previous.name || '',
        province: previous.province || '',
        city: previous.city || '',
        address: payload.endereco_entrega || previous.address || '',
        reference: payload.ponto_referencia || previous.reference || '',
        agency: payload.modalidade_envio === 'Agencia Servientrega' ? (previous.agency || payload.endereco_entrega || '') : '',
        quantity: payload.quantidade_frascos || previous.quantity || '',
        total: previous.total || '',
        profile_type: previous.profile_type || 'purchase_intent',
        stage: 'order_closed',
        buyer_score: previous.buyer_score || '',
        last_audio_sent: previous.last_audio_sent || '',
        last_question_sent: previous.last_question_sent || '',
        last_objection: previous.last_objection || '',
        conversation_summary: previous.conversation_summary || `status=${payload.status} | canal=${payload.canal}`,
        scheduled_date: previous.scheduled_date || '',
        scheduled_reason: previous.scheduled_reason || '',
        do_not_ship_before: Boolean(previous.do_not_ship_before),
        followup_status: previous.followup_status || 'sale_confirmed'
    };
    const previousDraft = state?.metadata?.customerDraft || {};
    const confirmedDraft = {
        ...previousDraft,
        phone: previousDraft.phone || state?.phoneDigits || previous.phone || '',
        name: payload.nome_cliente || previousDraft.name || previous.name || '',
        address: payload.endereco_entrega || previousDraft.address || previous.address || '',
        reference: payload.ponto_referencia || previousDraft.reference || previous.reference || '',
        quantity: payload.quantidade_frascos || previousDraft.quantity || previous.quantity || '',
        country: previousDraft.country || state?.countryCode || 'EC',
        status: 'confirmed'
    };
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${agentProfile.key}.confirmedSalePayload`]: payload,
                [`metadata.perAgentMemory.${agentProfile.key}.conversationState`]: conversationState,
                'metadata.customerDraft': confirmedDraft,
                'metadata.lastKnownFunnelStage': 'order_closed'
            }
        }
    );
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

const isAgencyCheckoutDelivery = (parsedOrder = {}) => {
    if (parsedOrder.deliveryMode === 'agency') return true;
    return /(agencia|servientrega|oficina|retiro|retirar)/i.test([
        parsedOrder.address,
        parsedOrder.reference,
        parsedOrder.agencyName,
        parsedOrder.agencyAddress,
        parsedOrder.rawAgencyDetails
    ].filter(Boolean).join(' '));
};

const requiresHomeReference = (parsedOrder = {}) => parsedOrder.deliveryMode === 'home' && !isAgencyCheckoutDelivery(parsedOrder);

const isDeliveredShipmentSnapshot = (shipment = null) => {
    if (!shipment) return false;
    const status = String(shipment.logistics?.status || '').toUpperCase();
    return Boolean(
        status === 'ENTREGADO'
        || shipment.outcomes?.delivered
        || shipment.outcomes?.pickedUp
        || shipment.automation?.deliveredConfirmedAt
    );
};

const deliveredAtFromShipmentSnapshot = (shipment = null) => {
    if (!shipment) return null;
    return [
        shipment.automation?.deliveredConfirmedAt,
        shipment.logistics?.lastStatusAt,
        shipment.updatedAt,
        shipment.createdAt
    ]
        .filter(Boolean)
        .map((value) => new Date(value))
        .find((value) => !Number.isNaN(value.getTime())) || null;
};

const missingCheckoutFieldKeys = (parsedOrder = {}) => {
    const missing = [];
    if (!parsedOrder.name) missing.push('name');
    if (!parsedOrder.province) missing.push('province');
    if (!parsedOrder.city) missing.push('city');
    if (!parsedOrder.address) missing.push('address');
    if (requiresHomeReference(parsedOrder) && !parsedOrder.reference) missing.push('reference');
    if (!parsedOrder.quantity) missing.push('quantity');
    return missing;
};

const missingCheckoutFields = (parsedOrder = {}) => {
    const labels = {
        name: 'nombre completo',
        province: 'provincia',
        city: 'ciudad',
        address: 'direccion completa',
        reference: 'punto de referencia',
        quantity: 'cantidad',
    };
    return missingCheckoutFieldKeys(parsedOrder).map((key) => labels[key]);
};

const checkoutDataStageFromMissing = (missingKeys = []) => {
    if (missingKeys.includes('name')) return 'awaiting_customer_name_data';
    if (missingKeys.includes('city') || missingKeys.includes('province')) return 'awaiting_city_province';
    if (missingKeys.includes('address')) return 'awaiting_home_address';
    if (missingKeys.includes('reference')) return 'awaiting_reference';
    if (missingKeys.includes('quantity')) return 'awaiting_quantity_data';
    return 'awaiting_agency_confirmation';
};

const normalizeOptionalPackageQuantity = (quantity) => {
    const parsed = Number.parseInt(String(quantity || ''), 10);
    return VALID_PACKAGE_QUANTITIES.includes(parsed) ? parsed : 0;
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

    if (!merged.quantity) {
        merged.quantity = normalizeOptionalPackageQuantity(selectedQuantity);
    }
    if (!merged.phone && peerPhone) {
        merged.phone = peerPhone;
    }

    const location = extractLocationFromText([
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

    if (missingKeys.includes('name')) {
        return 'Perfecto. Para dejar el pedido a su nombre, me envia su nombre y apellido por favor?';
    }
    if (missingKeys.includes('city') && missingKeys.includes('province')) {
        return `Gracias${namePrefix}. Ahora me envia su ciudad y provincia?`;
    }
    if (missingKeys.includes('city')) {
        return `Gracias${namePrefix}. Solo me falta la ciudad. Me la envia por favor?`;
    }
    if (missingKeys.includes('province')) {
        return `Gracias${namePrefix}. Solo me falta la provincia. Me la envia por favor?`;
    }
    if (missingKeys.includes('address') && missingKeys.includes('reference')) {
        return `Listo${namePrefix}. Ahora me envia la direccion completa y un punto de referencia para la entrega a domicilio?`;
    }
    if (missingKeys.includes('address')) {
        return `Listo${namePrefix}. Ahora me envia la direccion completa de entrega?`;
    }
    if (missingKeys.includes('reference')) {
        return `Listo${namePrefix}. Solo me falta un punto de referencia para la entrega a domicilio. Me lo envia por favor?`;
    }
    if (missingKeys.includes('quantity')) {
        return `Perfecto${namePrefix}. Con cuantos frascos desea empezar: 1, 3 o 6?`;
    }
    return `Perfecto${namePrefix}. Ya tengo una parte. Para dejarlo sin error, solo me falta: ${missing.join(', ')}. Me lo envia por favor?`;
};

const missingCheckoutFieldAudioNames = (missingKeys = []) => {
    if (missingKeys.includes('quantity')) {
        return ['TRATAMENTO_Y_PRECIOS_PROMOCAO', 'QUANTOS_FRASCOS_E_DIA_QUERES'];
    }
    if (missingKeys.includes('address') || missingKeys.includes('reference')) {
        return ['QUANDO_CLIENTE_PEDIR_A_DOMICILIO_REFERENCIA_COMPLETA', 'ENDERECO_ORIENTACAO'];
    }
    if (missingKeys.includes('name') || missingKeys.includes('city') || missingKeys.includes('province')) {
        return ['NOME_CIUDAD_PROVICINCIA'];
    }
    return [];
};

const buildCheckoutDataReceivedText = (parsedOrder = {}) => {
    const firstName = cleanFieldValue(parsedOrder.name).split(/\s+/)[0] || 'cliente';
    return `Gracias, ${firstName}. Ya tengo sus datos y la agencia indicada. Le dejo todo resumido para que pueda revisar con calma.`;
};

const buildCheckoutPackageCtaText = (customerContext, parsedOrder = {}) => {
    const offer = getSelectedOffer(customerContext, parsedOrder);
    const responseLabel = `${offer.quantity} FRASCO${offer.quantity > 1 ? 'S' : ''}`;
    return [
        `Hoy le puedo separar ${offer.label} de ${offer.product} por ${offer.value}.`,
        '',
        `Si esta bien para usted, responda: *${responseLabel}*.`
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
        '✅ Perfecto, ya tengo sus datos para el pedido.',
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
        'Me confirma si todo esta correcto para preparar el envio hoy?'
    ].filter((line) => line !== '').join('\n');

    return lines;
};

const buildCheckoutAgencyConfirmationText = ({ parsedOrder, customerContext }) => {
    const firstName = cleanFieldValue(parsedOrder.name).split(/\s+/)[0] || 'cliente';
    const offer = getSelectedOffer(customerContext, parsedOrder);
    const agency = getAgencyDetails(parsedOrder);
    return [
        `Listo, ${firstName}.`,
        '',
        `Le separo ${offer.label} de ${offer.product} por ${offer.value}.`,
        '',
        'Para evitar error, revise si la agencia es esta:',
        '',
        agency.name,
        agency.address,
        '',
        'Me confirma si dejamos el pedido en esta agencia?'
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
        const stage = checkoutDataStageFromMissing(missingKeys);
        const audioSent = String(process.env.VIT_POWER_MISSING_DATA_AUDIO_ENABLED || 'true').toLowerCase() !== 'false'
            ? await sendFirstApprovedAudioAndRecord({
                jid,
                countryCode: customerContext.countryCode,
                sessionId,
                peerPhone,
                baseNames: missingCheckoutFieldAudioNames(missingKeys),
                label: 'Audio dados faltantes do checkout'
            })
            : false;

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

        console.log(`[FUNIL] Dados do formulario incompletos -> ${jid} | etapa=${stage} | pedido=sem_pedido | audio=${audioSent}`);
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
        return /^(2|dos|2 frascos|dos frascos|2 botellas|dos botellas|quiero 2|quiero dos|quiero dos frascos|2 frascos vit power|dos frascos vit power)$/.test(body)
            || /\b2\s*(frascos|botellas|meses|tratamientos|productos)\b/i.test(body)
            || /\bdos\s*(frascos|botellas|meses|tratamientos|productos)\b/i.test(body);
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

const principalSdrIsConfirmationOnlyText = (text = '') => /^(si|sí|sim|ok|okay|listo|correcto|correto|correcta|correta|claro|dale|esta\s+bien|est[aá]\s+bien|esta\s+correcto|est[aá]\s+correcto|esta\s+correto|est[aá]\s+correto|esta\s+correcta|est[aá]\s+correcta|de\s+acuerdo|estoy\s+de\s+acuerdo|est[aá]\s+de\s+acuerdo|puede|pueden|proceda|hagalo|h[aá]galo|me\s+sirve|todo\s+bien|todo\s+ok)$/i.test(normalizeForDecision(text));
const isAgencyDeliveryChoice = (text) => /(ag[eê]ncia|agencia|servientrega|oficina|retiro|retirar|retira|retiro|mandeme\s+por\s+agencia|m[aá]ndeme\s+por\s+agencia|env[ií]eme\s+por\s+agencia|envieme\s+por\s+agencia|por\s+agencia)/i.test(normalizeServientregaVariants(text));
const isHomeDeliveryChoice = (text) => /\b(domicilio|domic[íi]lio|casa|residencia|residência|trabajo|trabalho|entrega\s+en\s+casa|a\s+mi\s+direccion|a\s+mi\s+direcci[oó]n|mi\s+direccion|mi\s+direcci[oó]n)\b/i.test(String(text || ''));
const isAgencyDeliveryConsent = (text = '') => {
    if (isHomeDeliveryChoice(text)) return false;
    const body = normalizeForDecision(normalizeServientregaVariants(text));
    return principalSdrIsConfirmationOnlyText(body)
        || isAgencyDeliveryChoice(body)
        || /\b(de acuerdo|correcto|esta bien|puede|proceda|hagalo|mandeme|mandar|envie|enviar|servientrega|por agencia|agencia cercana)\b/i.test(body);
};

const agencyFirstDeliveryQuestionText = () => '¿Puedo enviar su pedido para una agencia de Servientrega? Sí o no?';
const agencyFirstDeliveryRetryText = () => 'Respóndame por favor: sí o no.';
const agencyCityProvinceRequestText = () => 'Perfecto, señor. Para no cometer error con Servientrega, me confirma ciudad y provincia donde desea retirar?';

const hasAgencyIndicationData = (text) => {
    const body = normalizeServientregaVariants(text).trim();
    if (!body || principalSdrIsConfirmationOnlyText(body)) return false;
    const knownLocation = findKnownServientregaEcuadorLocation({ text: body });
    const hasKnownLocation = Boolean(knownLocation.city || knownLocation.province || knownLocation.agencies?.length);
    const hasCityOrProvinceLabel = /\b(ciudad|cidade|city|cant[oó]n|provincia|prov)\b/i.test(body);
    const hasAgencyHint = /(servientrega|ag[eê]ncia|agencia|oficina|centro|norte|sur|terminal|mall|avenida|av\.|calle|direcci[oó]n|direccion|referencia)/i.test(body);
    const hasAgencyCatalogMatch = findServientregaEcuadorAgencies({ query: body, limit: 4 }).length > 0;
    return body.length >= 6 && (hasKnownLocation || hasCityOrProvinceLabel || hasAgencyHint || hasAgencyCatalogMatch);
};

const titleCaseDeliveryPart = (value) => String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.length <= 2 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const stripAgencyNoise = (value) => cleanFieldValue(normalizeServientregaVariants(value))
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

    if (parts.length === 1) {
        return {
            destination: '',
            agency: titleCaseDeliveryPart(cleaned),
            address: titleCaseDeliveryPart(cleaned),
            city: '',
            province: '',
            cleaned
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
    const normalizedText = normalizeServientregaVariants(text);
    const lines = normalizedText.split(/\r?\n/);
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

    const raw = cleanFieldValue(normalizedText);
    const parsed = splitAgencyDestination(raw);
    const knownLocation = findKnownServientregaEcuadorLocation({
        city: fields.city || '',
        province: fields.province || parsed.province || '',
        text: raw
    });
    if (!fields.province && (knownLocation.province || parsed.province)) fields.province = knownLocation.province || parsed.province;
    if (!fields.city && (knownLocation.city || parsed.city)) fields.city = knownLocation.city || parsed.city;
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
            limit: 4
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
    const options = Array.isArray(parsedOrder.agencyOptions) ? parsedOrder.agencyOptions.slice(0, 4) : [];
    if (options.length === 1) {
        const formatted = formatServientregaAgency(options[0]);
        return [
            `Señor, puedo enviar su pedido para retirar en Agencia Servientrega ${formatted.name || 'seleccionada'} - ${formatted.address || 'direccion registrada'} (${formatted.city || 'ciudad registrada'}, ${formatted.province || 'provincia registrada'}). ¿Está correcto?`
        ].filter(Boolean).join('\n');
    }
    const header = 'Señor, por favor, escoja una agencia abajo:';
    const optionBlocks = options.map((agency, index) => {
        const label = String(index + 1);
        const formatted = formatServientregaAgency(agency);
        const name = formatted.name ? `, ${formatted.name}` : '';
        return [
            `${label}) SERVIENTREGA${name}`,
            formatted.address ? formatted.address : ''
        ].filter(Boolean).join('\n');
    });
    return [
        header,
        '',
        optionBlocks.join('\n\n'),
        '',
        `Responda con el número de la agencia: ${options.map((_, index) => String(index + 1)).join(', ')}.`
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

const AGENCY_SELECTION_NOISE_WORDS = new Set([
    'la',
    'el',
    'del',
    'de',
    'esa',
    'ese',
    'esta',
    'este',
    'me',
    'sirve',
    'conviene',
    'quiero',
    'prefiero',
    'escojo',
    'elijo',
    'agencia',
    'opcion',
    'servientrega',
    'por',
    'favor',
    'ahi',
    'alli',
    'retirar',
    'retiro'
]);

const agencySelectionTokens = (value = '') => normalizeFieldLabel(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !AGENCY_SELECTION_NOISE_WORDS.has(token));

const findUniqueAgencyOptionByDescriptor = (text, options = []) => {
    const normalized = normalizeFieldLabel(text);
    if (!normalized || !options.length) return null;

    const descriptorMatch = normalized.match(/\b(?:la|el|agencia|opcion)?\s*(?:del|de la|de el|de)?\s*(centro norte|centro sur|noreste|noroeste|sureste|suroeste|centro|norte|sur|este|oeste|terminal|mall|mercado|comision|transito|recreo|fortin|aeropuerto|alborada|sauces)\b/i);
    const descriptor = descriptorMatch?.[1] || '';
    if (descriptor) {
        const matches = options.filter((option) => {
            const optionText = normalizeFieldLabel(`${option.name} ${option.address} ${option.city} ${option.sector}`);
            return optionText.includes(descriptor);
        });
        if (matches.length === 1) return matches[0];
    }

    const tokens = agencySelectionTokens(normalized);
    if (!tokens.length) return null;
    const scored = options
        .map((option) => {
            const optionText = normalizeFieldLabel(`${option.name} ${option.address} ${option.city} ${option.sector}`);
            const hits = tokens.filter((token) => optionText.includes(token));
            return { option, hits };
        })
        .filter((item) => item.hits.length >= 1 && (item.hits.length >= 2 || item.hits.some((token) => token.length >= 6)))
        .sort((a, b) => b.hits.length - a.hits.length);

    if (!scored.length) return null;
    if (scored.length === 1) return scored[0].option;
    return scored[0].hits.length > scored[1].hits.length ? scored[0].option : null;
};

const selectAgencyOptionFromText = (text, options = [], { startNumber = 1 } = {}) => {
    const normalized = normalizeFieldLabel(text);
    if (!normalized || !options.length) return null;
    if (options.length === 1 && /^(esa|ese|esta|este|ahi|alli|esa me sirve|esa esta bien|esa esta correcta|esa esta correcto|esa mismo|esa misma|ahi retiro|me sirve|correcto|correto|correcta|correta|ok|okay|si|sí|sim|listo|de acuerdo|estoy de acuerdo|esta de acuerdo|está de acuerdo|esta correcto|esta correcta|esta bien|todo bien|todo ok)$/i.test(normalized)) {
        return options[0];
    }
    const agencyLetterTerms = '(?:opcion|opcao|agencia|letra|alternativa)';
    const agencyActionTerms = '(?:escojo|elijo|quiero|prefiero|selecciono|seleccione|mande|mandeme|mandamelo|envie|envieme|envielo|mandelo|mando|envio|escogi|elegi)';
    const letterMatch = normalized.match(/^(?:opcion\s+|opcao\s+|agencia\s+|letra\s+|alternativa\s+)?([abc])$/i)
        || normalized.match(/^([abc])\b/i)
        || normalized.match(new RegExp(`\\b${agencyLetterTerms}\\s*([abc])\\b`, 'i'))
        || normalized.match(new RegExp(`\\b${agencyActionTerms}\\s+(?:la\\s+|el\\s+|a\\s+|una\\s+|un\\s+)?(?:${agencyLetterTerms}\\s+)?([abc])\\b`, 'i'))
        || (new RegExp(`\\b(?:${agencyActionTerms}|${agencyLetterTerms})\\b`, 'i').test(normalized)
            ? normalized.match(/\b([abc])\s*$/i)
            : null);
    const letterIndex = letterMatch ? ['a', 'b', 'c'].indexOf(letterMatch[1].toLowerCase()) : -1;
    if (letterIndex >= 0 && letterIndex < options.length) return options[letterIndex];

    const ordinalMap = [
        ['primera', 'primeira', 'primer', 'primero', 'uno'],
        ['segunda', 'segundo', 'dos'],
        ['tercera', 'terceira', 'tercer', 'tercero', 'tres'],
        ['cuarta', 'quarta', 'cuarto', 'quarto', 'cuatro']
    ];
    const normalizedWords = normalized.split(/\s+/).filter(Boolean);
    const ordinalIndex = ordinalMap.findIndex((words) => words.some((word) => normalizedWords.includes(word)));
    if (ordinalIndex >= 0 && ordinalIndex < options.length) return options[ordinalIndex];

    const explicitNumberMatch = normalized.match(/\b(?:opcion|agencia|alternativa|numero)\s+([1-9][0-9]?)\b/i);
    const shortNumberMatch = normalized.match(/^([1-9][0-9]?)$/);
    const number = Number.parseInt(explicitNumberMatch?.[1] || shortNumberMatch?.[1] || '', 10);
    const absoluteIndex = number - Number(startNumber || 1);
    if (absoluteIndex >= 0 && absoluteIndex < options.length) return options[absoluteIndex];
    if (number >= 1 && number <= options.length) return options[number - 1];

    const uniqueDescriptorMatch = findUniqueAgencyOptionByDescriptor(normalized, options);
    if (uniqueDescriptorMatch) return uniqueDescriptorMatch;

    return options.find((option) => {
        const optionText = normalizeFieldLabel(`${option.name} ${option.address} ${option.city} ${option.sector}`);
        return normalized.length >= 4 && optionText.includes(normalized);
    }) || null;
};

const isConfirmationOnlyText = (text) => {
    const body = normalizeFieldLabel(text);
    if (!body || body.length > 100) return false;
    return /^(si|sim|sii|claro|correcto|correto|certo|cierto|correcta|correcto gracias|ok correcto|ok esta correcto|todo correcto|todo certo|todo bien|todo ok|esta correcto|esta correcta|esta bien|esta bueno|esta ok|asi esta bien|me parece bien|ok esta ok|ok|okay|listo|perfecto|esta perfecto|confirmo|confirmado|confirmo la compra|confirmo el pedido|de acuerdo|dale|hagale|adelante|proceda|puede proceder|puede enviar|autorizo|autorizado|aprobado|acepto|aceptado|vale|bueno|bien|asi es|si senora|si gracias|ok gracias|bien gracias|mande nomas|envie nomas|envielo nomas|mandelo nomas)$/.test(body);
};

const looksLikeCustomerFullName = (text) => {
    const body = cleanFieldValue(text);
    const normalized = normalizeFieldLabel(body);
    if (body.length < 5) return false;
    if (isConfirmationOnlyText(body)) return false;
    if (isAgencyDeliveryChoice(body) || isHomeDeliveryChoice(body)) return false;
    if (/^(no|nop|negativo)\b.*\b(es|era|seria|sería)\b/i.test(normalized)) {
        const correctionLocation = findKnownServientregaEcuadorLocation({ text: body });
        if (correctionLocation.city || correctionLocation.province) return false;
    }
    const locationAnswer = findKnownServientregaEcuadorLocation({ text: body });
    if ((locationAnswer.city || locationAnswer.province) && /\b(quiero|deseo|retir|retiro|retirar|agencia|servientrega|ciudad|provincia|en|ahi|all[ií])\b/i.test(normalized)) return false;
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

    const hasQuantity = Boolean(normalizeOptionalPackageQuantity(parsedOrder.quantity));
    const hasName = looksLikeCustomerFullName(parsedOrder.name || '');
    const shouldResumeQuantity = !hasQuantity;
    const offer = shouldResumeQuantity ? null : getSelectedOffer(customerContext, parsedOrder);
    const normalizedOrder = {
        ...parsedOrder,
        ...principalSdrApplyOfficialAgency(parsedOrder, selected),
        quantity: shouldResumeQuantity ? parsedOrder.quantity : offer.quantity,
        total: shouldResumeQuantity ? parsedOrder.total : offer.total,
        deliveryMode: 'agency',
        source: parsedOrder.source || 'whatsapp_package_selection',
        stage: shouldResumeQuantity
            ? 'awaiting_package_choice_after_agency'
            : (hasName ? 'awaiting_agency_confirmation' : 'awaiting_customer_name')
    };
    const replyText = shouldResumeQuantity
        ? buildAgencyQuantityRequestText(normalizedOrder)
        : (hasName
            ? buildFinalCustomerDataConfirmationText(normalizedOrder)
            : buildAgencyDetailsConfirmationText(normalizedOrder));
    const sent = await sendText(jid, replyText, null, {
        sessionId,
        outboundContext: 'agency_selection_next_step',
        dedupeValue: `agency_selection_next_step|${digitsOnly(peerPhone || jid)}|${normalizedOrder.stage}|${normalizedOrder.agencyName || normalizedOrder.agency || ''}`
    });
    try {
        if (sent) {
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
        }
    } catch (e) { }

    await savePendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        parsedOrder: normalizedOrder,
        stage: normalizedOrder.stage,
        orderId: parsedOrder.orderId || null
    });

    if (hasName && !shouldResumeQuantity) {
        const order = await updateOrderAfterAgencyStep({
            parsedOrder: normalizedOrder,
            customerContext,
            peerPhone,
            stage: 'awaiting_agency_confirmation'
        });
        if (order?.orderId) {
            await savePendingCheckoutOrderMemory({
                contactStateId,
                agentProfile,
                parsedOrder: normalizedOrder,
                stage: 'awaiting_agency_confirmation',
                orderId: order.orderId
            });
        }
    }

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText,
        outboundText: sent ? replyText : `[BLOQUEADO_ENVIO] ${replyText}`,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: normalizedOrder.stage,
        inferredObjection: null
    });
    console.log(`[FUNIL] Agencia Servientrega escolhida -> ${jid} | etapa=${normalizedOrder.stage} | sent=${sent}`);
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
        stage: looksLikeCustomerFullName(parsedOrder.name || '')
            ? 'awaiting_agency_confirmation'
            : 'awaiting_customer_name'
    };
    const alreadyHasName = normalizedOrder.stage === 'awaiting_agency_confirmation';
    const replyText = alreadyHasName
        ? buildFinalCustomerDataConfirmationText(normalizedOrder)
        : buildAgencyDetailsConfirmationText(normalizedOrder);
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
        stage: normalizedOrder.stage,
        orderId: null
    });

    if (alreadyHasName) {
        const order = await updateOrderAfterAgencyStep({
            parsedOrder: normalizedOrder,
            customerContext,
            peerPhone,
            stage: 'awaiting_agency_confirmation'
        });
        if (order?.orderId) {
            await savePendingCheckoutOrderMemory({
                contactStateId,
                agentProfile,
                parsedOrder: normalizedOrder,
                stage: 'awaiting_agency_confirmation',
                orderId: order.orderId
            });
        }
    }

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText,
        outboundText: replyText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: normalizedOrder.stage,
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

    const fallbackText = agencyFirstDeliveryQuestionText();
    const sent = await sendText(jid, fallbackText, null, { sessionId });
    if (!sent) return false;

    try {
        await Message.create({
            _id: `out_${Date.now()}_delivery_mode`,
            chatId: jid,
            peerPhone,
            from: 'bot',
            to: jid,
            body: audioSent ? `[AUDIO] PERGUNTA_AGENCIA_DOMICILIO\n${fallbackText}` : fallbackText,
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
        outboundText: audioSent ? `[AUDIO] PERGUNTA_AGENCIA_DOMICILIO\n${fallbackText}` : fallbackText,
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
    if (order.$locals?.protectedActiveShipment) return order;
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
    if (status === 'confirmed') {
        order.confirmedSalePayload = buildConfirmedSalePayload({
            order,
            parsedOrder,
            deliveryMode: 'agency',
            agency
        });
    }
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
    if (order?.$locals?.protectedActiveShipment) return true;
    await saveConfirmedSalePayloadToContact({
        contactStateId,
        agentProfile,
        payload: order?.confirmedSalePayload || buildConfirmedSalePayload({
            order,
            parsedOrder: normalizedOrder,
            deliveryMode: 'agency',
            agency: getAgencyDetails(normalizedOrder)
        })
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
        sessionId,
        peerPhone,
        deliveryMode: 'agency'
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

    await holdForHuman({
        contactStateId,
        agentProfile,
        reason: 'order_closed_human_handoff',
        note: 'Pedido fechado por agencia. Automacao pausada para evitar reinicio do funil.'
    });

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
            if (order.$locals?.protectedActiveShipment) {
                return true;
            }
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
            order.confirmedSalePayload = buildConfirmedSalePayload({
                order,
                parsedOrder: normalizedOrder,
                deliveryMode: 'home',
                agency
            });
            await order.save();
            await markMetaPurchaseForConfirmedOrder(order);
        }
    }
    if (order?.$locals?.protectedActiveShipment) return true;
    await saveConfirmedSalePayloadToContact({
        contactStateId,
        agentProfile,
        payload: order?.confirmedSalePayload || buildConfirmedSalePayload({
            order,
            parsedOrder: normalizedOrder,
            deliveryMode,
            agency
        })
    });

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
        sessionId,
        peerPhone,
        deliveryMode
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

    await holdForHuman({
        contactStateId,
        agentProfile,
        reason: 'order_closed_human_handoff',
        note: 'Pedido fechado. Automacao pausada para evitar reinicio do funil.'
    });

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

    await holdForHuman({
        contactStateId,
        agentProfile,
        reason: 'quantity_confirmed_human_handoff',
        note: 'Cliente confirmou quantidade. Automacao pausada para atendimento humano finalizar sem repetir funil.'
    });

    console.log(`[FUNIL] Fechamento apos quantidade confirmado -> ${jid} | agradecimento=${thankYouAudioSent} | bonus=${bonusNoticeAudioSent}`);
    return true;
};

const resolveRealChatId = (msg, contactState = null) => {
    const senderDigits = digitsOnly(msg.senderPn);
    if (senderDigits.startsWith('593') && String(msg.from || '').endsWith('@lid')) {
        return `${senderDigits}@s.whatsapp.net`;
    }

    const knownDigits = digitsOnly(contactState?.phoneDigits) || digitsOnly(contactState?.metadata?.lastSenderPn);
    if (knownDigits.startsWith('593') && String(msg.from || '').endsWith('@lid')) {
        return `${knownDigits}@s.whatsapp.net`;
    }

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

const customerContextForAgentProfile = (agentProfile, fallbackPhonePrefix = null) => {
    const base = customerContextFromCountryCode('EC', fallbackPhonePrefix);
    if (agentProfile?.key !== NITRIX_AGENT_KEY) return base;
    return {
        ...base,
        product: NITRIX_PRODUCT_NAME,
        priceTable: 'Nitrix Oxide Ecuador: atencion manual; no enviar precios automaticos.'
    };
};

const hasBotIntroducedItself = async (chatId) => {
    const legacyName = ['ana', 'lopez'].join(' ');
    const legacyAltName = ['ana', 'lopes'].join(' ');
    const introRegex = new RegExp(`soy (?:valeria zambrano|${legacyName}|${legacyAltName})`, 'i');
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
    'AGRADECIMENTO_AGENCIA_DE_ENTREGA',
    'Agradecimento_Agencia_01',
    'Pedido_Confirmado_01',
    'Pedido_Confirmado',
    'Agradecimento_Pedido',
    'Gracias_Pedido'
];
const ORDER_CLOSED_BONUS_AUDIO_NAMES = [
    'BONUS_RETIRADA'
];
const HOME_ORDER_CLOSED_AUDIO_NAMES = [
    'CONFIRMACION_Y_REGALITO_ESPECIAL',
    'CONFIRMACION Y REGALITO ESPECIAL'
];
const DELIVERY_MODE_AUDIO_NAMES = [
    'PERGUNTA_AGENCIA_DOMICILIO'
];
const AGENCY_DETAILS_AUDIO_NAMES = [
    'ENDERECO_CIDADE_PROVINCIA_AGENCIA'
];
const QUANTITY_SELECTION_AUDIO_NAMES = {
    1: [
        '1_BOTELLA_POR_39'
    ],
    3: [
        '3_BOTELLAS_POR_95_E_99'
    ],
    6: [
        '6_BOTELLAS_POR_167_E_99'
    ]
};
const officialPricePromotionText = () => (
    'Le confirmo, señor: 1 botella por 39 USD, 3 botellas por 95.99 USD y 6 botellas por 167.99 USD. ¿Cuál desea reservar?'
);

const approvedProstateCommercialText = () => (
    'Sí, señor, le explico. Vit Power es un apoyo natural para el bienestar masculino y le envío el audio con la orientación completa. ¿Desea que le pase también la promoción de 1, 3 o 6 frascos?'
);

const looksLikeSimpleProstateQuestion = (text = '') => (
    /\b(prostata|pr[oó]stata|prostatitis|prostati|orina|orinar|urinari|urinario|urinaria)\b/i.test(String(text || ''))
);

const hasProhibitedSimpleProstateText = (text = '') => (
    /(no debo prometer cura|diagn[oó]stico|tratamiento m[eé]dico|profesional de confianza|no es promesa de cura|consulte|consultar|confirme primero|m[eé]dico|farmac[eé]utico)/i.test(String(text || ''))
);

const sanitizeSimpleProstateCommercialReply = ({ inboundText = '', replyText = '' } = {}) => {
    if (!looksLikeSimpleProstateQuestion(inboundText)) return replyText;
    if (!hasProhibitedSimpleProstateText(replyText)) return replyText;
    return approvedProstateCommercialText();
};

const isGenericPriceQuestionWithoutQuantity = (text = '') => {
    const body = normalizeForDecision(text);
    if (!body) return false;
    if (detectRequestedQuantity(text)) return false;
    return /\b(precio|precios|valor|cuanto|cu[aá]nto|cuesta|costo|coste|vale|promo|promocion|promoci[oó]n)\b/i.test(body);
};

const sanitizeGenericPriceReply = ({ inboundText = '', replyText = '' } = {}) => {
    if (!isGenericPriceQuestionWithoutQuantity(inboundText)) return replyText;
    return officialPricePromotionText();
};

const sanitizeGenericPriceOutboundPlan = ({ inboundText = '', plan = {} } = {}) => {
    if (!isGenericPriceQuestionWithoutQuantity(inboundText)) return plan;
    return {
        ...plan,
        cleanText: officialPricePromotionText(),
        recordedAudioNames: ['TRATAMENTO_Y_PRECIOS_PROMOCAO']
    };
};

const sendFirstApprovedAudio = async ({
    jid,
    countryCode,
    sessionId = null,
    baseNames = [],
    label = 'audio',
    sendOptions = {}
}) => {
    for (const baseName of baseNames) {
        const audioPath = await resolveCountryAudio({ country: countryCode, baseName });
        if (!audioPath) continue;
        const sent = await sendAudio(jid, audioPath, true, { sessionId, ...sendOptions });
        if (sent) return true;
        console.warn(`[AUDIO] ${label} falhou para ${countryCode}/${baseName}; tentando proximo audio aprovado quando existir.`);
    }

    console.warn(`[AUDIO] ${label} aprovado nao encontrado para ${countryCode}. Esperado um destes: ${baseNames.join(', ')}`);
    return false;
};

const sendFirstApprovedAudioAndRecord = async ({
    jid,
    countryCode,
    sessionId = null,
    peerPhone = '',
    baseNames = [],
    label = 'audio',
    sendOptions = {}
}) => {
    for (const baseName of baseNames) {
        const audioPath = await resolveCountryAudio({ country: countryCode, baseName });
        if (!audioPath) continue;
        const sent = await sendAudio(jid, audioPath, true, { sessionId, ...sendOptions });
        if (sent) {
            await recordInitialFunnelStepMessage({
                jid,
                peerPhone,
                body: `[AUDIO] ${baseName}`,
                type: 'audio',
                mediaPath: audioPath
            });
            return true;
        }
        console.warn(`[AUDIO] ${label} falhou para ${countryCode}/${baseName}; tentando proximo audio aprovado quando existir.`);
    }

    if (baseNames.length) {
        console.warn(`[AUDIO] ${label} aprovado nao encontrado para ${countryCode}. Esperado um destes: ${baseNames.join(', ')}`);
    }
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

    let selectedAudioPath = '';
    await sleep(randomMs('QUANTITY_SELECTION_AUDIO_MIN_MS', 'QUANTITY_SELECTION_AUDIO_MAX_MS', 2200, 5200));
    for (const baseName of baseNames) {
        const audioPath = await resolveCountryAudio({ country: countryCode, baseName });
        if (!audioPath) continue;
        selectedAudioPath = audioPath;
        break;
    }
    const sent = selectedAudioPath
        ? await sendAudio(jid, selectedAudioPath, true, { sessionId })
        : false;
    if (!selectedAudioPath) {
        console.warn(`[AUDIO] audio_quantidade_${quantity} aprovado nao encontrado para ${countryCode}. Esperado um destes: ${baseNames.join(', ')}`);
    }

    if (sent) {
        try {
            const mediaUrl = publicMediaUrlFromPath(selectedAudioPath);
            await Message.create({
                _id: `out_${Date.now()}_quantity_audio_${quantity}`,
                chatId: jid,
                peerPhone: peerPhone || digitsOnly(jid),
                from: 'bot',
                to: jid,
                body: `[AUDIO] ${baseNames[0]}`,
                type: 'audio',
                hasMedia: Boolean(mediaUrl),
                mediaUrl,
                mediaPreviewUrl: mediaPreviewUrlFor(mediaUrl),
                isFromMe: true,
                isBot: true,
                timestamp: Math.floor(Date.now() / 1000)
            });
        } catch (e) { }
    }

    console.log(`[FUNIL] Audio de quantidade -> ${jid} | quantidade=${quantity} | sent=${sent}`);
    return sent;
};

const sendOrderClosedAudios = async ({ jid, countryCode, sessionId = null, peerPhone = '', deliveryMode = 'agency' }) => {
    if (String(process.env.ORDER_CLOSED_AUDIO_ENABLED || 'true').toLowerCase() !== 'true') {
        return { thankYouAudioSent: false, bonusNoticeAudioSent: false };
    }

    if (deliveryMode === 'home') {
        const homeAudioSent = await sendFirstApprovedAudioAndRecord({
            jid,
            countryCode,
            sessionId,
            peerPhone,
            baseNames: HOME_ORDER_CLOSED_AUDIO_NAMES,
            label: 'Audio de fechamento domicilio',
            sendOptions: {
                allowExistingDropiOrder: true,
                outboundContext: 'order_closed_home_audio'
            }
        });

        const bonusNoticeAudioSent = ORDER_CLOSED_BONUS_AUDIO_NAMES.length > 0
            ? await sendFirstApprovedAudioAndRecord({
                jid,
                countryCode,
                sessionId,
                peerPhone,
                baseNames: ORDER_CLOSED_BONUS_AUDIO_NAMES,
                label: 'Audio de bonus no fechamento domicilio',
                sendOptions: {
                    allowExistingDropiOrder: true,
                    outboundContext: 'order_closed_home_bonus_audio'
                }
            })
            : false;

        return { thankYouAudioSent: homeAudioSent, bonusNoticeAudioSent };
    }

    const thankYouAudioSent = await sendFirstApprovedAudioAndRecord({
        jid,
        countryCode,
        sessionId,
        peerPhone,
        baseNames: ORDER_CLOSED_AUDIO_NAMES,
        label: 'Audio de agradecimento no fechamento',
        sendOptions: {
            allowExistingDropiOrder: true,
            outboundContext: 'order_closed_audio'
        }
    });

    const bonusNoticeAudioSent = ORDER_CLOSED_BONUS_AUDIO_NAMES.length > 0
        ? await sendFirstApprovedAudioAndRecord({
            jid,
            countryCode,
            sessionId,
            peerPhone,
            baseNames: ORDER_CLOSED_BONUS_AUDIO_NAMES,
            label: 'Audio de aviso de bonus no fechamento',
            sendOptions: {
                allowExistingDropiOrder: true,
                outboundContext: 'order_closed_bonus_audio'
            }
        })
        : false;

    return { thankYouAudioSent, bonusNoticeAudioSent };
};

const PRINCIPAL_SDR_STAGES = new Set([
    'sdr_after_initial',
    'sdr_awaiting_name',
    'sdr_awaiting_city',
    'sdr_awaiting_province',
    'sdr_awaiting_city_province',
    'sdr_awaiting_quantity',
    'sdr_awaiting_value_confirmation',
    'sdr_awaiting_delivery_mode',
    'sdr_awaiting_agency_query',
    'sdr_awaiting_agency_selection',
    'sdr_awaiting_home_address',
    'sdr_awaiting_final_confirmation',
    'sdr_scheduled_followup',
    'order_closed'
]);

const isPrincipalSdrStage = (stage = '') => PRINCIPAL_SDR_STAGES.has(String(stage || ''));

const PRINCIPAL_SDR_AUDIO_NAMES = {
    agencyThanks: ['AGRADECIMENTO_AGENCIA_DE_ENTREGA', 'AGRADECIMENTO AGENCIA DE ENTREGA'],
    bonusPickup: ['BONUS_RETIRADA', 'BONUS_RETIRDA'],
    homeThanks: ['CONFIRMACION_Y_REGALITO_ESPECIAL', 'CONFIRMACION Y REGALITO ESPECIAL']
};

const principalSdrClean = (value = '') => cleanFieldValue(value).replace(/^[,.;:-]+|[,.;:-]+$/g, '').trim();
const principalSdrFirstName = (name = '') => principalSdrClean(name).split(/\s+/).filter(Boolean)[0] || 'señor';

const principalSdrRecordBotText = async ({ chatId, peerPhone, body, suffix = 'principal_sdr' }) => {
    try {
        await Message.create({
            _id: `out_${Date.now()}_${suffix}`,
            chatId,
            peerPhone,
            from: 'bot',
            to: chatId,
            body,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }
};

const principalSdrDuplicateWindowSeconds = () => Math.floor(duplicateReplyWindowMs() / 1000);

const principalSdrFindDuplicateBotText = async ({ peerPhone, body }) => {
    const comparable = normalizeReplyText(body);
    if (!comparable) return null;
    const since = Math.floor(Date.now() / 1000) - principalSdrDuplicateWindowSeconds();
    const recent = await Message.find({
        peerPhone,
        from: 'bot',
        isBot: true,
        timestamp: { $gte: since }
    }).sort({ timestamp: -1, createdAt: -1 }).limit(12).lean().catch(() => []);
    return recent.find((message) => normalizeReplyText(message.body || '') === comparable) || null;
};

const principalSdrLastBotTextMatches = async ({ peerPhone, body }) => {
    const comparable = normalizeReplyText(body);
    if (!comparable) return false;
    const lastBot = await Message.findOne({
        peerPhone,
        from: 'bot',
        isBot: true
    }).sort({ timestamp: -1, createdAt: -1 }).lean().catch(() => null);
    return Boolean(lastBot && normalizeReplyText(lastBot.body || '') === comparable);
};

const principalSdrSendTextOnce = async ({ chatId, peerPhone, sessionId, body, suffix = 'principal_sdr' }) => {
    if (await principalSdrLastBotTextMatches({ peerPhone, body })) {
        console.log(`[FUNIL] mensagem repetida em sequencia bloqueada -> ${chatId} | suffix=${suffix}`);
        return { sent: true, duplicate: true };
    }
    const sent = await sendText(chatId, body, null, {
        sessionId,
        outboundContext: suffix
    });
    if (!sent) return { sent: false, duplicate: false };
    await principalSdrRecordBotText({ chatId, peerPhone, body, suffix });
    return { sent: true, duplicate: false };
};

const principalSdrSaveMemory = async ({ contactStateId, agentProfile, order, stage, inboundText = '', outboundText = '' }) => {
    const state = await ContactState.findById(contactStateId).select('metadata phoneDigits').lean().catch(() => null);
    const previousAgentMemory = state?.metadata?.perAgentMemory?.[agentProfile.key] || {};
    const previousOrder = {
        ...(previousAgentMemory.conversationState || {}),
        ...(previousAgentMemory.pendingCheckoutOrder || {})
    };
    const normalized = {
        ...previousOrder,
        ...(order || {}),
        stage,
        funnelStage: stage,
        lastQuestionSent: outboundText || order?.lastQuestionSent || '',
        conversationSummary: order?.conversationSummary || 'Funil principal SDR Vit Power em andamento.'
    };
    const rememberedQuantity = normalizeOptionalPackageQuantity(previousAgentMemory.selectedQuantity || previousOrder.quantity || 0);
    if (!isValidPackageQuantity(normalized.quantity) && rememberedQuantity) {
        normalized.quantity = rememberedQuantity;
    }
    if ((normalized.total === undefined || normalized.total === null || normalized.total === '' || Number(normalized.total) <= 0)
        && previousOrder.total !== undefined
        && previousOrder.total !== null
        && previousOrder.total !== ''
        && Number(previousOrder.total) > 0) {
        normalized.total = previousOrder.total;
    }
    if (isValidPackageQuantity(normalized.quantity)
        && (normalized.total === undefined || normalized.total === null || normalized.total === '' || Number(normalized.total) <= 0)) {
        normalized.total = getSelectedOffer({ countryCode: 'EC' }, { quantity: normalized.quantity }).total;
    }
    if (!normalized.name && previousOrder.name) normalized.name = previousOrder.name;
    if (!normalized.city && previousOrder.city) normalized.city = previousOrder.city;
    if (!normalized.province && previousOrder.province) normalized.province = previousOrder.province;
    if (!normalized.valueConfirmed && previousOrder.valueConfirmed) normalized.valueConfirmed = previousOrder.valueConfirmed;
    if (stage === 'order_closed') {
        await ContactState.updateOne(
            { _id: contactStateId },
            {
                $set: {
                    [`metadata.perAgentMemory.${agentProfile.key}.conversationState`]: {
                        ...normalized,
                        stage: 'order_closed',
                        funnelStage: 'order_closed',
                        followup_status: normalized.followup_status || 'sale_confirmed'
                    },
                    [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'order_closed',
                    [`metadata.perAgentMemory.${agentProfile.key}.lastCheckoutOrderConfirmationAt`]: new Date(),
                    'metadata.lastKnownFunnelStage': 'order_closed',
                    'metadata.orderStatus': 'PEDIDO_CONFIRMADO'
                },
                $unset: {
                    [`metadata.perAgentMemory.${agentProfile.key}.pendingCheckoutOrder`]: ''
                }
            }
        );
        await updateContactStateAgentMemory({
            contactStateId,
            agentProfile,
            inboundText,
            outboundText,
            inferredIntent: 'purchase_intent',
            inferredFunnelStage: 'order_closed',
            inferredObjection: null
        });
        return;
    }
    await savePendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        parsedOrder: normalized,
        stage,
        orderId: null
    });
    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText,
        outboundText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: stage,
        inferredObjection: null
    });
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                'human.mode': 'auto',
                'human.pausedUntil': null,
                'metadata.lastKnownFunnelStage': stage,
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: stage,
                [`metadata.perAgentMemory.${agentProfile.key}.selectedQuantity`]: normalizeOptionalPackageQuantity(normalized.quantity),
                [`metadata.perAgentMemory.${agentProfile.key}.principalSdrStage`]: stage,
                [`metadata.perAgentMemory.${agentProfile.key}.principalSdrUpdatedAt`]: new Date()
            }
        }
    );
};

const principalSdrSendTextAndSave = async ({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage, inboundText, text, suffix = 'principal_sdr' }) => {
    await principalSdrSendStageAudioOnce({ chatId, peerPhone, sessionId, contactStateId, agentProfile, stage });
    const result = await principalSdrSendTextOnce({ chatId, peerPhone, sessionId, body: text, suffix });
    if (!result.sent) return false;
    await principalSdrSaveMemory({ contactStateId, agentProfile, order, stage, inboundText, outboundText: text });
    return true;
};

// Funil Principal e a fonte mestre. Estes estagios tecnicos apenas consultam
// os audios/regras aprovados em vitPowerEvolvedWorkflow.js; nao criar funil paralelo.
const PRINCIPAL_SDR_STAGE_AUDIO_NAMES = {
    sdr_awaiting_name: VIT_POWER_APPROVED_AUDIO_CANDIDATES.missingCustomerData,
    sdr_awaiting_city: VIT_POWER_APPROVED_AUDIO_CANDIDATES.cityProvinceRequest,
    sdr_awaiting_province: VIT_POWER_APPROVED_AUDIO_CANDIDATES.cityProvinceRequest,
    sdr_awaiting_city_province: VIT_POWER_APPROVED_AUDIO_CANDIDATES.cityProvinceRequest,
    sdr_awaiting_delivery_mode: [],
    sdr_awaiting_agency_query: VIT_POWER_APPROVED_AUDIO_CANDIDATES.agencyDetailsRequest,
    sdr_awaiting_home_address: VIT_POWER_APPROVED_AUDIO_CANDIDATES.homeAddressRequest,
    sdr_awaiting_agency_selection: VIT_POWER_APPROVED_AUDIO_CANDIDATES.agencySelection
};

const principalSdrSendStageAudioOnce = async ({ chatId, peerPhone, sessionId, contactStateId, agentProfile, stage }) => {
    const baseNames = PRINCIPAL_SDR_STAGE_AUDIO_NAMES[stage] || [];
    if (!baseNames.length || !contactStateId) return false;
    const state = await ContactState.findById(contactStateId).select('metadata').lean().catch(() => null);
    const audioMemory = state?.metadata?.perAgentMemory?.[agentProfile.key]?.principalSdrStageAudios || {};
    const sentAudios = Array.isArray(audioMemory.sent) ? audioMemory.sent : [];
    const stageAudios = Array.isArray(audioMemory[stage]) ? audioMemory[stage] : [];
    const candidates = baseNames.filter((baseName) => !sentAudios.includes(baseName) && !stageAudios.includes(baseName));
    if (!candidates.length) return false;
    const sent = await sendFirstApprovedAudioAndRecord({
        jid: chatId,
        countryCode: 'EC',
        sessionId,
        peerPhone,
        baseNames: candidates,
        label: `SDR audio etapa ${stage}`,
        sendOptions: { outboundContext: `principal_sdr_${stage}` }
    });
    if (!sent) return false;
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $addToSet: {
                [`metadata.perAgentMemory.${agentProfile.key}.principalSdrStageAudios.sent`]: candidates[0],
                [`metadata.perAgentMemory.${agentProfile.key}.principalSdrStageAudios.${stage}`]: candidates[0]
            },
            $set: {
                [`metadata.perAgentMemory.${agentProfile.key}.principalSdrLastAudioStage`]: stage,
                [`metadata.perAgentMemory.${agentProfile.key}.principalSdrLastAudioAt`]: new Date()
            }
        }
    ).catch(() => null);
    return true;
};

const principalSdrSendStageAudioOnlyAndSave = async ({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage, inboundText, outboundText = '[AUDIO] etapa' }) => {
    await principalSdrSendStageAudioOnce({ chatId, peerPhone, sessionId, contactStateId, agentProfile, stage });
    await principalSdrSaveMemory({ contactStateId, agentProfile, order, stage, inboundText, outboundText });
    console.log(`[FUNIL] etapa com audio-only salva -> ${chatId} | etapa=${stage}`);
    return true;
};
const principalSdrQuantityOfferText = (quantity) => {
    if (String(quantity) === '6') return { label: '6 frascos', total: '$167.99' };
    if (String(quantity) === '3') return { label: '3 frascos', total: '$95.99' };
    if (String(quantity) === '2') return { label: '2 frascos', total: '$70' };
    return { label: '1 frasco', total: '$39' };
};

const principalSdrQuantityText = (quantity) => {
    const offer = principalSdrQuantityOfferText(quantity);
    const variants = [
        `Le envio ${offer.label} por ${offer.total}. ¿Listo?`,
        `Envio ${offer.label} por ${offer.total}. ¿De acuerdo?`,
        `${offer.label} por ${offer.total}. ¿Está correcto?`,
        `Le preparo ${offer.label} por ${offer.total}. ¿Correcto?`
    ];
    return variants[Math.floor(Math.random() * variants.length)];
};

const PRINCIPAL_SDR_VALUE_ACCEPTANCE_TEXTS = new Set([
    'si',
    'sim',
    'sii',
    'claro',
    'correcto',
    'correto',
    'correcta',
    'correta',
    'certo',
    'cierto',
    'listo',
    'ok',
    'okay',
    'esta bien',
    'esta bueno',
    'esta correcto',
    'esta correcta',
    'esta perfecto',
    'todo bien',
    'todo correcto',
    'todo ok',
    'de acuerdo',
    'estoy de acuerdo',
    'si de acuerdo',
    'si correcto',
    'si claro',
    'si listo',
    'si esta bien',
    'ok correcto',
    'ok listo',
    'ok de acuerdo',
    'me parece bien',
    'me sirve',
    'perfecto',
    'vale',
    'bueno',
    'bien',
    'asi es',
    'adelante',
    'proceda',
    'puede proceder',
    'puede enviar',
    'autorizo',
    'acepto',
    'confirmo',
    'confirmado',
    'hagale',
    'dale',
    'mande nomas',
    'envie nomas',
    'mandelo nomas',
    'envielo nomas'
]);

const principalSdrIsValueOfferAcceptance = (text = '') => {
    const body = normalizeForDecision(text);
    if (!body || body.length > 160) return false;
    if (PRINCIPAL_SDR_VALUE_ACCEPTANCE_TEXTS.has(body)) return true;
    if (principalSdrIsConfirmationOnlyText(body)) return true;
    if (isOrderCloseAffirmation(body)) return true;
    return /^(esta bien|ta bien|esta bueno|esta perfecto|esta correcto|esta correcta|eso esta bien|asi esta bien|si esta bien|si esta bueno|ok esta bien|ok esta bueno|ok correcto|ok listo|ok dale|ok de acuerdo|ya esta|ya listo|ya pues|ya bueno|ya correcto|ya quedamos|listo entonces|listo si|si listo|si correcto|si claro|si de acuerdo|de acuerdo entonces|hagale|hágale|haga nomas|dale nomas|mande nomas|mande no mas|mandeme nomas|envie nomas|envie no mas|envielo nomas|envielo no mas|mandelo nomas|mandelo no mas|proceda nomas|proceda no mas|puede enviar nomas|puede enviar no mas|puede mandar nomas|puede mandar no mas|me parece|me parece bien|me sirve|si me sirve|esta bien asi|esta bien para mi|correcto asi|todo bien asi|todo ok asi|bueno listo|bueno esta bien|bueno correcto|bueno mande|bueno envie)$/.test(body)
        || /\b(acepto|aceptado|aprobado|confirmo|confirmado|autorizo|autorizado|proceda|puede enviar|puede mandar|mande nomas|envie nomas|mandelo nomas|envielo nomas|hagale|dale nomas|de una|me sirve|esta bien|todo bien|todo ok|correcto|listo|de acuerdo)\b/.test(body);
};

const principalSdrHandleQuantityChoice = async ({ text, chatId, peerPhone, sessionId, contactStateId, agentProfile, customerContext, order }) => {
    const quantity = detectRequestedQuantity(text);
    if (!quantity) return false;
    const normalizedQuantity = normalizePackageQuantity(quantity);
    const nextOrder = { ...order, quantity: normalizedQuantity };
    const offer = getSelectedOffer(customerContext, nextOrder);
    nextOrder.total = offer.total;
    await sendQuantitySelectionAudio({
        jid: chatId,
        countryCode: customerContext.countryCode,
        quantity: normalizedQuantity,
        sessionId,
        peerPhone
    });
    const replyText = principalSdrQuantityText(normalizedQuantity);
    return principalSdrSendTextAndSave({
        chatId,
        peerPhone,
        sessionId,
        contactStateId,
        agentProfile,
        order: nextOrder,
        stage: 'sdr_awaiting_value_confirmation',
        inboundText: text,
        text: replyText,
        suffix: 'principal_sdr_value'
    });
};
const principalSdrNameRequestText = () => 'Perfecto, señor 😊\n\nPara organizar correctamente su pedido en nuestro sistema:\n\n¿Cuál es su nombre completo?';

const principalSdrNameStageAnswer = (text, order = {}) => {
    const body = normalizeForDecision(text);
    if (!body) return '';
    const explicitPriceQuantity = detectRequestedQuantity(text);
    if (/(precio|valor|cuanto|cu[aá]nto|pagar|total|costo|coste)/i.test(body) && explicitPriceQuantity) {
        const explicitOffer = principalSdrQuantityOfferText(explicitPriceQuantity);
        return `Sí, señor. Son ${explicitOffer.label} por ${explicitOffer.total}.`;
    }
    if (/(precio|valor|cuanto|cu[aá]nto|pagar|total|costo|coste)/i.test(body)) {
        return 'Hoy tenemos 1 frasco por 39 USD, 3 frascos por 95.99 USD y 6 frascos por 167.99 USD.';
    }
    if (/\b(?:que\s+)?se\s+(?:pare|levante|mantenga|sostenga)\b.{0,50}\b(tiempo|mas tiempo|duro|fuerte|firme|ereccion|erecion)\b/i.test(body)
        || /\b(durar|dure|aguantar|aguante|resistir|rendir|rendimiento)\b.{0,50}\b(mas tiempo|tiempo|relaciones|intimidad|cama|sexo|sexual)\b/i.test(body)
        || /\b(ereccion|erecion|parado|palo parado|duro|firme|bien fuerte)\b.{0,50}\b(mas tiempo|tiempo|durar|aguantar|mantener|mantenga|sostener|sostenga)\b/i.test(body)) {
        return 'Si, señor. Le envio la orientacion exacta de firmeza y tiempo para que entienda bien el tratamiento.';
    }
    if (/(demora|tarda|llega|cuando llega|cu[aá]ndo llega|envio|env[ií]o|entrega)/i.test(body)) {
        return 'Claro, señor. Después de sus datos le organizo la entrega por agencia o domicilio.';
    }
    if (/(funciona|sirve|resultado|resultados)/i.test(body)) {
        return 'Sí, señor. Le acompaño paso a paso para dejar su pedido bien organizado.';
    }
    if (/(como se toma|tomar|toma|capsula|c[aá]psula|liquido|l[ií]quido)/i.test(body)) {
        return 'Le explico corto: se usa según la orientación del producto y le ayudamos con la indicación al confirmar.';
    }
    if (/[?¿]/.test(String(text || '')) || /^(que|qu[eé]|como|c[oó]mo|cuando|cu[aá]ndo|donde|d[oó]nde|por que|porque)\b/i.test(body)) {
        return 'Claro, señor. Le ayudo con eso enseguida.';
    }
    return '';
};

const principalSdrLooksLikeQuestionBeforeName = (text, order = {}) => Boolean(principalSdrNameStageAnswer(text, order));

const principalSdrNameRetryText = (text, order = {}) => {
    const answer = principalSdrNameStageAnswer(text, order);
    if (answer) return answer + '\n\n' + principalSdrNameRequestText();
    return principalSdrNameRequestText();
};

const principalSdrLooksLikeAgencyOrLocationAnswer = (text = '') => {
    const body = normalizeForDecision(text);
    if (!body) return false;
    if (hasAgencyIndicationData(text)) return true;
    const location = principalSdrLocationFromText(text);
    if (!(location.city || location.province)) return false;
    return /\b(quiero|deseo|retir|retiro|retirar|agencia|servientrega|ciudad|provincia|en|no|es|ahi|all[ií])\b/i.test(body);
};

const principalSdrNameRetryAfterAgencyText = () => (
    'Perfecto, señor. Ya dejé la agencia ubicada con los datos oficiales de Servientrega.\n\nAhora solo me falta su nombre completo para registrar el pedido.'
);

const principalSdrCityRequestText = (order = {}) => {
    const firstName = order?.name ? `, señor ${principalSdrFirstName(order.name)}` : '';
    return `Gracias${firstName}.\n\n¿En qué ciudad se encuentra?`;
};

const principalSdrProvinceRequestText = (order = {}) => {
    const city = principalSdrClean(order?.city || '');
    return city
        ? `Perfecto, ${city}.\n\n¿Me confirma la provincia por favor?`
        : 'Perfecto.\n\n¿Me confirma la provincia por favor?';
};

const principalSdrCleanLocationAnswer = (text = '') => principalSdrClean(text)
    .replace(/^(mi\s+)?(ciudad|provincia)\s*(es|:)?\s*/i, '')
    .replace(/^(estoy|vivo|me\s+encuentro|estamos)\s+en\s+/i, '')
    .replace(/^es\s+en\s+/i, '')
    .replace(/^(la\s+)?agencia\s+/i, '')
    .replace(/[?¿.]+$/g, '')
    .trim();

const principalSdrLocationFromText = (text = '', order = {}) => {
    if (principalSdrIsConfirmationOnlyText(text)) {
        return { city: '', province: '', cleaned: '' };
    }
    const loc = extractLocationFromText(text);
    const cleaned = principalSdrCleanLocationAnswer(text);
    const known = findKnownServientregaEcuadorLocation({
        city: loc.city || order.city || '',
        province: loc.province || order.province || '',
        text
    });
    return {
        city: loc.city || known.city || '',
        province: loc.province || known.province || '',
        cleaned
    };
};

const principalSdrCityFromText = (text = '') => {
    const loc = principalSdrLocationFromText(text);
    if (loc.city) return loc.city;
    return loc.cleaned || '';
};

const principalSdrProvinceFromText = (text = '', order = {}) => {
    const loc = principalSdrLocationFromText(text, order);
    if (loc.province) return loc.province;
    return loc.cleaned || '';
};

const principalSdrIsConfirmationOnly = principalSdrIsConfirmationOnlyText;

const AGENCY_OPTIONS_PAGE_SIZE = 4;
const AGENCY_OPTIONS_LOOKAHEAD_LIMIT = 60;
const AGENCY_REFINEMENT_THRESHOLD = AGENCY_OPTIONS_PAGE_SIZE;
const AGENCY_SECTOR_ALIASES = [
    ['centro norte', ['centro norte', 'centro norte']],
    ['centro sur', ['centro sur', 'centro sur']],
    ['noreste', ['noreste', 'nor este', 'norte este']],
    ['noroeste', ['noroeste', 'nor oeste', 'norte oeste']],
    ['sureste', ['sureste', 'sur este']],
    ['suroeste', ['suroeste', 'sur oeste']],
    ['centro', ['centro', 'central']],
    ['norte', ['norte']],
    ['sur', ['sur']],
    ['este', ['este', 'oriente']],
    ['oeste', ['oeste', 'occidente']],
    ['terminal', ['terminal']],
    ['mall', ['mall', 'centro comercial']],
    ['mercado', ['mercado']],
    ['aeropuerto', ['aeropuerto']],
    ['alborada', ['alborada']],
    ['sauces', ['sauces']],
    ['fortin', ['fortin']],
    ['recreo', ['recreo']],
    ['transito', ['transito', 'transito']],
    ['comision', ['comision']]
];

const principalSdrAgencySectorFromText = (text = '') => {
    const body = normalizeFieldLabel(text);
    if (!body) return '';
    for (const [sector, aliases] of AGENCY_SECTOR_ALIASES) {
        if (aliases.some((alias) => new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i').test(body))) {
            return sector;
        }
    }
    return '';
};

const principalSdrClientDoesNotKnowAgency = (text = '') => /\b(no se|no sé|no sabe|no conozco|no conozco|no tengo|no recuerdo|no ubico|no se cual|no sé cual|cualquiera|la mas cercana|la más cercana|una cercana|no importa)\b/i.test(normalizeFieldLabel(text));

const principalSdrAgencyRefinementQuestionText = () => (
    '¿Conoce el nombre, dirección o sector de la agencia? Puede decir Centro, Norte, Sur, Este u Oeste. Si no sabe, le envío las opciones disponibles.'
);

const principalSdrAgencyRefinementQueryFromText = (text = '', order = {}) => {
    if (principalSdrIsConfirmationOnly(text) || principalSdrWantsMoreAgencyOptions(text) || principalSdrClientDoesNotKnowAgency(text)) return '';
    const sector = principalSdrAgencySectorFromText(text);
    if (sector) return sector;
    const body = normalizeFieldLabel(text);
    if (!body) return '';
    const location = principalSdrLocationFromText(text, order);
    const locationWords = new Set(normalizeFieldLabel([
        order.city,
        order.province,
        location.city,
        location.province
    ].filter(Boolean).join(' ')).split(/\s+/).filter(Boolean));
    const noise = new Set([
        ...AGENCY_SELECTION_NOISE_WORDS,
        'ciudad',
        'provincia',
        'canton',
        'sector',
        'zona',
        'localizacion',
        'ubicacion',
        'sucursal',
        'oficina',
        'servientrega',
        'agencia',
        'quiero',
        'deseo',
        'retirar',
        'retiro',
        'enviar',
        'envie',
        'mandar',
        'mande',
        'por'
    ]);
    const remainingTokens = body.split(/\s+/).filter((token) => (
        token.length >= 3
        && !noise.has(token)
        && !locationWords.has(token)
    ));
    return remainingTokens.length ? text : '';
};

const principalSdrAgencyOptionsQuery = (order = {}, text = '') => {
    if (principalSdrClientDoesNotKnowAgency(text)) return '';
    return principalSdrAgencyRefinementQueryFromText(text, order) || order.agencyOptionsQuery || '';
};

const principalSdrFilterAgencyOptionsBySector = (options = [], query = '') => {
    const sector = principalSdrAgencySectorFromText(query);
    if (!sector) return options;
    const normalizedSector = normalizeFieldLabel(sector);
    const filtered = options.filter((agency) => normalizeFieldLabel(agency.sector || '').includes(normalizedSector));
    return filtered.length ? filtered : options;
};

const principalSdrAgencyOptionsForOrder = (order = {}, text = '', limit = AGENCY_OPTIONS_PAGE_SIZE, offset = 0) => {
    const safeText = principalSdrIsConfirmationOnly(text) ? '' : text;
    const details = safeText ? parseAgencyDetailsMessage(safeText) : {};
    const location = safeText
        ? principalSdrLocationFromText(safeText, order)
        : { city: order.city || '', province: order.province || '' };
    const city = details.city || location.city || order.city || '';
    const province = details.province || location.province || order.province || '';
    const query = principalSdrAgencyOptionsQuery({ ...order, city, province }, safeText);
    const lookupLimit = Math.max(limit + offset, limit, AGENCY_OPTIONS_LOOKAHEAD_LIMIT);
    const useParsedAgencyOptions = Boolean(details.agencyOptions?.length && !city && !province);
    const options = (useParsedAgencyOptions ? details.agencyOptions : findServientregaEcuadorAgencies({
        city,
        province,
        query: query || [city, province].filter(Boolean).join(' '),
        limit: lookupLimit
    }));
    return principalSdrFilterAgencyOptionsBySector(options, query).slice(offset, offset + limit);
};

const principalSdrAgencyOptionFromOrder = (order = {}) => ({
    name: order.agencyName || order.agency || '',
    province: order.province || '',
    city: order.city || '',
    sector: order.agencySector || order.reference || '',
    address: order.agencyAddress || order.address || '',
    weekdayHours: order.agencyWeekdayHours || '',
    weekendHours: order.agencyWeekendHours || ''
});

const principalSdrAgencyOptionsPageForOrder = (order = {}, text = '', page = 0) => {
    const safePage = Math.max(0, Number.parseInt(String(page || 0), 10) || 0);
    const offset = safePage * AGENCY_OPTIONS_PAGE_SIZE;
    const options = principalSdrAgencyOptionsForOrder(order, text, AGENCY_OPTIONS_PAGE_SIZE, offset);
    const nextOptions = principalSdrAgencyOptionsForOrder(order, text, AGENCY_OPTIONS_PAGE_SIZE, offset + AGENCY_OPTIONS_PAGE_SIZE);
    return {
        page: safePage,
        options,
        hasMore: nextOptions.length > 0
    };
};

const principalSdrWantsMoreAgencyOptions = (text = '') => /\b(otra|otras|otro|otros|mas|m[aá]s|siguiente|siguientes|ninguna|ninguno|no me sirve|no sirve)\b/i.test(normalizeForDecision(text));

const principalSdrOrderHasCityProvince = (order = {}) => Boolean(principalSdrClean(order.city) && principalSdrClean(order.province));

const principalSdrApplyOfficialAgency = (order = {}, agency = {}) => ({
    ...order,
    province: agency.province || order.province || '',
    city: agency.city || order.city || '',
    address: agency.address || order.address || '',
    reference: agency.sector || '',
    agencyName: agency.name || order.agencyName || '',
    agencyAddress: agency.address || order.agencyAddress || '',
    agencySector: agency.sector || '',
    agencyWeekdayHours: agency.weekdayHours || '',
    agencyWeekendHours: agency.weekendHours || '',
    agencyValidated: Boolean(agency.name || order.agencyValidated),
    agency: agency.name || order.agency || '',
    deliveryType: 'SERVIENTREGA',
    deliveryMode: 'agency',
    logisticsSource: 'official_servientrega_agency'
});

const principalSdrMergeLocationAndAgencyDetails = (order = {}, text = '') => {
    const details = hasAgencyIndicationData(text) ? parseAgencyDetailsMessage(text) : {};
    const location = principalSdrLocationFromText(text, order);
    return {
        ...order,
        ...details,
        city: details.city || location.city || order.city || '',
        province: details.province || location.province || order.province || ''
    };
};

const principalSdrIsAgencyLocationCorrection = (text = '', order = {}) => {
    if (principalSdrIsConfirmationOnly(text) || principalSdrWantsMoreAgencyOptions(text)) return false;
    if (hasAgencyIndicationData(text)) return true;
    const location = principalSdrLocationFromText(text, order);
    const city = principalSdrClean(location.city || '');
    const province = principalSdrClean(location.province || '');
    if (!city && !province) return false;
    const currentCity = principalSdrClean(order.city || '');
    const currentProvince = principalSdrClean(order.province || '');
    return Boolean(
        (city && city.toLowerCase() !== currentCity.toLowerCase())
        || (province && province.toLowerCase() !== currentProvince.toLowerCase())
    );
};

const principalSdrClearSelectedAgency = (order = {}) => ({
    ...order,
    agencyName: '',
    agencyAddress: '',
    agencySector: '',
    agencyWeekdayHours: '',
    agencyWeekendHours: '',
    agencyValidated: false,
    agency: '',
    agencyOptions: [],
    agencyOptionsQuery: '',
    agencyRefinementRequested: false
});

const principalSdrShouldAskAgencyRefinement = ({ page = {}, order = {}, text = '' } = {}) => (
    Boolean(
        page.hasMore
        && (page.options || []).length >= AGENCY_REFINEMENT_THRESHOLD
        && principalSdrOrderHasCityProvince(order)
        && !principalSdrAgencyOptionsQuery(order, text)
        && !principalSdrClientDoesNotKnowAgency(text)
    )
);

const principalSdrAgencyListText = (options = [], { hasMore = false, page = 0 } = {}) => {
    const visibleOptions = Array.isArray(options) ? options.slice(0, AGENCY_OPTIONS_PAGE_SIZE) : [];
    const startNumber = (Math.max(0, Number.parseInt(String(page || 0), 10) || 0) * AGENCY_OPTIONS_PAGE_SIZE) + 1;
    if (options.length === 1) {
        const agency = options[0];
        return [
            `Señor, puedo enviar su pedido para retirar en Agencia Servientrega ${agency.name ? principalSdrClean(agency.name) : 'seleccionada'} - ${agency.address ? principalSdrClean(agency.address) : 'direccion registrada'} (${agency.city ? principalSdrClean(agency.city) : 'ciudad registrada'}, ${agency.province ? principalSdrClean(agency.province) : 'provincia registrada'}). ¿Está correcto?`
        ].filter((line) => line !== null && line !== undefined).join('\n');
    }
    const optionBlocks = visibleOptions.map((agency, index) => {
        const label = String(startNumber + index);
        return [
            `${label}) SERVIENTREGA${agency.name ? `, ${principalSdrClean(agency.name)}` : ''}`,
            agency.address ? principalSdrClean(agency.address) : '',
            [agency.city, agency.province].filter(Boolean).length
                ? `Ciudad: ${[agency.city, agency.province].filter(Boolean).map(principalSdrClean).join(', ')}`
                : '',
            agency.sector ? `Sector: ${principalSdrClean(agency.sector)}` : ''
        ].filter(Boolean).join('\n');
    });
    const availableNumbersText = visibleOptions
        .map((_, index) => String(startNumber + index))
        .join(', ');
    const footer = hasMore
        ? [`Responda con el número de la agencia: ${availableNumbersText}.`, 'Si ninguna sirve, responda OTRAS y le envio mas opciones.'].join('\n')
        : `Responda con el número de la agencia: ${availableNumbersText}.`;
    const lines = [
        page > 0 ? 'Más agencias disponibles:' : 'Señor, por favor, escoja una agencia abajo:',
        '',
        optionBlocks.join('\n\n'),
        '',
        footer
    ];
    return lines.join('\n');
};

const principalSdrFinalSummaryText = ({ order, deliveryType }) => {
    const lines = [
        'Señor, por favor confirme si todo está correcto 😊',
        '',
        `Nombre: ${order.name || ''}`,
        `Ciudad: ${order.city || ''}`,
        `Provincia: ${order.province || ''}`,
        `Cantidad: ${order.quantity || ''}`
    ];
    if (deliveryType === 'agency') {
        lines.push('', `SERVIENTREGA: ${order.agencyName || order.agency || ''}`);
        if (order.agencyAddress) lines.push(order.agencyAddress);
    } else {
        lines.push('', `DOMICILIO: ${order.address || ''}`);
        lines.push(`Referencia: ${order.reference || ''}`);
    }
    lines.push('', '¿Autoriza el despacho de su pedido?');
    return lines.join('\n');
};

const principalSdrOrderClosedFinalText = ({ finalOrder = {}, deliveryType, agency = null }) => {
    if (deliveryType === 'agency') {
        const agencyName = principalSdrClean(
            agency?.name
            || finalOrder.agencyName
            || finalOrder.agency
            || 'la agencia seleccionada'
        );
        const agencyAddress = principalSdrClean(
            agency?.address
            || finalOrder.agencyAddress
            || finalOrder.address
            || ''
        );
        const agencyLabel = /servientrega/i.test(agencyName)
            ? agencyName
            : `Agencia Servientrega ${agencyName}`;
        const agencyLine = agencyAddress ? `${agencyLabel} - ${agencyAddress}` : agencyLabel;

        return [
            'Gracias, señor.',
            'Su pedido quedó confirmado para envío a la agencia Servientrega:',
            agencyLine,
            '',
            'Su compra ya quedó cerrada. Desde ahora le acompaño por aquí solo con la guía, la entrega y la retirada.'
        ].join('\n');
    }

    const address = principalSdrClean(finalOrder.address || 'su dirección registrada');
    return [
        'Gracias, señor.',
        'Su pedido quedó confirmado para entrega a domicilio en:',
        address,
        '',
        'Su compra ya quedó cerrada. Desde ahora le acompaño por aquí solo con la guía, la entrega y cualquier novedad del pedido.'
    ].join('\n');
};

const principalSdrLooksLikeBuyLater = (text = '') => /\b(despues|después|luego|manana|mañana|otro dia|otro día|proxima semana|próxima semana|mas tarde|más tarde|quincena|fin de mes)\b/i.test(normalizeForDecision(text));
const principalSdrNeedsHuman = (text = '') => /\b(reclamo|denuncia|abogado|demanda|policia|policía|cancelar pedido ya enviado|devolucion|devolución|estafa|bloquea|bloquear|no molestar)\b/i.test(normalizeForDecision(text));
const principalSdrLooksLikeLocationCorrection = (text = '') => {
    const body = normalizeForDecision(text);
    if (!body || !/^(no|nop|negativo)\b/.test(body)) return false;
    if (/\b(nombre|nomre|nombres|cliente)\b/.test(body)) return false;
    if (hasAgencyIndicationData(text)) return true;
    const location = principalSdrLocationFromText(text);
    return Boolean(location.city || location.province);
};

const principalSdrHandleLogisticsFromScheduledFollowup = async ({
    text,
    chatId,
    peerPhone,
    sessionId,
    contactStateId,
    agentProfile,
    order
}) => {
    if (!hasAgencyIndicationData(text) && !principalSdrLooksLikeAgencyOrLocationAnswer(text)) return false;

    let nextOrder = principalSdrMergeLocationAndAgencyDetails({
        ...(order || {}),
        deliveryType: 'SERVIENTREGA',
        deliveryMode: 'agency'
    }, text);

    if (!principalSdrOrderHasCityProvince(nextOrder)) {
        const replyText = agencyCityProvinceRequestText();
        return principalSdrSendTextAndSave({
            chatId,
            peerPhone,
            sessionId,
            contactStateId,
            agentProfile,
            order: nextOrder,
            stage: 'sdr_awaiting_agency_query',
            inboundText: text,
            text: replyText,
            suffix: 'principal_sdr_scheduled_to_agency_city_province'
        });
    }

    if (nextOrder.agencyValidated && (nextOrder.agencyName || nextOrder.agency)) {
        const selectedAgency = principalSdrAgencyOptionFromOrder(nextOrder);
        nextOrder = {
            ...nextOrder,
            agencyOptions: [selectedAgency],
            agencyOptionsPage: 0
        };
        const replyText = principalSdrAgencyListText([selectedAgency], { page: 0 });
        return principalSdrSendTextAndSave({
            chatId,
            peerPhone,
            sessionId,
            contactStateId,
            agentProfile,
            order: nextOrder,
            stage: 'sdr_awaiting_agency_selection',
            inboundText: text,
            text: replyText,
            suffix: 'principal_sdr_scheduled_to_specific_agency'
        });
    }

    const agencyOptionsQuery = principalSdrAgencyOptionsQuery(nextOrder, text);
    const page = principalSdrAgencyOptionsPageForOrder(nextOrder, agencyOptionsQuery || text, 0);
    nextOrder = { ...nextOrder, agencyOptions: page.options, agencyOptionsPage: page.page, agencyOptionsQuery };
    if (!page.options.length) {
        const replyText = agencyCityProvinceRequestText();
        return principalSdrSendTextAndSave({
            chatId,
            peerPhone,
            sessionId,
            contactStateId,
            agentProfile,
            order: nextOrder,
            stage: 'sdr_awaiting_agency_query',
            inboundText: text,
            text: replyText,
            suffix: 'principal_sdr_scheduled_to_agency_retry'
        });
    }
    if (principalSdrShouldAskAgencyRefinement({ page, order: nextOrder, text })) {
        const replyText = principalSdrAgencyRefinementQuestionText();
        nextOrder = { ...nextOrder, agencyRefinementRequested: true, agencyOptions: [], agencyOptionsPage: 0 };
        return principalSdrSendTextAndSave({
            chatId,
            peerPhone,
            sessionId,
            contactStateId,
            agentProfile,
            order: nextOrder,
            stage: 'sdr_awaiting_agency_query',
            inboundText: text,
            text: replyText,
            suffix: 'principal_sdr_scheduled_to_agency_refinement'
        });
    }
    const listText = principalSdrAgencyListText(page.options, { hasMore: page.hasMore, page: page.page });
    return principalSdrSendTextAndSave({
        chatId,
        peerPhone,
        sessionId,
        contactStateId,
        agentProfile,
        order: nextOrder,
        stage: 'sdr_awaiting_agency_selection',
        inboundText: text,
        text: listText,
        suffix: 'principal_sdr_scheduled_to_agency_list'
    });
};

const principalSdrMergeIncoming = (order = {}, text = '') => {
    const safeText = principalSdrIsConfirmationOnly(text) || isOrderCloseAffirmation(text) ? '' : text;
    const parsed = safeText ? (parseCheckoutOrderMessage(safeText, { loose: true }) || {}) : {};
    const agencyRead = safeText && hasAgencyIndicationData(safeText)
        ? principalSdrMergeLocationAndAgencyDetails(order, safeText)
        : {};
    if (parsed.name && principalSdrLooksLikeLocationCorrection(safeText)) {
        delete parsed.name;
    }
    const corrected = parseCheckoutCorrectionMessage(text) || {};
    const merged = coerceCheckoutLocationFields({ ...(order || {}), ...parsed, ...agencyRead, ...corrected });
    if (!isValidPackageQuantity(merged.quantity) && isValidPackageQuantity(order?.quantity)) {
        merged.quantity = Number.parseInt(String(order.quantity), 10);
    }
    if ((merged.total === undefined || merged.total === null || merged.total === '' || Number(merged.total) <= 0)
        && order?.total !== undefined
        && order?.total !== null
        && order?.total !== ''
        && Number(order.total) > 0) {
        merged.total = order.total;
    }
    if (!merged.valueConfirmed && order?.valueConfirmed) merged.valueConfirmed = order.valueConfirmed;
    return merged;
};

const principalSdrConfirmOrder = async ({ chatId, peerPhone, sessionId, contactStateId, agentProfile, customerContext, order, deliveryType, inboundText }) => {
    const offer = getSelectedOffer(customerContext, order);
    const deliveryLabel = deliveryType === 'agency' ? 'SERVIENTREGA' : 'DOMICILIO';
    const finalOrder = {
        ...order,
        quantity: offer.quantity,
        total: offer.total,
        status: 'confirmed',
        stage: 'order_closed',
        funnelStage: 'order_closed',
        followup_status: 'sale_confirmed',
        deliveryType,
        deliveryMode: deliveryType
    };

    let savedOrder = null;
    if (deliveryType === 'agency') {
        savedOrder = await updateOrderAfterAgencyStep({
            parsedOrder: finalOrder,
            customerContext,
            peerPhone,
            stage: 'order_closed',
            status: 'confirmed'
        });
    } else {
        savedOrder = await upsertCheckoutOrderDraft({ parsedOrder: finalOrder, customerContext, peerPhone });
        if (savedOrder) {
            savedOrder.package = {
                id: offer.quantity,
                label: orderPackageLabel({ customerContext, quantity: offer.quantity }),
                quantity: offer.quantity
            };
            savedOrder.total = offer.total;
            savedOrder.status = 'confirmed';
            savedOrder.notes = [`Domicilio: ${finalOrder.address || ''}`, `Referencia: ${finalOrder.reference || ''}`].join('\n');
            savedOrder.conversationMemory = {
                ...(savedOrder.conversationMemory || {}),
                funnelStage: 'order_closed',
                currentIntent: 'purchase_intent',
                selectedQuantity: offer.quantity,
                selectedValue: offer.value,
                deliveryType: 'DOMICILIO',
                orderClosedDeliveryMode: 'home',
                lastBotMessageAt: new Date()
            };
            savedOrder.confirmedSalePayload = buildConfirmedSalePayload({
                order: savedOrder,
                parsedOrder: finalOrder,
                deliveryMode: 'home'
            });
            await savedOrder.save();
            await markMetaPurchaseForConfirmedOrder(savedOrder);
        }
    }

    const payload = (savedOrder?.confirmedSalePayload || buildConfirmedSalePayload({
        order: savedOrder,
        parsedOrder: finalOrder,
        deliveryMode: deliveryType === 'agency' ? 'agency' : 'home',
        agency: deliveryType === 'agency' ? getAgencyDetails(finalOrder) : null
    }));

    await saveConfirmedSalePayloadToContact({ contactStateId, agentProfile, payload });
    const agency = deliveryType === 'agency' ? getAgencyDetails(finalOrder) : null;
    const adminSyncResult = syncContactDraftToOnlineAdminPanel({
        ...finalOrder,
        phone: finalOrder.phone || peerPhone,
        country: customerContext.countryCode || finalOrder.country || 'EC',
        status: 'confirmed',
        address: deliveryType === 'agency' ? (agency?.address || finalOrder.address || '') : (finalOrder.address || ''),
        reference: finalOrder.reference || agency?.sector || ''
    }, {
        country: customerContext.countryCode || finalOrder.country || 'EC',
        adminStatus: 'confirmado',
        action: 'principal_sdr_order_confirmed',
        note: deliveryType === 'agency'
            ? `Pedido confirmado pelo WhatsApp. Entrega por agencia Servientrega: ${agency?.name || 'agencia selecionada'}.`
            : 'Pedido confirmado pelo WhatsApp. Entrega a domicilio.'
    });
    if (!adminSyncResult?.ok && !adminSyncResult?.skipped) {
        console.warn('[FUNIL] falha ao marcar pedido confirmado no Painel Unificado:', adminSyncResult);
    }

    let closedAudioSent = false;
    let bonusPickupSent = false;
    if (deliveryType === 'agency') {
        closedAudioSent = await sendFirstApprovedAudioAndRecord({ jid: chatId, countryCode: customerContext.countryCode, sessionId, peerPhone, baseNames: PRINCIPAL_SDR_AUDIO_NAMES.agencyThanks, label: 'SDR agradecimento agencia', sendOptions: { allowExistingDropiOrder: true, outboundContext: 'principal_sdr_agency_thanks' } });
        bonusPickupSent = await sendFirstApprovedAudioAndRecord({ jid: chatId, countryCode: customerContext.countryCode, sessionId, peerPhone, baseNames: PRINCIPAL_SDR_AUDIO_NAMES.bonusPickup, label: 'SDR bonus retirada', sendOptions: { allowExistingDropiOrder: true, outboundContext: 'principal_sdr_bonus_retirada' } });
    } else {
        closedAudioSent = await sendFirstApprovedAudioAndRecord({ jid: chatId, countryCode: customerContext.countryCode, sessionId, peerPhone, baseNames: PRINCIPAL_SDR_AUDIO_NAMES.homeThanks, label: 'SDR agradecimento domicilio', sendOptions: { allowExistingDropiOrder: true, outboundContext: 'principal_sdr_home_thanks' } });
    }

    const replyText = principalSdrOrderClosedFinalText({ finalOrder, deliveryType, agency });
    const finalTextResult = await principalSdrSendTextOnce({ chatId, peerPhone, sessionId, body: replyText, suffix: 'principal_sdr_confirmed' });
    if (!finalTextResult.sent) return false;
    await principalSdrSaveMemory({ contactStateId, agentProfile, order: finalOrder, stage: 'order_closed', inboundText, outboundText: replyText });
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                'metadata.orderStatus': 'PEDIDO_CONFIRMADO',
                'metadata.tipoEnvio': deliveryLabel,
                'metadata.lastKnownFunnelStage': 'order_closed',
                [`metadata.perAgentMemory.${agentProfile.key}.principalSdrStatus`]: 'PEDIDO_CONFIRMADO',
                [`metadata.perAgentMemory.${agentProfile.key}.tipoEnvio`]: deliveryLabel,
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'order_closed',
                [`metadata.perAgentMemory.${agentProfile.key}.principalSdrStage`]: 'order_closed',
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedThankYouSentAt`]: new Date(),
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedDeliveryMode`]: deliveryType,
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedAudioSent`]: closedAudioSent,
                [`metadata.perAgentMemory.${agentProfile.key}.orderClosedBonusNoticeAudioSent`]: bonusPickupSent,
                [`metadata.perAgentMemory.${agentProfile.key}.adminPanelConfirmSync`]: adminSyncResult
            }
        }
    );
    await holdForHuman({
        contactStateId,
        agentProfile,
        reason: 'order_closed_human_handoff',
        note: 'Pedido confirmado no funil principal SDR. Automacao pausada para evitar reinicio do funil.'
    });
    return true;
};

const principalSdrHandle = async ({ text, chatId, peerPhone, sessionId, contactStateId, agentProfile, customerContext, pendingCheckoutOrder = {}, pendingCheckoutStage = '', selectedQuantityInMemory = 0 }) => {
    const currentStage = isPrincipalSdrStage(pendingCheckoutStage) ? pendingCheckoutStage : 'sdr_after_initial';
    if (currentStage === 'order_closed') {
        await holdForHuman({
            contactStateId,
            agentProfile,
            reason: 'order_closed_human_handoff',
            note: 'Pedido ja fechado no funil principal SDR. Automacao mantida pausada para nao reiniciar venda.'
        });
        console.log(`[FUNIL] Mensagem recebida apos pedido fechado; funil principal mantido pausado -> ${chatId}`);
        return true;
    }
    let order = principalSdrMergeIncoming(pendingCheckoutOrder || {}, text);
    const rememberedQuantity = normalizeOptionalPackageQuantity(
        selectedQuantityInMemory
        || pendingCheckoutOrder?.selectedQuantity
        || pendingCheckoutOrder?.quantity
        || 0
    );
    if (!isValidPackageQuantity(order.quantity) && rememberedQuantity) {
        order.quantity = rememberedQuantity;
    }
    if (isValidPackageQuantity(order.quantity) && (!order.total || Number(order.total) <= 0)) {
        order.total = getSelectedOffer(customerContext, { quantity: order.quantity }).total;
    }

    if (principalSdrNeedsHuman(text)) {
        await holdForHuman({ contactStateId, agentProfile, reason: 'principal_sdr_complex_case', note: 'Caso complexo no funil principal SDR. Humano deve continuar.' });
        return true;
    }

    const hasLogisticsPriority = hasAgencyIndicationData(text) || principalSdrLooksLikeAgencyOrLocationAnswer(text);

    if (currentStage === 'sdr_scheduled_followup' && hasLogisticsPriority) {
        const handled = await principalSdrHandleLogisticsFromScheduledFollowup({
            text,
            chatId,
            peerPhone,
            sessionId,
            contactStateId,
            agentProfile,
            order
        });
        if (handled) return true;
    }

    if (principalSdrLooksLikeBuyLater(text) && !hasLogisticsPriority) {
        const replyText = 'Claro, señor 😊\n¿Qué día desea que le escribamos nuevamente?';
        order = { ...order, stage: 'sdr_scheduled_followup', followup_status: 'COMPRA_AGENDADA', scheduled_reason: 'cliente_pidio_comprar_depois' };
        return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_scheduled_followup', inboundText: text, text: replyText, suffix: 'principal_sdr_scheduled' });
    }

    if (currentStage === 'sdr_scheduled_followup') {
        const replyText = 'Perfecto, señor. Queda agendado para escribirle nuevamente ese día 😊';
        order = { ...order, scheduled_date: principalSdrClean(text), followup_status: 'COMPRA_AGENDADA' };
        return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_scheduled_followup', inboundText: text, text: replyText, suffix: 'principal_sdr_scheduled_date' });
    }

    if (currentStage === 'sdr_after_initial') {
        const quantityHandled = await principalSdrHandleQuantityChoice({
            text,
            chatId,
            peerPhone,
            sessionId,
            contactStateId,
            agentProfile,
            customerContext,
            order
        });
        if (quantityHandled) return true;
        const replyText = principalSdrNameRequestText();
        return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_name', inboundText: text, text: replyText, suffix: 'principal_sdr_name' });
    }

    if (currentStage === 'sdr_awaiting_name') {
        const quantityHandled = await principalSdrHandleQuantityChoice({
            text,
            chatId,
            peerPhone,
            sessionId,
            contactStateId,
            agentProfile,
            customerContext,
            order
        });
        if (quantityHandled) return true;
        if (!order.name && order.agencyValidated && principalSdrLooksLikeAgencyOrLocationAnswer(text)) {
            const retryText = principalSdrNameRetryAfterAgencyText();
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_name', inboundText: text, text: retryText, suffix: 'principal_sdr_name_after_agency_location_retry' });
        }
        if (!order.name && principalSdrLooksLikeQuestionBeforeName(text, order)) {
            const retryText = principalSdrNameRetryText(text, order);
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_name', inboundText: text, text: retryText, suffix: 'principal_sdr_name_question_retry' });
        }
        if (!looksLikeCustomerFullName(text) && !order.name) {
            const retryText = principalSdrNameRetryText(text, order);
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_name', inboundText: text, text: retryText, suffix: 'principal_sdr_name_retry' });
        }
        order.name = order.name || principalSdrClean(text);
        if (order.valueConfirmed && order.agencyValidated && order.agencyName && principalSdrOrderHasCityProvince(order)) {
            const replyText = principalSdrFinalSummaryText({ order, deliveryType: 'agency' });
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_final_confirmation', inboundText: text, text: replyText, suffix: 'principal_sdr_summary_agency_after_name' });
        }
        const replyText = principalSdrCityRequestText(order);
        return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_city', inboundText: text, text: replyText, suffix: 'principal_sdr_city' });
    }

    if (currentStage === 'sdr_awaiting_city') {
        const location = principalSdrLocationFromText(text, order);
        order.city = order.city || location.city;
        order.province = order.province || location.province;
        if (!order.city) {
            const retryText = 'Gracias. Para evitar error de envío, envíeme solo la ciudad por favor.';
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_city', inboundText: text, text: retryText, suffix: 'principal_sdr_city_retry' });
        }
        const replyText = order.province ? agencyFirstDeliveryQuestionText() : principalSdrProvinceRequestText(order);
        const nextStage = order.province ? 'sdr_awaiting_delivery_mode' : 'sdr_awaiting_province';
        return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: nextStage, inboundText: text, text: replyText, suffix: order.province ? 'principal_sdr_delivery_after_city_known' : 'principal_sdr_province' });
    }

    if (currentStage === 'sdr_awaiting_province' || currentStage === 'sdr_awaiting_city_province') {
        if (currentStage === 'sdr_awaiting_city_province') {
            const loc = extractLocationFromText(text);
            order.city = order.city || loc.city || principalSdrCityFromText(text);
            order.province = order.province || loc.province || principalSdrProvinceFromText(text, order);
        } else {
            const location = principalSdrLocationFromText(text, order);
            order.city = order.city || location.city;
            order.province = order.province || location.province;
        }
        if (!order.city) {
            const retryText = principalSdrCityRequestText(order);
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_city', inboundText: text, text: retryText, suffix: 'principal_sdr_city_retry' });
        }
        if (!order.province) {
            const retryText = principalSdrProvinceRequestText(order);
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_province', inboundText: text, text: retryText, suffix: 'principal_sdr_province_retry' });
        }
        if (isValidPackageQuantity(order.quantity) && (order.valueConfirmed || Number(order.total) > 0)) {
            const offer = getSelectedOffer(customerContext, order);
            order.quantity = offer.quantity;
            order.total = order.total || offer.total;
            order.valueConfirmed = true;
            const replyText = agencyFirstDeliveryQuestionText();
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_delivery_mode', inboundText: text, text: replyText, suffix: 'principal_sdr_delivery_after_city' });
        }
        const replyText = 'Perfecto 👍\n\n¿Cuántos frascos desea reservar hoy?\n\n1 frasco\n3 frascos\n6 frascos';
        return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_quantity', inboundText: text, text: replyText, suffix: 'principal_sdr_quantity' });
    }

    if (currentStage === 'sdr_awaiting_quantity') {
        if (isValidPackageQuantity(order.quantity)) {
            const offer = getSelectedOffer(customerContext, { quantity: order.quantity });
            order.quantity = offer.quantity;
            order.total = order.total || offer.total;
            order.valueConfirmed = true;
            if (!order.name) {
                const replyText = principalSdrNameRequestText();
                return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_name', inboundText: text, text: replyText, suffix: 'principal_sdr_name_from_quantity_memory' });
            }
            if (!order.city || !order.province) {
                const replyText = principalSdrCityRequestText(order);
                return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_city', inboundText: text, text: replyText, suffix: 'principal_sdr_city_from_quantity_memory' });
            }
            const replyText = agencyFirstDeliveryQuestionText();
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_delivery_mode', inboundText: text, text: replyText, suffix: 'principal_sdr_delivery_from_quantity_memory' });
        }

        const quantityHandled = await principalSdrHandleQuantityChoice({
            text,
            chatId,
            peerPhone,
            sessionId,
            contactStateId,
            agentProfile,
            customerContext,
            order
        });
        if (quantityHandled) return true;
        const retryText = 'Perfecto. Indíqueme por favor si desea reservar 1, 3 o 6 frascos.';
        return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_quantity', inboundText: text, text: retryText, suffix: 'principal_sdr_quantity_retry' });
    }

    if (currentStage === 'sdr_awaiting_value_confirmation') {
        if (!principalSdrIsValueOfferAcceptance(text)) {
            if (isGenericPriceQuestionWithoutQuantity(text)) {
                await sendFirstApprovedAudio({
                    jid: chatId,
                    countryCode: customerContext.countryCode,
                    sessionId,
                    baseNames: ['TRATAMENTO_Y_PRECIOS_PROMOCAO'],
                    label: 'principal_sdr_price_promotion',
                    sendOptions: { peerPhone }
                });
                const replyText = officialPricePromotionText();
                return principalSdrSendTextAndSave({
                    chatId,
                    peerPhone,
                    sessionId,
                    contactStateId,
                    agentProfile,
                    order: { ...order, quantity: '', selectedQuantity: '', total: 0, valueConfirmed: false },
                    stage: 'sdr_awaiting_quantity',
                    inboundText: text,
                    text: replyText,
                    suffix: 'principal_sdr_price_promotion_no_quantity'
                });
            }
            if (hasAgencyIndicationData(text) && (order.city || order.province || order.agencyOptions?.length || order.agencyName)) {
                const offer = principalSdrQuantityOfferText(order.quantity || 0);
                const locationLine = [order.city, order.province].filter(Boolean).join(', ');
                const replyText = [
                    locationLine
                        ? `Perfecto, señor. Ya tengo su ciudad/provincia: ${locationLine}.`
                        : 'Perfecto, señor. Ya leí los datos de la agencia/ubicación que me envió.',
                    order.quantity
                        ? `${offer.label} por ${offer.total}. ¿Está correcto?`
                        : '¿Está bien para usted reservar esa promoción hoy?'
                ].filter(Boolean).join('\n\n');
                return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_value_confirmation', inboundText: text, text: replyText, suffix: 'principal_sdr_value_location_read' });
            }
            const answer = principalSdrNameStageAnswer(text, order);
            if (answer) {
                const offer = principalSdrQuantityOfferText(order.quantity || 0);
                const retake = order.quantity
                    ? `${offer.label} por ${offer.total}. ¿Está correcto?`
                    : '¿Está bien para usted reservar esa promoción hoy?';
                const replyText = [answer, retake].filter(Boolean).join('\n\n');
                return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_value_confirmation', inboundText: text, text: replyText, suffix: 'principal_sdr_value_question_answered' });
            }
            const bridge = checkoutBridgeLine();
            const replyText = bridge + '\n¿Está bien para usted reservar esa promoción hoy?';
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_value_confirmation', inboundText: text, text: replyText, suffix: 'principal_sdr_value_retry' });
        }
        order.valueConfirmed = true;
        const replyText = agencyFirstDeliveryQuestionText();
        return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_delivery_mode', inboundText: text, text: replyText, suffix: 'principal_sdr_delivery' });
    }

    if (currentStage === 'sdr_awaiting_delivery_mode') {
        const agencyIndication = hasAgencyIndicationData(text);
        if (!isHomeDeliveryChoice(text) && (isAgencyDeliveryConsent(text) || agencyIndication)) {
            order.deliveryType = 'SERVIENTREGA';
            if (agencyIndication) {
                order = principalSdrMergeLocationAndAgencyDetails(order, text);
            }
            if (!principalSdrOrderHasCityProvince(order)) {
                return principalSdrSendStageAudioOnlyAndSave({
                    chatId,
                    peerPhone,
                    sessionId,
                    contactStateId,
                    agentProfile,
                    order,
                    stage: 'sdr_awaiting_agency_query',
                    inboundText: text,
                    outboundText: '[AUDIO] ENDERECO_CIDADE_PROVINCIA_AGENCIA'
                });
            }
            const agencyOptionsQuery = principalSdrAgencyOptionsQuery(order, text);
            const page = principalSdrAgencyOptionsPageForOrder(order, agencyOptionsQuery, 0);
            if (page.options.length) {
                if (principalSdrShouldAskAgencyRefinement({ page, order, text })) {
                    const replyText = principalSdrAgencyRefinementQuestionText();
                    order = { ...order, agencyOptions: [], agencyOptionsPage: 0, agencyOptionsQuery: '', agencyRefinementRequested: true };
                    return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_agency_query', inboundText: text, text: replyText, suffix: 'principal_sdr_agency_refinement' });
                }
                const listText = principalSdrAgencyListText(page.options, { hasMore: page.hasMore, page: page.page });
                order.agencyOptions = page.options;
                order.agencyOptionsPage = page.page;
                order.agencyOptionsQuery = agencyOptionsQuery;
                return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_agency_selection', inboundText: text, text: listText, suffix: 'principal_sdr_agency_list' });
            }
            const replyText = 'No encontré agencias con esa ciudad y provincia. Envíeme otra ciudad y provincia cercana para buscar de nuevo.';
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_agency_query', inboundText: text, text: replyText, suffix: 'principal_sdr_agency_query' });
        }
        if (isHomeDeliveryChoice(text) || /^(no|nop|nao|não)$/i.test(normalizeForDecision(text))) {
            order.deliveryType = 'DOMICILIO';
            const replyText = 'Entiendo, señor 👍\n\nSi no puede retirar en agencia, entonces envíeme por favor:\n\n- dirección completa\n- barrio o sector\n- referencia cercana\n\npara revisar entrega a domicilio.';
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_home_address', inboundText: text, text: replyText, suffix: 'principal_sdr_home' });
        }
        const retryText = agencyFirstDeliveryRetryText();
        return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_delivery_mode', inboundText: text, text: retryText, suffix: 'principal_sdr_delivery_retry' });
    }

    if (currentStage === 'sdr_awaiting_agency_query') {
        if (principalSdrIsConfirmationOnly(text)) {
            const retryText = agencyCityProvinceRequestText();
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_agency_query', inboundText: text, text: retryText, suffix: 'principal_sdr_agency_retry_confirmation_only' });
        }
        order = principalSdrMergeLocationAndAgencyDetails(order, text);
        if (!principalSdrOrderHasCityProvince(order)) {
            const retryText = agencyCityProvinceRequestText();
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_agency_query', inboundText: text, text: retryText, suffix: 'principal_sdr_agency_city_province_retry' });
        }
        const agencyOptionsQuery = principalSdrAgencyOptionsQuery(order, text);
        const page = principalSdrAgencyOptionsPageForOrder(order, agencyOptionsQuery, 0);
        order = { ...order, agencyOptions: page.options, agencyOptionsPage: page.page, agencyOptionsQuery };
        if (!page.options.length) {
            const retryText = 'No encontré agencias con esa ciudad y provincia. Envíeme otra ciudad y provincia cercana para buscar de nuevo.';
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_agency_query', inboundText: text, text: retryText, suffix: 'principal_sdr_agency_retry' });
        }
        if (principalSdrShouldAskAgencyRefinement({ page, order, text })) {
            const replyText = principalSdrAgencyRefinementQuestionText();
            order = { ...order, agencyOptions: [], agencyOptionsPage: 0, agencyOptionsQuery: '', agencyRefinementRequested: true };
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_agency_query', inboundText: text, text: replyText, suffix: 'principal_sdr_agency_refinement' });
        }
        const listText = principalSdrAgencyListText(page.options, { hasMore: page.hasMore, page: page.page });
        return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_agency_selection', inboundText: text, text: listText, suffix: 'principal_sdr_agency_list' });
    }

    if (currentStage === 'sdr_awaiting_agency_selection') {
        const currentAgencyPage = Number.parseInt(String(order.agencyOptionsPage || 0), 10) || 0;
        const selectedAgency = selectAgencyOptionFromText(text, order.agencyOptions || [], {
            startNumber: (currentAgencyPage * AGENCY_OPTIONS_PAGE_SIZE) + 1
        });
        if (!selectedAgency) {
            const wantsMoreAgencyOptions = principalSdrWantsMoreAgencyOptions(text);
            const clientDoesNotKnowAgency = principalSdrClientDoesNotKnowAgency(text);
            if (clientDoesNotKnowAgency && !wantsMoreAgencyOptions) {
                order = { ...order, agencyOptionsQuery: '', agencyOptionsPage: 0 };
                const page = principalSdrAgencyOptionsPageForOrder(order, '', 0);
                if (page.options.length) {
                    const listText = principalSdrAgencyListText(page.options, { hasMore: page.hasMore, page: page.page });
                    order = { ...order, agencyOptions: page.options, agencyOptionsPage: page.page };
                    return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_agency_selection', inboundText: text, text: listText, suffix: 'principal_sdr_agency_general_options' });
                }
            }
            const agencyRefinementQuery = principalSdrAgencyRefinementQueryFromText(text, order);
            if (agencyRefinementQuery && !wantsMoreAgencyOptions) {
                order = { ...order, agencyOptionsQuery: agencyRefinementQuery, agencyOptionsPage: 0 };
                const page = principalSdrAgencyOptionsPageForOrder(order, agencyRefinementQuery, 0);
                if (page.options.length) {
                    const listText = principalSdrAgencyListText(page.options, { hasMore: page.hasMore, page: page.page });
                    order = { ...order, agencyOptions: page.options, agencyOptionsPage: page.page };
                    return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_agency_selection', inboundText: text, text: listText, suffix: 'principal_sdr_agency_refined_options' });
                }
            }
            const explicitNewLocation = principalSdrIsAgencyLocationCorrection(text, order);
            if (explicitNewLocation) {
                order = principalSdrClearSelectedAgency(principalSdrMergeLocationAndAgencyDetails(order, text));
                order.agencyOptionsPage = 0;
            }
            const nextPageNumber = explicitNewLocation ? 0 : (Number.parseInt(String(order.agencyOptionsPage || 0), 10) || 0) + 1;
            const page = principalSdrAgencyOptionsPageForOrder(order, order.agencyOptionsQuery || '', nextPageNumber);
            if (page.options.length) {
                const listText = principalSdrAgencyListText(page.options, { hasMore: page.hasMore, page: page.page });
                order = { ...order, agencyOptions: page.options, agencyOptionsPage: page.page };
                return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_agency_selection', inboundText: text, text: listText, suffix: 'principal_sdr_agency_next_options' });
            }
            const retryText = 'Señor, responda por favor con el número de la agencia. Si la ciudad está equivocada, escriba ciudad y provincia.';
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_agency_selection', inboundText: text, text: retryText, suffix: 'principal_sdr_agency_select_retry' });
        }
        order = principalSdrApplyOfficialAgency(order, selectedAgency);
        if (!order.name) {
            const replyText = principalSdrNameRequestText();
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_name', inboundText: text, text: replyText, suffix: 'principal_sdr_name_after_agency' });
        }
        const replyText = principalSdrFinalSummaryText({ order, deliveryType: 'agency' });
        return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_final_confirmation', inboundText: text, text: replyText, suffix: 'principal_sdr_summary_agency' });
    }

    if (currentStage === 'sdr_awaiting_home_address') {
        const split = splitReferenceFromValue(text);
        order.address = order.address || split.value || principalSdrClean(text);
        order.reference = order.reference || split.reference || extractReferenceFromText(text) || '';
        order.deliveryType = 'DOMICILIO';
        if (!order.address || order.address.length < 6) {
            const retryText = 'Para domicilio necesito la dirección completa con barrio o sector y, si tiene, una referencia cercana.';
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_home_address', inboundText: text, text: retryText, suffix: 'principal_sdr_home_retry' });
        }
        const replyText = principalSdrFinalSummaryText({ order, deliveryType: 'home' });
        return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_final_confirmation', inboundText: text, text: replyText, suffix: 'principal_sdr_summary_home' });
    }

    if (currentStage === 'sdr_awaiting_final_confirmation') {
        if (!isOrderCloseAffirmation(text)) {
            const retryText = 'Revise por favor si los datos están correctos. Si todo está bien, responda SI o CONFIRMO para autorizar el despacho.';
            return principalSdrSendTextAndSave({ chatId, peerPhone, sessionId, contactStateId, agentProfile, order, stage: 'sdr_awaiting_final_confirmation', inboundText: text, text: retryText, suffix: 'principal_sdr_final_retry' });
        }
        const deliveryTypeText = normalizeFieldLabel(order.deliveryType || order.tipoEnvio || '');
        const hasAgencyData = Boolean(order.agencyName || order.agencyAddress || order.agency || order.agencyValidated);
        const hasExplicitHomeData = deliveryTypeText === 'domicilio' || (
            !hasAgencyData
            && order.address
            && /\b(domicilio|casa|residencia|barrio|manzana|villa|departamento|edificio|sector|referencia)\b/i.test([order.address, order.reference].filter(Boolean).join(' '))
        );
        const deliveryType = hasAgencyData || deliveryTypeText === 'servientrega' || deliveryTypeText === 'agencia'
            ? 'agency'
            : (hasExplicitHomeData ? 'home' : 'agency');
        return principalSdrConfirmOrder({ chatId, peerPhone, sessionId, contactStateId, agentProfile, customerContext, order, deliveryType, inboundText: text });
    }

    return false;
};

const ECUADOR_GREETING_TIMEZONE = 'America/Guayaquil';
const GREETING_AUDIO_BY_PERIOD = {
    morning: '01_B_Buenos_dias',
    afternoon: '01_C_Buenos_tardes',
    night: '01_A_buenas_noches'
};

export const getGreetingPeriodByTime = (date = new Date(), timezone = ECUADOR_GREETING_TIMEZONE) => {
    const safeDate = date instanceof Date ? date : new Date(date);
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || ECUADOR_GREETING_TIMEZONE,
        hour: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(safeDate);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);

    if (hour >= 5 && hour <= 11) return 'morning';
    if (hour >= 12 && hour <= 17) return 'afternoon';
    return 'night';
};

export const getGreetingAudioByTime = (date = new Date(), timezone = ECUADOR_GREETING_TIMEZONE) => (
    GREETING_AUDIO_BY_PERIOD[getGreetingPeriodByTime(date, timezone)]
);

const greetingSelectionByTime = (date = new Date(), timezone = ECUADOR_GREETING_TIMEZONE) => {
    const period = getGreetingPeriodByTime(date, timezone);
    return {
        period,
        baseName: GREETING_AUDIO_BY_PERIOD[period],
        timezone
    };
};

export const hasGreetingAlreadyBeenSent = (agentMemory = {}) => Boolean(
    agentMemory.greeting_audio_sent
    || agentMemory.greeting_sent_at
    || agentMemory.greetingAudioSent
    || agentMemory.greetingSentAt
);

export const shouldSendGreetingAudio = (agentMemory = {}) => !hasGreetingAlreadyBeenSent(agentMemory);

const COMMERCIAL_INITIAL_AUDIO_NAMES = {
    EC: []
};

const INITIAL_PROOF_ITEMS = [
    'image:social_01',
    'image:social_02',
    'image:social_03',
    'image:social_04',
    'audio:DEPOIMENTO_AUDIO_PRODUTO'
];

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
        'Señor, estas son las promociones disponibles hoy:',
        '',
        '1 botella por $39',
        '3 botellas por $95.99',
        '6 botellas por $167.99',
        '',
        '✅ El pago es contra entrega.'
    ];

    if (selectedOrder?.quantity) {
        return [...base, '', buildCheckoutPackageCtaText(customerContext, selectedOrder)].join('\n');
    }

    return [...base, 'Cual desea reservar para usted?'].join('\n');
};

const completedInitialStepsFromMemory = (agentMemory = {}) => new Set([
    ...(hasGreetingAlreadyBeenSent(agentMemory) ? ['audio:greeting'] : []),
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

const expectedInitialStepsForCountry = ({ includePrice = true } = {}) => (
    [
        'audio:greeting',
        'proof:one',
        'image:vit_power_bottle',
        ...(includePrice ? [
            'audio:TRATAMENTO_Y_PRECIOS_PROMOCAO',
            'text:price'
        ] : [])
    ]
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
        baseName: 'TEMPO_RESULTADO_VIT_POWER'
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

const isInitialProductPresentationDone = (agentMemory = {}, countryCode = 'EC', options = {}) => {
    const completedSteps = completedInitialStepsFromMemory(agentMemory);
    return expectedInitialStepsForCountry(options).every((step) => completedSteps.has(step));
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
    includePrice = true,
    includeBottle = false,
    extraAudioNames = [],
    bypassOutboundDedupe = false
}) => {
    const countryCode = 'EC';
    const audioNames = COMMERCIAL_INITIAL_AUDIO_NAMES[countryCode] || COMMERCIAL_INITIAL_AUDIO_NAMES.EC;
    const completedSteps = completedInitialStepsFromMemory(agentMemory);
    const sentAudios = [];
    const sentImages = [];
    const completedNow = [];
    const presentationStartedAt = new Date();
    const peerPhone = digitsOnly(customerContext?.phone || '') || digitsOnly(jid);
    const outboundSendOptions = (extra = {}) => ({
        sessionId,
        ...(bypassOutboundDedupe ? { force: true, bypassDedupe: true } : {}),
        ...extra
    });
    let greetingAudioBaseName = '';
    let greetingPeriod = '';
    let greetingAudioSent = false;
    let greetingSentAt = null;
    let interrupted = false;
    const hasInboundInterrupt = async () => {
        if (!initialFunnelInterruptCheckEnabled()) return false;
        const peerTail = peerPhone.length >= 9 ? peerPhone.slice(-9) : '';
        const inboundScope = [
            { chatId: jid }
        ];
        if (peerPhone) {
            inboundScope.push(
                { peerPhone },
                { from: { $regex: `${peerPhone}@` } },
                { chatId: { $regex: `${peerPhone}@` } }
            );
        }
        if (peerTail) {
            inboundScope.push(
                { peerPhone: { $regex: `${peerTail}$` } },
                { from: { $regex: `${peerTail}@` } },
                { chatId: { $regex: `${peerTail}@` } }
            );
        }
        const newerInbound = await Message.exists({
            $or: inboundScope,
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
        if (interrupted) {
            console.log(`[FUNIL-INICIAL] sequencia interrompida por nova mensagem do cliente -> ${jid} | peer=${peerPhone}`);
        }
        return interrupted;
    };

    if (!shouldSendGreetingAudio(agentMemory) || completedSteps.has('audio:greeting')) {
        console.log(`[GREETING_ALREADY_SENT_SKIP] ${jid} | audio=${agentMemory.greeting_audio_sent || ''} | period=${agentMemory.greeting_period || ''}`);
    } else {
        const greeting = greetingSelectionByTime(new Date(), ECUADOR_GREETING_TIMEZONE);
        greetingAudioBaseName = greeting.baseName;
        greetingPeriod = greeting.period;
        console.log(`[GREETING_PERIOD_DETECTED] ${jid} | period=${greetingPeriod} | timezone=${greeting.timezone}`);
        console.log(`[GREETING_AUDIO_SELECTED] ${jid} | audio=${greetingAudioBaseName} | period=${greetingPeriod}`);

        if (!(await hasInboundInterrupt())) {
            const greetingAudioPath = await resolveCountryAudio({ country: countryCode, baseName: greetingAudioBaseName });
            if (!greetingAudioPath) {
                console.warn(`[FUNIL] Audio de saludo nao encontrado: ${countryCode}/${greetingAudioBaseName}`);
            } else {
                greetingAudioSent = await sendAudio(jid, greetingAudioPath, true, outboundSendOptions());
                sentAudios.push({
                    baseName: greetingAudioBaseName,
                    sent: greetingAudioSent,
                    period: greetingPeriod,
                    kind: 'greeting'
                });
                console.log(`[GREETING_AUDIO_SENT] ${jid} | audio=${greetingAudioBaseName} | period=${greetingPeriod} | sent=${greetingAudioSent}`);
                if (greetingAudioSent) {
                    greetingSentAt = new Date();
                    completedNow.push('audio:greeting');
                    await recordInitialFunnelStepMessage({
                        jid,
                        peerPhone,
                        body: `[AUDIO] ${greetingAudioBaseName}`,
                        type: 'audio',
                        mediaPath: greetingAudioPath
                    });
                    if (contactStateId) {
                        await ContactState.updateOne(
                            { _id: contactStateId },
                            {
                                $set: {
                                    'metadata.greeting_audio_sent': greetingAudioBaseName,
                                    'metadata.greeting_period': greetingPeriod,
                                    'metadata.greeting_sent_at': greetingSentAt,
                                    'metadata.perAgentMemory.vit_power_ec.greeting_audio_sent': greetingAudioBaseName,
                                    'metadata.perAgentMemory.vit_power_ec.greeting_period': greetingPeriod,
                                    'metadata.perAgentMemory.vit_power_ec.greeting_sent_at': greetingSentAt,
                                    'metadata.perAgentMemory.vit_power_ec.lastFunnelStage': greetingPeriod === 'night' ? '01_ENTRADA_NOCHE' : '01_ENTRADA'
                                }
                            }
                        ).catch((error) => console.warn('[GREETING] Falha ao gravar memoria:', error.message));
                    }
                    await sleep(initialFunnelStepDelayMs('audio'));
                }
            }
        }
    }

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
        const sent = await sendAudio(jid, audioPath, true, outboundSendOptions());
        sentAudios.push({ baseName, sent });
        console.log(`[FUNIL-INICIAL] audio ${baseName} -> ${jid} | sent=${sent}`);
        if (sent) {
            completedNow.push(stepKey);
            await recordInitialFunnelStepMessage({
                jid,
                peerPhone,
                body: `[AUDIO] ${baseName}`,
                type: 'audio',
                mediaPath: audioPath
            });
        }
        if (sent) await sleep(initialFunnelStepDelayMs('audio'));
    }

    if (!(await hasInboundInterrupt()) && !completedSteps.has('proof:one')) {
        const proofItem = await getNextItemByPurpose(peerPhone || jid, 'prova', {
            candidates: INITIAL_PROOF_ITEMS,
            contactStateId,
            agentKey: 'vit_power_ec',
            resetWhenExhausted: true
        });
        if (proofItem) {
            const [proofKind, proofKey] = proofItem.split(':');
            if (proofKind === 'audio') {
                const audioPath = await resolveCountryAudio({ country: countryCode, baseName: proofKey });
                if (!audioPath) {
                    console.warn(`[FUNIL] Audio de prova nao encontrado: ${countryCode}/${proofKey}`);
                } else {
                    const sent = await sendAudio(jid, audioPath, true, outboundSendOptions());
                    sentAudios.push({ baseName: proofKey, sent, purpose: 'prova', item: proofItem });
                    console.log(`[FUNIL-PROVA] audio ${proofKey} -> ${jid} | sent=${sent}`);
                    if (sent) {
                        completedNow.push('proof:one');
                        completedNow.push(`audio:${proofKey}`);
                        await markPurposeItemSent({
                            contactStateId,
                            agentKey: 'vit_power_ec',
                            purpose: 'prova',
                            item: proofItem
                        });
                        await recordInitialFunnelStepMessage({
                            jid,
                            peerPhone,
                            body: `[AUDIO] ${proofKey}`,
                            type: 'audio',
                            mediaPath: audioPath
                        });
                        await sleep(initialFunnelStepDelayMs('audio'));
                    }
                }
            } else if (proofKind === 'image') {
                const media = getSalesMedia(proofKey);
                if (!media) {
                    console.warn(`[FUNIL] Prova social nao encontrada: ${proofKey}`);
                } else {
                    const proofIndex = INITIAL_PROOF_ITEMS.indexOf(proofItem);
                    const caption = proofKey === 'vit_power_bottle'
                        ? media.caption
                        : buildInitialProofCaption({ customerContext, index: Math.max(0, proofIndex) });
                    const sent = await sendImage(jid, media.path, caption, outboundSendOptions());
                    sentImages.push({ key: proofKey, sent, purpose: 'prova', item: proofItem });
                    console.log(`[FUNIL-PROVA] imagem ${proofKey} -> ${jid} | sent=${sent}`);
                    if (sent) {
                        completedNow.push('proof:one');
                        completedNow.push(`image:${proofKey}`);
                        await markPurposeItemSent({
                            contactStateId,
                            agentKey: 'vit_power_ec',
                            purpose: 'prova',
                            item: proofItem
                        });
                        await recordInitialFunnelStepMessage({
                            jid,
                            peerPhone,
                            body: `[IMAGEM] ${proofKey}`,
                            type: 'image',
                            mediaPath: media.path
                        });
                        await sleep(initialFunnelStepDelayMs('image'));
                    }
                }
            }
        }
    }

    if (!(await hasInboundInterrupt()) && includeBottle && !completedSteps.has('image:vit_power_bottle')) {
        const media = getSalesMedia('vit_power_bottle');
        if (!media) {
            console.warn('[FUNIL] Frasco Vit Power nao encontrado para entrada logistica.');
        } else {
            const sent = await sendImage(jid, media.path, media.caption || 'Este es el frasco oficial de Vit Power para Ecuador.', outboundSendOptions());
            sentImages.push({ key: 'vit_power_bottle', sent, purpose: 'produto', item: 'image:vit_power_bottle' });
            console.log(`[FUNIL-PRODUTO] imagem vit_power_bottle -> ${jid} | sent=${sent}`);
            if (sent) {
                completedNow.push('image:vit_power_bottle');
                await recordInitialFunnelStepMessage({
                    jid,
                    peerPhone,
                    body: '[IMAGEM] vit_power_bottle',
                    type: 'image',
                    mediaPath: media.path
                });
                await sleep(initialFunnelStepDelayMs('image'));
            }
        }
    }

    for (const baseName of extraAudioNames.filter(Boolean)) {
        if (await hasInboundInterrupt()) break;
        const stepKey = `audio:${baseName}`;
        if (completedSteps.has(stepKey)) {
            sentAudios.push({ baseName, sent: false, skipped: 'already_done', purpose: 'extra' });
            continue;
        }
        const audioPath = await resolveCountryAudio({ country: countryCode, baseName });
        if (!audioPath) {
            console.warn(`[FUNIL] Audio extra nao encontrado: ${countryCode}/${baseName}`);
            continue;
        }
        const sent = await sendAudio(jid, audioPath, true, outboundSendOptions());
        sentAudios.push({ baseName, sent, purpose: 'extra' });
        console.log(`[FUNIL-EXTRA] audio ${baseName} -> ${jid} | sent=${sent}`);
        if (sent) {
            completedNow.push(stepKey);
            await recordInitialFunnelStepMessage({
                jid,
                peerPhone,
                body: `[AUDIO] ${baseName}`,
                type: 'audio',
                mediaPath: audioPath
            });
            await sleep(initialFunnelStepDelayMs('audio'));
        }
    }

    const priceText = includePrice
        ? (priceTextOverride || buildInitialPriceText(customerContext))
        : '';
    let priceAudioSent = false;
    if (includePrice && !completedSteps.has('audio:TRATAMENTO_Y_PRECIOS_PROMOCAO')) {
        const priceAudioPath = await resolveCountryAudio({
            country: countryCode,
            baseName: 'TRATAMENTO_Y_PRECIOS_PROMOCAO'
        });
        if (priceAudioPath) {
            await sleep(initialFunnelStepDelayMs('audio'));
            if (!(await hasInboundInterrupt())) {
                priceAudioSent = await sendAudio(jid, priceAudioPath, true, outboundSendOptions());
                console.log(`[FUNIL-INICIAL] audio TRATAMENTO_Y_PRECIOS_PROMOCAO -> ${jid} | sent=${priceAudioSent}`);
                if (priceAudioSent) {
                    completedNow.push('audio:TRATAMENTO_Y_PRECIOS_PROMOCAO');
                    await recordInitialFunnelStepMessage({
                        jid,
                        peerPhone,
                        body: '[AUDIO] TRATAMENTO_Y_PRECIOS_PROMOCAO',
                        type: 'audio',
                        mediaPath: priceAudioPath
                    });
                }
            }
        }
    }

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
                priceSent = await sendText(jid, priceText, null, outboundSendOptions());
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

    const allCompletedSteps = [...new Set([...completedSteps, ...completedNow])];

    return {
        delivered: sentAudios.some((item) => item.sent) || sentImages.some((item) => item.sent) || priceSent || priceAudioSent,
        sentAudios,
        sentImages,
        priceSent,
        priceAudioSent,
        priceText: priceSent ? priceText : '',
        greetingAudioSent,
        greetingAudioBaseName,
        greetingPeriod,
        greetingSentAt,
        interrupted,
        completedSteps: allCompletedSteps,
        completedNow,
        isComplete: expectedInitialStepsForCountry({ includePrice }).every((step) => allCompletedSteps.includes(step))
    };
};

const buildCustomerMemory = async ({ chatId, customerContext, phoneDigits = '' }) => {
    const digits = digitsOnly(phoneDigits) || String(chatId || '').replace(/\D/g, '');
    const phoneTail = digits.length >= 10 ? digits.slice(-10) : digits;
    const messageScope = phoneTail
        ? {
            $or: [
                { chatId },
                { peerPhone: { $regex: `${phoneTail}$` } },
                { chatId: { $regex: `${phoneTail}@` } }
            ]
        }
        : { chatId };

    const [recentMessages, latestOrder] = await Promise.all([
        Message.find(messageScope).sort({ createdAt: -1 }).limit(18).lean(),
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
    const body = normalizeForDecision(text);
    if (!body.trim()) return 'unknown';
    if (isSimpleGreeting(text)) return 'greeting';
    if (/(guia|rastreo|rastreamento|codigo|c[oó]digo|numero de guia)/i.test(body)) return 'guide_request';
    if (/(retirar|retiro|agencia|servientrega|ya llego|llego mi pedido|listo para retirar)/i.test(body)) return 'pickup_request';
    if (/(gracias|obrigado|recibi|recebi|llego|chegou|me llego|ya tengo)/i.test(body)) return 'post_sale';
    if (/(despu[eé]s|luego|mas tarde|m[aá]s tarde|fin de mes|final de mes|quincena|cuando cobre|cuando me paguen|para despues|para despu[eé]s|solo estoy viendo|solo quiero saber)/i.test(body)) return 'buy_later';
    if (/(descuento|rebaja|menos|barato|caro|costoso|mucho)/i.test(body)) return 'price_resistance';
    if (/(precio|valor|cu[aá]nto|cuanto|cost[aá]|promo)/i.test(body)) return 'price_check';
    if (/(liquido|l[ií]quido|orina|orinar|urinari|urinario|urinaria|prostata|pr[oó]stata|prostatitis|prostati)/i.test(body)) return 'symptom_question';
    if (/(funciona|sirve|sirbe|resultado|resultados|testimonio|prueba|real|verdad|confianza)/i.test(body)) return 'proof_request';
    if (/(composicion|composicion|ingrediente|ingredientes|que tiene|contiene)/i.test(body)) return 'composition_question';
    if (/(1 frasco|2 frascos|3 frascos|6 frascos|un frasco|dos frascos|tres frascos|seis frascos|\buno\b|\bdos\b|\btres\b|\bseis\b)/i.test(body)) return 'quantity_selection';
    if (/(confirmo|confirmado|envialo|envie|mande|mandelo|prepara|prepare|hagale|listo|de una|hoy)/i.test(body)) return 'closing';
    if (/(quiero|me interesa|deseo|llevar|comprar)/i.test(body)) return 'purchase_intent';
    if (/(nombre|apellido|direccion|direcci[oó]n|ciudad|provincia|departamento|referencia|barrio)/i.test(body)) return 'customer_data';
    if (/(env[ií]o|entrega|domicilio|casa|agencia|servientrega|oficina|ciudad)/i.test(body)) return 'shipping_info';
    if (/(diabet|presi[oó]n|hiperten|cirug)/i.test(body)) return 'contraindication_question';
    return 'general_question';
};

const funnelBucketForIntent = (intent, text = '') => {
    if (intent === 'greeting') return '01_ENTRADA';
    if (['price_check', 'composition_question', 'symptom_question', 'contraindication_question', 'shipping_info'].includes(intent)) return '02_QUALIFICACAO';
    if (['proof_request'].includes(intent)) return '03_PROVA';
    if (['price_resistance', 'buy_later'].includes(intent)) return '04_OBJECAO';
    if (['purchase_intent'].includes(intent)) return '05_OFERTA';
    if (['quantity_selection', 'customer_data', 'closing'].includes(intent) || looksLikeOrderDataMessage(text)) return '06_FECHAMENTO';
    if (['guide_request', 'pickup_request'].includes(intent)) return '07_LOGISTICA';
    if (['post_sale'].includes(intent)) return '08_POSVENDA';
    return '02_QUALIFICACAO';
};

const buyerScoreForIntent = (intent, text = '') => {
    let score = 10;
    if (isInitialProductInquiry(text)) score += 20;
    if (['price_check', 'proof_request', 'shipping_info'].includes(intent)) score += 15;
    if (['purchase_intent', 'quantity_selection'].includes(intent)) score += 35;
    if (['customer_data', 'closing'].includes(intent) || looksLikeOrderDataMessage(text)) score += 50;
    if (['price_resistance', 'buy_later'].includes(intent)) score -= 10;
    if (['guide_request', 'pickup_request', 'post_sale'].includes(intent)) score = 100;
    return Math.max(0, Math.min(100, score));
};

const detectRequestedQuantity = (text) => {
    const body = normalizeFieldLabel(text)
        .replace(/\btre\b(?=\s*(botella|botellas|frasco|frascos|mes|meses|tratamiento|tratamientos|producto|productos)\b)/g, 'tres');
    if (!body) return null;

    const words = body.split(/\s+/).filter(Boolean);
    const wordSet = new Set(words);
    const hasQuantityContext = /\b(frasco|frascos|botella|botellas|mes|meses|tratamiento|tratamientos|producto|productos|unidad|unidades|llevar|quiero|deseo|deme|mandeme|mandame|mande|envie|envia|envieme|envime|enviar|pedido|separe|separar|reserve|reservar|aparteme|aparte|dejeme|deje)\b/i.test(body);
    const isShortQuantityReply = words.length <= 3;

    if (
        /\b6\b/.test(body)
        || (wordSet.has('seis') && (hasQuantityContext || isShortQuantityReply))
    ) return 6;
    if (
        /\b3\b/.test(body)
        || (wordSet.has('tres') && (hasQuantityContext || isShortQuantityReply))
    ) return 3;
    if (
        /\b2\b/.test(body)
        || (wordSet.has('dos') && (hasQuantityContext || isShortQuantityReply))
    ) return 2;
    if (
        /\b1\b/.test(body)
        || ((wordSet.has('un') || wordSet.has('uno') || wordSet.has('una')) && (hasQuantityContext || isShortQuantityReply))
    ) return 1;
    return null;
};

const detectUnsupportedPackageQuantity = (text) => {
    const body = normalizeFieldLabel(text);
    if (!body) return 0;
    const words = body.split(/\s+/).filter(Boolean);
    const wordSet = new Set(words);
    const hasQuantityContext = /\b(frasco|frascos|botella|botellas|botellon|botellones|mes|meses|tratamiento|tratamientos|producto|productos|unidad|unidades|paquete|promo|promocion|llevar|quiero|deseo|deme|mandeme|mandame|mande|envie|envia|envieme|enviar|pedido|separe|separar|reserve|reservar|aparteme|aparte|dejeme|deje|precio|valor|cuanto|cu[aá]nto|rebaja|descuento)\b/i.test(body);
    if (!hasQuantityContext) return 0;

    const digitMatch = body.match(/\b([0-9]{1,2})\b/);
    if (digitMatch) {
        const parsed = Number.parseInt(digitMatch[1], 10);
        if (Number.isFinite(parsed) && parsed > 0 && !VALID_PACKAGE_QUANTITIES.includes(parsed)) return parsed;
    }

    const wordQuantities = [
        [4, 'cuatro'],
        [5, 'cinco'],
        [7, 'siete'],
        [8, 'ocho'],
        [9, 'nueve'],
        [10, 'diez']
    ];
    const found = wordQuantities.find(([, word]) => wordSet.has(word));
    return found ? found[0] : 0;
};

const unsupportedPackageQuantityReplyText = (quantity) => {
    const qtyText = quantity ? `de ${quantity} frascos` : 'esa cantidad';
    return `Le entiendo, señor. Paquete ${qtyText} no tenemos activo.\n\nLa promoción oficial de hoy está para 1, 3 o 6 frascos.\n\n¿Cuál desea reservar?`;
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
    const packageLabels = {
        1: '1 botella',
        2: '2 botellas',
        3: '3 botellas',
        6: '6 botellas'
    };
    const label = packageLabels[quantity] || `${quantity} botellas`;
    const price = prices[quantity] || '';

    return `Le envio ${label}${price ? ` por ${price}` : ''}. ¿Listo?`;
};

const shouldConfirmPackageQuantity = ({ text, agentMemory = {} }) => {
    if (isGenericPriceQuestionWithoutQuantity(text)) return 0;
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

const strongQuantityShortcutFromText = ({
    text,
    pendingCheckoutStage = '',
    pendingCheckoutOrder = null,
    agentMemory = {}
}) => {
    if (isGenericPriceQuestionWithoutQuantity(text)) return 0;
    const quantity = detectRequestedQuantity(text);
    if (!quantity) return 0;
    if (looksLikeOrderDataMessage(text)) return 0;

    const blockedStages = new Set([
        'awaiting_agency_selection',
        'awaiting_agency_selection_interrupt'
    ]);
    if (blockedStages.has(String(pendingCheckoutStage || ''))) return 0;

    const stage = String(agentMemory.lastFunnelStage || '');
    const hasInitialPresentation = Boolean(
        agentMemory.initialProductPresentationSentAt
        || agentMemory.initialProductPresentationPriceSentAt
        || (Array.isArray(agentMemory.initialProductPresentationSteps)
            && agentMemory.initialProductPresentationSteps.includes('text:price'))
    );
    const principalStage = isPrincipalSdrStage(pendingCheckoutStage);
    const packageStage = [
        'awaiting_quantity_data',
        'awaiting_package_choice',
        'awaiting_one_bottle_choice',
        'awaiting_package_choice_after_agency',
        'sdr_after_initial',
        'sdr_awaiting_quantity',
        'sdr_awaiting_name',
        'sdr_awaiting_city_province'
    ].includes(String(pendingCheckoutStage || ''));

    if (
        hasInitialPresentation
        || stage === 'initial_product_presentation'
        || stage === 'package_selection'
        || principalStage
        || packageStage
        || !pendingCheckoutOrder
    ) {
        return quantity;
    }
    return 0;
};

const sendSelectedQuantityConfirmation = async ({
    chatId,
    peerPhone,
    text,
    selectedQuantity,
    customerContext,
    agentProfile,
    contactStateId,
    sessionId = null
}) => {
    const replyText = buildQuantityConfirmationReply({
        quantity: selectedQuantity,
        customerContext
    });

    await sendQuantitySelectionAudio({
        jid: chatId,
        countryCode: customerContext.countryCode,
        quantity: selectedQuantity,
        sessionId,
        peerPhone
    });

    const sent = await sendText(chatId, replyText, null, { sessionId });
    if (!sent) return false;

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
        contactStateId,
        agentProfile,
        inboundText: text,
        outboundText: replyText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: 'package_selection',
        inferredObjection: null
    });

    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${agentProfile.key}.selectedQuantity`]: selectedQuantity,
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'package_selection',
                [`metadata.perAgentMemory.${agentProfile.key}.pendingCheckoutOrder`]: {
                    phone: peerPhone,
                    quantity: selectedQuantity,
                    total: getSelectedOffer(customerContext, { quantity: selectedQuantity }).total,
                    valueConfirmed: false,
                    stage: 'sdr_awaiting_value_confirmation',
                    funnelStage: 'sdr_awaiting_value_confirmation',
                    lastQuestionSent: replyText,
                    conversationSummary: 'Cliente escolheu quantidade e aguarda confirmacao para seguir pedido.'
                },
                [`metadata.perAgentMemory.${agentProfile.key}.principalSdrStage`]: 'sdr_awaiting_value_confirmation',
                [`metadata.perAgentMemory.${agentProfile.key}.principalSdrUpdatedAt`]: new Date()
            }
        }
    );
    console.log(`[FUNIL] Quantidade confirmada apos tabela -> ${chatId} | quantidade=${selectedQuantity}`);
    return true;
};

const sendUnsupportedQuantityRedirect = async ({
    chatId,
    peerPhone,
    text,
    unsupportedQuantity,
    agentProfile,
    contactStateId,
    sessionId = null
}) => {
    const replyText = unsupportedPackageQuantityReplyText(unsupportedQuantity);
    const sent = await sendText(chatId, replyText, null, { sessionId });
    if (!sent) return false;

    try {
        await Message.create({
            _id: `out_${Date.now()}_quantity_redirect`,
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
        inferredIntent: 'quantity_selection',
        inferredFunnelStage: 'package_selection',
        inferredObjection: 'unsupported_quantity'
    });

    console.log(`[FUNIL] Quantidade sem pacote redirecionada -> ${chatId} | quantidade=${unsupportedQuantity || 'desconhecida'}`);
    return true;
};

const inferFunnelStage = (text, customerContext, agentProfile) => {
    const body = String(text || '').toLowerCase();
    const intent = inferIntent(text);
    if (['guide_request', 'pickup_request'].includes(intent)) return 'logistics';
    if (intent === 'post_sale') return 'post_sale';
    if (intent === 'proof_request') return 'proof_requested';
    if (intent === 'price_resistance') return 'objection_price';
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
    if (
        agentMemory.initialProductPresentationSentAt
        || agentMemory.initialProductPresentationCompletedAt
        || agentMemory.initialProductPresentationPriceSentAt
        || (Array.isArray(agentMemory.initialProductPresentationSteps) && agentMemory.initialProductPresentationSteps.length > 0)
    ) {
        return false;
    }
    return !isInitialProductPresentationDone(agentMemory, countryCodeForAgentProfile(agentProfile));
};

const isDeliveryTimeQuestionText = (text = '') => {
    const body = normalizeForDecision(text);
    if (!body) return false;
    return /\bpara\s+cuando\b/i.test(body)
        || /\bcuando\b.*\b(llega|llegar|entrega|entregan|envian|envio|pedido|producto)\b/i.test(body)
        || /\bcuanto\b.*\b(demora|tarda)\b.*\b(llegar|llega|entrega|envio|pedido|producto)\b/i.test(body)
        || /\b(en\s+)?cuantos\s+dias\b/i.test(body);
};

const shouldRunLogisticInitialPresentation = ({ text, agentProfile, contactState }) => {
    if (!shouldRunInitialProductPresentation({ text, agentProfile, contactState })) return false;
    return isDeliveryTimeQuestionText(text);
};

const shouldRestartInitialProductPresentationAfterClosedOrder = ({ text, agentProfile, contactState }) => {
    return false;
};

const holdForHuman = async ({
    contactStateId,
    agentProfile,
    reason,
    note = ''
}) => {
    if (!contactStateId) return;
    const prefix = `metadata.perAgentMemory.${agentProfile.key}`;
    const pausedUntil = reason === 'order_closed_human_handoff'
        ? new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000)
        : null;
    const pauseFields = pausedUntil
        ? {
            'human.mode': 'manual',
            'human.pausedUntil': pausedUntil,
            [`${prefix}.automationPausedUntil`]: pausedUntil,
            [`${prefix}.humanPausedUntil`]: pausedUntil,
            [`${prefix}.lastFunnelStage`]: 'order_closed',
            'metadata.lastKnownFunnelStage': 'order_closed',
            'metadata.automationPausedUntil': pausedUntil,
            'metadata.automationPausedReason': reason
        }
        : {};
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`${prefix}.humanHandoffAt`]: new Date(),
                [`${prefix}.humanHandoffReason`]: reason,
                'metadata.automationHandoffSuggestedReason': reason,
                'metadata.automationHandoffSuggestedAt': new Date(),
                'metadata.automationHandoffSuggestedNote': note || (pausedUntil
                    ? 'Pedido fechado. Automacao pausada para evitar novo ciclo de funil.'
                    : 'Handoff sugerido pelo funil, sem pausar a automacao.'),
                ...pauseFields
            }
        }
    );
};

const hasAnyInitialProductPresentation = (agentMemory = {}) => Boolean(
    agentMemory.initialProductPresentationSentAt
    || agentMemory.initialProductPresentationCompletedAt
    || agentMemory.initialProductPresentationPriceSentAt
    || agentMemory.initialProductPresentationAttemptedAt
    || agentMemory.initialProductPresentationFailedAt
    || agentMemory.initialProductPresentationBlockedAt
    || (Array.isArray(agentMemory.initialProductPresentationSteps) && agentMemory.initialProductPresentationSteps.length > 0)
    || (Array.isArray(agentMemory.initialProductPresentationAudios) && agentMemory.initialProductPresentationAudios.some((item) => item?.sent))
    || (Array.isArray(agentMemory.initialProductPresentationImages) && agentMemory.initialProductPresentationImages.some((item) => item?.sent))
);

const initialFunnelRetryCooldownMs = () => {
    const hours = Number.parseInt(process.env.INITIAL_FUNNEL_FAILED_RETRY_COOLDOWN_HOURS || '24', 10);
    return Math.max(1, Number.isFinite(hours) ? hours : 24) * 60 * 60 * 1000;
};

const acquireInitialFunnelSendLock = async ({ contactStateId, agentProfile }) => {
    if (!contactStateId || !agentProfile?.key) return false;
    const prefix = `metadata.perAgentMemory.${agentProfile.key}`;
    const now = new Date();
    const staleLock = new Date(Date.now() - 10 * 60 * 1000);
    const attemptCutoff = new Date(Date.now() - initialFunnelRetryCooldownMs());
    const result = await ContactState.updateOne(
        {
            _id: contactStateId,
            $and: [
                { $or: [
                    { [`${prefix}.initialProductPresentationSentAt`]: { $exists: false } },
                    { [`${prefix}.initialProductPresentationSentAt`]: null },
                    { [`${prefix}.initialProductPresentationSentAt`]: '' }
                ] },
                { $or: [
                    { [`${prefix}.initialProductPresentationSteps.0`]: { $exists: false } },
                    { [`${prefix}.initialProductPresentationSteps`]: { $size: 0 } }
                ] },
                { $or: [
                    { [`${prefix}.initialProductPresentationAttemptedAt`]: { $exists: false } },
                    { [`${prefix}.initialProductPresentationAttemptedAt`]: null },
                    { [`${prefix}.initialProductPresentationAttemptedAt`]: '' },
                    { [`${prefix}.initialProductPresentationAttemptedAt`]: { $lte: attemptCutoff } }
                ] },
                { $or: [
                    { [`${prefix}.initialFunnelSendLockAt`]: { $exists: false } },
                    { [`${prefix}.initialFunnelSendLockAt`]: { $lte: staleLock } }
                ] }
            ]
        },
        {
            $set: {
                [`${prefix}.initialFunnelSendLockAt`]: now,
                [`${prefix}.initialProductPresentationAttemptedAt`]: now
            }
        }
    );
    return result.modifiedCount > 0;
};

const releaseInitialFunnelSendLock = async ({ contactStateId, agentProfile }) => {
    if (!contactStateId || !agentProfile?.key) return;
    await ContactState.updateOne(
        { _id: contactStateId },
        { $unset: { [`metadata.perAgentMemory.${agentProfile.key}.initialFunnelSendLockAt`]: '' } }
    ).catch(() => null);
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
                [`${prefix}.initialProductPresentationAttemptedAt`]: '',
                [`${prefix}.initialProductPresentationFailedAt`]: '',
                [`${prefix}.initialProductPresentationFailedReason`]: '',
                [`${prefix}.initialProductPresentationBlockedAt`]: '',
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

const isExplicitNewPurchaseAfterClosedOrder = (text) => {
    const body = normalizeForDecision(text);
    if (!body) return false;
    if (isPostOrderCourtesyText(text) || isLogisticsAfterOrderText(text)) return false;
    if (!isInitialProductInquiry(text)) return false;
    return /\b(quiero|deseo|comprar|compra|nuevo pedido|otro pedido|otro producto|vit power|producto|frasco|frascos|precio|valor|promocion|promo)\b/i.test(body);
};

const isOrderCloseAffirmation = (text) => {
    const body = normalizeForDecision(text);
    if (!body) return false;
    if (body.length > 120) return false;
    return /^(si|sim|sii|claro|correcto|correto|certo|cierto|correcta|correcto gracias|ok correcto|ok esta correcto|todo correcto|todo certo|todo bien|todo ok|esta correcto|esta correcta|esta bien|esta bueno|exacto|asi esta bien|me parece bien|ok|okay|listo|perfecto|esta perfecto|confirmo|confirmado|confirmo la compra|confirmo el pedido|confirmo despacho|de acuerdo|dale|hagale|adelante|proceda|puede proceder|puede enviar|autorizo|autorizado|aprobado|acepto|aceptado|vale|bueno|bien|asi es|si senora|si gracias|ok gracias|bien gracias|mande nomas|envie nomas|envielo nomas|mandelo nomas|vorrecto|vorecto)$/.test(body)
        || /^(si|sim|claro|correcto|correto|certo|cierto|correcta|correcto gracias|ok correcto|todo correcto|todo bien|todo ok|esta bien|ok|okay|listo|perfecto|confirmo|confirmado|confirmo la compra|confirmo el pedido|de acuerdo|dale|hagale|adelante|proceda|puede proceder|autorizo|autorizado|aprobado|acepto|aceptado|vale|bueno|bien|ya|ahora|hoy|de una|mande nomas|envie nomas|vorrecto|vorecto)\b/.test(body)
        || /(envialo|envielo|envie|mande|mandelo|prepare|prepara|proceda|puede proceder|puede enviar|autorizo|autorizado|aprobado|acepto|confirmo|si puede enviar|si env|mande nomas|envie nomas|envielo nomas|mandelo nomas)/i.test(body);
};

export const __principalSdrContextAudit = {
    normalizeForDecision,
    detectRequestedQuantity,
    isGenericPriceQuestionWithoutQuantity,
    officialPricePromotionText,
    sanitizeGenericPriceReply,
    sanitizeGenericPriceOutboundPlan,
    inferIntent,
    principalSdrIsValueOfferAcceptance,
    principalSdrIsConfirmationOnlyText,
    isAgencyDeliveryConsent,
    isHomeDeliveryChoice,
    hasAgencyIndicationData,
    principalSdrLocationFromText,
    principalSdrMergeIncoming,
    principalSdrMergeLocationAndAgencyDetails,
    principalSdrApplyOfficialAgency,
    principalSdrLooksLikeAgencyOrLocationAnswer,
    principalSdrAgencyOptionsPageForOrder,
    principalSdrAgencyListText,
    principalSdrAgencyOptionFromOrder,
    principalSdrAgencySectorFromText,
    principalSdrAgencyRefinementQuestionText,
    principalSdrAgencyRefinementQueryFromText,
    principalSdrClientDoesNotKnowAgency,
    principalSdrShouldAskAgencyRefinement,
    agencyCityProvinceRequestText,
    selectAgencyOptionFromText,
    looksLikeCustomerFullName,
    isOrderCloseAffirmation,
    principalSdrLooksLikeLocationCorrection,
    principalSdrLooksLikeBuyLater
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
            'Guarde este numero como Valeria Zambrano, porque por aqui le aviso cuando su pedido tenga guia y cuando este listo para retirar.'
        ].join('\n');
    }

    return [
        '*Gracias por confirmar sus datos.*',
        '*Su pedido fue confirmado para entrega a domicilio.*',
        'En breve preparamos su pedido para envio a su direccion. Quede atento al telefono cuando la transportadora se comunique con usted.',
        'Guarde este numero como Valeria Zambrano, porque por aqui le aviso sobre la guia, la entrega y cualquier soporte de su pedido.'
    ].join('\n');
};

const LEAKED_AUDIO_MARKER_REGEX = /\[AUDIO\]\s*(AGRADECIMENTO_AGENCIA_DE_ENTREGA|Agradecimento_Agencia_01|Agradecimento_Agencia|AGRADECIMENTO(?:_AGENCIA)?|BONUS_RETIRADA)?/gi;

const hasLeakedOrderClosedAudioMarker = (replyText = '') => (
    /\[AUDIO\]\s*(AGRADECIMENTO_AGENCIA_DE_ENTREGA|Agradecimento_Agencia_01|Agradecimento_Agencia|AGRADECIMENTO(?:_AGENCIA)?|BONUS_RETIRADA)/i.test(String(replyText || ''))
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
    const funnelBucket = funnelBucketForIntent(intent, latestOrder?.conversationMemory?.lastCustomerText || '');
    const parts = [
        agentProfile?.key ? `agente=${agentProfile.key}` : null,
        customerContext.country ? `pais=${customerContext.country}` : null,
        customerContext.product ? `producto=${customerContext.product}` : null,
        intent ? `intencion=${intent}` : null,
        funnelStage ? `etapa=${funnelStage}` : null,
        funnelBucket ? `funil=${funnelBucket}` : null,
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
        'symptom_question',
        'purchase_intent',
        'contraindication_question'
    ].includes(intent) || !!lastObjection;
};

const shouldForceImage = ({ lastObjection, agentProfile, sentImageKeys = [] }) => {
    if (String(process.env.BOT_DISABLE_AUTO_MEDIA || '').toLowerCase() === 'true') return null;
    const isCommercialAgent = agentProfile?.key === 'vit_power_ec';
    if (!isCommercialAgent) return null;

    if (lastObjection === 'trust') {
        return sentImageKeys.includes('social_03') ? 'vit_power_bottle' : 'social_03';
    }

    return null;
};

const preferredRecordedAudioForReply = ({ intent, lastObjection, funnelStage, replyText, agentProfile, lastAudioSent = '' }) => {
    if (agentProfile?.key !== 'vit_power_ec') return null;
    if (String(process.env.BOT_FAST_TEXT_ONLY || '').toLowerCase() === 'true') return null;
    if (funnelStage === 'collecting_customer_data') return null;

    const body = String(replyText || '').toLowerCase();
    let candidate = null;

    if (lastObjection === 'trust' || intent === 'proof_request') {
        candidate = 'DEPOIMENTO_AUDIO_PRODUTO';
    } else if (intent === 'price_check' || /(precio|valor|promoci[oó]n|promo|frasco|frascos|botella|botellas)/i.test(body)) {
        candidate = 'TRATAMENTO_Y_PRECIOS_PROMOCAO';
    } else if (intent === 'purchase_intent') {
        candidate = 'QUANTOS_FRASCOS_E_DIA_QUERES';
    } else if (intent === 'shipping_info') {
        candidate = 'ENVIO_AGENCIA_100_SEGURO';
    } else if (intent === 'symptom_question' || /(prostata|pr[oó]stata|prostatitis|prostati|orina|orinar|urinari|urinario|urinaria)/i.test(body)) {
        candidate = 'Ajuda_Prostata';
    } else if (/(funciona|sirve|resultado|resultados)/i.test(body)) {
        candidate = 'FUNCIONA_VIT_POWER';
    } else if (/(como se toma|tomar|toma|capsula|c[aá]psula|liquido|l[ií]quido)/i.test(body)) {
        candidate = 'COMO_SE_TOMA_VIT_POWER';
    }

    return candidate && candidate !== lastAudioSent ? candidate : null;
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
    const wantsNewPurchase = isExplicitNewPurchaseAfterClosedOrder(text);

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

const buildAttendanceRescueText = ({ inboundText = '', customerContext = {} } = {}) => {
    const text = normalizeFieldLabel(inboundText);
    if (/\b(precio|valor|cuanto|cuanto cuesta|promo|promocion|frasco|frascos)\b/i.test(text)) {
        return 'Claro, sigo con usted. En Ecuador tenemos 1 frasco por 39 USD, 3 por 95.99 USD y 6 por 167.99 USD. Con cual opcion desea empezar?';
    }
    if (/\b(quiero|deseo|comprar|pedido|confirmar|confirmo|mande|envie|envieme|agencia|domicilio)\b/i.test(text)) {
        return 'Perfecto, sigo con su pedido. Para dejarlo sin error, me envia nombre completo, ciudad y si prefiere agencia Servientrega o domicilio?';
    }
    if (/\b(audio|voz|escuche|escuchar|nota)\b/i.test(text)) {
        return 'Le leo por aqui, senor. Para ayudarle sin error, escribame en una frase si su duda es sobre precio, como tomar, agencia o pedido.';
    }
    if (/\b(diabetes|presion|hipertension|medicamento|cirugia|corazon|salud|enfermedad)\b/i.test(text)) {
        return 'Le entiendo. Para explicarle sin confundir, le envio la orientacion aprobada del producto en audio y seguimos paso a paso. Desea que le pase tambien la promocion de 1, 3 o 6 frascos?';
    }
    const country = customerContext?.countryCode === 'EC' ? 'en Ecuador' : '';
    return `Sigo con usted ${country}. Para ayudarle bien, desea informacion del producto o quiere avanzar con su pedido?`.replace(/\s+/g, ' ').trim();
};

const recordBotTextMessage = async ({ chatId, peerPhone = '', body, suffix = 'rescue' }) => {
    if (!body) return;
    try {
        await Message.create({
            _id: `out_${Date.now()}_${suffix}`,
            chatId,
            peerPhone,
            from: 'bot',
            to: chatId,
            body,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (e) { }
};

const firstResponseSlaEnabled = () => (
    String(process.env.WHATSAPP_FIRST_RESPONSE_SLA_ENABLED || 'true').toLowerCase() === 'true'
);

const firstResponseSlaAckText = () => {
    const variants = [
        'Hola, soy Valeria Zambrano. Ya le atiendo por aquí con Vit Power.',
        'Hola, soy Valeria Zambrano. Ya reviso su mensaje y le explico paso a paso.',
        'Hola, soy Valeria Zambrano. Le atiendo por aquí, un momento.'
    ];
    return variants[Math.floor(Math.random() * variants.length)];
};

const shouldSendFirstResponseSlaAck = ({ agentProfile, alreadyIntroduced, agentMemorySnapshot = {}, restartInitialProductPresentation = false } = {}) => {
    if (!firstResponseSlaEnabled()) return false;
    if (agentProfile?.key !== 'vit_power_ec') return false;
    if (restartInitialProductPresentation) return false;
    if (alreadyIntroduced) return false;
    return !hasAnyInitialProductPresentation(agentMemorySnapshot);
};

const sendFirstResponseSlaAck = async ({
    chatId,
    peerPhone = '',
    sessionId = null,
    contactStateId = null,
    agentProfile = AGENT_PROFILES.vit_power_ec,
    inboundText = '',
    alreadyIntroduced = false,
    agentMemorySnapshot = {},
    restartInitialProductPresentation = false
} = {}) => {
    if (!shouldSendFirstResponseSlaAck({
        agentProfile,
        alreadyIntroduced,
        agentMemorySnapshot,
        restartInitialProductPresentation
    })) {
        return false;
    }

    const ackText = firstResponseSlaAckText();
    const phoneKey = digitsOnly(peerPhone || chatId).slice(-10) || digitsOnly(chatId);
    const sent = await sendText(chatId, ackText, null, {
        sessionId,
        firstResponseSla: true,
        skipAfterSendPacing: true,
        humanize: false,
        allowExistingDropiOrder: true,
        outboundContext: 'first_response_sla_ack',
        antiSpamKey: `first_response_sla_ack:${phoneKey}`
    });
    if (!sent) {
        console.warn(`[FIRST-RESPONSE-SLA] ack inicial nao entregue -> ${chatId}`);
        return false;
    }

    await recordBotTextMessage({
        chatId,
        peerPhone,
        body: ackText,
        suffix: 'first_response_sla_ack'
    });
    if (contactStateId && agentProfile?.key) {
        await ContactState.updateOne(
            { _id: contactStateId },
            {
                $set: {
                    [`metadata.perAgentMemory.${agentProfile.key}.firstResponseSlaAckAt`]: new Date(),
                    [`metadata.perAgentMemory.${agentProfile.key}.firstResponseSlaAckText`]: ackText,
                    [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'first_response_sla_ack',
                    'metadata.lastKnownFunnelStage': 'first_response_sla_ack'
                }
            }
        ).catch(() => null);
    }
    console.log(`[FIRST-RESPONSE-SLA] ack inicial enviado -> ${chatId}`);
    return true;
};

const sendAttendanceRescueText = async ({
    chatId,
    peerPhone = '',
    sessionId = null,
    inboundText = '',
    customerContext = {},
    contactStateId = '',
    agentProfile = null,
    inferredIntent = 'attendance_rescue',
    inferredFunnelStage = 'attendance_rescue',
    inferredObjection = null,
    reason = 'unknown'
} = {}) => {
    const rescueText = buildAttendanceRescueText({ inboundText, customerContext });
    const sent = await sendText(chatId, rescueText, null, {
        sessionId,
        force: true,
        allowTextDedupeBypass: true,
        allowHistoryDedupeBypass: true,
        allowExistingDropiOrder: true,
        humanize: false,
        outboundContext: `attendance_rescue_${reason}`,
        antiSpamKey: `attendance_rescue:${digitsOnly(peerPhone || chatId).slice(-10)}:${reason}:${Date.now()}`
    });
    if (!sent) {
        console.warn(`[ATTENDANCE-RESCUE] falhou envio de resgate -> ${chatId} | reason=${reason}`);
        return false;
    }
    await recordBotTextMessage({ chatId, peerPhone, body: rescueText, suffix: `attendance_rescue_${reason}` });
    if (contactStateId && agentProfile?.key) {
        await updateContactStateAgentMemory({
            contactStateId,
            agentProfile,
            inboundText,
            outboundText: rescueText,
            inferredIntent,
            inferredFunnelStage,
            inferredObjection
        });
    }
    console.log(`[ATTENDANCE-RESCUE] texto de contingencia enviado -> ${chatId} | reason=${reason}`);
    return true;
};

const optInRescueContinueText = () => (
    'Perfecto, seguimos. Hoy puede reservar Vit Power y recibe un bono especial en el momento de retirar su pedido.\n\n'
    + 'La promoción está así: 1 frasco por 39 USD, 3 frascos por 95.99 USD y 6 frascos por 167.99 USD.\n\n'
    + '¿Con cuál opción desea continuar: 1, 3 o 6?'
);

const hasRecentOptInRescueBonus = (contactState = {}) => {
    const sentAt = contactState?.metadata?.reengagement?.optInRescueBonusSentAt
        || contactState?.metadata?.optInRescueBonusSentAt
        || '';
    if (!sentAt) return false;
    const sentAtMs = new Date(sentAt).getTime();
    if (!sentAtMs) return false;
    const maxAgeMs = Math.max(1, Number.parseInt(process.env.OPT_IN_RESCUE_REPLY_WINDOW_DAYS || '7', 10) || 7) * 24 * 60 * 60 * 1000;
    return Date.now() - sentAtMs <= maxAgeMs;
};

const isOptInRescueContinueText = (text = '') => {
    const body = normalizeFieldLabel(text);
    return /\b(continuar|continua|sigo|sigamos|quiero seguir|quiero continuar|si quiero|sí quiero|me interesa|quiero vit power|quiero comprar)\b/i.test(body);
};

const maybeHandleOptInRescueContinue = async ({
    text,
    chatId,
    peerPhone,
    sessionId = null,
    contactState,
    contactStateId,
    agentProfile
}) => {
    if (agentProfile?.key !== 'vit_power_ec') return false;
    if (!hasRecentOptInRescueBonus(contactState)) return false;
    if (!isOptInRescueContinueText(text)) return false;

    const replyText = optInRescueContinueText();
    const sent = await sendText(chatId, replyText, null, {
        sessionId,
        outboundContext: 'opt_in_rescue_continue',
        dedupeValue: `opt_in_rescue_continue:${digitsOnly(peerPhone || chatId).slice(-10)}`
    });
    if (!sent) return false;

    await recordBotTextMessage({
        chatId,
        peerPhone,
        body: replyText,
        suffix: 'opt_in_rescue_continue'
    });
    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText: text,
        outboundText: replyText,
        inferredIntent: 'purchase_intent',
        inferredFunnelStage: 'package_selection',
        inferredObjection: null
    });
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${agentProfile.key}.optInRescueContinuedAt`]: new Date(),
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'package_selection',
                'metadata.lastKnownFunnelStage': 'package_selection'
            }
        }
    ).catch(() => null);
    console.log(`[OPT-IN-RESCUE] cliente respondeu continuar; opcoes enviadas -> ${chatId}`);
    return true;
};

const lastQuestionFromText = (text = '') => {
    const matches = String(text || '').match(/[^?¿]*[?]/g);
    if (!matches || matches.length === 0) return '';
    return matches[matches.length - 1].trim();
};

const lastRecordedAudioFromText = (text = '') => {
    const matches = [...String(text || '').matchAll(/\[ENVIAR_AUDIO_GRAVADO:\s*([a-zA-Z0-9_,-]+)\]/gi)];
    if (!matches.length) return '';
    const names = matches[matches.length - 1][1]
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    return names[names.length - 1] || '';
};

const buildConversationStateMemory = ({
    state,
    agentProfile,
    inboundText,
    outboundText,
    inferredIntent,
    inferredFunnelStage,
    inferredObjection,
    funnelBucket,
    buyerScore,
    sentRecordedAudioNames = []
}) => {
    const previous = (((state.metadata || {}).perAgentMemory || {})[agentProfile.key] || {}).conversationState || {};
    const pendingOrder = (((state.metadata || {}).perAgentMemory || {})[agentProfile.key] || {}).pendingCheckoutOrder || {};
    const lastQuestion = lastQuestionFromText(outboundText) || previous.last_question_sent || '';
    const lastAudio = sentRecordedAudioNames[sentRecordedAudioNames.length - 1] || lastRecordedAudioFromText(outboundText) || previous.last_audio_sent || '';
    const quantity = pendingOrder.quantity || pendingOrder.packageQuantity || pendingOrder.selectedQuantity || previous.quantity || '';
    const total = pendingOrder.total || pendingOrder.totalValue || previous.total || '';
    const stage = inferredFunnelStage || pendingOrder.stage || previous.stage || 'inicio';

    return {
        phone: state.phoneDigits || previous.phone || '',
        name: pendingOrder.name || pendingOrder.customerName || previous.name || '',
        province: pendingOrder.province || previous.province || '',
        city: pendingOrder.city || previous.city || '',
        address: pendingOrder.address || previous.address || '',
        reference: pendingOrder.reference || previous.reference || '',
        agency: pendingOrder.agency || pendingOrder.agencyName || previous.agency || '',
        quantity,
        total,
        profile_type: funnelBucket || inferredIntent || previous.profile_type || '',
        stage,
        buyer_score: buyerScore || previous.buyer_score || '',
        last_audio_sent: lastAudio,
        last_question_sent: lastQuestion,
        last_objection: inferredObjection || previous.last_objection || '',
        conversation_summary: buildConversationSummary({
            customerContext: customerContextFromCountryCode('EC', state.phoneDigits || ''),
            intent: inferredIntent,
            funnelStage: stage,
            lastObjection: inferredObjection,
            latestOrder: null,
            agentProfile
        }) || previous.conversation_summary || '',
        scheduled_date: previous.scheduled_date || '',
        scheduled_reason: previous.scheduled_reason || '',
        do_not_ship_before: Boolean(previous.do_not_ship_before),
        followup_status: previous.followup_status || ''
    };
};

const updateContactStateAgentMemory = async ({
    contactStateId,
    agentProfile,
    inboundText,
    outboundText,
    inferredIntent,
    inferredFunnelStage,
    inferredObjection,
    sentImageKeys = [],
    sentRecordedAudioNames = []
}) => {
    if (!contactStateId) return;

    const state = await ContactState.findById(contactStateId);
    if (!state) return;

    const funnelBucket = funnelBucketForIntent(inferredIntent, inboundText);
    const buyerScore = buyerScoreForIntent(inferredIntent, inboundText);
    const conversationState = buildConversationStateMemory({
        state,
        agentProfile,
        inboundText,
        outboundText,
        inferredIntent,
        inferredFunnelStage,
        inferredObjection,
        funnelBucket,
        buyerScore,
        sentRecordedAudioNames
    });

    state.lastOutboundAt = new Date();
    state.metadata = {
        ...(state.metadata || {}),
        lastKnownIntent: inferredIntent,
        lastKnownFunnelStage: inferredFunnelStage,
        lastKnownFunnelBucket: funnelBucket,
        lastKnownObjection: inferredObjection,
        buyerScore,
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
                lastFunnelBucket: funnelBucket,
                lastObjection: inferredObjection,
                buyerScore,
                conversationState,
                lastQuestionSent: conversationState.last_question_sent,
                lastAudioSent: conversationState.last_audio_sent,
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

const attentiveReaderBotEnabled = () => (
    String(process.env.ATTENTIVE_READER_BOT_ENABLED || 'true').toLowerCase() !== 'false'
);

const attentiveReaderBotMinConfidence = () => {
    const value = Number.parseFloat(String(process.env.ATTENTIVE_READER_BOT_MIN_CONFIDENCE || '0.82'));
    return Number.isFinite(value) ? value : 0.82;
};

const ATTENTIVE_READER_AUTO_CATEGORIES = new Set([
    'vsl_entry_lead',
    'generic_price',
    'prostate_question',
    'ambiguous_agency_address',
    'logistics_missing_city_province',
    'agency_refinement_needed',
    'agency_confirm',
    'agency_options',
    'frustration_care'
]);

const attentiveReaderAudioCategories = new Set([
    'vsl_entry_lead',
    'generic_price',
    'prostate_question'
]);

const attentiveReaderMemoryForCategory = (category = '') => {
    if (category === 'vsl_entry_lead') {
        return { intent: 'vsl_entry_lead', stage: 'initial_vsl_entry_answered' };
    }
    if (category === 'generic_price') {
        return { intent: 'price_check', stage: 'price_promotion_presented' };
    }
    if (category === 'prostate_question') {
        return { intent: 'health_question', stage: 'health_question_answered' };
    }
    if (category === 'agency_confirm') {
        return { intent: 'shipping_info', stage: 'sdr_awaiting_agency_confirmation' };
    }
    if (category === 'agency_options') {
        return { intent: 'shipping_info', stage: 'sdr_awaiting_agency_selection' };
    }
    if (category === 'agency_refinement_needed') {
        return { intent: 'shipping_info', stage: 'sdr_awaiting_agency_query' };
    }
    if (category === 'ambiguous_agency_address' || category === 'logistics_missing_city_province') {
        return { intent: 'shipping_info', stage: 'sdr_awaiting_city_province' };
    }
    if (category === 'frustration_care') {
        return { intent: 'customer_care', stage: 'attention_rescue' };
    }
    return { intent: 'general_question', stage: 'attentive_reader_answered' };
};

const attentiveReaderAudioNamesForItem = (item = {}) => {
    if (item.category === 'vsl_entry_lead') {
        return [getGreetingAudioByTime(new Date(), ECUADOR_GREETING_TIMEZONE)];
    }
    return item.recommendedAudio ? [item.recommendedAudio] : [];
};

const attentiveReaderHistoryFromMemory = ({ history = [], inboundText = '' } = {}) => {
    const converted = (history || []).slice(-20).map((item, index) => {
        const role = String(item.role || '').toLowerCase();
        const assistant = role === 'assistant' || item.isFromMe || item.isBot;
        return {
            _id: item._id || `mem_${index}_${assistant ? 'bot' : 'cliente'}`,
            body: item.body || item.content || '',
            isFromMe: Boolean(assistant),
            isBot: Boolean(assistant),
            createdAt: item.createdAt || item.timestamp || new Date()
        };
    }).filter((item) => item.body);
    converted.push({
        _id: `inline_attentive_${Date.now()}`,
        body: inboundText,
        isFromMe: false,
        isBot: false,
        createdAt: new Date()
    });
    return converted;
};

const shouldSkipAttentiveReaderBot = ({
    agentProfile,
    contactState,
    checkoutOrderData,
    pendingCheckoutOrder,
    pendingCheckoutStage
} = {}) => {
    if (!attentiveReaderBotEnabled()) return true;
    if (agentProfile?.key !== 'vit_power_ec') return true;
    if (contactState?.human?.mode === 'manual') return true;
    if (checkoutOrderData && pendingCheckoutOrder && isCheckoutDataCollectionStage(pendingCheckoutStage)) return true;
    if (pendingCheckoutStage === 'order_closed') return true;
    return false;
};

const maybeHandleAttentiveReaderDirectReply = async ({
    text,
    chatId,
    peerPhone,
    sessionId = null,
    contactState,
    contactStateId,
    agentProfile,
    customerContext,
    customerMemory = {},
    memoryOrder = null,
    checkoutOrderData = null,
    pendingCheckoutOrder = null,
    pendingCheckoutStage = ''
} = {}) => {
    if (shouldSkipAttentiveReaderBot({
        agentProfile,
        contactState,
        checkoutOrderData,
        pendingCheckoutOrder,
        pendingCheckoutStage
    })) {
        return false;
    }

    const item = analyzeAttentiveReader({
        inboundText: text,
        history: attentiveReaderHistoryFromMemory({
            history: customerMemory.history || [],
            inboundText: text
        }),
        contactState,
        latestOrder: memoryOrder
    });
    if (!item || !ATTENTIVE_READER_AUTO_CATEGORIES.has(item.category)) return false;
    if (Number(item.confidence || 0) < attentiveReaderBotMinConfidence()) return false;

    let replyText = String(item.suggestedScript || '').trim();
    replyText = sanitizeSimpleProstateCommercialReply({
        inboundText: text,
        replyText
    });
    if (!replyText) return false;

    let audioSent = false;
    const audioNames = attentiveReaderAudioNamesForItem(item).filter(Boolean);
    const canSendAttentiveAudio = audioNames.length && attentiveReaderAudioCategories.has(item.category);
    if (item.category === 'vsl_entry_lead' && canSendAttentiveAudio) {
        audioSent = await sendFirstApprovedAudioAndRecord({
            jid: chatId,
            countryCode: customerContext.countryCode,
            sessionId,
            peerPhone,
            baseNames: audioNames,
            label: `Leitor Atento ${item.category}`,
            sendOptions: {
                allowExistingDropiOrder: true,
                outboundContext: `attentive_reader_audio_${item.category}`,
                dedupeValue: `attentive_reader_audio|${item.category}|${audioNames.join('|')}`
            }
        });
    }

    const sent = await sendText(chatId, replyText, null, {
        sessionId,
        allowExistingDropiOrder: true,
        outboundContext: `attentive_reader_${item.category}`,
        dedupeValue: `attentive_reader|${item.category}|${normalizeReplyText(replyText).slice(0, 180)}`
    });
    if (!sent) {
        console.log(`[LEITOR-ATENTO] texto bloqueado/dedupe -> ${chatId} | categoria=${item.category}`);
        return true;
    }

    try {
        await Message.create({
            _id: `out_${Date.now()}_attentive_${Math.random().toString(16).slice(2, 8)}`,
            chatId,
            peerPhone,
            from: 'bot',
            to: chatId,
            body: replyText,
            type: 'chat',
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (error) {
        if (error.code !== 11000) console.warn('[LEITOR-ATENTO] falha ao registrar texto:', error.message);
    }

    if (item.category !== 'vsl_entry_lead' && canSendAttentiveAudio) {
        audioSent = await sendFirstApprovedAudioAndRecord({
            jid: chatId,
            countryCode: customerContext.countryCode,
            sessionId,
            peerPhone,
            baseNames: audioNames,
            label: `Leitor Atento ${item.category}`,
            sendOptions: {
                allowExistingDropiOrder: true,
                outboundContext: `attentive_reader_audio_${item.category}`,
                dedupeValue: `attentive_reader_audio|${item.category}|${audioNames.join('|')}`
            }
        });
    }

    const memory = attentiveReaderMemoryForCategory(item.category);
    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText: text,
        outboundText: [
            replyText,
            audioSent ? `[AUDIO] ${audioNames.join('|')}` : ''
        ].filter(Boolean).join('\n'),
        inferredIntent: memory.intent,
        inferredFunnelStage: memory.stage,
        inferredObjection: (item.riskFlags || []).join(', ') || null,
        sentRecordedAudioNames: audioSent ? audioNames : []
    });

    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${agentProfile.key}.attentiveReaderLastCategory`]: item.category,
                [`metadata.perAgentMemory.${agentProfile.key}.attentiveReaderLastConfidence`]: item.confidence,
                [`metadata.perAgentMemory.${agentProfile.key}.attentiveReaderLastAt`]: new Date(),
                [`metadata.perAgentMemory.${agentProfile.key}.attentiveReaderBotEnabled`]: true,
                ...(item.category === 'agency_options' && Number.isFinite(Number(item.context?.agencyOptionsPage))
                    ? { [`metadata.perAgentMemory.${agentProfile.key}.agencyOptionsPage`]: Number(item.context.agencyOptionsPage) }
                    : {})
            }
        }
    ).catch(() => null);

    console.log(`[LEITOR-ATENTO] resposta direta -> ${chatId} | categoria=${item.category} | conf=${item.confidence} | audio=${audioSent}`);
    return true;
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
    if (isPrincipalSdrStage(pendingCheckoutStage)) return false;
    if (isHomeDeliveryChoice(text)) return false;
    const agencyDetails = parseAgencyDetailsMessage(text);
    const hasAgencyLookup = Boolean(agencyDetails.agencyValidated || agencyDetails.agencyOptions?.length);
    const isAgencyCorrectionAfterInterrupt = pendingCheckoutStage === 'awaiting_package_choice_after_agency' && hasAgencyLookup;
    if (!isAgencyDeliveryChoice(text) && !isAgencyCorrectionAfterInterrupt) return false;
    if ([
        'awaiting_agency_selection',
        'awaiting_agency_selection_interrupt',
        'awaiting_customer_name',
        'awaiting_agency_confirmation'
    ].includes(pendingCheckoutStage) || isCheckoutDataCollectionStage(pendingCheckoutStage)) {
        return false;
    }

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
        'Le leo. Para no perder su pedido, seguimos aqui:',
        'Claro, le entiendo. Dejemos esta parte lista:',
        'Sigo con usted. Para avanzar sin error:',
        'Gracias por escribirme. Retomamos el pedido aqui:',
        'Si, claro. Vamos paso a paso para cerrar bien el envio:'
    ];
    return variants[Math.floor(Math.random() * variants.length)];
};

const pendingCheckoutFallbackText = (stage, pendingCheckoutOrder = {}) => {
    const bridge = checkoutBridgeLine();
    if (isPrincipalSdrStage(stage)) {
        if (stage === 'sdr_awaiting_name') return principalSdrNameRequestText();
        if (stage === 'sdr_awaiting_city') return bridge + '\n' + principalSdrCityRequestText(pendingCheckoutOrder);
        if (stage === 'sdr_awaiting_province') return bridge + '\n' + principalSdrProvinceRequestText(pendingCheckoutOrder);
        if (stage === 'sdr_awaiting_city_province') return bridge + '\n' + principalSdrCityRequestText(pendingCheckoutOrder);
        if (stage === 'sdr_awaiting_quantity') return bridge + '\n¿Cuántos frascos desea reservar hoy? 1, 3 o 6.';
        if (stage === 'sdr_awaiting_value_confirmation') return bridge + '\n¿Está bien para usted reservar esa promoción hoy?';
        if (stage === 'sdr_awaiting_delivery_mode') return bridge + '\n' + agencyFirstDeliveryQuestionText();
        if (stage === 'sdr_awaiting_agency_query') return bridge + '\nEnvíeme su sector o una agencia cercana para buscar la mejor Servientrega.';
        if (stage === 'sdr_awaiting_agency_selection') {
            if ((pendingCheckoutOrder.agencyOptions || []).length === 1) {
                return bridge + '\n' + principalSdrAgencyListText(pendingCheckoutOrder.agencyOptions || [], {
                    page: pendingCheckoutOrder.agencyOptionsPage || 0
                });
            }
            return bridge + '\nResponda con el número de la agencia correcta.';
        }
        if (stage === 'sdr_awaiting_home_address') return bridge + '\nEnvíeme dirección completa, barrio o sector y, si tiene, una referencia cercana. Punto de referencia para la entrega a domicilio.';
        if (stage === 'sdr_awaiting_final_confirmation') return bridge + '\nRevise los datos y responda SI o CONFIRMO para autorizar el despacho.';
        if (stage === 'sdr_scheduled_followup') return bridge + '\n¿Qué día desea que le escribamos nuevamente?';
    }
    if (stage === 'awaiting_delivery_mode') {
        return `${bridge}\nPrefiere retirar en una agencia Servientrega o recibir en su domicilio? Si es agencia, puede escribir por ejemplo: agencia Cayambe.`;
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
        return `${bridge}\nPara ubicar bien la agencia, me envia ciudad, provincia y el nombre o direccion de la Servientrega donde desea retirar.`;
    }
    if (stage === 'awaiting_customer_data') {
        const missingKeys = missingCheckoutFieldKeys(pendingCheckoutOrder);
        return `${bridge}\n${buildMissingCheckoutFieldText({ parsedOrder: pendingCheckoutOrder, missing: missingCheckoutFields(pendingCheckoutOrder), missingKeys })}`;
    }
    if ([
        'awaiting_customer_name_data',
        'awaiting_city_province',
        'awaiting_home_address',
        'awaiting_reference',
        'awaiting_quantity_data'
    ].includes(stage)) {
        const missingKeys = missingCheckoutFieldKeys(pendingCheckoutOrder);
        return `${bridge}\n${buildMissingCheckoutFieldText({ parsedOrder: pendingCheckoutOrder, missing: missingCheckoutFields(pendingCheckoutOrder), missingKeys })}`;
    }
    if (stage === 'awaiting_agency_confirmation') {
        return `${bridge}\nRevise por favor si los datos estan correctos. Si todo esta bien, preparo el envio hoy mismo.`;
    }
    return '';
};


const strictVitalismenFunnelEnabled = (agentProfile) => agentProfile?.key === 'vit_power_ec';

const strictVitalismenFallbackText = ({ pendingCheckoutStage = '', pendingCheckoutOrder = {}, agentMemorySnapshot = {} } = {}) => {
    if (pendingCheckoutStage) {
        const stageFallback = pendingCheckoutFallbackText(pendingCheckoutStage, pendingCheckoutOrder || {});
        if (stageFallback) return stageFallback;
    }

    const stage = String(
        pendingCheckoutStage
        || pendingCheckoutOrder?.stage
        || pendingCheckoutOrder?.funnelStage
        || agentMemorySnapshot?.principalSdrStage
        || agentMemorySnapshot?.lastFunnelStage
        || ''
    );

    if (hasAnyInitialProductPresentation(agentMemorySnapshot) || stage === 'initial_product_presentation') {
        return 'Señor, para seguir sin error, indíqueme cuántos frascos desea reservar hoy: 1, 3 o 6.';
    }
    if (stage === 'package_selection') {
        return 'Perfecto. ¿Está bien para usted reservar esa promoción hoy?';
    }
    if (agentMemorySnapshot?.selectedQuantity) {
        return 'Perfecto. Para continuar con su pedido, me confirma su nombre completo por favor.';
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
    const testResetAt = Math.max(
        metadata.testPhoneResetAt ? new Date(metadata.testPhoneResetAt).getTime() : 0,
        metadata.cleanTestResetAt ? new Date(metadata.cleanTestResetAt).getTime() : 0,
        agentMemory.resetAt ? new Date(agentMemory.resetAt).getTime() : 0
    );
    const explicitClosed = agentMemory.lastFunnelStage === 'order_closed'
        || agentMemory.principalSdrStage === 'order_closed'
        || metadata.lastKnownFunnelStage === 'order_closed'
        || metadata.orderStatus === 'PEDIDO_CONFIRMADO'
        || metadata.automationPausedReason === 'order_closed_human_handoff'
        || agentMemory.humanHandoffReason === 'order_closed_human_handoff'
        || customerProfile?.conversationMemory?.funnelStage === 'order_closed'
        || Boolean(closedAt);
    if (isNoDropiBotTestPhone(contactState?.phoneDigits) && testResetAt && (!closedAt || testResetAt >= closedAt)) {
        return { closed: false, closedAt: 0, agentMemory, metadata };
    }
    if (metadata.botTestEnabled && metadata.noDropiEver && !explicitClosed) {
        return { closed: false, closedAt: 0, agentMemory, metadata };
    }
    const closed = explicitClosed
        || ['confirmed', 'delivered', 'picked_up', 'pickedUp'].includes(String(customerProfile?.status || ''))
        || hasRecentOrderClosedThankYou(history);
    return { closed, closedAt, agentMemory, metadata };
};

const isLogisticsAfterOrderText = (text) => {
    const body = normalizeForDecision(text);
    return /(guia|pedido|estado|estatus|status|retirar|retiro|agencia|servientrega|cuando llega|cuando retiro|listo para retirar|ya esta)/i.test(body);
};

const findLatestShipmentForPostOrder = async ({ peerPhone = '', contactState = null } = {}) => {
    const tails = [
        peerPhone,
        contactState?.phoneDigits,
        contactState?.metadata?.lastSenderPn,
        contactState?.metadata?.customerPhoneDigits
    ]
        .map(digitsOnly)
        .filter(Boolean)
        .flatMap((digits) => [
            digits,
            digits.length >= 10 ? digits.slice(-10) : '',
            digits.length >= 9 ? digits.slice(-9) : ''
        ])
        .filter((digits) => digits.length >= 8);
    const uniqueTails = [...new Set(tails)];
    if (!uniqueTails.length) return null;
    return Shipment.findOne({
        country: 'EC',
        $or: uniqueTails.map((tail) => ({ 'client.phone': { $regex: `${tail}$` } }))
    }).sort({ updatedAt: -1, createdAt: -1 }).lean().catch(() => null);
};

const inboundDropiStatusSyncEnabled = () => (
    String(process.env.DROPPI_INBOUND_STATUS_SYNC_ENABLED || 'true').toLowerCase() !== 'false'
);

const inboundDropiPhoneLookupEnabled = () => (
    String(process.env.DROPPI_INBOUND_PHONE_LOOKUP_ENABLED || 'true').toLowerCase() !== 'false'
);

const shipmentHasDropiLookupReference = (shipment = null) => Boolean(
    shipment?.logistics?.trackingNumber
    || shipment?.automation?.submittedToDroppiAt
    || shipment?.raw?.manualDropiOrderId
    || shipment?.raw?.latestDroppiPayload?.dropiOrderId
    || shipment?.raw?.droppiOrder?.id
    || shipment?.raw?.droppiOrder?.objects?.id
);

const dropiLookupTermsForShipment = (shipment = null) => {
    const digits = digitsOnly(shipment?.client?.phone || '');
    return [...new Set([
        digits,
        digits.startsWith('593') ? digits.slice(3) : '',
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : ''
    ].filter((term) => term && term.length >= 8))];
};

const rowMatchesShipmentPhone = (row = {}, shipment = null) => {
    const rowDigits = digitsOnly(row.phone || '');
    const terms = dropiLookupTermsForShipment(shipment);
    return Boolean(rowDigits && terms.some((term) => rowDigits.endsWith(term) || term.endsWith(rowDigits)));
};

const syncShipmentFromDropiPhoneLookup = async (shipment = null) => {
    if (!shipment || !inboundDropiPhoneLookupEnabled()) return null;
    const terms = dropiLookupTermsForShipment(shipment);
    if (!terms.length) return null;
    const result = await searchDroppiEcuadorOrdersFromPanel({ terms, limit: 5 });
    if (!result?.ok || !Array.isArray(result.rows) || !result.rows.length) return null;
    const row = result.rows.find((item) => rowMatchesShipmentPhone(item, shipment)) || result.rows[0];
    if (!row) return null;
    const synced = await upsertDroppiEcuadorShipment({
        orderId: shipment.orderId,
        productName: row.productName || shipment.productName || 'Vit Power',
        clientName: row.clientName || shipment.client?.name || '',
        phone: row.phone || shipment.client?.phone || '',
        address: row.address || shipment.client?.address || '',
        city: row.city || shipment.client?.city || '',
        province: row.province || shipment.client?.province || '',
        status: row.status || shipment.logistics?.status || 'created',
        trackingNumber: row.trackingNumber || shipment.logistics?.trackingNumber || '',
        distributionCompany: row.distributionCompany || shipment.logistics?.distributionCompany || shipment.logistics?.chosenCarrier || '',
        chosenCarrier: row.distributionCompany || shipment.logistics?.chosenCarrier || '',
        agencyPickup: row.agencyPickup ?? shipment.logistics?.agencyPickup,
        agencyName: row.agencyName || shipment.logistics?.agencyName || '',
        sessionId: shipment.automation?.sessionId || '',
        dropiOrderId: row.dropiOrderId || '',
        detail: `Sincronizacao sob demanda por telefone no inbound WhatsApp; termo(s): ${terms.join(', ')}`
    });
    return synced?.toObject ? synced.toObject() : synced;
};

const refreshPostOrderShipmentFromDropi = async ({ shipment = null, text = '' } = {}) => {
    if (!shipment || !inboundDropiStatusSyncEnabled()) return shipment;
    const currentStatus = postOrderShipmentStatus(shipment);
    if (currentStatus.released || currentStatus.returned) return shipment;
    if (!isLogisticsAfterOrderText(text) && !isExplicitNewPurchaseAfterClosedOrder(text)) return shipment;
    if (!shipmentHasDropiLookupReference(shipment)) {
        try {
            const syncedByPhone = await syncShipmentFromDropiPhoneLookup(shipment);
            return syncedByPhone || shipment;
        } catch (error) {
            console.warn(`[DROPI-INBOUND] busca por telefone falhou -> order=${shipment.orderId || ''}: ${error.message || error}`);
            return shipment;
        }
    }

    try {
        const result = await syncDroppiEcuadorFromPanel({ shipment });
        if (!result?.ok) {
            console.warn(`[DROPI-INBOUND] sync sem atualizacao -> order=${shipment.orderId || ''} reason=${result?.reason || ''}`);
            return shipment;
        }
        const refreshed = result.shipment?.toObject ? result.shipment.toObject() : result.shipment;
        return refreshed || shipment;
    } catch (error) {
        console.warn(`[DROPI-INBOUND] sync falhou -> order=${shipment.orderId || ''}: ${error.message || error}`);
        return shipment;
    }
};

const postOrderShipmentStatus = (shipment = null) => {
    if (!shipment) {
        return { released: false, returned: false, active: true, status: 'confirmed_without_shipment' };
    }
    const status = String(shipment.logistics?.status || '').toUpperCase();
    const released = Boolean(
        shipment.outcomes?.pickedUp
        || shipment.outcomes?.delivered
        || shipment.automation?.deliveredConfirmedAt
        || status === 'ENTREGADO'
    );
    const returned = Boolean(
        shipment.outcomes?.returned
        || shipment.outcomes?.prepaidOnly
        || shipment.automation?.returnedNotifiedAt
        || status === 'DEVUELTO'
    );
    return {
        released,
        returned,
        active: !released && !returned,
        status: status || 'shipment_active',
        orderId: shipment.orderId || '',
        trackingNumber: shipment.logistics?.trackingNumber || '',
        agencyPickup: Boolean(shipment.logistics?.agencyPickup),
        agencyName: shipment.logistics?.agencyName || '',
        carrier: shipment.logistics?.distributionCompany || shipment.logistics?.chosenCarrier || shipment.logistics?.preferredCarrier || '',
        clientCity: shipment.client?.city || '',
        clientProvince: shipment.client?.province || ''
    };
};

const humanShipmentStatusLabel = (status = '') => {
    const value = String(status || '').toUpperCase();
    if (value === 'READY_FOR_PICKUP') return 'listo para retirar';
    if (value === 'GUIA_GENERADA') return 'guia generada';
    if (['EN_RUTA', 'EN_REPARTO', 'EN_DESPACHO', 'EN_BODEGA_TRANSPORTADORA', 'MERCANCIA_RECOGIDA'].includes(value)) return 'en camino';
    if (value === 'ENTREGADO') return 'entregado/retirado';
    if (value === 'DEVUELTO') return 'devuelto';
    return value ? value.toLowerCase().replace(/_/g, ' ') : 'registrado';
};

const buildActiveShipmentStatusText = (shipmentStatus = {}) => {
    const guide = shipmentStatus.trackingNumber ? `\nGuia: ${shipmentStatus.trackingNumber}` : '';
    const carrier = shipmentStatus.carrier ? `\nTransportadora: ${shipmentStatus.carrier}` : '';
    const agency = shipmentStatus.agencyName ? `\nAgencia: ${shipmentStatus.agencyName}` : '';
    const status = String(shipmentStatus.status || '').toUpperCase();
    if (status === 'READY_FOR_PICKUP') {
        return [
            'Señor, su pedido ya aparece listo para retirar.',
            `${guide}${carrier}${agency}`.trim(),
            'Por favor acerquese a la agencia con su documento. Cuando lo retire, me avisa por aqui para liberar el bono y continuar el seguimiento.'
        ].filter(Boolean).join('\n\n');
    }
    if (shipmentStatus.trackingNumber) {
        return [
            `Señor, su pedido ya tiene guia y figura ${humanShipmentStatusLabel(status)}.`,
            `${guide}${carrier}${agency}`.trim(),
            shipmentStatus.agencyPickup
                ? 'Si Servientrega lo marca listo para retirar, puede acercarse a la agencia con su documento.'
                : 'Le voy acompañando por aqui con cualquier novedad de entrega.'
        ].filter(Boolean).join('\n\n');
    }
    return 'Si, su pedido ya quedo registrado. Apenas tenga la guia o novedad de Servientrega, le aviso por aqui.';
};

const buildReleasedShipmentRepurchaseText = () => (
    'Señor, este pedido ya aparece entregado o retirado. Si desea continuar el tratamiento y adquirir otros frascos, puedo abrir una recompra nueva usando sus datos registrados. Solo confirmeme si desea 1, 3 o 6 frascos.'
);

const buildRepeatPurchaseCheckoutOrder = ({ shipment = null, peerPhone = '' } = {}) => {
    const client = shipment?.client || {};
    const logistics = shipment?.logistics || {};
    const agencyPickup = Boolean(
        logistics.agencyPickup
        || /agencia|servientrega|retiro|retirar/i.test([
            logistics.shippingType,
            logistics.agencyName,
            client.address,
            client.reference
        ].filter(Boolean).join(' '))
    );

    return {
        name: client.name || '',
        phone: client.phone || peerPhone || '',
        province: client.province || '',
        city: client.city || '',
        address: agencyPickup
            ? (logistics.agencyName || logistics.warehouse || client.address || '')
            : (client.address || ''),
        reference: agencyPickup
            ? (logistics.agencyName || logistics.chosenCarrier || client.reference || '')
            : (client.reference || ''),
        deliveryMode: agencyPickup ? 'agency' : 'home',
        agencyName: agencyPickup ? (logistics.agencyName || '') : '',
        agencyAddress: agencyPickup ? (client.address || logistics.warehouse || '') : '',
        agencyValidated: Boolean(agencyPickup && logistics.agencyName),
        previousOrderId: shipment?.orderId || '',
        previousTrackingNumber: logistics.trackingNumber || '',
        source: 'repeat_purchase_after_delivered',
        stage: 'awaiting_quantity_data',
        funnelStage: 'awaiting_quantity_data',
        conversationSummary: 'Cliente voltou apos entrega/retirada confirmada. Historico preservado; solicitar quantidade e confirmar dados existentes.'
    };
};

const repeatPurchaseQuantityPromptText = () => {
    const variants = [
        'Señor, este pedido ya aparece entregado o retirado. Si desea continuar el tratamiento y adquirir otros frascos, puedo abrir una recompra nueva usando sus datos registrados. Solo confirmeme si desea 1, 3 o 6 frascos.',
        'Perfecto, señor. Como el pedido anterior ya figura retirado/entregado, abrimos una recompra nueva sin repetir todos los datos. Confirmeme por favor si desea 1, 3 o 6 frascos.',
        'Con gusto, señor. El pedido anterior queda como historico; para continuar el tratamiento le abro una recompra nueva. Digame si desea 1, 3 o 6 frascos.'
    ];
    return variants[Math.floor(Math.random() * variants.length)];
};

const startRepeatPurchaseAfterReleasedShipment = async ({
    text,
    chatId,
    peerPhone,
    sessionId = null,
    contactStateId = null,
    agentProfile,
    customerContext,
    shipment
}) => {
    const pendingOrder = buildRepeatPurchaseCheckoutOrder({ shipment, peerPhone });
    const replyText = repeatPurchaseQuantityPromptText();
    await savePendingCheckoutOrderMemory({
        contactStateId,
        agentProfile,
        parsedOrder: pendingOrder,
        stage: 'awaiting_quantity_data',
        orderId: null
    });
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                'metadata.customerDraft': {
                    name: pendingOrder.name || '',
                    phone: pendingOrder.phone || peerPhone || '',
                    province: pendingOrder.province || '',
                    city: pendingOrder.city || '',
                    address: pendingOrder.address || '',
                    reference: pendingOrder.reference || '',
                    country: customerContext.countryCode || 'EC',
                    status: 'novo',
                    quantity: '',
                    total: '',
                    orderId: '',
                    previousOrderId: pendingOrder.previousOrderId || '',
                    entryReason: 'repeat_purchase_after_delivered',
                    updatedAt: new Date().toISOString()
                },
                'metadata.lastKnownFunnelStage': 'awaiting_quantity_data'
            }
        }
    ).catch(() => null);
    const sent = await sendText(chatId, replyText, null, {
        sessionId,
        allowExistingDropiOrder: true,
        outboundContext: 'repeat_purchase_quantity_prompt',
        dedupeValue: `repeat_purchase_quantity_prompt|${shipment?.orderId || digitsOnly(peerPhone || chatId)}`
    });
    if (!sent) {
        await ContactState.updateOne(
            { _id: contactStateId },
            {
                $set: {
                    [`metadata.perAgentMemory.${agentProfile.key}.repeatPurchasePromptBlockedAt`]: new Date(),
                    [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'awaiting_quantity_data',
                    'metadata.lastKnownFunnelStage': 'awaiting_quantity_data'
                }
            }
        ).catch(() => null);
        console.log(`[RECOMPRA] Prompt de recompra nao enviado, mas etapa preservada para evitar reinicio -> ${chatId}`);
        return true;
    }

    try {
        await Message.create({
            _id: `out_${Date.now()}_repeat_purchase_quantity`,
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
        inferredIntent: 'repeat_purchase',
        inferredFunnelStage: 'awaiting_quantity_data',
        inferredObjection: null
    });
    console.log(`[RECOMPRA] Cliente entregue/retirado liberado para novo pedido sem apagar historico -> ${chatId} | pedidoAnterior=${shipment?.orderId || ''}`);
    return true;
};

const isPostSaleHowToUseQuestion = (text = '') => {
    const body = normalizeForDecision(text);
    if (!body) return false;
    const asksUse = /\b(como|c[oó]mo|cuando|cu[aá]ndo|cuantas|cu[aá]ntas|dosis|tomar|toma|tomarlo|tomarlo|uso|usar|despues de comer|despu[eé]s de comer|antes de comer|en ayunas|cuantas veces|cu[aá]ntas veces|cada cuanto|cada cu[aá]nto)\b/i.test(body)
        && /\b(toma|tomar|uso|usar|dosis|veces|comer|ayunas|frasco|producto|vit power|esto)\b/i.test(body);
    const saysReceived = /\b(ya retire|ya retir[eé]|ya compre|ya compr[eé]|ya me llego|ya llego|ya lo tengo|ya tengo|me llego|lo retire|retire el producto|recibi|recib[ií])\b/i.test(body);
    return asksUse || (saysReceived && /\b(como|c[oó]mo|toma|tomar|uso|usar|dosis)\b/i.test(body));
};

const postSaleHowToUseText = (text = '') => {
    const body = normalizeForDecision(text);
    const asksTiming = /\b(cuando|cu[aá]ndo|resultado|efecto|tiempo|temporal|por cuanto tiempo|por cu[aá]nto tiempo)\b/i.test(body);
    const base = 'Claro, señor. Le ayudo con el uso de su Vit Power. Le envío la orientación para que lo revise con calma.';
    const close = 'Su pedido sigue cerrado; no voy a abrir otro pedido ahora. Cualquier duda de uso me escribe por aquí.';
    return asksTiming
        ? `${base}\n\nTambién le envío una explicación corta sobre el tiempo de resultado, porque depende de cada organismo y de la constancia.\n\n${close}`
        : `${base}\n\n${close}`;
};

const sendPostSaleHowToUseSupport = async ({
    text,
    chatId,
    peerPhone,
    sessionId,
    contactStateId,
    agentProfile,
    customerContext,
    shipmentStatus = {}
}) => {
    const replyText = postSaleHowToUseText(text);
    const sent = await sendText(chatId, replyText, null, { sessionId });
    const howToUseSent = await sendFirstApprovedAudioAndRecord({
        jid: chatId,
        countryCode: customerContext.countryCode,
        sessionId,
        peerPhone,
        baseNames: ['COMO_SE_TOMA_VIT_POWER', 'COMO_TOMAR_VIT_POWER_SEM_REFERENCIA_QUANTIDADE_LITRO'],
        label: 'pos-venda como tomar',
        sendOptions: {
            allowExistingDropiOrder: true,
            outboundContext: 'post_sale_how_to_use'
        }
    });
    const shouldSendResultTime = /\b(cuando|cu[aá]ndo|resultado|efecto|tiempo|temporal|por cuanto tiempo|por cu[aá]nto tiempo)\b/i.test(normalizeForDecision(text));
    const resultTimeSent = shouldSendResultTime
        ? await sendFirstApprovedAudioAndRecord({
            jid: chatId,
            countryCode: customerContext.countryCode,
            sessionId,
            peerPhone,
            baseNames: ['TEMPO_RESULTADO_VIT_POWER', 'TRATAMENTO_CONTINUA_NAO_EFEITO_IMEDIATO'],
            label: 'pos-venda tempo resultado',
            sendOptions: {
                allowExistingDropiOrder: true,
                outboundContext: 'post_sale_result_time'
            }
        })
        : false;

    if (sent) {
        try {
            await Message.create({
                _id: `out_${Date.now()}_post_sale_how_to_use`,
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
    }

    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText: text,
        outboundText: [
            replyText,
            howToUseSent ? '[AUDIO] COMO_SE_TOMA_VIT_POWER' : '',
            resultTimeSent ? '[AUDIO] TEMPO_RESULTADO_VIT_POWER' : ''
        ].filter(Boolean).join('\n'),
        inferredIntent: 'post_sale_how_to_use',
        inferredFunnelStage: 'order_closed',
        inferredObjection: null
    });
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${agentProfile.key}.postOrderHowToUseSentAt`]: new Date(),
                [`metadata.perAgentMemory.${agentProfile.key}.postOrderHowToUseAudioSent`]: howToUseSent,
                [`metadata.perAgentMemory.${agentProfile.key}.postOrderResultTimeAudioSent`]: resultTimeSent,
                [`metadata.perAgentMemory.${agentProfile.key}.lastPostOrderShipmentStatus`]: shipmentStatus.status || '',
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'order_closed',
                [`metadata.perAgentMemory.${agentProfile.key}.postOrderNoResumeUntilPickup`]: true,
                'metadata.lastKnownFunnelStage': 'order_closed'
            },
            $unset: {
                [`metadata.perAgentMemory.${agentProfile.key}.pendingCheckoutOrder`]: ''
            }
        }
    ).catch(() => null);

    console.log(`[POS-VENDA] Como tomar tratado sem reabrir funil -> ${chatId} | audioUso=${howToUseSent} | audioTempo=${resultTimeSent}`);
    return true;
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
    customerContext,
    sessionId = null
}) => {
    if (agentProfile?.key !== 'vit_power_ec') return false;

    const { closed, agentMemory } = hasOrderClosedContext({
        contactState,
        agentProfile,
        history,
        customerProfile
    });
    if (!closed) return false;

    let shipment = await findLatestShipmentForPostOrder({ peerPhone, contactState });
    shipment = await refreshPostOrderShipmentFromDropi({ shipment, text });
    const shipmentStatus = postOrderShipmentStatus(shipment);
    const explicitNewPurchase = isExplicitNewPurchaseAfterClosedOrder(text);
    const deliveryMode = String(agentMemory.orderClosedDeliveryMode || '').toLowerCase();

    if (isPostSaleHowToUseQuestion(text)) {
        return sendPostSaleHowToUseSupport({
            text,
            chatId,
            peerPhone,
            sessionId,
            contactStateId,
            agentProfile,
            customerContext,
            shipmentStatus
        });
    }

    if (shipmentStatus.released && (explicitNewPurchase || isLogisticsAfterOrderText(text))) {
        await ContactState.updateOne(
            { _id: contactStateId },
            {
                $set: {
                    [`metadata.perAgentMemory.${agentProfile.key}.postOrderReleasedForNewOrderAt`]: new Date(),
                    [`metadata.perAgentMemory.${agentProfile.key}.lastPostOrderShipmentStatus`]: shipmentStatus.status,
                    'metadata.lastKnownFunnelStage': 'order_closed'
                }
            }
        ).catch(() => null);
        console.log(`[FUNIL] Pos-fechamento liberado para nova compra apos retirada/entrega -> ${chatId}`);
        return startRepeatPurchaseAfterReleasedShipment({
            text,
            chatId,
            peerPhone,
            sessionId,
            contactStateId,
            agentProfile,
            customerContext,
            shipment
        });
    }

    const lastCourtesyAt = agentMemory.postOrderCourtesySentAt
        ? new Date(agentMemory.postOrderCourtesySentAt).getTime()
        : 0;
    const recentlyAnswered = lastCourtesyAt && Date.now() - lastCourtesyAt < 10 * 60 * 1000;
    const shouldReply = shipmentStatus.returned
        || explicitNewPurchase
        || isLogisticsAfterOrderText(text)
        || isPostOrderCourtesyText(text)
        || !recentlyAnswered;

    if (!shouldReply) {
        if (!contactStateId) {
            console.log(`[FUNIL] Trava pos-fechamento manteve memoria sem nova resposta -> ${chatId}`);
            return true;
        }
        await ContactState.updateOne(
            { _id: contactStateId },
            {
                $set: {
                    [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'order_closed',
                    [`metadata.perAgentMemory.${agentProfile.key}.lastPostOrderBlockedAt`]: new Date(),
                    'metadata.lastKnownFunnelStage': 'order_closed'
                }
            }
        );
        console.log(`[FUNIL] Trava pos-fechamento manteve memoria sem nova resposta -> ${chatId}`);
        return true;
    }

    const replyText = shipmentStatus.returned
        ? 'Señor, ese pedido figura devuelto o no retirado. Por seguridad el sistema bloquea nuevos envíos contra entrega para este número. Un asesor puede revisar el caso si necesita.'
        : shipmentStatus.released
            ? buildReleasedShipmentRepurchaseText()
        : explicitNewPurchase && (deliveryMode === 'agency' || shipmentStatus.active)
            ? buildActiveShipmentStatusText(shipmentStatus)
            : isLogisticsAfterOrderText(text)
        ? buildActiveShipmentStatusText(shipmentStatus)
        : isPostOrderCourtesyText(text)
            ? 'Con gusto. Su pedido ya quedo registrado. Yo le acompano por aqui con la guia y cualquier novedad.'
            : 'Con gusto, señor. Su pedido ya está registrado; puedo ayudarle con dudas del pedido, guía o retiro, pero no abro otro cierre hasta que retire en agencia.';
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
        const postOrderSet = {
            [`metadata.perAgentMemory.${agentProfile.key}.postOrderCourtesySentAt`]: new Date(),
            [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'order_closed',
            [`metadata.perAgentMemory.${agentProfile.key}.postOrderNoResumeUntilPickup`]: true,
            [`metadata.perAgentMemory.${agentProfile.key}.lastPostOrderShipmentStatus`]: shipmentStatus.status,
            'metadata.lastKnownFunnelStage': 'order_closed'
        };
        if (shipmentStatus.returned) {
            postOrderSet[`metadata.perAgentMemory.${agentProfile.key}.postOrderBlockedReason`] = 'returned_not_picked_up';
            postOrderSet[`metadata.perAgentMemory.${agentProfile.key}.postOrderBlockedAt`] = new Date();
            postOrderSet['metadata.customerBlockedReason'] = 'returned_not_picked_up';
            postOrderSet['metadata.customerBlockedAt'] = new Date();
        }
        await ContactState.updateOne(
            { _id: contactStateId },
            {
                $set: postOrderSet,
                $unset: {
                    [`metadata.perAgentMemory.${agentProfile.key}.pendingCheckoutOrder`]: ''
                }
            }
        );
    }
    console.log(`[FUNIL] Trava pos-fechamento tratada; funil nao reiniciado -> ${chatId} | sent=${sent}`);
    return true;
};

const INBOUND_NO_RESPONSE_MARKER = /^\[ENTRADA_SEM_RESPOSTA:([a-z0-9_:-]+)\]$/i;
const unansweredDormantDays = () => {
    const days = Number.parseInt(String(process.env.VIT_POWER_UNANSWERED_DORMANT_DAYS || '3'), 10);
    return Math.max(1, Number.isFinite(days) ? days : 3);
};

const detectUnansweredInboundKind = ({ text = '', msg = {} } = {}) => {
    const marker = String(text || '').trim().match(INBOUND_NO_RESPONSE_MARKER);
    if (marker?.[1]) return marker[1];
    const body = normalizeFieldLabel(text);
    const hasOrganicSocialLink = /\btiktok\.com\/\S+|\bvt\.tiktok\.com\/\S+|\bfacebook\.com\/\S+|\binstagram\.com\/\S+/i.test(String(text || ''));
    if (hasOrganicSocialLink && body.length <= 280) return 'organic_social_link';
    const hasLink = /\bhttps?:\/\/\S+|\bwww\.\S+|\bwa\.me\/\S+|\bt\.me\/\S+|\btiktok\.com\/\S+|\bfacebook\.com\/\S+|\binstagram\.com\/\S+/i.test(String(text || ''));
    if (hasLink && body.length <= 280) return 'link';
    if (msg.inboundFallbackReason) return String(msg.inboundFallbackReason);
    if (msg.inboundWasLid && !body) return 'lid';
    return '';
};

const previousInboundMessageForContact = async ({ chatId, peerPhone, currentMessageId }) => {
    const tail = digitsOnly(peerPhone).slice(-8);
    const or = [{ chatId }];
    if (tail) or.push({ peerPhone: { $regex: `${tail}$` } });
    return Message.findOne({
        $or: or,
        isFromMe: false,
        isBot: false,
        ...(currentMessageId ? { _id: { $ne: currentMessageId } } : {})
    }).sort({ timestamp: -1, createdAt: -1 }).lean().catch(() => null);
};

const latestOrderForContact = async ({ peerPhone, chatId }) => {
    const tails = [digitsOnly(peerPhone), digitsOnly(chatId)]
        .filter(Boolean)
        .flatMap((digits) => [digits, digits.slice(-8), digits.slice(-10), digits.slice(-11)])
        .filter((digits) => digits.length >= 7);
    const uniqueTails = [...new Set(tails)];
    if (!uniqueTails.length) return null;
    return Order.findOne({
        $or: uniqueTails.map((tail) => ({ 'customer.phone': { $regex: `${tail}$` } }))
    }).sort({ updatedAt: -1, createdAt: -1 }).lean().catch(() => null);
};

const hasRecentPurchaseIntentForContact = async ({ peerPhone, chatId, currentMessageId }) => {
    const tail = digitsOnly(peerPhone).slice(-8);
    const or = [{ chatId }];
    if (tail) or.push({ peerPhone: { $regex: `${tail}$` } });
    const recentMessages = await Message.find({
        $or: or,
        ...(currentMessageId ? { _id: { $ne: currentMessageId } } : {})
    }).sort({ timestamp: -1, createdAt: -1 }).limit(30).lean().catch(() => []);
    return recentMessages.some((message) => {
        const body = normalizeFieldLabel(message.body || '');
        return /\b(quiero|deseo|comprar|llevar|pedido|ordenar|envie|env[ií]e|mande|mandeme|confirmo|confirmado|listo|precio|valor|promo|frasco|frascos|botella|botellas|agencia|domicilio|direccion|direcci[oó]n|ciudad|provincia)\b/i.test(body)
            || /\b(todo correcto|confirmar tu pedido|pedido confirmado|su pedido|cantidad|total)\b/i.test(body);
    });
};

const hasPurchaseMemoryForUnansweredInbound = ({ latestOrder = null, agentMemory = {} } = {}) => {
    const orderStatus = String(latestOrder?.status || '').toLowerCase();
    if (orderStatus && orderStatus !== 'cancelled') return true;
    return Boolean(
        agentMemory.pendingCheckoutOrder
        || agentMemory.selectedQuantity
        || /package_selection|awaiting_|sdr_awaiting_|order_closed|purchase|fechamento/i.test(String(agentMemory.lastFunnelStage || ''))
        || /package_selection|awaiting_|sdr_awaiting_|order_closed|purchase|fechamento/i.test(String(agentMemory.principalSdrStage || ''))
    );
};

const unansweredInboundAckText = (kind = '') => {
    if (String(kind).includes('audio')) {
        return '👍 Recibí su audio, señor. Para ayudarle sin error, escríbame en una frase si su duda es sobre precio, cómo tomar, agencia o pedido.';
    }
    if (String(kind) === 'organic_social_link') {
        return '👍 Lo vi, gracias por compartirlo.';
    }
    return '👍 Vi, señor. Ya lo reviso por aquí.';
};

const maybeHandleUnansweredInboundFallback = async ({
    text,
    msg,
    chatId,
    peerPhone,
    sessionId,
    contactStateId,
    agentProfile,
    customerContext,
    contactState,
    agentMemorySnapshot
}) => {
    const kind = detectUnansweredInboundKind({ text, msg });
    if (!kind) return false;

    const previousInbound = await previousInboundMessageForContact({
        chatId,
        peerPhone,
        currentMessageId: msg.id
    });
    const previousAtMs = previousInbound?.timestamp
        ? Number(previousInbound.timestamp) * 1000
        : (previousInbound?.createdAt ? new Date(previousInbound.createdAt).getTime() : 0);
    const dormantMs = unansweredDormantDays() * 24 * 60 * 60 * 1000;
    const isNewOrDormant = !previousAtMs || Date.now() - previousAtMs >= dormantMs;
    const latestOrder = await latestOrderForContact({ peerPhone, chatId });
    const hasRecentPurchaseIntent = await hasRecentPurchaseIntentForContact({
        peerPhone,
        chatId,
        currentMessageId: msg.id
    });
    const hasPurchaseMemory = hasPurchaseMemoryForUnansweredInbound({
        latestOrder,
        agentMemory: agentMemorySnapshot
    }) || hasRecentPurchaseIntent;

    const isOrganicSocialLink = kind === 'organic_social_link';
    const ackText = unansweredInboundAckText(kind);
    const sent = await sendText(chatId, ackText, null, { sessionId });
    if (sent) {
        try {
            await Message.create({
                _id: `out_${Date.now()}_unanswered_inbound_ack`,
                chatId,
                peerPhone,
                from: 'bot',
                to: chatId,
                body: ackText,
                isFromMe: true,
                isBot: true,
                timestamp: Math.floor(Date.now() / 1000)
            });
        } catch (e) { }
    }

    const setPayload = {
        [`metadata.perAgentMemory.${agentProfile.key}.lastUnansweredInboundFallbackAt`]: new Date(),
        [`metadata.perAgentMemory.${agentProfile.key}.lastUnansweredInboundFallbackKind`]: kind,
        [`metadata.perAgentMemory.${agentProfile.key}.lastUnansweredInboundWasNewOrDormant`]: isNewOrDormant,
        [`metadata.perAgentMemory.${agentProfile.key}.lastUnansweredInboundLatestOrderStatus`]: latestOrder?.status || '',
        [`metadata.perAgentMemory.${agentProfile.key}.lastUnansweredInboundHadPurchaseIntentHistory`]: hasRecentPurchaseIntent,
        [`metadata.perAgentMemory.${agentProfile.key}.lastUnansweredInboundAckText`]: ackText,
        [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: agentMemorySnapshot.lastFunnelStage || (isOrganicSocialLink ? 'organic_social_ack' : 'unanswered_inbound_ack'),
        'metadata.lastKnownFunnelStage': agentMemorySnapshot.lastFunnelStage || contactState?.metadata?.lastKnownFunnelStage || ''
    };

    await ContactState.updateOne({ _id: contactStateId }, { $set: setPayload }).catch(() => null);
    await updateContactStateAgentMemory({
        contactStateId,
        agentProfile,
        inboundText: text,
        outboundText: ackText,
        inferredIntent: isOrganicSocialLink ? 'organic_social_ack' : 'unanswered_inbound',
        inferredFunnelStage: isOrganicSocialLink ? 'organic_social_ack' : 'unanswered_inbound_ack',
        inferredObjection: null
    });

    if (isNewOrDormant && !hasPurchaseMemory && !isOrganicSocialLink) {
        const presentation = await sendInitialProductPresentation({
            jid: chatId,
            contactStateId,
            customerContext,
            sessionId,
            agentMemory: agentMemorySnapshot,
            includePrice: false,
            includeBottle: true
        });
        if (presentation.delivered) {
            await ContactState.updateOne(
                { _id: contactStateId },
                {
                    $set: {
                        [`metadata.perAgentMemory.${agentProfile.key}.unansweredInboundStartedFunnelAt`]: new Date(),
                        [`metadata.perAgentMemory.${agentProfile.key}.unansweredInboundStartedFunnelKind`]: kind,
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationSentAt`]: new Date(),
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationSteps`]: presentation.completedSteps,
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationAudios`]: presentation.sentAudios,
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationImages`]: presentation.sentImages,
                        [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'initial_product_presentation',
                        'metadata.lastKnownFunnelStage': 'initial_product_presentation'
                    }
                }
            ).catch(() => null);
        }
        console.log(`[FUNIL] Entrada sem resposta iniciou funil -> ${chatId} | kind=${kind} | delivered=${presentation.delivered}`);
        return true;
    }

    console.log(`[FUNIL] Entrada sem resposta acusada sem reiniciar funil -> ${chatId} | kind=${kind} | novo_ou_dormente=${isNewOrDormant} | compra_memoria=${hasPurchaseMemory}`);
    return true;
};

const holdNitrixForHuman = async ({
    contactStateId,
    inboundText = '',
    agentProfile
}) => {
    if (!contactStateId) return false;
    const now = new Date();
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                assignedAgent: NITRIX_AGENT_KEY,
                'human.mode': 'manual',
                'human.assignedName': 'Atendimento Nitrix EC',
                'human.lastManualAt': now,
                'human.lastManualBy': 'nitrix_route_guard',
                'human.note': 'Lead do /n/ Nitrix. Bot Vit Power bloqueado; atendimento humano deve seguir Nitrix.',
                'metadata.productKey': NITRIX_AGENT_KEY,
                'metadata.productName': NITRIX_PRODUCT_NAME,
                'metadata.productMedia': NITRIX_BOTTLE_MEDIA,
                'metadata.automationHandoffSuggestedReason': 'nitrix_manual_only',
                'metadata.automationHandoffSuggestedAt': now,
                'metadata.automationHandoffSuggestedNote': 'Lead Nitrix isolado do funil Vit Power. Nao liberar bot Vit Power salvo pedido explicito do cliente.',
                'metadata.customerDraft.productKey': NITRIX_AGENT_KEY,
                'metadata.customerDraft.productName': NITRIX_PRODUCT_NAME,
                'metadata.customerDraft.productMedia': NITRIX_BOTTLE_MEDIA,
                'metadata.customerDraft.source': 'vsl_ec_nitrix',
                'metadata.customerDraft.message': String(inboundText || '').slice(0, 700),
                'metadata.customerDraft.updatedAt': now.toISOString(),
                [`metadata.perAgentMemory.${agentProfile.key}.humanHandoffAt`]: now,
                [`metadata.perAgentMemory.${agentProfile.key}.humanHandoffReason`]: 'nitrix_manual_only',
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'nitrix_manual_handoff'
            },
            $addToSet: {
                tags: { $each: ['NITRIX_EC', 'BOT_VIT_POWER_BLOQUEADO', 'AGUARDANDO_ATENDIMENTO'] }
            }
        }
    );
    return true;
};

const holdTexUltraForHuman = async ({
    contactStateId,
    inboundText = '',
    agentProfile
}) => {
    if (!contactStateId) return false;
    const now = new Date();
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                assignedAgent: TEX_ULTRA_AGENT_KEY,
                'human.mode': 'manual',
                'human.assignedName': 'Atendimento Tex Ultra EC',
                'human.lastManualAt': now,
                'human.lastManualBy': 'tex_ultra_route_guard',
                'human.note': 'Lead da VSL Tex Ultra. Venda manual com tabela promocional aprovada; materiais de outros produtos bloqueados.',
                'metadata.productKey': TEX_ULTRA_AGENT_KEY,
                'metadata.productName': TEX_ULTRA_PRODUCT_NAME,
                'metadata.productMedia': '',
                'metadata.automationHandoffSuggestedReason': 'tex_ultra_manual_only',
                'metadata.automationHandoffSuggestedAt': now,
                'metadata.automationHandoffSuggestedNote': 'Tex Ultra isolado dos funis Nitrix/Vit Power ate aprovacao de textos, audios e imagens proprios.',
                'metadata.customerDraft.productKey': TEX_ULTRA_AGENT_KEY,
                'metadata.customerDraft.productName': TEX_ULTRA_PRODUCT_NAME,
                'metadata.customerDraft.productMedia': '',
                'metadata.customerDraft.source': 'vsl_ec_tex_ultra',
                'metadata.customerDraft.priceCatalog': 'promotional',
                'metadata.customerDraft.message': String(inboundText || '').slice(0, 700),
                'metadata.customerDraft.updatedAt': now.toISOString(),
                [`metadata.perAgentMemory.${agentProfile.key}.humanHandoffAt`]: now,
                [`metadata.perAgentMemory.${agentProfile.key}.humanHandoffReason`]: 'tex_ultra_manual_only',
                [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'tex_ultra_manual_handoff'
            },
            $addToSet: {
                tags: { $each: ['TEX_ULTRA_EC', 'BOT_OUTROS_PRODUTOS_BLOQUEADO', 'AGUARDANDO_ATENDIMENTO'] }
            }
        }
    );
    return true;
};

export const handleAgentConversation = async (msg, agentProfile = AGENT_PROFILES.nitrix_ec) => {
    try {
        console.log(`[LOG_HANDLER_ENTER] 🚀 Processando mensagem... agente=${agentProfile.key}`);

        const text = msg.body || '';
        const jid = msg.from;

        if (!text.trim()) return;
        if (jid === 'status@broadcast' || jid.includes('@g.us') || msg.fromMe) {
            console.log('[LOG_FILTER] ❌ Mensagem ignorada (Status/Grupo/Própria)');
            return;
        }

        const contactState = msg.contactStateId ? await ContactState.findById(msg.contactStateId).lean() : null;
        agentProfile = resolveAgentProfileForMessage({ text, contactState, requestedProfile: agentProfile });
        const chatId = resolveRealChatId(msg, contactState);
        const peerPhone = digitsOnly(msg.senderPn) || digitsOnly(contactState?.phoneDigits) || digitsOnly(chatId);
        let customerContext = customerContextForAgentProfile(agentProfile, peerPhone);
        const resolvedCountryCode = 'EC';
        console.log(`[BOT] ✅ Trabalhando no Chat: ${chatId} | agente=${agentProfile.key}`);

        if (!msg.recovered) {
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
        }

        if (agentProfile?.key === NITRIX_AGENT_KEY) {
            // A camada Nitrix somente assume quando a chave EC estiver ativa.
            // Se estiver desligada ou houver uma retencao humana explicita, a
            // barreira manual existente continua sendo a fonte de verdade.
            const fastStateHandled = await handleNitrixFastStateInbound({
                contactStateId: msg.contactStateId,
                inboundText: text,
                sessionId: msg.sessionId || null
            });
            if (fastStateHandled) {
                console.log(`[NITRIX-FAST-STATE] entrada tratada sem acessar Vit Power -> ${chatId}`);
                return;
            }
            await holdNitrixForHuman({
                contactStateId: msg.contactStateId,
                inboundText: text,
                agentProfile
            });
            console.log(`[NITRIX-GUARD] Bot Vit Power bloqueado; contato em atendimento manual -> ${chatId}`);
            return;
        }
        if (agentProfile?.key === TEX_ULTRA_AGENT_KEY) {
            const handled = await handleTexUltraFunnelInbound({
                contactStateId: msg.contactStateId,
                inboundText: text,
                sessionId: msg.sessionId || null
            });
            if (handled) {
                console.log(`[TEX-ULTRA] entrada tratada no funil isolado -> ${chatId}`);
                return;
            }
            await holdTexUltraForHuman({
                contactStateId: msg.contactStateId,
                inboundText: text,
                agentProfile
            });
            console.log(`[TEX-ULTRA-GUARD] Funis Nitrix/Vit Power bloqueados; contato em atendimento manual -> ${chatId}`);
            return;
        }

        const alreadyIntroduced = await hasBotIntroducedItself(chatId);
        const memoryOrder = await updateOrderConversationMemory({ chatId, customerContext, text, agentProfile, phoneDigits: peerPhone });
        const customerMemory = await buildCustomerMemory({ chatId, customerContext, phoneDigits: peerPhone });
        const sentImageKeys = (((contactState?.metadata || {}).perAgentMemory || {})[agentProfile.key] || {}).sentImageKeys || [];
        const agentMemorySnapshot = (((contactState?.metadata || {}).perAgentMemory || {})[agentProfile.key] || {});
        let checkoutOrderData = parseCheckoutOrderMessage(text);

        const unansweredInboundFallbackHandled = await maybeHandleUnansweredInboundFallback({
            text,
            msg,
            chatId,
            peerPhone,
            sessionId: msg.sessionId || null,
            contactStateId: msg.contactStateId,
            agentProfile,
            customerContext,
            contactState,
            agentMemorySnapshot
        });
        if (unansweredInboundFallbackHandled) return;

        const optInRescueContinueHandled = await maybeHandleOptInRescueContinue({
            text,
            chatId,
            peerPhone,
            sessionId: msg.sessionId || null,
            contactState,
            contactStateId: msg.contactStateId,
            agentProfile
        });
        if (optInRescueContinueHandled) return;

        const postOrderCourtesyHandled = await maybeHandleRecentOrderClosedLock({
            text,
            chatId,
            agentProfile,
            contactState,
            contactStateId: msg.contactStateId,
            peerPhone,
            history: customerMemory.history,
            customerProfile: customerMemory.customerProfile,
            customerContext,
            sessionId: msg.sessionId || null
        });
        if (postOrderCourtesyHandled) return;

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
        const selectedQuantityFromPrice = strongQuantityShortcutFromText({
            text,
            pendingCheckoutStage,
            pendingCheckoutOrder,
            agentMemory: agentMemorySnapshot
        }) || ([
            'awaiting_agency_selection',
            'awaiting_agency_selection_interrupt'
        ].includes(pendingCheckoutStage)
            ? 0
            : shouldConfirmPackageQuantity({
                text,
                agentMemory: agentMemorySnapshot
            }));
        const quantityCorrectionLine = /\b(cantidad|quantidade|frasco|frascos|botella|botellas|botellon|botellones)\b/i.test(normalizeFieldLabel(text));
        const unsupportedQuantityFromText = (
            !selectedQuantityFromPrice
            && ![
                'awaiting_agency_selection',
                'awaiting_agency_selection_interrupt'
            ].includes(pendingCheckoutStage)
            && (!looksLikeOrderDataMessage(text) || quantityCorrectionLine)
        ) ? detectUnsupportedPackageQuantity(text) : 0;

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

        if (unsupportedQuantityFromText) {
            const handled = await sendUnsupportedQuantityRedirect({
                chatId,
                peerPhone,
                text,
                unsupportedQuantity: unsupportedQuantityFromText,
                agentProfile,
                contactStateId: msg.contactStateId,
                sessionId: msg.sessionId || null
            });
            if (handled) return;
        }

        const attentiveReaderHandled = await maybeHandleAttentiveReaderDirectReply({
            text,
            chatId,
            peerPhone,
            sessionId: msg.sessionId || null,
            contactState,
            contactStateId: msg.contactStateId,
            agentProfile,
            customerContext,
            customerMemory,
            memoryOrder,
            checkoutOrderData,
            pendingCheckoutOrder,
            pendingCheckoutStage
        });
        if (attentiveReaderHandled) return;

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

        if (shouldRunLogisticInitialPresentation({ text, agentProfile, contactState })) {
            const initialLockAcquired = await acquireInitialFunnelSendLock({
                contactStateId: msg.contactStateId,
                agentProfile
            });
            if (!initialLockAcquired) {
                console.log(`[FUNIL-LOGISTICO] Entrada logistica bloqueada por lock -> ${chatId} | agente=${agentProfile.key}`);
                return;
            }

            await sendFirstResponseSlaAck({
                chatId,
                peerPhone,
                sessionId: msg.sessionId || null,
                contactStateId: msg.contactStateId,
                agentProfile,
                inboundText: text,
                alreadyIntroduced,
                agentMemorySnapshot
            });

            const presentation = await sendInitialProductPresentation({
                jid: chatId,
                contactStateId: msg.contactStateId,
                customerContext,
                sessionId: msg.sessionId || null,
                agentMemory: agentMemorySnapshot,
                includePrice: false,
                includeBottle: true,
                extraAudioNames: ['TEMPO_DEMORA_PRODUTO_CHEGAR'],
                bypassOutboundDedupe: isNoDropiBotTestPhone(peerPhone, chatId)
            });

            if (!presentation.delivered) {
                await ContactState.updateOne(
                    { _id: msg.contactStateId },
                    {
                        $set: {
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationFailedAt`]: new Date(),
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationFailedReason`]: presentation.interrupted ? 'interrupted' : 'not_delivered',
                            [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'initial_logistic_presentation_not_delivered'
                        }
                    }
                );
                await releaseInitialFunnelSendLock({
                    contactStateId: msg.contactStateId,
                    agentProfile
                });
                console.warn(`[FUNIL-LOGISTICO] Entrada logistica nao entregue -> ${chatId} | interrupted=${Boolean(presentation.interrupted)}`);
                return;
            }

            await updateContactStateAgentMemory({
                contactStateId: msg.contactStateId,
                agentProfile,
                inboundText: text,
                outboundText: '[MIDIAS] saudacao + prova + frasco + TEMPO_DEMORA_PRODUTO_CHEGAR',
                inferredIntent: 'shipping_info',
                inferredFunnelStage: 'initial_product_presentation',
                inferredObjection: null,
                sentImageKeys: presentation.sentImages
                    .filter((item) => item.sent)
                    .map((item) => item.key),
                sentRecordedAudioNames: presentation.sentAudios
                    .filter((item) => item.sent)
                    .map((item) => item.baseName)
            });

            await ContactState.updateOne(
                { _id: msg.contactStateId },
                {
                    $set: {
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationSentAt`]: new Date(),
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationSteps`]: presentation.completedSteps,
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationAudios`]: presentation.sentAudios,
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationImages`]: presentation.sentImages,
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationDeliveryTimeSentAt`]: new Date(),
                        [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'initial_product_presentation',
                        [`metadata.perAgentMemory.${agentProfile.key}.lastInterruptKey`]: 'delivery_time',
                        [`metadata.perAgentMemory.${agentProfile.key}.lastInterruptAnsweredAt`]: new Date(),
                        ...(presentation.greetingAudioSent ? {
                            'metadata.greeting_audio_sent': presentation.greetingAudioBaseName,
                            'metadata.greeting_period': presentation.greetingPeriod,
                            'metadata.greeting_sent_at': presentation.greetingSentAt || new Date(),
                            [`metadata.perAgentMemory.${agentProfile.key}.greeting_audio_sent`]: presentation.greetingAudioBaseName,
                            [`metadata.perAgentMemory.${agentProfile.key}.greeting_period`]: presentation.greetingPeriod,
                            [`metadata.perAgentMemory.${agentProfile.key}.greeting_sent_at`]: presentation.greetingSentAt || new Date()
                        } : {})
                    },
                    $unset: {
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationFailedAt`]: '',
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationFailedReason`]: '',
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationBlockedAt`]: ''
                    }
                }
            );

            console.log(`[FUNIL-LOGISTICO] Entrada com prazo enviada -> ${chatId} | agente=${agentProfile.key}`);
            return;
        }

        if (selectedQuantityFromPrice) {
            const handled = await sendSelectedQuantityConfirmation({
                chatId,
                peerPhone,
                text,
                selectedQuantity: selectedQuantityFromPrice,
                customerContext,
                agentProfile,
                contactStateId: msg.contactStateId,
                sessionId: msg.sessionId || null
            });
        if (handled) {
            console.log(`[FUNIL] quantity_selection_before_audio_complement -> ${chatId}`);
            return;
        }
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

        const skipComplementForCleanTest = isNoDropiBotTestPhone(peerPhone, chatId)
            && isInitialProductInquiry(text);
        const complement = skipComplementForCleanTest
            ? { handled: false }
            : await maybeHandleVitPowerAudioComplement({
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

        const principalSdrActiveStage = getPendingCheckoutStage(pendingCheckoutOrder);
        if (isPrincipalSdrStage(principalSdrActiveStage)) {
            const handled = await principalSdrHandle({
                text,
                chatId,
                peerPhone,
                sessionId: msg.sessionId || null,
                contactStateId: msg.contactStateId,
                agentProfile,
                customerContext,
                pendingCheckoutOrder,
                pendingCheckoutStage: principalSdrActiveStage,
                selectedQuantityInMemory
            });
            if (handled) return;
        }

        if (
            !pendingCheckoutOrder
            && agentMemorySnapshot.lastFunnelStage === 'initial_product_presentation'
            && !checkoutOrderData
            && !selectedQuantityFromPrice
            && !isInitialProductInquiry(text)
        ) {
            const handled = await principalSdrHandle({
                text,
                chatId,
                peerPhone,
                sessionId: msg.sessionId || null,
                contactStateId: msg.contactStateId,
                agentProfile,
                customerContext,
                pendingCheckoutOrder: { stage: 'sdr_after_initial' },
                pendingCheckoutStage: 'sdr_after_initial',
                selectedQuantityInMemory
            });
            if (handled) return;
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
            && isAgencyDeliveryConsent(text)
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
            && !isHomeDeliveryChoice(text)
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
            const nextStage = checkoutDataStageFromMissing(missingKeys);
            const replyText = buildMissingCheckoutFieldText({
                parsedOrder: pendingHomeOrder,
                missing: missingCheckoutFields(pendingHomeOrder),
                missingKeys
            });
            await savePendingCheckoutOrderMemory({
                contactStateId: msg.contactStateId,
                agentProfile,
                parsedOrder: pendingHomeOrder,
                stage: nextStage,
                orderId: null
            });
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
            && pendingCheckoutStage === 'awaiting_reference'
            && requiresHomeReference(pendingCheckoutOrder)
            && !checkoutOrderData
            && !isInitialProductInquiry(text)
            && cleanFieldValue(text).length >= 3
            && !looksLikePersonNameOnly(text)
        ) {
            const completedOrder = {
                ...pendingCheckoutOrder,
                reference: cleanFieldValue(text),
                deliveryMode: 'home'
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
                sessionId: msg.sessionId || null,
                peerPhone,
                deliveryMode
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
                memoryOrder.confirmedSalePayload = buildConfirmedSalePayload({
                    order: memoryOrder,
                    parsedOrder: {
                        name: memoryOrder.customer?.name || customerMemory.customerProfile?.name || '',
                        quantity: memoryOrder.package?.quantity || '',
                        address: memoryOrder.customer?.address || '',
                        reference: memoryOrder.customer?.reference || '',
                        deliveryMode
                    },
                    deliveryMode
                });
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
                await saveConfirmedSalePayloadToContact({
                    contactStateId: msg.contactStateId,
                    agentProfile,
                    payload: memoryOrder.confirmedSalePayload
                });
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

            await holdForHuman({
                contactStateId: msg.contactStateId,
                agentProfile,
                reason: 'order_closed_human_handoff',
                note: 'Pedido fechado. Automacao pausada para evitar looping de funil.'
            });

            console.log(`[FUNIL] Fechamento confirmado -> ${chatId} | entrega=${deliveryMode} | agente=${agentProfile.key}`);
            return;
        }

        const restartInitialProductPresentation = shouldRestartInitialProductPresentationAfterClosedOrder({
            text,
            agentProfile,
            contactState
        });

        if (
            !restartInitialProductPresentation
            && isInitialProductInquiry(text)
            && hasAnyInitialProductPresentation(agentMemorySnapshot)
        ) {
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
            console.log(`[FUNIL] Funil inicial ja enviado; seguindo sem repetir midias -> ${chatId} | agente=${agentProfile.key}`);
        }

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
            console.log(`[FUNIL] Entrada inicial repetida registrada; seguindo atendimento sem repetir -> ${chatId} | agente=${agentProfile.key}`);
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
            const initialLockAcquired = restartInitialProductPresentation
                ? true
                : await acquireInitialFunnelSendLock({
                    contactStateId: msg.contactStateId,
                    agentProfile
                });
            if (!initialLockAcquired) {
                await holdForHuman({
                    contactStateId: msg.contactStateId,
                    agentProfile,
                    reason: 'initial_funnel_parallel_blocked_human_handoff',
                    note: 'Disparo paralelo/repetido do funil bloqueado. Humano deve continuar.'
                });
                console.log(`[FUNIL] Disparo paralelo/repetido do funil bloqueado por lock -> ${chatId} | agente=${agentProfile.key}`);
                return;
            }
            await sendFirstResponseSlaAck({
                chatId,
                peerPhone,
                sessionId: msg.sessionId || null,
                contactStateId: msg.contactStateId,
                agentProfile,
                inboundText: text,
                alreadyIntroduced,
                agentMemorySnapshot,
                restartInitialProductPresentation
            });
            const presentation = await sendInitialProductPresentation({
                jid: chatId,
                contactStateId: msg.contactStateId,
                customerContext,
                sessionId: msg.sessionId || null,
                agentMemory: restartInitialProductPresentation ? {} : agentMemorySnapshot,
                priceTextOverride: null,
                includePrice: false,
                includeBottle: true,
                bypassOutboundDedupe: isNoDropiBotTestPhone(peerPhone, chatId)
            });

            if (!presentation.delivered) {
                await ContactState.updateOne(
                    { _id: msg.contactStateId },
                    {
                        $set: {
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationFailedAt`]: new Date(),
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationFailedReason`]: presentation.interrupted ? 'interrupted' : 'not_delivered',
                            [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'initial_product_presentation_not_delivered',
                            [`metadata.perAgentMemory.${agentProfile.key}.lastRepeatedInitialProductBlockedAt`]: new Date(),
                            [`metadata.perAgentMemory.${agentProfile.key}.lastRepeatedInitialProductText`]: text
                        },
                        $inc: {
                            [`metadata.perAgentMemory.${agentProfile.key}.repeatedInitialProductBlockedCount`]: 1
                        }
                    }
                );
                await releaseInitialFunnelSendLock({
                    contactStateId: msg.contactStateId,
                    agentProfile
                });
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
                outboundText: presentation.priceText || '[MIDIAS] audio_periodo + prova_01 + frasco_vit_power',
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
                        [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: 'initial_product_presentation',
                        ...(presentation.greetingAudioSent ? {
                            'metadata.greeting_audio_sent': presentation.greetingAudioBaseName,
                            'metadata.greeting_period': presentation.greetingPeriod,
                            'metadata.greeting_sent_at': presentation.greetingSentAt || new Date(),
                            [`metadata.perAgentMemory.${agentProfile.key}.greeting_audio_sent`]: presentation.greetingAudioBaseName,
                            [`metadata.perAgentMemory.${agentProfile.key}.greeting_period`]: presentation.greetingPeriod,
                            [`metadata.perAgentMemory.${agentProfile.key}.greeting_sent_at`]: presentation.greetingSentAt || new Date()
                        } : {})
                    },
                    $unset: {
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationFailedAt`]: '',
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationFailedReason`]: '',
                        [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationBlockedAt`]: ''
                    }
                }
            );

            if (!isNoDropiBotTestPhone(peerPhone, chatId) || contactState?.metadata?.fullFunnelTestEnabled) {
                const principalSdrOrder = {
                    ...(checkoutOrderData || {}),
                    stage: 'sdr_after_initial',
                    funnelStage: 'sdr_after_initial',
                    conversationSummary: 'Cliente recebeu saudacao, prova social e imagem Vit Power. Aguardando resposta para iniciar coleta guiada.'
                };
                await principalSdrSaveMemory({
                    contactStateId: msg.contactStateId,
                    agentProfile,
                    order: principalSdrOrder,
                    stage: 'sdr_after_initial',
                    inboundText: text,
                    outboundText: '[MIDIAS] audio_periodo + prova_aleatoria + frasco_vit_power'
                });
            } else {
                await ContactState.updateOne(
                    { _id: msg.contactStateId },
                    {
                        $set: {
                            'human.mode': 'auto',
                            'human.pausedUntil': null,
                            'metadata.botTestEnabled': true,
                            'metadata.noDropiEver': true,
                            'metadata.priorityFrozen': true,
                            'metadata.cleanTestResetAt': new Date(),
                            'metadata.cleanTestResetReason': 'auto_reset_8637_after_initial_presentation'
                        },
                        $unset: {
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationSentAt`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationCompletedAt`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationPriceSentAt`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationSteps`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationAudios`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationImages`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationAttemptedAt`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationFailedAt`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationFailedReason`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.initialProductPresentationBlockedAt`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.greeting_audio_sent`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.greeting_period`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.greeting_sent_at`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.audioPurposeMemory`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.audioComplements`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.lastComplementAt`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.lastComplementKey`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.lastInterruptAnsweredAt`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.lastInterruptKey`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.resumeConversationStageAfterInterrupt`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.resumeFunnelStageAfterInterrupt`]: '',
                            [`metadata.perAgentMemory.${agentProfile.key}.lastFunnelStage`]: '',
                            'metadata.greeting_audio_sent': '',
                            'metadata.greeting_period': '',
                            'metadata.greeting_sent_at': '',
                            'metadata.lastKnownFunnelStage': '',
                            'metadata.customerDraft': '',
                            'metadata.automationHandoffSuggestedAt': '',
                            'metadata.automationHandoffSuggestedNote': '',
                            'metadata.automationHandoffSuggestedReason': '',
                            'metadata.automationHoldAt': '',
                            'metadata.automationHoldReason': '',
                            'metadata.lastProcessedInboundText': '',
                            'metadata.lastProcessedInboundAt': ''
                        }
                    }
                );
            }

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

        if (strictVitalismenFunnelEnabled(agentProfile)) {
            replyText = strictVitalismenFallbackText({
                pendingCheckoutStage,
                pendingCheckoutOrder,
                agentMemorySnapshot
            });
            if (!replyText) {
                await holdForHuman({
                    contactStateId: msg.contactStateId,
                    agentProfile,
                    reason: 'strict_vitalismen_no_free_funnel',
                    note: 'Vitalismen esta em funil rigido. Resposta livre/IA generica bloqueada para nao misturar com aquecimento ou outro roteiro.'
                });
                console.log(`[FUNIL-RIGIDO] Resposta livre bloqueada no Vitalismen -> ${chatId} | texto=${text.slice(0, 80)}`);
                return;
            }
        } else if (isShortGreeting) {
            replyText = getGreetingReply({ agentProfile, alreadyIntroduced });
        } else {
            console.log(`[AI-START] 🤖 Consultando OpenAI... agente=${agentProfile.key}`);
            const aiResult = await openaiService.generateResponse(text, {
                ...customerContext,
                alreadyIntroduced,
                history: customerMemory.history,
                customerProfile: customerMemory.customerProfile,
                conversationMemory: memoryOrder?.conversationMemory || customerMemory.customerProfile?.conversationMemory || null,
                communicationMemory: agentMemorySnapshot.conversationState || null,
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

        if (!replyText) {
            await sendAttendanceRescueText({
                chatId,
                peerPhone,
                sessionId: msg.sessionId || null,
                inboundText: text,
                customerContext,
                contactStateId: msg.contactStateId,
                agentProfile,
                reason: 'empty_reply'
            });
            return;
        }
        const shouldSendOrderClosedAudio = ORDER_CLOSED_TAG_REGEX.test(replyText)
            || hasLeakedOrderClosedAudioMarker(replyText);
        ORDER_CLOSED_TAG_REGEX.lastIndex = 0;
        replyText = removeLeakedAudioMarkers(replyText.replace(ORDER_CLOSED_TAG_REGEX, ''));
        replyText = avoidRepeatedReply({
            replyText,
            history: customerMemory.history,
            agentProfile
        });
        replyText = sanitizeGenericPriceReply({
            inboundText: text,
            replyText
        });
        replyText = sanitizeSimpleProstateCommercialReply({
            inboundText: text,
            replyText
        });

        const inferredIntent = memoryOrder?.$locals?.inferredIntent || inferIntent(text);
        const inferredFunnelStage = memoryOrder?.$locals?.inferredFunnelStage || inferFunnelStage(text, customerContext, agentProfile);
        const inferredObjection = memoryOrder?.$locals?.inferredObjection || inferLastObjection(text);
        const lastAudioSent = agentMemorySnapshot?.conversationState?.last_audio_sent || agentMemorySnapshot?.lastAudioSent || '';
        const responseMode = determineResponseMode({
            replyText,
            intent: inferredIntent,
            funnelStage: inferredFunnelStage,
            agentProfile,
            isShortGreeting
        });
        let preparedPlan = enrichOutboundPlan({
            rawText: replyText,
            forceAudioText: shouldForceAudio({
                intent: inferredIntent,
                lastObjection: inferredObjection,
                agentProfile
            }) ? replyText : null,
            forceRecordedAudioName: preferredRecordedAudioForReply({
                intent: inferredIntent,
                lastObjection: inferredObjection,
                funnelStage: inferredFunnelStage,
                replyText,
                agentProfile,
                lastAudioSent
            }),
            forceImageKey: shouldForceImage({
                lastObjection: inferredObjection,
                customerContext,
                agentProfile,
                sentImageKeys
            }),
            recordedAudioCountry: customerContext.countryCode,
            mode: responseMode
        });
        preparedPlan = sanitizeGenericPriceOutboundPlan({
            inboundText: text,
            plan: preparedPlan
        });

        if (shouldBlockDuplicateBotReply({
            contactState,
            agentProfile,
            replyText: preparedPlan.cleanText || replyText
        })) {
            console.log(`[OUTBOUND-BLOCKED] resposta repetida bloqueada -> ${chatId} | agente=${agentProfile.key}`);
            await sendAttendanceRescueText({
                chatId,
                peerPhone,
                sessionId: msg.sessionId || null,
                inboundText: text,
                customerContext,
                contactStateId: msg.contactStateId,
                agentProfile,
                inferredIntent,
                inferredFunnelStage,
                inferredObjection,
                reason: 'duplicate_reply'
            });
            return;
        }

        const outbound = await executePreparedOutboundPlan({
            jid: chatId,
            plan: preparedPlan,
            sessionId: msg.sessionId || null,
            countryCode: customerContext.countryCode
        });

        if (!outbound.delivered) {
            await sendAttendanceRescueText({
                chatId,
                peerPhone,
                sessionId: msg.sessionId || null,
                inboundText: text,
                customerContext,
                contactStateId: msg.contactStateId,
                agentProfile,
                inferredIntent,
                inferredFunnelStage,
                inferredObjection,
                reason: 'outbound_not_delivered'
            });
            return;
        }

        const orderClosedDeliveryMode = shouldSendOrderClosedAudio
            ? inferDeliveryModeFromCloseContext({
                history: customerMemory.history,
                customerProfile: customerMemory.customerProfile
            })
            : 'agency';
        const orderClosedAudios = shouldSendOrderClosedAudio
            ? await sendOrderClosedAudios({
                jid: chatId,
                countryCode: customerContext.countryCode,
                sessionId: msg.sessionId || null,
                peerPhone,
                deliveryMode: orderClosedDeliveryMode
            })
            : { thankYouAudioSent: false, bonusNoticeAudioSent: false };

        console.log(`[OUTBOUND-OK] ✅ Resposta enviada para ${chatId} | agente=${agentProfile.key}`);
        const sentRecordedAudios = Array.isArray(outbound.sentRecordedAudios) ? outbound.sentRecordedAudios : [];
        for (const [index, audio] of sentRecordedAudios.entries()) {
            const mediaUrl = publicMediaUrlFromPath(audio.audioPath);
            try {
                await Message.create({
                    _id: `out_${Date.now()}_recorded_audio_${index}`,
                    chatId,
                    peerPhone,
                    from: 'bot',
                    to: chatId,
                    body: `[AUDIO] ${audio.baseName}`,
                    type: 'audio',
                    hasMedia: Boolean(mediaUrl),
                    mediaUrl,
                    mediaPreviewUrl: mediaPreviewUrlFor(mediaUrl),
                    isFromMe: true,
                    isBot: true,
                    timestamp: Math.floor(Date.now() / 1000)
                });
            } catch (e) { }
        }

        if (outbound.textSent && (outbound.cleanText || replyText)) {
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
        }

        if (memoryOrder) {
            if (shouldSendOrderClosedAudio) {
                memoryOrder.status = 'confirmed';
                memoryOrder.confirmedSalePayload = buildConfirmedSalePayload({
                    order: memoryOrder,
                    parsedOrder: {
                        name: memoryOrder.customer?.name || customerMemory.customerProfile?.name || '',
                        quantity: memoryOrder.package?.quantity || '',
                        address: memoryOrder.customer?.address || '',
                        reference: memoryOrder.customer?.reference || '',
                        deliveryMode: orderClosedDeliveryMode
                    },
                    deliveryMode: orderClosedDeliveryMode
                });
                await saveConfirmedSalePayloadToContact({
                    contactStateId: msg.contactStateId,
                    agentProfile,
                    payload: memoryOrder.confirmedSalePayload
                });
            }
            memoryOrder.conversationMemory = {
                ...(memoryOrder.conversationMemory || {}),
                activeAgent: agentProfile.key,
                lastBotMessageAt: new Date(),
                orderClosedAudioSent: orderClosedAudios.thankYouAudioSent,
                orderClosedBonusNoticeAudioSent: orderClosedAudios.bonusNoticeAudioSent
            };
            await memoryOrder.save();
        }

        const outboundMemoryText = outbound.textSent
            ? (outbound.cleanText || replyText)
            : (sentRecordedAudios.map((audio) => `[AUDIO] ${audio.baseName}`).join('\n') || outbound.cleanText || replyText);
        await updateContactStateAgentMemory({
            contactStateId: msg.contactStateId,
            agentProfile,
            inboundText: text,
            outboundText: outboundMemoryText,
            inferredIntent,
            inferredFunnelStage,
            inferredObjection,
            sentImageKeys: Array.isArray(preparedPlan.imageKeys) ? preparedPlan.imageKeys : [],
            sentRecordedAudioNames: sentRecordedAudios.map((audio) => audio.baseName)
        });
    } catch (error) {
        console.error('[BOT-FATAL-ERROR] ❌ Erro geral:', error);
    }
};
