import { AsyncLocalStorage } from 'node:async_hooks';

import ContactState from '../models/ContactState.js';
import {
    EC_BOT_CORE_V78_ALLOWED_WRITE_CLASSES,
    EC_BOT_CORE_V78_MODE,
    ecBotCoreV78ExternalEffectDecision,
    ecBotCoreV78Requested,
    ecBotCoreV78RouteDecision,
    resolveEcBotCoreV78Configuration
} from './ecBotCoreOperationalV78Service.js';
import {
    EC_OFFICIAL_VSL_V78_MESSAGE,
    EC_OFFICIAL_VSL_V78_WHATSAPP,
    recognizeOfficialEcVslEntryV78
} from './ecOfficialVslEntryV78Service.js';
import {
    EC_QA_TEST_PHONE_V78,
    EC_QA_TEST_REQUIRED_TAGS_V78
} from './ecQaTestResetV78Service.js';

export const EC_BOT_CORE_V78_OPERATION_BLOCKED = 'EC_BOT_CORE_V78_OPERATION_BLOCKED';
export const EC_BOT_CORE_V78_MONGO_COLLECTIONS = Object.freeze(new Set([
    'contactstates',
    'messages',
    'outbounddedupes',
    'vslvisits',
    'metaattributioncorrelations'
]));

const runtimeContext = new AsyncLocalStorage();
const clean = (value = '') => String(value ?? '').trim();
const digits = (value = '') => clean(value).replace(/\D/g, '');

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

const exactQaQueryV78 = (now, messageId) => ({
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
    'metadata.qaTestContextV78.routingMessageId': { $ne: messageId }
});

export const claimEcQaInboundContextV78 = async ({
    payload = {},
    model = ContactState,
    now = new Date()
} = {}) => {
    const phone = zapiPhoneFromPayloadV78(payload);
    if (phone !== EC_QA_TEST_PHONE_V78) {
        return Object.freeze({ applicable: false, allowed: true, phone, reason: 'not_exact_qa_phone' });
    }
    const text = zapiTextFromPayloadV78(payload);
    const messageId = zapiMessageIdFromPayloadV78(payload);
    if (!messageId) return Object.freeze({ applicable: true, allowed: false, phone, reason: 'qa_provider_message_id_required' });
    const recognition = recognizeOfficialEcVslEntryV78({
        text,
        destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP
    });
    if (!recognition.recognized) {
        return Object.freeze({ applicable: true, allowed: false, phone, messageId, reason: recognition.reason });
    }
    const result = await model.updateOne(exactQaQueryV78(now, messageId), {
        $set: {
            'metadata.qaTestContextV78.status': 'routing',
            'metadata.qaTestContextV78.routingAt': now.toISOString(),
            'metadata.qaTestContextV78.routingMessageId': messageId,
            'metadata.qaTestContextV78.routingSignature': EC_OFFICIAL_VSL_V78_MESSAGE
        }
    });
    if (Number(result?.modifiedCount || 0) !== 1) {
        return Object.freeze({
            applicable: true,
            allowed: false,
            persistenceAllowed: true,
            automationAllowed: false,
            phone,
            messageId,
            reason: 'qa_dashboard_persistence_only'
        });
    }
    return Object.freeze({
        applicable: true,
        allowed: true,
        persistenceAllowed: true,
        automationAllowed: true,
        phone,
        messageId,
        reason: 'qa_context_claimed'
    });
};

export const finalizeEcQaInboundContextV78 = async ({
    claim = {},
    model = ContactState,
    statusCode = 500,
    now = new Date()
} = {}) => {
    if (!claim.applicable || !claim.allowed || !claim.messageId) return Object.freeze({ changed: false });
    const result = await model.updateOne({
        phoneDigits: EC_QA_TEST_PHONE_V78,
        'metadata.qaTestContextV78.status': 'routing',
        'metadata.qaTestContextV78.routingMessageId': claim.messageId
    }, {
        $set: {
            'metadata.qaTestContextV78.status': 'consumed',
            'metadata.qaTestContextV78.consumedAt': now.toISOString(),
            'metadata.qaTestContextV78.consumedMessageId': claim.messageId,
            'metadata.qaTestContextV78.httpStatus': Number(statusCode || 0)
        }
    });
    return Object.freeze({ changed: Number(result?.modifiedCount || 0) === 1 });
};

export const currentEcBotCoreRuntimeContextV78 = () => runtimeContext.getStore() || null;

export const ecBotCoreMutationRouteGuardV78 = async (req, res, next) => {
    const env = process.env;
    if (!ecBotCoreV78Requested(env)) return next();
    const path = String(req.originalUrl || req.path || req.url || '').split('?')[0].replace(/\/+$/, '') || '/';
    const method = String(req.method || '').trim().toUpperCase();
    const configuration = resolveEcBotCoreV78Configuration(env);
    if (!configuration.ready) return httpBlocked(res, 'bot_core_invalid_fail_closed', method, path);
    const decision = ecBotCoreV78RouteDecision({ method, path, env });
    if (!decision.allowed) return httpBlocked(res, decision.reason, method, path);

    const writeContext = method === 'POST' && decision.reason === 'bot_core_route_allowed';
    return runtimeContext.run({
        profile: EC_BOT_CORE_V78_MODE,
        method,
        path,
        writeContext,
        startedAt: new Date().toISOString()
    }, async () => {
        let qaClaim = Object.freeze({ applicable: false, allowed: true, reason: 'not_zapi_inbound' });
        if (writeContext && ['/api/zapi/webhook', '/api/zapi/webhook/received'].includes(path)) {
            try {
                qaClaim = await claimEcQaInboundContextV78({ payload: req.body || {} });
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

const MONGO_PATCH = Symbol.for('vitalismen.ecBotCoreMongoGuard.v78');
const MONGO_MUTATIONS = [
    'insertOne', 'insertMany', 'bulkWrite', 'updateOne', 'updateMany', 'replaceOne',
    'findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete', 'deleteOne', 'deleteMany',
    'createIndex', 'createIndexes', 'dropIndex', 'dropIndexes', 'drop', 'rename'
];

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
                if (ecBotCoreV78Requested(process.env)) {
                    const configuration = resolveEcBotCoreV78Configuration(process.env);
                    const context = currentEcBotCoreRuntimeContextV78();
                    const collection = clean(this?.collectionName || this?.namespace?.collection || this?.name).toLowerCase();
                    if (!configuration.ready || !context?.writeContext || !EC_BOT_CORE_V78_MONGO_COLLECTIONS.has(collection)) {
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
            baileysEnabled: false,
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
