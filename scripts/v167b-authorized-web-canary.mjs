#!/usr/bin/env node
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Message from '../src/models/Message.js';
import OutboundDedupe from '../src/models/OutboundDedupe.js';
import { UnifiedMessageLedger } from '../src/whatsapp/core/UnifiedMessageLedger.js';
import {
    ControlledOutboundCoordinatorV167,
    V167ProviderDecisionLedger,
    V167_PROVIDER,
    resolveOutboundProviderDecision
} from '../src/whatsapp/core/ControlledProviderRoutingV167.js';
import {
    V167B_CONTENT_FINGERPRINT,
    V167B_EVENT_KEY,
    V167BFileDecisionRepository,
    V167B_WORKER_ID,
    buildV167BMessagePayload,
    resolveV167BConfig,
    sanitizeV167BResult,
    sendV167BControlRequest
} from '../src/whatsapp/core/AuthorizedWebCanaryV167B.js';

process.umask(0o077);
dotenv.config({ path: process.env.V167B_ENV_FILE || '.env', override: false });

const command = String(process.argv[2] || '');
const confirmation = String(process.argv[3] || '');
const executeApproved = command === 'execute'
    && confirmation === 'CONFIRM_ONE_WEB_MESSAGE_TO_5515998038637'
    && process.env.V167B_EXECUTE_APPROVED === 'YES';
const config = resolveV167BConfig(process.env);
const stateFile = '/var/lib/vitalismen-whatsapp-web-shadow-state/V152_TEST_WEB_01/health.json';
const yesNo = (value) => value ? 'YES' : 'NO';
const clean = (value) => String(value || '').trim();

const readWorkerContext = async () => {
    const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
    const socketStat = await fs.lstat(config.socketPath);
    if (!socketStat.isSocket() || socketStat.isSymbolicLink() || (socketStat.mode & 0o777) !== 0o600) {
        throw new Error('v167b_control_socket_not_secure');
    }
    return Object.freeze({
        processName: 'vitalismen-whatsapp-web-shadow-v164',
        active: state.status === 'ACTIVE',
        health: state.health,
        sessionNamespace: state.sessionNamespace,
        pairedIdentity: String(state.phone || '').replace(/\D/g, ''),
        sessionState: state.sessionState,
        connectionState: state.connectionState,
        shadow: state.shadow === true,
        draining: state.draining === true,
        weight: Number(state.weight),
        capacity: Number(state.capacity),
        concurrentSockets: state.connectionState === 'CONNECTED' ? 1 : 0,
        pairingRequired: state.pairingRequired !== 'NO'
    });
};

const assertNegativeRouterProof = (webWorker) => {
    const controlledContext = {
        webRoutingEnabled: true,
        purpose: config.purpose,
        explicitControlledAction: true,
        webWorker
    };
    const failedWorker = { ...webWorker, health: 'FAIL' };
    const qaReady = resolveOutboundProviderDecision(config.phone, controlledContext);
    const qaFailed = resolveOutboundProviderDecision(config.phone, { ...controlledContext, webWorker: failedWorker });
    const generalReady = resolveOutboundProviderDecision('593991112233', controlledContext);
    const generalFailed = resolveOutboundProviderDecision('593991112233', { ...controlledContext, webWorker: failedWorker });
    if (qaReady.provider !== V167_PROVIDER.WEB
        || qaFailed.provider !== V167_PROVIDER.BLOCKED
        || generalReady.provider !== V167_PROVIDER.ZAPI
        || generalFailed.provider !== V167_PROVIDER.ZAPI) {
        throw new Error('v167b_negative_router_proof_failed');
    }
    return controlledContext;
};

if (!['inspect', 'execute'].includes(command) || (command === 'execute' && !executeApproved)) {
    throw new Error('usage: v167b-authorized-web-canary.mjs inspect | execute CONFIRM_ONE_WEB_MESSAGE_TO_5515998038637');
}
if (process.env.V167B_ZAPI_PREFLIGHT_CONFIRMED !== 'ONLINE_CONNECTED') {
    throw new Error('v167b_zapi_preflight_confirmation_required');
}

const mongoUri = clean(process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL);
if (!mongoUri) throw new Error('v167b_mongodb_uri_required');

let exitCode = 0;
try {
    await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
    const webWorker = await readWorkerContext();
    const context = assertNegativeRouterProof(webWorker);
    const payload = buildV167BMessagePayload();
    const existingMessage = await Message.findById(payload._id).lean();
    const existingDedupe = await OutboundDedupe.findOne({ logicalMessageId: V167B_EVENT_KEY }).lean();
    const decisionRepository = new V167BFileDecisionRepository({ filePath: config.decisionFile });
    const existingDecision = await decisionRepository.read();
    const generalBefore = await Message.countDocuments({
        queueWorkerId: V167B_WORKER_ID,
        peerPhone: { $ne: config.phone }
    });

    if (command === 'inspect') {
        process.stdout.write([
            'CANARY_PREFLIGHT=PASS',
            `WEB_WORKER_RUNTIME=${webWorker.connectionState}`,
            `WEB_WORKER_HEALTH=${webWorker.health}`,
            `WEB_SESSION_AUTHENTICATED=${yesNo(webWorker.sessionState === 'RESTORED')}`,
            `MAX_CONCURRENT_WEB_SOCKETS=${webWorker.concurrentSockets}`,
            `AUTHORIZED_PHONE_PROVIDER=${resolveOutboundProviderDecision(config.phone, context).provider.toUpperCase()}`,
            'GENERAL_CUSTOMER_PROVIDER=ZAPI',
            'GENERAL_CUSTOMERS_WEB_ELIGIBLE=NO',
            `EXISTING_CANARY_MESSAGE=${yesNo(Boolean(existingMessage))}`,
            `EXISTING_CANARY_DEDUPE=${yesNo(Boolean(existingDedupe))}`,
            `EXISTING_CANARY_DECISION=${yesNo(Boolean(existingDecision))}`,
            `GENERAL_WEB_ROUTING_COUNT=${generalBefore}`,
            'NETWORK_SEND_CALLS=0'
        ].join('\n') + '\n');
        process.exit(0);
    }

    if (existingMessage || existingDedupe || existingDecision) {
        process.stdout.write('CANARY_EXECUTED=NO\nCANARY_RESULT=DUPLICATE_BLOCKED\nWEB_SEND_ATTEMPT=0\nZAPI_SEND_ATTEMPT=0\n');
        process.exit(3);
    }

    const unifiedLedger = new UnifiedMessageLedger();
    const reservation = await unifiedLedger.reserve({
        logicalMessageId: V167B_EVENT_KEY,
        channelId: config.channelId,
        provider: 'WHATSAPP_WEB',
        phone: config.phone,
        kind: 'text',
        contentFingerprint: V167B_CONTENT_FINGERPRINT,
        payload
    });
    if (!reservation.accepted || reservation.duplicate || reservation.messageId !== payload._id) {
        throw new Error('v167b_unified_ledger_reservation_rejected');
    }

    let webSendAttempts = 0;
    let zapiSendAttempts = 0;
    let controlResult = sanitizeV167BResult();
    const decisionLedger = new V167ProviderDecisionLedger({ repository: decisionRepository });
    const coordinator = new ControlledOutboundCoordinatorV167({
        ledger: decisionLedger,
        queueClaimer: async ({ eventKeyHash, selectedProvider }) => {
            if (eventKeyHash !== config.eventKeyHash || selectedProvider !== V167_PROVIDER.WEB) {
                return { accepted: false };
            }
            const now = new Date();
            const row = await Message.findOneAndUpdate(
                {
                    _id: payload._id,
                    logicalMessageId: V167B_EVENT_KEY,
                    peerPhone: config.phone,
                    provider: 'WHATSAPP_WEB',
                    queueStatus: 'PENDING',
                    queueAttemptCount: 0
                },
                {
                    $set: {
                        queueStatus: 'CLAIMED',
                        queueWorkerId: V167B_WORKER_ID,
                        queueClaimedAt: now,
                        queueLeaseUntil: new Date(now.getTime() + 60000)
                    },
                    $inc: { queueAttemptCount: 1 }
                },
                { new: true }
            );
            return { accepted: Boolean(row), messageId: row?._id || '' };
        },
        webPort: {
            mode: 'PERSISTENT_EXISTING_SOCKET',
            send: async () => {
                webSendAttempts += 1;
                controlResult = sanitizeV167BResult(await sendV167BControlRequest({ config }));
                if (!controlResult.ok || !controlResult.accepted || !controlResult.providerMessageId) {
                    throw new Error(controlResult.reason || 'v167b_web_result_ambiguous');
                }
                return { providerMessageId: controlResult.providerMessageId };
            }
        },
        zapiPort: {
            send: async () => {
                zapiSendAttempts += 1;
                throw new Error('v167b_zapi_port_forbidden');
            }
        },
        timeoutMs: config.requestTimeoutMs + 5000
    });

    const dispatched = await coordinator.dispatch({
        eventKey: V167B_EVENT_KEY,
        phone: config.phone,
        payload: { type: 'text', text: config.text },
        context
    });

    const completedAt = new Date();
    if (dispatched.sent && controlResult.accepted && webSendAttempts === 1 && zapiSendAttempts === 0) {
        const persisted = await Message.findOneAndUpdate(
            {
                _id: payload._id,
                queueStatus: 'CLAIMED',
                queueWorkerId: V167B_WORKER_ID,
                queueAttemptCount: 1
            },
            {
                $set: {
                    provider: 'WHATSAPP_WEB',
                    providerMessageId: controlResult.providerMessageId,
                    ack: controlResult.ack,
                    deliveryStatus: controlResult.ack >= 4 ? 'read' : controlResult.ack >= 3 ? 'delivered' : 'sent',
                    providerStatus: controlResult.deliveryState,
                    queueStatus: 'COMPLETED',
                    queueCompletedAt: completedAt,
                    queueLeaseUntil: null
                }
            },
            { new: true }
        );
        if (!persisted) throw new Error('v167b_message_completion_rejected');
        await OutboundDedupe.updateOne(
            { key: reservation.dedupeKey, status: 'reserved' },
            {
                $set: {
                    status: 'sent',
                    provider: 'WHATSAPP_WEB',
                    providerMessageId: controlResult.providerMessageId,
                    sentAt: completedAt,
                    retryAllowed: false
                }
            }
        );
        if (controlResult.ack >= 3) {
            await decisionLedger.transition(config.eventKeyHash, V167_PROVIDER.WEB, 'SENT', 'ACKED');
        }
    } else {
        await Message.updateOne(
            { _id: payload._id, queueStatus: 'CLAIMED', queueWorkerId: V167B_WORKER_ID },
            {
                $set: {
                    queueStatus: 'FAILED',
                    queueLeaseUntil: null,
                    deliveryStatus: 'failed',
                    sendError: 'AMBIGUOUS_WEB_RESULT'
                }
            }
        );
        await OutboundDedupe.updateOne(
            { key: reservation.dedupeKey },
            { $set: { status: 'ambiguous', ambiguousAt: completedAt, retryAllowed: false } }
        );
        exitCode = 2;
    }

    const finalMessage = await Message.findById(payload._id).lean();
    const finalDedupe = await OutboundDedupe.findOne({ key: reservation.dedupeKey }).lean();
    const finalDecision = await decisionRepository.read();
    const providerIdMatches = await Message.countDocuments({
        providerMessageId: controlResult.providerMessageId,
        peerPhone: config.phone,
        provider: 'WHATSAPP_WEB'
    });
    const dashboardMatches = await Message.countDocuments({
        _id: payload._id,
        peerPhone: config.phone,
        provider: { $ne: 'zapi_chat_watchdog' },
        body: { $not: /(?:Z-API|ZAPI).*(?:ALERTA|INATIV|DESCONECT|CONECT|STATUS|INSTANCE|TOKEN)/i }
    });
    const generalAfter = await Message.countDocuments({
        queueWorkerId: V167B_WORKER_ID,
        peerPhone: { $ne: config.phone }
    });
    const pass = exitCode === 0
        && dispatched.sent === true
        && dispatched.provider === V167_PROVIDER.WEB
        && webSendAttempts === 1
        && zapiSendAttempts === 0
        && finalMessage?.queueStatus === 'COMPLETED'
        && finalMessage?.provider === 'WHATSAPP_WEB'
        && finalMessage?.providerMessageId === controlResult.providerMessageId
        && finalMessage?.queueAttemptCount === 1
        && finalDedupe?.status === 'sent'
        && finalDedupe?.retryAllowed === false
        && ['SENT', 'ACKED'].includes(finalDecision?.sendState)
        && providerIdMatches === 1
        && dashboardMatches === 1
        && generalAfter === generalBefore;

    process.stdout.write([
        `CANARY_RESULT=${pass ? 'PASS' : 'FAIL'}`,
        `CANARY_EXECUTED=${yesNo(webSendAttempts === 1)}`,
        `CANARY_MESSAGE_ID=${payload._id}`,
        `CANARY_QUEUE_ID=${payload._id}`,
        `CANARY_CLAIM_OWNER=${V167B_WORKER_ID}`,
        `CANARY_SELECTED_PROVIDER=${String(dispatched.provider || '').toUpperCase()}`,
        `WEB_SEND_ATTEMPT=${webSendAttempts}`,
        `ZAPI_SEND_ATTEMPT=${zapiSendAttempts}`,
        `CANARY_SEND_ACK=${controlResult.ack}`,
        `CANARY_PROVIDER_MESSAGE_ID=${controlResult.providerMessageId}`,
        `CANARY_PERSISTED=${yesNo(Boolean(finalMessage))}`,
        `CANARY_PROVIDER_PERSISTED=${clean(finalMessage?.provider)}`,
        `CANARY_VISIBLE_IN_DASHBOARD=${yesNo(dashboardMatches === 1)}`,
        `CANARY_DUPLICATED_IN_DASHBOARD=${yesNo(dashboardMatches > 1 || providerIdMatches > 1)}`,
        `CANARY_DELIVERY_STATE=${clean(finalMessage?.deliveryStatus).toUpperCase()}`,
        `MESSAGE_DEDUPE=${finalDedupe?.status === 'sent' && finalDedupe?.retryAllowed === false ? 'PASS' : 'FAIL'}`,
        `QUEUE_CLAIM_EXCLUSIVITY=${finalMessage?.queueAttemptCount === 1 ? 'PASS' : 'FAIL'}`,
        `DOUBLE_SEND_DETECTED=${yesNo(webSendAttempts + zapiSendAttempts > 1 || providerIdMatches > 1)}`,
        `GENERAL_WEB_ROUTING_COUNT=${generalAfter}`,
        `GENERAL_WEB_QUEUE_CONSUMPTION=${generalAfter - generalBefore}`
    ].join('\n') + '\n');
    if (!pass) exitCode = 2;
} finally {
    await mongoose.disconnect().catch(() => {});
}

process.exit(exitCode);
