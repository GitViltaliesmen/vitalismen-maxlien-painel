import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const country = String(process.argv[2] || 'ec').toLowerCase();
const manualLogin = process.argv.includes('--manual') || process.argv.includes('manual');
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
    storageStatePath: process.env.DROPPI_EC_STORAGE_STATE_PATH || path.join(process.cwd(), '.local', 'droppi-ec-storage.json')
};

if (!manualLogin && (!config.email || !config.password)) {
    console.error(`Missing Dropi ${config.label} email/password in .env`);
    process.exit(1);
}

fs.mkdirSync(path.dirname(config.storageStatePath), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

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
    }

    console.log(`Log in to Dropi ${config.label} in the browser window and complete two-factor authentication if prompted...`);
    await page.waitForURL(/\/dashboard\//, { timeout: 300000 });
    await page.goto(config.ordersUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);
    await context.storageState({ path: config.storageStatePath });

    console.log(JSON.stringify({
        success: true,
        country,
        url: page.url(),
        storageStatePath: config.storageStatePath
    }, null, 2));
} finally {
    await context.close().catch(() => null);
    await browser.close().catch(() => null);
}
