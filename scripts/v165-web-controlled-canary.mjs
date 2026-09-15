#!/usr/bin/env node
import pino from 'pino';
import { Browsers, fetchLatestWaWebVersion, makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';

import {
    V165CanaryLedger,
    executeV165ControlledCanary,
    resolveV165CanaryConfig,
    sanitizeV165Ledger
} from '../src/whatsapp/core/ControlledOutboundCanaryV165.js';

process.umask(0o077);

const command = String(process.argv[2] || '');
const confirmation = String(process.argv[3] || '');
const config = resolveV165CanaryConfig(process.env, { requireApproval: command === 'execute' });
const ledger = new V165CanaryLedger({ config });
const yesNo = (value) => value ? 'YES' : 'NO';
const print = (values) => process.stdout.write(`${values.join('\n')}\n`);

if (command === 'inspect') {
    const state = sanitizeV165Ledger(await ledger.read());
    print([
        `LEDGER_STATE=${state.state}`,
        `WEB_CANARY_ATTEMPTS=${state.attemptCount}`,
        `PROVIDER_MESSAGE_ID_SHA256=${state.providerMessageIdSha256}`,
        `DUPLICATE_REEXECUTION_BLOCKED=${yesNo(state.duplicateBlocked)}`,
        'AUTOMATIC_RETRY_EXECUTED=NO',
        'SOCKET_CREATED=NO',
        'NETWORK_CALLS=0'
    ]);
    process.exit(0);
}

if (command !== 'execute' || confirmation !== 'CONFIRM_ONE_WEB_MESSAGE_TO_5515998038637') {
    throw new Error('usage: v165-web-controlled-canary.mjs inspect | execute CONFIRM_ONE_WEB_MESSAGE_TO_5515998038637');
}

const logger = pino({ level: 'silent' });
const socketFactory = async () => {
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionDirectory);
    const { version } = await fetchLatestWaWebVersion();
    const socket = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: Browsers.windows('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: false,
        emitOwnEvents: false,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined
    });
    return { socket, saveCreds };
};

const result = await executeV165ControlledCanary({ config, ledger, socketFactory });
print([
    `CANARY_RESULT=${result.result}`,
    `LEDGER_STATE=${result.ledgerState}`,
    `WEB_CANARY_ATTEMPTS=${result.attempts}`,
    `WEB_CANARY_MESSAGES_SENT=${result.sent}`,
    `WEB_PROVIDER_ACCEPTED=${yesNo(result.providerAccepted)}`,
    `WEB_DELIVERY_ACK_OBSERVED=${yesNo(result.deliveryAckObserved)}`,
    `PROVIDER_MESSAGE_ID_SHA256=${result.providerMessageIdSha256}`,
    `WEB_SEND_CALLS=${result.sendCalls}`,
    `SOCKET_CREATED=${yesNo(result.socketCreated)}`,
    'AUTOMATIC_RETRY_EXECUTED=NO',
    'ZAPI_CANARY_SEND_CALLS=0',
    'ORDER_CREATED=0',
    'SHIPMENT_CREATED=0',
    'DROPI_CREATE_REQUESTS=0',
    'DROPI_APPLY_CALLS=0',
    'META_PURCHASE_CALLS=0'
]);
if (result.result === 'AMBIGUOUS') process.exitCode = 2;
else if (result.result === 'DUPLICATE_BLOCKED') process.exitCode = 3;
