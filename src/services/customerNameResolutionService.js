const compact = (value = '') => String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

export const validCustomerName = (value = '') => {
    const candidate = compact(value);
    const digits = candidate.replace(/\D/g, '');
    if (
        !candidate
        || !/[\p{L}]/u.test(candidate)
        || /^https?:\/\//i.test(candidate)
        || /^(whatsapp|entrada vsl|cliente|contacto|contato)$/i.test(candidate)
        || (digits.length >= 8 && !/[\p{L}]{2}/u.test(candidate))
    ) return '';
    return candidate;
};

const comparableName = (value = '') => validCustomerName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const sameCustomerName = (left = '', right = '') => {
    const a = comparableName(left);
    const b = comparableName(right);
    return Boolean(a && b && a === b);
};

export const extractSubmittedVslName = (text = '') => {
    const line = String(text || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((item) => item.trim())
        .find((item) => /^nombre(?:\s+completo)?\s*:/i.test(item));
    if (!line) return '';
    return validCustomerName(line.replace(/^nombre(?:\s+completo)?\s*:\s*/i, ''));
};

const pendingConflict = ({ currentName, receivedName, receivedSource, at, sourceMessageId }) => ({
    status: 'IDENTITY_CONFLICT',
    currentName,
    receivedName,
    receivedSource,
    detectedAt: new Date(at).toISOString(),
    sourceMessageId: String(sourceMessageId || ''),
    resolvedAt: null,
    resolvedBy: '',
    resolution: ''
});

export const applyInboundCustomerNameEvidence = ({
    state,
    submittedName = '',
    profileName = '',
    at = new Date(),
    sourceMessageId = ''
} = {}) => {
    if (!state) return { changed: false, displayName: '' };
    const submitted = validCustomerName(submittedName);
    const profile = validCustomerName(profileName);
    const metadata = state.metadata || {};
    const draft = metadata.customerDraft || {};
    const lockedName = validCustomerName(metadata.manualNameLock?.name || metadata.verifiedCustomerName);
    const currentDraftName = validCustomerName(draft.name);
    const currentName = lockedName || currentDraftName;
    const receivedName = submitted || profile;
    const receivedSource = submitted ? 'vsl_submitted_name' : profile ? 'provider_profile_name' : '';
    let changed = false;

    const nextMetadata = { ...metadata };
    if (submitted && !sameCustomerName(metadata.submittedName, submitted)) {
        nextMetadata.submittedName = submitted;
        changed = true;
    }
    if (profile && !sameCustomerName(metadata.profileName, profile)) {
        nextMetadata.profileName = profile;
        changed = true;
    }

    const shouldFlagConflict = Boolean(
        receivedName
        && currentName
        && !sameCustomerName(receivedName, currentName)
        && (submitted || lockedName)
    );
    if (shouldFlagConflict) {
        const existing = metadata.identityConflict || {};
        if (
            existing.status !== 'IDENTITY_CONFLICT'
            || !sameCustomerName(existing.currentName, currentName)
            || !sameCustomerName(existing.receivedName, receivedName)
        ) {
            nextMetadata.identityConflict = pendingConflict({
                currentName,
                receivedName,
                receivedSource,
                at,
                sourceMessageId
            });
            changed = true;
        }
    } else if (!currentName && receivedName) {
        nextMetadata.customerDraft = {
            ...draft,
            name: receivedName,
            nameSource: receivedSource,
            updatedAt: new Date(at).toISOString()
        };
        changed = true;
    }

    state.metadata = nextMetadata;
    if (changed) state.markModified?.('metadata');
    return {
        changed,
        displayName: resolveCustomerDisplayName({ state }),
        identityConflict: nextMetadata.identityConflict || null
    };
};

export const applyVerifiedCustomerName = ({ state, name = '', by = '', at = new Date() } = {}) => {
    if (!state) return false;
    const verifiedName = validCustomerName(name);
    if (!verifiedName) return false;
    const metadata = state.metadata || {};
    const draft = metadata.customerDraft || {};
    const existingConflict = metadata.identityConflict || null;
    state.metadata = {
        ...metadata,
        verifiedCustomerName: verifiedName,
        manualNameLock: {
            active: true,
            name: verifiedName,
            by: String(by || ''),
            lockedAt: new Date(at).toISOString()
        },
        ...(existingConflict?.status === 'IDENTITY_CONFLICT' ? {
            identityConflict: {
                ...existingConflict,
                status: 'RESOLVED',
                resolution: sameCustomerName(verifiedName, existingConflict.receivedName)
                    ? 'USE_RECEIVED'
                    : 'KEEP_CURRENT',
                resolvedAt: new Date(at).toISOString(),
                resolvedBy: String(by || '')
            }
        } : {}),
        customerDraft: {
            ...draft,
            name: verifiedName,
            nameSource: 'manual_verified',
            updatedAt: new Date(at).toISOString()
        }
    };
    state.markModified?.('metadata');
    return true;
};

export const resolveIdentityConflict = ({ state, resolution = '', by = '', at = new Date() } = {}) => {
    const conflict = state?.metadata?.identityConflict || null;
    if (!state || conflict?.status !== 'IDENTITY_CONFLICT') return false;
    const selectedName = resolution === 'USE_RECEIVED'
        ? conflict.receivedName
        : resolution === 'KEEP_CURRENT'
            ? conflict.currentName
            : '';
    if (!selectedName) return false;
    return applyVerifiedCustomerName({ state, name: selectedName, by, at });
};

export const resolveCustomerDisplayName = ({
    state = {},
    orderName = '',
    lastMessageName = '',
    fallback = ''
} = {}) => {
    const metadata = state?.metadata || {};
    const pending = metadata.identityConflict?.status === 'IDENTITY_CONFLICT'
        ? metadata.identityConflict.currentName
        : '';
    return [
        pending,
        metadata.manualNameLock?.active ? metadata.manualNameLock.name : '',
        metadata.verifiedCustomerName,
        metadata.submittedName,
        metadata.profileName,
        metadata.customerDraft?.name,
        orderName,
        lastMessageName,
        fallback
    ].map(validCustomerName).find(Boolean) || String(fallback || '');
};
