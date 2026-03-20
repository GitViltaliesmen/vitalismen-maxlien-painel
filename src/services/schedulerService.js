import Order from '../models/Order.js';
import { generateWelcomeMessage } from './aiService.js';
import { generateAudio } from './audioService.js';
import { onWhatsAppReady, getStatus, startWhatsApp } from '../whatsapp/connection.js';
import { sendText } from '../whatsapp/sendText.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import path from 'path';
import fs from 'fs';
import { toWhatsAppChatId } from '../utils/phone.js';
import { processDuePendingFunnels } from './funnelService.js';

let _draftRecoveryRunning = false;
let isRunningFunnel = false;

export const startScheduler = () => {
    console.log('Starting WhatsApp Recovery Scheduler...');

    // Run every 60 seconds (User requested >= 30000ms, ideal 60000)
    setInterval(checkAbandonedDrafts, 60000);
    // Run pending funnels frequently (seconds-level)
    setInterval(checkPendingFunnels, 5 * 1000);

    // Watchdog: Restart WhatsApp ONLY if not ready and not scanning
    setInterval(() => {
        const { isReady, status } = getStatus();
        // Only restart if confirmed disconnected. If scanning (QR), do nothing. If connected but not ready, wait.
        if (!isReady && status === 'disconnected') {
            console.log('[Scheduler] WhatsApp Disconnected -> Triggering Init...');
            startWhatsApp();
        }
    }, 60000);

    // Run immediately on start
    checkAbandonedDrafts();
    checkPendingFunnels();

    // Also run immediately once WhatsApp becomes ready
    onWhatsAppReady(() => {
        setTimeout(() => checkAbandonedDrafts(), 1000);
        setTimeout(() => checkPendingFunnels(), 1200);
    });
};

const checkAbandonedDrafts = async () => {
    if (_draftRecoveryRunning) return;
    _draftRecoveryRunning = true;

    try {
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        // Find drafts that:
        // 1. Are in 'draft' status
        // 2. Were created more than 30 mins ago
        // 3. Were created less than 24 hours ago
        // 4. Have NOT been notified yet (whatsappNotified = false)
        // 5. Have a valid phone number
        const drafts = await Order.find({
            status: 'draft',
            createdAt: { $lt: thirtyMinsAgo, $gt: twentyFourHoursAgo },
            whatsappNotified: false,
            'customer.phone': { $exists: true, $ne: '' }
        });
        console.log(`Checking draft recovery... drafts=${drafts.length}`);

        for (const draft of drafts) {
            await recoverDraft(draft);
        }

    } catch (error) {
        console.error('Scheduler Error:', error);
    } finally {
        _draftRecoveryRunning = false;
    }
};

const recoverDraft = async (draft) => {
    try {
        const { phone, name } = draft.customer;
        // Basic validation
        if (!phone || phone.length < 10) return;

        // 1. Generate Text
        const textMessage = await generateWelcomeMessage({
            name: name || 'Cliente',
            country: draft.country,
            type: 'recovery'
        });

        // 2. Send Text
        const chatId = toWhatsAppChatId(phone, draft.country);
        if (!chatId) return;
        const sent = await sendText(chatId, textMessage);
        if (!sent) return;

        // 3. Generate & Send Audio
        const audioDir = path.join(process.cwd(), 'public', 'media', 'sent');
        if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

        const audioFilename = `recovery_${draft.orderId}_${Date.now()}.ogg`;
        const audioPath = path.join(audioDir, audioFilename);

        const resultPath = await generateAudio(textMessage, audioPath);

        if (resultPath) {
            // New Baileys Modular Audio Wrapper
            await sendAudio(chatId, resultPath, true);
        }

        // 4. Mark as Notified
        draft.whatsappNotified = true;
        await draft.save();

        console.log(`Recovered draft ${draft.orderId} for ${name}`);

    } catch (error) {
        console.error(`Failed to recover draft ${draft.orderId}:`, error);
    }
};

const checkPendingFunnels = async () => {
    if (isRunningFunnel) return;
    isRunningFunnel = true;
    try {
        await processDuePendingFunnels();
    } catch (error) {
        console.error('Funnel Scheduler Error:', error);
    } finally {
        isRunningFunnel = false;
    }
};
