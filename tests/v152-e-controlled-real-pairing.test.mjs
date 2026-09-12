import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ChannelRegistry } from '../src/whatsapp/core/ChannelRegistry.js';
import { isEligibleChannel } from '../src/whatsapp/core/ChannelRouter.js';
import {
    ControlledCanaryLedger,
    V152_E_ALLOWED_PEER_PHONE,
    V152_E_CHANNEL_ID,
    V152_E_FIXED_OUTBOUND_TEXT,
    V152_E_PAIRING_PATCH,
    V152_E_SESSION_NAMESPACE,
    V152_E_TEST_CHANNEL_PHONE,
    assertNativePairingCode,
    assertPairedPhoneAllowed,
    removePairingCodeSecret,
    resolveV152EConfig,
    safePairedIdentity,
    sanitizeConnectionUpdate,
    sanitizeInboundEvidence,
    v152EPolicyStatus,
    ensureSecureDirectory,
    writeEphemeralQr
} from '../src/whatsapp/core/ControlledRealPairingV152E.js';

const makeRoots = async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v152-e-'));
    return {
        root,
        releaseRoot: path.join(root, 'release'),
        sessionRoot: path.join(root, 'shared', 'sessions'),
        qrRoot: path.join(root, 'run', 'qr'),
        evidenceRoot: path.join(root, 'evidence')
    };
};

const makeConfig = async (overrides = {}) => {
    const roots = await makeRoots();
    await fs.mkdir(roots.releaseRoot, { recursive: true });
    const env = {
        V152_E_CONTROLLED_REAL_PAIRING_APPROVED: 'true',
        V152_E_CHANNEL_ID,
        V152_E_SESSION_NAMESPACE,
        V152_E_ALLOWED_PEER_PHONE,
        V152_E_TEST_CHANNEL_PHONE,
        WHATSAPP_SESSION_STORAGE_ROOT: roots.sessionRoot,
        V152_E_QR_RUNTIME_ROOT: roots.qrRoot,
        V152_E_EVIDENCE_ROOT: roots.evidenceRoot,
        ...overrides
    };
    return { roots, config: resolveV152EConfig(env, { releaseRoot: roots.releaseRoot }) };
};

test('V152-E exige autorização explícita e identidades exatas', async () => {
    const roots = await makeRoots();
    assert.throws(() => resolveV152EConfig({}, { releaseRoot: roots.releaseRoot }), /explicit_pairing_approval_required/);
    await assert.rejects(async () => makeConfig({ V152_E_CHANNEL_ID: 'ANY' }), /channel_id_mismatch/);
    await assert.rejects(async () => makeConfig({ V152_E_SESSION_NAMESPACE: 'other' }), /session_namespace_mismatch/);
    await assert.rejects(async () => makeConfig({ V152_E_ALLOWED_PEER_PHONE: '5511000000000' }), /peer_phone_mismatch/);
    await assert.rejects(async () => makeConfig({ V152_E_TEST_CHANNEL_PHONE: '5531000000000' }), /test_channel_phone_mismatch/);
});

test('sessão, QR e evidência ficam fora da release e separados', async () => {
    const roots = await makeRoots();
    const common = {
        V152_E_CONTROLLED_REAL_PAIRING_APPROVED: 'true',
        V152_E_CHANNEL_ID,
        V152_E_SESSION_NAMESPACE,
        V152_E_ALLOWED_PEER_PHONE,
        V152_E_TEST_CHANNEL_PHONE,
        V152_E_QR_RUNTIME_ROOT: roots.qrRoot,
        V152_E_EVIDENCE_ROOT: roots.evidenceRoot
    };
    assert.throws(() => resolveV152EConfig({ ...common, WHATSAPP_SESSION_STORAGE_ROOT: path.join(roots.releaseRoot, 'session') }, { releaseRoot: roots.releaseRoot }), /inside_release_forbidden/);
    assert.throws(() => resolveV152EConfig({ ...common, WHATSAPP_SESSION_STORAGE_ROOT: roots.sessionRoot, V152_E_QR_RUNTIME_ROOT: path.join(roots.sessionRoot, 'qr') }, { releaseRoot: roots.releaseRoot }), /must_be_separate/);
});

test('diretório seguro rejeita caminho que atravessa symlink', async (context) => {
    if (process.platform === 'win32') {
        context.skip('criação de symlink requer privilégio específico no Windows');
        return;
    }
    const roots = await makeRoots();
    const real = path.join(roots.root, 'real');
    const linked = path.join(roots.root, 'linked');
    await fs.mkdir(real);
    await fs.symlink(real, linked, 'dir');
    await assert.rejects(() => ensureSecureDirectory(linked), /symlink_path_forbidden/);
});

test('somente a linha de teste exata pode ser pareada no Web', async () => {
    const { config } = await makeConfig();
    assert.throws(() => assertPairedPhoneAllowed('5531971862958', config), /same_phone_dual_provider_forbidden/);
    assert.throws(() => assertPairedPhoneAllowed('5515991418416', config), /same_phone_dual_provider_forbidden/);
    assert.throws(() => assertPairedPhoneAllowed('5515998038637', config), /same_phone_dual_provider_forbidden/);
    assert.throws(() => assertPairedPhoneAllowed('5511999999999', config), /paired_phone_mismatch/);
    assert.equal(assertPairedPhoneAllowed(V152_E_TEST_CHANNEL_PHONE, config), V152_E_TEST_CHANNEL_PHONE);
});

test('identidade persistida é redigida e mantém Z-API', async () => {
    const { config } = await makeConfig();
    const identity = safePairedIdentity(V152_E_TEST_CHANNEL_PHONE, config, new Date('2026-09-12T15:00:00Z'));
    assert.equal(identity.pairedPhoneMasked, '***2800');
    assert.equal(identity.pairedPhoneSha256.length, 64);
    assert.equal(JSON.stringify(identity).includes(V152_E_TEST_CHANNEL_PHONE), false);
    assert.equal(identity.zapiPreserved, true);
    assert.equal(identity.customerRouting, false);
});

test('QR vira apenas PNG temporário e o material bruto não entra no retorno', async () => {
    const { config } = await makeConfig();
    const raw = 'sensitive-qr-material-v152-e';
    const result = await writeEphemeralQr(raw, config, { encoder: async () => Buffer.alloc(128, 7) });
    assert.equal(result.path, config.qrFile);
    assert.equal(JSON.stringify(result).includes(raw), false);
    assert.equal((await fs.readFile(config.qrFile)).length, 128);
});

test('evento de conexão expõe somente presença do QR', () => {
    const raw = 'sensitive-qr-material-v152-e';
    const result = sanitizeConnectionUpdate({ connection: 'connecting', qr: raw });
    assert.deepEqual(result, { connection: 'connecting', qrAvailable: true, disconnectCode: null });
    assert.equal(JSON.stringify(result).includes(raw), false);
});

test('V152-E-R2 valida o código nativo e o remove antes de persistir credenciais', () => {
    assert.equal(V152_E_PAIRING_PATCH, 'V152-E-R2_NATIVE_PAIRING_CODE');
    assert.equal(assertNativePairingCode('AB23CD45'), 'AB23CD45');
    assert.throws(() => assertNativePairingCode('ABCD'), /pairing_code_invalid/);
    assert.throws(() => assertNativePairingCode('ABCD-I23'), /pairing_code_invalid/);
    const creds = { pairingCode: 'AB23CD45', registered: true, retained: 'safe' };
    assert.deepEqual(removePairingCodeSecret(creds), { removed: true, persistable: true });
    assert.equal(Object.hasOwn(creds, 'pairingCode'), false);
    assert.equal(creds.retained, 'safe');
});

test('inbound aceita apenas QA e persiste hashes sem corpo', async () => {
    const { config } = await makeConfig();
    const body = 'canary body that must not be persisted';
    const evidence = sanitizeInboundEvidence({
        key: { id: 'provider-id-secret', remoteJid: `${V152_E_ALLOWED_PEER_PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: body }
    }, config, new Date('2026-09-12T15:10:00Z'));
    const serialized = JSON.stringify(evidence);
    assert.equal(evidence.kind, 'text');
    assert.equal(evidence.routedToBusinessLogic, false);
    assert.equal(evidence.autoReply, false);
    assert.equal(serialized.includes(body), false);
    assert.equal(serialized.includes('provider-id-secret'), false);
    assert.throws(() => sanitizeInboundEvidence({ key: { id: 'x', remoteJid: '5511888888888@s.whatsapp.net' }, message: { conversation: 'x' } }, config), /peer_not_allowed/);
});

test('dedupe persistente aceita uma saída e bloqueia repetição', async () => {
    const { config } = await makeConfig();
    const clock = () => new Date('2026-09-12T15:20:00Z');
    const ledger = new ControlledCanaryLedger({ config, clock });
    const first = await ledger.reserveOutbound();
    assert.equal(first.accepted, true);
    await ledger.completeOutbound(first.reservationToken, 'provider-accepted-id');
    const second = await ledger.reserveOutbound();
    assert.deepEqual(second, { accepted: false, duplicate: true, status: 'SENT', providerSendCount: 0, dedupedAttempts: 1 });
    const raw = await fs.readFile(path.join(config.evidenceRoot, 'controlled-canary-ledger-v152-e-r1.json'), 'utf8');
    assert.equal(raw.includes(V152_E_FIXED_OUTBOUND_TEXT), false);
    assert.equal(raw.includes('provider-accepted-id'), false);
});

test('resultado ambíguo bloqueia retry automático', async () => {
    const { config } = await makeConfig();
    const ledger = new ControlledCanaryLedger({ config });
    const first = await ledger.reserveOutbound();
    const ambiguous = await ledger.markAmbiguous(first.reservationToken);
    assert.deepEqual(ambiguous, { status: 'AMBIGUOUS', retryAllowed: false });
    assert.deepEqual(await ledger.reserveOutbound(), { accepted: false, duplicate: true, status: 'AMBIGUOUS', providerSendCount: 0, dedupedAttempts: 1 });
});

test('ledger inbound aceita uma única mensagem e bloqueia repetição', async () => {
    const { config } = await makeConfig();
    const ledger = new ControlledCanaryLedger({ config });
    const evidence = sanitizeInboundEvidence({
        key: { id: 'provider-id-one', remoteJid: `${V152_E_ALLOWED_PEER_PHONE}@s.whatsapp.net`, fromMe: false },
        message: { conversation: 'controlled inbound' }
    }, config, new Date('2026-09-12T15:30:00Z'));
    assert.deepEqual(await ledger.recordInbound(evidence), { accepted: true, duplicate: false, status: 'OBSERVED' });
    assert.deepEqual(await ledger.recordInbound(evidence), { accepted: false, duplicate: true, status: 'OBSERVED' });
});

test('política V152-E mantém migração, handoff, failover e cutover bloqueados', () => {
    assert.deepEqual(v152EPolicyStatus(), {
        phase: 'V152-E-R1_REAL_PAIRING_TEST_CHANNEL',
        pairingPatch: 'V152-E-R2_NATIVE_PAIRING_CODE',
        realPairing: 'CONTROLLED_SINGLE_CHANNEL',
        realInbound: 'CONTROLLED_QA_ONLY',
        realOutbound: 'CONTROLLED_QA_SINGLE_MESSAGE',
        testChannelPhone: '5531983002800',
        customerMigration: false,
        customerRouting: false,
        handoff: false,
        failover: false,
        zapiShutdown: false,
        cutover: false,
        qrLogging: false,
        pairingCodePersistence: false,
        sessionInsideRelease: false
    });
});

test('projeção Connections R1 mantém canal de teste shadow e inelegível', () => {
    const channels = ChannelRegistry.v152ER1Projection({ connected: true });
    const testChannel = channels.find((channel) => channel.channelId === 'V152_TEST_WEB_01');
    assert.deepEqual({
        phoneNumber: testChannel.phoneNumber,
        provider: testChannel.provider,
        status: testChannel.status,
        health: testChannel.health,
        shadow: testChannel.shadow,
        draining: testChannel.draining,
        weight: testChannel.weight,
        capacity: testChannel.capacity
    }, {
        phoneNumber: '5531983002800',
        provider: 'WHATSAPP_WEB',
        status: 'CONNECTED',
        health: { healthy: true, detail: 'PASS' },
        shadow: true,
        draining: true,
        weight: 0,
        capacity: 0
    });
    assert.equal(isEligibleChannel(testChannel), false);
});

test('helper não usa terminal QR, conexão legada ou texto arbitrário', async () => {
    const source = await fs.readFile(new URL('../scripts/v152-e-controlled-pairing.mjs', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /qrcode-terminal|qrcodeTerminal|startWhatsApp|connection\.js/);
    assert.match(source, /printQRInTerminal:\s*false/);
    assert.match(source, /new SessionManager/);
    assert.match(source, /v152_e_session_manager_directory_mismatch/);
    assert.doesNotMatch(source, /console\.(log|info|debug)/);
    assert.doesNotMatch(source, /process\.argv\[[34]\].*text/i);
    assert.doesNotMatch(source, /qr(File|Bytes|Sha256):/);
    assert.match(source, /assertPairedPhoneAllowed\(ownPhone\(\), config\)[\s\S]*logout/);
    assert.match(source, /logout[\s\S]*fs\.rm\(config\.sessionDirectory/);
    assert.match(source, /catch \(error\) \{[\s\S]*removeEphemeralQr\(config\)\.catch\(\(\) => \{\}\)/);
    assert.match(source, /requestPairingCode\(config\.testChannelPhone\)/);
    assert.match(source, /command === 'pair-code'/);
    assert.match(source, /pairingCodePersisted:\s*false/);
    assert.match(source, /state\.creds\.pairingCode\s*&&\s*!state\.creds\.registered[\s\S]*return/);
    assert.match(source, /removePairingCodeSecret\(authState\.creds\)[\s\S]*saveCredentials\(\)/);
    assert.doesNotMatch(source, /writeJsonAtomic\([^\n]+pairingCode/);
});
