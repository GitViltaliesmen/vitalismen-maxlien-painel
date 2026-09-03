export const STRICT_READ_ONLY_POLICY = 'STRICT_READ_ONLY';
export const SAFE_OBSERVATION_MODE = 'SAFE_OBSERVATION_ONLY';
export const STRICT_READ_ONLY_OPERATION_BLOCKED = 'STRICT_READ_ONLY_OPERATION_BLOCKED';
export const STRICT_READ_ONLY_OBSERVATION = 'STRICT_READ_ONLY_OBSERVATION';
export const STRICT_READ_ONLY_ALLOWED_WRITE_CLASSES = Object.freeze([]);

const trueValue = (value) => String(value ?? '').trim().toLowerCase() === 'true';
const falseValue = (value) => String(value ?? '').trim().toLowerCase() === 'false';
const present = (value) => String(value ?? '').trim() !== '';

const SAFE_RUNTIME_SIGNALS = Object.freeze([
    'VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED',
    'SAFE_OBSERVATION_POLICY',
    'VITALISMEN_STRICT_READ_ONLY',
    'DISABLE_SCHEDULER',
    'POST_SALE_V66_MUTATIONS_ENABLED',
    'DROPPI_EC_ACTIVE_SYNC_MODE'
]);

export const resolveStrictReadOnlyObservation = (env = process.env) => {
    const approval = String(env.VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED ?? '').trim().toLowerCase();
    const policy = String(env.SAFE_OBSERVATION_POLICY ?? '').trim().toUpperCase();
    const explicitStrict = String(env.VITALISMEN_STRICT_READ_ONLY ?? '').trim().toLowerCase();
    const runtimeConfigured = SAFE_RUNTIME_SIGNALS.some((key) => present(env[key]))
        || String(env.NODE_ENV || '').trim().toLowerCase() === 'production';
    const operationalApproved = approval === 'true';
    const safeObservation = runtimeConfigured && !operationalApproved;
    const strictRequested = policy === STRICT_READ_ONLY_POLICY || explicitStrict === 'true';
    const strictInvalid = present(env.VITALISMEN_STRICT_READ_ONLY)
        && !trueValue(env.VITALISMEN_STRICT_READ_ONLY)
        && !falseValue(env.VITALISMEN_STRICT_READ_ONLY);
    const policyInvalid = present(env.SAFE_OBSERVATION_POLICY)
        && policy !== STRICT_READ_ONLY_POLICY;

    // V71 fail-closed: any configured non-operational runtime is strict even
    // when the explicit strict flags are absent, invalid or ambiguous.
    const enabled = strictRequested || safeObservation;
    let reason = 'operational_mode';
    if (enabled && strictRequested) reason = 'strict_policy_configured';
    else if (enabled && (strictInvalid || policyInvalid)) reason = 'safe_observation_invalid_config_fail_closed';
    else if (enabled && safeObservation) reason = 'safe_observation_fail_closed';
    else if (!runtimeConfigured) reason = 'library_context_unconfigured';

    return Object.freeze({
        enabled,
        strictReadOnly: enabled,
        mode: enabled ? SAFE_OBSERVATION_MODE : 'OPERATIONAL',
        policy: enabled ? STRICT_READ_ONLY_POLICY : 'OPERATIONAL_WRITES_ALLOWED',
        reason,
        operationalApproved,
        safeObservation,
        runtimeConfigured,
        allowedWriteClasses: enabled ? STRICT_READ_ONLY_ALLOWED_WRITE_CLASSES : null
    });
};

export const isStrictReadOnlyObservationEnabled = (env = process.env) =>
    resolveStrictReadOnlyObservation(env).enabled;

export class StrictReadOnlyObservationError extends Error {
    constructor({ capability = 'mutation', source = 'runtime' } = {}) {
        super(`Operacao bloqueada por STRICT_READ_ONLY: ${capability}`);
        this.name = 'StrictReadOnlyObservationError';
        this.code = STRICT_READ_ONLY_OPERATION_BLOCKED;
        this.statusCode = 423;
        this.capability = capability;
        this.source = source;
    }
}

export const assertMutationAllowed = ({ capability = 'mutation', source = 'runtime', env = process.env } = {}) => {
    if (isStrictReadOnlyObservationEnabled(env)) {
        throw new StrictReadOnlyObservationError({ capability, source });
    }
    return true;
};

export const assertRouteMutationAllowed = ({ method = '', path = '', env = process.env } = {}) => {
    const normalizedMethod = String(method || '').trim().toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod)) return true;
    return assertMutationAllowed({
        capability: `${normalizedMethod || 'UNKNOWN'} ${String(path || '')}`,
        source: 'http_route',
        env
    });
};

export const assertTransportPersistenceAllowed = ({ transport = 'unknown', operation = 'persistence', env = process.env } = {}) =>
    assertMutationAllowed({ capability: `${transport}:${operation}`, source: 'transport', env });

export const strictReadOnlyAcceptedPayload = (extra = {}) => ({
    ok: true,
    accepted: true,
    ignored: true,
    reason: 'strict_read_only',
    code: STRICT_READ_ONLY_OBSERVATION,
    ...extra
});

const STRICT_SAFE_NOOP_ROUTES = new Set([
    '/api/zapi/webhook',
    '/api/zapi/webhook/delivery',
    '/api/zapi/webhook/received',
    '/api/whatsapp/vsl-stage',
    '/api/whatsapp/vsl-entry'
]);

// Login remains available for the read-only dashboard; auth.js suppresses its
// lastLoginAt bookkeeping write while the policy is active.
const STRICT_READ_ONLY_LOGIN_ROUTE = '/api/auth/login';

export const strictReadOnlyRouteDecision = ({ method = '', path = '', env = process.env } = {}) => {
    const normalizedMethod = String(method || '').trim().toUpperCase();
    const normalizedPath = String(path || '').split('?')[0].replace(/\/+$/, '') || '/';
    if (!isStrictReadOnlyObservationEnabled(env) || ['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod)) {
        return Object.freeze({ allowed: true, readOnly: true, reason: 'read_or_operational' });
    }
    if (normalizedMethod === 'POST' && normalizedPath === STRICT_READ_ONLY_LOGIN_ROUTE) {
        return Object.freeze({ allowed: true, readOnly: true, reason: 'read_only_login' });
    }
    if (normalizedMethod === 'POST' && STRICT_SAFE_NOOP_ROUTES.has(normalizedPath)) {
        return Object.freeze({ allowed: true, readOnly: true, safeNoop: true, reason: 'strict_safe_noop' });
    }
    return Object.freeze({ allowed: false, readOnly: false, reason: 'strict_read_only' });
};

export const strictReadOnlyMutationRouteGuard = (req, res, next) => {
    const path = String(req.originalUrl || req.path || req.url || '').split('?')[0];
    const decision = strictReadOnlyRouteDecision({ method: req.method, path });
    if (decision.allowed) return next();
    return res.status(423).json({
        ok: false,
        error: 'strict_read_only_operation_blocked',
        code: STRICT_READ_ONLY_OPERATION_BLOCKED,
        method: String(req.method || '').toUpperCase(),
        path
    });
};

export const shouldStartBaileys = (env = process.env) =>
    !isStrictReadOnlyObservationEnabled(env)
    && String(env.WHATSAPP_CONNECT_ENABLED ?? 'true').trim().toLowerCase() !== 'false';

export const startBaileysIfAllowed = async ({
    env = process.env,
    startConfiguredSessions
} = {}) => {
    if (!shouldStartBaileys(env)) {
        return Object.freeze({ started: false, reason: isStrictReadOnlyObservationEnabled(env) ? 'strict_read_only' : 'disabled' });
    }
    if (typeof startConfiguredSessions !== 'function') throw new Error('startConfiguredSessions ausente');
    await startConfiguredSessions();
    return Object.freeze({ started: true, reason: 'operational' });
};

export const isZapiInboundRoutingEnabled = (env = process.env) =>
    !isStrictReadOnlyObservationEnabled(env)
    && trueValue(env.ZAPI_ROUTE_INBOUND_TO_BOT);

export const isZapiInboundPersistenceEnabled = (env = process.env) =>
    !isStrictReadOnlyObservationEnabled(env)
    && !falseValue(env.ZAPI_PERSIST_INBOUND_ENABLED);

export const isZapiAckPersistenceEnabled = (env = process.env) =>
    !isStrictReadOnlyObservationEnabled(env)
    && !falseValue(env.ZAPI_PERSIST_ACK_ENABLED);

export const isVslStagePersistenceEnabled = (env = process.env) =>
    !isStrictReadOnlyObservationEnabled(env)
    && !falseValue(env.VSL_STAGE_PERSIST_ENABLED);

export const strictReadOnlyMongooseConnectOptions = (env = process.env) => ({
    autoIndex: !isStrictReadOnlyObservationEnabled(env)
});

export const strictReadOnlyHealthContract = (env = process.env) => {
    const state = resolveStrictReadOnlyObservation(env);
    return Object.freeze({
        mode: state.mode,
        policy: state.policy,
        strictReadOnly: state.enabled,
        allowedWriteClasses: state.enabled ? [] : null,
        zapiReadOnlyStatusAllowed: true,
        zapiInboundPersistenceAllowed: !state.enabled && isZapiInboundPersistenceEnabled(env),
        zapiAckPersistenceAllowed: !state.enabled && isZapiAckPersistenceEnabled(env),
        baileysEnabled: shouldStartBaileys(env),
        mutatingRoutesEnabled: !state.enabled,
        dropiApplyAllowed: !state.enabled,
        mutatingSchedulers: state.enabled ? 0 : null
    });
};

export const MONGOOSE_MUTATION_METHODS = Object.freeze([
    'insertOne',
    'insertMany',
    'bulkWrite',
    'updateOne',
    'updateMany',
    'replaceOne',
    'findOneAndUpdate',
    'findOneAndReplace',
    'findOneAndDelete',
    'deleteOne',
    'deleteMany',
    'createIndex',
    'createIndexes',
    'dropIndex',
    'dropIndexes',
    'drop',
    'rename'
]);

export const MONGOOSE_CONNECTION_MUTATION_METHODS = Object.freeze([
    'createCollection',
    'dropCollection',
    'dropDatabase'
]);

const PATCH_MARKER = Symbol.for('vitalismen.strictReadOnlyMongooseGuard.v71');

const patchMutationPrototype = (prototype, envProvider, methods = MONGOOSE_MUTATION_METHODS, namespace = 'mongoose.collection') => {
    if (!prototype || prototype[PATCH_MARKER]) return 0;
    let patched = 0;
    for (const method of methods) {
        const original = prototype[method];
        if (typeof original !== 'function') continue;
        Object.defineProperty(prototype, method, {
            configurable: true,
            writable: true,
            value: function strictReadOnlyGuardedMongooseMutation(...args) {
                assertMutationAllowed({
                    capability: `${namespace}.${method}`,
                    source: this?.collectionName || this?.name || 'mongoose',
                    env: envProvider()
                });
                return original.apply(this, args);
            }
        });
        patched += 1;
    }
    Object.defineProperty(prototype, PATCH_MARKER, { configurable: false, value: true });
    return patched;
};

export const installStrictReadOnlyMongooseGuard = (mongooseInstance, { envProvider = () => process.env } = {}) => {
    if (!mongooseInstance) throw new Error('mongoose ausente para instalar STRICT_READ_ONLY');
    const prototypes = new Set([
        mongooseInstance.Collection?.prototype,
        mongooseInstance.mongo?.Collection?.prototype
    ].filter(Boolean));
    let patchedMethods = 0;
    for (const prototype of prototypes) patchedMethods += patchMutationPrototype(prototype, envProvider);
    if (!prototypes.size) throw new Error('prototype de Collection ausente para STRICT_READ_ONLY');
    patchedMethods += patchMutationPrototype(
        mongooseInstance.Connection?.prototype,
        envProvider,
        MONGOOSE_CONNECTION_MUTATION_METHODS,
        'mongoose.connection'
    );
    return Object.freeze({ installed: true, patchedMethods });
};
