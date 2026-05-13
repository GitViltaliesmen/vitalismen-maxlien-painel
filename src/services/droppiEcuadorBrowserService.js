import fs from 'fs';
import path from 'path';
import Shipment from '../models/Shipment.js';
import Order from '../models/Order.js';
import { buildDroppiEcuadorOrderPayload, upsertDroppiEcuadorShipment } from './droppiEcuadorService.js';
import { markOnlineAdminPedidoEnviado } from './adminPanelStatusService.js';

const LOCK_MS = Number.parseInt(process.env.DROPPI_EC_LOCK_MS || '900000', 10);
const STORAGE_STATE_PATH = process.env.DROPPI_EC_STORAGE_STATE_PATH
    || path.join(process.cwd(), '.local', 'droppi-ec-storage.json');
const DOWNLOAD_DIR = process.env.DROPPI_EC_DOWNLOAD_DIR
    || path.join(process.cwd(), 'public', 'media', 'droppi-ec');
const LOGIN_URL = process.env.DROPPI_EC_LOGIN_URL || 'https://app.dropi.ec/auth/login';
const PRODUCT_URL = process.env.DROPPI_EC_PRODUCT_URL || 'https://app.dropi.ec/dashboard/search?search_type=simple&privated=true';
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
const PRODUCT_NAME = process.env.DROPPI_EC_PRODUCT_NAME || 'VIT POWERSS 1000 ML X1 / COMUNIDAD';
const PRODUCT_ALIASES = (process.env.DROPPI_EC_PRODUCT_ALIASES
    || 'VIT POWERS 1000ML COMUNIDAD|VIT POWERSS 1000 ML X1 COMUNIDAD|VIT POWERSS 1000 ML X1 / COMUNIDAD')
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
    createOrderButton: process.env.DROPPI_EC_SELECTOR_CREATE_ORDER || 'text=/Enviar a cliente|Crear Orden|Create Order/i',
    firstName: process.env.DROPPI_EC_SELECTOR_FIRST_NAME || 'input[placeholder="Nombres"]',
    lastName: process.env.DROPPI_EC_SELECTOR_LAST_NAME || 'input[placeholder="Apellidos"]',
    phone: process.env.DROPPI_EC_SELECTOR_PHONE || 'input[placeholder*="teléfono"]',
    department: process.env.DROPPI_EC_SELECTOR_DEPARTMENT || 'input[placeholder="Departamento"]',
    city: process.env.DROPPI_EC_SELECTOR_CITY || 'input[placeholder="Ciudad"]',
    address: process.env.DROPPI_EC_SELECTOR_ADDRESS || 'input[placeholder*="Dirección"]',
    email: process.env.DROPPI_EC_SELECTOR_EMAIL || 'input[placeholder*="Correo"]',
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
    priceInput: process.env.DROPPI_EC_SELECTOR_PRICE || 'input[name="price"]',
    quantityInput: process.env.DROPPI_EC_SELECTOR_QUANTITY || 'input[name="cantidad"]',
    submitOrderButton: process.env.DROPPI_EC_SELECTOR_SUBMIT_ORDER || 'button:has-text("Enviar al cliente")',
    ordersSearch: process.env.DROPPI_EC_SELECTOR_ORDERS_SEARCH || 'input[name="textToSearch"], input[placeholder*="Buscar"]'
};

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const buildNotReadyError = (reason) => new Error(
    `Dropi Ecuador browser automation not ready: ${reason}.`
);

const isDropiPaymentRequiredError = (value) => (
    /saldo|wallet|cr[eé]dito|credito|balance|credit/i.test(String(value || ''))
);

const normalizeAutocompleteText = (text) => String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeAutocompleteLoose = (text) => normalizeAutocompleteText(text)
    .replace(/[bv]/g, 'b');

const autocompleteTextAccepts = (actual, expected) => {
    const normalizedActual = normalizeAutocompleteText(actual);
    const normalizedExpected = normalizeAutocompleteText(expected);
    if (!normalizedActual || !normalizedExpected) return false;
    const expectedTokens = normalizedExpected.split(/\s+/).filter(Boolean);
    const actualTokens = normalizedActual.split(/\s+/).filter(Boolean);
    const expectedIsSingleToken = expectedTokens.length === 1;
    if (normalizedActual === normalizedExpected) return true;
    if (!expectedIsSingleToken && normalizedActual.includes(normalizedExpected)) return true;
    if (normalizedExpected.includes(normalizedActual) && normalizedActual.length >= Math.min(normalizedExpected.length, 5)) return true;

    const looseActual = normalizeAutocompleteLoose(normalizedActual);
    const looseExpected = normalizeAutocompleteLoose(normalizedExpected);
    if (looseActual === looseExpected) return true;
    if (!expectedIsSingleToken && looseActual.includes(looseExpected)) return true;
    if (looseExpected.includes(looseActual) && looseActual.length >= Math.min(looseExpected.length, 5)) return true;
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

const hasTwoFactorPrompt = async (page) => {
    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    return /autenticaci[oó]n de dos factores|two[-\s]?factor|six digits|seis d[ií]gitos/i.test(bodyText);
};

const hasLoginPrompt = async (page) => {
    const passwordVisible = await page.locator(selectors.loginPassword).first().isVisible({ timeout: 1000 }).catch(() => false);
    if (passwordVisible) return true;
    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    return /usuario\s+contrase[nñ]a|iniciar sesi[oó]n|olvid[oó] su contrase[nñ]a/i.test(bodyText);
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
    await Shipment.updateOne(
        { _id: shipmentId },
        { $unset: { 'automation.submitLockedUntil': 1 } }
    );
};

export const prepareDroppiEcuadorSubmission = async (order) => ({
    loginEmailEnv: EMAIL_ENV,
    loginPasswordEnv: PASSWORD_ENV,
    loginUrl: LOGIN_URL,
    productUrl: PRIVATE_PRODUCT_URL,
    ordersUrl: ORDERS_URL,
    storageStatePath: STORAGE_STATE_PATH,
    payload: buildDroppiEcuadorOrderPayload({ order })
});

const firstVisibleEnabled = async (page, selector) => {
    const locators = page.locator(selector);
    await locators.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => null);
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
    }
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
        ...(normalizedValue.match(/\(([^)]*)\)/g) || []).map((part) => part.replace(/[()]/g, '')),
        ...normalizedValue.split(/[,/;-]/g)
    ]
        .map((candidate) => candidate.replace(/\.+$/g, '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    const uniqueCandidates = [...new Set(candidates)];
    const expectedValues = uniqueCandidates.map((candidate) => normalizeAutocompleteText(candidate)).filter(Boolean);
    const looseExpectedValues = expectedValues.map(normalizeAutocompleteLoose).filter(Boolean);
    const typingAttempts = [
        ...uniqueCandidates,
        ...uniqueCandidates.flatMap((candidate) => {
            const clean = candidate.replace(/\.+$/g, '').replace(/\s+/g, ' ').trim();
            const normalized = normalizeAutocompleteText(clean);
            const firstWord = clean.split(/\s+/g).find((word) => word.length >= 4) || clean;
            const progressive = [];
            for (let size = 3; size < Math.min(normalized.length, 8); size += 1) {
                progressive.push(clean.slice(0, size));
            }
            return [firstWord, ...progressive];
        })
    ]
        .map((candidate) => String(candidate || '').replace(/\.+$/g, '').replace(/\s+/g, ' ').trim())
        .filter((candidate) => candidate.length >= 3);
    const uniqueTypingAttempts = [...new Set(typingAttempts)];
    const deadline = Date.now() + (options.timeoutMs || 20000);
    const optionSelector = [
        '.p-autocomplete-panel [role="option"]',
        '.p-autocomplete-items [role="option"]',
        '.p-autocomplete-items li',
        '.p-dropdown-item',
        '.ng-dropdown-panel .ng-option',
        '.ng-dropdown-panel .ng-option-label',
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
                await option.click();
            }
            await page.waitForTimeout(1000);
            await input.press('Tab').catch(() => null);
            await page.waitForTimeout(300);
            const selectedValue = await readInputValue(input);
            return {
                ok: true,
                optionText: rawText.replace(/\s+/g, ' ').trim(),
                selectedValue: selectedValue.replace(/\s+/g, ' ').trim(),
                inputMatched: selectedValueMatches(selectedValue)
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

    const typeCandidate = async (candidate, mode) => {
        await input.click();
        await input.fill('');
        if (mode === 'type') {
            await input.type(candidate, { delay: 35 });
        } else {
            await input.fill(candidate);
        }
        await page.waitForTimeout(800);
    };

    while (Date.now() < deadline) {
        for (const candidate of uniqueTypingAttempts) {
            await typeCandidate(candidate, 'fill');
            const fillResult = await waitAndClickMatchingOption(candidate.length <= 3 ? 3500 : 2500);
            if (fillResult.ok) return fillResult;
            await typeCandidate(candidate, 'type');
            const typeResult = await waitAndClickMatchingOption(candidate.length <= 3 ? 3500 : 2500);
            if (typeResult.ok) return typeResult;
        }

        await page.waitForTimeout(300);
    }

    return { ok: false, reason: 'option_not_selected' };
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

const getCarrierReadyState = async (page, cardSelector) => {
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
        ready: !state.disabled && state.hasCalculatedPrice,
        text: state.text || ''
    };
};

const waitForCarrierReady = async (page, cardSelector, timeoutMs = 30000) => {
    const startedAt = Date.now();
    while ((Date.now() - startedAt) < timeoutMs) {
        const state = await getCarrierReadyState(page, cardSelector);
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
        if (await locator.count() && await locator.isVisible().catch(() => false)) {
            if (options.center) {
                const box = await locator.boundingBox().catch(() => null);
                if (box) {
                    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                    return true;
                }
            }
            await locator.click({ force: Boolean(options.force) });
            return true;
        }
    }
    return false;
};

const normalizeProductText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/POWERSS/g, 'POWERS')
    .replace(/\bX1\b/g, '')
    .replace(/[^A-Z0-9]/g, '');

const productMatchesTarget = (text) => {
    const normalizedText = normalizeProductText(text);
    return PRODUCT_ALIASES.some((alias) => normalizedText.includes(normalizeProductText(alias)));
};

const openCreateOrderPanel = async (page) => {
    const deadline = Date.now() + PRODUCT_CARD_WAIT_MS;
    let refreshed = false;
    let lastBodyText = '';

    while (Date.now() < deadline) {
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
        const productCards = page.locator('app-card-product');
        const count = await productCards.count();
        for (let index = 0; index < count; index += 1) {
            const productCard = productCards.nth(index);
            if (await productCard.isVisible().catch(() => false)) {
                const text = await productCard.innerText().catch(() => '');
                if (!productMatchesTarget(text)) continue;
                const button = productCard.getByText('Enviar a cliente', { exact: true }).first();
                if (await button.count() && await button.isVisible().catch(() => false)) {
                    await button.click();
                    return true;
                }
            }
        }

        const sendButtons = page.getByText('Enviar a cliente', { exact: true });
        const buttonCount = await sendButtons.count().catch(() => 0);
        if (buttonCount === 1 && await sendButtons.first().isVisible().catch(() => false)) {
            await sendButtons.first().click();
            return true;
        }

        lastBodyText = (await page.locator('body').innerText({ timeout: 3000 }).catch(() => ''))
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 300);

        if (!refreshed && Date.now() + 15000 < deadline) {
            refreshed = true;
            await page.goto(PRIVATE_PRODUCT_URL, { waitUntil: 'domcontentloaded' }).catch(() => null);
        }

        await page.waitForTimeout(2000);
    }
    throw buildNotReadyError(`private catalog product not found: ${PRODUCT_NAME}${lastBodyText ? ` | page: ${lastBodyText}` : ''}`);
};

const pickCarrier = async (page, carrier) => {
    const carrierReady = await waitForCarrierReady(page, carrier.cardSelector, carrier.timeoutMs || SHIPPING_QUOTE_WAIT_MS);
    if (!carrierReady) return false;
    const picked = await clickFirstVisible(page, [carrier.optionSelector], { center: true });
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
        const products = (quotePayloadArg.products || []).map((item) => ({
            id: item.id,
            name: item.name,
            weight: item.weight,
            stock: item.stock,
            variation_id: item.variation_id,
            quantity: item.quantity,
            price: item.price,
            suggested_price: item.suggested_price,
            sale_price: item.sale_price,
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

const performLogin = async (page) => {
    if (fs.existsSync(STORAGE_STATE_PATH)) {
        await page.goto(ORDERS_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
        if (!isLoginUrl(page.url()) && !(await hasLoginPrompt(page))) return;
    }

    const email = process.env[EMAIL_ENV];
    const password = process.env[PASSWORD_ENV];
    if (!email || !password) {
        throw buildNotReadyError(`missing ${EMAIL_ENV} or ${PASSWORD_ENV}`);
    }

    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
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
    await page.waitForURL(/\/dashboard\//, { timeout: 30000 }).catch(() => null);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
    if (await hasTwoFactorPrompt(page)) {
        throw buildNotReadyError('two-factor authentication required; refresh saved browser session');
    }
    if (isLoginUrl(page.url())) {
        throw buildNotReadyError('login did not reach dashboard');
    }
};

const persistStorageState = async (context) => {
    ensureDir(path.dirname(STORAGE_STATE_PATH));
    await context.storageState({ path: STORAGE_STATE_PATH });
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
            storageState: fs.existsSync(STORAGE_STATE_PATH) ? STORAGE_STATE_PATH : undefined
        });
        const page = await context.newPage();
        return await work({ browser, context, page });
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

const fillOrderFormInPanel = async ({ page, payload, quoteCollector = null }) => {
    const getLatestQuote = quoteCollector || createShippingQuoteCollector(page);

    await page.goto(PRIVATE_PRODUCT_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);

    const opened = await openCreateOrderPanel(page);
    if (!opened) {
        throw buildNotReadyError('create order button not found');
    }

    await fillInputIfVisible(page, selectors.firstName, payload.firstName);
    await fillInputIfVisible(page, selectors.lastName, payload.lastName);
    await fillInputIfVisible(page, selectors.phone, payload.phone);
    const departmentSelected = await selectAutocompleteValue(page, selectors.department, payload.department, {
        timeoutMs: CITY_RELEASE_WAIT_MS
    });
    if (!departmentSelected.ok) {
        throw buildNotReadyError(`department option not selected: ${payload.department || ''}`);
    }
    const cityFieldReady = await waitUntilEnabled(page.locator(selectors.city), CITY_RELEASE_WAIT_MS);
    if (!cityFieldReady) throw buildNotReadyError('city field did not unlock after department selection');
    const citySelected = await selectAutocompleteValue(page, selectors.city, payload.city, {
        timeoutMs: CITY_RELEASE_WAIT_MS
    });
    if (!citySelected.ok) {
        throw buildNotReadyError(`city option not selected: ${payload.city || ''}`);
    }
    await fillInputIfVisible(page, selectors.address, payload.address);
    await fillInputIfVisible(page, selectors.email, payload.email);
    await fillInputIfVisible(page, selectors.priceInput, formatDecimalForDropiEc(payload.unitPrice || payload.price));
    await fillInputIfVisible(page, selectors.quantityInput, payload.quantity);

    await clickFirstVisible(page, [selectors.recaudoButton], { force: true });

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
        chosenCarrier = await pickCarrier(page, carrierOrder[0]);
        carrierPicked = Boolean(chosenCarrier);
    } else {
        chosenCarrier = await pickFirstAvailableCarrier(page, carrierOrder);
        carrierPicked = Boolean(chosenCarrier);
    }

    if (!carrierPicked && payload.agencyPickup) {
        const latestQuote = getLatestQuote();
        const carrierDiagnostics = await collectCarrierDiagnostics(page);
        const quotedCity = latestQuote?.payload?.ciudad_destino?.name || '';
        throw buildNotReadyError(
            `servientrega required for agency pickup but not available`
            + `${quotedCity ? ` | quoted city: ${quotedCity}` : ''}`
            + `${carrierDiagnostics.length ? ` | carriers: ${carrierDiagnostics.join(' || ').slice(0, 700)}` : ''}`
        );
    }

    if (!carrierPicked) {
        throw buildNotReadyError('servientrega/laarcourier selector not found');
    }
    await page.waitForTimeout(1000);
    const latestQuote = getLatestQuote();
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
        quotedDepartment
    };
};

const submitOrderInPanel = async ({ page, payload }) => {
    const getDiagnostics = createPageDiagnosticsCollector(page);
    const getLatestQuote = createShippingQuoteCollector(page);
    const preparedForm = await fillOrderFormInPanel({ page, payload, quoteCollector: getLatestQuote });

    const quote = getLatestQuote();
    const apiResult = await submitOrderViaDropiApi(page, { payload, quote, chosenCarrier: preparedForm.chosenCarrier });
    if (!apiResult.ok || !apiResult.body?.isSuccess) {
        const message = apiResult.body?.message || apiResult.body?.error || `api_status_${apiResult.status}`;
        const destination = apiResult.submittedDestination
            ? ` | destination: ${apiResult.submittedDestination.state || ''}/${apiResult.submittedDestination.city || ''} via ${apiResult.submittedDestination.carrier || ''}`
            : '';
        throw buildNotReadyError(`direct api submit failed: ${message}${destination}`);
    }

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
        throw buildNotReadyError(`${reason}: ${bodyText}${diagnostics ? ` | diagnostics: ${diagnostics}` : ''}`);
    }
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
    return {
        chosenCarrier: preparedForm.chosenCarrier,
        selectedDepartment: preparedForm.selectedDepartment,
        selectedCity: preparedForm.selectedCity,
        quotedDepartment: preparedForm.quotedDepartment,
        quotedCity: preparedForm.quotedCity,
        submittedDestination: apiResult.submittedDestination,
        apiConfirmation,
        panelMatched: true,
        dropiResponse: apiResult.body
    };
};

const findMatchingPanelText = async (page, shipment) => {
    const terms = [
        shipment.raw?.droppiOrder?.id,
        shipment.orderId,
        shipment.logistics?.trackingNumber,
        shipment.client?.phone
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
    untilDate.setDate(untilDate.getDate() + 1);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - Number.parseInt(process.env.DROPPI_EC_ORDER_LOOKBACK_DAYS || '90', 10));
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

const fetchOrdersApiRows = async (page, search) => {
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
        rows.push(...result.body.objects);
        if (result.body.objects.length < resultNumber) break;
    }

    return rows;
};

const rowMatchesShipment = (row, shipment) => {
    const rowPhone = String(row?.phone || '').replace(/\D/g, '');
    const phoneTerms = phoneLookupVariants(shipment.client?.phone || '');
    if (rowPhone && phoneTerms.some((term) => rowPhone.endsWith(term) || term.endsWith(rowPhone))) return true;

    const rowName = normalizeAutocompleteText([row?.name, row?.surname].filter(Boolean).join(' '));
    const names = nameLookupVariants(shipment.client?.name || '').map(normalizeAutocompleteText);
    if (rowName && names.some((name) => name && (rowName.includes(name) || name.includes(rowName)))) return true;

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
    return {
        panelMatched: true,
        source: 'orders_api_v2',
        dropiOrderId: row?.id ? String(row.id) : '',
        trackingNumber: extractTrackingFromOrderRow(row, shipment.logistics?.trackingNumber || ''),
        status: extractStatusFromPanelText(row?.status || JSON.stringify(row), shipment.logistics?.status || ''),
        distributionCompany: carrier,
        address: dir,
        city: row?.city || shipment.client?.city || '',
        province: row?.state || shipment.client?.province || '',
        agencyPickup,
        agencyName,
        rawRow: row
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
        const match = rows.find((row) => rowMatchesShipment(row, shipment)) || rows[0];
        if (match) return mapOrdersApiRowToSyncResult(match, shipment);
    }
    return { panelMatched: false };
};

const extractStatusFromPanelText = (panelText = '', fallback = '') => {
    const raw = String(panelText || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
    if (!raw) return fallback;
    if (/ENTREGAD[OA]|MERCANCIA ENTREGADA|PEDIDO ENTREGADO/.test(raw)) return 'ENTREGADO';
    if (/DEVUELT[OA]|DEVOLUCION|NO RETIRAD[OA]/.test(raw)) return 'DEVUELTO';
    if (/NOVEDAD/.test(raw)) return 'NOVEDAD';
    if (/INGRESANDO EN AGENCIA|LISTO PARA RETIRO|EN AGENCIA|AGENCIA|PUNTO DE RETIRO/.test(raw)) return 'READY_FOR_PICKUP';
    if (/GUIA GENERADA|GUIA_GENERADA|PREPARADO PARA TRANSPORTADORA/.test(raw)) return 'GUIA_GENERADA';
    if (/EN RUTA|EN REPARTO|EN DESPACHO|EN BODEGA|TRANSPORTADORA/.test(raw)) return 'EN_RUTA';
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

    const search = page.locator(selectors.ordersSearch).first();
    await search.waitFor({ state: 'visible', timeout: 20000 }).catch(() => null);
    if (!(await search.count())) {
        const bodyText = (await page.locator('body').innerText({ timeout: 3000 }).catch(() => ''))
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 300);
        throw buildNotReadyError(`orders search selector not found: ${bodyText}`);
    }

    let panelText = '';
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
        await search.fill(String(term || ''));
        await page.keyboard.press('Enter').catch(() => null);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
        await page.waitForTimeout(1500);
        panelText = await findMatchingPanelText(page, shipment);
        if (panelText) break;
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

export const submitDroppiEcuadorOrder = async ({ order, shipment }) => {
    const locked = await lockShipmentForBrowserWorkEc(shipment);
    if (!locked) return { ok: false, reason: 'locked' };

    try {
        const prepared = await prepareDroppiEcuadorSubmission(order);
        await updateBrowserState(shipment._id, 'prepared_submission', {
            lastError: '',
            event: { kind: 'droppi_browser_prepared', payload: prepared.payload }
        });

        const result = await withBrowserSession(async ({ context, page }) => {
            await performLogin(page);
            await persistStorageState(context);
            await updateBrowserState(shipment._id, 'logged_in');
            return submitOrderInPanel({ page, payload: prepared.payload });
        });

        await Shipment.updateOne(
            { _id: shipment._id },
            {
                $set: {
                    'automation.browserCheckpoint': 'submitted_order',
                    'automation.browserLastError': '',
                    'automation.submittedToDroppiAt': new Date(),
                    'review.manualOnly': false,
                    'review.reviewReason': '',
                    'review.reviewStatus': 'submitted',
                    'logistics.status': result.dropiResponse?.objects?.status || 'PENDIENTE',
                    'logistics.chosenCarrier': result.chosenCarrier,
                    'logistics.distributionCompany': result.dropiResponse?.objects?.shipping_company || result.chosenCarrier || '',
                    'raw.droppiOrder': result.dropiResponse?.objects || null
                },
                $push: {
                    events: {
                        kind: 'droppi_order_submitted',
                        at: new Date(),
                        payload: result
                    }
                }
            }
        );

        await Order.updateOne(
            { orderId: shipment.orderId },
            {
                $set: {
                    status: 'processing',
                    shippingStatus: result.dropiResponse?.objects?.status || 'PENDIENTE',
                    dropiOrderId: result.dropiResponse?.objects?.id ? String(result.dropiResponse.objects.id) : ''
                }
            }
        ).catch(() => null);

        const adminStatusResult = await markOnlineAdminPedidoEnviado({
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

        return { ok: true, result };
    } catch (error) {
        const reason = isDropiPaymentRequiredError(error.message)
            ? 'dropi_payment_required'
            : 'submit_failed';
        await updateBrowserState(shipment._id, reason, {
            lastError: error.message || 'unknown_error',
            event: { kind: 'droppi_browser_error', payload: { message: error.message || 'unknown_error' } }
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
            storageState: fs.existsSync(STORAGE_STATE_PATH) ? STORAGE_STATE_PATH : undefined
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

        const result = await fillOrderFormInPanel({ page, payload: prepared.payload });
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
            message: 'Formulario Dropi preparado. Confira a janela aberta e clique Enviar al cliente manualmente.'
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
            invoiceUrl: shipment.logistics.invoiceUrl,
            sessionId: shipment.automation.sessionId,
            dropiOrderId: result.dropiOrderId || ''
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
