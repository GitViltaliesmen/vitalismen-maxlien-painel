import fs from 'node:fs';
import path from 'node:path';

export const EC_PRIMARY_CHANNEL_ID = 'EC_PRIMARY';
export const EC_PRIMARY_QA_PHONE = '5515998038637';
export const DEFAULT_EC_CHANNEL_BINDING_FILE = '/opt/vitalismen-automacao/shared/runtime/whatsapp-channel/ec-primary.json';

const digits = (value) => String(value || '').replace(/\D/g, '');
const validPhone = (value) => /^\d{10,15}$/.test(value);
const validTime = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));

export const ecChannelBindingFile = (env = process.env) =>
    path.resolve(env.EC_WHATSAPP_CHANNEL_BINDING_FILE || DEFAULT_EC_CHANNEL_BINDING_FILE);

export const validateEcChannelBinding = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || value.version !== 1 || value.channelId !== EC_PRIMARY_CHANNEL_ID
        || !validPhone(value.legacySessionId)
        || !Number.isSafeInteger(value.generation) || value.generation < 1
        || !value.active || !validPhone(value.active.ownerPhoneDigits)
        || !validTime(value.active.approvedAt)) {
        throw new Error('ec_channel_binding_invalid');
    }
    if (value.pending != null && (!validPhone(value.pending.ownerPhoneDigits)
        || !validTime(value.pending.stagedAt)
        || value.pending.ownerPhoneDigits === value.active.ownerPhoneDigits)) {
        throw new Error('ec_channel_pending_invalid');
    }
    if (!Array.isArray(value.history) || value.history.length > 100
        || value.history.some((item) => !validPhone(item?.ownerPhoneDigits)
            || !validTime(item?.endedAt))) {
        throw new Error('ec_channel_history_invalid');
    }
    return value;
};

export const readEcChannelBinding = (env = process.env) => {
    const file = ecChannelBindingFile(env);
    if (!fs.existsSync(file)) return null;
    const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
        const stat = fs.fstatSync(fd);
        if (!stat.isFile() || stat.size > 65536 || stat.size < 40
            || (process.platform !== 'win32' && ((stat.mode & 0o077) !== 0 || stat.uid !== 0))) {
            throw new Error('ec_channel_binding_file_untrusted');
        }
        return validateEcChannelBinding(JSON.parse(fs.readFileSync(fd, 'utf8')));
    } finally {
        fs.closeSync(fd);
    }
};

export const ecChannelOwnerDecision = ({ sessionId, ownerPhoneDigits, peerPhoneDigits = '', binding,
    env = process.env } = {}) => {
    const session = digits(sessionId || env.WHATSAPP_DEFAULT_SESSION_ID);
    const owner = digits(ownerPhoneDigits);
    const peer = digits(peerPhoneDigits);
    const approved = binding === undefined ? readEcChannelBinding(env) : binding;
    if (!approved) {
        if (env.EC_WHATSAPP_CHANNEL_BINDING_REQUIRED === 'true'
            || env.EC_WHATSAPP_TRANSPORT === 'baileys_text') {
            return { allowed: false, reason: 'binding_missing' };
        }
        return { allowed: ['5531971862958', '553171862958'].includes(owner),
            reason: 'legacy_owner_policy' };
    }
    if (session !== approved.legacySessionId || !owner) {
        return { allowed: false, reason: 'session_or_owner_mismatch' };
    }
    if (owner === approved.active.ownerPhoneDigits) {
        return { allowed: true, reason: 'active_channel', channelId: approved.channelId,
            generation: approved.generation };
    }
    if (approved.pending?.ownerPhoneDigits === owner && peer === EC_PRIMARY_QA_PHONE) {
        return { allowed: true, reason: 'pending_qa_only', channelId: approved.channelId,
            generation: approved.generation + 1 };
    }
    return { allowed: false, reason: 'unapproved_account' };
};
