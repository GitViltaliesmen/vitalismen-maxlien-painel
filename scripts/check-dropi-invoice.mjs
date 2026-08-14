import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

const invoiceUrl = process.argv[2];

if (!invoiceUrl) {
    console.error('Missing invoice URL');
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
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("Ingresar"), button:has-text("Iniciar"), button:has-text("Entrar"), button:has-text("Log in"), button:has-text("Login"), button[type="submit"], input[type="submit"]').first().click();
    await page.waitForURL(/\/dashboard\//, { timeout: 30000 });

    const direct = await page.context().request.get(invoiceUrl);
    const withReferer = await page.context().request.get(invoiceUrl, {
        headers: {
            referer: process.env.DROPPI_EC_ORDERS_URL || 'https://app.dropi.ec/dashboard/orders'
        }
    });

    console.log(JSON.stringify({
        url: page.url(),
        directStatus: direct.status(),
        refererStatus: withReferer.status(),
        directOk: direct.ok(),
        refererOk: withReferer.ok()
    }, null, 2));
} finally {
    await browser.close();
}
