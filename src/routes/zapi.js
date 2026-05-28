import express from 'express';
import { getZapiDevice, getZapiStatus, sendZapiText, zapiPublicStatus } from '../services/zapiClient.js';
import { getRecentZapiActivity, persistZapiWebhook } from '../services/zapiWebhookService.js';

const router = express.Router();

const exposeError = (error) => ({
    ok: false,
    error: error?.response?.data || error.message || 'zapi_error',
    status: error?.response?.status || null
});

const recentZapiFallback = async () => {
    const recent = await getRecentZapiActivity({
        minutes: Number(process.env.ZAPI_ACTIVITY_FALLBACK_MINUTES || 20)
    }).catch(() => ({ active: false }));
    const phone = String(process.env.ZAPI_CONNECTED_PHONE || process.env.ZAPI_OPERATION_PHONE || '').replace(/\D/g, '');
    return recent.active && phone ? { recent, phone } : null;
};

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
        const disconnected = status?.connected === false || status?.session === false || status?.error;
        if (disconnected) {
            const fallback = await recentZapiFallback();
            if (fallback) {
                return res.json({
                    ok: true,
                    fallback: true,
                    originalStatus: status,
                    status: {
                        connected: true,
                        session: true,
                        smartphoneConnected: true,
                        source: 'recent_webhook_activity',
                        phone: fallback.phone,
                        at: fallback.recent.at
                    },
                    recentActivity: fallback.recent
                });
            }
        }
        res.json({ ok: true, status });
    } catch (error) {
        const fallback = await recentZapiFallback();
        if (fallback) {
            return res.json({
                ok: true,
                fallback: true,
                status: {
                    connected: true,
                    session: true,
                    smartphoneConnected: true,
                    source: 'recent_webhook_activity',
                    phone: fallback.phone,
                    at: fallback.recent.at
                },
                recentActivity: fallback.recent
            });
        }
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
        const fallback = await recentZapiFallback();
        if (fallback) {
            return res.json({
                ok: true,
                fallback: true,
                device: {
                    phone: fallback.phone,
                    name: 'Z-API',
                    isBusiness: false,
                    originalDevice: '',
                    sessionName: 'webhook-active'
                },
                recentActivity: fallback.recent
            });
        }
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
