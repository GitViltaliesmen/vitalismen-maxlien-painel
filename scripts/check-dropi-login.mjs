import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

const country = String(process.argv[2] || 'ec').toLowerCase();
if (country !== 'ec') {
    console.error('Only Ecuador login checks are supported in this project.');
    process.exit(1);
}
const config = {
    loginUrl: process.env.DROPPI_EC_LOGIN_URL || 'https://app.dropi.ec/auth/login',
    email: process.env.DROPI_EC_EMAIL || '',
    password: process.env.DROPI_EC_PASSWORD || ''
};

const browser = await chromium.launch({ headless: true });

try {
    const page = await browser.newPage();
    await page.goto(config.loginUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });
    await page.locator('#email, input[type="email"], input[name="email"]').first().fill(config.email);
    await page.locator('#password, input[type="password"], input[name="password"]').first().fill(config.password);
    await page.waitForTimeout(1000);
    const loginButton = page.getByRole('button', {
        name: /^(ingresar|iniciar sesi[oó]n|entrar|log in|login)$/i
    }).first();
    if (await loginButton.count()) {
        await loginButton.click();
    } else {
        const submit = page.locator('form button[type="submit"], form input[type="submit"]').first();
        if (await submit.count()) {
            await submit.click();
        } else {
            console.log(JSON.stringify({
                country,
                url: page.url(),
                title: await page.title(),
                bodyText: (await page.locator('body').innerText().catch(() => ''))
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 1200),
                inputs: await page.locator('input').evaluateAll((nodes) => nodes.map((node) => ({
                    type: node.getAttribute('type') || '',
                    name: node.getAttribute('name') || '',
                    id: node.getAttribute('id') || '',
                    placeholder: node.getAttribute('placeholder') || '',
                    visible: Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length)
                }))).catch(() => []),
                buttons: await page.locator('button, [role="button"], input[type="submit"], a').evaluateAll((nodes) => nodes.map((node) => ({
                    tag: node.tagName,
                    type: node.getAttribute('type') || '',
                    text: (node.innerText || node.value || '').replace(/\s+/g, ' ').trim(),
                    aria: node.getAttribute('aria-label') || '',
                    href: node.getAttribute('href') || '',
                    visible: Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length)
                }))).catch(() => [])
            }, null, 2));
            throw new Error('Visible login submit not found');
        }
    }
    await page.waitForTimeout(5000);
    console.log(JSON.stringify({
        country,
        url: page.url(),
        title: await page.title(),
        bodyText: (await page.locator('body').innerText().catch(() => ''))
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 1200),
        buttons: await page.locator('button, [role="button"], input[type="submit"]').evaluateAll((nodes) => nodes.map((node) => ({
            tag: node.tagName,
            type: node.getAttribute('type') || '',
            text: (node.innerText || node.value || '').replace(/\s+/g, ' ').trim(),
            aria: node.getAttribute('aria-label') || '',
            visible: Boolean(node.offsetWidth || node.offsetHeight || node.getClientRects().length)
        }))).catch(() => [])
    }, null, 2));
} finally {
    await browser.close();
}
