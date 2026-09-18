export const EC_PANEL_STATUS_V177_VERSION = 177;
export const EC_PANEL_STATUS_V177_MODE = 'EC_PANEL_STATUS_OPERATIONS_V177';
export const EC_PANEL_STATUS_V177_QA_PHONE = '5515998038637';

export const EC_PANEL_STATUS_V177_STATUSES = Object.freeze([
    'novo',
    'atendendo',
    'comprar_depois',
    'confirmado',
    'pedido_enviado',
    'entregue',
    'recompra',
    'cancelado',
    'devolvido'
]);

const clean = (value = '') => String(value ?? '').trim();
const normalizedPath = (value = '') => clean(value).split('?')[0].replace(/\/+$/, '') || '/';
const normalizedStatus = (value = '') => clean(value).toLowerCase().replace(/-/g, '_');
const isTrue = (value) => clean(value).toLowerCase() === 'true';
const loopback = (value = '') => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clean(value));

export const resolveEcPanelStatusV177Configuration = (env = process.env) => {
    const enabled = isTrue(env.VITALISMEN_EC_BOT_CORE_OPERATIONAL);
    const failures = [];
    if (enabled && clean(env.PANEL_AUTH_DISABLED).toLowerCase() !== 'false') {
        failures.push('PANEL_AUTH_DISABLED_must_be_false');
    }
    return Object.freeze({
        enabled,
        ready: enabled && failures.length === 0,
        mode: enabled ? EC_PANEL_STATUS_V177_MODE : '',
        failures
    });
};

export const ecPanelStatusV177StatusPlan = (status = '') => {
    const value = normalizedStatus(status);
    if (!EC_PANEL_STATUS_V177_STATUSES.includes(value)) {
        return Object.freeze({ allowed: false, status: value, operation: '', orderWrite: false });
    }
    const operation = value === 'confirmado'
        ? 'confirm-order'
        : value === 'recompra'
            ? 'repurchase-new-cycle'
            : 'contact-state-status';
    return Object.freeze({
        allowed: true,
        status: value,
        operation,
        orderWrite: ['confirm-order', 'repurchase-new-cycle'].includes(operation)
    });
};

export const ecPanelStatusV177Operation = ({ method = '', path = '', body = {} } = {}) => {
    const verb = clean(method).toUpperCase();
    const route = normalizedPath(path);
    if (verb === 'POST' && route === '/api/whatsapp/chats/action') return 'chat-action';
    if (verb === 'POST' && route === '/api/whatsapp/chats/bucket') return 'chat-bucket';
    if (verb === 'POST' && route === '/api/whatsapp/internal/admin-status-sync') return 'internal-admin-status-sync';
    if (verb === 'POST' && /^\/api\/whatsapp\/contact-state\/[^/]+\/identity-conflict$/.test(route)) {
        return 'identity-conflict';
    }
    if (verb === 'PATCH' && /^\/api\/whatsapp\/contact-state\/[^/]+$/.test(route)) {
        const plan = ecPanelStatusV177StatusPlan(body?.customerDraft?.status);
        return plan.orderWrite ? plan.operation : '';
    }
    return '';
};

export const ecPanelStatusV177RouteDecision = ({
    method = '',
    path = '',
    body = {},
    internalLocal = false,
    env = process.env
} = {}) => {
    const configuration = resolveEcPanelStatusV177Configuration(env);
    if (!configuration.enabled) {
        return Object.freeze({ enforced: false, allowed: false, reason: 'ec_panel_status_v177_not_requested', operation: '' });
    }
    if (!configuration.ready) {
        return Object.freeze({ enforced: true, allowed: false, reason: 'ec_panel_status_v177_invalid_fail_closed', operation: '' });
    }
    const operation = ecPanelStatusV177Operation({ method, path, body });
    if (!operation) {
        return Object.freeze({ enforced: true, allowed: false, reason: 'ec_panel_status_v177_route_blocked', operation: '' });
    }
    if (operation === 'internal-admin-status-sync' && internalLocal !== true) {
        return Object.freeze({ enforced: true, allowed: false, reason: 'ec_panel_status_v177_internal_local_required', operation });
    }
    return Object.freeze({ enforced: true, allowed: true, reason: 'ec_panel_status_v177_route_allowed', operation });
};

export const isEcPanelStatusV177StrictLocalRequest = (req = {}) => {
    const host = clean(req.hostname || req.headers?.host).split(':')[0].replace(/^\[|\]$/g, '');
    const requestIp = clean(req.ip || req.socket?.remoteAddress);
    const socketIp = clean(req.socket?.remoteAddress || req.connection?.remoteAddress);
    const forwarded = clean(req.headers?.['x-forwarded-for']);
    const realIp = clean(req.headers?.['x-real-ip']);
    const cloudflareIp = clean(req.headers?.['cf-connecting-ip']);
    const forwardedIps = forwarded.split(',').map((value) => value.trim()).filter(Boolean);
    return ['localhost', '127.0.0.1', '::1'].includes(host)
        && loopback(requestIp)
        && loopback(socketIp)
        && !cloudflareIp
        && (!realIp || loopback(realIp))
        && forwardedIps.every(loopback);
};

export const ecPanelStatusV177Actor = (user = null) => {
    const actorId = clean(user?._id || user?.id);
    const active = Boolean(actorId && actorId !== 'local-no-password' && user?.isActive !== false);
    return Object.freeze({ active, actorId: active ? actorId : '' });
};

export const ecPanelStatusV177Target = ({ path = '', body = {}, params = {} } = {}) => {
    const route = normalizedPath(path);
    const routeTarget = route.match(/^\/api\/whatsapp\/contact-state\/([^/]+)/)?.[1] || '';
    return clean(
        params.phone
        || body.phone_e164
        || body.phone
        || body.chatId
        || (routeTarget ? decodeURIComponent(routeTarget) : '')
    );
};

const V177_COLLECTION_METHODS = Object.freeze({
    'chat-action': Object.freeze({ contactstates: Object.freeze(['insertOne', 'updateOne']), messages: Object.freeze(['insertOne']) }),
    'chat-bucket': Object.freeze({ contactstates: Object.freeze(['insertOne', 'updateOne']), messages: Object.freeze(['insertOne']) }),
    'identity-conflict': Object.freeze({ contactstates: Object.freeze(['insertOne', 'updateOne']), messages: Object.freeze(['insertOne']) }),
    'internal-admin-status-sync': Object.freeze({ contactstates: Object.freeze(['insertOne', 'updateOne']), messages: Object.freeze(['insertOne']) }),
    'confirm-order': Object.freeze({
        contactstates: Object.freeze(['insertOne', 'updateOne']),
        messages: Object.freeze(['insertOne']),
        orders: Object.freeze(['insertOne', 'updateOne'])
    }),
    'repurchase-new-cycle': Object.freeze({
        contactstates: Object.freeze(['insertOne', 'updateOne']),
        messages: Object.freeze(['insertOne']),
        orders: Object.freeze(['insertOne', 'updateOne'])
    })
});

export const ecPanelStatusV177MongoAllowed = ({
    context = null,
    collection = '',
    method = '',
    env = process.env
} = {}) => {
    const configuration = resolveEcPanelStatusV177Configuration(env);
    if (!configuration.ready || context?.panelStatusV177 !== true || context?.writeContext !== true) return false;
    if (!clean(context.panelStatusActorIdV177) || !clean(context.panelStatusTargetV177)) return false;
    const operation = clean(context.panelStatusOperationV177);
    const expectedOperation = ecPanelStatusV177Operation({
        method: context.method,
        path: context.path,
        body: context.panelStatusBodyV177 || {}
    });
    if (!operation || operation !== expectedOperation) return false;
    if (operation === 'internal-admin-status-sync' && context.panelStatusInternalLocalV177 !== true) return false;
    if (operation !== 'internal-admin-status-sync' && context.panelStatusHumanAuthenticatedV177 !== true) return false;
    const collectionName = clean(collection).toLowerCase();
    return Boolean(V177_COLLECTION_METHODS[operation]?.[collectionName]?.includes(clean(method)));
};

export const EC_PANEL_STATUS_V177_EXTERNAL_EFFECT_POLICY = Object.freeze({
    dropiMode: 'REPORT_ONLY',
    dropiApplyAllowed: false,
    metaPurchaseAllowed: false,
    whatsappOutboundAllowed: false
});
