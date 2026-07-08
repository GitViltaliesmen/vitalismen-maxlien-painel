import fs from 'fs';
import path from 'path';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import { setupDispatcher } from './dispatcher.js';
import { resolveCountryAudio } from '../services/audioTemplateService.js';
import Message from '../models/Message.js';

const DEFAULT_SESSION_ID = process.env.WHATSAPP_DEFAULT_SESSION_ID || 'default';
const AUTH_BASE_DIR = path.join(process.cwd(), 'auth_info_baileys');
const autoRejectCalls = String(process.env.WHATSAPP_AUTO_REJECT_CALLS || '') === 'true';
const callAutoReplyAudioName = process.env.WHATSAPP_CALL_AUTO_REPLY_AUDIO || 'CLIENTES_QUE_LIGAM';
const callAutoReplyText = process.env.WHATSAPP_CALL_AUTO_REPLY
    || 'Hola, soy Valeria Zambrano del equipo de la doctora Maria Fernandes. En este momento no atendemos llamadas por aqui. Enviame tu duda por texto o audio y te ayudo por WhatsApp.';
const callSecondReplyText = process.env.WHATSAPP_CALL_SECOND_REPLY
    || 'Señor, por favor envíeme un mensaje por audio o texto.';
const autoRecoverConflict = String(process.env.WHATSAPP_AUTO_RECOVER_CONFLICT || 'true').toLowerCase() !== 'false';

const sessions = new Map();
const recentCallAutoReplies = new Map();

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const callReplyWindowMs = () => {
    const hours = Number.parseInt(String(process.env.WHATSAPP_CALL_REPLY_WINDOW_HOURS || '24'), 10);
    return Math.max(1, Number.isFinite(hours) ? hours : 24) * 60 * 60 * 1000;
};

const parsePausedSessionIds = () => String(process.env.WHATSAPP_PAUSED_SESSION_IDS || '')
    .split(',')
    .map((item) => digitsOnly(item))
    .filter(Boolean);

const isPausedSessionId = (sessionId) => {
    const id = digitsOnly(sessionId);
    if (!id) return false;
    return parsePausedSessionIds().some((paused) => paused === id || paused.endsWith(id) || id.endsWith(paused));
};

const parseConfiguredSessionIds = () => {
    const raw = String(process.env.WHATSAPP_SESSION_IDS || '').trim();
    const ids = raw
        ? raw.split(',').map((item) => item.trim()).filter(Boolean)
        : [];

    if (!ids.includes(DEFAULT_SESSION_ID)) {
        ids.unshift(DEFAULT_SESSION_ID);
    }

    return [...new Set(ids)].filter((sessionId) => !isPausedSessionId(sessionId));
};

const sanitizeSessionId = (sessionId) => String(sessionId || DEFAULT_SESSION_ID)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    || DEFAULT_SESSION_ID;

const jidUserDigits = (jid = '') => String(jid || '')
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '');

const callReplyKey = ({ jid = '', sessionId = '' } = {}) => `${digitsOnly(sessionId) || sessionId}:${digitsOnly(jid) || String(jid || '').trim()}`;

const rememberCallAutoReply = ({ jid = '', sessionId = '', count = 1 } = {}) => {
    const key = callReplyKey({ jid, sessionId });
    if (!key) return;
    recentCallAutoReplies.set(key, { count, at: Date.now() });
};

const recentCallReplyCount = async ({ jid = '', sessionId = '' } = {}) => {
    const key = callReplyKey({ jid, sessionId });
    const now = Date.now();
    const windowMs = callReplyWindowMs();
    const memory = recentCallAutoReplies.get(key);
    if (memory && now - memory.at <= windowMs) return memory.count;
    if (memory) recentCallAutoReplies.delete(key);

    const digits = digitsOnly(jid);
    if (!digits || Message?.db?.readyState !== 1) return 0;
    const tail = digits.length > 10 ? digits.slice(-10) : digits;
    const since = new Date(now - windowMs);
    const count = await Message.countDocuments({
        isFromMe: true,
        body: { $regex: '^\\[CALL_AUTO_REPLY' },
        createdAt: { $gte: since },
        $or: [
            { chatId: jid },
            { to: jid },
            { peerPhone: { $regex: `${tail}$` } }
        ]
    }).catch(() => 0);
    if (count > 0) rememberCallAutoReply({ jid, sessionId, count });
    return count;
};

const recordCallAutoReply = async ({ jid = '', sessionId = '', body = '', type = 'chat', mediaUrl = '' } = {}) => {
    try {
        await Message.create({
            _id: `call_auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            chatId: jid,
            peerPhone: digitsOnly(jid),
            from: 'bot',
            to: jid,
            body,
            type,
            mediaUrl,
            sessionId,
            ownerPhoneDigits: digitsOnly(sessionId),
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (error) {
        if (error?.code !== 11000) console.warn(`[CALL] falha ao registrar auto-resposta de chamada -> ${jid}: ${error.message}`);
    }
};

const migrateLegacyAuthStorage = () => {
    if (!fs.existsSync(AUTH_BASE_DIR)) return;

    const entries = fs.readdirSync(AUTH_BASE_DIR, { withFileTypes: true });
    const legacyFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
    if (legacyFiles.length === 0) return;

    const defaultDir = path.join(AUTH_BASE_DIR, sanitizeSessionId(DEFAULT_SESSION_ID));
    fs.mkdirSync(defaultDir, { recursive: true });

    for (const file of legacyFiles) {
        const fromPath = path.join(AUTH_BASE_DIR, file.name);
        const toPath = path.join(defaultDir, file.name);
        if (fs.existsSync(toPath)) continue;
        fs.renameSync(fromPath, toPath);
    }
};

const discoverSessionIdsFromAuthDir = () => {
    migrateLegacyAuthStorage();
    if (!fs.existsSync(AUTH_BASE_DIR)) return [];
    return fs.readdirSync(AUTH_BASE_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => sanitizeSessionId(entry.name))
        .filter(Boolean);
};

const ensureAuthDir = (sessionId) => {
    migrateLegacyAuthStorage();
    const dir = path.join(AUTH_BASE_DIR, sanitizeSessionId(sessionId));
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

const createSessionState = (sessionId) => ({
    sessionId,
    sock: null,
    status: 'disconnected',
    isReady: false,
    currentSocketId: null,
    startInFlight: false,
    reconnectTimer: null,
    qrCode: null,
    qrCodeRaw: null,
    lastDisconnectReason: null,
    ownPhoneDigits: '',
    readyCallbacks: []
});

const getOrCreateSession = (sessionId = DEFAULT_SESSION_ID) => {
    const normalizedId = sanitizeSessionId(sessionId);
    if (!sessions.has(normalizedId)) {
        sessions.set(normalizedId, createSessionState(normalizedId));
    }
    return sessions.get(normalizedId);
};

const getConfiguredOrKnownSessionIds = () => {
    const known = Array.from(sessions.keys());
    return [...new Set([...parseConfiguredSessionIds(), ...discoverSessionIdsFromAuthDir(), ...known])]
        .filter((sessionId) => !isPausedSessionId(sessionId));
};

const resolveSessionForOutbound = (sessionId = null) => {
    if (sessionId) {
        return getOrCreateSession(sessionId);
    }

    const preferred = getOrCreateSession(DEFAULT_SESSION_ID);
    if (preferred.isReady && preferred.sock) return preferred;

    const firstReady = Array.from(sessions.values()).find((item) => item.isReady && item.sock);
    return firstReady || preferred;
};

const flushReadyCallbacks = (session) => {
    const callbacks = session.readyCallbacks.splice(0, session.readyCallbacks.length);
    callbacks.forEach((callback) => callback(session.sock));
};

export const getSocketId = (sessionId = null) => resolveSessionForOutbound(sessionId).currentSocketId;
export const getOwnPhoneDigits = (sessionId = null) => resolveSessionForOutbound(sessionId).ownPhoneDigits || '';
export const getSock = (sessionId = null) => resolveSessionForOutbound(sessionId).sock;

export const getStatus = (sessionId = DEFAULT_SESSION_ID) => {
    const session = getOrCreateSession(sessionId);
    return {
        sessionId: session.sessionId,
        isReady: session.isReady,
        status: session.status,
        qrCode: session.qrCode,
        qrCodeRaw: session.qrCodeRaw,
        socketId: session.currentSocketId,
        lastDisconnectReason: session.lastDisconnectReason,
        ownPhoneDigits: session.ownPhoneDigits
    };
};

export const getAllStatuses = () => getConfiguredOrKnownSessionIds().map((sessionId) => getStatus(sessionId));

export const onWhatsAppReady = (callback, sessionId = DEFAULT_SESSION_ID) => {
    const session = getOrCreateSession(sessionId);
    if (session.isReady) callback(session.sock);
    else session.readyCallbacks.push(callback);
};

export const waitForWhatsAppReady = (timeoutMs = 15000, sessionId = null) => {
    const session = resolveSessionForOutbound(sessionId);
    if (session.isReady && session.sock) return Promise.resolve(session.sock);

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`WhatsApp readiness timeout after ${timeoutMs}ms for session ${session.sessionId}`));
        }, timeoutMs);

        onWhatsAppReady((sock) => {
            clearTimeout(timer);
            resolve(sock);
        }, session.sessionId);
    });
};

export const startWhatsApp = async (sessionId = DEFAULT_SESSION_ID) => {
    const session = getOrCreateSession(sessionId);
    if (isPausedSessionId(session.sessionId)) {
        session.status = 'paused';
        session.isReady = false;
        session.qrCode = null;
        session.qrCodeRaw = null;
        console.log(`[BOOT] startWhatsApp pausado por WHATSAPP_PAUSED_SESSION_IDS | session=${session.sessionId}`);
        return null;
    }

    if (session.startInFlight) {
        console.log(`[BOOT] startWhatsApp ignorado porque ja existe inicializacao em andamento | session=${session.sessionId}`);
        return session.sock;
    }

    session.startInFlight = true;
    try {
        console.log(`\n[BOOT] Iniciando Motor WhatsApp... session=${session.sessionId}`);
        console.log(`[PROCESS-PID] ${process.pid}`);
        console.log(`[LOG_PROCESS_SINGLETON_OK] ✅ Garantido rodando em único processo`);
        console.log(`[RUNNER] node (via terminal oficial)`);

        const authDir = ensureAuthDir(session.sessionId);
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const { version, isLatest } = await fetchLatestBaileysVersion();

        console.log(`[BAILEYS-CORE] 🔌 Instantiating v${version.join('.')} (Latest: ${isLatest}) | session=${session.sessionId}`);

        if (session.sock) {
            session.sock.ev.removeAllListeners();
            session.sock = null;
        }

        session.qrCode = null;
        session.qrCodeRaw = null;
        session.lastDisconnectReason = null;
        session.currentSocketId = `SOCK_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        console.log(`[LOG_SOCKET_CREATED] [socketId=${session.currentSocketId}] 🌀 Novo socket Baileys instanciado | session=${session.sessionId}`);

        session.sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'error' }),
            browser: ['Enterprise Funnel Bot', `Session ${session.sessionId}`, '1.0.0']
        });

        session.sock.ev.on('creds.update', saveCreds);

        session.sock.ev.on('call', async (calls) => {
            for (const call of calls || []) {
                if (call.status !== 'offer') continue;

                try {
                    console.log(`[CALL] [socketId=${session.currentSocketId}] llamada entrante de ${call.from} | session=${session.sessionId}`);
                    if (!autoRejectCalls) {
                        console.log(`[CALL] [socketId=${session.currentSocketId}] auto-rechazo desativado por WHATSAPP_AUTO_REJECT_CALLS | session=${session.sessionId}`);
                        continue;
                    }
                    await session.sock.rejectCall(call.id, call.from);
                    const previousReplies = await recentCallReplyCount({ jid: call.from, sessionId: session.sessionId });
                    const nextReplyNumber = previousReplies + 1;

                    if (nextReplyNumber === 1) {
                        const audioPath = await resolveCountryAudio({ country: 'EC', baseName: callAutoReplyAudioName });
                        if (audioPath) {
                            await session.sock.sendMessage(call.from, {
                                audio: { url: audioPath },
                                mimetype: 'audio/ogg; codecs=opus',
                                ptt: true
                            });
                            await recordCallAutoReply({
                                jid: call.from,
                                sessionId: session.sessionId,
                                body: `[CALL_AUTO_REPLY_AUDIO] ${callAutoReplyAudioName}`,
                                type: 'audio',
                                mediaUrl: audioPath
                            });
                            rememberCallAutoReply({ jid: call.from, sessionId: session.sessionId, count: nextReplyNumber });
                            console.log(`[CALL] [socketId=${session.currentSocketId}] llamada rechazada e primeiro audio enviado para ${call.from} | audio=${callAutoReplyAudioName} | session=${session.sessionId}`);
                        } else {
                            await session.sock.sendMessage(call.from, { text: callAutoReplyText });
                            await recordCallAutoReply({
                                jid: call.from,
                                sessionId: session.sessionId,
                                body: `[CALL_AUTO_REPLY_FALLBACK_TEXT] ${callAutoReplyText}`,
                                type: 'chat'
                            });
                            rememberCallAutoReply({ jid: call.from, sessionId: session.sessionId, count: nextReplyNumber });
                            console.log(`[CALL] [socketId=${session.currentSocketId}] llamada rechazada e texto fallback enviado para ${call.from} | audio_no_encontrado=${callAutoReplyAudioName} | session=${session.sessionId}`);
                        }
                    } else if (nextReplyNumber === 2) {
                        await session.sock.sendMessage(call.from, { text: callSecondReplyText });
                        await recordCallAutoReply({
                            jid: call.from,
                            sessionId: session.sessionId,
                            body: `[CALL_AUTO_REPLY_SECOND_TEXT] ${callSecondReplyText}`,
                            type: 'chat'
                        });
                        rememberCallAutoReply({ jid: call.from, sessionId: session.sessionId, count: nextReplyNumber });
                        console.log(`[CALL] [socketId=${session.currentSocketId}] llamada rechazada e texto curto enviado para ${call.from} | tentativa=${nextReplyNumber} | session=${session.sessionId}`);
                    } else {
                        rememberCallAutoReply({ jid: call.from, sessionId: session.sessionId, count: nextReplyNumber });
                        console.log(`[CALL] [socketId=${session.currentSocketId}] llamada repetida ignorada sem nova mensagem para ${call.from} | tentativa=${nextReplyNumber} | session=${session.sessionId}`);
                    }
                } catch (error) {
                    console.error(`[CALL] [socketId=${session.currentSocketId}] fallo al manejar llamada de ${call.from} | session=${session.sessionId}:`, error);
                }
            }
        });

        session.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            console.log(`[LOG_CONN_STATE_TRANSITION] [socketId=${session.currentSocketId}] 📡 State: connection=${connection || 'keep-alive'} | isReady=${session.isReady} | session=${session.sessionId}`);

            if (qr) {
                session.status = 'scanning';
                session.qrCodeRaw = qr;
                QRCode.toDataURL(qr)
                    .then((dataUrl) => {
                        session.qrCode = dataUrl;
                    })
                    .catch((error) => {
                        session.qrCode = null;
                        console.error(`[QR] Falha ao gerar data URL do QR | session=${session.sessionId}:`, error);
                    });

                console.log(`[LOG_QR_RENDERED] 🖼️ Desenhando QR Code novo no terminal | session=${session.sessionId}`);
                console.log('\n==================================================');
                console.log(`>>> ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP [${session.sessionId}] <<<`);
                console.log('==================================================');
                qrcodeTerminal.generate(qr, { small: true });
            }

            if (connection === 'close') {
                session.isReady = false;
                session.ownPhoneDigits = '';

                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                session.lastDisconnectReason = reason || lastDisconnect?.error?.message || null;
                const isConflict = reason === 440 || lastDisconnect?.error?.message?.includes('conflict');
                const isLoggedOut = reason === DisconnectReason.loggedOut;
                session.status = isConflict ? 'conflict' : (isLoggedOut ? 'logged_out' : 'disconnected');
                session.qrCode = null;
                session.qrCodeRaw = null;

                console.log(`[SOCKET-DISCONNECTED] Conexão fechada. Motivo/Status: ${reason} | session=${session.sessionId}`);

                if (isConflict) {
                    console.log(`[CONFLICT] ⚠️ Sessão usurpada por outro dispositivo/aba! | session=${session.sessionId}`);
                    if (autoRecoverConflict) {
                        const reconnectDelayMs = 8000;
                        console.log(`[CONFLICT] 🔄 Recuperacao automatica em ${Math.floor(reconnectDelayMs / 1000)}s | session=${session.sessionId}`);
                        if (!session.reconnectTimer) {
                            session.reconnectTimer = setTimeout(() => {
                                session.reconnectTimer = null;
                                if (session.isReady && session.status === 'connected' && session.sock) {
                                    console.log(`[CONFLICT] Recuperacao ignorada: sessao ja conectada | session=${session.sessionId}`);
                                    return;
                                }
                                startWhatsApp(session.sessionId).catch((error) => {
                                    console.error(`[CONFLICT] Falha ao recuperar sessao | session=${session.sessionId}:`, error);
                                });
                            }, reconnectDelayMs);
                        }
                    } else {
                        console.log('[CONFLICT] 🛑 Reconexao automatica pausada. Resolva os aparelhos conectados e, se preciso, re-pareie a sessao.');
                    }
                }

                const shouldReconnect = reason !== DisconnectReason.loggedOut && !isConflict;
                if (shouldReconnect) {
                    const reconnectDelayMs = 5000;
                    console.log(`[LOG_CONN_UPDATE] 🔄 RECONNECTING (status: ${reason}) - Conflict: ${isConflict} | session=${session.sessionId}`);
                    console.log(`[RECONNECTING] Tentativa de reconexão automática em andamento em ${Math.floor(reconnectDelayMs / 1000)}s...`);
                    if (!session.reconnectTimer) {
                        session.reconnectTimer = setTimeout(() => {
                            session.reconnectTimer = null;
                            startWhatsApp(session.sessionId).catch((error) => {
                                console.error(`[RECONNECTING] Falha ao reiniciar WhatsApp | session=${session.sessionId}:`, error);
                            });
                        }, reconnectDelayMs);
                    }
                } else {
                    console.log(`[LOG_CONN_UPDATE] ❌ DISCONNECTED (LOGOUT) | session=${session.sessionId}`);
                    console.log(`[SOCKET-DISCONNECTED] Desconectado por Logout Humano. Delete a pasta auth_info_baileys/${session.sessionId} para parear novamente.`);
                }
            } else if (connection === 'open') {
                session.isReady = true;
                session.status = 'connected';
                session.qrCode = null;
                session.qrCodeRaw = null;
                session.lastDisconnectReason = null;
                session.ownPhoneDigits = jidUserDigits(session.sock?.user?.id || '');
                if (session.reconnectTimer) {
                    clearTimeout(session.reconnectTimer);
                    session.reconnectTimer = null;
                }

                console.log(`[LOG_SOCKET_READY] ✅ CONNECTED AND READY [socketId=${session.currentSocketId}] | session=${session.sessionId}`);
                console.log(`\n[SOCKET-CONNECTED] ✅ CONEXÃO BAILEYS ESTABELECIDA E AUTENTICADA! PID: ${process.pid} | session=${session.sessionId}`);

                flushReadyCallbacks(session);

                setTimeout(() => {
                    if (session.status === 'connected') {
                        console.log(`[LOG_SOCKET_CONNECTED_STABLE] ⏳ Sessão estável há 2 minutos | session=${session.sessionId}`);
                        console.log(`[LOG_NO_CONFLICT_WINDOW_OK] ✅ Nenhum conflito detectado neste processo | session=${session.sessionId}`);
                    }
                }, 120000);
            }
        });

        console.log(`[LOG_LISTENERS_BOUND] [socketId=${session.currentSocketId}] 🎧 Dispatcher atrelado a este socket vivo | session=${session.sessionId}`);
        setupDispatcher(session.sock, session.currentSocketId, session.sessionId);
        return session.sock;
    } finally {
        session.startInFlight = false;
    }
};

export const startConfiguredWhatsAppSessions = async () => {
    const sessionIds = parseConfiguredSessionIds();
    await Promise.all(sessionIds.map((sessionId) => startWhatsApp(sessionId).catch((error) => {
        console.error(`❌ Catastrophic failure booting WhatsApp Engine | session=${sessionId}:`, error);
        return null;
    })));
};

export const registerWhatsAppSession = (sessionId) => {
    const session = getOrCreateSession(sessionId);
    return session.sessionId;
};

export const disconnectWhatsApp = async (sessionId = DEFAULT_SESSION_ID, { logout = true } = {}) => {
    const session = getOrCreateSession(sessionId);
    if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
        session.reconnectTimer = null;
    }

    const sock = session.sock;
    session.startInFlight = false;
    session.isReady = false;
    session.qrCode = null;
    session.qrCodeRaw = null;
    session.ownPhoneDigits = '';

    if (sock) {
        try {
            if (logout && typeof sock.logout === 'function') {
                await sock.logout();
            } else if (typeof sock.end === 'function') {
                sock.end(undefined);
            }
        } catch (error) {
            console.warn(`[DISCONNECT] Falha ao encerrar WhatsApp | session=${session.sessionId}: ${error.message}`);
        }
        try {
            sock.ev?.removeAllListeners?.();
        } catch {
            // ignore listener cleanup failure
        }
    }

    session.sock = null;
    session.currentSocketId = null;
    session.status = logout ? 'logged_out' : 'disconnected';
    session.lastDisconnectReason = logout ? 'manual_logout' : 'manual_disconnect';
    console.log(`[DISCONNECT] Sessao WhatsApp desconectada manualmente | session=${session.sessionId} | logout=${logout}`);
    return getStatus(session.sessionId);
};
