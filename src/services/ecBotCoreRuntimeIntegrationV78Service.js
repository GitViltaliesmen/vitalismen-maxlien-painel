import { integrationPolicyV254, integrationScopeV254, integrationMongoAllowedV254, integrationExternalAllowedV254 } from './orderIntegrationScopeV254Service.js';
import { isAutomaticDropiContextV252, automaticDropiMongoAllowedV252, automaticDropiExternalAllowedV252 } from './confirmedDropiDispatchV252Service.js';
import { assertBurstEnvelopeV228, BURST_VERSION_V228 } from './vitPowerBurstCoreV228Service.js';
import { webChatRequestAllowedV220 } from './vitPowerWebChatV220Application.js';
import { recognizePrincipalSdrQaIngressV212, principalSdrQaPersistedRoutingV212 } from './principalSdrQaIngressV212Service.js';
import {giraRuntimePolicy} from './gira21x/runtime-policy.mjs';
import { prepareManualHumanRequest, manualMongoAllowed, manualExternalAllowed } from './manualHumanRuntime.js';
import { metaLedgerWriteV148Allowed } from './metaFunnelV148ContractService.js';
import { ecRuntimeContextStore } from './postSaleLinkedV270Context.js';
import { ecBaileysTextMode } from '../whatsapp/ecTransportMode.js';
import { linkedDeviceOrderWriteAllowed } from './linkedDeviceOrderWritePolicy.js';
import { authorizePostSaleLinkedV270 } from './postSaleLinkedV270Auth.js';
import { measurementMongoAllowedV213, measurementRequestAllowedV213 } from './vitPowerMeasurementV213Application.js';
import { createHash, randomUUID } from 'node:crypto';

import ContactState from '../models/ContactState.js';
import {
    EC_BOT_CORE_V78_ALLOWED_WRITE_CLASSES,
    EC_BOT_CORE_V78_MODE,
    ecBotCoreV78ExternalEffectDecision,
    ecBotCoreV78Requested,
    ecBotCoreV78RouteDecision,
    resolveEcBotCoreV78Configuration
} from './ecBotCoreOperationalV78Service.js';
import { ecPanelRuntimeRecoveryV115RouteDecision } from './ecPanelRuntimeRecoveryV115Service.js';
import {
    ecPanelCustomerPersistenceV122MongoAllowed,
    ecPanelCustomerPersistenceV122RouteDecision
} from './ecPanelCustomerPersistenceV122Service.js';
import {
    ecManualDropiReleaseV119ExternalEffectAllowed,
    ecManualDropiReleaseV119MongoAllowed,
    ecManualDropiReleaseV129RouteDecision
} from './ecManualDropiReleaseV119Service.js';
import { ecMultiproductManualReleaseV120RouteDecision } from './ecMultiproductManualReleaseV120Service.js';
import {
    EC_OFFICIAL_VSL_V78_MESSAGE,
    EC_OFFICIAL_VSL_V78_WHATSAPP,
    recognizeOfficialEcVslEntryV78,
    recognizeClaimedVitEcQaEntryV78
} from './ecOfficialVslEntryV78Service.js';
import {
    EC_QA_TEST_PHONE_V78,
    EC_QA_TEST_REQUIRED_TAGS_V78
} from './ecQaTestResetV78Service.js';
import {
    ecPanelStatusV177Actor,
    ecPanelStatusV177MongoAllowed,
    ecPanelStatusV177Operation,
    ecPanelStatusV177RouteDecision,
    ecPanelStatusV177Target,
    isEcPanelStatusV177StrictLocalRequest
} from './ecPanelStatusOperationsV177Service.js';

export const EC_BOT_CORE_V78_OPERATION_BLOCKED = 'EC_BOT_CORE_V78_OPERATION_BLOCKED';
const POST_SALE_V270_CYCLE_PATH = '/api/shipments/internal/post-sale-v270/cycle';
export const EC_QA_TEST_MAX_MESSAGES_V110 = 8;
export const EC_AUTH_LOGIN_V78_PATH = '/api/auth/login';
export const EC_BOT_CORE_V78_MONGO_COLLECTIONS = Object.freeze(new Set([
    'contactstates',
    'messages',
    'outbounddedupes',
    'vslvisits',
    'metaattributioncorrelations'
]));

const runtimeContext = ecRuntimeContextStore;
const clean = (value = '') => String(value ?? '').trim();
const digits = (value = '') => clean(value).replace(/\D/g, '');

export const isExactEcAuthLoginV78Request = ({ method = '', path = '' } = {}) => (
    clean(method).toUpperCase() === 'POST'
    && String(path ?? '').split('?')[0] === EC_AUTH_LOGIN_V78_PATH
);

const httpBlocked = (res, reason, method, path) => res.status(423).json({
    ok: false,
    error: 'ec_bot_core_v78_operation_blocked',
    code: EC_BOT_CORE_V78_OPERATION_BLOCKED,
    reason,
    method,
    path
});

const zapiPhoneFromPayloadV78 = (payload = {}) => {
    const candidates = [
        payload.phone,
        payload.senderPhone,
        payload.customerPhone,
        payload.sender,
        payload.from,
        payload.message?.phone,
        payload.message?.senderPhone,
        payload.message?.sender,
        payload.message?.from,
        payload.data?.phone,
        payload.data?.senderPhone,
        payload.data?.sender,
        payload.data?.from
    ];
    return candidates.map(digits).find((value) => value.length >= 10 && !value.startsWith('120363')) || '';
};

const zapiTextFromPayloadV78 = (payload = {}) => [
    payload.text?.message,
    payload.text,
    payload.body,
    payload.message?.text?.message,
    payload.message?.text,
    payload.message?.body,
    payload.data?.text?.message,
    payload.data?.text,
    payload.data?.body
].map((value) => typeof value === 'string' ? value.trim() : '').find(Boolean) || '';

const zapiMessageIdFromPayloadV78 = (payload = {}) => [
    payload.messageId,
    payload.id,
    payload.key?.id,
    payload.message?.messageId,
    payload.message?.id,
    payload.message?.key?.id,
    payload.data?.messageId,
    payload.data?.id,
    payload.data?.key?.id
].map(clean).find(Boolean) || '';

export const isEcQaInboundMessagePayloadV111 = (payload = {}) => {
    const text = zapiTextFromPayloadV78(payload);
    const fromMe = payload.fromMe === true
        || payload.message?.fromMe === true
        || payload.data?.fromMe === true
        || payload.key?.fromMe === true
        || payload.message?.key?.fromMe === true;
    if (fromMe) return false;
    const status = clean(payload.status || payload.messageStatus || payload.deliveryStatus || payload.data?.status).toUpperCase();
    const callbackType = clean(payload.type || payload.event || payload.data?.type);
    const receivedInbound = status === 'RECEIVED' && Boolean(text);
    const deliveryCallback = !receivedInbound && (
        Boolean(status && status !== 'RECEIVED')
        || payload.ack !== undefined
        || /delivery|message-status|status/i.test(callbackType)
    );
    return Boolean(text) && !deliveryCallback;
};


// Observability only: no reads/writes to Mongo, payload, filter or return object.
// PM2 appends these JSON lines to its existing output log. Logger failures are swallowed.
const qaObservationByPayloadV78 = new WeakMap();
const qaObservationByClaimV78 = new WeakMap();
const qaOpaqueIdV78 = value => typeof value === 'string' && (
    /^[a-f0-9]{16,128}$/i.test(value)
    || /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
    || /^ecqa-v78-[a-f0-9]{32}$/i.test(value)
) ? value : null;
const qaCountV78 = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const qaCodeV78 = value => Number.isSafeInteger(value) && value >= 0 && value <= 0x7fffffff ? value : (
    ['EC_BOT_CORE_V78_OPERATION_BLOCKED', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT',
        'ENOTFOUND', 'EHOSTUNREACH', 'EPIPE', 'MONGO_FAILURE'].includes(value) ? value : 'UNCLASSIFIED_EXCEPTION');
const qaLogV78 = (observation, event, fields = {}) => {
    if (!observation) return;
    try {
        console.info('[EC-QA-CLAIM-V78] ' + JSON.stringify({
            project: 'VITALISMEN_EC', event, requestId: observation.requestId,
            qaContextId: observation.qaContextId, contactStateId: observation.contactStateId,
            inboundId: observation.inboundId, ...fields
        }));
    } catch { /* Observability never changes authorization or error propagation. */ }
};
const qaLogExceptionV78 = (observation, event, error) => {
    try { qaLogV78(observation, event, { exceptionCode: qaCodeV78(error?.code) }); } catch {}
};
const qaObservationV78 = payload => {
    try {
        if (!payload || typeof payload !== 'object' || zapiPhoneFromPayloadV78(payload) !== EC_QA_TEST_PHONE_V78) return null;
        if (!qaObservationByPayloadV78.has(payload)) qaObservationByPayloadV78.set(payload, {
            requestId: randomUUID(), qaContextId: null, contactStateId: null,
            inboundId: qaOpaqueIdV78(zapiMessageIdFromPayloadV78(payload))
        });
        return qaObservationByPayloadV78.get(payload);
    } catch { return null; }
};
const qaPipelineEnterV78 = req => {
    try {
        const path = String(req.originalUrl || req.path || req.url || '').split('?')[0].replace(/\/+$/, '');
        if (!['/api/zapi/webhook', '/api/zapi/webhook/received'].includes(path)) return null;
        const observation = qaObservationV78(req.body);
        qaLogV78(observation, 'QA_PIPELINE_ENTER', { path });
        return observation;
    } catch { return null; }
};
const qaObservedFilterV78 = (observation, filter, phase) => {
    try {
        qaLogV78(observation, 'QA_FILTER_APPLIED', { phase, filterApplied: true,
            filterFields: Object.keys(filter).sort(),
            filterSha256: createHash('sha256').update(JSON.stringify(filter)).digest('hex') });
    } catch { /* Return the original filter, even if logging fails. */ }
    return filter;
};
const qaMongoResultV78 = (observation, result, phase, executed) => {
    try { qaLogV78(observation, 'QA_MONGO_RESULT', { phase, executed,
        matchedCount: executed ? qaCountV78(Object.getOwnPropertyDescriptor(result || {}, 'matchedCount')?.value) : null,
        modifiedCount: executed ? qaCountV78(Object.getOwnPropertyDescriptor(result || {}, 'modifiedCount')?.value) : null }); } catch {}
};
const qaObservedReturnV78 = (observation, result) => {
    try {
        qaLogV78(observation, 'QA_CLAIM_RETURN', { returnState: {
            applicable: result.applicable, allowed: result.allowed,
            persistenceAllowed: result.persistenceAllowed ?? null,
            automationAllowed: result.automationAllowed ?? null,
            reason: /^[a-z0-9_]{1,96}$/.test(result.reason || '') ? result.reason : null,
            phase: result.phase || null
        } });
        if (observation) qaObservationByClaimV78.set(result, observation);
    } catch {}
    return result;
};
const qaObservedFinalizeReturnV78 = (observation, result) => {
    qaLogV78(observation, 'QA_FINALIZE_RESULT', { changed: result.changed });
    return result;
};

const exactQaQueryV78 = (now, messageId, { followUp = false } = {}) => ({
    phoneDigits: EC_QA_TEST_PHONE_V78,
    chatId: { $in: [`${EC_QA_TEST_PHONE_V78}@c.us`, `${EC_QA_TEST_PHONE_V78}@s.whatsapp.net`] },
    'human.mode': 'auto',
    'metadata.testOnly': true,
    'metadata.botTestEnabled': true,
    'metadata.fullFunnelTestEnabled': true,
    tags: { $all: [...EC_QA_TEST_REQUIRED_TAGS_V78] },
    'metadata.qaTestContextV78.version': 78,
    'metadata.qaTestContextV78.context': 'EC_V78_OFFICIAL_VSL_QA',
    'metadata.qaTestContextV78.phone': EC_QA_TEST_PHONE_V78,
    'metadata.qaTestContextV78.status': 'armed',
    'metadata.qaTestContextV78.expiresAt': { $gt: now.toISOString() },
    'metadata.qaTestContextV78.routingMessageId': { $ne: messageId },
    ...(followUp ? {
        'metadata.qaTestContextV78.status': 'consumed',
        'metadata.qaTestContextV78.processedMessageIds': { $ne: messageId },
        'metadata.qaTestContextV78.messageCount': { $lt: EC_QA_TEST_MAX_MESSAGES_V110 }
    } : {})
});

export const claimEcQaInboundContextV78 = async ({
    payload = {},
    model = ContactState,
    now = new Date(),
    allowQaFollowUp = false
} = {}) => {
    const observation = qaObservationV78(payload);
    qaLogV78(observation, 'QA_CLAIM_ENTER');
    try {
    const phone = zapiPhoneFromPayloadV78(payload);
    if (phone !== EC_QA_TEST_PHONE_V78) {
        return qaObservedReturnV78(observation, Object.freeze({ applicable: false, allowed: true, phone, reason: 'not_exact_qa_phone' }));
    }
    if (!isEcQaInboundMessagePayloadV111(payload)) {
        return qaObservedReturnV78(observation, Object.freeze({ applicable: false, allowed: true, phone, reason: 'qa_non_inbound_callback' }));
    }
    const text = zapiTextFromPayloadV78(payload);
    const messageId = zapiMessageIdFromPayloadV78(payload);
    if (!messageId) return qaObservedReturnV78(observation, Object.freeze({ applicable: true, allowed: false, phone, reason: 'qa_provider_message_id_required' }));
    let recognition = recognizeOfficialEcVslEntryV78({
        text,
        destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP
    });
    if (!recognition.recognized && globalThis.__VITALISMEN_EC_PRINCIPAL_SDR_V212?.canHandle?.(phone) === true) {
        const state = await model.findOne({ phoneDigits: phone, 'metadata.testOnly': true }).lean();
        recognition = recognizePrincipalSdrQaIngressV212({ text, phone, connectedPhone: clean(payload.connectedPhone),
            messageId, state, approved: true, now });
    }
    if (!recognition.recognized && text.split(/\r?\n/)[0].trim() === 'Hola, vengo del video') {
        const state = await model.findOne({ phoneDigits: phone, 'metadata.testOnly': true }).lean();
        try { if (observation) {
            observation.contactStateId = qaOpaqueIdV78(String(state?._id || ''));
            observation.qaContextId = qaOpaqueIdV78(state?.metadata?.qaTestContextV78?.permitId);
            qaLogV78(observation, 'QA_CONTEXT_OBSERVED');
        } } catch { /* Observation cannot alter the existing state read. */ }
        const visitId = String(state?.metadata?.vslVisitId || '');
        if (/^[a-f0-9]{24}$/.test(visitId)) {
            const inbound = await model.db.collection('messages').findOne({ _id: messageId });
            const visit = await model.db.collection('vslvisits').findOne({
                _id: new state._id.constructor(visitId), customerPhone: phone
            });
            recognition = recognizeClaimedVitEcQaEntryV78({ text, messageId, phone,
                connectedPhone: clean(payload.connectedPhone), state: state || {},
                inbound: inbound ? { ...inbound, connectedPhone: clean(inbound.providerPayload?.connectedPhone),
                    providerMoment: inbound.providerPayload?.momment } : {}, visit: visit || {} });
        }
    }
    const initialResult = recognition.recognized
        ? await model.updateOne(qaObservedFilterV78(observation, exactQaQueryV78(now, messageId), 'initial'), {
            $set: {
                'metadata.qaTestContextV78.status': 'routing',
                'metadata.qaTestContextV78.routingAt': now.toISOString(),
                'metadata.qaTestContextV78.routingMessageId': messageId,
                'metadata.qaTestContextV78.routingSignature': recognition.signature || EC_OFFICIAL_VSL_V78_MESSAGE,
                'metadata.qaTestContextV78.routingPhase': 'initial'
            }
        })
        : { modifiedCount: 0 };
    qaMongoResultV78(observation, initialResult, 'initial', recognition.recognized);
    const initialClaimed = Number(initialResult?.modifiedCount || 0) === 1;
    const followUpResult = initialClaimed || allowQaFollowUp !== true
        || String(recognition.reason || '').startsWith('vit_qa_')
        ? { modifiedCount: 0 }
        : await model.updateOne(qaObservedFilterV78(observation, exactQaQueryV78(now, messageId, { followUp: true }), 'followup'), {
        $set: {
            'metadata.qaTestContextV78.status': 'routing',
            'metadata.qaTestContextV78.routingAt': now.toISOString(),
            'metadata.qaTestContextV78.routingMessageId': messageId,
            'metadata.qaTestContextV78.routingSignature': 'EC_V110_AUTHORIZED_QA_FOLLOWUP',
            'metadata.qaTestContextV78.routingPhase': 'followup'
        }
    });
    qaMongoResultV78(observation, followUpResult, 'followup', !initialClaimed && allowQaFollowUp === true);
    const followUpClaimed = Number(followUpResult?.modifiedCount || 0) === 1;
    if (!initialClaimed && !followUpClaimed) {
        return qaObservedReturnV78(observation, Object.freeze({
            applicable: true,
            allowed: false,
            persistenceAllowed: true,
            automationAllowed: false,
            phone,
            messageId,
            reason: recognition.recognized ? 'qa_dashboard_persistence_only' : recognition.reason
        }));
    }
    return qaObservedReturnV78(observation, Object.freeze({
        applicable: true,
        allowed: true,
        persistenceAllowed: true,
        automationAllowed: true,
        phone,
        messageId,
        reason: initialClaimed ? 'qa_context_claimed' : 'qa_context_followup_claimed',
        phase: initialClaimed ? 'initial' : 'followup'
    }));
    } catch (error) {
        qaLogExceptionV78(observation, 'QA_CLAIM_EXCEPTION', error);
        throw error;
    }
};

export const finalizeEcQaInboundContextV78 = async ({
    claim = {},
    model = ContactState,
    statusCode = 500,
    now = new Date()
} = {}) => {
    let observation = null;
    try { observation = qaObservationByClaimV78.get(claim) || (claim.phone === EC_QA_TEST_PHONE_V78 ? {
        requestId: randomUUID(), inboundId: qaOpaqueIdV78(claim.messageId),
        qaContextId: null, contactStateId: null } : null); } catch {}
    qaLogV78(observation, 'QA_FINALIZE_ENTER');
    try {
    if (!claim.applicable || !claim.allowed || !claim.messageId) return qaObservedFinalizeReturnV78(observation, Object.freeze({ changed: false }));
    const result = await model.updateOne(qaObservedFilterV78(observation, {
        phoneDigits: EC_QA_TEST_PHONE_V78,
        'metadata.qaTestContextV78.status': 'routing',
        'metadata.qaTestContextV78.routingMessageId': claim.messageId
    }, 'finalize'), {
        $set: {
            'metadata.qaTestContextV78.status': 'consumed',
            'metadata.qaTestContextV78.consumedAt': now.toISOString(),
            'metadata.qaTestContextV78.consumedMessageId': claim.messageId,
            'metadata.qaTestContextV78.httpStatus': Number(statusCode || 0),
            'metadata.qaTestContextV78.lastProcessedAt': now.toISOString(),
            'metadata.qaTestContextV78.lastProcessedPhase': claim.phase || 'initial'
        },
        $addToSet: {
            'metadata.qaTestContextV78.processedMessageIds': claim.messageId
        },
        $inc: {
            'metadata.qaTestContextV78.messageCount': 1
        }
    });
    qaMongoResultV78(observation, result, 'finalize', true);
    return qaObservedFinalizeReturnV78(observation, Object.freeze({ changed: Number(result?.modifiedCount || 0) === 1 }));
    } catch (error) {
        qaLogExceptionV78(observation, 'QA_FINALIZE_EXCEPTION', error);
        throw error;
    }
};

export const currentEcBotCoreRuntimeContextV78 = () => runtimeContext.getStore() || null;

// A linked-device message receives write authority only from the selected
// transport, an exact live socket, the official number and a sealed successor.
// No environment flag alone can manufacture this context.
export const runVerifiedBaileysInboundV265 = async ({ socket, sessionId, messageId,
    ownerPhoneDigits, senderPhoneDigits }, work) => {
    if (!ecBaileysTextMode() || !resolveEcBotCoreV78Configuration(process.env).ready
        || globalThis.__VITALISMEN_EC_BAILEYS_INGRESS_V265?.isCurrent?.() !== true) {
        throw new Error('baileys_inbound_successor_not_authorized');
    }
    if (typeof work !== 'function' || !socket || typeof sessionId !== 'string' || !sessionId
        || typeof messageId !== 'string' || !messageId || messageId.length > 250) {
        throw new Error('baileys_inbound_identity_invalid');
    }
    const { getSock, getStatus } = await import('../whatsapp/connection.js');
    const status = getStatus(sessionId);
    const actualOwner = digits(status.ownPhoneDigits);
    const sender = digits(senderPhoneDigits);
    const { ecChannelOwnerDecision } = await import('../whatsapp/ecPrimaryChannelBinding.js');
    const ownerDecision = ecChannelOwnerDecision({ sessionId, ownerPhoneDigits: actualOwner,
        peerPhoneDigits: sender });
    if (!(/^593\d{9}$/.test(sender) || sender === EC_QA_TEST_PHONE_V78)
        || status.isReady !== true || status.status !== 'connected'
        || getSock(sessionId) !== socket || ownerDecision.allowed !== true
        || actualOwner !== digits(ownerPhoneDigits)) {
        throw new Error('baileys_inbound_socket_not_verified');
    }
    return runtimeContext.run({ profile: EC_BOT_CORE_V78_MODE, method: 'SOCKET',
        path: '/internal/whatsapp/baileys-inbound', writeContext: true,
        baileysInbound: Object.freeze({ verified: true, sessionId, messageId,
            ownerPhoneDigits: actualOwner, senderPhoneDigits: sender }) }, work);
};

// The QA guard grants persistence only. Claim authority is evaluated once the
// existing recorder has completed message, visit and contact persistence.
export const recordEcQaInboundAfterPersistenceV78 = async ({
    req, res, record, model = ContactState, now
} = {}) => {
    if (req.ecQaInboundClaimDeferredV78 !== true) return record(req.body || {});
    const context = runtimeContext.getStore();
    const result = await record(req.body || {}, { qaPostPersist: true });
    if (result.recorded !== true || result.newMessage !== true) {
        return { ...result, routeToBot: false };
    }
    const claim = await claimEcQaInboundContextV78({
        payload: req.body || {}, model, ...(now ? { now } : {}), allowQaFollowUp: true
    });
    const allowed = claim.applicable === true && claim.allowed === true
        && claim.automationAllowed === true;
    req.ecQaInboundPolicyV90 = Object.freeze({
        persistenceAllowed: true, automationAllowed: allowed,
        reason: claim.reason, messageId: claim.messageId
    });
    if (allowed) {
        res.once('finish', () => {
            // Retain the guard's write context and existing finish finalization.
            runtimeContext.run({ ...context, qaFinalization: true }, () =>
                finalizeEcQaInboundContextV78({ claim, model, statusCode: res.statusCode })
                    .catch(error => console.error('[EC-BOT-CORE-V78] falha ao finalizar contexto QA:', error.message)));
        });
    }
    const principalQaRoute = principalSdrQaPersistedRoutingV212({ result, claim,
        approved: globalThis.__VITALISMEN_EC_PRINCIPAL_SDR_V212?.canHandle?.(result.phone) === true });
    return { ...result, routeToBot: allowed && (result.qaBotEligibility === true || principalQaRoute) };
};


// Runs after the existing panel authentication. Only these explicit per-order
// actions can carry human authority into the existing asynchronous submit queue.
export const ecManualDropiHumanActionV138 = (req, res, next) => {
    const path = String(req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '');
    const match = path.match(/^\/api\/shipments\/droppi\/ec\/orders\/([^/]+)\/(authorize-submit|submit)$/)
        || path.match(/^\/api\/shipments\/([^/]+)\/(requeue-dropi-submit)$/);
    if (req.method !== 'POST' || !match) return next();
    const context = currentEcBotCoreRuntimeContextV78();
    const actorId = clean(req.user?._id || req.user?.id);
    if (!actorId || actorId === 'local-no-password' || req.user?.role !== 'admin'
        || req.user?.isActive === false || context?.manualDropiV119 !== true
        || context.manualDropiOperation !== match[2]) {
        return res.status(403).json({ success: false, authorizationRequired: true,
            code: 'dropi_authenticated_human_required', error: 'Entre no painel como operador para autorizar ou enviar este pedido.' });
    }
    return runtimeContext.run({ ...context, humanDropiActionV138: true,
        humanDropiActorId: actorId, humanDropiRequestedOrderId: decodeURIComponent(match[1])
    }, next);
};

// V177 upgrades a route candidate only after the existing panel authentication
// has produced an active, identifiable human actor.  The nested context is the
// sole authority consumed by the Mongo guard below.
export const ecPanelStatusAuthenticatedActionV177 = (req, res, next) => {
    if (!ecBotCoreV78Requested(process.env)) return next();
    const context = currentEcBotCoreRuntimeContextV78();
    const path = String(req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '') || '/';
    const operation = ecPanelStatusV177Operation({ method: req.method, path, body: req.body || {} });
    if (!operation) return next();
    const actor = ecPanelStatusV177Actor(req.user);
    const v203AdminOperation = ['manual-historical-status-v203', 'manual-contact-historical-status-v203', 'stage-confirmed-v203'].includes(operation);
    const target = ecPanelStatusV177Target({ path, body: req.body || {}, params: req.params || {} });
    if (
        context?.panelStatusRouteV177 !== true
        || context.panelStatusCandidateOperationV177 !== operation
        || !actor.active
        || (v203AdminOperation && req.user?.role !== 'admin')
        || !target
    ) {
        return res.status(403).json({
            success: false,
            authorizationRequired: true,
            code: 'panel_status_v177_authenticated_human_required',
            error: 'Entre no painel como operador ativo para concluir esta operacao.'
        });
    }
    return runtimeContext.run({
        ...context,
        panelStatusV177: true,
        panelStatusOperationV177: operation,
        panelStatusActorIdV177: actor.actorId,
        panelStatusTargetV177: target,
        panelStatusBodyV177: req.body || {},
        panelStatusHumanAuthenticatedV177: true,
        panelStatusInternalLocalV177: false
    }, next);
};

export const ecBotCoreMutationRouteGuardV78 = async (req, res, next) => {
    const qaObservation = qaPipelineEnterV78(req);
    const env = process.env;
    if (!ecBotCoreV78Requested(env)) {
        qaLogV78(qaObservation, 'QA_PIPELINE_RETURN', { claimReached: false, reason: 'profile_not_requested' });
        return next();
    }
    const requestPath = String(req.originalUrl || req.path || req.url || '').split('?')[0] || '/';
    const path = requestPath.replace(/\/+$/, '') || '/';
    const method = String(req.method || '').trim().toUpperCase();
    if (integrationPolicyV254() && method === 'POST' && /^\/api\/shipments\/droppi\/ec\/orders\/(?:EC-[A-Z0-9-]+|[1-9]\d{5,11})\/meta-retry$/.test(path)) return next();
    const configuration = resolveEcBotCoreV78Configuration(env);
    if (!configuration.ready) {
        qaLogV78(qaObservation, 'QA_PIPELINE_RETURN', { claimReached: false, reason: 'bot_core_invalid_fail_closed' });
        return httpBlocked(res, 'bot_core_invalid_fail_closed', method, path);
    }
    if (method === 'POST' && path === POST_SALE_V270_CYCLE_PATH) {
        if (!authorizePostSaleLinkedV270(req)) return httpBlocked(res, 'post_sale_v270_authority_denied', method, path);
        req.postSaleV270Authorized = true;
        return runtimeContext.run({ profile: EC_BOT_CORE_V78_MODE, method, path,
            writeContext: req.body.mode === 'run', postSaleV270: true,
            postSaleV270Mode: req.body.mode }, next);
    }
    if (path === '/api/whatsapp/b01-v216' && ['GET', 'POST'].includes(method)) {
        return runtimeContext.run({ profile: EC_BOT_CORE_V78_MODE, method, path, writeContext: false, b01AuthenticatedCandidateV216: true }, next);
    }
    if (method === 'POST' && /^\/api\/web-chat-admin\/vitpower\/[a-f0-9]{64}\/order-access$/.test(path) && /^Bearer [^\s]{1,8192}$/.test(req.headers?.authorization || '')) {
        return runtimeContext.run({ profile: EC_BOT_CORE_V78_MODE, method, path, writeContext: false, webOrderAccessV231: true }, next);
    }
    if (webChatRequestAllowedV220(req)) {
        return runtimeContext.run({ profile: EC_BOT_CORE_V78_MODE, method, path, writeContext: false, webChatV220: true }, next);
    }
    if (measurementRequestAllowedV213(req)) {
        return runtimeContext.run({ profile: EC_BOT_CORE_V78_MODE, method, path, writeContext: false, measurementV213: true }, next);
    }
    try { if (await prepareManualHumanRequest(req)) return next(); }
    catch (error) { return res.status(error.statusCode === 401 ? 401 : 423).json({ error: 'manual_authorization_denied' }); }
    if (isExactEcAuthLoginV78Request({ method, path: requestPath })) {
        return runtimeContext.run({
            profile: EC_BOT_CORE_V78_MODE,
            method,
            path: requestPath,
            writeContext: false,
            authLoginV78: true,
            startedAt: new Date().toISOString()
        }, () => next());
    }
    const baseDecision = ecBotCoreV78RouteDecision({ method, path, env });
    const panelDecision = baseDecision.allowed
        ? Object.freeze({ allowed: false, reason: 'ec_panel_v115_not_needed' })
        : ecPanelRuntimeRecoveryV115RouteDecision({ method, path, env });
    const manualDropiDecision = baseDecision.allowed || panelDecision.allowed
        ? Object.freeze({ allowed: false, reason: 'ec_manual_dropi_v119_not_needed' })
        : ecManualDropiReleaseV129RouteDecision({ method, path, env });
    const multiproductDecision = baseDecision.allowed || panelDecision.allowed || manualDropiDecision.allowed
        ? Object.freeze({ allowed: false, reason: 'ec_multiproduct_v120_not_needed' })
        : ecMultiproductManualReleaseV120RouteDecision({ method, path, env });
    const customerPersistenceDecision = baseDecision.allowed || panelDecision.allowed
        || manualDropiDecision.allowed || multiproductDecision.allowed
        ? Object.freeze({ allowed: false, reason: 'ec_panel_customer_v122_not_needed', operation: '' })
        : ecPanelCustomerPersistenceV122RouteDecision({ method, path, env });
    const panelStatusInternalLocal = isEcPanelStatusV177StrictLocalRequest(req);
    const panelStatusDecision = ecPanelStatusV177RouteDecision({
        method,
        path,
        body: req.body || {},
        internalLocal: panelStatusInternalLocal,
        env
    });
    const decision = baseDecision.allowed
        ? baseDecision
        : panelDecision.allowed
            ? panelDecision
            : manualDropiDecision.allowed
                ? manualDropiDecision
                : multiproductDecision.allowed
                    ? multiproductDecision
                    : customerPersistenceDecision.allowed
                        ? customerPersistenceDecision
                        : panelStatusDecision;
    if (!decision.allowed) {
        qaLogV78(qaObservation, 'QA_PIPELINE_RETURN', { claimReached: false, reason: 'route_guard_rejected' });
        return httpBlocked(res, decision.reason, method, path);
    }

    const writeContext = (
        method === 'POST'
        && [
            'bot_core_route_allowed',
            'ec_panel_v115_route_allowed',
            'ec_manual_dropi_v119_route_allowed',
            'ec_multiproduct_v120_route_allowed'
        ].includes(decision.reason)
    ) || (
        decision.reason === 'ec_panel_customer_v122_route_allowed'
        && ['POST', 'PATCH'].includes(method)
    ) || (
        decision.reason === 'ec_panel_status_v177_route_allowed'
        && ['POST', 'PATCH'].includes(method)
    );
    qaLogV78(qaObservation, 'QA_PIPELINE_ALLOWED', { writeContext });
    return runtimeContext.run({
        profile: EC_BOT_CORE_V78_MODE,
        method,
        path,
        writeContext,
        manualDropiV119: decision.reason === 'ec_manual_dropi_v119_route_allowed',
        manualDropiOperation: decision.operation || '',
        panelContactV120: decision.reason === 'ec_multiproduct_v120_route_allowed',
        panelCustomerPersistenceV122: decision.reason === 'ec_panel_customer_v122_route_allowed',
        panelCustomerPersistenceOperation: decision.reason === 'ec_panel_customer_v122_route_allowed'
            ? decision.operation || ''
            : '',
        panelStatusRouteV177: panelStatusDecision.allowed,
        panelStatusCandidateOperationV177: panelStatusDecision.operation || '',
        panelStatusV177: panelStatusDecision.operation === 'internal-admin-status-sync',
        panelStatusOperationV177: panelStatusDecision.operation === 'internal-admin-status-sync'
            ? panelStatusDecision.operation
            : '',
        panelStatusActorIdV177: panelStatusDecision.operation === 'internal-admin-status-sync'
            ? 'internal-local-admin-panel'
            : '',
        panelStatusTargetV177: panelStatusDecision.operation === 'internal-admin-status-sync'
            ? ecPanelStatusV177Target({ path, body: req.body || {}, params: req.params || {} })
            : '',
        panelStatusBodyV177: panelStatusDecision.allowed ? req.body || {} : {},
        panelStatusHumanAuthenticatedV177: false,
        panelStatusInternalLocalV177: panelStatusDecision.operation === 'internal-admin-status-sync'
            && panelStatusInternalLocal,
        startedAt: new Date().toISOString()
    }, async () => {
        let qaClaim = Object.freeze({ applicable: false, allowed: true, reason: 'not_zapi_inbound' });
        if (writeContext && ['/api/zapi/webhook', '/api/zapi/webhook/received'].includes(path)) {
            try {
                if (zapiPhoneFromPayloadV78(req.body || {}) === EC_QA_TEST_PHONE_V78
                    && isEcQaInboundMessagePayloadV111(req.body || {})) {
                    req.ecQaInboundClaimDeferredV78 = true;
                    req.ecQaInboundPolicyV90 = Object.freeze({
                        persistenceAllowed: true, automationAllowed: false,
                        reason: 'qa_claim_pending_persistence',
                        messageId: zapiMessageIdFromPayloadV78(req.body || {})
                    });
                } else {
                    qaClaim = await claimEcQaInboundContextV78({
                        payload: req.body || {},
                        allowQaFollowUp: true
                    });
                }
            } catch (error) {
                return httpBlocked(res, `qa_context_preflight_failed:${error.message}`, method, path);
            }
            if (qaClaim.applicable && !qaClaim.allowed) {
                if (qaClaim.persistenceAllowed === true && qaClaim.automationAllowed === false) {
                    req.ecQaInboundPolicyV90 = Object.freeze({
                        persistenceAllowed: true,
                        automationAllowed: false,
                        reason: qaClaim.reason,
                        messageId: qaClaim.messageId
                    });
                } else {
                    return res.status(202).json({
                        ok: true,
                        accepted: true,
                        ignored: true,
                        reason: qaClaim.reason,
                        code: 'EC_QA_CONTEXT_NOT_AUTHORIZED'
                    });
                }
            }
            if (qaClaim.applicable && qaClaim.allowed) {
                req.ecQaInboundPolicyV90 = Object.freeze({
                    persistenceAllowed: true,
                    automationAllowed: true,
                    reason: qaClaim.reason,
                    messageId: qaClaim.messageId
                });
                res.once('finish', () => {
                    runtimeContext.run({
                        profile: EC_BOT_CORE_V78_MODE,
                        method,
                        path,
                        writeContext: true,
                        qaFinalization: true
                    }, () => finalizeEcQaInboundContextV78({
                        claim: qaClaim,
                        statusCode: res.statusCode
                    }).catch((error) => console.error('[EC-BOT-CORE-V78] falha ao finalizar contexto QA:', error.message)));
                });
            }
        }
        return next();
    });
};

export const assertEcBotCoreExternalEffectAllowedV78 = (effect, env = process.env) => {
    if (integrationScopeV254()) { if (integrationExternalAllowedV254(effect)) return true; throw new Error('integration_external_effect_denied'); }
    if (isAutomaticDropiContextV252()) {
        if (automaticDropiExternalAllowedV252(effect)) return true;
        throw new Error('automatic_dropi_external_effect_denied');
    }
    if (currentEcBotCoreRuntimeContextV78()?.burstV228?.finalizeOnly || currentEcBotCoreRuntimeContextV78()?.burstV228?.claimOnly) throw new Error('burst_finalize_only_no_external_effect');
    if (currentEcBotCoreRuntimeContextV78()?.b01V216 && effect !== 'zapi_outbound_reply') throw new Error('b01_external_effect_denied');
    if (giraRuntimePolicy.external(effect) && (!ecBotCoreV78Requested(env) || resolveEcBotCoreV78Configuration(env).ready)) return true;
    if (manualExternalAllowed(effect)
        && (!ecBotCoreV78Requested(env) || resolveEcBotCoreV78Configuration(env).ready)) return true;
    if (!ecBotCoreV78Requested(env)) return true;
    const decision = ecBotCoreV78ExternalEffectDecision(effect, env);
    const context = currentEcBotCoreRuntimeContextV78();
    if (!decision.allowed || !context?.writeContext) {
        const error = new Error(!decision.allowed ? decision.reason : 'bot_core_write_context_required');
        error.code = EC_BOT_CORE_V78_OPERATION_BLOCKED;
        error.statusCode = 423;
        throw error;
    }
    return true;
};

export const isEcManualDropiExternalEffectAllowedV119 = (effect, env = process.env) => (
    integrationExternalAllowedV254(effect) || automaticDropiExternalAllowedV252(effect) ||
    ecManualDropiReleaseV119ExternalEffectAllowed({
        effect,
        context: currentEcBotCoreRuntimeContextV78(),
        env
    })
);

const MONGO_PATCH = Symbol.for('vitalismen.ecBotCoreMongoGuard.v78');
const MONGO_MUTATIONS = [
    'insertOne', 'insertMany', 'bulkWrite', 'updateOne', 'updateMany', 'replaceOne',
    'findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete', 'deleteOne', 'deleteMany',
    'createIndex', 'createIndexes', 'dropIndex', 'dropIndexes', 'drop', 'rename'
];

// V153 restores only the Mongo writes that are intrinsic to an already
// authorized operational surface.  This intentionally does not add a new HTTP
// route or a generic collection allowlist: each tuple is exact and remains
// dependent on the V78 profile and AsyncLocalStorage write context.
export const ecBotCoreMongoMutationRecoveryV153Allowed = ({
    context = null,
    collection = '',
    method = ''
} = {}) => {
    if (context?.profile !== EC_BOT_CORE_V78_MODE || context?.writeContext !== true) return false;
    if (context?.postSaleV270 === true && context.method === 'POST'
        && context.path === POST_SALE_V270_CYCLE_PATH && context.postSaleV270Mode === 'run'
        && globalThis.__VITALISMEN_SEALED_SUCCESSOR_CONTEXT?.commit === process.env.POST_SALE_V270_COMMIT) {
        const allowed = {
            shipments: ['updateOne', 'findOneAndUpdate'],
            messages: ['insertOne', 'updateOne'],
            outbounddedupes: ['insertOne', 'updateOne', 'findOneAndUpdate'],
            post_sale_dispatch_quotas: ['insertOne', 'updateOne', 'findOneAndUpdate'],
            contactstates: ['updateOne']
        };
        return Boolean(allowed[clean(collection).toLowerCase()]?.includes(clean(method)));
    }
    if (linkedDeviceOrderWriteAllowed({ context, collection, method })) return true;
    const route = clean(context.path).split('?')[0].replace(/\/+$/, '') || '/';
    const normalizedCollection = clean(collection).toLowerCase();
    const normalizedMethod = clean(method);
    if (
        context.method === 'POST'
        && ['/api/zapi/webhook', '/api/zapi/webhook/received'].includes(route)
        && normalizedCollection === 'orders'
        && ['insertOne', 'updateOne'].includes(normalizedMethod)
    ) return true;
    if (
        context.method === 'POST'
        && ['/api/whatsapp/vsl-stage', '/api/whatsapp/vsl-entry'].includes(route)
        && normalizedCollection === 'sellerrotationcounters'
        && normalizedMethod === 'findOneAndUpdate'
    ) return true;
    return Boolean(
        context.panelCustomerPersistenceV122 === true
        && context.panelCustomerPersistenceOperation === 'authenticated-customer-state-persist'
        && normalizedCollection === 'messages'
        && normalizedMethod === 'insertOne'
    );
};

const patchMongoPrototype = (prototype) => {
    if (!prototype || prototype[MONGO_PATCH]) return 0;
    let patched = 0;
    for (const method of MONGO_MUTATIONS) {
        const original = prototype[method];
        if (typeof original !== 'function') continue;
        Object.defineProperty(prototype, method, {
            configurable: true,
            writable: true,
            value: function ecBotCoreV78MongoGuardedMutation(...args) {
                const burstScopeV228 = currentEcBotCoreRuntimeContextV78()?.burstV228;
                if (burstScopeV228 && !burstScopeV228.claimOnly && !burstScopeV228.finalizeOnly
                    && String(this?.collectionName || this?.namespace?.collection || this?.name || '').toLowerCase() === 'contactstates'
                    && method === 'updateOne' && !args[0]?._id && args[1]?.$set?.phoneDigits === burstScopeV228.phone) {
                    const alternatives = args[0]?.$or;
                    const sameTarget = Array.isArray(alternatives) && alternatives.length > 0 && alternatives.every(q =>
                        q.chatId && digits(q.chatId) === burstScopeV228.phone
                        || q.phoneDigits?.$regex === burstScopeV228.phone.slice(-10) + '$');
                    if (sameTarget) {
                        args[0] = { ...args[0], _id: burstScopeV228.contactObjectId };
                        args[2] = { ...args[2], upsert: false };
                    }
                }
                if (burstScopeV228 && !burstMongoMutationAllowedV228(burstScopeV228,
                    String(this?.collectionName || this?.namespace?.collection || this?.name || '').toLowerCase(), method, args)) {
                    throw new Error('burst_scoped_mongo_write_denied');
                }
                if (integrationScopeV254()) {
                    const name = String(this?.collectionName || this?.namespace?.collection || this?.name || '').toLowerCase();
                    if (!integrationMongoAllowedV254(name, method, args)) throw new Error('integration_scoped_mongo_write_denied');
                    return original.apply(this, args);
                }
                if (isAutomaticDropiContextV252()) {
                    const collection = String(this?.collectionName || this?.namespace?.collection || this?.name || '').toLowerCase();
                    if (!automaticDropiMongoAllowedV252(collection, method, args)) throw new Error('automatic_dropi_scoped_mongo_write_denied');
                    return original.apply(this, args);
                }
                const b01ScopeV216 = currentEcBotCoreRuntimeContextV78()?.b01V216;
                if (b01ScopeV216 && !b01MongoMutationAllowedV216(b01ScopeV216,
                    String(this?.collectionName || this?.namespace?.collection || this?.name || '').toLowerCase(), method, args)) {
                    throw new Error('b01_scoped_mongo_write_denied');
                }
                if (measurementMongoAllowedV213(this?.collectionName || this?.namespace?.collection || this?.name, method, args)
                    && (!ecBotCoreV78Requested(process.env) || resolveEcBotCoreV78Configuration(process.env).ready)) return original.apply(this, args);
                if (giraRuntimePolicy.mongo(String(this?.collectionName || this?.namespace?.collection || this?.name || '').toLowerCase(), method, args)
                    && (!ecBotCoreV78Requested(process.env) || resolveEcBotCoreV78Configuration(process.env).ready)) return original.apply(this,args);
                if (manualMongoAllowed(this?.collectionName || this?.namespace?.collection || this?.name, method, args)
                    && (!ecBotCoreV78Requested(process.env) || resolveEcBotCoreV78Configuration(process.env).ready)) {
                    return original.apply(this, args);
                }
                if (ecBotCoreV78Requested(process.env)) {
                    const configuration = resolveEcBotCoreV78Configuration(process.env);
                    const context = currentEcBotCoreRuntimeContextV78();
                    const collection = clean(this?.collectionName || this?.namespace?.collection || this?.name).toLowerCase();
                    const baseCollectionAllowed = EC_BOT_CORE_V78_MONGO_COLLECTIONS.has(collection)
                        || metaLedgerWriteV148Allowed({ collection, method, args, context, env: process.env });
                    const manualDropiCollectionAllowed = ecManualDropiReleaseV119MongoAllowed({
                        method: context?.method,
                        path: context?.path,
                        collection,
                        context,
                        env: process.env
                    });
                    const panelCustomerCollectionAllowed = ecPanelCustomerPersistenceV122MongoAllowed({
                        method: context?.method,
                        path: context?.path,
                        collection,
                        context,
                        env: process.env
                    });
                    const panelStatusCollectionAllowed = ecPanelStatusV177MongoAllowed({
                        context,
                        collection,
                        method,
                        env: process.env
                    });
                    const collectionAllowed = context?.panelStatusRouteV177 === true
                        ? panelStatusCollectionAllowed
                        : context?.panelCustomerPersistenceV122 === true
                            ? panelCustomerCollectionAllowed
                            : (baseCollectionAllowed || manualDropiCollectionAllowed);
                    const authLoginBookkeepingAllowed = context?.authLoginV78 === true
                        && isExactEcAuthLoginV78Request(context)
                        && collection === 'users'
                        && method === 'updateOne';
                    const v153RecoveryAllowed = context?.panelStatusRouteV177 === true
                        ? false
                        : ecBotCoreMongoMutationRecoveryV153Allowed({
                            context,
                            collection,
                            method
                        });
                    if (!configuration.ready || (!authLoginBookkeepingAllowed && !v153RecoveryAllowed && (
                        !context?.writeContext || !collectionAllowed
                    ))) {
                        const error = new Error(`ec_bot_core_mongo_write_blocked:${collection || 'unknown'}.${method}`);
                        error.code = EC_BOT_CORE_V78_OPERATION_BLOCKED;
                        error.statusCode = 423;
                        throw error;
                    }
                }
                return original.apply(this, args);
            }
        });
        patched += 1;
    }
    Object.defineProperty(prototype, MONGO_PATCH, { configurable: false, value: true });
    return patched;
};

export const installEcBotCoreMongooseGuardV78 = (mongooseInstance) => {
    if (!mongooseInstance) throw new Error('mongoose_required_for_ec_bot_core_guard');
    const prototypes = new Set([
        mongooseInstance.Collection?.prototype,
        mongooseInstance.mongo?.Collection?.prototype
    ].filter(Boolean));
    let patchedMethods = 0;
    for (const prototype of prototypes) patchedMethods += patchMongoPrototype(prototype);
    if (!prototypes.size) throw new Error('mongoose_collection_prototype_missing');
    return Object.freeze({ installed: true, patchedMethods });
};

export const decorateEcBotCoreHealthPayloadV78 = (payload = {}, env = process.env) => {
    const configuration = resolveEcBotCoreV78Configuration(env);
    const linkedDeviceSelected = ecBaileysTextMode(env);
    if (!configuration.enabled) return payload;
    if (!configuration.ready) {
        return {
            ...payload,
            status: 'degraded',
            degradedReasons: [...new Set([...(payload.degradedReasons || []), 'ec_bot_core_profile_invalid'])]
        };
    }
    return {
        ...payload,
        automationSafety: {
            ...(payload.automationSafety || {}),
            operationalMutationsEnabled: false,
            botCoreOperational: true,
            mode: EC_BOT_CORE_V78_MODE,
            policy: EC_BOT_CORE_V78_MODE,
            strictReadOnly: false,
            allowedWriteClasses: EC_BOT_CORE_V78_ALLOWED_WRITE_CLASSES,
            zapiInboundPersistenceAllowed: true,
            zapiAckPersistenceAllowed: true,
            baileysEnabled: linkedDeviceSelected,
            mutatingRoutesEnabled: false,
            coreMutationRoutesEnabled: true,
            mutatingSchedulers: 0,
            dropiSyncMode: 'REPORT_ONLY',
            dropiApplyAllowed: false,
            metaPurchaseAllowed: false
        }
    };
};

export const ecBotCoreHealthResponseDecoratorV78 = (req, res, next) => {
    if (!ecBotCoreV78Requested(process.env)) return next();
    const path = String(req.originalUrl || req.path || req.url || '').split('?')[0].replace(/\/+$/, '') || '/';
    if (!['/api/health', '/health'].includes(path) || String(req.method || '').toUpperCase() !== 'GET') return next();
    const originalJson = res.json.bind(res);
    res.json = (payload) => originalJson(decorateEcBotCoreHealthPayloadV78(payload, process.env));
    return next();
};

// Narrow persisted-job context. Existing V78 policy/collection/effect decisions remain mandatory.
export async function runPersistedB01V216({ contactId, manualActor = null }, work) {
    const policy = globalThis.__VITALISMEN_EC_B01_V216?.readPolicy?.();
    if (!policy?.enabled || !resolveEcBotCoreV78Configuration(process.env).ready) throw new Error('b01_policy_not_active');
    const { default: Contact } = await import('../models/ContactState.js');
    const { default: Messages } = await import('../models/Message.js');
    const state = await Contact.findById(contactId).lean();
    if (!state || !/^(?:593[2-79]\d{8}|5515998038637)$/.test(state.phoneDigits)) throw new Error('b01_contact_scope');
    const route = currentEcBotCoreRuntimeContextV78();
    if (manualActor) {
        if (!route?.b01AuthenticatedCandidateV216 || route.method !== 'POST' || !/^[a-f0-9]{24}$/i.test(String(manualActor._id || '')) || manualActor.isActive !== true || !['admin', 'operator'].includes(manualActor.role))
            throw new Error('b01_authenticated_operator_required');
    } else if (!state.vitPowerB01 || state.vitPowerB01.version !== 'vit-power-b01-v216') throw new Error('b01_persisted_job_required');
    const job = state.vitPowerB01;
    const inbound = await Messages.findOne({ peerPhone: state.phoneDigits, provider: 'zapi', sessionId: 'zapi', isFromMe: false,
        ...(manualActor ? {} : { $or: [{ _id: job.inboundId }, { providerMessageId: job.inboundId }] }) }).select('_id').lean();
    if (!inbound) throw new Error('b01_persisted_inbound_required');
    const scope = { contactId: String(state._id), phone: state.phoneDigits, chatId: state.chatId,
        messages: new Set(), keys: new Set((job?.steps || []).map(s => s.ledgerKey).filter(Boolean)) };
    return runtimeContext.run({ profile: EC_BOT_CORE_V78_MODE, method: 'B01', path: '/internal/vitpower-b01-v216',
        writeContext: true, b01V216: scope }, async () => await work());
}
export function b01MongoMutationAllowedV216(scope, collection, method, args) {
    if (!scope || !['insertOne', 'updateOne', 'updateMany', 'findOneAndUpdate', 'findAndModify', 'deleteOne'].includes(method)) return false;
    const query = args[0] || {}, update = args[1] || {}, doc = method === 'insertOne' ? query : { ...update.$setOnInsert, ...update.$set };
    if (collection === 'contactstates') {
        if (!['updateOne', 'findOneAndUpdate', 'findAndModify'].includes(method)) return false;
        const exact = q => String(q._id || '') === scope.contactId || q.phoneDigits === scope.phone || q.chatId === scope.chatId
            || q.phoneDigits?.$regex === scope.phone + '$';
        return exact(query) || Array.isArray(query.$or) && query.$or.length > 0 && query.$or.every(exact);
    }
    if (collection === 'messages') {
        if (method === 'deleteOne' || method === 'updateMany') return false;
        if (doc.peerPhone === scope.phone && doc.isFromMe === true && doc.sessionId === 'zapi') {
            if (query._id) scope.messages.add(String(query._id));
            if (doc._id) scope.messages.add(String(doc._id));
            return true;
        }
        return scope.messages.has(String(query._id || ''));
    }
    if (collection === 'outbounddedupes') {
        if (method === 'insertOne' && doc.phoneDigits === scope.phone) { scope.keys.add(doc.key); return true; }
        const keys = typeof query.key === 'string' ? [query.key] : query.key?.$in || [];
        return keys.length > 0 && keys.every(k => scope.keys.has(k) || k.startsWith(scope.phone + ':'));
    }
    return false;
}

// A delayed reply receives authority only from a locked job and exact provider inputs.
export async function runPersistedBurstV228({ contactId, token, finalizeOnly = false, claimOnly = false }, work) {
    const policy = globalThis.__VITALISMEN_EC_BURST_V228?.readPolicy?.();
    if (!policy?.enabled || !resolveEcBotCoreV78Configuration(process.env).ready) throw Error('burst_policy_not_active');
    const { default: Contact } = await import('../models/ContactState.js');
    const { default: Messages } = await import('../models/Message.js');
    const state = await Contact.findById(contactId).lean(), job = state?.vitPowerBurstV228;
    if (!state || !/^(?:593[2-79]\d{8}|5515998038637)$/.test(state.phoneDigits)
        || !job || job.version !== BURST_VERSION_V228 || job.status !== (claimOnly ? 'pending' : 'processing') || !claimOnly && job.lockToken !== token
        || !(claimOnly ? job.pendingIds : job.lockedIds)?.length || (claimOnly ? job.pendingIds : job.lockedIds).length > 40 || job.phone !== state.phoneDigits) throw Error('burst_locked_job_required');
    if (!finalizeOnly && !claimOnly && +new Date(job.lockedUntil) <= Date.now()) throw Error('burst_job_lease_expired');
    const inputIds = claimOnly ? job.pendingIds : job.lockedIds;
    const rows = await Messages.find({ _id: { $in: inputIds }, peerPhone: state.phoneDigits,
        provider: 'zapi', sessionId: 'zapi', ownerPhoneDigits: '5531971862958', isFromMe: false }).lean();
    if (rows.length !== inputIds.length) throw Error('burst_exact_persisted_inputs_required');
    const scope = { contactId: String(state._id), phone: state.phoneDigits, chatId: state.chatId,
        token, finalizeOnly, claimOnly, generation: job.generation, contactObjectId: state._id, messages: new Set(), keys: new Set(), orders: new Set(), inputIds: new Set(inputIds) };
    return runtimeContext.run({ profile: EC_BOT_CORE_V78_MODE, method: 'POST', path: '/api/zapi/webhook/received',
        writeContext: true, burstV228: scope }, async () => await work());
}
export function burstMongoMutationAllowedV228(scope, collection, method, args) {
    const query = args[0] || {}, update = args[1] || {}, doc = method === 'insertOne' ? query : { ...update.$setOnInsert, ...update.$set };
    if (collection === 'contactstates' && doc.phoneDigits && doc.phoneDigits !== scope.phone) return false;
    if (scope.claimOnly) {
        const values = update.$set || {}, ids = values['vitPowerBurstV228.lockedIds'];
        return collection === 'contactstates' && ['findOneAndUpdate', 'findAndModify'].includes(method)
            && String(query._id || '') === scope.contactId && query['vitPowerBurstV228.status'] === 'pending'
            && query['vitPowerBurstV228.generation'] === scope.generation
            && values['vitPowerBurstV228.status'] === 'processing' && values['vitPowerBurstV228.lockToken'] === scope.token
            && values['vitPowerBurstV228.lockedGeneration'] === scope.generation
            && Array.isArray(ids) && ids.length === scope.inputIds.size && ids.every(id => scope.inputIds.has(id))
            && Object.keys(values).every(key => ['vitPowerBurstV228.status','vitPowerBurstV228.lockToken','vitPowerBurstV228.lockedUntil','vitPowerBurstV228.lockedIds','vitPowerBurstV228.lockedGeneration','vitPowerBurstV228.claimedAt','updatedAt'].includes(key));
    }
    if (scope.finalizeOnly) return collection === 'contactstates' && method === 'updateOne'
        && String(query._id || '') === scope.contactId && query['vitPowerBurstV228.lockToken'] === scope.token
        && Object.keys(update.$set || {}).every(key => key.startsWith('vitPowerBurstV228.') || key.startsWith('metadata.automationHandoffSuggested') || ['human.mode','human.pausedUntil','human.note','updatedAt'].includes(key));
    if (['contactstates', 'messages', 'outbounddedupes'].includes(collection))
        return b01MongoMutationAllowedV216(scope, collection, method, args);
    if (collection === 'orders') {
        if (method === 'insertOne' && doc.country === 'EC' && digits(doc.customer?.phone) === scope.phone) {
            if (doc.orderId) scope.orders.add(doc.orderId);
            // Mongoose saves the same newly inserted order by its internal _id.
            const mongoId = String(doc._id || '');
            if (/^[a-f0-9]{24}$/i.test(mongoId)) scope.orders.add('mongo:' + mongoId);
            return true;
        }
        if (typeof query.orderId === 'string' && scope.orders.has(query.orderId)) return true;
        const mongoId = String(query._id || '');
        return method === 'updateOne' && /^[a-f0-9]{24}$/i.test(mongoId)
            && scope.orders.has('mongo:' + mongoId) && args[2]?.upsert !== true
            && Object.keys(query).every(key => key === '_id' || key === '__v');
    }
    // Other collections still require their original V78 and measurement contracts below.
    return true;
}
