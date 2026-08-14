import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

const orderId = process.argv[2];

if (!orderId) {
    console.error('Missing order id');
    process.exit(1);
}

const browser = await chromium.launch({ headless: true });

try {
    const page = await browser.newPage();
    await page.goto(process.env.DROPPI_EC_LOGIN_URL || 'https://app.dropi.ec/auth/login', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });
    await page.locator('#email, input[type="email"], input[name="email"]').first().fill(process.env.DROPI_EC_EMAIL || '');
    await page.locator('#password, input[type="password"], input[name="password"]').first().fill(process.env.DROPI_EC_PASSWORD || '');
    await page.locator('button:has-text("Ingresar"), button:has-text("Iniciar"), button:has-text("Entrar"), button:has-text("Log in"), button:has-text("Login"), button[type="submit"], input[type="submit"]').first().click();
    await page.waitForURL(/\/dashboard\//, { timeout: 30000 });

    await page.goto(process.env.DROPPI_EC_ORDERS_URL || 'https://app.dropi.ec/dashboard/orders', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);

    const search = page.locator('input[placeholder*="Buscar"], input[placeholder*="Search"]').first();
    if (await search.count()) {
        await search.fill(String(orderId));
        await page.keyboard.press('Enter').catch(() => null);
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
        await page.waitForTimeout(2000);
    }

    const data = await page.locator('tr, .table-responsive tbody tr, .card, .row').evaluateAll((els, targetOrderId) => {
        const text = (value) => (value || '').replace(/\s+/g, ' ').trim();
        const matches = [];
        for (const el of els) {
            const block = text(el.innerText);
            if (!block.includes(targetOrderId)) continue;
            const anchors = Array.from(el.querySelectorAll('a')).map((a) => ({
                text: text(a.innerText),
                href: a.href,
                title: a.getAttribute('title') || '',
                cls: a.className || ''
            }));
            const buttons = Array.from(el.querySelectorAll('button, i, svg')).map((node) => ({
                tag: node.tagName,
                text: text(node.innerText),
                title: node.getAttribute('title') || '',
                aria: node.getAttribute('aria-label') || '',
                cls: node.className?.baseVal || node.className || ''
            }));
            matches.push({ block, anchors, buttons });
        }
        return matches;
    }, orderId);

    console.log(JSON.stringify({ orderId, url: page.url(), matches: data }, null, 2));
} finally {
    await browser.close();
}
