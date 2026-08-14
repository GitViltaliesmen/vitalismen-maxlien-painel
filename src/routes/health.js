import express from 'express';
import { getAllStatuses, getStatus } from '../whatsapp/connection.js';
import { getQueueSize } from '../whatsapp/queue.js';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import { getZapiDevice, getZapiStatus, zapiPublicStatus } from '../services/zapiClient.js';

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
        const whatsappConnectEnabled = String(process.env.WHATSAPP_CONNECT_ENABLED || 'true').toLowerCase() !== 'false';
        const zapiPrimary = !whatsappConnectEnabled;
        const zapi = {
            configured: zapiPublicStatus(),
            connected: false,
            phone: '',
            name: '',
            error: ''
        };
        if (zapiPrimary && zapi.configured.enabled) {
            try {
                const [zapiStatus, zapiDevice] = await Promise.all([
                    getZapiStatus(),
                    getZapiDevice().catch(() => null)
                ]);
                const alreadyConnected = String(zapiStatus?.error || '').toLowerCase().includes('already connected');
                zapi.connected = Boolean(zapiStatus?.connected || zapiStatus?.smartphoneConnected || alreadyConnected);
                zapi.phone = String(zapiDevice?.phone || process.env.ZAPI_OPERATIONAL_PHONE || process.env.ZAPI_CONNECTED_PHONE || '');
                zapi.name = String(zapiDevice?.name || zapiDevice?.sessionName || 'Z-API');
            } catch (error) {
                zapi.error = error.message || 'zapi_status_failed';
            }
        }
        const recentInboundContacts = await ContactState.countDocuments({ lastInboundAt: { $gte: last24Hours } });
        const recentOutboundContacts = await ContactState.countDocuments({ lastOutboundAt: { $gte: last24Hours } });
        const recentlyProcessedMessages = await Message.countDocuments({ createdAt: { $gte: last15Minutes } });
        const memoryBackedContacts = await ContactState.countDocuments({ 'metadata.aiMemory.updatedAt': { $exists: true } });
        const lastInbound = await Message.findOne({ isFromMe: false, isBot: false })
            .sort({ createdAt: -1, timestamp: -1 })
            .select('createdAt sessionId provider type')
            .lean();
        const degradedReasons = [];

        if (whatsappConnectEnabled && !connectedSessions.length) degradedReasons.push('no_connected_whatsapp_session');
        if (zapiPrimary && !zapi.connected) degradedReasons.push('zapi_not_connected');
        if (whatsappConnectEnabled && loggedOutSessions.length) degradedReasons.push('logged_out_session_present');
        if (pendingTasks > 50) degradedReasons.push('large_inbound_queue');

        const zapiSession = {
            sessionId: 'zapi',
            isReady: zapi.connected,
            status: zapi.connected ? 'connected' : 'disconnected',
            provider: 'zapi'
        };
        const safeWebSessions = sessions.map((session) => ({
            sessionId: session.sessionId,
            isReady: Boolean(session.isReady),
            status: session.status,
            provider: 'whatsapp_web'
        }));
        const exposedWhatsapp = zapiPrimary
            ? {
                state: zapi.connected ? 'connected' : 'disconnected',
                ready: zapi.connected,
                connectEnabled: whatsappConnectEnabled,
                connectedSessions: zapi.connected ? 1 : 0,
                loggedOutSessions: 0,
                sessions: [zapiSession]
            }
            : {
                state: status,
                ready: isReady,
                connectEnabled: whatsappConnectEnabled,
                connectedSessions: connectedSessions.length,
                loggedOutSessions: loggedOutSessions.length,
                sessions: safeWebSessions
            };

        return res.json({
            status: degradedReasons.length ? 'degraded' : 'online',
            timestamp: new Date().toISOString(),
            engine: zapiPrimary ? 'Z-API' : 'Baileys',
            pid: process.pid,
            uptime_seconds: process.uptime(),
            runner: 'node src/index.js',
            degradedReasons,
            whatsapp: exposedWhatsapp,
            zapi: {
                configured: zapi.configured,
                connected: zapi.connected,
                error: zapi.error ? 'status_unavailable' : ''
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
                    sessionId: lastInbound.sessionId || '',
                    at: lastInbound.createdAt,
                    provider: lastInbound.provider || '',
                    type: lastInbound.type || ''
                } : null
            }
        });
    } catch (e) {
        return res.status(500).json({ status: 'error', message: e.message });
    }
});

export default router;
