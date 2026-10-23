import { createHash } from 'node:crypto';
import { createManualHumanContract, isManualRequest, MANUAL_QA_RECIPIENT, MANUAL_QA_OWNER } from './manualHumanContract.js';

export const productionManualDependencies = (modules, env = process.env) => {
    const { jwt, User, OutboundDedupe, Message, sendZapiText, zapiConfig, getZapiStatus, getZapiDevice,
        canSendOutbound, assertEcPanelManualSendV115 } = modules;
    // assignedSeller is a routing selector, never proof of the connected identity.
    const sellerSelector = String(env.ZAPI_OPERATIONAL_PHONE || env.ZAPI_CONNECTED_PHONE || env.ZAPI_OPERATION_PHONE || '').replace(/\D/g, '');
    const ownerPhoneDigits = MANUAL_QA_OWNER;
    const expectedInstanceHash = String(env.VITALISMEN_MANUAL_QA_INSTANCE_SHA256 || '');
    const durableWrite = { writeConcern: { w: 'majority', j: true, wtimeout: 5000 } };
    return {
        ownerPhoneDigits,
        sessionAllowed: id => sellerSelector === '5531971862958'
            && [undefined, '', 'zapi', ownerPhoneDigits, sellerSelector].includes(id),
        async authenticate(token) {
            const claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
            if (!/^[a-f0-9]{24}$/i.test(claims?.id || '') || !Number.isFinite(claims.exp)) return null;
            const user = await User.findById(claims.id).select('_id role isActive').lean();
            if (!user || user.isActive !== true || !['admin', 'operator'].includes(user.role)) return null;
            return { id: String(user._id), role: user.role, isActive: true, expiresAt: claims.exp * 1000 };
        },
        async validateRecipient(phone, actor, text) {
            if (phone !== MANUAL_QA_RECIPIENT || sellerSelector !== '5531971862958') return false;
            assertEcPanelManualSendV115({ sendMode: 'manual_panel' });
            const cfg = zapiConfig();
            if (!cfg.enabled || typeof cfg.instanceId !== 'string' || !/^[a-f0-9]{64}$/.test(expectedInstanceHash)
                || createHash('sha256').update(cfg.instanceId).digest('hex') !== expectedInstanceHash) return false;
            const policy = canSendOutbound({ jid: `${phone}@s.whatsapp.net`, recipientDigits: phone,
                sessionId: sellerSelector, ownDigits: ownerPhoneDigits, text, kind: 'text',
                bypassDedupe: false, reserveDedupe: false });
            if (!policy.allowed) return false;
            // Authenticated API GETs independently verify this outbound channel.
            // They are not webhook provenance and never authorize inbound/ACK.
            const status = await getZapiStatus();
            if (status?.connected !== true) return false;
            const device = await getZapiDevice();
            return String(device?.phone || '').replace(/\D/g, '') === ownerPhoneDigits;
        },
        async indexesReady() {
            const indexes = await OutboundDedupe.collection.indexes();
            const exact = (key, expected) => JSON.stringify(key) === JSON.stringify(expected);
            return indexes.some(x => x.unique === true && !x.sparse && !x.partialFilterExpression && exact(x.key, { key: 1 }))
                && indexes.some(x => x.unique === true && !x.sparse && !x.partialFilterExpression
                    && exact(x.key, { phoneDigits: 1, kind: 1, fingerprint: 1 }));
        },
        async reserve(doc) {
            const rows = await OutboundDedupe.create([doc], durableWrite);
            // Mixed history from older runtimes must not be retried implicitly.
            if (!Array.isArray(rows) || rows.length !== 1) throw Error('manual_reservation_unconfirmed');
            return rows;
        },
        findReservation: async (key, phoneDigits, fingerprint) => OutboundDedupe.findOne({
            $or: [{ key }, { phoneDigits, kind: 'text', fingerprint }]
        }).lean(),
        async finalize(filter, update) {
            const result = await OutboundDedupe.updateOne(filter, update, durableWrite);
            return result.acknowledged === true && result.matchedCount === 1;
        },
        recordHistory: doc => Message.create([doc], durableWrite),
        historyExists: async (id, actor, phone, actionId) => Boolean(await Message.findOne({
            _id: id, attendantId: actor, peerPhone: phone, clientGeneratedId: actionId, senderRole: 'human'
        }).select('_id').lean()),
        // Existing provider function, endpoint, credentials, timeout and canary checks remain unchanged.
        sendText: payload => sendZapiText(payload)
    };
};

let contract;
let loading;
export const manualQaProfileAllowed = (env = process.env) =>
    env.VITALISMEN_MANUAL_CONTRACT_APPROVED === 'true'
    && env.VITALISMEN_STRICT_READ_ONLY === 'true'
    && env.SAFE_OBSERVATION_POLICY === 'STRICT_READ_ONLY'
    && env.DISABLE_SCHEDULER === '1'
    && /^[a-f0-9]{64}$/.test(String(env.VITALISMEN_MANUAL_QA_INSTANCE_SHA256 || ''))
    && ['VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED', 'VIT_POWER_FUNNEL_ACTIVE',
        'WHATSAPP_AUTO_REPLY_ENABLED', 'WHATSAPP_FUNNEL_ENABLED', 'ZAPI_ROUTE_INBOUND_TO_BOT',
        'ZAPI_PERSIST_INBOUND_ENABLED', 'ZAPI_PERSIST_ACK_ENABLED', 'SERVER_FUNNEL_ENABLED',
        'AI_WORKER_ENABLED', 'SHIPMENT_STATUS_DISPATCH_ENABLED', 'SHIPMENT_PICKUP_REMINDERS_ENABLED',
        'PICKUP_PROOF_SWEEP_ENABLED'].every(key => env[key] === 'false');
const enabled = () => manualQaProfileAllowed();
const loadContract = async () => {
    if (!loading) loading = (async () => {
        const [jwt, user, dedupe, message, zapi, outbound, panel] = await Promise.all([
            import('jsonwebtoken'), import('../models/User.js'),
            import('../models/OutboundDedupe.js'), import('../models/Message.js'), import('./zapiClient.js'),
            import('../whatsapp/outboundGuard.js'), import('./ecPanelRuntimeRecoveryV115Service.js')
        ]);
        contract = createManualHumanContract(productionManualDependencies({ jwt: jwt.default, User: user.default,
            OutboundDedupe: dedupe.default, Message: message.default,
            sendZapiText: zapi.sendZapiText, zapiConfig: zapi.zapiConfig,
            getZapiStatus: zapi.getZapiStatus, getZapiDevice: zapi.getZapiDevice,
            canSendOutbound: outbound.canSendOutbound, assertEcPanelManualSendV115: panel.assertEcPanelManualSendV115 }));
        return contract;
    })().catch(error => { loading = undefined; throw error; });
    return loading;
};
export const prepareManualHumanRequest = async req => {
    if (!enabled() || !isManualRequest(req)) return false;
    return (await loadContract()).prepare(req);
};
export const hasManualHumanRequest = req => enabled() && contract?.hasGrant(req) === true;
export const executeManualHumanRequest = (req, res) => contract.execute(req, res);
export const manualMongoAllowed = (collection, method, args) => enabled() && contract?.mongoAllowed(collection, method, args) === true;
export const manualExternalAllowed = effect => enabled() && contract?.externalAllowed(effect) === true;
export const manualTransportAllowed = (transport, operation) => enabled() && contract?.transportAllowed(transport, operation) === true;
