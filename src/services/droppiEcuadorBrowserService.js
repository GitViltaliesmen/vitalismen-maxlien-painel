import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Shipment from '../models/Shipment.js';
import Order from '../models/Order.js';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import { buildDroppiEcuadorOrderPayload, upsertDroppiEcuadorShipment } from './droppiEcuadorService.js';
import {
    ECUADOR_PRODUCTS,
    ECUADOR_UNKNOWN_PRODUCT,
    detectExplicitEcuadorProductKey,
    findEcuadorOfferByTotal,
    resolveEcuadorProductInfo
} from './ecuadorProductService.js';
import { markOnlineAdminPedidoEnviado, syncOrderToOnlineAdminPanel } from './adminPanelStatusService.js';
import { getOrderDuplicateGuard } from './orderDuplicateGuardService.js';
import { reconcileDropiRowToShipment } from './dropiShipmentReconciliationService.js';
import {
    finalizeDropiSyncCycle,
    startDropiSyncCycle
} from './dropiSyncObservabilityService.js';
import { DROPI_SYNC_MODES } from './postSaleSafetyV66Service.js';
import { assertMutationAllowed } from './strictReadOnlyObservationService.js';

const LOCK_MS = Number.parseInt(process.env.DROPPI_EC_LOCK_MS || '900000', 10);
const BROWSER_WORK_TIMEOUT_MS = Number.parseInt(process.env.DROPPI_EC_BROWSER_WORK_TIMEOUT_MS || '360000', 10);
const DEFAULT_STORAGE_STATE_PATH = path.join(
    process.env.HOME || process.cwd(),
    '.vitalismen-secrets',
    'droppi-ec-storage.json'
);
const CONFIGURED_STORAGE_STATE_PATH = String(process.env.DROPPI_EC_STORAGE_STATE_PATH || '').trim();
const STORAGE_STATE_PATH = CONFIGURED_STORAGE_STATE_PATH && path.isAbsolute(CONFIGURED_STORAGE_STATE_PATH)
    ? CONFIGURED_STORAGE_STATE_PATH
    : DEFAULT_STORAGE_STATE_PATH;
if (CONFIGURED_STORAGE_STATE_PATH && !path.isAbsolute(CONFIGURED_STORAGE_STATE_PATH)) {
    console.warn('[DROPI-EC] DROPPI_EC_STORAGE_STATE_PATH relativo ignorado; usando caminho persistente fora do release.');
}
const TOTP_SECRET_FILE_PATH = process.env.DROPI_TOTP_SECRET_FILE
    || process.env.DROPPI_TOTP_SECRET_FILE
    || path.join(process.env.HOME || process.cwd(), '.vitalismen-secrets', 'dropi-2fa.env');
const DOWNLOAD_DIR = process.env.DROPPI_EC_DOWNLOAD_DIR
    || path.join(process.cwd(), 'public', 'media', 'droppi-ec');
const LOGIN_URL = process.env.DROPPI_EC_LOGIN_URL || 'https://app.dropi.ec/auth/login';
const PRODUCT_URL = process.env.DROPPI_EC_PRODUCT_URL
    || ECUADOR_PRODUCTS.vitPower.dropiUrl
    || 'https://app.dropi.ec/dashboard/product-details/103743/vit-powerss-1000-ml-x1-comunidad';
const PRIVATE_PRODUCT_URL = (() => {
    try {
        const url = new URL(PRODUCT_URL);
        url.searchParams.set('privated', 'true');
        return url.toString();
    } catch {
        return PRODUCT_URL.includes('privated=true')
            ? PRODUCT_URL
            : `${PRODUCT_URL}${PRODUCT_URL.includes('?') ? '&' : '?'}privated=true`;
    }
})();
const ORDERS_URL = process.env.DROPPI_EC_ORDERS_URL || 'https://app.dropi.ec/dashboard/orders';
const ORDERS_API_URL = process.env.DROPPI_EC_ORDERS_API_URL || 'https://api.dropi.ec/api/orders/myorders/v2';
const GUIDE_CLOUDFRONT_URL = process.env.DROPPI_EC_GUIDE_CLOUDFRONT_URL || 'https://d39ru7awumhhs2.cloudfront.net';
const IMAGE_SERVER_URL = process.env.DROPPI_EC_IMAGE_SERVER_URL || 'https://api.dropi.ec';
const PRODUCT_NAME = process.env.DROPPI_EC_PRODUCT_NAME || 'VIT POWERS 1000ML COMUNIDAD';
const PRODUCT_ALIASES = (process.env.DROPPI_EC_PRODUCT_ALIASES
    || 'VIT POWERS 1000ML COMUNIDAD|VIT POWERS 1000 ML X1 COMUNIDAD|VIT POWERS 1000 ML X1 / COMUNIDAD|VIT POWERSS 1000 ML X1 COMUNIDAD|VIT POWERSS 1000 ML X1 / COMUNIDAD')
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean);
const EMAIL_ENV = 'DROPI_EC_EMAIL';
const PASSWORD_ENV = 'DROPI_EC_PASSWORD';
const CITY_RELEASE_WAIT_MS = Number.parseInt(process.env.DROPPI_EC_CITY_RELEASE_WAIT_MS || '90000', 10);
const SHIPPING_QUOTE_WAIT_MS = Number.parseInt(process.env.DROPPI_EC_SHIPPING_QUOTE_WAIT_MS || '90000', 10);
const ORDER_CREATION_WAIT_MS = Number.parseInt(process.env.DROPPI_EC_ORDER_CREATION_WAIT_MS || '90000', 10);
const PRODUCT_CARD_WAIT_MS = Number.parseInt(process.env.DROPPI_EC_PRODUCT_CARD_WAIT_MS || '90000', 10);
const manualBrowserSessions = new Map();

const selectors = {
    loginEmail: process.env.DROPPI_EC_SELECTOR_LOGIN_EMAIL || '#email, input[type="email"], input[name="email"], input[name="username"], input[placeholder*="Usuario"], input[placeholder*="usuario"], input[type="text"]',
    loginPassword: process.env.DROPPI_EC_SELECTOR_LOGIN_PASSWORD || '#password, input[type="password"], input[name="password"]',
    loginSubmit: process.env.DROPPI_EC_SELECTOR_LOGIN_SUBMIT || 'button:has-text("Ingresar"), button:has-text("Iniciar"), button:has-text("Entrar"), button:has-text("Log in"), button:has-text("Login"), form button, button[type="submit"], input[type="submit"]',
    twoFactorCode: process.env.DROPPI_EC_SELECTOR_2FA_CODE || 'input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="totp" i], input[name*="code" i], input[id*="otp" i], input[id*="code" i], input[type="tel"], input[inputmode="numeric"], input[type="text"]',
    twoFactorSubmit: process.env.DROPPI_EC_SELECTOR_2FA_SUBMIT || 'button:has-text("Verificar"), button:has-text("Validar"), button:has-text("Confirmar"), button:has-text("Continuar"), button:has-text("Enviar"), button:has-text("Verify"), button:has-text("Submit"), button[type="submit"], input[type="submit"]',
    createOrderButton: process.env.DROPPI_EC_SELECTOR_CREATE_ORDER || '[data-cy="send-to-client-button"], button:has-text("Enviar al cliente"), button:has-text("Enviar a cliente"), button:has-text("Crear Orden"), button:has-text("Create Order")',
    firstName: process.env.DROPPI_EC_SELECTOR_FIRST_NAME || '[data-cy="client-name"], input[placeholder="Nombres"]',
    lastName: process.env.DROPPI_EC_SELECTOR_LAST_NAME || '[data-cy="client-last-name"], input[placeholder="Apellidos"]',
    phone: process.env.DROPPI_EC_SELECTOR_PHONE || '[data-cy="phone-input"] input, input[placeholder*="teléfono"]',
    department: process.env.DROPPI_EC_SELECTOR_DEPARTMENT || '[data-cy="client-state"] input, input[placeholder="Departamento"]',
    city: process.env.DROPPI_EC_SELECTOR_CITY || '[data-cy="client-city"] input, input[placeholder="Ciudad"]',
    address: process.env.DROPPI_EC_SELECTOR_ADDRESS || '[data-cy="client-address"], input[placeholder*="Dirección"]',
    email: process.env.DROPPI_EC_SELECTOR_EMAIL || '[data-cy="client-email"], input[placeholder*="Correo"]',
    recaudoButton: process.env.DROPPI_EC_SELECTOR_RECAUDO || 'text=/Con Recaudo/i',
    servientregaCard: process.env.DROPPI_EC_SELECTOR_SERVIENTREGA_CARD || '.card-logistic:has-text("Servientrega")',
    servientregaOption: process.env.DROPPI_EC_SELECTOR_SERVIENTREGA || '.card-logistic:has-text("Servientrega") .radio',
    laarcourierCard: process.env.DROPPI_EC_SELECTOR_LAARCOURIER_CARD || '.card-logistic:has-text("Laarcourier")',
    laarcourierOption: process.env.DROPPI_EC_SELECTOR_LAARCOURIER || '.card-logistic:has-text("Laarcourier") .radio',
    velocesCard: process.env.DROPPI_EC_SELECTOR_VELOCES_CARD || '.card-logistic:has-text("Veloces")',
    velocesOption: process.env.DROPPI_EC_SELECTOR_VELOCES || '.card-logistic:has-text("Veloces") .radio',
    gintracomCard: process.env.DROPPI_EC_SELECTOR_GINTRACOM_CARD || '.card-logistic:has-text("Gintracom")',
    gintracomOption: process.env.DROPPI_EC_SELECTOR_GINTRACOM || '.card-logistic:has-text("Gintracom") .radio',
    urbanoCard: process.env.DROPPI_EC_SELECTOR_URBANO_CARD || '.card-logistic:has-text("Urbano")',
    urbanoOption: process.env.DROPPI_EC_SELECTOR_URBANO || '.card-logistic:has-text("Urbano") .radio',
    rocketCard: process.env.DROPPI_EC_SELECTOR_ROCKET_CARD || '.card-logistic:has-text("Rocket")',
    rocketOption: process.env.DROPPI_EC_SELECTOR_ROCKET || '.card-logistic:has-text("Rocket") .radio',
    priceInput: process.env.DROPPI_EC_SELECTOR_PRICE || 'input[name="price"], p-inputnumber[name="price"] input',
    quantityInput: process.env.DROPPI_EC_SELECTOR_QUANTITY || 'input[name="cantidad"], p-inputnumber[name="cantidad"] input',
    submitOrderButton: process.env.DROPPI_EC_SELECTOR_SUBMIT_ORDER || 'button:has-text("Enviar al cliente")',
    ordersSearch: process.env.DROPPI_EC_SELECTOR_ORDERS_SEARCH || 'input[name="textToSearch"], input[placeholder*="Buscar"]'
};

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const withTimeout = (promise, timeoutMs, label) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), timeoutMs);
    promise
        .then(resolve, reject)
        .finally(() => clearTimeout(timer));
});

const getUsableStorageStatePath = () => {
    if (!fs.existsSync(STORAGE_STATE_PATH)) return undefined;
    try {
        JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf8'));
        return STORAGE_STATE_PATH;
    } catch (error) {
        const quarantinePath = `${STORAGE_STATE_PATH}.corrupt-${Date.now()}`;
        fs.renameSync(STORAGE_STATE_PATH, quarantinePath);
        console.warn('Dropi EC storage state quarantined:', error.message || error);
        return undefined;
    }
};

const normalizeTotpSecret = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        if (/^otpauth:\/\//i.test(raw)) {
            return new URL(raw).searchParams.get('secret') || '';
        }
    } catch {
        return '';
    }
    return raw.replace(/^["']|["']$/g, '');
};

const getDropiEcTotpSecret = () => {
    const envSecret = normalizeTotpSecret(process.env.DROPI_EC_TOTP_SECRET || process.env.DROPPI_EC_TOTP_SECRET || '');
    if (envSecret) return envSecret;
    if (!fs.existsSync(TOTP_SECRET_FILE_PATH)) return '';
    const content = fs.readFileSync(TOTP_SECRET_FILE_PATH, 'utf8');
    const values = {};
    for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (!match) continue;
        values[match[1]] = normalizeTotpSecret(match[2]);
    }
    return values.DROPI_EC_TOTP_SECRET || values.DROPPI_EC_TOTP_SECRET || '';
};

const base32Decode = (secret) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = String(secret || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = '';
    const bytes = [];
    for (const char of clean) {
        const value = alphabet.indexOf(char);
        if (value < 0) continue;
        bits += value.toString(2).padStart(5, '0');
        while (bits.length >= 8) {
            bytes.push(Number.parseInt(bits.slice(0, 8), 2));
            bits = bits.slice(8);
        }
    }
    return Buffer.from(bytes);
};

const generateTotpCode = ({ secret, timeMs = Date.now(), stepSeconds = 30, digits = 6 } = {}) => {
    const key = base32Decode(secret);
    if (!key.length) return '';
    const counter = Math.floor(timeMs / 1000 / stepSeconds);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuffer.writeUInt32BE(counter >>> 0, 4);
    const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const binary = ((hmac[offset] & 0x7f) << 24)
        | ((hmac[offset + 1] & 0xff) << 16)
        | ((hmac[offset + 2] & 0xff) << 8)
        | (hmac[offset + 3] & 0xff);
    return String(binary % (10 ** digits)).padStart(digits, '0');
};

const buildNotReadyError = (reason) => new Error(
    `Dropi Ecuador browser automation not ready: ${reason}.`
);

const isDropiPaymentRequiredError = (value) => (
    /saldo|wallet|cr[eé]dito|credito|balance|credit/i.test(String(value || ''))
);

const isTransientDropiBrowserError = (value) => (
    /Target page|context.*closed|browser.*closed|ERR_CONNECTION|ERR_SOCKET|ERR_CERT|net::|Timeout|Execution context was destroyed|Navigation failed|session expired while opening product/i
        .test(String(value || ''))
);

const normalizeAutocompleteText = (text) => String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\b(canton|cantones|ciudad|parroquia|de|del|la|las|los)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeAutocompleteLoose = (text) => normalizeAutocompleteText(text)
    .replace(/[bv]/g, 'b');

const normalizeAutocompleteCompact = (text) => normalizeAutocompleteLoose(text).replace(/\s+/g, '');

const buildContactLookupForShipment = (shipment = {}) => {
    const digits = String(shipment?.client?.phone || '').replace(/\D/g, '');
    const variants = [
        digits,
        digits.startsWith('593') ? digits.slice(3) : '',
        digits.slice(-10),
        digits.slice(-9)
    ].filter((value) => value && value.length >= 8);
    const unique = [...new Set(variants)];
    if (!unique.length) return null;
    return {
        $or: unique.flatMap((value) => [
            { phoneDigits: { $regex: `${value}$` } },
            { chatId: { $regex: value } }
        ])
    };
};

const tagDropiContactState = async ({ shipment, tag, payload = {} }) => {
    const query = buildContactLookupForShipment(shipment);
    if (!query || !tag) return { matchedCount: 0, modifiedCount: 0 };
    return ContactState.updateMany(query, {
        $addToSet: { tags: tag },
        $set: {
            'metadata.dropi.lastTag': tag,
            'metadata.dropi.lastTagAt': new Date(),
            ...payload
        }
    }).catch((error) => {
        console.warn('Dropi contact tag update failed:', error.message || error);
        return { matchedCount: 0, modifiedCount: 0, error: error.message || String(error) };
    });
};

export const autocompleteTextAccepts = (actual, expected) => {
    const normalizedActual = normalizeAutocompleteText(actual);
    const normalizedExpected = normalizeAutocompleteText(expected);
    if (!normalizedActual || !normalizedExpected) return false;
    const compactActual = normalizeAutocompleteCompact(normalizedActual);
    const compactExpected = normalizeAutocompleteCompact(normalizedExpected);
    if (compactActual && compactActual === compactExpected) return true;
    const expectedTokens = normalizedExpected.split(/\s+/).filter(Boolean);
    const actualTokens = normalizedActual.split(/\s+/).filter(Boolean);
    const expectedIsSingleToken = expectedTokens.length === 1;
    if (normalizedActual === normalizedExpected) return true;
    if (!expectedIsSingleToken && normalizedActual.startsWith(`${normalizedExpected} `)) return true;
    if (
        actualTokens.length >= 2
        && normalizedExpected.startsWith(`${normalizedActual} `)
        && normalizedActual.length >= Math.min(normalizedExpected.length, 5)
    ) return true;

    const looseActual = normalizeAutocompleteLoose(normalizedActual);
    const looseExpected = normalizeAutocompleteLoose(normalizedExpected);
    const compactLooseActual = normalizeAutocompleteCompact(looseActual);
    const compactLooseExpected = normalizeAutocompleteCompact(looseExpected);
    if (looseActual === looseExpected) return true;
    if (compactLooseActual && compactLooseActual === compactLooseExpected) return true;
    if (!expectedIsSingleToken && looseActual.startsWith(`${looseExpected} `)) return true;
    if (
        actualTokens.length >= 2
        && looseExpected.startsWith(`${looseActual} `)
        && looseActual.length >= Math.min(looseExpected.length, 5)
    ) return true;
    if (expectedIsSingleToken && actualTokens.length > 1) return false;

    const maxDistance = Math.max(looseActual.length, looseExpected.length) <= 8 ? 1 : 2;
    return levenshteinDistance(looseActual, looseExpected) <= maxDistance;
};

const levenshteinDistance = (a, b) => {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;

    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = Array.from({ length: b.length + 1 }, () => 0);
    for (let i = 1; i <= a.length; i += 1) {
        current[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        previous.splice(0, previous.length, ...current);
    }
    return previous[b.length];
};

const isLoginUrl = (url) => {
    try {
        return /\/(auth\/)?login\b/i.test(new URL(url).pathname);
    } catch {
        return false;
    }
};

export const classifyDropiPageAuthState = ({ url = '', loginPrompt = false, sessionToken = false } = {}) => {
    const loginScreen = isLoginUrl(url) || Boolean(loginPrompt);
    return {
        loginScreen,
        authenticated: !loginScreen && Boolean(sessionToken)
    };
};

const hasTwoFactorPrompt = async (page) => {
    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    return /autenticaci[oó]n de dos factores|two[-\s]?factor|authenticator|otp|c[oó]digo de verificaci[oó]n|codigo de seguridad|six digits|seis d[ií]gitos/i.test(bodyText);
};

const hasLoginPrompt = async (page) => {
    const passwordVisible = await page.locator(selectors.loginPassword).first().isVisible({ timeout: 1000 }).catch(() => false);
    if (passwordVisible) return true;
    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    return /usuario\s+contrase[nñ]a|iniciar sesi[oó]n|olvid[oó] su contrase[nñ]a|sign in with credentials|username\s+password|forgot password|remember me|log in/i
        .test(bodyText);
};

const hasDropiSessionToken = async (page) => page.evaluate(() => {
    const keys = [
        'DROPI_token',
        'DROPI_SessionData',
        'casUser',
        'token',
        'access_token'
    ];
    return keys.some((key) => Boolean(window.localStorage?.getItem(key) || window.sessionStorage?.getItem(key)));
}).catch(() => false);

const inspectDropiPageAuthState = async (page) => classifyDropiPageAuthState({
    url: page.url(),
    loginPrompt: await hasLoginPrompt(page),
    sessionToken: await hasDropiSessionToken(page)
});

const getPageExcerpt = async (page, limit = 500) => {
    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    return bodyText.replace(/\s+/g, ' ').trim().slice(0, limit);
};

const getPlaywright = async () => {
    try {
        return await import('playwright');
    } catch {
        throw buildNotReadyError('playwright is not installed');
    }
};

const buildInvoiceFilePath = (shipment) => {
    ensureDir(DOWNLOAD_DIR);
    const filename = `${shipment.orderId || 'shipment'}_${shipment.logistics?.trackingNumber || Date.now()}.pdf`;
    return path.join(DOWNLOAD_DIR, filename);
};

const updateBrowserState = async (shipmentId, checkpoint, extra = {}) => {
    await Shipment.updateOne(
        { _id: shipmentId },
        {
            $set: {
                'automation.browserCheckpoint': checkpoint,
                ...(extra.lastError !== undefined ? { 'automation.browserLastError': extra.lastError } : {})
            },
            ...(extra.event
                ? {
                    $push: {
                        events: {
                            kind: extra.event.kind,
                            at: new Date(),
                            payload: extra.event.payload || {}
                        }
                    }
                }
                : {})
        }
    );
};

export const lockShipmentForBrowserWorkEc = async (shipment) => {
    assertMutationAllowed({ capability: 'shipment_browser_lock', source: 'droppi_ec_browser' });
    const now = new Date();
    return Shipment.findOneAndUpdate(
        {
            _id: shipment._id,
            $or: [
                { 'automation.submitLockedUntil': { $exists: false } },
                { 'automation.submitLockedUntil': null },
                { 'automation.submitLockedUntil': { $lt: now } }
            ]
        },
        {
            $set: {
                'automation.submitAttemptedAt': now,
                'automation.submitLockedUntil': new Date(now.getTime() + LOCK_MS)
            }
        },
        { new: true }
    );
};

export const releaseShipmentBrowserLockEc = async (shipmentId) => {
    assertMutationAllowed({ capability: 'shipment_browser_unlock', source: 'droppi_ec_browser' });
    await Shipment.updateOne(
        { _id: shipmentId },
        { $unset: { 'automation.submitLockedUntil': 1 } }
    );
};

export const prepareDroppiEcuadorSubmission = async (order) => ({
    loginEmailEnv: EMAIL_ENV,
    loginPasswordEnv: PASSWORD_ENV,
    loginUrl: LOGIN_URL,
    productUrl: dropiProductTargetForOrder(order).productUrl,
    ordersUrl: ORDERS_URL,
    storageStatePath: STORAGE_STATE_PATH,
    payload: buildDroppiEcuadorOrderPayload({ order })
});

const firstVisibleEnabled = async (page, selector, timeoutMs = 20000) => {
    const locators = page.locator(selector);
    await locators.first().waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => null);
    const count = await locators.count();
    for (let index = 0; index < count; index += 1) {
        const locator = locators.nth(index);
        if (
            await locator.isVisible().catch(() => false)
            && await locator.isEnabled().catch(() => false)
        ) {
            return locator;
        }
    }
    return null;
};

const fillInputIfVisible = async (page, selector, value) => {
    if (!value) return;
    const locator = await firstVisibleEnabled(page, selector);
    if (locator) {
        await locator.fill(String(value));
        await locator.evaluate((node) => {
            node.dispatchEvent(new Event('input', { bubbles: true }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
            node.dispatchEvent(new Event('blur', { bubbles: true }));
        }).catch(() => null);
    }
};

const fillNumericInputIfVisible = async (page, selector, value) => {
    if (value === undefined || value === null || value === '') return;
    const locator = await firstVisibleEnabled(page, selector);
    if (!locator) return;
    const text = formatDecimalForDropiEc(value);
    await locator.click({ force: true }).catch(() => null);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => null);
    await page.keyboard.press('Backspace').catch(() => null);
    await locator.type(String(text), { delay: 35 }).catch(async () => locator.fill(String(text)));
    await locator.evaluate((node) => {
        node.dispatchEvent(new Event('input', { bubbles: true }));
        node.dispatchEvent(new Event('change', { bubbles: true }));
        node.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        node.dispatchEvent(new Event('blur', { bubbles: true }));
    }).catch(() => null);
};

const readInputValue = async (locator) => locator.evaluate((node) => {
    if ('value' in node) return node.value || '';
    return node.getAttribute('aria-label') || node.textContent || '';
}).catch(() => '');

const selectAutocompleteValue = async (page, selector, value, options = {}) => {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) return { ok: false, reason: 'empty_value' };
    const input = await firstVisibleEnabled(page, selector);
    if (!input) return { ok: false, reason: 'input_not_available' };

    const candidates = [
        normalizedValue,
        normalizedValue.replace(/\([^)]*\)/g, ' '),
        normalizedValue.replace(/\bcant[oó]n\b/gi, ' '),
        normalizedValue.replace(/\bcant[oó]n\s+(\d+)\s+([a-záéíóúñ]+)/i, '$1 de $2'),
        ...(normalizedValue.match(/\(([^)]*)\)/g) || []).map((part) => part.replace(/[()]/g, '')),
        ...normalizedValue.split(/[,/;-]/g)
    ]
        .map((candidate) => candidate.replace(/\.+$/g, '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    const uniqueCandidates = [...new Set(candidates)];
    const expectedValues = uniqueCandidates.map((candidate) => normalizeAutocompleteText(candidate)).filter(Boolean);
    const looseExpectedValues = expectedValues.map(normalizeAutocompleteLoose).filter(Boolean);
    const humanizedTypingAttempts = uniqueCandidates.flatMap((candidate) => {
            const clean = candidate.replace(/\.+$/g, '').replace(/\s+/g, ' ').trim();
            const normalized = normalizeAutocompleteText(clean);
            const words = clean.split(/\s+/g).filter(Boolean);
            const firstWord = words.find((word) => word.length >= 3) || clean;
            const twoWordProbe = words.length > 1
                ? [
                    `${words[0]} ${words[1].slice(0, 1)}`,
                    `${words[0]} ${words[1].slice(0, 2)}`,
                    `${words[0]} ${words[1].slice(0, 3)}`
                ]
                : [];
            const progressive = [];
            for (let size = 3; size <= Math.min(normalized.length, 8); size += 1) {
                progressive.push(clean.slice(0, size));
            }
            return [firstWord, ...twoWordProbe, ...progressive, clean];
        });
    const typingAttempts = humanizedTypingAttempts
        .map((candidate) => String(candidate || '').replace(/\.+$/g, '').replace(/\s+/g, ' ').trim())
        .filter((candidate) => candidate.length >= 3);
    const uniqueTypingAttempts = [...new Set(typingAttempts)];
    const deadline = Date.now() + (options.timeoutMs || 20000);
    const optionSelector = [
        '.p-autocomplete-panel [role="option"]',
        '.p-autocomplete-items [role="option"]',
        '.p-autocomplete-items li',
        '.p-autocomplete-list li',
        '.p-autocomplete-item',
        '.p-autocomplete-option',
        '.p-dropdown-item',
        '.ng-dropdown-panel .ng-option',
        '.ng-dropdown-panel .ng-option-label',
        '[data-pc-section="option"]',
        '[data-pc-section="item"]',
        '[role="option"]'
    ].join(', ');

    const textMatchesExpected = (optionText, expected) => {
        if (!expected || !optionText) return false;
        return autocompleteTextAccepts(optionText, expected);
    };

    const selectedTextMatchesExpected = (selectedText, expected) => {
        if (!expected || !selectedText) return false;
        return autocompleteTextAccepts(selectedText, expected);
    };

    const optionMatches = (optionText, optionAria) => expectedValues.some((expected, index) => {
        const looseExpected = looseExpectedValues[index] || expected;
        return textMatchesExpected(optionText, expected)
            || textMatchesExpected(optionText, looseExpected)
            || textMatchesExpected(optionAria, expected)
            || textMatchesExpected(optionAria, looseExpected);
    });

    const selectedValueMatches = (selectedText) => {
        const selected = normalizeAutocompleteText(selectedText);
        return expectedValues.some((expected, index) => {
            const looseExpected = looseExpectedValues[index] || expected;
            return selectedTextMatchesExpected(selected, expected)
                || selectedTextMatchesExpected(selected, looseExpected);
        });
    };

    const clickMatchingOption = async () => {
        const optionsList = page.locator(optionSelector);
        const count = await optionsList.count();
        for (let index = 0; index < count; index += 1) {
            const option = optionsList.nth(index);
            const isVisible = await option.isVisible().catch(() => false);
            if (!isVisible) continue;
            const rawText = await option.innerText().catch(() => '');
            const text = normalizeAutocompleteText(rawText);
            const aria = normalizeAutocompleteText(await option.getAttribute('aria-label').catch(() => ''));
            if (!optionMatches(text, aria)) continue;
            const box = await option.boundingBox().catch(() => null);
            if (box) {
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            } else {
                await option.click({ force: true });
            }
            await page.waitForTimeout(options.afterSelectWaitMs || 1800);
            const selectedValue = await readInputValue(input);
            const inputMatched = selectedValueMatches(selectedValue);
            if (!inputMatched) {
                await option.click({ force: true }).catch(() => null);
                await page.waitForTimeout(options.afterSelectWaitMs || 1800);
            }
            const confirmedValue = await readInputValue(input);
            const confirmedMatch = selectedValueMatches(confirmedValue);
            if (!confirmedMatch) continue;
            await page.waitForTimeout(500);
            return {
                ok: true,
                optionText: rawText.replace(/\s+/g, ' ').trim(),
                selectedValue: confirmedValue.replace(/\s+/g, ' ').trim(),
                inputMatched: true
            };
        }
        return { ok: false };
    };

    const waitAndClickMatchingOption = async (timeoutMs = 2500) => {
        const startedAt = Date.now();
        while ((Date.now() - startedAt) < timeoutMs) {
            const result = await clickMatchingOption();
            if (result.ok) return result;
            await page.waitForTimeout(300);
        }
        return { ok: false };
    };

    const selectFirstDropdownOptionWithKeyboard = async () => {
        await input.press('ArrowDown').catch(() => null);
        await page.waitForTimeout(500);
        await input.press('Enter').catch(() => null);
        await page.waitForTimeout(options.afterSelectWaitMs || 1800);
        const selectedValue = await readInputValue(input);
        if (!selectedValueMatches(selectedValue)) return { ok: false };
        return {
            ok: true,
            optionText: 'keyboard_first_option',
            selectedValue: selectedValue.replace(/\s+/g, ' ').trim(),
            inputMatched: true
        };
    };

    const typeCandidate = async (candidate, mode) => {
        await input.click({ force: true });
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => null);
        await page.keyboard.press('Backspace').catch(() => null);
        await page.waitForTimeout(options.beforeTypeWaitMs || 450);
        if (mode === 'paste') {
            await input.fill(candidate);
        } else if (mode === 'type') {
            await input.type(candidate, { delay: options.humanDelayMs || 180 });
        } else {
            await input.fill(candidate);
        }
        await page.waitForTimeout(options.afterTypeWaitMs || 1800);
    };

    while (Date.now() < deadline) {
        for (const candidate of uniqueTypingAttempts) {
            if (options.tryPasteFirst && candidate === uniqueTypingAttempts[0]) {
                await typeCandidate(candidate, 'paste');
                const pasteResult = await waitAndClickMatchingOption(5000);
                if (pasteResult.ok) return pasteResult;
            }
            await typeCandidate(candidate, 'type');
            const typeResult = await waitAndClickMatchingOption(candidate.length <= 5 ? 6500 : 4500);
            if (typeResult.ok) return typeResult;
            if (options.tryKeyboardFallback && candidate.length >= 5) {
                const keyboardResult = await selectFirstDropdownOptionWithKeyboard();
                if (keyboardResult.ok) return keyboardResult;
            }
        }

        await page.waitForTimeout(300);
    }

    const visibleOptions = await page.locator(optionSelector)
        .evaluateAll((nodes) => nodes
            .filter((node) => {
                const rect = node.getBoundingClientRect?.();
                return rect && rect.width > 0 && rect.height > 0;
            })
            .map((node) => String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .slice(0, 12))
        .catch(() => []);
    return { ok: false, reason: 'option_not_selected', visibleOptions };
};

const waitUntilEnabled = async (locator, timeoutMs = 10000) => {
    const startedAt = Date.now();
    while ((Date.now() - startedAt) < timeoutMs) {
        const count = await locator.count();
        for (let index = 0; index < count; index += 1) {
            const item = locator.nth(index);
            if (
                await item.isVisible().catch(() => false)
                && await item.isEnabled().catch(() => false)
            ) {
                return true;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
};

const getCarrierReadyState = async (page, cardSelector, { allowMissingPrice = false } = {}) => {
    const card = page.locator(cardSelector).first();
    if (!(await card.count()) || !(await card.isVisible().catch(() => false))) {
        return { ready: false, text: '' };
    }

    const state = await card.evaluate((node) => {
        const text = String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
        const classes = String(node.getAttribute('class') || '');
        return {
            disabled: classes.includes('disabled'),
            hasCalculatedPrice: /\$\s*\d/.test(text) && !/\$\s*-\s*-/.test(text),
            text
        };
    }).catch(() => ({ disabled: true, hasCalculatedPrice: false, text: '' }));

    return {
        ready: !state.disabled && (state.hasCalculatedPrice || allowMissingPrice),
        text: state.text || ''
    };
};

const waitForCarrierReady = async (page, cardSelector, timeoutMs = 30000, options = {}) => {
    const startedAt = Date.now();
    while ((Date.now() - startedAt) < timeoutMs) {
        const state = await getCarrierReadyState(page, cardSelector, options);
        if (state.ready) return true;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
};

const formatDecimalForDropiEc = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return String(value || '');
    return numericValue.toFixed(2).replace('.', ',');
};

const clickFirstVisible = async (page, selectorList, options = {}) => {
    for (const selector of selectorList) {
        const locator = page.locator(selector).first();
        if (
            await locator.count()
            && await locator.isVisible().catch(() => false)
            && (options.allowDisabled || await locator.isEnabled().catch(() => false))
        ) {
            if (options.center) {
                const box = await locator.boundingBox().catch(() => null);
                if (box) {
                    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                    return true;
                }
            }
            await locator.click({ force: Boolean(options.force || options.allowDisabled) });
            return true;
        }
    }
    return false;
};

const completeTwoFactorIfNeeded = async (page) => {
    if (!(await hasTwoFactorPrompt(page))) return false;
    const secret = getDropiEcTotpSecret();
    if (!secret) {
        throw buildNotReadyError('two-factor authentication required and DROPI_EC_TOTP_SECRET is missing');
    }
    const code = generateTotpCode({ secret });
    if (!code) {
        throw buildNotReadyError('two-factor authentication secret is invalid');
    }
    const otpInputs = page.locator('.container-otp input.otp-input, input.otp-input, input[inputmode="numeric"]');
    const otpCount = await otpInputs.count().catch(() => 0);
    let codeFilled = false;
    if (otpCount >= 6) {
        await otpInputs.first().click({ force: true }).catch(() => null);
        await page.keyboard.type(code, { delay: 70 }).catch(() => null);
        await page.waitForTimeout(300);

        const typedCode = await otpInputs.evaluateAll((nodes) => nodes
            .slice(0, 6)
            .map((node) => String(node.value || '').trim())
            .join('')).catch(() => '');

        for (let index = 0; index < 6; index += 1) {
            const digitInput = otpInputs.nth(index);
            const expectedDigit = code[index] || '';
            if (typedCode[index] === expectedDigit) continue;
            await digitInput.click({ force: true }).catch(() => null);
            await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => null);
            await page.keyboard.press('Backspace').catch(() => null);
            await digitInput.type(expectedDigit, { delay: 50 }).catch(async () => {
                await digitInput.fill(expectedDigit).catch(() => null);
            });
            await digitInput.evaluate((node) => {
                node.dispatchEvent(new Event('input', { bubbles: true }));
                node.dispatchEvent(new Event('change', { bubbles: true }));
                node.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                node.dispatchEvent(new Event('blur', { bubbles: true }));
            }).catch(() => null);
        }
        await page.waitForFunction(() => {
            const values = Array.from(document.querySelectorAll('.container-otp input.otp-input, input.otp-input, input[inputmode="numeric"]'))
                .slice(0, 6)
                .map((node) => String(node.value || '').trim())
                .join('');
            const buttons = Array.from(document.querySelectorAll('button'));
            const continueButton = buttons.find((button) => /continuar|verificar|validar|confirmar|enviar/i.test(button.innerText || button.textContent || ''));
            return values.length >= 6 && (!continueButton || !continueButton.disabled);
        }, { timeout: 10000 }).catch(() => null);
        codeFilled = true;
    } else {
        const input = await firstVisibleEnabled(page, selectors.twoFactorCode, 15000);
        if (!input) {
            throw buildNotReadyError('two-factor code selector not found');
        }
        await input.click();
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => null);
        await page.keyboard.press('Backspace').catch(() => null);
        await input.type(code, { delay: 80 });
        codeFilled = true;
    }
    if (!codeFilled) {
        throw buildNotReadyError('two-factor code selector not found');
    }
    await page.waitForTimeout(800);
    const clicked = await clickFirstVisible(page, [selectors.twoFactorSubmit]);
    if (!clicked) await page.keyboard.press('Enter').catch(() => null);
    await Promise.race([
        page.waitForURL(/\/dashboard\//, { timeout: 45000 }).catch(() => null),
        page.waitForFunction(() => Boolean(
            window.localStorage?.getItem('DROPI_token')
            || window.localStorage?.getItem('DROPI_SessionData')
            || window.localStorage?.getItem('casUser')
            || window.localStorage?.getItem('token')
            || window.sessionStorage?.getItem('access_token')
        ), null, { timeout: 45000 }).catch(() => null)
    ]);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
    if (await hasTwoFactorPrompt(page)) {
        throw buildNotReadyError('two-factor authentication did not complete');
    }
    return true;
};

const normalizeProductText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/POWERSS/g, 'POWERS')
    .replace(/\bX1\b/g, '')
    .replace(/[^A-Z0-9]/g, '');

const privateProductUrl = (rawUrl) => {
    const value = String(rawUrl || PRODUCT_URL || '').trim();
    try {
        const url = new URL(value);
        url.searchParams.set('privated', 'true');
        return url.toString();
    } catch {
        return value.includes('privated=true')
            ? value
            : `${value}${value.includes('?') ? '&' : '?'}privated=true`;
    }
};

const splitAliases = (value = '') => String(value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);

const dropiProductTargetForProduct = (productInfo = ECUADOR_UNKNOWN_PRODUCT) => {
    const isVitPower = productInfo.key === ECUADOR_PRODUCTS.vitPower.key;
    const isNitrix = productInfo.key === ECUADOR_PRODUCTS.nitrix.key;
    const isTexUltra = productInfo.key === ECUADOR_PRODUCTS.texUltra.key;
    const nitrixProductUrl = String(process.env.DROPPI_EC_NITRIX_PRODUCT_URL || '').trim();
    const texUltraProductUrl = String(process.env.DROPPI_EC_TEX_ULTRA_PRODUCT_URL || productInfo.dropiUrl || '').trim();
    const productUrl = isTexUltra
        ? (texUltraProductUrl ? privateProductUrl(texUltraProductUrl) : '')
        : isNitrix
            ? (nitrixProductUrl ? privateProductUrl(nitrixProductUrl) : '')
            : isVitPower
                ? PRIVATE_PRODUCT_URL
                : '';
    const productName = isTexUltra
        ? String(process.env.DROPPI_EC_TEX_ULTRA_PRODUCT_NAME || productInfo.dropiName || '').trim()
        : isNitrix
            ? (process.env.DROPPI_EC_NITRIX_PRODUCT_NAME || productInfo.dropiName)
            : isVitPower
                ? PRODUCT_NAME
                : '';
    const aliases = isTexUltra
        ? (splitAliases(process.env.DROPPI_EC_TEX_ULTRA_PRODUCT_ALIASES).length
            ? splitAliases(process.env.DROPPI_EC_TEX_ULTRA_PRODUCT_ALIASES)
            : productInfo.dropiAliases)
        : isNitrix
            ? (splitAliases(process.env.DROPPI_EC_NITRIX_PRODUCT_ALIASES).length
            ? splitAliases(process.env.DROPPI_EC_NITRIX_PRODUCT_ALIASES)
            : productInfo.dropiAliases)
            : isVitPower
                ? (PRODUCT_ALIASES.length ? PRODUCT_ALIASES : productInfo.dropiAliases)
                : [];
    return {
        key: productInfo.key,
        name: productName,
        productUrl,
        aliases
    };
};

const dropiProductTargetForOrder = (order = {}) => (
    dropiProductTargetForProduct(resolveEcuadorProductInfo(order))
);

const dropiProductTargetForPayload = (payload = {}) => (
    dropiProductTargetForProduct(resolveEcuadorProductInfo(payload))
);

const productMatchesTarget = (text, target = dropiProductTargetForProduct()) => {
    const normalizedText = normalizeProductText(text);
    return (target.aliases || []).some((alias) => normalizedText.includes(normalizeProductText(alias)));
};

const waitForProductTargetText = async (page, target, timeoutMs = 15000) => {
    await page.waitForFunction((aliases) => {
        const normalize = (value) => String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/POWERSS/g, 'POWERS')
            .replace(/\bX1\b/g, '')
            .replace(/[^A-Z0-9]/g, '');
        const body = normalize(document.body?.innerText || document.body?.textContent || '');
        return aliases.some((alias) => body.includes(normalize(alias)));
    }, target.aliases || [], { timeout: timeoutMs }).catch(() => null);
};

const openCreateOrderPanel = async (page, { timeoutMs = PRODUCT_CARD_WAIT_MS, target = dropiProductTargetForProduct() } = {}) => {
    const deadline = Date.now() + timeoutMs;
    let refreshed = false;
    let lastBodyText = '';

    while (Date.now() < deadline) {
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);

        const authState = await inspectDropiPageAuthState(page);
        if (authState.loginScreen) {
            throw buildNotReadyError('session expired while opening product; login required');
        }

        const productCards = page.locator('app-card-product');
        const count = await productCards.count();
        for (let index = 0; index < count; index += 1) {
            const productCard = productCards.nth(index);
            if (await productCard.isVisible().catch(() => false)) {
                const text = await productCard.innerText().catch(() => '');
                if (!productMatchesTarget(text, target)) continue;
                const button = productCard.getByText(/Enviar a cliente|Enviar al cliente/i).first();
                if (await button.count() && await button.isVisible().catch(() => false)) {
                    await button.click();
                    return true;
                }
            }
        }

        if (/\/product-details\//i.test(page.url())) {
            await waitForProductTargetText(page, target, Math.min(10000, Math.max(1000, deadline - Date.now())));
        }

        lastBodyText = (await page.locator('body').innerText({ timeout: 3000 }).catch(() => ''))
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 1500);

        const directButtonAllowed = productMatchesTarget(lastBodyText, target)
            && (/\/product-details\//i.test(page.url()) || count === 0);
        if (directButtonAllowed) {
            const directButton = await clickFirstVisible(page, [selectors.createOrderButton], { force: true });
            if (directButton) return true;
        }

        const sendButtons = page.getByText(/Enviar a cliente|Enviar al cliente/i);
        const buttonCount = await sendButtons.count().catch(() => 0);
        if (buttonCount === 1 && await sendButtons.first().isVisible().catch(() => false) && directButtonAllowed) {
            await sendButtons.first().click();
            return true;
        }

        if (!refreshed && Date.now() + Math.min(15000, timeoutMs / 2) < deadline) {
            refreshed = true;
            await page.goto(target.productUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
        }

        await page.waitForTimeout(2000);
    }
    throw buildNotReadyError(`private catalog product not found: ${target.name}${lastBodyText ? ` | page: ${lastBodyText}` : ''}`);
};

const pickCarrier = async (page, carrier, options = {}) => {
    const carrierReady = await waitForCarrierReady(
        page,
        carrier.cardSelector,
        carrier.timeoutMs || SHIPPING_QUOTE_WAIT_MS,
        options
    );
    if (!carrierReady) return false;
    const picked = await clickFirstVisible(page, [carrier.optionSelector], {
        center: true,
        force: Boolean(options.force),
        allowDisabled: Boolean(options.allowDisabled)
    });
    return picked ? carrier.code : false;
};

const pickFirstAvailableCarrier = async (page, carriers, timeoutMs = SHIPPING_QUOTE_WAIT_MS) => {
    const startedAt = Date.now();
    while ((Date.now() - startedAt) < timeoutMs) {
        for (const carrier of carriers) {
            const state = await getCarrierReadyState(page, carrier.cardSelector);
            if (!state.ready) continue;
            const picked = await clickFirstVisible(page, [carrier.optionSelector], { center: true });
            if (picked) return carrier.code;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
};

const collectCarrierDiagnostics = async (page) => page.locator('.card-logistic').evaluateAll((nodes) => nodes
    .map((node) => String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 8)).catch(() => []);

const createPageDiagnosticsCollector = (page) => {
    const events = [];
    const push = (event) => {
        events.push(event);
        if (events.length > 30) events.shift();
    };

    page.on('console', (msg) => {
        if (!['error', 'warning'].includes(msg.type())) return;
        push({ type: 'console', level: msg.type(), text: msg.text().slice(0, 500) });
    });
    page.on('pageerror', (error) => {
        push({ type: 'pageerror', text: (error.message || String(error)).slice(0, 500) });
    });
    page.on('requestfailed', (request) => {
        push({
            type: 'requestfailed',
            method: request.method(),
            url: request.url().slice(0, 300),
            failure: request.failure()?.errorText || ''
        });
    });

    return () => events.slice(-12);
};

const createShippingQuoteCollector = (page) => {
    const quotes = [];

    page.on('request', (request) => {
        if (!/\/orders\/cotizaEnvioTransportadoraV2/i.test(request.url())) return;
        let postData = null;
        try {
            postData = JSON.parse(request.postData() || 'null');
        } catch {
            postData = null;
        }
        quotes.push({ payload: postData, response: null });
        if (quotes.length > 10) quotes.shift();
    });

    page.on('response', async (response) => {
        if (!/\/orders\/cotizaEnvioTransportadoraV2/i.test(response.url())) return;
        const body = await response.json().catch(() => null);
        const latestWithoutResponse = [...quotes].reverse().find((quote) => !quote.response);
        if (latestWithoutResponse) {
            latestWithoutResponse.response = body;
        } else {
            quotes.push({ payload: null, response: body });
        }
        if (quotes.length > 10) quotes.shift();
    });

    return () => [...quotes].reverse().find((quote) => quote.payload && quote.response) || null;
};

const normalizeCarrierCode = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();

const quoteIncludesCarrier = (quote, carrierCode) => {
    const expected = normalizeCarrierCode(carrierCode);
    return Boolean(quote?.response?.objects?.some((item) => (
        normalizeCarrierCode(item?.distributionCompany?.name) === expected
    )));
};

const chooseCarrierFromQuote = (quote, preferredCarrier = '') => {
    const carriers = Array.isArray(quote?.response?.objects) ? quote.response.objects : [];
    if (!carriers.length) return '';
    const preferred = normalizeCarrierCode(preferredCarrier);
    const preferredMatch = preferred
        ? carriers.find((item) => normalizeCarrierCode(item?.distributionCompany?.name) === preferred)
        : null;
    const selected = preferredMatch
        || carriers.find((item) => normalizeCarrierCode(item?.distributionCompany?.name) === 'SERVIENTREGA')
        || carriers[0];
    return String(selected?.distributionCompany?.name || '').trim();
};

const quoteDestinationMatchesPayload = (quote, payload = {}) => {
    const quotedCity = quote?.payload?.ciudad_destino?.name || quote?.payload?.city?.name || '';
    const quotedDepartment = quote?.payload?.departamento_destino?.name || quote?.payload?.state?.name || '';
    if (!quotedCity || !quotedDepartment) return false;
    return autocompleteTextAccepts(quotedCity, payload.city)
        && autocompleteTextAccepts(quotedDepartment, payload.department);
};

const quoteHasCarrierOptions = (quote) => Array.isArray(quote?.response?.objects)
    && quote.response.objects.length > 0;

const quoteUsableForPayload = (quote, payload = {}, selected = {}) => {
    if (!quote?.payload || !quote?.response) return false;
    if (quoteDestinationMatchesPayload(quote, payload)) return true;
    const quotedCity = quote.payload?.ciudad_destino?.name || quote.payload?.city?.name || '';
    const quotedDepartment = quote.payload?.departamento_destino?.name || quote.payload?.state?.name || '';
    const selectedCity = selected.city || '';
    const selectedDepartment = selected.department || '';
    return Boolean(
        quoteHasCarrierOptions(quote)
        && autocompleteTextAccepts(selectedCity, payload.city)
        && autocompleteTextAccepts(selectedDepartment, payload.department)
        && (!quotedCity || autocompleteTextAccepts(quotedCity, selectedCity) || autocompleteTextAccepts(quotedCity, payload.city))
        && (!quotedDepartment || autocompleteTextAccepts(quotedDepartment, selectedDepartment) || autocompleteTextAccepts(quotedDepartment, payload.department))
    );
};

const waitForShippingQuote = async (getLatestQuote, payload, timeoutMs = SHIPPING_QUOTE_WAIT_MS) => {
    const startedAt = Date.now();
    let latestQuote = null;
    while ((Date.now() - startedAt) < timeoutMs) {
        latestQuote = getLatestQuote();
        if (latestQuote?.payload && latestQuote?.response && quoteDestinationMatchesPayload(latestQuote, payload)) {
            return latestQuote;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return latestQuote;
};

const triggerShippingQuoteRefresh = async (page) => {
    await page.locator(selectors.city).first().press('Tab').catch(() => null);
    await page.locator(selectors.address).first().click({ force: true }).catch(() => null);
    await page.waitForTimeout(500);
    await clickFirstVisible(page, [selectors.recaudoButton], { force: true }).catch(() => null);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
};

const submitOrderViaDropiApi = async (page, { payload, quote, chosenCarrier }) => {
    const quotePayload = quote?.payload;
    const quoteResponse = quote?.response;
    const carrier = quoteResponse?.objects?.find((item) => (
        normalizeCarrierCode(item?.distributionCompany?.name) === normalizeCarrierCode(chosenCarrier)
    ));

    if (!quotePayload || !carrier) {
        throw buildNotReadyError('shipping quote data not available for direct api submit');
    }

    return page.evaluate(({ orderPayload, quotePayloadArg, carrierArg }) => {
        const parseStorageJson = (key, fallback = null) => {
            try {
                return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
            } catch {
                return fallback;
            }
        };
        const token = parseStorageJson('DROPI_token', '');
        const loginResult = parseStorageJson('DROPI_LoginResult', {});
        const requestedQuantity = Math.max(1, Number(orderPayload.quantity || 1) || 1);
        const requestedUnitPrice = Number(orderPayload.unitPrice || 0)
            || (Number(orderPayload.price || 0) > 0 ? Number(orderPayload.price || 0) / requestedQuantity : 0)
            || Number((quotePayloadArg.products || [])[0]?.price || 0);
        const products = (quotePayloadArg.products || []).map((item) => ({
            id: item.id,
            name: item.name,
            weight: item.weight,
            stock: item.stock,
            variation_id: item.variation_id,
            quantity: requestedQuantity,
            price: requestedUnitPrice,
            suggested_price: item.suggested_price,
            sale_price: requestedUnitPrice,
            variations: item.variations,
            type: item.type,
            user_id: item.user_id
        }));
        const product = products[0] || {};
        const phoneDigits = String(orderPayload.phone || '').replace(/\D/g, '');
        const phone = phoneDigits.startsWith('593') ? phoneDigits : `593${phoneDigits}`;
        const destinationState = quotePayloadArg.departamento_destino?.name
            || quotePayloadArg.state?.name
            || orderPayload.department;
        const destinationCity = quotePayloadArg.ciudad_destino?.name
            || quotePayloadArg.city?.name
            || orderPayload.city;
        const totalOrder = products.reduce(
            (sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)),
            0
        );
        const data = {
            total_order: totalOrder,
            notes: orderPayload.reference || '',
            name: orderPayload.firstName,
            surname: orderPayload.lastName,
            dir: orderPayload.address,
            country: loginResult.configurations?.[0]?.country || 'ECUADOR',
            state: destinationState,
            city: destinationCity,
            phone,
            client_email: orderPayload.email || '',
            payment_method_id: 1,
            user_id: loginResult.objects?.id,
            supplier_id: product.user_id,
            type: 'FINAL_ORDER',
            rate_type: 'CON RECAUDO',
            products,
            distributionCompany: {
                id: carrierArg.distributionCompany.id,
                name: carrierArg.distributionCompany.name
            },
            type_service: carrierArg.transportadora_service || 'normal',
            zip_code: null,
            colonia: null,
            shop_id: null,
            dni: '',
            dni_type: '',
            insurance: false,
            shalom_data: null,
            warehouses_selected_id: quotePayloadArg.warehouse?.id,
            shipping_amount: carrierArg.objects?.precioEnvio
        };

        return fetch('https://api.dropi.ec/api/orders/myorders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Authorization': `Bearer ${token}`,
                'x-captcha-token': ''
            },
            body: JSON.stringify(data)
        }).then(async (response) => ({
            ok: response.ok,
            status: response.status,
            body: await response.json().catch(async () => response.text()),
            submittedDestination: {
                state: data.state,
                city: data.city,
                carrier: data.distributionCompany?.name || '',
                shippingAmount: data.shipping_amount
            }
        }));
    }, { orderPayload: payload, quotePayloadArg: quotePayload, carrierArg: carrier });
};

const parseDropiCreatedAtMs = (row = {}) => {
    const raw = row.created_at || row.createdAt || row.date || row.fecha || '';
    if (!raw) return 0;
    const parsed = Date.parse(String(raw).replace(' ', 'T'));
    return Number.isFinite(parsed) ? parsed : 0;
};

const recentlyCreatedRowMatchesPayload = (row = {}, payload = {}, startedAtMs = Date.now()) => {
    const createdAtMs = parseDropiCreatedAtMs(row);
    if (!createdAtMs || createdAtMs < (startedAtMs - 120000)) return false;

    const rowPhone = String(row.phone || '').replace(/\D/g, '');
    const payloadPhones = phoneLookupVariants(payload.phone || '').filter((term) => term.length >= 8);
    const phoneMatches = rowPhone && payloadPhones.some((term) => rowPhone.endsWith(term) || term.endsWith(rowPhone));
    if (!phoneMatches) return false;

    const rowName = normalizeAutocompleteText([row.name, row.surname].filter(Boolean).join(' '));
    const expectedNameParts = normalizeAutocompleteText([payload.firstName, payload.lastName].filter(Boolean).join(' '))
        .split(/\s+/)
        .filter((part) => part.length >= 3);
    const nameMatches = !expectedNameParts.length || expectedNameParts.some((part) => rowName.includes(part));
    return nameMatches;
};

const findRecentOrderViaOrdersApi = async (page, payload, startedAtMs) => {
    const terms = [
        payload.phone,
        [payload.firstName, payload.lastName].filter(Boolean).join(' ')
    ].filter(Boolean);
    for (const term of [...new Set(terms)]) {
        const result = await fetchOrdersApiRows(page, term).catch(() => ({ rows: [] }));
        const row = (result.rows || []).find((candidate) => recentlyCreatedRowMatchesPayload(candidate, payload, startedAtMs));
        if (row) {
            return mapOrdersApiRowToSyncResult(row, {
                orderId: payload.orderId,
                client: {
                    phone: payload.phone,
                    name: [payload.firstName, payload.lastName].filter(Boolean).join(' '),
                    address: payload.address,
                    city: payload.city,
                    province: payload.department
                },
                logistics: {
                    trackingNumber: '',
                    status: '',
                    distributionCompany: payload.preferredCarrier || '',
                    chosenCarrier: payload.preferredCarrier || '',
                    agencyName: payload.agencyPickup ? payload.address : '',
                    agencyPickup: Boolean(payload.agencyPickup)
                },
                raw: {}
            });
        }
    }
    return { panelMatched: false };
};

const submitOrderViaPanelButton = async (page, { payload, preparedForm }) => {
    const submitButton = await firstVisibleEnabled(
        page,
        '.p-dialog-footer button:has-text("Enviar al cliente"), app-footer-products-order button:has-text("Enviar al cliente")',
        30000
    );
    if (!submitButton) {
        return {
            ok: false,
            reason: 'submit_button_not_enabled',
            bodyText: (await page.locator('body').innerText({ timeout: 3000 }).catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 500)
        };
    }

    const submitStartedAt = Date.now();
    await submitButton.click({ force: true });
    const creationResult = await waitForOrderCreationResult(page, ORDER_CREATION_WAIT_MS);
    const apiConfirmation = await findRecentOrderViaOrdersApi(page, payload, submitStartedAt).catch(() => ({ panelMatched: false }));
    const confirmation = apiConfirmation.panelMatched
        ? { ok: true, panelText: JSON.stringify(apiConfirmation.rawRow || {}) }
        : {
            ok: false,
            panelText: creationResult.bodyText || '',
            reason: creationResult.ok ? 'recent_dropi_order_not_found_after_panel_submit' : (creationResult.reason || 'panel_submit_not_confirmed')
        };

    if (!confirmation.ok) {
        return {
            ok: false,
            reason: confirmation.reason || creationResult.reason || 'panel_submit_not_confirmed',
            bodyText: (creationResult.bodyText || confirmation.panelText || '').slice(0, 500)
        };
    }

    return {
        ok: true,
        chosenCarrier: preparedForm.chosenCarrier,
        selectedDepartment: preparedForm.selectedDepartment,
        selectedCity: preparedForm.selectedCity,
        quotedDepartment: preparedForm.quotedDepartment,
        quotedCity: preparedForm.quotedCity,
        submittedDestination: {
            state: preparedForm.quotedDepartment || preparedForm.selectedDepartment || payload.department,
            city: preparedForm.quotedCity || preparedForm.selectedCity || payload.city,
            carrier: preparedForm.chosenCarrier || payload.preferredCarrier || ''
        },
        verifiedDropiOrderId: apiConfirmation.dropiOrderId || '',
        verifiedTrackingNumber: apiConfirmation.trackingNumber || '',
        apiConfirmation,
        panelMatched: Boolean(apiConfirmation.panelMatched || confirmation.ok),
        dropiResponse: apiConfirmation.rawRow ? { objects: apiConfirmation.rawRow } : {}
    };
};

const waitForOrderCreationResult = async (page, timeoutMs = 90000) => {
    const startedAt = Date.now();
    let lastBodyText = '';
    while ((Date.now() - startedAt) < timeoutMs) {
        lastBodyText = (await page.locator('body').innerText({ timeout: 3000 }).catch(() => ''))
            .replace(/\s+/g, ' ')
            .trim();

        if (/orden\s+creada|pedido\s+creado|cread[ao]\s+correctamente|orden\s+generada|pedido\s+generado|mis pedidos/i.test(lastBodyText)) {
            return { ok: true, bodyText: lastBodyText };
        }

        if (/error|no se pudo|int[eé]ntalo|intentalo|fall[oó]|inv[aá]lid|saldo|cr[eé]dito|credito|balance|credit/i.test(lastBodyText)) {
            return {
                ok: false,
                bodyText: lastBodyText,
                reason: isDropiPaymentRequiredError(lastBodyText)
                    ? 'dropi_payment_required'
                    : 'order_creation_error'
            };
        }

        if (!/creando\s+orden|por favor,\s*espere/i.test(lastBodyText)) {
            await page.waitForTimeout(3000);
            const nextBodyText = (await page.locator('body').innerText({ timeout: 3000 }).catch(() => ''))
                .replace(/\s+/g, ' ')
                .trim();
            if (/orden\s+creada|pedido\s+creado|cread[ao]\s+correctamente|orden\s+generada|pedido\s+generado|mis pedidos/i.test(nextBodyText)) {
                return { ok: true, bodyText: nextBodyText || lastBodyText };
            }
            if (isDropiPaymentRequiredError(nextBodyText)) {
                return { ok: false, bodyText: nextBodyText || lastBodyText, reason: 'dropi_credit_or_balance_error' };
            }
            if (!/creando\s+orden|por favor,\s*espere/i.test(nextBodyText)) {
                return { ok: false, bodyText: nextBodyText || lastBodyText, reason: 'order_creation_unconfirmed' };
            }
        }

        await page.waitForTimeout(3000);
    }

    return {
        ok: false,
        bodyText: lastBodyText,
        reason: 'order_creation_timeout'
    };
};

const normalizeLookupTerm = (value) => String(value || '').replace(/\D/g, '') || String(value || '').trim();

const findPanelTextByTerms = async (page, terms) => {
    const lookupTerms = terms
        .map(normalizeLookupTerm)
        .filter((value) => value && value.length >= 3);
    if (!lookupTerms.length) return '';

    return page.locator('tr, .table-responsive tbody tr, .card, .row, [role="row"]').evaluateAll((elements, expectedTerms) => {
        const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        for (const element of elements) {
            const text = normalize(element.innerText || element.textContent || '');
            if (!text) continue;
            const digits = text.replace(/\D/g, '');
            if (expectedTerms.some((term) => text.includes(term) || digits.includes(term))) {
                return text;
            }
        }
        return '';
    }, lookupTerms).catch(() => '');
};

const confirmOrderInOrdersPanel = async (page, payload) => {
    await page.goto(ORDERS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);

    const search = page.locator(selectors.ordersSearch).first();
    if (!(await search.count())) {
        return { ok: false, reason: 'orders_search_selector_not_found', panelText: '' };
    }

    const fullName = [payload.firstName, payload.lastName].filter(Boolean).join(' ');
    const lookupTerms = [payload.orderId, payload.phone, fullName].filter(Boolean);
    const searchTerms = [payload.phone, payload.orderId, fullName].filter(Boolean);
    for (const term of searchTerms) {
        await search.fill(String(term));
        await page.keyboard.press('Enter').catch(() => null);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
        await page.waitForTimeout(2500);
        const panelText = await findPanelTextByTerms(page, lookupTerms);
        if (panelText) return { ok: true, panelText };
    }

    const bodyText = (await page.locator('body').innerText({ timeout: 3000 }).catch(() => ''))
        .replace(/\s+/g, ' ')
        .trim();
    return { ok: false, reason: 'order_not_found_in_orders_panel', panelText: bodyText.slice(0, 500) };
};

export const performLogin = async (page) => {
    if (getUsableStorageStatePath()) {
        await page.goto(ORDERS_URL, { waitUntil: 'domcontentloaded' }).catch(() => null);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
        const storedAuthState = await inspectDropiPageAuthState(page);
        if (storedAuthState.authenticated) return;
    }

    const email = process.env[EMAIL_ENV];
    const password = process.env[PASSWORD_ENV];
    if (!email || !password) {
        throw buildNotReadyError(`missing ${EMAIL_ENV} or ${PASSWORD_ENV}`);
    }

    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => null);
    const loginInput = await firstVisibleEnabled(page, selectors.loginEmail, 20000);
    if (!loginInput) {
        throw buildNotReadyError('login user selector not found');
    }
    await fillInputIfVisible(page, selectors.loginEmail, email);
    await fillInputIfVisible(page, selectors.loginPassword, password);
    await page.waitForTimeout(500);
    const clicked = await clickFirstVisible(page, [selectors.loginSubmit]);
    if (!clicked) {
        throw buildNotReadyError('login submit selector not found');
    }
    await page.waitForFunction(() => {
        const loginPath = /\/(auth\/)?login\b/i.test(window.location.pathname);
        const bodyText = String(document.body?.innerText || document.body?.textContent || '');
        const loginPrompt = /usuario\s+contrase[nñ]a|iniciar sesi[oó]n|olvid[oó] su contrase[nñ]a|username\s+password|forgot password|remember me|log in/i.test(bodyText);
        const twoFactorPrompt = /autenticaci[oó]n de dos factores|two[-\s]?factor|authenticator|otp|c[oó]digo de verificaci[oó]n|codigo de seguridad|six digits|seis d[ií]gitos/i.test(bodyText);
        return twoFactorPrompt || (!loginPath && !loginPrompt);
    }, null, { timeout: 45000 }).catch(() => null);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
    if (await hasTwoFactorPrompt(page)) {
        await completeTwoFactorIfNeeded(page);
    }
    if ((await inspectDropiPageAuthState(page)).loginScreen) {
        throw buildNotReadyError(`login did not reach dashboard: ${await getPageExcerpt(page)}`);
    }
    if (!/\/dashboard\//i.test(page.url())) {
        await page.goto(ORDERS_URL, { waitUntil: 'domcontentloaded' }).catch(() => null);
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
    }
    if ((await inspectDropiPageAuthState(page)).loginScreen) {
        throw buildNotReadyError(`login session still on login screen: ${await getPageExcerpt(page)}`);
    }
};

const persistStorageState = async (context) => {
    ensureDir(path.dirname(STORAGE_STATE_PATH));
    await context.storageState({ path: STORAGE_STATE_PATH });
    fs.chmodSync(STORAGE_STATE_PATH, 0o600);
};

const withBrowserSession = async (work) => {
    const { chromium } = await getPlaywright();
    ensureDir(DOWNLOAD_DIR);

    const browser = await chromium.launch({
        headless: String(process.env.DROPPI_EC_HEADLESS || '1') !== '0'
    });

    let context;
    try {
        context = await browser.newContext({
            acceptDownloads: true,
            storageState: getUsableStorageStatePath()
        });
        const page = await context.newPage();
        return await withTimeout(
            work({ browser, context, page }),
            BROWSER_WORK_TIMEOUT_MS,
            'dropi_browser_session_timeout'
        );
    } finally {
        if (context) await context.close().catch(() => null);
        await browser.close().catch(() => null);
    }
};

const closeManualBrowserSession = async (key) => {
    const previous = manualBrowserSessions.get(key);
    if (!previous) return;
    manualBrowserSessions.delete(key);
    await previous.context?.close?.().catch(() => null);
    await previous.browser?.close?.().catch(() => null);
};

export const fillOrderFormInPanel = async ({ page, payload, quoteCollector = null, manualDraftOnly = false }) => {
    const getLatestQuote = quoteCollector || createShippingQuoteCollector(page);
    const productTarget = dropiProductTargetForPayload(payload);

    await page.goto(productTarget.productUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);

    const opened = await openCreateOrderPanel(page, {
        timeoutMs: manualDraftOnly ? 20000 : PRODUCT_CARD_WAIT_MS,
        target: productTarget
    });
    if (!opened) {
        throw buildNotReadyError('create order button not found');
    }

    await fillInputIfVisible(page, selectors.firstName, payload.firstName);
    await fillInputIfVisible(page, selectors.lastName, payload.lastName);
    await fillInputIfVisible(page, selectors.phone, payload.phone);
    const manualWaitMs = 5000;
    const departmentSelected = await selectAutocompleteValue(page, selectors.department, payload.department, {
        timeoutMs: manualDraftOnly ? manualWaitMs : CITY_RELEASE_WAIT_MS,
        humanDelayMs: 260,
        beforeTypeWaitMs: 650,
        afterTypeWaitMs: 2200,
        tryPasteFirst: true,
        tryKeyboardFallback: true
    });
    if (!departmentSelected.ok && !manualDraftOnly) {
        throw buildNotReadyError(
            `department option not selected: ${payload.department || ''}`
            + `${departmentSelected.visibleOptions?.length ? ` | options: ${departmentSelected.visibleOptions.join(' || ').slice(0, 500)}` : ''}`
        );
    }
    const cityFieldReady = departmentSelected.ok
        ? await waitUntilEnabled(page.locator(selectors.city), manualDraftOnly ? manualWaitMs : CITY_RELEASE_WAIT_MS)
        : false;
    if (!cityFieldReady && !manualDraftOnly) throw buildNotReadyError('city field did not unlock after department selection');
    const citySelected = cityFieldReady
        ? await selectAutocompleteValue(page, selectors.city, payload.city, {
            timeoutMs: manualDraftOnly ? manualWaitMs : CITY_RELEASE_WAIT_MS,
            humanDelayMs: 280,
            beforeTypeWaitMs: 700,
            afterTypeWaitMs: 2600,
            tryPasteFirst: true,
            tryKeyboardFallback: true
        })
        : { ok: false };
    if (!citySelected.ok && !manualDraftOnly) {
        throw buildNotReadyError(
            `city option not selected: ${payload.city || ''}`
            + `${citySelected.visibleOptions?.length ? ` | options: ${citySelected.visibleOptions.join(' || ').slice(0, 500)}` : ''}`
        );
    }
    await fillInputIfVisible(page, selectors.address, payload.address);
    if (!manualDraftOnly) {
        await page.waitForTimeout(2500);
        await triggerShippingQuoteRefresh(page);
        await page.waitForTimeout(1500);
    }
    await fillInputIfVisible(page, selectors.address, payload.address);
    await fillInputIfVisible(page, selectors.email, payload.email);
    await fillNumericInputIfVisible(page, selectors.priceInput, payload.unitPrice || payload.price);
    await fillNumericInputIfVisible(page, selectors.quantityInput, payload.quantity);

    if (manualDraftOnly) {
        return {
            manualDraftOnly: true,
            departmentSelected: Boolean(departmentSelected.ok),
            citySelected: Boolean(citySelected.ok),
            chosenCarrier: '',
            message: 'Campos principais preenchidos. Confira cidade/transportadora e confirme manualmente.'
        };
    }

    await clickFirstVisible(page, [selectors.recaudoButton], { force: true });
    let latestQuote = await waitForShippingQuote(getLatestQuote, payload, Math.min(SHIPPING_QUOTE_WAIT_MS, 30000));
    let quoteRefreshAttempts = 0;
    while (
        (!latestQuote?.payload || !latestQuote?.response || !quoteDestinationMatchesPayload(latestQuote, payload))
        && quoteRefreshAttempts < 2
    ) {
        quoteRefreshAttempts += 1;
        await triggerShippingQuoteRefresh(page);
        if (cityFieldReady) {
            await selectAutocompleteValue(page, selectors.city, payload.city, {
                timeoutMs: Math.min(CITY_RELEASE_WAIT_MS, 15000),
                humanDelayMs: 280,
                beforeTypeWaitMs: 700,
                afterTypeWaitMs: 2600,
                tryPasteFirst: true,
                tryKeyboardFallback: true
            }).catch(() => ({ ok: false }));
        }
        await fillInputIfVisible(page, selectors.address, payload.address);
        await fillNumericInputIfVisible(page, selectors.priceInput, payload.unitPrice || payload.price);
        await fillNumericInputIfVisible(page, selectors.quantityInput, payload.quantity);
        await clickFirstVisible(page, [selectors.recaudoButton], { force: true });
        latestQuote = await waitForShippingQuote(getLatestQuote, payload, Math.min(SHIPPING_QUOTE_WAIT_MS, 30000));
    }

    const carrierOrder = [
        { code: 'SERVIENTREGA', cardSelector: selectors.servientregaCard, optionSelector: selectors.servientregaOption, timeoutMs: SHIPPING_QUOTE_WAIT_MS },
        { code: 'LAARCOURIER', cardSelector: selectors.laarcourierCard, optionSelector: selectors.laarcourierOption, timeoutMs: SHIPPING_QUOTE_WAIT_MS },
        { code: 'VELOCES', cardSelector: selectors.velocesCard, optionSelector: selectors.velocesOption, timeoutMs: SHIPPING_QUOTE_WAIT_MS },
        { code: 'GINTRACOM', cardSelector: selectors.gintracomCard, optionSelector: selectors.gintracomOption, timeoutMs: SHIPPING_QUOTE_WAIT_MS },
        { code: 'URBANO', cardSelector: selectors.urbanoCard, optionSelector: selectors.urbanoOption, timeoutMs: SHIPPING_QUOTE_WAIT_MS },
        { code: 'ROCKET', cardSelector: selectors.rocketCard, optionSelector: selectors.rocketOption, timeoutMs: SHIPPING_QUOTE_WAIT_MS }
    ];

    let chosenCarrier = false;
    let carrierPicked = false;

    if (payload.agencyPickup) {
        if (quoteIncludesCarrier(latestQuote, 'SERVIENTREGA')) {
            chosenCarrier = 'SERVIENTREGA';
            carrierPicked = true;
            await clickFirstVisible(page, [selectors.servientregaOption], { center: true, force: true, allowDisabled: true }).catch(() => null);
        } else {
            chosenCarrier = await pickCarrier(page, carrierOrder[0]);
            carrierPicked = Boolean(chosenCarrier);
        }
    } else {
        chosenCarrier = await pickFirstAvailableCarrier(page, carrierOrder);
        carrierPicked = Boolean(chosenCarrier);
        if (!carrierPicked) {
            latestQuote = await waitForShippingQuote(getLatestQuote, payload, 10000);
        }
        if (!carrierPicked && quoteUsableForPayload(latestQuote, payload, {
            city: citySelected.selectedValue || citySelected.optionText || '',
            department: departmentSelected.selectedValue || departmentSelected.optionText || ''
        })) {
            chosenCarrier = chooseCarrierFromQuote(latestQuote, payload.preferredCarrier);
            carrierPicked = Boolean(chosenCarrier);
        }
    }

    if (!carrierPicked && payload.agencyPickup) {
        latestQuote = await waitForShippingQuote(getLatestQuote, payload, 10000);
        if (quoteIncludesCarrier(latestQuote, 'SERVIENTREGA')) {
            chosenCarrier = 'SERVIENTREGA';
            carrierPicked = true;
        }
    }

    if (!carrierPicked && payload.agencyPickup) {
        const carrierDiagnostics = await collectCarrierDiagnostics(page);
        const quotedCity = latestQuote?.payload?.ciudad_destino?.name || '';
        const quotedDepartment = latestQuote?.payload?.departamento_destino?.name || '';
        const quoteReason = !latestQuote?.payload || !latestQuote?.response
            ? 'shipping quote did not run/return after city selection'
            : (!quoteDestinationMatchesPayload(latestQuote, payload)
                ? `shipping quote destination mismatch: expected ${payload.department || ''}/${payload.city || ''}, got ${quotedDepartment || 'empty'}/${quotedCity || 'empty'}`
                : (quoteHasCarrierOptions(latestQuote)
                    ? 'servientrega not returned in shipping quote for agency pickup'
                    : 'shipping quote returned without carrier options'));
        throw buildNotReadyError(
            quoteReason
            + `${quotedCity ? ` | quoted city: ${quotedCity}` : ''}`
            + `${carrierDiagnostics.length ? ` | carriers: ${carrierDiagnostics.join(' || ').slice(0, 700)}` : ''}`
        );
    }

    if (!carrierPicked) {
        const carrierDiagnostics = await collectCarrierDiagnostics(page);
        const quotedCity = latestQuote?.payload?.ciudad_destino?.name || latestQuote?.payload?.city?.name || '';
        const quotedDepartment = latestQuote?.payload?.departamento_destino?.name || latestQuote?.payload?.state?.name || '';
        const carrierNames = (latestQuote?.response?.objects || [])
            .map((item) => item?.distributionCompany?.name)
            .filter(Boolean)
            .join(', ');
        throw buildNotReadyError(
            'servientrega/laarcourier selector not found'
            + `${quotedDepartment || quotedCity ? ` | quote: ${quotedDepartment || 'empty'}/${quotedCity || 'empty'}` : ''}`
            + `${carrierNames ? ` | quote carriers: ${carrierNames}` : ''}`
            + `${carrierDiagnostics.length ? ` | cards: ${carrierDiagnostics.join(' || ').slice(0, 700)}` : ''}`
        );
    }
    await page.waitForTimeout(1000);
    const refreshedQuote = getLatestQuote();
    if (refreshedQuote?.payload && refreshedQuote?.response && quoteDestinationMatchesPayload(refreshedQuote, payload)) {
        latestQuote = refreshedQuote;
    }
    const quotedCity = latestQuote?.payload?.ciudad_destino?.name || '';
    const quotedDepartment = latestQuote?.payload?.departamento_destino?.name || '';
    if (!autocompleteTextAccepts(quotedCity, payload.city)) {
        throw buildNotReadyError(`city was not accepted by Dropi quote: expected ${payload.city || ''}, got ${quotedCity || 'empty'}`);
    }
    return {
        chosenCarrier,
        formReady: true,
        selectedDepartment: departmentSelected.selectedValue || departmentSelected.optionText || '',
        selectedCity: citySelected.selectedValue || citySelected.optionText || '',
        quotedCity,
        quotedDepartment,
        latestQuote
    };
};

const submitOrderInPanel = async ({ page, payload }) => {
    const getDiagnostics = createPageDiagnosticsCollector(page);
    const getLatestQuote = createShippingQuoteCollector(page);
    const preparedForm = await fillOrderFormInPanel({ page, payload, quoteCollector: getLatestQuote });

    const quote = preparedForm.latestQuote || getLatestQuote();
    const apiResult = await submitOrderViaDropiApi(page, { payload, quote, chosenCarrier: preparedForm.chosenCarrier });
    if (!apiResult.ok || !apiResult.body?.isSuccess) {
        const message = apiResult.body?.message || apiResult.body?.error || `api_status_${apiResult.status}`;
        const destination = apiResult.submittedDestination
            ? ` | destination: ${apiResult.submittedDestination.state || ''}/${apiResult.submittedDestination.city || ''} via ${apiResult.submittedDestination.carrier || ''}`
            : '';
        const panelFallback = await submitOrderViaPanelButton(page, { payload, preparedForm }).catch((error) => ({
            ok: false,
            reason: error.message || 'panel_button_submit_failed',
            bodyText: ''
        }));
        if (panelFallback.ok) return panelFallback;
        const fallbackReason = panelFallback.reason
            ? ` | panel fallback: ${panelFallback.reason}${panelFallback.bodyText ? `: ${String(panelFallback.bodyText).slice(0, 240)}` : ''}`
            : '';
        throw buildNotReadyError(`direct api submit failed: ${message}${destination}${fallbackReason}`);
    }
    const apiDropiOrderId = String(apiResult.body?.objects?.id || '').trim();
    const apiTrackingNumber = String(apiResult.body?.objects?.sticker || '').trim();

    const creationResult = await waitForOrderCreationResult(page, Math.min(ORDER_CREATION_WAIT_MS, 10000));
    const apiConfirmation = await findOrderViaOrdersApi(page, {
        orderId: apiResult.body?.objects?.id || '',
        client: {
            phone: payload.phone,
            name: [payload.firstName, payload.lastName].filter(Boolean).join(' ')
        },
        logistics: {
            trackingNumber: apiResult.body?.objects?.sticker || ''
        }
    }).catch(() => ({ panelMatched: false }));
    const confirmation = apiConfirmation.panelMatched
        ? { ok: true, panelText: JSON.stringify(apiConfirmation.rawRow || {}) }
        : await confirmOrderInOrdersPanel(page, payload);
    if (!confirmation.ok) {
        const diagnostics = getDiagnostics()
            .map((event) => `${event.type}:${event.level || ''}:${event.text || event.failure || event.url || ''}`)
            .join(' | ');
        const reason = confirmation.reason || creationResult.reason || 'order_not_confirmed';
        const bodyText = (creationResult.bodyText || confirmation.panelText || '').slice(0, 500);
        if (apiDropiOrderId) {
            console.warn(`Dropi order created by API but not confirmed in panel yet: ${apiDropiOrderId}. ${reason}: ${bodyText}`);
        } else {
        throw buildNotReadyError(`${reason}: ${bodyText}${diagnostics ? ` | diagnostics: ${diagnostics}` : ''}`);
        }
    }
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
    const verifiedDropiOrderId = String(
        apiDropiOrderId
        || apiConfirmation.dropiOrderId
        || ''
    );
    const verifiedTrackingNumber = String(
        apiTrackingNumber
        || apiConfirmation.trackingNumber
        || ''
    );
    return {
        chosenCarrier: preparedForm.chosenCarrier,
        selectedDepartment: preparedForm.selectedDepartment,
        selectedCity: preparedForm.selectedCity,
        quotedDepartment: preparedForm.quotedDepartment,
        quotedCity: preparedForm.quotedCity,
        submittedDestination: apiResult.submittedDestination,
        verifiedDropiOrderId,
        verifiedTrackingNumber,
        apiConfirmation,
        panelMatched: true,
        dropiResponse: apiResult.body
    };
};

const findMatchingPanelText = async (page, shipment) => {
    const terms = [
        shipment.raw?.droppiOrder?.id,
        shipment.raw?.manualDropiOrderId,
        shipment.raw?.latestDroppiPayload?.dropiOrderId,
        shipment.orderId,
        shipment.logistics?.trackingNumber,
        ...phoneLookupVariants(shipment.client?.phone || '')
    ].map((value) => String(value || '').replace(/\D/g, '') || String(value || '').trim())
        .filter((value) => value && value.length >= 6);

    if (!terms.length) return '';

    return findPanelTextByTerms(page, terms);
};

const getSubmittedDropiOrderId = (shipment) => {
    const directId = shipment.raw?.droppiOrder?.id || shipment.raw?.droppiOrder?.objects?.id;
    if (directId) return String(directId);

    const events = Array.isArray(shipment.events) ? shipment.events : [];
    for (const event of [...events].reverse()) {
        const id = event?.payload?.dropiResponse?.objects?.id;
        if (id) return String(id);
    }
    return '';
};

const phoneLookupVariants = (phone = '') => {
    const digits = String(phone || '').replace(/\D/g, '');
    const withoutCountry = digits.startsWith('593') ? digits.slice(3) : digits;
    const localWithZero = withoutCountry && !withoutCountry.startsWith('0') ? `0${withoutCountry}` : withoutCountry;
    return [...new Set([
        digits,
        withoutCountry,
        localWithZero,
        digits.slice(-10),
        digits.slice(-9),
        digits.slice(-4)
    ].filter((value) => value && value.length >= 4))];
};

const parseDropiActiveOrderRowText = (value = '') => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text || /^#\s+Nombre del producto/i.test(text)) return null;
    const rowProductInfo = resolveEcuadorProductInfo(text);
    const dropiOrderMatch = text.match(/^(\d{6,})\b/);
    const dateMatch = text.match(/\b\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s+[ap]\.?\s*m\.?/i);
    const phoneMatch = text.match(/\bTel:\s*(\d{8,12})\b/i);
    const trackingMatch = text.match(/\b(18\d{6,}|WYB\d{6,})\b/i);
    if (!dropiOrderMatch || !dateMatch || !phoneMatch) return null;

    const customerBlock = text.slice(dateMatch.index + dateMatch[0].length, phoneMatch.index).trim();
    const clientName = customerBlock
        .split(/\s+(?:SERVIENTREGA|Servientrega|URBANO|Urbano)\b/)[0]
        .replace(/\s+Dados do perfil$/i, '')
        .trim();
    const address = customerBlock.slice(clientName.length).trim();
    const cityProvince = customerBlock.match(/,\s*([^,]+?)-([A-ZÁÉÍÓÚÑ ]+)(?:\s|$)/i);
    const afterPhone = text.slice(phoneMatch.index + phoneMatch[0].length).trim();
    const rawStatus = trackingMatch
        ? text.slice(phoneMatch.index + phoneMatch[0].length, trackingMatch.index).trim()
        : (afterPhone.match(/^(.*?)(?:\s+Laboratorio\b|\s+CON RECAUDO\b|\s+SIN RECAUDO\b|\s+\d+\s*$|$)/i)?.[1] || afterPhone).trim();
    const afterTracking = trackingMatch ? text.slice(trackingMatch.index + trackingMatch[0].length).trim() : afterPhone;
    const distributionCompany = /URBANO/i.test(afterTracking)
        ? 'URBANO'
        : /SERVIENTREGA/i.test(afterTracking)
            ? 'SERVIENTREGA'
            : /URBANO/i.test(text)
                ? 'URBANO'
                : 'SERVIENTREGA';

    return {
        dropiOrderId: dropiOrderMatch[1],
        productName: rowProductInfo.dropiName || rowProductInfo.name || PRODUCT_NAME,
        clientName,
        phone: String(phoneMatch[1] || '').replace(/\D/g, ''),
        address,
        city: cityProvince?.[1]?.trim() || '',
        province: cityProvince?.[2]?.trim() || '',
        status: rawStatus,
        trackingNumber: trackingMatch?.[1] || '',
        distributionCompany,
        agencyPickup: /SERVIENTREGA|AGENCIA|CONCESION|RETIRO/i.test(text),
        agencyName: /SERVIENTREGA|AGENCIA|CONCESION|RETIRO/i.test(text) ? address : '',
        rawText: text
    };
};

const dropiRowProductMatchesShipment = (row, shipment) => {
    if (!row || !shipment) return true;
    const rowProduct = resolveEcuadorProductInfo(row.rawText || row.productName || '');
    const shipmentProduct = resolveEcuadorProductInfo(shipment.productName, shipment.notes, shipment.raw?.adminLead, shipment.raw?.latestDroppiPayload);
    if (!rowProduct.key || !shipmentProduct.key) return false;
    return rowProduct.key === shipmentProduct.key;
};

const findExistingShipmentForDropiActiveRow = async (row) => {
    const rowDropiOrderId = String(row?.dropiOrderId || '').replace(/\D/g, '');
    const rowTracking = String(row?.trackingNumber || '').replace(/\D/g, '');
    const rowPhoneTerms = phoneLookupVariants(row.phone || '').filter((term) => term.length >= 8);
    const rowName = normalizeAutocompleteText(row.clientName || '');
    const shipmentMatchesRowIdentity = (shipment) => {
        if (!shipment) return false;
        const shipmentOrderId = String(shipment.orderId || '');
        if (rowDropiOrderId && shipmentOrderId === `EC-DROPI-${rowDropiOrderId}`) return true;

        const shipmentDropiIds = [
            shipment.raw?.manualDropiOrderId,
            shipment.raw?.latestDroppiPayload?.dropiOrderId,
            shipment.raw?.droppiOrder?.id,
            shipment.raw?.droppiOrder?.objects?.id
        ].map((value) => String(value || '').replace(/\D/g, '')).filter(Boolean);
        if (rowDropiOrderId && shipmentDropiIds.length && !shipmentDropiIds.includes(rowDropiOrderId)) {
            return false;
        }

        const shipmentTracking = String(shipment.logistics?.trackingNumber || '').replace(/\D/g, '');
        if (rowTracking && shipmentTracking && shipmentTracking !== rowTracking) {
            return false;
        }

        const stablePhones = [
            shipment.raw?.adminLead?.phone,
            shipment.raw?.adminLead?.phone_e164,
            shipment.raw?.dropiNormalization?.phone
        ].filter(Boolean);
        const phoneSources = stablePhones.length ? stablePhones : [shipment.client?.phone];
        const shipmentPhoneTerms = [...new Set(phoneSources
            .flatMap((phone) => phoneLookupVariants(phone))
            .filter((term) => term.length >= 8))];
        const phoneMatches = rowPhoneTerms.some((rowTerm) => shipmentPhoneTerms.some((shipmentTerm) => (
            rowTerm.endsWith(shipmentTerm) || shipmentTerm.endsWith(rowTerm)
        )));
        if (phoneMatches) return true;

        const stableNames = [
            shipment.raw?.adminLead?.name,
            shipment.raw?.dropiNormalization?.name
        ].filter(Boolean);
        const shipmentName = normalizeAutocompleteText(stableNames[0] || shipment.client?.name || '');
        if (!rowName || !shipmentName) return false;
        const rowParts = rowName.split(/\s+/).filter((part) => part.length >= 3);
        const shipmentParts = shipmentName.split(/\s+/).filter((part) => part.length >= 3);
        const sharedParts = rowParts.filter((part) => shipmentParts.includes(part));
        return sharedParts.length >= 2
            || rowName.includes(shipmentName)
            || shipmentName.includes(rowName);
    };

    const directMatches = await Shipment.find({
        country: 'EC',
        provider: 'droppi',
        $or: [
            rowTracking ? { 'logistics.trackingNumber': rowTracking } : null,
            rowDropiOrderId ? { 'raw.manualDropiOrderId': rowDropiOrderId } : null,
            rowDropiOrderId ? { 'raw.latestDroppiPayload.dropiOrderId': rowDropiOrderId } : null,
            rowDropiOrderId ? { 'raw.droppiOrder.id': rowDropiOrderId } : null
        ].filter(Boolean)
    }).sort({
        'automation.submittedToDroppiAt': -1,
        updatedAt: -1,
        createdAt: -1
    }).limit(20).catch(() => []);
    const trustedDirectMatch = directMatches.find(shipmentMatchesRowIdentity);
    if (trustedDirectMatch) return trustedDirectMatch;

    if (!rowPhoneTerms.length) return null;
    const phoneMatches = await Shipment.find({
        country: 'EC',
        provider: 'droppi',
        $or: rowPhoneTerms.map((term) => ({ 'client.phone': { $regex: `${term}$` } }))
    }).sort({
        'automation.submittedToDroppiAt': -1,
        updatedAt: -1,
        createdAt: -1
    }).limit(20).catch(() => []);

    return phoneMatches.find(shipmentMatchesRowIdentity) || null;
};

const assertNoLooseDropiActiveRowMatch = () => {
    const row = {
        dropiOrderId: '5455776',
        trackingNumber: '185166362',
        clientName: 'Santos Paucar',
        phone: '987892090'
    };
    const terms = phoneLookupVariants(row.phone || '').filter((term) => term.length >= 8);
    if (terms.some((term) => term.length < 8)) {
        throw new Error('Dropi active sync must not use loose phone tails below 8 digits');
    }
    return true;
};

assertNoLooseDropiActiveRowMatch();

const nameLookupVariants = (name = '') => {
    const clean = String(name || '').replace(/\s+/g, ' ').trim();
    const parts = clean.split(' ').filter((part) => part.length >= 3);
    return [...new Set([
        clean,
        parts.slice(0, 2).join(' '),
        parts[0],
        parts.slice(-1)[0]
    ].filter((value) => value && value.length >= 3))];
};

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const ordersApiDateRange = () => {
    const untilDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - Math.min(Number.parseInt(process.env.DROPPI_EC_ORDER_LOOKBACK_DAYS || '80', 10), 89));
    return {
        from: process.env.DROPPI_EC_ORDER_LOOKBACK_FROM || toIsoDate(fromDate),
        until: process.env.DROPPI_EC_ORDER_LOOKBACK_UNTIL || toIsoDate(untilDate)
    };
};

const getDropiBrowserAuth = async (page) => page.evaluate(() => {
    const parseJson = (value) => {
        try { return JSON.parse(value || 'null'); } catch { return null; }
    };
    const token = parseJson(localStorage.getItem('DROPI_token')) || '';
    const sessionData = parseJson(localStorage.getItem('DROPI_SessionData')) || {};
    const casUser = parseJson(localStorage.getItem('casUser')) || {};
    const userId = sessionData?.user?.id
        || sessionData?.objects?.id
        || casUser?.idBD
        || casUser?.id
        || '';
    return { token, userId };
});

const buildOrdersApiUrl = ({ search = '', userId = '', start = 0, resultNumber = 20 } = {}) => {
    const { from, until } = ordersApiDateRange();
    const url = new URL(ORDERS_API_URL);
    url.searchParams.set('exportAs', 'orderByRow');
    url.searchParams.set('orderBy', 'id');
    url.searchParams.set('orderDirection', 'desc');
    url.searchParams.set('result_number', String(resultNumber));
    url.searchParams.set('start', String(start));
    url.searchParams.set('textToSearch', search);
    url.searchParams.set('status', 'null');
    url.searchParams.set('supplier_id', 'false');
    url.searchParams.set('user_id', String(userId || ''));
    url.searchParams.set('from', from);
    url.searchParams.set('until', until);
    url.searchParams.set('filter_product', 'undefined');
    url.searchParams.set('haveIncidenceProcesamiento', 'false');
    url.searchParams.set('tag_id', '');
    url.searchParams.set('warranty', 'false');
    url.searchParams.set('seller', 'null');
    url.searchParams.set('filter_date_by', 'FECHA DE CREADO');
    url.searchParams.set('invoiced', 'null');
    return url.toString();
};

const fetchOrdersApiRows = async (page, search, { maxRows = 300 } = {}) => {
    const auth = await getDropiBrowserAuth(page);
    if (!auth.token || !auth.userId) return [];
    const resultNumber = Number.parseInt(process.env.DROPPI_EC_ORDER_API_RESULT_NUMBER || '100', 10);
    const maxPages = Number.parseInt(process.env.DROPPI_EC_ORDER_API_MAX_PAGES || '3', 10);
    const rows = [];

    for (let pageIndex = 0; pageIndex < Math.max(1, maxPages); pageIndex += 1) {
        const start = pageIndex * resultNumber;
        const url = buildOrdersApiUrl({ search, userId: auth.userId, start, resultNumber });
        const result = await page.evaluate(async ({ url, token }) => {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Authorization': `Bearer ${token}`
                }
            });
            const body = await response.json().catch(async () => ({ raw: await response.text() }));
            return { ok: response.ok, status: response.status, body };
        }, { url, token: auth.token });
        if (!result.ok || !result.body?.isSuccess || !Array.isArray(result.body.objects)) break;
        rows.push(...result.body.objects.slice(0, Math.max(0, maxRows - rows.length)));
        if (rows.length >= maxRows) break;
        if (result.body.objects.length < resultNumber) break;
    }

    return rows;
};

const mapOrdersApiRowToActiveRow = (row = {}) => {
    const phone = String(row?.phone || '').replace(/\D/g, '');
    const trackingNumber = discardPhoneAsTracking(extractTrackingFromOrderRow(row, ''), phone);
    const productInfo = resolveEcuadorProductInfo(
        row?.product,
        row?.product_name,
        row?.products,
        row?.details,
        row
    );
    const dropiOrderId = String(row?.id || '').replace(/\D/g, '');
    if (!dropiOrderId || phone.length < 8) return null;
    const address = String(row?.dir || row?.address || '').trim();
    const carrier = row?.distribution_company?.name
        || row?.distributionCompany?.name
        || row?.shipping_company
        || (/servientrega/i.test(address) ? 'SERVIENTREGA' : '');
    return {
        dropiOrderId,
        internalOrderId: row?.external_order_id || row?.reference || '',
        productName: productInfo?.dropiName || productInfo?.name || '',
        productKey: productInfo?.key || '',
        clientName: apiRowClientName(row),
        phone,
        address,
        city: String(row?.city || '').trim(),
        province: String(row?.state || row?.province || '').trim(),
        status: String(row?.status || '').trim(),
        trackingNumber,
        distributionCompany: String(carrier || '').trim(),
        agencyPickup: /servientrega|agencia|retiro|retirar/i.test([address, row?.status].filter(Boolean).join(' ')),
        agencyName: /servientrega|agencia|retiro|retirar/i.test(address) ? address : '',
        invoiceUrl: buildDropiGuideInvoiceUrl(row),
        source: 'dropi_orders_api'
    };
};

const rowPhoneMatchesShipment = (rowPhoneValue = '', shipment) => {
    const rowPhone = String(rowPhoneValue || '').replace(/\D/g, '');
    const phoneTerms = phoneLookupVariants(shipment.client?.phone || '');
    return Boolean(rowPhone && phoneTerms.some((term) => rowPhone.endsWith(term) || term.endsWith(rowPhone)));
};

const rowPhoneConflictsWithShipment = (rowPhoneValue = '', shipment) => {
    const rowPhone = String(rowPhoneValue || '').replace(/\D/g, '');
    const phoneTerms = phoneLookupVariants(shipment.client?.phone || '').filter((term) => term.length >= 8);
    return Boolean(rowPhone && phoneTerms.length && !rowPhoneMatchesShipment(rowPhone, shipment));
};

const rowNameMatchesShipment = (rowNameValue = '', shipment) => {
    const rowName = normalizeAutocompleteText(rowNameValue || '');
    const shipmentName = normalizeAutocompleteText(shipment.client?.name || '');
    if (!rowName || !shipmentName) return false;

    const rowParts = rowName.split(/\s+/).filter((part) => part.length >= 3);
    const shipmentParts = shipmentName.split(/\s+/).filter((part) => part.length >= 3);
    const sharedParts = rowParts.filter((part) => shipmentParts.includes(part));
    if (sharedParts.length >= 2) return true;

    const shortest = Math.min(rowName.length, shipmentName.length);
    return shortest >= 10 && (rowName.includes(shipmentName) || shipmentName.includes(rowName));
};

const apiRowClientName = (row) => [row?.name, row?.surname].filter(Boolean).join(' ');

const rowIdentityMatchesShipment = ({ phone = '', clientName = '' } = {}, shipment) => {
    if (rowPhoneConflictsWithShipment(phone, shipment)) return false;
    return rowPhoneMatchesShipment(phone, shipment) || rowNameMatchesShipment(clientName, shipment);
};

const rowIdentityConflictsWithShipment = ({ phone = '' } = {}, shipment) => (
    rowPhoneConflictsWithShipment(phone, shipment)
);

const rowMatchesShipment = (row, shipment) => {
    const identity = {
        phone: row?.phone || '',
        clientName: apiRowClientName(row)
    };
    if (rowIdentityMatchesShipment(identity, shipment)) return true;

    if (rowIdentityConflictsWithShipment(identity, shipment)) return false;

    const rowDropiId = String(row?.id || '').replace(/\D/g, '');
    const submittedDropiId = String(getSubmittedDropiOrderId(shipment) || shipment?.raw?.manualDropiOrderId || '').replace(/\D/g, '');
    if (rowDropiId && submittedDropiId && rowDropiId === submittedDropiId) return true;

    const currentTracking = String(shipment.logistics?.trackingNumber || '').replace(/\D/g, '');
    const rowText = JSON.stringify(row || {});
    return Boolean(currentTracking && rowText.includes(currentTracking));
};

const extractTrackingFromOrderRow = (row, fallback = '') => {
    const sticker = String(row?.sticker || row?.guide || row?.tracking || '');
    const stickerMatch = sticker.match(/GUIA[-_ ]?(\d{6,})/i) || sticker.match(/\b(\d{8,})\b/);
    if (stickerMatch) return stickerMatch[1];
    const text = JSON.stringify(row || {});
    const match = text.match(/\b18\d{6,}\b/) || text.match(/\b\d{8,}\b/);
    return match?.[0] || fallback || '';
};

const discardPhoneAsTracking = (tracking = '', phone = '') => {
    const value = String(tracking || '').replace(/\D/g, '');
    if (!value) return '';
    const phoneTerms = phoneLookupVariants(phone || '').map((term) => String(term || '').replace(/\D/g, ''));
    if (phoneTerms.some((term) => term && (value === term || value.endsWith(term) || term.endsWith(value)))) {
        return '';
    }
    return String(tracking || '').trim();
};

const buildDropiGuideInvoiceUrl = (row = {}) => {
    const guiaUrl = String(row?.guia_urls3 || '').trim().replace(/^\/+/, '');
    if (guiaUrl) return `${GUIDE_CLOUDFRONT_URL.replace(/\/+$/, '')}/${guiaUrl}`;

    const sticker = String(row?.sticker || '').trim().replace(/^\/+/, '');
    if (!sticker) return '';
    const carrier = String(row?.distribution_company?.name || row?.shipping_company || 'servientrega')
        .trim()
        .toLowerCase();
    return `${IMAGE_SERVER_URL.replace(/\/+$/, '')}/guias/${carrier}/${encodeURIComponent(sticker)}`;
};

const mapOrdersApiRowToSyncResult = (row, shipment) => {
    const dir = String(row?.dir || shipment.client?.address || '');
    const carrier = row?.distribution_company?.name
        || row?.distributionCompany?.name
        || row?.shipping_company
        || (/servientrega/i.test(dir) ? 'SERVIENTREGA' : shipment.logistics?.distributionCompany || '');
    const agencyPickup = /servientrega|agencia|retiro|retirar/i.test([
        dir,
        row?.status,
        shipment.logistics?.agencyName
    ].filter(Boolean).join(' '));
    const agencyName = agencyPickup
        ? String(dir.replace(/^SERVIENTREGA\s*/i, '').split(/\t|,|;/)[0] || shipment.logistics?.agencyName || '').trim()
        : shipment.logistics?.agencyName || '';
    const trackingNumber = discardPhoneAsTracking(
        extractTrackingFromOrderRow(row, shipment.logistics?.trackingNumber || ''),
        shipment.client?.phone || ''
    );
    return {
        panelMatched: true,
        source: 'orders_api_v2',
        dropiOrderId: row?.id ? String(row.id) : '',
        clientName: apiRowClientName(row),
        phone: row?.phone || '',
        trackingNumber,
        status: extractStatusFromPanelText(row?.status || JSON.stringify(row), shipment.logistics?.status || ''),
        distributionCompany: carrier,
        address: dir,
        city: row?.city || shipment.client?.city || '',
        province: row?.state || shipment.client?.province || '',
        agencyPickup,
        agencyName,
        invoiceUrl: buildDropiGuideInvoiceUrl(row),
        rawRow: row
    };
};

const readDropiOrderRowsFromPanel = async (page, { limit = 20 } = {}) => {
    const maxRows = Math.max(1, Math.min(Number(limit) || 20, 1000));
    return page.locator('table tbody tr, tr')
        .evaluateAll((nodes, rowLimit) => nodes
            .map((node) => String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
            .filter((text) => text && /^\d{6,}\b/.test(text))
            .slice(0, rowLimit), maxRows)
        .catch(() => []);
};

const getOrdersSearchInput = async (page) => {
    const search = page.locator(selectors.ordersSearch).first();
    await search.waitFor({ state: 'visible', timeout: 20000 }).catch(() => null);
    if (!(await search.count())) {
        const bodyText = (await page.locator('body').innerText({ timeout: 3000 }).catch(() => ''))
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 300);
        throw buildNotReadyError(`orders search selector not found: ${bodyText}`);
    }
    return search;
};

const searchOrdersPanelRows = async (page, term, { limit = 20 } = {}) => {
    const search = await getOrdersSearchInput(page);
    await search.fill(String(term || ''));
    await page.keyboard.press('Enter').catch(() => null);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(Number.parseInt(process.env.DROPPI_EC_PANEL_SEARCH_WAIT_MS || '1800', 10));
    const rawRows = await readDropiOrderRowsFromPanel(page, { limit });
    const rows = rawRows
        .map(parseDropiActiveOrderRowText)
        .filter(Boolean);
    const noResults = !rawRows.length
        && /No hay resultados/i.test(await page.locator('body').innerText({ timeout: 1000 }).catch(() => ''));
    return {
        term: String(term || ''),
        noResults,
        rawRows,
        rows
    };
};

const parsedPanelRowMatchesShipment = (row, shipment) => {
    const identity = {
        phone: row?.phone || '',
        clientName: row?.clientName || ''
    };
    if (rowIdentityMatchesShipment(identity, shipment)) return true;
    if (rowIdentityConflictsWithShipment(identity, shipment)) return false;

    const rowTracking = String(row?.trackingNumber || '').replace(/\D/g, '');
    const currentTracking = String(shipment?.logistics?.trackingNumber || '').replace(/\D/g, '');
    if (rowTracking && currentTracking && rowTracking === currentTracking) return true;

    const rowDropiId = String(row?.dropiOrderId || '').replace(/\D/g, '');
    const submittedDropiId = String(getSubmittedDropiOrderId(shipment) || shipment?.raw?.manualDropiOrderId || '').replace(/\D/g, '');
    if (rowDropiId && submittedDropiId && rowDropiId === submittedDropiId) return true;

    const rowPhone = String(row?.phone || '').replace(/\D/g, '');
    const phoneTerms = phoneLookupVariants(shipment?.client?.phone || '').filter((term) => term.length >= 8);
    if (rowPhone && phoneTerms.some((term) => rowPhone.endsWith(term) || term.endsWith(rowPhone))) return true;

    const rowName = normalizeAutocompleteText(row?.clientName || '');
    const names = nameLookupVariants(shipment?.client?.name || '').map(normalizeAutocompleteText);
    return Boolean(rowName && names.some((name) => name && (rowName.includes(name) || name.includes(rowName))));
};

const mapPanelParsedRowToSyncResult = (row, shipment) => {
    const address = row?.address || shipment.client?.address || '';
    return {
        panelMatched: true,
        source: 'orders_panel_dom',
        dropiOrderId: row?.dropiOrderId || '',
        clientName: row?.clientName || '',
        phone: row?.phone || '',
        trackingNumber: row?.trackingNumber || shipment.logistics?.trackingNumber || '',
        status: extractStatusFromPanelText(row?.status || row?.rawText || '', shipment.logistics?.status || ''),
        distributionCompany: row?.distributionCompany || shipment.logistics?.distributionCompany || shipment.logistics?.chosenCarrier || '',
        address,
        city: row?.city || shipment.client?.city || '',
        province: row?.province || shipment.client?.province || '',
        agencyPickup: row?.agencyPickup ?? shipment.logistics?.agencyPickup,
        agencyName: row?.agencyName || shipment.logistics?.agencyName || '',
        rawText: row?.rawText || ''
    };
};

const findOrderViaOrdersApi = async (page, shipment) => {
    const searchTerms = [
        shipment.logistics?.trackingNumber,
        ...phoneLookupVariants(shipment.client?.phone || ''),
        ...nameLookupVariants(shipment.client?.name || ''),
        shipment.orderId
    ].filter(Boolean);

    for (const term of [...new Set(searchTerms)]) {
        const rows = await fetchOrdersApiRows(page, term);
        const match = rows.find((row) => rowMatchesShipment(row, shipment));
        if (match) return mapOrdersApiRowToSyncResult(match, shipment);
    }
    return { panelMatched: false };
};

export const extractStatusFromPanelText = (panelText = '', fallback = '') => {
    const raw = String(panelText || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
    if (!raw) return fallback;
    if (/ENTREGAD[OA]|MERCANCIA ENTREGADA|PEDIDO ENTREGADO|REPORTADO ENTREGADO/.test(raw)) return 'ENTREGADO';
    if (/DEVUELT[OA]|DEVOLUCION|NO RETIRAD[OA]/.test(raw)) return 'DEVUELTO';
    if (/NOVEDAD/.test(raw)) return 'NOVEDAD';
    if (/LIST[OA] PARA RETIRO|PARA RETIRO EN AGENCIA|DISPONIBLE.*RETIRO/.test(raw)) return 'READY_FOR_PICKUP';
    if (/GUIA GENERADA|GUIA_GENERADA|PREPARADO PARA TRANSPORTADORA/.test(raw)) return 'GUIA_GENERADA';
    if (/EN RUTA|EN REPARTO|EN DESPACHO|EN BODEGA|TRANSPORTADORA|EN DISTRIBUCION|INGRESANDO OPERATIVO A|INGRESANDO EN AGENCIA|PUNTO DE RETIRO|EN AGENCIA|EN RUTA A CENTRO LOGISTICO/.test(raw)) return 'EN_RUTA';
    return fallback;
};

const extractTrackingFromPanelText = (panelText, shipment) => {
    if (!panelText) return shipment.logistics.trackingNumber;

    const currentTracking = String(shipment.logistics?.trackingNumber || '').replace(/\D/g, '');
    if (currentTracking && panelText.replace(/\D/g, '').includes(currentTracking)) {
        return currentTracking;
    }

    const orderId = String(shipment.orderId || '').replace(/\D/g, '');
    const dropiOrderId = String(getSubmittedDropiOrderId(shipment) || '').replace(/\D/g, '');
    const phoneVariants = phoneLookupVariants(shipment.client?.phone || '');
    const candidates = Array.from(panelText.matchAll(/\b\d{8,}\b/g))
        .map((match) => match[0])
        .filter((value) => value !== orderId && value !== dropiOrderId)
        .filter((value) => !phoneVariants.some((phone) => phone === value || phone.endsWith(value) || value.endsWith(phone)));

    return candidates[0] || shipment.logistics.trackingNumber;
};

const syncFromOrdersPanel = async ({ page, shipment }) => {
    await page.goto(ORDERS_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);

    const apiResult = await findOrderViaOrdersApi(page, shipment);
    if (apiResult.panelMatched) return apiResult;

    let panelText = '';
    let parsedPanelMatch = null;
    const phoneTerms = phoneLookupVariants(shipment.client.phone);
    const nameTerms = nameLookupVariants(shipment.client.name);
    const searchTerms = [
        shipment.logistics.trackingNumber,
        getSubmittedDropiOrderId(shipment),
        ...phoneTerms,
        shipment.orderId,
        ...nameTerms
    ].filter(Boolean);

    for (const term of searchTerms) {
        const result = await searchOrdersPanelRows(page, term, { limit: 20 });
        parsedPanelMatch = result.rows.find((row) => parsedPanelRowMatchesShipment(row, shipment)) || null;
        if (parsedPanelMatch) {
            panelText = parsedPanelMatch.rawText || '';
            break;
        }
        panelText = await findMatchingPanelText(page, shipment);
        if (panelText) {
            const parsedCandidate = parseDropiActiveOrderRowText(panelText);
            if (parsedCandidate && parsedPanelRowMatchesShipment(parsedCandidate, shipment)) {
                parsedPanelMatch = parsedCandidate;
                break;
            }
        }
    }

    if (parsedPanelMatch) {
        return mapPanelParsedRowToSyncResult(parsedPanelMatch, shipment);
    }

    const trackingNumber = extractTrackingFromPanelText(panelText, shipment);
    const status = extractStatusFromPanelText(
        panelText,
        panelText && trackingNumber ? 'GUIA_GENERADA' : shipment.logistics.status
    );

    return {
        panelMatched: Boolean(panelText),
        trackingNumber,
        status
    };
};

export const searchDroppiEcuadorOrdersFromPanel = async ({ terms = [], limit = 20 } = {}) => {
    const rawTerms = Array.isArray(terms) ? terms : String(terms || '').split(',');
    const searchTerms = [...new Set(rawTerms
        .map((term) => String(term || '').trim())
        .filter((term) => term.length >= 3))];
    if (!searchTerms.length) {
        return { ok: false, reason: 'missing_search_terms', terms: [], results: [], rows: [] };
    }

    const result = await withBrowserSession(async ({ context, page }) => {
        await performLogin(page);
        await persistStorageState(context);
        await page.goto(ORDERS_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
        await getOrdersSearchInput(page);

        const results = [];
        for (const term of searchTerms) {
            const panelResult = await searchOrdersPanelRows(page, term, { limit });
            results.push(panelResult);
        }

        const rowMap = new Map();
        for (const item of results) {
            for (const row of item.rows) {
                const key = row.trackingNumber || row.dropiOrderId || `${row.phone}|${row.rawText}`;
                if (!rowMap.has(key)) rowMap.set(key, row);
            }
        }

        return {
            results,
            rows: [...rowMap.values()]
        };
    });

    return {
        ok: true,
        terms: searchTerms,
        count: result.rows.length,
        ...result
    };
};

export const inspectDroppiEcuadorProductTarget = async ({ product = 'Nitrix', limit = 20 } = {}) => {
    const productInfo = resolveEcuadorProductInfo(product);
    const target = dropiProductTargetForProduct(productInfo);
    const maxCards = Math.max(1, Math.min(Number(limit) || 20, 80));

    const result = await withBrowserSession(async ({ context, page }) => {
        await performLogin(page);
        await persistStorageState(context);
        await page.goto(target.productUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
        await waitForProductTargetText(page, target, 20000);

        const searchInput = page.locator(
            'input[type="search"], input[name*="search" i], input[placeholder*="Buscar" i], input[placeholder*="Producto" i], input[placeholder*="produto" i]'
        ).first();
        if (!/\/product-details\//i.test(page.url()) && await searchInput.count().catch(() => 0)) {
            await searchInput.fill(target.name).catch(() => null);
            await searchInput.press('Enter').catch(() => null);
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
            await page.waitForTimeout(2000);
        }

        const cardTexts = await page.locator('app-card-product')
            .evaluateAll((nodes, max) => nodes
                .map((node) => String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
                .filter(Boolean)
                .slice(0, max), maxCards)
            .catch(() => []);
        const bodyText = cardTexts.length
            ? ''
            : (await page.locator('body').innerText({ timeout: 3000 }).catch(() => ''))
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 1000);
        const matches = cardTexts
            .filter((text) => productMatchesTarget(text, target))
            .slice(0, 10);
        return {
            url: page.url(),
            cardCount: cardTexts.length,
            matches,
            sampleCards: cardTexts.slice(0, 8),
            bodyText
        };
    });

    return {
        ok: true,
        target: {
            key: target.key,
            name: target.name,
            productUrl: target.productUrl,
            aliases: target.aliases
        },
        matchCount: result.matches.length,
        ...result
    };
};

export const syncActiveDroppiEcuadorOrdersFromPanel = async ({
    maxRows = 1000,
    mode = DROPI_SYNC_MODES.REPORT_ONLY,
    dryRun = false,
    reportOnly = false
} = {}) => {
    const requestedMode = String(mode || '').trim().toUpperCase();
    const validMode = Object.values(DROPI_SYNC_MODES).includes(requestedMode)
        ? requestedMode
        : DROPI_SYNC_MODES.REPORT_ONLY;
    const effectiveMode = reportOnly
        ? DROPI_SYNC_MODES.REPORT_ONLY
        : dryRun
            ? DROPI_SYNC_MODES.DRY_RUN
            : validMode;
    const readOnly = effectiveMode !== DROPI_SYNC_MODES.APPLY;
    const cycle = await startDropiSyncCycle({ source: 'dropi_orders_api_with_dom_fallback', dryRun: readOnly });
    const cycleEntries = [];
    try {
    const result = await withBrowserSession(async ({ context, page }) => {
        await performLogin(page);
        await persistStorageState(context);
        await page.goto(ORDERS_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);

        const safeMaxRows = Math.max(10, Math.min(Number(maxRows) || 1000, 1000));
        const apiRows = await fetchOrdersApiRows(page, '', { maxRows: safeMaxRows }).catch(() => []);
        const apiParsedRows = apiRows.map(mapOrdersApiRowToActiveRow).filter(Boolean);
        let source = 'dropi_orders_api';

        let rowTexts = [];
        let parsedRows = apiParsedRows;
        if (!apiParsedRows.length) {
            source = 'dropi_panel_dom';
            const select = page.locator('select').first();
            if (await select.count().catch(() => 0)) {
                await select.selectOption({ label: '1000' }).catch(() => null);
                await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
                await page.waitForTimeout(5000);
            }
            rowTexts = await page.locator('table tbody tr, tr')
                .evaluateAll((nodes, limit) => nodes
                    .map((node) => String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
                    .filter(Boolean)
                    .slice(0, limit), safeMaxRows);
            parsedRows = rowTexts.map(parseDropiActiveOrderRowText).filter(Boolean).map((row) => ({ ...row, source }));
            rowTexts.forEach((text) => {
                cycleEntries.push({ state: 'SEEN', source });
                if (!parseDropiActiveOrderRowText(text)) cycleEntries.push({ state: 'NOT_PARSED', source, reason: 'dom_row_parser_rejected' });
            });
        } else {
            apiRows.forEach((row) => {
                cycleEntries.push({ state: 'SEEN', source, dropiOrderId: row?.id || '', phone: row?.phone || '' });
                if (!mapOrdersApiRowToActiveRow(row)) cycleEntries.push({ state: 'NOT_PARSED', source, reason: 'api_row_missing_identity', dropiOrderId: row?.id || '' });
            });
        }
        const uniqueRows = [...new Map(parsedRows.map((row) => [row.trackingNumber || row.dropiOrderId, row])).values()];
        const synced = [];
        const skipped = [];

        for (const row of uniqueRows) {
            cycleEntries.push({
                state: 'PARSED',
                source,
                dropiOrderId: row.dropiOrderId,
                trackingNumber: row.trackingNumber,
                phone: row.phone,
                productKey: row.productKey || resolveEcuadorProductInfo(row.productName)?.key || ''
            });
            const reconciliation = await reconcileDropiRowToShipment({ row });
            if (reconciliation.state !== 'MATCHED') {
                const skippedItem = {
                    orderId: '',
                    dropiOrderId: row.dropiOrderId,
                    phoneTail: String(row.phone || '').slice(-4),
                    status: row.status || '',
                    trackingNumber: row.trackingNumber || '',
                    reason: reconciliation.reason,
                    reconciliationState: reconciliation.state,
                    matchType: reconciliation.matchType || ''
                };
                skipped.push(skippedItem);
                cycleEntries.push({
                    state: reconciliation.state,
                    source,
                    reason: reconciliation.reason,
                    dropiOrderId: row.dropiOrderId,
                    trackingNumber: row.trackingNumber,
                    phone: row.phone,
                    productKey: row.productKey || '',
                    matchType: reconciliation.matchType || ''
                });
                continue;
            }
            const existing = reconciliation.shipment;
            cycleEntries.push({
                state: 'MATCHED',
                source,
                orderId: existing.orderId,
                dropiOrderId: row.dropiOrderId,
                trackingNumber: row.trackingNumber,
                phone: row.phone,
                productKey: row.productKey || '',
                matchType: reconciliation.matchType
            });
            const changedFields = [
                String(existing.logistics?.status || '') !== String(row.status || '') ? 'logistics.status' : '',
                row.trackingNumber && String(existing.logistics?.trackingNumber || '') !== String(row.trackingNumber) ? 'logistics.trackingNumber' : '',
                row.dropiOrderId && ![
                    existing.raw?.manualDropiOrderId,
                    existing.raw?.latestDroppiPayload?.dropiOrderId,
                    existing.raw?.droppiOrder?.id
                ].map(String).includes(String(row.dropiOrderId)) ? 'raw.dropiOrderId' : ''
            ].filter(Boolean);
            const shipment = readOnly ? existing : await upsertDroppiEcuadorShipment({
                orderId: existing.orderId,
                productName: row.productName,
                clientName: row.clientName,
                phone: row.phone,
                address: row.address,
                city: row.city,
                province: row.province,
                status: row.status,
                trackingNumber: row.trackingNumber,
                distributionCompany: row.distributionCompany,
                chosenCarrier: row.distributionCompany,
                agencyPickup: row.agencyPickup,
                agencyName: row.agencyName,
                invoiceUrl: row.invoiceUrl || '',
                sessionId: existing?.automation?.sessionId || '',
                dropiOrderId: row.dropiOrderId,
                reconciliationSource: source,
                detail: `Sincronizacao automatica do painel Dropi ativo; guia ${row.trackingNumber}; status original: ${row.status}`
            });

            const item = {
                orderId: shipment.orderId,
                dropiOrderId: row.dropiOrderId,
                phoneTail: String(row.phone || '').slice(-4),
                status: shipment.logistics?.status || '',
                trackingNumber: shipment.logistics?.trackingNumber || '',
                guideAlreadyNotified: Boolean(shipment.automation?.guiaNotifiedAt),
                dryRun: readOnly,
                changedFields,
                matchType: reconciliation.matchType
            };
            if (shipment.logistics?.status === 'ENTREGADO') skipped.push({ ...item, reason: 'delivered' });
            else synced.push(item);
            cycleEntries.push({
                state: changedFields.length ? 'UPDATED' : 'UNCHANGED',
                source,
                orderId: shipment.orderId,
                dropiOrderId: row.dropiOrderId,
                trackingNumber: row.trackingNumber,
                phone: row.phone,
                productKey: row.productKey || '',
                matchType: reconciliation.matchType,
                changedFields
            });
        }

        return {
            source,
            mode: effectiveMode,
            rowCount: apiRows.length || rowTexts.length,
            parsed: parsedRows.length,
            unique: uniqueRows.length,
            dryRun: readOnly,
            synced,
            skipped
        };
    });
    const finalizedCycle = await finalizeDropiSyncCycle({ cycleId: cycle.cycleId, entries: cycleEntries });
    return {
        ok: true,
        mode: effectiveMode,
        cycleId: cycle.cycleId,
        cycle: finalizedCycle,
        ...result
    };
    } catch (error) {
        cycleEntries.push({ state: 'ERROR', source: 'dropi_orders_api_with_dom_fallback', reason: error?.code || error?.message || 'sync_failed' });
        await finalizeDropiSyncCycle({
            cycleId: cycle.cycleId,
            entries: cycleEntries,
            failed: true,
            errorCode: error?.code || error?.message || 'sync_failed'
        }).catch(() => null);
        error.dropiSyncCycleId = cycle.cycleId;
        throw error;
    }
};

const cleanSubmitToken = (value) => String(value || '').replace(/\s+/g, '').trim();

const localSubmittedDropiOrderId = (order = {}, shipment = {}) => cleanSubmitToken(
    order?.dropiOrderId
    || shipment?.raw?.droppiOrder?.id
    || shipment?.raw?.droppiOrder?.objects?.id
    || shipment?.raw?.latestDroppiPayload?.dropiOrderId
    || shipment?.raw?.manualDropiOrderId
    || ''
);

const localSubmittedTrackingNumber = (order = {}, shipment = {}) => cleanSubmitToken(
    order?.trackingNumber
    || shipment?.logistics?.trackingNumber
    || shipment?.raw?.droppiOrder?.sticker
    || shipment?.raw?.droppiOrder?.objects?.sticker
    || ''
);

const alreadySubmittedDropiResult = ({ order, shipment }) => {
    const dropiOrderId = localSubmittedDropiOrderId(order, shipment);
    const trackingNumber = localSubmittedTrackingNumber(order, shipment);
    if (!dropiOrderId && !trackingNumber && !shipment?.automation?.submittedToDroppiAt) return null;
    return {
        ok: true,
        success: true,
        alreadySubmitted: true,
        dropiOrderId,
        trackingNumber,
        shipment,
        message: dropiOrderId
            ? `PEDIDO JA FOI ENVIADO - Dropi ${dropiOrderId}.`
            : 'PEDIDO JA FOI ENVIADO para Dropi.'
    };
};

const checkDropiSubmitSafety = async ({ order, shipment }) => {
    const alreadySubmitted = alreadySubmittedDropiResult({ order, shipment });
    if (alreadySubmitted) return alreadySubmitted;

    const explicitProductKey = detectExplicitEcuadorProductKey(order, shipment?.productName, shipment?.notes);
    const selectedOffer = findEcuadorOfferByTotal({
        productKey: explicitProductKey,
        quantity: order?.package?.quantity || order?.package?.id,
        total: order?.total
    });
    if (!explicitProductKey || !selectedOffer) {
        return {
            ok: false,
            success: false,
            reason: 'dropi_product_price_selection_required',
            error: 'Selecione produto e uma opcao oficial de preco antes de enviar para Dropi.',
            message: 'Produto/preco Dropi ainda nao foi configurado neste pedido.',
            shipment
        };
    }
    const directProduct = resolveEcuadorProductInfo(order, shipment?.productName, shipment?.notes);
    const phoneTail = String(order?.customer?.phone || shipment?.client?.phone || '').replace(/\D/g, '').slice(-9);
    const recentNitrixMessage = phoneTail
        ? await Message.findOne({
            body: /(nitrix|n_i_trix|nitric|oxido\s+nitric|óxido\s+nítric|nitrico)/i,
            createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
            $or: [
                { chatId: { $regex: phoneTail } },
                { phone: { $regex: phoneTail } },
                { from: { $regex: phoneTail } }
            ]
        }).sort({ createdAt: -1 }).lean().catch(() => null)
        : null;
    const hasPanelProductSelection = /\[DROPI_PRODUCT\]\s*key=/i.test([
        order?.notes,
        shipment?.notes,
        shipment?.raw?.productSelection?.productKey
    ].filter(Boolean).join(' | '))
        || order?.tracking?.productSelectionSource === 'manual_customer_draft';
    if (recentNitrixMessage && directProduct.key !== ECUADOR_PRODUCTS.nitrix.key && !hasPanelProductSelection) {
        return {
            ok: false,
            success: false,
            reason: 'nitrix_order_product_mismatch',
            error: 'Pedido tem mensagem recente de Nitrix, mas esta marcado como outro produto. Corrija para Nitrix antes de enviar Dropi.',
            message: 'Pedido tem mensagem recente de Nitrix, mas esta marcado como outro produto. Corrija para Nitrix antes de enviar Dropi.',
            shipment
        };
    }
    if (directProduct.key === ECUADOR_PRODUCTS.nitrix.key) {
        const nitrixEnabled = String(process.env.DROPPI_EC_NITRIX_PRODUCT_ENABLED || '').toLowerCase() === 'true';
        const nitrixTarget = dropiProductTargetForProduct(directProduct);
        if (!nitrixEnabled || !nitrixTarget.productUrl || !nitrixTarget.name) {
            return {
                ok: false,
                success: false,
                reason: 'nitrix_dropi_product_not_enabled',
                error: 'Produto Nitrix ainda nao esta habilitado no catalogo Dropi EC. Configure e valide DROPPI_EC_NITRIX_PRODUCT_URL e DROPPI_EC_NITRIX_PRODUCT_NAME antes de enviar.',
                message: 'Produto Nitrix ainda nao esta habilitado no catalogo Dropi EC. Falta validar o produto exato.',
                shipment
            };
        }
    }
    if (directProduct.key === ECUADOR_PRODUCTS.texUltra.key) {
        const texUltraEnabled = String(process.env.DROPPI_EC_TEX_ULTRA_PRODUCT_ENABLED || '').toLowerCase() === 'true';
        const texUltraTarget = dropiProductTargetForProduct(directProduct);
        if (!texUltraEnabled || !texUltraTarget.productUrl || !texUltraTarget.name) {
            return {
                ok: false,
                success: false,
                reason: 'tex_ultra_dropi_product_not_ready',
                error: 'Tex Ultra esta isolado, mas o produto exato do Dropi ainda nao foi validado. Configure DROPPI_EC_TEX_ULTRA_PRODUCT_URL, DROPPI_EC_TEX_ULTRA_PRODUCT_NAME e habilite somente depois da conferencia.',
                message: 'Tex Ultra ainda nao esta liberado para envio ao Dropi. Falta validar o produto exato no catalogo EC.',
                shipment
            };
        }
    }

    const currentOrderId = String(order?.orderId || shipment?.orderId || '');
    if (/^EC-ADMIN-\d+$/i.test(currentOrderId)) return null;
    if (/^EC-REENVIO-\d+-/i.test(currentOrderId)) return null;

    const duplicateGuard = await getOrderDuplicateGuard({
        phone: order?.customer?.phone || shipment?.client?.phone || '',
        country: order?.country || shipment?.country || 'EC',
        currentOrderId,
        trackingNumber: localSubmittedTrackingNumber(order, shipment),
        dropiOrderId: localSubmittedDropiOrderId(order, shipment)
    });
    if (duplicateGuard.allowed) return null;
    return {
        ok: false,
        success: false,
        duplicateBlocked: true,
        reason: duplicateGuard.reason || 'dropi_duplicate_blocked',
        error: duplicateGuard.message || 'Pedido duplicado bloqueado',
        message: duplicateGuard.message || 'Pedido duplicado bloqueado',
        guard: duplicateGuard,
        shipment
    };
};

export const submitDroppiEcuadorOrder = async ({ order, shipment }) => {
    const safetyBeforeLock = await checkDropiSubmitSafety({ order, shipment });
    if (safetyBeforeLock) return safetyBeforeLock;

    const locked = await lockShipmentForBrowserWorkEc(shipment);
    if (!locked) return { ok: false, reason: 'locked' };

    try {
        const latestOrder = await Order.findOne({ orderId: order.orderId }).lean().catch(() => null) || order;
        const latestShipment = await Shipment.findById(shipment._id).lean().catch(() => null) || shipment;
        const safetyAfterLock = await checkDropiSubmitSafety({
            order: latestOrder,
            shipment: latestShipment
        });
        if (safetyAfterLock) return safetyAfterLock;

        const prepared = await prepareDroppiEcuadorSubmission(order);
        await updateBrowserState(shipment._id, 'prepared_submission', {
            lastError: '',
            event: { kind: 'droppi_browser_prepared', payload: prepared.payload }
        });

        let result;
        let lastTransientError = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
                result = await withBrowserSession(async ({ context, page }) => {
                    await performLogin(page);
                    await persistStorageState(context);
                    await updateBrowserState(shipment._id, attempt === 1 ? 'logged_in' : 'logged_in_retry');
                    return submitOrderInPanel({ page, payload: prepared.payload });
                });
                lastTransientError = null;
                break;
            } catch (error) {
                if (attempt >= 2 || !isTransientDropiBrowserError(error.message)) throw error;
                lastTransientError = error;
                await updateBrowserState(shipment._id, 'retrying_transient_browser_error', {
                    lastError: error.message || 'transient_browser_error',
                    event: {
                        kind: 'droppi_browser_transient_retry',
                        payload: { attempt, message: error.message || 'transient_browser_error' }
                    }
                });
                await new Promise((resolve) => setTimeout(resolve, 2500));
            }
        }
        if (!result && lastTransientError) throw lastTransientError;
        const submittedAt = new Date();
        const dropiOrderId = result.verifiedDropiOrderId
            || (result.dropiResponse?.objects?.id ? String(result.dropiResponse.objects.id) : '');
        const rawTrackingNumber = result.verifiedTrackingNumber
            || result.dropiResponse?.objects?.sticker
            || shipment.logistics?.trackingNumber
            || '';
        const trackingNumber = discardPhoneAsTracking(rawTrackingNumber, prepared.payload.phone || shipment.client?.phone || '');
        const dropiOrderObject = {
            ...(result.dropiResponse?.objects || {}),
            ...(dropiOrderId ? { id: dropiOrderId } : {}),
            ...(trackingNumber ? { sticker: trackingNumber } : {})
        };
        const latestDroppiPayload = {
            ...(latestShipment?.raw?.latestDroppiPayload || {}),
            status: 'submitted',
            dropiOrderId,
            trackingNumber,
            submittedAt: submittedAt.toISOString()
        };

        await Shipment.updateOne(
            { _id: shipment._id },
            {
                $set: {
                    'automation.browserCheckpoint': 'submitted_verified',
                    'automation.browserLastError': '',
                    'automation.submittedToDroppiAt': submittedAt,
                    'review.manualOnly': false,
                    'review.reviewReason': '',
                    'review.reviewStatus': 'submitted',
                    'logistics.status': result.dropiResponse?.objects?.status || 'PENDIENTE',
                    'logistics.chosenCarrier': result.chosenCarrier,
                    'logistics.distributionCompany': result.dropiResponse?.objects?.shipping_company || result.chosenCarrier || '',
                    ...(trackingNumber ? { 'logistics.trackingNumber': trackingNumber } : {}),
                    'raw.droppiOrder': Object.keys(dropiOrderObject).length ? dropiOrderObject : null,
                    'raw.latestDroppiPayload': latestDroppiPayload
                },
                $push: {
                    events: {
                        kind: 'droppi_order_submitted_verified',
                        at: submittedAt,
                        payload: {
                            ...result,
                            dropiOrderId,
                            trackingNumber
                        }
                    }
                }
            }
        );
        await tagDropiContactState({
            shipment,
            tag: 'FEITO_DROPI',
            payload: {
                'metadata.dropi.status': 'submitted_verified',
                'metadata.dropi.dropiOrderId': dropiOrderId,
                'metadata.dropi.trackingNumber': trackingNumber,
                'metadata.dropi.submittedAt': submittedAt,
                'metadata.dropi.lastError': '',
                'metadata.customerDraft.status': 'pedido_enviado',
                'metadata.customerDraft.flowDataOk.venda_finalizada.ok': true,
                'metadata.customerDraft.flowDataOk.venda_finalizada.value': 'pedido_enviado',
                'metadata.customerDraft.flowDataOk.venda_finalizada.label': 'Venda finalizada',
                'metadata.customerDraft.updatedAt': submittedAt.toISOString()
            }
        });

        await Order.updateOne(
            { orderId: shipment.orderId },
            {
                $set: {
                    status: 'processing',
                    shippingStatus: result.dropiResponse?.objects?.status || 'PENDIENTE',
                    ...(trackingNumber ? { trackingNumber } : {}),
                    ...(dropiOrderId ? { dropiOrderId } : {})
                }
            }
        ).catch(() => null);

        const syncedOrder = await Order.findOne({ orderId: shipment.orderId }).catch(() => null);
        const adminStatusResult = syncedOrder
            ? syncOrderToOnlineAdminPanel(syncedOrder, { status: 'processing', action: 'dropi_order_submitted' })
            : await markOnlineAdminPedidoEnviado({
            orderId: shipment.orderId,
            country: 'EC'
        });
        if (adminStatusResult?.ok) {
            await Shipment.updateOne(
                { _id: shipment._id },
                {
                    $push: {
                        events: {
                            kind: 'online_admin_status_updated',
                            at: new Date(),
                            payload: adminStatusResult
                        }
                    }
                }
            ).catch(() => null);
        } else if (!adminStatusResult?.skipped) {
            console.warn('Online admin status update failed:', adminStatusResult);
        }

        return {
            ok: true,
            dropiOrderId,
            trackingNumber,
            result: {
                ...result,
                dropiOrderId,
                trackingNumber
            }
        };
    } catch (error) {
        const reason = isDropiPaymentRequiredError(error.message)
            ? 'dropi_payment_required'
            : 'submit_failed';
        await updateBrowserState(shipment._id, reason, {
            lastError: error.message || 'unknown_error',
            event: { kind: 'droppi_browser_error', payload: { message: error.message || 'unknown_error' } }
        });
        await tagDropiContactState({
            shipment,
            tag: 'ERRO_DROPI',
            payload: {
                'metadata.dropi.status': reason,
                'metadata.dropi.lastError': error.message || 'unknown_error',
                'metadata.dropi.lastFailedAt': new Date()
            }
        });
        return {
            ok: false,
            reason,
            paymentRequired: reason === 'dropi_payment_required',
            error: error.message
        };
    } finally {
        await releaseShipmentBrowserLockEc(shipment._id);
    }
};

export const prepareDroppiEcuadorOrderForManualSubmit = async ({ order, shipment }) => {
    const locked = await lockShipmentForBrowserWorkEc(shipment);
    if (!locked) return { ok: false, reason: 'locked' };

    const sessionKey = String(shipment.orderId || shipment._id);
    let browser;
    let context;

    try {
        const prepared = await prepareDroppiEcuadorSubmission(order);
        await updateBrowserState(shipment._id, 'manual_prepare_started', {
            lastError: '',
            event: { kind: 'droppi_manual_prepare_started', payload: prepared.payload }
        });

        await closeManualBrowserSession(sessionKey);

        const { chromium } = await getPlaywright();
        ensureDir(DOWNLOAD_DIR);
        browser = await chromium.launch({
            headless: false,
            slowMo: Number.parseInt(process.env.DROPPI_EC_MANUAL_SLOW_MO_MS || '0', 10)
        });
        context = await browser.newContext({
            acceptDownloads: true,
            storageState: getUsableStorageStatePath()
        });
        const page = await context.newPage();
        manualBrowserSessions.set(sessionKey, {
            browser,
            context,
            page,
            openedAt: new Date()
        });
        browser.on('disconnected', () => manualBrowserSessions.delete(sessionKey));

        await performLogin(page);
        await persistStorageState(context);
        await updateBrowserState(shipment._id, 'manual_prepare_logged_in', { lastError: '' });

        const result = await fillOrderFormInPanel({
            page,
            payload: prepared.payload,
            manualDraftOnly: true
        });
        await Shipment.updateOne(
            { _id: shipment._id },
            {
                $set: {
                    'review.manualOnly': false,
                    'review.reviewReason': '',
                    'review.reviewStatus': 'manual_prepare_ready'
                }
            }
        );
        await updateBrowserState(shipment._id, 'manual_prepare_ready', {
            lastError: '',
            event: {
                kind: 'droppi_manual_prepare_ready',
                payload: {
                    ...result,
                    orderId: shipment.orderId,
                    clientName: prepared.payload.firstName
                }
            }
        });

        return {
            ok: true,
            manualPrepare: true,
            result,
            message: result.citySelected === false
                ? 'Formulario Dropi preparado. A cidade nao foi aceita automaticamente; complete esse campo na janela aberta e confirme manualmente.'
                : 'Formulario Dropi preparado. Confira a janela aberta e clique Enviar al cliente manualmente.'
        };
    } catch (error) {
        manualBrowserSessions.delete(sessionKey);
        await context?.close?.().catch(() => null);
        await browser?.close?.().catch(() => null);
        await updateBrowserState(shipment._id, 'manual_prepare_failed', {
            lastError: error.message || 'unknown_error',
            event: {
                kind: 'droppi_manual_prepare_failed',
                payload: { message: error.message || 'unknown_error' }
            }
        });
        return { ok: false, reason: 'manual_prepare_failed', error: error.message };
    } finally {
        await releaseShipmentBrowserLockEc(shipment._id);
    }
};

export const syncDroppiEcuadorFromPanel = async ({ shipment }) => {
    try {
        const result = await withBrowserSession(async ({ context, page }) => {
            await performLogin(page);
            await persistStorageState(context);
            await updateBrowserState(shipment._id, 'sync_logged_in', { lastError: '' });
            return syncFromOrdersPanel({ page, shipment });
        });

        if (!result.panelMatched) {
            await updateBrowserState(shipment._id, 'sync_not_found', {
                lastError: '',
                event: { kind: 'droppi_panel_sync_not_found', payload: result }
            });
            return { ok: false, reason: 'not_found_in_panel', result };
        }

        const synced = await upsertDroppiEcuadorShipment({
            orderId: shipment.orderId,
            productName: shipment.productName,
            clientName: shipment.client.name,
            phone: shipment.client.phone,
            address: result.address || shipment.client.address,
            city: result.city || shipment.client.city,
            province: result.province || shipment.client.province,
            status: result.status,
            trackingNumber: result.trackingNumber,
            distributionCompany: result.distributionCompany || shipment.logistics.distributionCompany || shipment.logistics.chosenCarrier,
            warehouse: shipment.logistics.warehouse,
            shippingType: shipment.logistics.shippingType,
            chosenCarrier: result.distributionCompany || shipment.logistics.chosenCarrier,
            agencyPickup: result.agencyPickup ?? shipment.logistics.agencyPickup,
            agencyName: result.agencyName || shipment.logistics.agencyName,
            invoiceUrl: result.invoiceUrl || shipment.logistics.invoiceUrl,
            sessionId: shipment.automation.sessionId,
            dropiOrderId: result.dropiOrderId || '',
            reconciliationSource: result.source === 'orders_api_v2' ? 'dropi_orders_api' : 'dropi_panel'
        });

        await updateBrowserState(shipment._id, 'sync_completed', {
            lastError: '',
            event: { kind: 'droppi_panel_sync_completed', payload: result }
        });

        return { ok: true, shipment: synced };
    } catch (error) {
        await updateBrowserState(shipment._id, 'sync_failed', {
            lastError: error.message || 'unknown_error',
            event: { kind: 'droppi_panel_sync_failed', payload: { message: error.message || 'unknown_error' } }
        });
        return { ok: false, reason: 'sync_failed', error: error.message };
    }
};

export const syncDroppiEcuadorInvoiceForShipment = async ({ shipment, download = true } = {}) => {
    if (!shipment?._id) return { ok: false, reason: 'missing_shipment' };

    try {
        const result = await withBrowserSession(async ({ context, page }) => {
            await performLogin(page);
            await persistStorageState(context);
            await updateBrowserState(shipment._id, 'invoice_lookup_logged_in');
            return syncFromOrdersPanel({ page, shipment });
        });

        if (!result?.panelMatched) {
            await updateBrowserState(shipment._id, 'invoice_lookup_not_found', {
                lastError: '',
                event: { kind: 'droppi_invoice_lookup_not_found', payload: result || {} }
            });
            return { ok: false, reason: 'not_found_in_panel', result };
        }

        const invoiceUrl = result.invoiceUrl || shipment.logistics?.invoiceUrl || '';
        if (!invoiceUrl) {
            await updateBrowserState(shipment._id, 'invoice_url_missing', {
                lastError: '',
                event: { kind: 'droppi_invoice_url_missing', payload: result }
            });
            return { ok: false, reason: 'invoice_url_missing', result };
        }

        await Shipment.updateOne(
            { _id: shipment._id },
            {
                $set: {
                    'logistics.invoiceUrl': invoiceUrl,
                    'automation.browserCheckpoint': 'invoice_url_synced',
                    'automation.browserLastError': ''
                },
                $push: {
                    events: {
                        kind: 'droppi_invoice_url_synced',
                        at: new Date(),
                        payload: {
                            invoiceUrl,
                            source: result.source || '',
                            dropiOrderId: result.dropiOrderId || ''
                        }
                    }
                }
            }
        );

        const updatedShipment = await Shipment.findById(shipment._id);
        const downloadResult = download
            ? await downloadDroppiEcuadorInvoicePdf({ shipment: updatedShipment })
            : { ok: false, skipped: true, reason: 'download_disabled' };

        return {
            ok: true,
            invoiceUrl,
            download: downloadResult,
            result
        };
    } catch (error) {
        await updateBrowserState(shipment._id, 'invoice_lookup_failed', {
            lastError: error.message || 'unknown_error',
            event: { kind: 'droppi_invoice_lookup_failed', payload: { message: error.message || 'unknown_error' } }
        });
        return { ok: false, reason: 'invoice_lookup_failed', error: error.message };
    }
};

export const downloadDroppiEcuadorInvoicePdf = async ({ shipment }) => {
    const invoiceUrl = shipment?.logistics?.invoiceUrl || '';
    if (!invoiceUrl) {
        return { ok: false, reason: 'missing_invoice_url' };
    }

    try {
        const result = await withBrowserSession(async ({ context, page }) => {
            await performLogin(page);
            await persistStorageState(context);
            await updateBrowserState(shipment._id, 'invoice_logged_in');

            const response = await context.request.get(invoiceUrl, {
                headers: {
                    referer: ORDERS_URL
                }
            }).catch(() => null);

            if (!response || !response.ok()) {
                const status = response ? response.status() : 0;
                throw new Error(`invoice_request_failed_${status || 'unknown'}`);
            }

            const buffer = Buffer.from(await response.body());
            if (!buffer.length) {
                throw new Error('invoice_empty_body');
            }

            const targetPath = buildInvoiceFilePath(shipment);
            fs.writeFileSync(targetPath, buffer);
            return { targetPath };
        });

        await Shipment.updateOne(
            { _id: shipment._id },
            {
                $set: {
                    'logistics.invoicePath': result.targetPath,
                    'automation.browserCheckpoint': 'invoice_downloaded',
                    'automation.browserLastError': ''
                },
                $push: {
                    events: {
                        kind: 'droppi_invoice_downloaded',
                        at: new Date(),
                        payload: { path: result.targetPath }
                    }
                }
            }
        );

        return { ok: true, path: result.targetPath };
    } catch (error) {
        await updateBrowserState(shipment._id, 'invoice_download_failed', {
            lastError: error.message || 'unknown_error',
            event: { kind: 'droppi_invoice_download_failed', payload: { message: error.message || 'unknown_error' } }
        });
        return { ok: false, reason: 'invoice_download_failed', error: error.message };
    }
};
