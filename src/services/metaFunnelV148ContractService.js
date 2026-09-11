import fs from 'node:fs';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { resolveEcBotCoreV78Configuration } from './ecBotCoreOperationalV78Service.js';

export const META_V148_EXISTING_DATASET = '1468946114265008';
export const META_V148_SALES_IDENTITY = 'vturb-smartplayer:ab-6a6023ffd403aabb02392eb9';
const checkoutContext = new AsyncLocalStorage();
const ledgerContext = new AsyncLocalStorage();

export const validateMetaV148Activation = (activation = {}, source = {}, now = new Date()) => {
    const at = new Date(activation.activatedAt);
    if (!/^[a-f0-9]{40}$/.test(String(source.commit || '')) || source.commit !== activation.commit
        || source.functionalCommit !== source.commit || source.healthValidated === false
        || activation.healthValidated !== true || !String(activation.status || '').startsWith('active')
        || source.commit === 'f7927a9a8720d64f3c8ba5f02dcd290f2774f08f'
        || !Number.isFinite(at.getTime()) || at > now) return null;
    return at;
};

export const metaV148ActivationAt = () => {
    try {
        return validateMetaV148Activation(
            JSON.parse(fs.readFileSync(new URL('../../.activation-complete.json', import.meta.url), 'utf8')),
            JSON.parse(fs.readFileSync(new URL('../../.release-source.json', import.meta.url), 'utf8'))
        );
    } catch { return null; }
};

export const metaV148AttributionHash = (tracking = {}) => crypto.createHash('sha256').update(JSON.stringify(
    ['measurementVersion', 'renderedBranch', 'branchIdentity', 'browserPixelId', 'external_id',
        'campaign_id', 'adset_id', 'ad_id', 'fbclid', 'placement', 'fbc', 'fbp'].map(key => [key, String(tracking[key] || '')])
)).digest('hex');

export const salesAttributionV148 = (value = {}) => {
    const tracking = value.tracking || value;
    return Number(tracking.measurementVersion || tracking.measurement_version) === 148
        && (tracking.renderedBranch || tracking.rendered_branch) === 'SALES'
        && (tracking.branchIdentity || tracking.branch_identity) === META_V148_SALES_IDENTITY
        && String(tracking.browserPixelId || tracking.browser_pixel_id || '') === META_V148_EXISTING_DATASET;
};

export const withMetaCheckoutV148 = (context, callback) => checkoutContext.run(Object.freeze({ ...context }), callback);

export const metaCheckoutV148Allowed = (event = {}, env = process.env) => {
    const context = checkoutContext.getStore();
    return Boolean(context?.reserved === true && context?.businessTrigger === 'tex_ultra_explicit_quantity'
        && context.eventId && context.eventId === event.event_id && event.eventName === 'InitiateCheckout'
        && event.country === 'EC' && Number(event.measurementVersion) === 148
        && resolveEcBotCoreV78Configuration(env).ready);
};

export const withMetaLedgerV148 = (context, callback) => ledgerContext.run(Object.freeze({ ...context }), async () => await callback());
export const metaLedgerWriteV148Allowed = ({ collection, method, args = [], context, env = process.env } = {}) => {
    const ledger = ledgerContext.getStore();
    if (collection !== 'metabusinessevents' || !context?.writeContext || !resolveEcBotCoreV78Configuration(env).ready
        || !ledger?.eventId || String(args[0]?._id || '') !== ledger.eventId) return false;
    if (ledger.phase === 'checkout') return ['insertOne', 'updateOne'].includes(method)
        && context.method === 'POST' && ['/api/zapi/webhook', '/api/zapi/webhook/received'].includes(context.path);
    return ledger.phase === 'purchase' && method === 'findOneAndUpdate' && context.humanDropiActionV138 === true
        && context.manualDropiOperation === 'submit' && Boolean(context.humanDropiActorId)
        && String(context.humanDropiRequestedOrderId || '') === ledger.orderId;
};
