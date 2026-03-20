import { enqueueMessage } from './queue.js';
import { routeIncomingMessage } from '../services/agentRouter.js';
import { getOwnPhoneDigits } from './connection.js';

export const setupDispatcher = (sock, currentSocketId = 'N/A') => {
    sock.ev.on('messages.upsert', async (payload) => {
        const { messages, type } = payload;
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg || !msg.message || msg.key.fromMe) return;
        const remoteJid = msg.key.remoteJid;
        const ownDigits = getOwnPhoneDigits();
        const remoteDigits = String(remoteJid || '').replace(/\D/g, '');
        if (ownDigits && remoteDigits === ownDigits) {
            console.log(`[DISPATCHER] ignorando mensagem do proprio numero -> ${remoteJid}`);
            return;
        }
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        console.log(`[DISPATCHER] [socketId=${currentSocketId}] inbound -> ${remoteJid} | text="${text.slice(0, 80)}"`);
        enqueueMessage(remoteJid, async () => {
            try {
                await routeIncomingMessage({
                    id: msg.key.id,
                    from: remoteJid,
                    body: text,
                    fullMessage: msg
                });
            } catch (err) {
                console.error('Erro no dispatcher:', err);
            }
        });
    });
};
