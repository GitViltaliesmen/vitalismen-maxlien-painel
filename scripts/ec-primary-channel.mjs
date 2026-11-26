import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Message from '../src/models/Message.js';
import { EC_PRIMARY_CHANNEL_ID, EC_PRIMARY_QA_PHONE,
    ecChannelBindingFile, readEcChannelBinding, validateEcChannelBinding } from '../src/whatsapp/ecPrimaryChannelBinding.js';

const digits = (value) => String(value || '').replace(/\D/g, '');
const command = process.argv[2];
const options = Object.fromEntries(process.argv.slice(3).map((arg) => {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!match) throw new Error('ec_channel_argument_invalid');
    return [match[1], match[2]];
}));
const file = ecChannelBindingFile();

const liveSession = async () => {
    const response = await fetch('http://127.0.0.1:3001/api/whatsapp/status', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('ec_channel_live_status_unavailable');
    const payload = await response.json();
    if (payload.transportMode !== 'baileys_text') throw new Error('ec_channel_transport_mismatch');
    const session = payload.sessions?.find((item) => item.sessionId === payload.defaultSessionId);
    if (!session?.isReady || session.status !== 'connected' || !digits(session.ownPhoneDigits)) {
        throw new Error('ec_channel_live_session_unverified');
    }
    return { sessionId: session.sessionId, ownerPhoneDigits: digits(session.ownPhoneDigits) };
};

const writeBinding = (value, { expectMissing = false, expectedBinding = null } = {}) => {
    validateEcChannelBinding(value);
    const directory = path.dirname(file);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') fs.chmodSync(directory, 0o700);
    const lock = `${file}.lock`;
    const lockFd = fs.openSync(lock, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    try {
        const current = readEcChannelBinding();
        if (expectMissing ? current !== null : !current
            || JSON.stringify(current) !== JSON.stringify(expectedBinding)) {
            throw new Error('ec_channel_generation_changed');
        }
        fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
        if (process.platform !== 'win32') fs.chmodSync(temp, 0o600);
        fs.renameSync(temp, file);
    } finally {
        if (fs.existsSync(temp)) fs.unlinkSync(temp);
        fs.closeSync(lockFd);
        fs.unlinkSync(lock);
    }
};

const qaProof = async (binding) => {
    dotenv.config({ path: process.env.EC_CHANNEL_DOTENV_FILE || path.resolve('.env') });
    if (!process.env.MONGODB_URI) throw new Error('ec_channel_mongodb_unconfigured');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    try {
        const messages = await Message.find({
            sessionId: binding.legacySessionId,
            ownerPhoneDigits: binding.pending.ownerPhoneDigits,
            createdAt: { $gte: new Date(binding.pending.stagedAt) },
            $or: [
                { peerPhone: EC_PRIMARY_QA_PHONE },
                { chatId: { $regex: `${EC_PRIMARY_QA_PHONE}(?:@|$)` } }
            ]
        }).select('isFromMe provider providerMessageId deliveryStatus createdAt').lean();
        const inbound = messages.find((item) => item.isFromMe === false && item.provider === 'baileys');
        const outbound = messages.find((item) => item.isFromMe === true
            && item.provider === 'baileys' && item.providerMessageId
            && !['failed', 'pending', 'unknown'].includes(item.deliveryStatus));
        if (!inbound || !outbound) throw new Error('ec_channel_qa_proof_missing');
        return { inboundId: inbound._id, outboundId: outbound.providerMessageId };
    } finally {
        await mongoose.disconnect();
    }
};

if (process.platform !== 'win32' && process.getuid?.() !== 0) {
    throw new Error('ec_channel_root_required');
}
if (!['show', 'init', 'stage', 'activate', 'abort'].includes(command)) {
    throw new Error('use: ec-primary-channel.mjs show|init|stage|activate|abort');
}

if (command === 'show') {
    const binding = readEcChannelBinding();
    console.log(JSON.stringify(binding && { channelId: binding.channelId,
        legacySessionId: binding.legacySessionId, generation: binding.generation,
        activeOwnerPhoneDigits: binding.active.ownerPhoneDigits,
        pendingOwnerPhoneDigits: binding.pending?.ownerPhoneDigits || null,
        historyCount: binding.history.length }));
} else if (command === 'init') {
    if (fs.existsSync(file)) throw new Error('ec_channel_already_initialized');
    const live = await liveSession();
    if (digits(options['expected-phone']) !== live.ownerPhoneDigits) throw new Error('ec_channel_phone_confirmation_mismatch');
    writeBinding({ version: 1, channelId: EC_PRIMARY_CHANNEL_ID,
        legacySessionId: live.sessionId, generation: 1,
        active: { ownerPhoneDigits: live.ownerPhoneDigits, approvedAt: new Date().toISOString() },
        pending: null, history: [] }, { expectMissing: true });
    console.log('EC_CHANNEL_INIT=OK');
} else {
    const binding = readEcChannelBinding();
    if (!binding || Number(options['expected-generation']) !== binding.generation) {
        throw new Error('ec_channel_generation_mismatch');
    }
    if (command === 'stage') {
        if (binding.pending) throw new Error('ec_channel_stage_already_pending');
        const live = await liveSession();
        if (live.sessionId !== binding.legacySessionId
            || live.ownerPhoneDigits === binding.active.ownerPhoneDigits
            || live.ownerPhoneDigits !== digits(options['expected-phone'])) {
            throw new Error('ec_channel_candidate_mismatch');
        }
        writeBinding({ ...binding, pending: { ownerPhoneDigits: live.ownerPhoneDigits,
            stagedAt: new Date().toISOString() } }, { expectedBinding: binding });
        console.log('EC_CHANNEL_STAGE=OK_QA_ONLY');
    } else if (command === 'abort') {
        if (!binding.pending) throw new Error('ec_channel_no_pending');
        writeBinding({ ...binding, pending: null }, { expectedBinding: binding });
        console.log('EC_CHANNEL_ABORT=OK');
    } else {
        if (!binding.pending) throw new Error('ec_channel_no_pending');
        const live = await liveSession();
        if (live.sessionId !== binding.legacySessionId
            || live.ownerPhoneDigits !== binding.pending.ownerPhoneDigits
            || live.ownerPhoneDigits !== digits(options['expected-phone'])) {
            throw new Error('ec_channel_candidate_mismatch');
        }
        const proof = await qaProof(binding);
        const now = new Date().toISOString();
        writeBinding({ ...binding, generation: binding.generation + 1,
            active: { ownerPhoneDigits: live.ownerPhoneDigits, approvedAt: now },
            pending: null,
            history: [...binding.history, { ownerPhoneDigits: binding.active.ownerPhoneDigits,
                endedAt: now }]
        }, { expectedBinding: binding });
        console.log(`EC_CHANNEL_ACTIVATE=OK qa_inbound=${proof.inboundId} qa_outbound=${proof.outboundId}`);
    }
}
