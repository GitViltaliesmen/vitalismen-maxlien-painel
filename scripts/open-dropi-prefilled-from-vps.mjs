import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { fillOrderFormInPanel, performLogin } from '../src/services/droppiEcuadorBrowserService.js';

const orderId = String(process.argv[2] || '').trim();
if (!orderId) {
    console.error('Uso: node scripts/open-dropi-prefilled-from-vps.mjs EC-...');
    process.exit(1);
}

const sshKey = path.join(os.homedir(), '.ssh', 'vps_auditoria_codex');
const remoteScript = `
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "./src/config/db.js";
import Order from "./src/models/Order.js";
import { prepareDroppiEcuadorSubmission } from "./src/services/droppiEcuadorBrowserService.js";
await connectDB();
const order = await Order.findOne({ orderId: ${JSON.stringify(orderId)} }).lean();
if (!order) throw new Error("order_not_found");
const prepared = await prepareDroppiEcuadorSubmission(order);
console.log(JSON.stringify({
  orderId: order.orderId,
  customer: order.customer,
  productUrl: prepared.productUrl,
  payload: prepared.payload
}));
await mongoose.disconnect();
`;

const remoteOutput = execFileSync('ssh', [
    '-o',
    'HostKeyAlias=maxlien.shop',
    '-i',
    sshKey,
    'root@72.60.137.77',
    'cd /opt/vitalismen-automacao/current && node --input-type=module'
], {
    input: remoteScript,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 5
});

const jsonLine = remoteOutput
    .trim()
    .split('\n')
    .reverse()
    .find((line) => line.trim().startsWith('{'));

if (!jsonLine) {
    throw new Error(`Nao consegui ler os dados do pedido: ${remoteOutput}`);
}

const prepared = JSON.parse(jsonLine);
const storageState = path.join(process.cwd(), '.local', 'droppi-ec-storage.json');
const browser = await chromium.launch({
    headless: false,
    slowMo: Number.parseInt(process.env.DROPPI_EC_MANUAL_SLOW_MO_MS || '80', 10)
});
const context = await browser.newContext({
    acceptDownloads: true,
    storageState: fs.existsSync(storageState) ? storageState : undefined
});
const page = await context.newPage();

await performLogin(page);
const result = await fillOrderFormInPanel({
    page,
    payload: prepared.payload,
    manualDraftOnly: true
});
console.log(JSON.stringify({
    ok: true,
    orderId: prepared.orderId,
    customer: prepared.customer?.name || '',
    message: 'Dropi aberta no Mac com formulario preenchido. Confira e confirme manualmente na janela aberta.',
    result
}, null, 2));
