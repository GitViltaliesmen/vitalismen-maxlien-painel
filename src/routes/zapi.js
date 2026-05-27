import express from 'express';
import { getZapiDevice, getZapiStatus, sendZapiText, zapiPublicStatus } from '../services/zapiClient.js';
import { persistZapiWebhook } from '../services/zapiWebhookService.js';

const router = express.Router();

const exposeError = (error) => ({
    ok: false,
    error: error?.response?.data || error.message || 'zapi_error',
    status: error?.response?.status || null
});

router.get('/config', (_req, res) => {
    res.json({
        ok: true,
        zapi: zapiPublicStatus(),
        webhookUrls: {
            received: '/api/zapi/webhook/received',
            delivery: '/api/zapi/webhook/delivery'
        }
    });
});

router.get('/status', async (_req, res) => {
    try {
        const status = await getZapiStatus();
        res.json({ ok: true, status });
    } catch (error) {
        res.status(error?.response?.status || 500).json(exposeError(error));
    }
});

router.get('/device', async (_req, res) => {
    try {
        const device = await getZapiDevice();
        const phone = String(device.phone || '').replace(/\D/g, '');
        res.json({
            ok: true,
            device: {
                phone,
                name: device.name || '',
                isBusiness: Boolean(device.isBusiness),
                originalDevice: device.originalDevice || '',
                sessionName: device.device?.sessionName || ''
            }
        });
    } catch (error) {
        res.status(error?.response?.status || 500).json(exposeError(error));
    }
});

router.post('/send-text', async (req, res) => {
    try {
        const result = await sendZapiText({
            phone: req.body.phone,
            message: req.body.message,
            messageId: req.body.messageId
        });
        res.json({ ok: true, result });
    } catch (error) {
        res.status(error?.response?.status || 500).json(exposeError(error));
    }
});

router.post('/webhook/received', async (req, res) => {
    try {
        const result = await persistZapiWebhook(req.body || {});
        res.json({
            ok: true,
            saved: Boolean(result.ok && !result.skipped),
            skipped: result.skipped || null
        });
    } catch (error) {
        console.error('[ZAPI] webhook received error:', error);
        res.status(500).json({ ok: false, error: 'zapi_webhook_received_failed' });
    }
});

router.post('/webhook/delivery', async (req, res) => {
    try {
        const result = await persistZapiWebhook({ ...(req.body || {}), fromMe: true });
        res.json({
            ok: true,
            saved: Boolean(result.ok && !result.skipped),
            skipped: result.skipped || null
        });
    } catch (error) {
        console.error('[ZAPI] webhook delivery error:', error);
        res.status(500).json({ ok: false, error: 'zapi_webhook_delivery_failed' });
    }
});

export default router;
