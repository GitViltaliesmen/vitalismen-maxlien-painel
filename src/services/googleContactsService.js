import crypto from 'crypto';
import AutomationRun from '../models/AutomationRun.js';
import GoogleContactSync from '../models/GoogleContactSync.js';
import GoogleContactsIntegration from '../models/GoogleContactsIntegration.js';
import IntegrationOauthState from '../models/IntegrationOauthState.js';
import Order from '../models/Order.js';

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/contacts';
const GOOGLE_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_PEOPLE_ORIGIN = 'https://people.googleapis.com';
const RETRY_MINUTES = [1, 5, 30];
const LOCK_MS = 2 * 60 * 1000;

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const cleanName = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
const comparableName = (value) => cleanName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

const oauthConfig = () => ({
    clientId: String(process.env.GOOGLE_CONTACTS_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.GOOGLE_CONTACTS_CLIENT_SECRET || '').trim(),
    encryptionSecret: String(process.env.GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY || '').trim(),
    redirectUri: String(
        process.env.GOOGLE_CONTACTS_REDIRECT_URI
        || 'https://ec.maxlien.shop/api/integrations/google-contacts/callback'
    ).trim()
});

export const googleContactsConfiguration = () => {
    const config = oauthConfig();
    const missing = [];
    if (!config.clientId) missing.push('GOOGLE_CONTACTS_CLIENT_ID');
    if (!config.clientSecret) missing.push('GOOGLE_CONTACTS_CLIENT_SECRET');
    if (config.encryptionSecret.length < 32) missing.push('GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY');
    if (!/^https:\/\//i.test(config.redirectUri)) missing.push('GOOGLE_CONTACTS_REDIRECT_URI');
    return { configured: missing.length === 0, missing, redirectUri: config.redirectUri };
};

const encryptionKey = () => {
    const secret = oauthConfig().encryptionSecret;
    if (secret.length < 32) throw new Error('Chave de criptografia do Google Contatos nao configurada.');
    return crypto.createHash('sha256').update(secret).digest();
};

export const encryptGoogleRefreshToken = (value) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(value || ''), 'utf8'), cipher.final()]);
    return {
        encryptedRefreshToken: encrypted.toString('base64'),
        tokenIv: iv.toString('base64'),
        tokenAuthTag: cipher.getAuthTag().toString('base64')
    };
};

export const decryptGoogleRefreshToken = (integration = {}) => {
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        encryptionKey(),
        Buffer.from(String(integration.tokenIv || ''), 'base64')
    );
    decipher.setAuthTag(Buffer.from(String(integration.tokenAuthTag || ''), 'base64'));
    return Buffer.concat([
        decipher.update(Buffer.from(String(integration.encryptedRefreshToken || ''), 'base64')),
        decipher.final()
    ]).toString('utf8');
};

const hashOauthState = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

export const createGoogleContactsAuthorization = async ({ requestedBy = '' } = {}) => {
    const availability = googleContactsConfiguration();
    if (!availability.configured) {
        throw new Error(`Google Contatos nao configurado: ${availability.missing.join(', ')}`);
    }
    const rawState = crypto.randomBytes(32).toString('base64url');
    await IntegrationOauthState.create({
        provider: 'google_contacts',
        stateHash: hashOauthState(rawState),
        requestedBy: String(requestedBy || ''),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    const config = oauthConfig();
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('scope', `${GOOGLE_SCOPE} ${GOOGLE_EMAIL_SCOPE}`);
    url.searchParams.set('state', rawState);
    return { authUrl: url.toString(), expiresInSeconds: 600 };
};

const postForm = async (url, fields) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams(fields)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error_description || data.error || `Google HTTP ${response.status}`);
    return data;
};

export const completeGoogleContactsAuthorization = async ({ code = '', state = '' } = {}) => {
    if (!code || !state) throw new Error('Retorno OAuth incompleto.');
    const stateRecord = await IntegrationOauthState.findOne({
        provider: 'google_contacts',
        stateHash: hashOauthState(state),
        usedAt: null,
        expiresAt: { $gt: new Date() }
    });
    if (!stateRecord) throw new Error('Autorizacao expirada ou ja utilizada.');
    stateRecord.usedAt = new Date();
    await stateRecord.save();

    const config = oauthConfig();
    const token = await postForm(GOOGLE_TOKEN_URL, {
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code'
    });
    if (!token.refresh_token) throw new Error('Google nao devolveu token offline. Reconecte e autorize novamente.');

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' }
    });
    const user = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok || !user.email) throw new Error('Nao foi possivel identificar a conta Google autorizada.');

    const encrypted = encryptGoogleRefreshToken(token.refresh_token);
    const now = new Date();
    const integration = await GoogleContactsIntegration.findOneAndUpdate(
        { key: 'primary' },
        {
            $set: {
                status: 'connected',
                accountEmail: String(user.email || '').trim().toLowerCase(),
                ...encrypted,
                scopes: String(token.scope || `${GOOGLE_SCOPE} ${GOOGLE_EMAIL_SCOPE}`).split(/\s+/).filter(Boolean),
                enabledAt: now,
                connectedAt: now,
                disconnectedAt: null,
                lastTokenRefreshAt: now,
                lastError: '',
                connectedBy: stateRecord.requestedBy || ''
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await AutomationRun.create({
        kind: 'google_contacts_connected',
        requestedBy: stateRecord.requestedBy || '',
        payload: { accountEmail: integration.accountEmail, enabledAt: now }
    });
    return { accountEmail: integration.accountEmail, enabledAt: integration.enabledAt };
};

export const disconnectGoogleContacts = async ({ requestedBy = '' } = {}) => {
    const now = new Date();
    await GoogleContactsIntegration.findOneAndUpdate(
        { key: 'primary' },
        {
            $set: {
                status: 'disconnected',
                encryptedRefreshToken: '',
                tokenIv: '',
                tokenAuthTag: '',
                disconnectedAt: now,
                lastError: ''
            }
        },
        { upsert: true, new: true }
    );
    await AutomationRun.create({ kind: 'google_contacts_disconnected', requestedBy, payload: { at: now } });
};

const refreshGoogleAccessToken = async (integration) => {
    const config = oauthConfig();
    const token = await postForm(GOOGLE_TOKEN_URL, {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: decryptGoogleRefreshToken(integration),
        grant_type: 'refresh_token'
    });
    await GoogleContactsIntegration.updateOne(
        { _id: integration._id },
        { $set: { lastTokenRefreshAt: new Date(), lastError: '', status: 'connected' } }
    );
    return token.access_token;
};

const googlePeopleRequest = async (path, { method = 'GET', accessToken, body } = {}) => {
    const response = await fetch(`${GOOGLE_PEOPLE_ORIGIN}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const detail = data?.error?.message || data?.error_description || `Google People HTTP ${response.status}`;
        const error = new Error(detail);
        error.status = response.status;
        throw error;
    }
    return data;
};

const exactPhoneCandidate = (results = [], phoneDigits = '') => results
    .map((item) => item?.person || item)
    .find((person) => (person?.phoneNumbers || []).some((phone) => (
        digitsOnly(phone.canonicalForm || phone.value) === phoneDigits
    ))) || null;

const primaryGoogleName = (person = {}) => cleanName(
    person.names?.find((name) => name?.metadata?.primary)?.displayName
    || person.names?.[0]?.displayName
    || person.names?.[0]?.unstructuredName
    || ''
);

export const enqueueEligibleGoogleContacts = async ({ limit = 100 } = {}) => {
    const integration = await GoogleContactsIntegration.findOne({ key: 'primary', status: 'connected' }).lean();
    if (!integration?.enabledAt) return { eligible: 0, queued: 0, reason: 'not_connected' };
    const orders = await Order.find({
        country: 'EC',
        status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
        $or: [
            { confirmedAt: { $gte: integration.enabledAt } },
            { confirmedAt: null, createdAt: { $gte: integration.enabledAt } }
        ]
    }).sort({ confirmedAt: 1, createdAt: 1 }).limit(Math.max(1, Math.min(Number(limit) || 100, 500))).lean();
    let queued = 0;
    for (const order of orders) {
        const phoneDigits = digitsOnly(order.customer?.phone);
        const name = cleanName(order.customer?.name);
        if (!phoneDigits.startsWith('593') || phoneDigits.length < 11 || !name) continue;
        const result = await GoogleContactSync.updateOne(
            { phoneDigits },
            {
                $setOnInsert: {
                    phoneDigits,
                    country: 'EC',
                    name,
                    orderId: order.orderId || '',
                    productKey: order.tracking?.productKey || '',
                    orderConfirmedAt: order.confirmedAt || order.createdAt,
                    status: 'pending',
                    nextAttemptAt: new Date(),
                    attempts: 0
                }
            },
            { upsert: true }
        );
        if (result.upsertedCount) queued += 1;
    }
    return { eligible: orders.length, queued };
};

const recordSyncAudit = (job, status, detail = {}) => AutomationRun.create({
    kind: 'google_contact_sync',
    status: status === 'error' ? 'failed' : 'completed',
    requestedBy: 'scheduler',
    payload: {
        phoneDigits: job.phoneDigits,
        orderId: job.orderId,
        result: status,
        accountEmail: detail.accountEmail || '',
        existingName: detail.existingName || ''
    },
    error: detail.error || ''
});

const failSyncJob = async (job, error, accountEmail = '') => {
    const attempts = Number(job.attempts || 0) + 1;
    const delayMinutes = RETRY_MINUTES[attempts - 1];
    const terminal = delayMinutes === undefined;
    const nextAttemptAt = terminal ? null : new Date(Date.now() + delayMinutes * 60 * 1000);
    await GoogleContactSync.updateOne(
        { _id: job._id },
        {
            $set: {
                status: terminal ? 'error' : 'pending',
                attempts,
                nextAttemptAt,
                lockUntil: null,
                lastError: String(error?.message || error || 'Falha desconhecida').slice(0, 500)
            }
        }
    );
    if (terminal) await recordSyncAudit(job, 'error', { accountEmail, error: error?.message || String(error) });
    return { processed: 1, synced: 0, failed: 1, terminal };
};

export const processNextGoogleContactSync = async () => {
    const availability = googleContactsConfiguration();
    if (!availability.configured) return { processed: 0, reason: 'not_configured', missing: availability.missing };
    const integration = await GoogleContactsIntegration.findOne({ key: 'primary', status: 'connected' });
    if (!integration?.encryptedRefreshToken) return { processed: 0, reason: 'not_connected' };

    const now = new Date();
    const job = await GoogleContactSync.findOneAndUpdate(
        {
            status: 'pending',
            nextAttemptAt: { $lte: now },
            $or: [{ lockUntil: null }, { lockUntil: { $lte: now } }]
        },
        {
            $set: {
                status: 'syncing',
                lockUntil: new Date(Date.now() + LOCK_MS),
                lastAttemptAt: now
            }
        },
        { sort: { nextAttemptAt: 1, createdAt: 1 }, new: true }
    );
    if (!job) return { processed: 0, reason: 'empty' };

    try {
        const accessToken = await refreshGoogleAccessToken(integration);
        const readMask = 'names,phoneNumbers,metadata';
        await googlePeopleRequest(`/v1/people:searchContacts?query=&pageSize=1&readMask=${encodeURIComponent(readMask)}`, { accessToken });
        const search = await googlePeopleRequest(
            `/v1/people:searchContacts?query=${encodeURIComponent(`+${job.phoneDigits}`)}&pageSize=30&readMask=${encodeURIComponent(readMask)}`,
            { accessToken }
        );
        const existing = exactPhoneCandidate(search.results || [], job.phoneDigits);
        if (existing) {
            const existingName = primaryGoogleName(existing);
            if (comparableName(existingName) !== comparableName(job.name)) {
                if (job.allowNameUpdateOnce === true) {
                    const resourceName = String(existing.resourceName || '');
                    if (!/^people\/[A-Za-z0-9_-]+$/.test(resourceName)) throw new Error('Contato Google sem identificador atualizavel.');
                    const updated = await googlePeopleRequest(
                        `/v1/${resourceName}:updateContact?updatePersonFields=names`,
                        {
                            method: 'PATCH',
                            accessToken,
                            body: {
                                resourceName,
                                etag: existing.etag || '',
                                metadata: existing.metadata || {},
                                names: [{ unstructuredName: job.name }]
                            }
                        }
                    );
                    await GoogleContactSync.updateOne(
                        { _id: job._id },
                        {
                            $set: {
                                status: 'synced',
                                resourceName: updated.resourceName || resourceName,
                                etag: updated.etag || '',
                                existingName: job.name,
                                allowNameUpdateOnce: false,
                                syncedAt: new Date(),
                                lockUntil: null,
                                nextAttemptAt: null,
                                lastError: ''
                            }
                        }
                    );
                    await recordSyncAudit(job, 'synced', { accountEmail: integration.accountEmail, existingName: job.name });
                    return { processed: 1, synced: 1, updated: true };
                }
                await GoogleContactSync.updateOne(
                    { _id: job._id },
                    {
                        $set: {
                            status: 'conflict',
                            resourceName: existing.resourceName || '',
                            etag: existing.etag || '',
                            existingName,
                            attempts: Number(job.attempts || 0) + 1,
                            lockUntil: null,
                            nextAttemptAt: null,
                            lastError: 'Numero ja existe no Google Contatos com outro nome.'
                        }
                    }
                );
                await recordSyncAudit(job, 'conflict', { accountEmail: integration.accountEmail, existingName });
                return { processed: 1, synced: 0, conflict: 1 };
            }
            await GoogleContactSync.updateOne(
                { _id: job._id },
                {
                    $set: {
                        status: 'synced',
                        resourceName: existing.resourceName || '',
                        etag: existing.etag || '',
                        existingName,
                        syncedAt: new Date(),
                        lockUntil: null,
                        nextAttemptAt: null,
                        lastError: ''
                    }
                }
            );
            await recordSyncAudit(job, 'synced', { accountEmail: integration.accountEmail, existingName });
            return { processed: 1, synced: 1, existing: true };
        }

        const created = await googlePeopleRequest('/v1/people:createContact', {
            method: 'POST',
            accessToken,
            body: {
                names: [{ unstructuredName: job.name }],
                phoneNumbers: [{ value: `+${job.phoneDigits}`, type: 'mobile' }]
            }
        });
        await GoogleContactSync.updateOne(
            { _id: job._id },
            {
                $set: {
                    status: 'synced',
                    resourceName: created.resourceName || '',
                    etag: created.etag || '',
                    existingName: job.name,
                    syncedAt: new Date(),
                    lockUntil: null,
                    nextAttemptAt: null,
                    lastError: ''
                }
            }
        );
        await recordSyncAudit(job, 'synced', { accountEmail: integration.accountEmail });
        return { processed: 1, synced: 1, created: true };
    } catch (error) {
        const authFailure = Number(error?.status || 0) === 401
            || /invalid_grant|unauthorized|revoked|token has been expired/i.test(String(error?.message || ''));
        await GoogleContactsIntegration.updateOne(
            { _id: integration._id },
            {
                $set: {
                    ...(authFailure ? { status: 'error' } : {}),
                    lastError: String(error?.message || error || '').slice(0, 500)
                }
            }
        ).catch(() => null);
        return failSyncJob(job, error, integration.accountEmail);
    }
};

export const retryGoogleContactSync = async (phone) => {
    const phoneDigits = digitsOnly(phone);
    if (!phoneDigits.startsWith('593')) throw new Error('Somente contatos reais EC podem ser sincronizados.');
    const result = await GoogleContactSync.findOneAndUpdate(
        { phoneDigits },
        {
            $set: {
                status: 'pending',
                attempts: 0,
                nextAttemptAt: new Date(),
                lockUntil: null,
                lastError: ''
            }
        },
        { new: true }
    );
    if (!result) throw new Error('Contato ainda nao entrou na fila do Google.');
    return result;
};

export const authorizeGoogleContactNameUpdate = async (phone) => {
    const phoneDigits = digitsOnly(phone);
    if (!phoneDigits.startsWith('593')) throw new Error('Somente contatos reais EC podem ser atualizados.');
    const result = await GoogleContactSync.findOneAndUpdate(
        { phoneDigits, status: 'conflict' },
        {
            $set: {
                allowNameUpdateOnce: true,
                status: 'pending',
                attempts: 0,
                nextAttemptAt: new Date(),
                lockUntil: null,
                lastError: ''
            }
        },
        { new: true }
    );
    if (!result) throw new Error('Nao existe conflito de nome pendente para este telefone.');
    return result;
};

export const googleContactsStatus = async () => {
    const availability = googleContactsConfiguration();
    const integration = await GoogleContactsIntegration.findOne({ key: 'primary' }).lean();
    const counts = await GoogleContactSync.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).catch(() => []);
    return {
        configured: availability.configured,
        missing: availability.missing,
        connected: integration?.status === 'connected' && Boolean(integration?.encryptedRefreshToken),
        status: integration?.status || 'disconnected',
        accountEmail: integration?.accountEmail || '',
        enabledAt: integration?.enabledAt || null,
        lastTokenRefreshAt: integration?.lastTokenRefreshAt || null,
        lastError: integration?.lastError || '',
        counts: Object.fromEntries(counts.map((item) => [item._id, item.count]))
    };
};

export const publicGoogleContactSync = (sync = null) => sync ? {
    status: sync.status,
    name: sync.name,
    existingName: sync.existingName || '',
    orderId: sync.orderId || '',
    syncedAt: sync.syncedAt || null,
    lastAttemptAt: sync.lastAttemptAt || null,
    lastError: sync.lastError || ''
} : null;
