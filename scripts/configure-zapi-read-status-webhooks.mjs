import axios from 'axios';
import 'dotenv/config';
import { zapiConfig } from '../src/services/zapiClient.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const publicBase = String(process.env.ZAPI_PUBLIC_WEBHOOK_BASE || process.env.EC_PUBLIC_BASE_URL || 'https://ec.maxlien.shop').replace(/\/+$/, '');
const deliveryWebhookUrl = `${publicBase}/api/zapi/webhook/delivery`;
const receivedWebhookUrl = `${publicBase}/api/zapi/webhook/received`;

const cfg = zapiConfig();
if (!cfg.enabled) {
    console.error('[ZAPI-WEBHOOK-CONFIG] BLOQUEADO: ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN e ZAPI_CLIENT_TOKEN precisam estar configurados.');
    process.exit(1);
}

const endpoint = (path) => `${cfg.baseUrl}/instances/${cfg.instanceId}/token/${cfg.instanceToken}/${path}`;
const headers = {
    'Client-Token': cfg.clientToken,
    'Content-Type': 'application/json'
};

const configure = async ({ label, path, value }) => {
    if (dryRun) {
        return {
            label,
            path,
            value,
            dryRun: true
        };
    }
    const response = await axios.put(endpoint(path), { value }, {
        headers,
        timeout: Number(process.env.ZAPI_TIMEOUT_MS || 15000)
    });
    return {
        label,
        path,
        value,
        status: response.status,
        ok: response.data?.value === true || response.status >= 200 && response.status < 300
    };
};

const result = {
    ok: true,
    dryRun,
    instanceConfigured: Boolean(cfg.instanceId),
    instanceSuffix: String(cfg.instanceId || '').slice(-6),
    baseUrl: cfg.baseUrl,
    webhooks: []
};

for (const item of [
    {
        label: 'received',
        path: 'update-webhook-received',
        value: receivedWebhookUrl
    },
    {
        label: 'delivery',
        path: 'update-webhook-delivery',
        value: deliveryWebhookUrl
    },
    {
        label: 'message_status',
        path: 'update-webhook-message-status',
        value: deliveryWebhookUrl
    }
]) {
    try {
        result.webhooks.push(await configure(item));
    } catch (error) {
        result.ok = false;
        result.webhooks.push({
            label: item.label,
            path: item.path,
            value: item.value,
            status: error?.response?.status || null,
            error: error?.response?.data?.message || error?.response?.data || error.message
        });
    }
}

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
