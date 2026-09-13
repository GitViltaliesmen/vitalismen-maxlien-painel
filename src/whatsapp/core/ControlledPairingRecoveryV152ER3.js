import fs from 'node:fs/promises';
import path from 'node:path';
import { jidDecode, jidNormalizedUser } from '@whiskeysockets/baileys';
import { isBrazilNinthDigitVariant } from './phoneIdentity.js';

export const V152_E_R3_PAIRING_PATCH = 'V152-E-R3_BR_JID_NORMALIZATION_AND_AUTH_FLUSH_GATE';
export const V152_E_R3_BAILEYS_VERSION = '6.7.24';
export const V152_E_R3_RESTART_REQUIRED = 515;
export const V152_E_R3_KEY_STORE_REQUIRED_AT_515 = false;
export const V152_E_R3_KEY_STORE_REQUIRED_BEFORE_RESTART = false;

const USER_JID_SERVERS = new Set(['s.whatsapp.net', 'c.us']);
const BAILEYS_IDENTITY_SOURCES = new Set(['BAILEYS_SOCKET_USER', 'BAILEYS_CREDS_ME']);
const digits = (value) => String(value || '').replace(/\D/g, '');
const hasOwn = (value, key) => Boolean(value && typeof value === 'object' && Object.hasOwn(value, key));

const providerBindingIsAuthoritative = (evidence = {}) => BAILEYS_IDENTITY_SOURCES.has(String(evidence.source || ''))
    && evidence.providerAddressObserved === true
    && evidence.authenticatedProviderAddress === true
    && String(evidence.authorizedChannelId || '') !== ''
    && String(evidence.authorizedChannelId) === String(evidence.observedChannelId || '');

const decodeProviderAddress = (providerAddress) => {
    const raw = String(providerAddress || '').trim();
    if (!raw.includes('@')) {
        const user = digits(raw);
        return Object.freeze({
            providerAddressKind: 'INPUT_PHONE',
            providerBoundPhone: user,
            providerJid: '',
            deviceJid: '',
            server: '',
            hasDevice: false
        });
    }

    const decoded = jidDecode(raw);
    if (!decoded?.user || !USER_JID_SERVERS.has(String(decoded.server || ''))) {
        return Object.freeze({
            providerAddressKind: 'UNSUPPORTED_JID',
            providerBoundPhone: '',
            providerJid: '',
            deviceJid: raw,
            server: String(decoded?.server || ''),
            hasDevice: decoded?.device !== undefined
        });
    }

    const normalizedJid = jidNormalizedUser(raw);
    const normalized = jidDecode(normalizedJid);
    return Object.freeze({
        providerAddressKind: decoded.device === undefined ? 'PROVIDER_JID' : 'DEVICE_JID',
        providerBoundPhone: digits(normalized?.user),
        providerJid: normalizedJid,
        deviceJid: raw,
        server: String(normalized?.server || ''),
        hasDevice: decoded.device !== undefined
    });
};

export const compareCanonicalPhoneIdentity = ({
    inputPhone,
    providerAddress,
    displayPhone = inputPhone,
    evidence = {}
} = {}) => {
    const canonicalPhone = digits(inputPhone);
    const display = digits(displayPhone);
    const provider = decodeProviderAddress(providerAddress);
    const exact = Boolean(canonicalPhone) && canonicalPhone === provider.providerBoundPhone;
    const brazilProviderBoundAlias = isBrazilNinthDigitVariant(canonicalPhone, provider.providerBoundPhone);
    const providerJidSupplied = provider.providerAddressKind !== 'INPUT_PHONE';
    const authoritativeBinding = providerJidSupplied && providerBindingIsAuthoritative(evidence);
    const equivalent = exact
        ? (!providerJidSupplied || authoritativeBinding)
        : (brazilProviderBoundAlias && authoritativeBinding);

    return Object.freeze({
        canonicalPhone,
        e164: canonicalPhone ? `+${canonicalPhone}` : '',
        providerBoundPhone: provider.providerBoundPhone,
        providerJid: provider.providerJid,
        deviceJid: provider.deviceJid,
        displayPhone: display ? `+${display}` : '',
        providerAddressKind: provider.providerAddressKind,
        equivalent,
        status: equivalent ? 'PASS' : 'FAIL',
        method: exact ? 'EXACT' : (brazilProviderBoundAlias ? 'BR_PROVIDER_BOUND_WITH_AUTHENTICATED_BAILEYS_EVIDENCE' : 'NONE'),
        authoritativeBinding
    });
};

const REQUIRED_AUTH_FIELDS = Object.freeze([
    'noiseKey',
    'signedIdentityKey',
    'signedPreKey',
    'registrationId',
    'advSecretKey',
    'nextPreKeyId',
    'firstUnuploadedPreKeyId',
    'account',
    'me',
    'signalIdentities'
]);

export const inspectBaileysAuthStateForRestart = (creds = {}) => {
    const missingFields = REQUIRED_AUTH_FIELDS.filter((field) => !hasOwn(creds, field));
    if (!String(creds?.me?.id || '').includes('@')) missingFields.push('me.id');
    if (!Array.isArray(creds?.signalIdentities) || creds.signalIdentities.length === 0) {
        missingFields.push('signalIdentities[]');
    }
    return Object.freeze({
        baileysVersion: V152_E_R3_BAILEYS_VERSION,
        structurallyComplete: missingFields.length === 0,
        registrationMetadataPresent: hasOwn(creds, 'registrationId')
            && hasOwn(creds, 'advSecretKey')
            && hasOwn(creds, 'nextPreKeyId')
            && hasOwn(creds, 'firstUnuploadedPreKeyId'),
        deviceIdentityMetadataPresent: hasOwn(creds, 'account')
            && hasOwn(creds, 'me')
            && Array.isArray(creds.signalIdentities)
            && creds.signalIdentities.length > 0,
        keyStoreRequiredAt515: V152_E_R3_KEY_STORE_REQUIRED_AT_515,
        keyStoreRequiredBeforeRestart: V152_E_R3_KEY_STORE_REQUIRED_BEFORE_RESTART,
        missingFields: Object.freeze([...new Set(missingFields)])
    });
};

const persistedCredsReader = async (sessionDirectory) => {
    const target = path.join(sessionDirectory, 'creds.json');
    return JSON.parse(await fs.readFile(target, 'utf8'));
};

export class V152EAuthFlushEventGate {
    constructor({
        sessionDirectory,
        expectedSessionDirectory = sessionDirectory,
        saveCreds,
        hardenSession,
        readPersistedCreds = persistedCredsReader
    } = {}) {
        if (!path.isAbsolute(String(sessionDirectory || ''))) throw new Error('v152_e_r3_session_path_absolute_required');
        if (typeof saveCreds !== 'function') throw new Error('v152_e_r3_save_creds_required');
        if (typeof hardenSession !== 'function') throw new Error('v152_e_r3_harden_session_required');
        if (typeof readPersistedCreds !== 'function') throw new Error('v152_e_r3_read_persisted_creds_required');
        this.sessionDirectory = path.resolve(sessionDirectory);
        this.expectedSessionDirectory = path.resolve(expectedSessionDirectory);
        this.saveCreds = saveCreds;
        this.hardenSession = hardenSession;
        this.readPersistedCreds = readPersistedCreds;
        this.credsUpdateObserved = false;
        this.deviceIdentityUpdateObserved = false;
        this.pendingAuthWrites = 0;
        this.requestedAuthWrites = 0;
        this.completedAuthWrites = 0;
        this.authStateWriteCompleted = false;
        this.latestCreds = null;
        this.writeChain = Promise.resolve();
    }

    observeCredsUpdate(update, creds, { persist = true } = {}) {
        this.credsUpdateObserved = true;
        this.latestCreds = creds;
        if (hasOwn(update, 'account') && hasOwn(update, 'me') && Array.isArray(update?.signalIdentities)) {
            this.deviceIdentityUpdateObserved = true;
        }
        if (!persist) return this.writeChain;

        const writeNumber = ++this.requestedAuthWrites;
        this.pendingAuthWrites += 1;
        this.writeChain = this.writeChain.then(async () => {
            await this.saveCreds();
            await this.hardenSession(this.sessionDirectory);
            this.completedAuthWrites = writeNumber;
            this.authStateWriteCompleted = true;
        }).finally(() => {
            this.pendingAuthWrites -= 1;
        });
        return this.writeChain;
    }

    async waitForAllWrites() {
        for (;;) {
            const observedChain = this.writeChain;
            await observedChain;
            if (observedChain === this.writeChain && this.pendingAuthWrites === 0) return;
        }
    }

    async assertRestartReady({ statusCode, currentSessionDirectory = this.sessionDirectory } = {}) {
        if (Number(statusCode) !== V152_E_R3_RESTART_REQUIRED) {
            throw new Error('v152_e_r3_restart_gate_wrong_disconnect_reason');
        }
        await this.waitForAllWrites();
        if (path.resolve(currentSessionDirectory) !== this.expectedSessionDirectory
            || this.sessionDirectory !== this.expectedSessionDirectory) {
            throw new Error('v152_e_r3_restart_gate_session_path_mismatch');
        }
        if (!this.credsUpdateObserved) throw new Error('v152_e_r3_restart_gate_creds_update_missing');
        if (!this.deviceIdentityUpdateObserved) throw new Error('v152_e_r3_restart_gate_device_identity_update_missing');
        if (!this.authStateWriteCompleted) throw new Error('v152_e_r3_restart_gate_auth_write_unproven');
        if (this.pendingAuthWrites !== 0 || this.completedAuthWrites !== this.requestedAuthWrites) {
            throw new Error('v152_e_r3_restart_gate_pending_auth_writes');
        }
        const persisted = await this.readPersistedCreds(this.sessionDirectory);
        if (!inspectBaileysAuthStateForRestart(persisted).structurallyComplete) {
            throw new Error('v152_e_r3_persisted_auth_state_incomplete');
        }
        if (!inspectBaileysAuthStateForRestart(this.latestCreds).structurallyComplete) {
            throw new Error('v152_e_r3_in_memory_auth_state_incomplete');
        }
        return Object.freeze({
            restartAllowed: true,
            disconnectReason: 'RESTART_REQUIRED',
            credsUpdateObserved: true,
            saveCredsCompleted: true,
            authStateWriteCompleted: true,
            sessionPathConsistent: true,
            pendingAuthWrites: 0,
            keyStoreRequiredAt515: V152_E_R3_KEY_STORE_REQUIRED_AT_515,
            keyStoreRequiredBeforeRestart: V152_E_R3_KEY_STORE_REQUIRED_BEFORE_RESTART
        });
    }
}
