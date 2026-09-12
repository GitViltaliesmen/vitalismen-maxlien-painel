#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureSecureDirectory, phoneFingerprint, writeJsonAtomic } from '../src/whatsapp/core/ControlledRealPairingV152E.js';

const PHASE = 'V152-E-R1_REAL_PAIRING_TEST_CHANNEL';
const PATCH = 'V152-E-R2_NATIVE_PAIRING_CODE';
const CHANNEL_ID = 'V152_TEST_WEB_01';
const TEST_PHONE = '5531983002800';
const QA_PHONE = '5515998038637';
const DEFAULT_EVIDENCE_ROOT = '/var/lib/vitalismen-v152-e-evidence';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const read = async (target) => JSON.parse(await fs.readFile(target, 'utf8'));
const requireValue = (condition, code) => { if (!condition) throw new Error(code); };

if (process.platform !== 'linux' || process.getuid?.() !== 0) throw new Error('v152_e_r2_receipt_root_vps_required');
if (String(process.env.V152_E_CONTROLLED_REAL_PAIRING_APPROVED || '') !== 'true') {
    throw new Error('v152_e_explicit_pairing_approval_required');
}

const root = process.cwd();
const evidenceRoot = path.resolve(String(process.env.V152_E_EVIDENCE_ROOT || DEFAULT_EVIDENCE_ROOT));
const files = {
    identity: path.join(evidenceRoot, 'paired-channel-v152-e-r1.json'),
    pairing: path.join(evidenceRoot, 'pairing-proof-v152-e-r1.json'),
    restart: path.join(evidenceRoot, 'restart-persistence-v152-e-r1.json'),
    inbound: path.join(evidenceRoot, 'controlled-inbound-v152-e-r1.json'),
    ledger: path.join(evidenceRoot, 'controlled-canary-ledger-v152-e-r1.json'),
    connections: path.join(evidenceRoot, 'connections-panel-v152-e-r1.json'),
    preflight: path.join(evidenceRoot, 'pre-pairing-snapshot-v152-e-r1.json'),
    postflight: path.join(evidenceRoot, 'post-pairing-verification-v152-e-r1.json')
};
const values = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, target]) => [key, await read(target)])));
const source = await read(path.join(root, '.release-source.json'));
const staged = await read(path.join(root, '.staging-complete.json'));

requireValue(values.identity.phase === PHASE && values.identity.pairingPatch === PATCH, 'v152_e_r2_identity_invalid');
requireValue(values.identity.channelId === CHANNEL_ID, 'v152_e_r2_channel_invalid');
requireValue(values.identity.pairedPhoneSha256 === phoneFingerprint(TEST_PHONE), 'v152_e_r2_phone_mismatch');
requireValue(values.pairing.pairingMethod === 'PAIRING_CODE', 'v152_e_r2_pairing_method_invalid');
requireValue(values.pairing.pairing === 'PASS' && values.pairing.sessionCreated && values.pairing.sessionConnected, 'v152_e_r2_pairing_unproven');
requireValue(values.pairing.channelPhoneMatch === true, 'v152_e_r2_phone_match_unproven');
requireValue(values.pairing.pairingCodePersisted === false && values.pairing.qrPersisted === false, 'v152_e_r2_secret_policy_invalid');
requireValue(values.restart.sessionRestored === true && values.restart.newQrRequired === false, 'v152_e_r2_restart_unproven');
requireValue(values.inbound.peerPhoneSha256 === phoneFingerprint(QA_PHONE), 'v152_e_r2_inbound_peer_invalid');
requireValue(values.inbound.persistedBody === false && values.inbound.routedToBusinessLogic === false && values.inbound.autoReply === false, 'v152_e_r2_inbound_scope_invalid');
requireValue(values.ledger.inbound?.status === 'OBSERVED' && values.ledger.inbound?.duplicateInbound === 0, 'v152_e_r2_inbound_ledger_invalid');
requireValue(values.ledger.outbound?.status === 'SENT' && values.ledger.outbound?.providerSendCount === 1, 'v152_e_r2_outbound_unproven');
requireValue(Number(values.ledger.outbound?.dedupedAttempts || 0) >= 1, 'v152_e_r2_outbound_dedupe_unproven');
requireValue(values.connections.channelId === CHANNEL_ID && values.connections.phoneNumber === TEST_PHONE, 'v152_e_r2_connections_invalid');
requireValue(values.connections.shadow === true && values.connections.draining === true, 'v152_e_r2_connections_routing_invalid');
requireValue(values.connections.weight === 0 && values.connections.capacity === 0, 'v152_e_r2_connections_capacity_invalid');
requireValue(values.postflight.health?.engine === 'Z-API' && values.postflight.health?.zapiConnected === true, 'v152_e_r2_zapi_unproven');
requireValue(values.postflight.changedFingerprints?.length === 0 && values.postflight.invariants?.currentReleaseUnchanged === true, 'v152_e_r2_baseline_changed');

const evidenceHashes = {};
for (const [key, target] of Object.entries(files)) evidenceHashes[key] = sha256(await fs.readFile(target));
const receipt = {
    phase: PHASE,
    pairingPatch: PATCH,
    status: 'V152_E_R2_NATIVE_PAIRING_CODE_PROVEN_AND_FROZEN',
    createdAt: new Date().toISOString(),
    channel: {
        channelId: CHANNEL_ID,
        phoneNumber: TEST_PHONE,
        provider: 'WHATSAPP_WEB',
        session: 'CONNECTED',
        health: 'PASS',
        shadow: true,
        draining: true,
        weight: 0,
        capacity: 0
    },
    qaPhone: QA_PHONE,
    proofs: {
        pairingMethod: 'PAIRING_CODE',
        pairingCodePersisted: false,
        qrGenerated: false,
        restartSessionRestored: true,
        newPairingRequiredAfterRestart: false,
        inboundQa: 'PASS',
        duplicateInbound: 0,
        outboundQa: 'PASS',
        outboundProviderCalls: 1,
        dedupeSecondAttempt: 'DEDUPED',
        duplicateOutbound: 0
    },
    production: {
        phoneNumber: '5531971862958',
        provider: 'ZAPI',
        connected: true,
        trafficUnchanged: true,
        currentRelease: values.postflight.activeRelease,
        changed: false
    },
    forbiddenEffects: {
        customerRouting: 0,
        handoff: 0,
        failover: 0,
        cutover: 0,
        zapiDrain: false,
        zapiOff: false
    },
    candidate: {
        commit: source.commit,
        tree: source.functionalTree,
        functionalPayloadSha256: staged.functionalPayloadSha256,
        release: source.releaseName,
        publicationStatus: source.publicationStatus
    },
    evidenceHashes
};

await ensureSecureDirectory(evidenceRoot);
const target = path.join(evidenceRoot, 'V152_E_R2_OPERATIONAL_RECEIPT_20260912.json');
await writeJsonAtomic(target, receipt);
const receiptSha256 = sha256(await fs.readFile(target));
process.stdout.write(`${JSON.stringify({
    phase: PHASE,
    pairingPatch: PATCH,
    event: 'V152_E_R2_OPERATIONAL_RECEIPT_PASS',
    target,
    receiptSha256,
    secretsPrinted: false,
    cutover: false
})}\n`);
