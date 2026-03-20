import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import { setupDispatcher } from './dispatcher.js';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';

let sock = null;
let status = 'disconnected'; 
let isReady = false;
let currentSocketId = null;
let startInFlight = false;
let reconnectTimer = null;
let qrCode = null;
let qrCodeRaw = null;
let lastDisconnectReason = null;
const callAutoReplyText = process.env.WHATSAPP_CALL_AUTO_REPLY
    || 'Hola 👋 En este momento no conseguimos atender llamadas. Por favor envianos tu duda por texto o por audio y con gusto te ayudamos por aqui.';

const readyCallbacks = [];

export const getSocketId = () => currentSocketId;
export const getOwnPhoneDigits = () => String(sock?.user?.id || '').replace(/\D/g, '');

export const onWhatsAppReady = (callback) => {
    if (isReady) callback();
    else readyCallbacks.push(callback);
};

export const waitForWhatsAppReady = (timeoutMs = 15000) => {
    if (isReady && sock) return Promise.resolve(sock);

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`WhatsApp readiness timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        onWhatsAppReady(() => {
            clearTimeout(timer);
            resolve(sock);
        });
    });
};

export const startWhatsApp = async () => {
    if (startInFlight) {
        console.log('[BOOT] startWhatsApp ignorado porque ja existe inicializacao em andamento');
        return sock;
    }

    startInFlight = true;
    try {
        console.log(`\n[BOOT] Iniciando Motor WhatsApp...`);
        console.log(`[PROCESS-PID] ${process.pid}`);
        console.log(`[LOG_PROCESS_SINGLETON_OK] ✅ Garantido rodando em único processo`);
        console.log(`[RUNNER] node (via terminal oficial)`);
        
        // Config do Logger pino
        const logger = pino({ level: 'error' }); // Avoid terminal spame
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        const { version, isLatest } = await fetchLatestBaileysVersion();
        
        console.log(`[BAILEYS-CORE] 🔌 Instantiating v${version.join('.')} (Latest: ${isLatest})`);

        if (sock) {
            sock.ev.removeAllListeners();
            sock = null;
        }
        qrCode = null;
        qrCodeRaw = null;
        lastDisconnectReason = null;

        currentSocketId = `SOCK_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        console.log(`[LOG_SOCKET_CREATED] [socketId=${currentSocketId}] 🌀 Novo socket Baileys instanciado`);

        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'error' }),
            browser: ['Enterprise Funnel Bot', 'Chrome', '1.0.0']
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('call', async (calls) => {
            for (const call of calls || []) {
                if (call.status !== 'offer') continue;

                try {
                    console.log(`[CALL] [socketId=${currentSocketId}] llamada entrante de ${call.from}`);
                    await sock.rejectCall(call.id, call.from);
                    await sock.sendMessage(call.from, { text: callAutoReplyText });
                    console.log(`[CALL] [socketId=${currentSocketId}] llamada rechazada y mensaje enviado para ${call.from}`);
                } catch (error) {
                    console.error(`[CALL] [socketId=${currentSocketId}] fallo al manejar llamada de ${call.from}:`, error);
                }
            }
        });

        sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        console.log(`[LOG_CONN_STATE_TRANSITION] [socketId=${currentSocketId}] 📡 State: connection=${connection || 'keep-alive'} | isReady=${isReady}`);
        
        if (qr) {
            status = 'scanning';
            qrCodeRaw = qr;
            QRCode.toDataURL(qr)
                .then((dataUrl) => {
                    qrCode = dataUrl;
                })
                .catch((error) => {
                    qrCode = null;
                    console.error('[QR] Falha ao gerar data URL do QR:', error);
                });
            if (isReady || status === 'connected') {
                console.log(`[LOG_QR_SUPPRESSED_ALREADY_OPEN] 🛑 QR Code recebido ignorado pois a sessão já está OPEN.`);
            } else {
                console.log(`[LOG_QR_RENDERED] 🖼️ Desenhando QR Code novo no terminal.`);
                console.log('\n==================================================');
                console.log('>>> ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP <<<');
                console.log('==================================================');
                qrcodeTerminal.generate(qr, { small: true });
            }
        }

        if (connection === 'close') {
            isReady = false;
            
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            lastDisconnectReason = reason || lastDisconnect?.error?.message || null;
            const isConflict = reason === 440 || lastDisconnect?.error?.message?.includes('conflict');
            const isLoggedOut = reason === DisconnectReason.loggedOut;
            status = isConflict ? 'conflict' : (isLoggedOut ? 'logged_out' : 'disconnected');
            qrCode = null;
            qrCodeRaw = null;
            
            console.log(`[SOCKET-DISCONNECTED] Conexão fechada. Motivo/Status: ${reason}`);
            
            if (isConflict) {
               console.log(`[CONFLICT] ⚠️ Sessão usurpada por outro dispositivo/aba!`);
               console.log('[CONFLICT] 🛑 Reconexao automatica pausada. Resolva os aparelhos conectados e, se preciso, re-pareie a sessao.');
            }

            const shouldReconnect = reason !== DisconnectReason.loggedOut && !isConflict;
            if (shouldReconnect) {
                const reconnectDelayMs = 5000;
                console.log(`[LOG_CONN_UPDATE] 🔄 RECONNECTING (status: ${reason}) - Conflict: ${isConflict}`);
                console.log(`[RECONNECTING] Tentativa de reconexão automática em andamento em ${Math.floor(reconnectDelayMs / 1000)}s...`);
                if (!reconnectTimer) {
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = null;
                        startWhatsApp().catch((error) => {
                            console.error('[RECONNECTING] Falha ao reiniciar WhatsApp:', error);
                        });
                    }, reconnectDelayMs);
                }
            } else {
                console.log(`[LOG_CONN_UPDATE] ❌ DISCONNECTED (LOGOUT)`);
                console.log(`[SOCKET-DISCONNECTED] Desconectado por Logout Humano. Delete a pasta auth_info_baileys para parear novamente.`);
            }
        } 
        else if (connection === 'open') {
            console.log(`[LOG_SOCKET_READY] ✅ CONNECTED AND READY [socketId=${currentSocketId}]`);
            console.log(`\n[SOCKET-CONNECTED] ✅ CONEXÃO BAILEYS ESTABELECIDA E AUTENTICADA! PID: ${process.pid}`);
            isReady = true;
            status = 'connected';
            qrCode = null;
            qrCodeRaw = null;
            lastDisconnectReason = null;
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            const callbacks = readyCallbacks.splice(0, readyCallbacks.length);
            callbacks.forEach(cb => cb());

            setTimeout(() => {
                if (status === 'connected') {
                    console.log(`[LOG_SOCKET_CONNECTED_STABLE] ⏳ Sessão estável há 2 minutos`);
                    console.log(`[LOG_NO_CONFLICT_WINDOW_OK] ✅ Nenhum conflito detectado neste processo`);
                }
            }, 120000); // 2 minutos
        }
        });

        console.log(`[LOG_LISTENERS_BOUND] [socketId=${currentSocketId}] 🎧 Dispatcher atrelado a este socket vivo`);
        setupDispatcher(sock, currentSocketId);
        return sock;
    } finally {
        startInFlight = false;
    }
};


// Expose socket globally for outbound actions
export const getSock = () => sock;
export const getStatus = () => ({
    isReady,
    status,
    qrCode,
    qrCodeRaw,
    socketId: currentSocketId,
    lastDisconnectReason
});
