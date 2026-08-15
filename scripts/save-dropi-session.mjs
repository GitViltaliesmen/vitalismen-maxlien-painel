import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const country = String(process.argv[2] || 'ec').toLowerCase();
const manualLogin = process.argv.includes('--manual') || process.argv.includes('manual');
const headless = process.argv.includes('--headless') || process.env.DROPPI_EC_HEADLESS === '1' || process.env.DROPPI_EC_HEADLESS === 'true';
if (country !== 'ec') {
    console.error('Only Ecuador sessions are supported in this project.');
    process.exit(1);
}

const config = {
    label: 'Ecuador',
    loginUrl: process.env.DROPPI_EC_LOGIN_URL || 'https://app.dropi.ec/auth/login',
    ordersUrl: process.env.DROPPI_EC_ORDERS_URL || 'https://app.dropi.ec/dashboard/orders',
    email: process.env.DROPI_EC_EMAIL || '',
    password: process.env.DROPI_EC_PASSWORD || '',
    storageStatePath: process.env.DROPPI_EC_STORAGE_STATE_PATH && path.isAbsolute(process.env.DROPPI_EC_STORAGE_STATE_PATH)
        ? process.env.DROPPI_EC_STORAGE_STATE_PATH
        : path.join(process.env.HOME || process.cwd(), '.vitalismen-secrets', 'droppi-ec-storage.json')
};

if (!manualLogin && (!config.email || !config.password)) {
    console.error(`Missing Dropi ${config.label} email/password in .env`);
    process.exit(1);
}

fs.mkdirSync(path.dirname(config.storageStatePath), { recursive: true });

const browser = await chromium.launch({ headless });
const context = await browser.newContext();
const page = await context.newPage();

const getBodyExcerpt = async (limit = 800) => (await page.locator('body').innerText({ timeout: 3000 }).catch(() => ''))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);

const isLoginScreen = async () => {
    const passwordVisible = await page.locator('#password, input[type="password"], input[name="password"]').first()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
    if (passwordVisible) return true;
    return /usuario\s+contrase[nñ]a|iniciar sesi[oó]n|olvid[oó] su contrase[nñ]a|sign in with credentials|username\s+password|forgot password|remember me|log in/i
        .test(await getBodyExcerpt());
};

const hasSessionToken = async () => page.evaluate(() => {
    const keys = [
        'DROPI_token',
        'DROPI_SessionData',
        'casUser',
        'token',
        'access_token'
    ];
    return keys.some((key) => Boolean(window.localStorage?.getItem(key) || window.sessionStorage?.getItem(key)));
}).catch(() => false);

const clickVisibleLoginButton = async () => page.locator('button, input[type="submit"]').evaluateAll((nodes) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const labelRe = /^(ingresar|iniciar sesi[oó]n|entrar|log in|login)$/i;
    const button = nodes.find((node) => {
        const visible = Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
        const label = normalize(node.innerText || node.value || node.getAttribute('aria-label') || '');
        return visible && labelRe.test(label);
    });
    if (!button) return false;
    button.click();
    return true;
});

try {
    await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!manualLogin) {
        const emailInput = page.locator('#email, input[type="email"], input[name="email"]').first();
        const passwordInput = page.locator('#password, input[type="password"], input[name="password"]').first();
        await emailInput.fill(config.email);
        await passwordInput.fill(config.password);
        await passwordInput.press('Enter').catch(() => null);
        await page.waitForURL(/\/dashboard\//, { timeout: 10000 }).catch(() => null);
        if (!/\/dashboard\//.test(page.url())) {
            const clicked = await clickVisibleLoginButton();
            if (!clicked) throw new Error('Visible login button not found');
        }
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
    }

    if (manualLogin) {
        console.log(`Log in to Dropi ${config.label} in the browser window and complete two-factor authentication if prompted...`);
        await page.waitForURL(/\/dashboard\//, { timeout: 300000 });
    }
    if ((/\/(auth\/)?login\b/i.test(new URL(page.url()).pathname) || await isLoginScreen()) && !(await hasSessionToken())) {
        throw new Error(`Dropi login did not reach dashboard: ${await getBodyExcerpt()}`);
    }
    await page.goto(config.ordersUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
    if ((/\/(auth\/)?login\b/i.test(new URL(page.url()).pathname) || await isLoginScreen()) && !(await hasSessionToken())) {
        throw new Error(`Dropi orders page still requires login: ${await getBodyExcerpt()}`);
    }
    await context.storageState({ path: config.storageStatePath });
    fs.chmodSync(config.storageStatePath, 0o600);

    console.log(JSON.stringify({
        success: true,
        country,
        url: page.url(),
        headless,
        storageStatePath: config.storageStatePath
    }, null, 2));
} finally {
    await context.close().catch(() => null);
    await browser.close().catch(() => null);
}
