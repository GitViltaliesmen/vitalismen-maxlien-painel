import {
    buildCanaryV75RecipientQuery,
    evaluateCanaryV75Recipient
} from '../services/canaryIsolationV75Service.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const parseList = (...values) => [
    ...new Set(
        values
            .flatMap((value) => String(value || '').split(','))
            .map((item) => digitsOnly(item))
            .filter(Boolean)
    )
];

const isSamePhone = (left, right) => {
    const a = digitsOnly(left);
    const b = digitsOnly(right);
    if (!a || !b) return false;
    return a === b || a.endsWith(b) || b.endsWith(a);
};

export const automationPilotOnly = () => String(process.env.WHATSAPP_AUTOMATION_PILOT_ONLY || 'true').toLowerCase() !== 'false';

export const automationAllowedRecipients = () => parseList(
    process.env.WHATSAPP_AUTOMATION_ALLOWED_RECIPIENTS,
    process.env.WHATSAPP_TEST_ALLOWED_RECIPIENTS,
    process.env.WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS
);

export const isAutomationRecipientAllowed = (phoneOrJid) => {
    const canaryDecision = evaluateCanaryV75Recipient(phoneOrJid, {
        surface: 'automation_recipient'
    });
    if (canaryDecision.enforced) return canaryDecision;

    if (!automationPilotOnly()) {
        return { allowed: true, reason: 'pilot_disabled' };
    }

    const allowed = automationAllowedRecipients();
    const target = digitsOnly(phoneOrJid);
    if (!target) return { allowed: false, reason: 'missing_recipient' };
    if (!allowed.length) return { allowed: false, reason: 'no_allowed_recipients' };

    const matched = allowed.some((item) => isSamePhone(target, item));
    return {
        allowed: matched,
        reason: matched ? 'allowed_pilot_recipient' : 'pilot_recipient_not_allowed'
    };
};

export const buildAutomationRecipientQuery = (path) => {
    const canaryQuery = buildCanaryV75RecipientQuery(path);
    if (Object.keys(canaryQuery).length > 0) return canaryQuery;

    if (!automationPilotOnly()) return {};
    const allowed = automationAllowedRecipients();
    if (!allowed.length) return { _id: { $exists: false } };

    return {
        $or: allowed.map((digits) => ({
            [path]: { $regex: `${digits.slice(-9)}\\D*$` }
        }))
    };
};
