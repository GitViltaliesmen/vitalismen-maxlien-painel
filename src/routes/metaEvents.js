import express from 'express';
import { sendBrowserMetaEvent } from '../services/metaConversionsService.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const result = await sendBrowserMetaEvent(req.body, req);
        return res.status(200).json({
            ok: true,
            accepted: true,
            capi: {
                ok: Boolean(result.ok),
                eventId: result.eventId || req.body?.eventId || req.body?.event_id || null,
                error: result.ok ? null : (result.error || 'META event not sent'),
                status: result.status || null
            }
        });
    } catch (error) {
        console.error('[META_EVENTS] non-blocking handler failed:', error);
        return res.status(200).json({
            ok: true,
            accepted: true,
            capi: {
                ok: false,
                error: 'META event handler failed'
            }
        });
    }
});

export default router;
