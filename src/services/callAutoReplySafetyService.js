import crypto from 'node:crypto';
import CallAutoReplyState from '../models/CallAutoReplyState.js';
import Message from '../models/Message.js';
import {
    callAutoReplyEnabled,
    configuredCallContinuationMs,
    configuredCallReplyWindowMs,
    decideCallAutoReplyAction,
    normalizeCallReplyPhoneKey,
    zapiCallNotification
} from './callAutoReplyPolicy.js';

export {
    callAutoReplyEnabled,
    decideCallAutoReplyAction,
    normalizeCallReplyPhoneKey,
    zapiCallNotification
} from './callAutoReplyPolicy.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const dateValue = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
};

const providerCallKey = ({ provider = '', callId = '', phoneKey = '' } = {}) => {
    const stableCallId = String(callId || '').trim();
    if (!stableCallId) return `${String(provider || 'unknown').toLowerCase()}:${phoneKey}:missing-id`;
    return `${String(provider || 'unknown').toLowerCase()}:${stableCallId}`;
};

export const reserveCallAutoReply = async ({
    phone = '',
    provider = '',
    callId = '',
    now = new Date(),
    env = process.env
} = {}) => {
    const phoneKey = normalizeCallReplyPhoneKey(phone);
    if (!phoneKey) return { acquired: false, action: 'none', reason: 'missing_phone' };
    const at = dateValue(now) || new Date();
    const callKey = providerCallKey({ provider, callId, phoneKey });
    const lockOwner = crypto.randomUUID();
    const lockUntil = new Date(at.getTime() + 60_000);

    await CallAutoReplyState.updateOne(
        { phoneKey },
        { $setOnInsert: { phoneKey, handledCalls: [] } },
        { upsert: true }
    ).catch((error) => {
        if (error?.code !== 11000) throw error;
    });
    const locked = await CallAutoReplyState.findOneAndUpdate(
        {
            phoneKey,
            $or: [
                { lockUntil: { $exists: false } },
                { lockUntil: null },
                { lockUntil: { $lte: at } }
            ]
        },
        { $set: { lockOwner, lockUntil } },
        { new: true }
    ).lean();
    if (!locked) return { acquired: false, action: 'none', reason: 'contact_call_reply_busy', phoneKey, callKey };

    const decision = decideCallAutoReplyAction(locked, {
        callKey,
        now: at,
        windowMs: configuredCallReplyWindowMs(env),
        continuationMs: configuredCallContinuationMs(env)
    });
    const handledCalls = [
        ...(decision.resetWindow ? [] : (locked.handledCalls || [])),
        { key: callKey, at }
    ].slice(-40);
    const set = {
        handledCalls,
        lastCallAt: at,
        lastProvider: String(provider || ''),
        lastProviderCallId: String(callId || ''),
        ...(decision.resetWindow ? {
            windowStartedAt: at,
            audioAttemptedAt: null,
            audioSentAt: null,
            textAttemptedAt: null,
            textSentAt: null
        } : {}),
        ...(decision.action === 'audio' ? { audioAttemptedAt: at } : {}),
        ...(decision.action === 'text' ? { textAttemptedAt: at } : {})
    };
    await CallAutoReplyState.updateOne({ phoneKey, lockOwner }, { $set: set });
    return { acquired: true, ...decision, phoneKey, callKey, lockOwner, at };
};

export const finalizeCallAutoReply = async (reservation = {}, {
    sent = false,
    providerMessageId = '',
    error = ''
} = {}) => {
    if (!reservation.phoneKey || !reservation.lockOwner) return;
    const finishedAt = new Date();
    const sentField = reservation.action === 'audio'
        ? 'audioSentAt'
        : reservation.action === 'text'
            ? 'textSentAt'
            : '';
    await CallAutoReplyState.updateOne(
        { phoneKey: reservation.phoneKey, lockOwner: reservation.lockOwner },
        {
            $set: {
                ...(sent && sentField ? { [sentField]: finishedAt } : {}),
                lastResult: {
                    action: reservation.action || 'none',
                    sent: Boolean(sent),
                    providerMessageId: String(providerMessageId || ''),
                    error: String(error || '').slice(0, 180),
                    at: finishedAt
                },
                lockOwner: '',
                lockUntil: null
            }
        }
    );
};

export const recordCallAutoReplyMessage = async ({
    phone = '',
    chatId = '',
    sessionId = '',
    provider = '',
    providerCallId = '',
    providerMessageId = '',
    action = '',
    body = '',
    type = 'chat',
    mediaUrl = ''
} = {}) => {
    const phoneDigits = digitsOnly(phone);
    const stable = `${provider}:${providerCallId}:${action}:${normalizeCallReplyPhoneKey(phone)}`;
    const id = `call_auto_${crypto.createHash('sha256').update(stable).digest('hex').slice(0, 32)}`;
    await Message.updateOne(
        { _id: id },
        {
            $setOnInsert: {
                _id: id,
                chatId: chatId || `${phoneDigits}@c.us`,
                peerPhone: phoneDigits,
                from: 'bot',
                to: chatId || `${phoneDigits}@c.us`,
                body,
                type,
                hasMedia: Boolean(mediaUrl),
                mediaUrl,
                sessionId,
                ownerPhoneDigits: digitsOnly(sessionId),
                isFromMe: true,
                isBot: true,
                timestamp: Math.floor(Date.now() / 1000),
                provider,
                providerMessageId: String(providerMessageId || ''),
                providerPayload: {
                    source: 'call_auto_reply_safety',
                    providerCallId: String(providerCallId || ''),
                    action
                }
            }
        },
        { upsert: true }
    );
};
