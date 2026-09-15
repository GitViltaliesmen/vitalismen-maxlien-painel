#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectBaileysAuthStateForRestart } from '../src/whatsapp/core/ControlledPairingRecoveryV152ER3.js';
import { ensureSecureDirectory, writeJsonAtomic } from '../src/whatsapp/core/ControlledRealPairingV152E.js';

process.umask(0o077);

const PHASE = 'V152-E-R3_BR_JID_NORMALIZATION_AND_AUTH_FLUSH_GATE';
const EXPECTED_SESSION_PATH = '/var/lib/vitalismen-whatsapp-web-sessions/V152_TEST_WEB_01';
const EXPECTED_EVIDENCE_ROOT = '/var/lib/vitalismen-v152-e-evidence';
const RECEIPT_NAME = 'V152_E_R3_PARTIAL_SESSION_METADATA_RECEIPT_20260912.json';
const CONFIRMATION = 'CONFIRM_V152_E_R3_INVALID_PARTIAL_SESSION_CLEANUP';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fail = (code) => { throw new Error(code); };

if (process.platform !== 'linux' || process.getuid?.() !== 0) fail('v152_e_r3_cleanup_root_vps_required');
if (String(process.argv[2] || '') !== CONFIRMATION) fail('v152_e_r3_cleanup_confirmation_required');
if (String(process.env.V152_E_R3_PARTIAL_SESSION_LOGGED_OUT_401_CONFIRMED || '') !== 'true') {
    fail('v152_e_r3_logged_out_401_confirmation_required');
}

const sessionPath = path.resolve(String(process.env.V152_E_R3_PARTIAL_SESSION_PATH || EXPECTED_SESSION_PATH));
const evidenceRoot = path.resolve(String(process.env.V152_E_EVIDENCE_ROOT || EXPECTED_EVIDENCE_ROOT));
if (sessionPath !== EXPECTED_SESSION_PATH) fail('v152_e_r3_cleanup_path_mismatch');
if (evidenceRoot !== EXPECTED_EVIDENCE_ROOT) fail('v152_e_r3_cleanup_evidence_path_mismatch');

const processList = execFileSync('ps', ['-eo', 'args='], { encoding: 'utf8' });
if (processList.split(/\r?\n/).some((line) => /v152-e-controlled-pairing\.mjs\s+(pair|pair-code|status)/.test(line))) {
    fail('v152_e_r3_pairing_socket_running');
}

const rootStat = await fs.lstat(sessionPath);
if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('v152_e_r3_cleanup_session_root_invalid');
if (rootStat.uid !== 0 || rootStat.gid !== 0) fail('v152_e_r3_cleanup_owner_invalid');
if ((rootStat.mode & 0o777) !== 0o700) fail('v152_e_r3_cleanup_mode_invalid');
if (await fs.realpath(sessionPath) !== sessionPath) fail('v152_e_r3_cleanup_realpath_mismatch');

const entries = await fs.readdir(sessionPath, { withFileTypes: true });
const fileEntries = entries.filter((entry) => entry.isFile());
const directoryEntries = entries.filter((entry) => entry.isDirectory());
const symlinkEntries = entries.filter((entry) => entry.isSymbolicLink());
if (entries.length !== 1 || fileEntries.length !== 1 || fileEntries[0].name !== 'creds.json') {
    fail('v152_e_r3_cleanup_unexpected_session_contents');
}
if (directoryEntries.length !== 0 || symlinkEntries.length !== 0) fail('v152_e_r3_cleanup_unsafe_session_contents');

const credsPath = path.join(sessionPath, 'creds.json');
const credsStat = await fs.lstat(credsPath);
if (!credsStat.isFile() || credsStat.isSymbolicLink()) fail('v152_e_r3_cleanup_creds_invalid');
if (credsStat.uid !== 0 || credsStat.gid !== 0 || (credsStat.mode & 0o777) !== 0o600) {
    fail('v152_e_r3_cleanup_creds_permissions_invalid');
}
const creds = JSON.parse(await fs.readFile(credsPath, 'utf8'));
if (!inspectBaileysAuthStateForRestart(creds).structurallyComplete) fail('v152_e_r3_cleanup_creds_structure_invalid');

const receipt = Object.freeze({
    phase: PHASE,
    path: sessionPath,
    fileCount: fileEntries.length,
    directoryCount: directoryEntries.length,
    symlinkCount: symlinkEntries.length,
    owner: 'root:root',
    mode: '700',
    mtime: rootStat.mtime.toISOString(),
    reason: 'loggedOut_401',
    partialSessionReusable: false,
    sessionConnected: false,
    pairingSocketRunning: false,
    secretsIncluded: false
});

await ensureSecureDirectory(evidenceRoot);
const receiptPath = path.join(evidenceRoot, RECEIPT_NAME);
await writeJsonAtomic(receiptPath, receipt);
const receiptSha256 = sha256(await fs.readFile(receiptPath));

await fs.unlink(credsPath);
await fs.rmdir(sessionPath);
const partialSessionExists = await fs.lstat(sessionPath).then(() => true).catch((error) => {
    if (error?.code === 'ENOENT') return false;
    throw error;
});
if (partialSessionExists) fail('v152_e_r3_cleanup_postcondition_failed');

process.stdout.write(`${JSON.stringify({
    phase: PHASE,
    event: 'INVALID_PARTIAL_SESSION_CLEANUP_PASS',
    receiptPath,
    receiptSha256,
    partialSessionRemoved: true,
    filesRemoved: 1,
    pairingRequests: 0,
    whatsappWebProviderCalls: 0,
    secretsPrinted: false
})}\n`);
