import fs from 'fs';
import mongoose from 'mongoose';
import { chromium } from 'playwright';
import connectDB from '../src/config/db.js';
import Order from '../src/models/Order.js';
import {
    fillOrderFormInPanel,
    performLogin,
    prepareDroppiEcuadorSubmission
} from '../src/services/droppiEcuadorBrowserService.js';

await connectDB();

const order = await Order.findOne({ orderId: 'EC-ADMIN-1890' });
if (!order) throw new Error('order_not_found');
const prepared = await prepareDroppiEcuadorSubmission(order);
const storageState = fs.existsSync('.local/droppi-ec-storage.json')
    ? '.local/droppi-ec-storage.json'
    : undefined;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 1200 }
});
const page = await context.newPage();

try {
    await performLogin(page);
    const result = await fillOrderFormInPanel({ page, payload: prepared.payload });
    console.log(JSON.stringify({ ok: true, result }, null, 2));
} catch (error) {
    const diag = await page.evaluate(() => {
        const valueList = (selector) => Array.from(document.querySelectorAll(selector)).map((node) => ({
            value: node.value || '',
            text: (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim(),
            disabled: Boolean(node.disabled),
            ariaExpanded: node.getAttribute('aria-expanded') || '',
            className: node.getAttribute('class') || ''
        })).slice(0, 8);

        return {
            url: location.href,
            stateInputs: valueList('[data-cy="client-state"] input, input[placeholder="Departamento"]'),
            cityInputs: valueList('[data-cy="client-city"] input, input[placeholder="Ciudad"]'),
            addressInputs: valueList('[data-cy="client-address"], input[placeholder*="Dirección"]'),
            carrierCards: Array.from(document.querySelectorAll('.card-logistic')).map((node) => ({
                text: (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim(),
                className: node.getAttribute('class') || ''
            })).slice(0, 10),
            alerts: Array.from(document.querySelectorAll('dropi-alert, .alert-container, .error-mssa'))
                .map((node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
                .filter(Boolean)
                .slice(0, 10),
            body: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1200)
        };
    }).catch((diagError) => ({ diagError: diagError.message }));

    const screenshot = '/tmp/dropi-1890-diagnostic.png';
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => null);
    console.log(JSON.stringify({
        ok: false,
        error: error.message,
        diag,
        screenshot
    }, null, 2));
} finally {
    await context.close().catch(() => null);
    await browser.close().catch(() => null);
    await mongoose.disconnect().catch(() => null);
}
