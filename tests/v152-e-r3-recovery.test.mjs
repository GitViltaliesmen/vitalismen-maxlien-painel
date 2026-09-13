import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    V152_E_FORBIDDEN_PAIRED_PHONES,
    V152_E_TEST_CHANNEL_PHONE,
    assertPairedPhoneAllowed
} from '../src/whatsapp/core/ControlledRealPairingV152E.js';
import {
    V152EAuthFlushEventGate,
    V152_E_R3_BAILEYS_VERSION,
    V152_E_R3_KEY_STORE_REQUIRED_AT_515,
    V152_E_R3_KEY_STORE_REQUIRED_BEFORE_RESTART,
    compareCanonicalPhoneIdentity,
    inspectBaileysAuthStateForRestart
} from '../src/whatsapp/core/ControlledPairingRecoveryV152ER3.js';

const syntheticBrazil = Object.freeze({
    canonical: '5511912345678',
    providerUser: '551112345678',
    differentUser: '551187654321'
});

const baileysEvidence = Object.freeze({
    source: 'BAILEYS_SOCKET_USER',
    providerAddressObserved: true,
    authenticatedProviderAddress: true,
    authorizedChannelId: 'SYNTHETIC_BR_CHANNEL',
    observedChannelId: 'SYNTHETIC_BR_CHANNEL'
});

const minimumCreds = () => ({
    noiseKey: { private: {}, public: {} },
    signedIdentityKey: { private: {}, public: {} },
    signedPreKey: { keyPair: {}, signature: {}, keyId: 1 },
    registrationId: 1,
    advSecretKey: 'fixture-not-a-secret',
    nextPreKeyId: 1,
    firstUnuploadedPreKeyId: 1,
    account: { details: {} },
    me: { id: `${syntheticBrazil.providerUser}:7@s.whatsapp.net` },
    signalIdentities: [{ identifier: { name: syntheticBrazil.providerUser } }],
    registered: false
});

const makeGate = async ({ events = [], creds = minimumCreds() } = {}) => {
    const sessionDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'v152-e-r3-auth-'));
    const saveCreds = async () => {
        events.push('SAVE_CREDS_COMPLETED');
        await fs.writeFile(path.join(sessionDirectory, 'creds.json'), JSON.stringify(creds));
    };
    const gate = new V152EAuthFlushEventGate({
        sessionDirectory,
        saveCreds,
        hardenSession: async () => events.push('AUTH_STATE_WRITE_COMPLETED')
    });
    return { gate, sessionDirectory, creds };
};

test('equivalência BR aceita somente JID autenticado pelo Baileys', () => {
    const deviceJid = `${syntheticBrazil.providerUser}:7@s.whatsapp.net`;
    const proof = compareCanonicalPhoneIdentity({
        inputPhone: syntheticBrazil.canonical,
        providerAddress: deviceJid,
        evidence: baileysEvidence
    });
    assert.equal(proof.status, 'PASS');
    assert.equal(proof.method, 'BR_PROVIDER_BOUND_WITH_AUTHENTICATED_BAILEYS_EVIDENCE');
    assert.equal(proof.providerAddressKind, 'DEVICE_JID');
    assert.equal(proof.providerJid, `${syntheticBrazil.providerUser}@s.whatsapp.net`);
    assert.equal(proof.providerBoundPhone, syntheticBrazil.providerUser);
    assert.equal(compareCanonicalPhoneIdentity({
        inputPhone: syntheticBrazil.canonical,
        providerAddress: deviceJid,
        evidence: {}
    }).status, 'FAIL');
});

test('assinante BR diferente não colide mesmo com evidência do provider', () => {
    const proof = compareCanonicalPhoneIdentity({
        inputPhone: syntheticBrazil.canonical,
        providerAddress: `${syntheticBrazil.differentUser}@s.whatsapp.net`,
        evidence: baileysEvidence
    });
    assert.equal(proof.status, 'FAIL');
    assert.equal(proof.method, 'NONE');
});

test('JID de dispositivo vira JID base e número estrangeiro mantém semântica exata', () => {
    const foreign = '593991234567';
    const device = compareCanonicalPhoneIdentity({
        inputPhone: foreign,
        providerAddress: `${foreign}:19@s.whatsapp.net`,
        evidence: baileysEvidence
    });
    assert.equal(device.status, 'PASS');
    assert.equal(device.providerJid, `${foreign}@s.whatsapp.net`);
    assert.equal(compareCanonicalPhoneIdentity({
        inputPhone: foreign,
        providerAddress: '593991234568@s.whatsapp.net',
        evidence: baileysEvidence
    }).status, 'FAIL');
});

test('números configurados preservam canonicalização sem alterar dados reais', () => {
    assert.equal(compareCanonicalPhoneIdentity({
        inputPhone: V152_E_TEST_CHANNEL_PHONE,
        providerAddress: V152_E_TEST_CHANNEL_PHONE
    }).status, 'PASS');
    for (const phone of V152_E_FORBIDDEN_PAIRED_PHONES.slice(0, 2)) {
        assert.equal(compareCanonicalPhoneIdentity({ inputPhone: phone, providerAddress: phone }).status, 'PASS');
    }
});

test('guard do canal aceita alias autenticado e continua bloqueando linha proibida', () => {
    const config = {
        testChannelPhone: syntheticBrazil.canonical,
        forbiddenPairedPhones: ['5511999999999']
    };
    assert.equal(assertPairedPhoneAllowed(`${syntheticBrazil.providerUser}:7@s.whatsapp.net`, config, {
        evidence: baileysEvidence
    }), syntheticBrazil.canonical);
    assert.throws(() => assertPairedPhoneAllowed('5511999999999@s.whatsapp.net', config, {
        evidence: baileysEvidence
    }), /same_phone_dual_provider_forbidden/);
});

test('Baileys 6.7.24 não exige key store no 515 nem antes do primeiro restart', () => {
    const inspection = inspectBaileysAuthStateForRestart(minimumCreds());
    assert.equal(V152_E_R3_BAILEYS_VERSION, '6.7.24');
    assert.equal(inspection.structurallyComplete, true);
    assert.equal(inspection.registrationMetadataPresent, true);
    assert.equal(inspection.deviceIdentityMetadataPresent, true);
    assert.equal(V152_E_R3_KEY_STORE_REQUIRED_AT_515, false);
    assert.equal(V152_E_R3_KEY_STORE_REQUIRED_BEFORE_RESTART, false);
});

test('gate 515 aguarda saveCreds, escrita estrutural e ausência de writes pendentes', async () => {
    const events = [];
    const { gate, creds } = await makeGate({ events });
    events.push('CREDS_UPDATE');
    gate.observeCredsUpdate({ account: creds.account, me: creds.me, signalIdentities: creds.signalIdentities }, creds);
    const receipt = await gate.assertRestartReady({ statusCode: 515 });
    events.push('RESTART');
    assert.deepEqual(events, [
        'CREDS_UPDATE',
        'SAVE_CREDS_COMPLETED',
        'AUTH_STATE_WRITE_COMPLETED',
        'RESTART'
    ]);
    assert.deepEqual(receipt, {
        restartAllowed: true,
        disconnectReason: 'RESTART_REQUIRED',
        credsUpdateObserved: true,
        saveCredsCompleted: true,
        authStateWriteCompleted: true,
        sessionPathConsistent: true,
        pendingAuthWrites: 0,
        keyStoreRequiredAt515: false,
        keyStoreRequiredBeforeRestart: false
    });
});

test('gate 515 falha fechado sem identidade, flush ou path consistente', async () => {
    const first = await makeGate();
    await assert.rejects(first.gate.assertRestartReady({ statusCode: 515 }), /creds_update_missing/);

    const second = await makeGate();
    second.gate.observeCredsUpdate({ routingInfo: {} }, second.creds);
    await assert.rejects(second.gate.assertRestartReady({ statusCode: 515 }), /device_identity_update_missing/);

    const third = await makeGate();
    third.gate.observeCredsUpdate({
        account: third.creds.account,
        me: third.creds.me,
        signalIdentities: third.creds.signalIdentities
    }, third.creds);
    await assert.rejects(third.gate.assertRestartReady({
        statusCode: 515,
        currentSessionDirectory: path.join(third.sessionDirectory, 'other')
    }), /session_path_mismatch/);
});
