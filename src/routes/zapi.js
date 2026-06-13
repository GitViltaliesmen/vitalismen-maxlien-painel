import express from 'express';
import {
    getZapiDevice,
    getZapiStatus,
    normalizeZapiDevice,
    zapiPublicStatus
} from '../services/zapiClient.js';

const router = express.Router();
const digits = (value) => String(value || '').replace(/\D/g, '');

const exposeError = (error) => ({
    ok: false,
    error: error?.response?.data || error.message || 'zapi_error',
    status: error?.response?.status || error.statusCode || null
});

const connectedFromStatus = (status = {}) => (
    status.connected === true
    || status.smartphoneConnected === true
    || status.session === true
    || String(status.status || '').toLowerCase() === 'connected'
);

router.get('/config', (_req, res) => {
    res.json({
        ok: true,
        zapi: zapiPublicStatus()
    });
});

router.get('/status', async (_req, res) => {
    try {
        const status = await getZapiStatus();
        const connected = connectedFromStatus(status);
        let device = null;
        if (connected) {
            try {
                device = normalizeZapiDevice(await getZapiDevice());
            } catch {
                device = null;
            }
        }

        res.json({
            ok: connected,
            status: {
                ...status,
                source: 'zapi_status',
                phone: digits(device?.phone || status.phone || status.connectedPhone || '')
            },
            device
        });
    } catch (error) {
        res.status(error?.response?.status || error.statusCode || 500).json(exposeError(error));
    }
});

router.get('/device', async (_req, res) => {
    try {
        const device = normalizeZapiDevice(await getZapiDevice());
        res.json({
            ok: Boolean(device.phone),
            device
        });
    } catch (error) {
        res.status(error?.response?.status || error.statusCode || 500).json(exposeError(error));
    }
});

export default router;
