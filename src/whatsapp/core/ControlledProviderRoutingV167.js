import crypto from 'node:crypto';

export const V167_CONTROLLED_PHONE = '5515998038637';
export const V167_WEB_CHANNEL = 'V152_TEST_WEB_01';
export const V167_WEB_IDENTITY = '5531983002800';
export const V167_ROUTING_PURPOSE = 'V167_CONTROLLED_PROVIDER_ROUTING';
export const V167_PROVIDER = Object.freeze({
    WEB: 'whatsapp_web',
    ZAPI: 'zapi',
    BLOCKED: 'blocked'
});
export const V167_SEND_STATES = Object.freeze(['INTENDED', 'SENT', 'ACKED', 'AMBIGUOUS']);

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const digits = (value) => String(value || '').replace(/\D/g, '');
const clean = (value) => String(value || '').trim();
const isTerminalOrReserved = (state) => V167_SEND_STATES.includes(String(state || '').toUpperCase());

export const v167WebWorkerReady = (worker = {}) => worker.processName === 'vitalismen-whatsapp-web-shadow-v164'
    && worker.active === true
    && worker.health === 'PASS'
    && worker.sessionNamespace === V167_WEB_CHANNEL
    && worker.pairedIdentity === V167_WEB_IDENTITY
    && worker.sessionState === 'RESTORED'
    && worker.connectionState === 'CONNECTED'
    && worker.shadow === true
    && worker.draining === true
    && Number(worker.weight) === 0
    && Number(worker.capacity) === 0
    && Number(worker.concurrentSockets) === 1
    && worker.pairingRequired === false;

export const resolveOutboundProviderDecision = (phone, context = {}) => {
    const normalizedPhone = digits(phone);
    if (normalizedPhone.length < 10) {
        return Object.freeze({ provider: V167_PROVIDER.BLOCKED, webEligible: false, reason: 'INVALID_PHONE' });
    }
    if (normalizedPhone !== V167_CONTROLLED_PHONE) {
        return Object.freeze({ provider: V167_PROVIDER.ZAPI, webEligible: false, reason: 'GENERAL_CUSTOMER_ZAPI' });
    }
    if (context.webRoutingEnabled !== true) {
        return Object.freeze({ provider: V167_PROVIDER.ZAPI, webEligible: false, reason: 'WEB_RULE_DISABLED' });
    }
    if (context.purpose !== V167_ROUTING_PURPOSE || context.explicitControlledAction !== true) {
        return Object.freeze({ provider: V167_PROVIDER.BLOCKED, webEligible: false, reason: 'CONTROLLED_ACTION_REQUIRED' });
    }
    if (!v167WebWorkerReady(context.webWorker)) {
        return Object.freeze({ provider: V167_PROVIDER.BLOCKED, webEligible: false, reason: 'WEB_WORKER_NOT_READY' });
    }
    return Object.freeze({ provider: V167_PROVIDER.WEB, webEligible: true, reason: 'EXACT_CONTROLLED_PHONE' });
};

export const resolveOutboundProvider = (phone, context = {}) => resolveOutboundProviderDecision(phone, context).provider;

export class V167ProviderDecisionLedger {
    constructor({ repository, clock = () => new Date() } = {}) {
        if (!repository || typeof repository.findOneAndUpdate !== 'function') {
            throw new Error('v167_atomic_decision_repository_required');
        }
        this.repository = repository;
        this.clock = clock;
    }

    async reserve({ eventKey, phone, selectedProvider }) {
        const eventKeyHash = sha256(clean(eventKey));
        const phoneHash = sha256(digits(phone));
        if (!clean(eventKey) || !Object.values(V167_PROVIDER).includes(selectedProvider)
            || selectedProvider === V167_PROVIDER.BLOCKED) {
            throw new Error('v167_decision_reservation_invalid');
        }
        const record = {
            eventKeyHash,
            phoneHash,
            selectedProvider,
            decisionAt: this.clock(),
            sendState: 'INTENDED'
        };
        const result = await this.repository.findOneAndUpdate(
            { eventKeyHash },
            { $setOnInsert: record },
            { upsert: true, new: true, includeResultMetadata: true }
        );
        const value = result?.value || result;
        const created = !result?.lastErrorObject?.updatedExisting;
        if (!created || isTerminalOrReserved(value?.sendState)) {
            return Object.freeze({ accepted: created, duplicate: !created, record: value || record });
        }
        return Object.freeze({ accepted: true, duplicate: false, record });
    }

    async transition(eventKeyHash, selectedProvider, fromState, toState) {
        if (!V167_SEND_STATES.includes(toState)) throw new Error('v167_send_state_invalid');
        const value = await this.repository.findOneAndUpdate(
            { eventKeyHash, selectedProvider, sendState: fromState },
            { $set: { sendState: toState } },
            { new: true }
        );
        if (!value) throw new Error('v167_decision_transition_rejected');
        return value;
    }
}

const withTimeout = async (operation, timeoutMs) => {
    let timer;
    try {
        return await Promise.race([
            Promise.resolve().then(operation),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('v167_provider_timeout')), timeoutMs);
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
};

export class ControlledOutboundCoordinatorV167 {
    constructor({ ledger, queueClaimer, webPort, zapiPort, timeoutMs = 30000 } = {}) {
        if (!ledger || typeof ledger.reserve !== 'function' || typeof ledger.transition !== 'function') {
            throw new Error('v167_ledger_required');
        }
        if (typeof queueClaimer !== 'function') throw new Error('v167_queue_claimer_required');
        if (webPort?.mode !== 'PERSISTENT_EXISTING_SOCKET' || typeof webPort?.send !== 'function') {
            throw new Error('v167_persistent_web_port_required');
        }
        if (typeof zapiPort?.send !== 'function') throw new Error('v167_zapi_port_required');
        this.ledger = ledger;
        this.queueClaimer = queueClaimer;
        this.webPort = webPort;
        this.zapiPort = zapiPort;
        this.timeoutMs = Math.min(60000, Math.max(1000, Number(timeoutMs || 0)));
    }

    async dispatch({ eventKey, phone, payload, context = {} } = {}) {
        const decision = resolveOutboundProviderDecision(phone, context);
        if (decision.provider === V167_PROVIDER.BLOCKED) {
            return Object.freeze({ sent: false, blocked: true, provider: V167_PROVIDER.BLOCKED, reason: decision.reason });
        }
        const reservation = await this.ledger.reserve({ eventKey, phone, selectedProvider: decision.provider });
        if (!reservation.accepted || reservation.duplicate) {
            return Object.freeze({ sent: false, blocked: true, duplicate: true, provider: reservation.record?.selectedProvider });
        }
        const eventKeyHash = reservation.record.eventKeyHash;
        const claim = await this.queueClaimer({ eventKeyHash, selectedProvider: decision.provider });
        if (!claim?.accepted) {
            await this.ledger.transition(eventKeyHash, decision.provider, 'INTENDED', 'AMBIGUOUS');
            return Object.freeze({ sent: false, blocked: true, provider: decision.provider, state: 'AMBIGUOUS', fallback: false });
        }
        const port = decision.provider === V167_PROVIDER.WEB ? this.webPort : this.zapiPort;
        try {
            const providerResult = await withTimeout(() => port.send({ eventKeyHash, phone: digits(phone), payload }), this.timeoutMs);
            if (!clean(providerResult?.providerMessageId)) throw new Error('v167_provider_result_ambiguous');
            await this.ledger.transition(eventKeyHash, decision.provider, 'INTENDED', 'SENT');
            return Object.freeze({ sent: true, blocked: false, provider: decision.provider, state: 'SENT', fallback: false });
        } catch {
            await this.ledger.transition(eventKeyHash, decision.provider, 'INTENDED', 'AMBIGUOUS');
            return Object.freeze({ sent: false, blocked: true, provider: decision.provider, state: 'AMBIGUOUS', fallback: false });
        }
    }
}

export const sanitizeV167Decision = (record = {}) => Object.freeze({
    eventKeyHash: clean(record.eventKeyHash),
    phoneHash: clean(record.phoneHash),
    selectedProvider: clean(record.selectedProvider),
    decisionAt: record.decisionAt || null,
    sendState: clean(record.sendState)
});
