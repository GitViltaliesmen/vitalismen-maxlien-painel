import express from 'express';
import { getAllStatuses, getStatus } from '../whatsapp/connection.js';
import { getQueueSize } from '../whatsapp/queue.js';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';

const router = express.Router();

/**
 * Enterprise Healthcheck
 * Exposes core vital metrics: Server uptime, Baileys Connection State, and active AI tasks in queues.
 */
router.get('/', async (req, res) => {
    try {
        const { isReady, status } = getStatus();
        const sessions = getAllStatuses();
        const pendingTasks = getQueueSize();
        const now = new Date();
        const last15Minutes = new Date(now.getTime() - 15 * 60 * 1000);
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const connectedSessions = sessions.filter((item) => item?.isReady && item?.status === 'connected');
        const loggedOutSessions = sessions.filter((item) => item?.status === 'logged_out');
        const recentInboundContacts = await ContactState.countDocuments({ lastInboundAt: { $gte: last24Hours } });
        const recentOutboundContacts = await ContactState.countDocuments({ lastOutboundAt: { $gte: last24Hours } });
        const recentlyProcessedMessages = await Message.countDocuments({ createdAt: { $gte: last15Minutes } });
        const memoryBackedContacts = await ContactState.countDocuments({ 'metadata.aiMemory.updatedAt': { $exists: true } });
        const lastInbound = await Message.findOne({ isFromMe: false, isBot: false })
            .sort({ createdAt: -1, timestamp: -1 })
            .select('chatId peerPhone body createdAt sessionId')
            .lean();
        const degradedReasons = [];

        if (!connectedSessions.length) degradedReasons.push('no_connected_whatsapp_session');
        if (loggedOutSessions.length) degradedReasons.push('logged_out_session_present');
        if (pendingTasks > 50) degradedReasons.push('large_inbound_queue');

        return res.json({
            status: degradedReasons.length ? 'degraded' : 'online',
            timestamp: new Date().toISOString(),
            engine: 'Baileys',
            pid: process.pid,
            uptime_seconds: process.uptime(),
            runner: 'node src/index.js',
            degradedReasons,
            whatsapp: {
                state: status,
                ready: isReady,
                connectedSessions: connectedSessions.length,
                loggedOutSessions: loggedOutSessions.length,
                sessions
            },
            bot_inbound_queue: {
                pendingTasks: pendingTasks
            },
            memory: {
                backedBy: 'mongodb',
                memoryBackedContacts,
                recentInboundContacts24h: recentInboundContacts,
                recentOutboundContacts24h: recentOutboundContacts,
                recentlyProcessedMessages15m: recentlyProcessedMessages,
                lastInbound: lastInbound ? {
                    chatId: lastInbound.chatId,
                    peerPhone: lastInbound.peerPhone || '',
                    sessionId: lastInbound.sessionId || '',
                    at: lastInbound.createdAt,
                    preview: String(lastInbound.body || '').slice(0, 120)
                } : null
            }
        });
    } catch (e) {
        return res.status(500).json({ status: 'error', message: e.message });
    }
});

export default router;
