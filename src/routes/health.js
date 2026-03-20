import express from 'express';
import { getStatus } from '../whatsapp/connection.js';
import { getQueueSize } from '../whatsapp/queue.js';

const router = express.Router();

/**
 * Enterprise Healthcheck
 * Exposes core vital metrics: Server uptime, Baileys Connection State, and active AI tasks in queues.
 */
router.get('/', async (req, res) => {
    try {
        const { isReady, status } = getStatus();
        const pendingTasks = getQueueSize();

        return res.json({
            status: 'online',
            timestamp: new Date().toISOString(),
            engine: 'Baileys',
            pid: process.pid,
            uptime_seconds: process.uptime(),
            runner: 'node src/index.js',
            whatsapp: {
                state: status,
                ready: isReady
            },
            bot_inbound_queue: {
                pendingTasks: pendingTasks
            }
        });
    } catch (e) {
        return res.status(500).json({ status: 'error', message: e.message });
    }
});

export default router;
