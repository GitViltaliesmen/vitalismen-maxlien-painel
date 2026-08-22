import crypto from 'crypto';

const canonicalValue = (value) => {
    if (Array.isArray(value)) return value.map(canonicalValue);
    if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = canonicalValue(value[key]);
            return result;
        }, {});
    }
    return value ?? null;
};

export const panelAuditHash = (value) => crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalValue(value)))
    .digest('hex');

export const panelAuditTransition = ({
    entity = 'contact_state',
    entityId = '',
    action = '',
    before = null,
    after = null
} = {}) => {
    const beforeHash = panelAuditHash(before);
    const afterHash = panelAuditHash(after);
    const changed = beforeHash !== afterHash;
    const transitionKey = [entity, entityId, action, beforeHash, afterHash].join('|');
    const transitionHash = crypto.createHash('sha256').update(transitionKey).digest('hex');
    return Object.freeze({
        changed,
        beforeHash,
        afterHash,
        transitionHash,
        messageId: `panel_action_${transitionHash.slice(0, 40)}`
    });
};
