import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    CANARY_V75_QA_PHONE,
    CANARY_V75_RECIPIENT_LIST_FLAGS,
    resolveCanaryV75Configuration
} from '../../src/services/canaryIsolationV75Service.js';
import {
    resolveCanaryControllerV77Runtime
} from '../../src/services/canaryControllerV77Service.js';
import {
    parseCanaryControllerV77Overlay
} from './canary-controller-contract-v77.mjs';

export const CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_VERSION = 77;
export const CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_QA_PHONE = '5515998038637';
export const CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PROCESS = 'vitalismen-automation';
export const CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_CWD = '/opt/vitalismen-automacao/current';
export const CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_EXEC = '/opt/vitalismen-automacao/current/src/index.js';

const canonicalJson = (value) => JSON.stringify(value);
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

const clean = (value = '') => String(value ?? '').trim();

export const parsePm2JlistV77H = (input) => {
    const source = String(input ?? '');
    if (source.trim().length === 0) throw new Error('pm2_jlist_empty');

    let parsed;
    try {
        parsed = JSON.parse(source);
    } catch {
        throw new Error('pm2_jlist_invalid_or_truncated');
    }
    if (!Array.isArray(parsed)) throw new Error('pm2_jlist_not_array');
    return parsed;
};

const normalizedExternalProcess = (entry = {}) => ({
    name: clean(entry.name),
    status: clean(entry.pm2_env?.status),
    pid: Number(entry.pid || 0),
    cwd: clean(entry.pm2_env?.pm_cwd),
    exec: clean(entry.pm2_env?.pm_exec_path)
});

export const calculatePm2ExternalFingerprintV77H = (
    entries,
    processName = CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PROCESS
) => {
    if (!Array.isArray(entries)) throw new Error('pm2_entries_invalid');
    const external = entries
        .filter((entry) => clean(entry?.name) !== clean(processName))
        .map(normalizedExternalProcess)
        .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
    return hash(canonicalJson(external));
};

export const assertRootOnlyArtifactV77H = (stat, { mode, label = 'artifact' } = {}) => {
    if (!stat || typeof stat !== 'object') throw new Error(`${label}_stat_invalid`);
    if (stat.isSymbolicLink === true) throw new Error(`${label}_symlink_forbidden`);
    if (Number(stat.uid) !== 0 || Number(stat.gid) !== 0) throw new Error(`${label}_owner_invalid`);
    if ((Number(stat.mode) & 0o777) !== Number(mode)) throw new Error(`${label}_mode_invalid`);
    return true;
};

const assertCanaryProfile = (env, nowMs) => {
    const controller = resolveCanaryControllerV77Runtime(env, { nowMs });
    if (!controller.ready) {
        throw new Error(`canary_controller_invalid:${controller.failures.join(',')}`);
    }
    const canary = resolveCanaryV75Configuration(env);
    if (!canary.ready) throw new Error(`canary_isolation_invalid:${canary.failures.join(',')}`);
    if (canary.qaPhone !== CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_QA_PHONE) {
        throw new Error('qa_phone_invalid');
    }
    if (CANARY_V75_QA_PHONE !== CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_QA_PHONE) {
        throw new Error('qa_phone_contract_divergent');
    }
    if (CANARY_V75_RECIPIENT_LIST_FLAGS.length !== 5) throw new Error('recipient_allowlist_count_invalid');
    for (const key of CANARY_V75_RECIPIENT_LIST_FLAGS) {
        if (env[key] !== CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_QA_PHONE) {
            throw new Error(`recipient_allowlist_invalid:${key}`);
        }
    }
};

export const verifyCandidatePm2CanaryV77H = ({
    entries,
    processName = CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PROCESS,
    overlay,
    candidateDir,
    procCwd,
    expectedExternalFingerprint,
    nowMs = Date.now()
}) => {
    if (!Array.isArray(entries)) throw new Error('pm2_entries_invalid');
    const targets = entries.filter((entry) => clean(entry?.name) === clean(processName));
    if (targets.length !== 1) throw new Error(`pm2_target_count_invalid:${targets.length}`);

    const target = targets[0];
    const actual = target.pm2_env || {};
    if (clean(actual.status) !== 'online') throw new Error('pm2_target_not_online');
    if (!Number.isInteger(Number(target.pid)) || Number(target.pid) <= 0) throw new Error('pm2_target_pid_invalid');
    if (clean(actual.pm_cwd) !== CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_CWD) {
        throw new Error('pm2_target_cwd_invalid');
    }
    if (clean(actual.pm_exec_path) !== CANARY_CONTROLLER_PM2_STDIN_HOTFIX_V77H_PM_EXEC) {
        throw new Error('pm2_target_exec_invalid');
    }

    const expected = typeof overlay === 'string'
        ? parseCanaryControllerV77Overlay(overlay)
        : { ...(overlay || {}) };
    if (Object.keys(expected).length === 0) throw new Error('overlay_empty');
    for (const [key, value] of Object.entries(expected)) {
        if (String(actual[key] ?? '') !== String(value)) throw new Error(`pm2_overlay_mismatch:${key}`);
    }
    assertCanaryProfile(expected, nowMs);

    const normalizedCandidate = path.posix.normalize(clean(candidateDir).replaceAll('\\', '/'));
    const normalizedProcCwd = path.posix.normalize(clean(procCwd).replaceAll('\\', '/'));
    if (!normalizedCandidate.startsWith('/opt/vitalismen-automacao/releases/')) {
        throw new Error('candidate_release_path_invalid');
    }
    if (normalizedProcCwd !== normalizedCandidate) throw new Error('process_runtime_cwd_invalid');
    if (path.posix.basename(normalizedCandidate) !== expected.VITALISMEN_CANARY_V77_RELEASE) {
        throw new Error('candidate_release_identity_invalid');
    }

    const actualExternalFingerprint = calculatePm2ExternalFingerprintV77H(entries, processName);
    if (!/^[0-9a-f]{64}$/.test(clean(expectedExternalFingerprint))) {
        throw new Error('external_pm2_fingerprint_expected_invalid');
    }
    if (actualExternalFingerprint !== clean(expectedExternalFingerprint)) {
        throw new Error('external_pm2_fingerprint_changed');
    }

    return Object.freeze({
        ok: true,
        pid: Number(target.pid),
        externalFingerprint: actualExternalFingerprint,
        overlayKeyCount: Object.keys(expected).length,
        allowlistCount: CANARY_V75_RECIPIENT_LIST_FLAGS.length
    });
};

const readStdinFully = () => fs.readFileSync(0, 'utf8');

const runCli = () => {
    const [action, ...args] = process.argv.slice(2);
    const entries = parsePm2JlistV77H(readStdinFully());

    if (action === 'parse-stdin') {
        process.stdout.write(`PM2_JSON_COUNT=${entries.length}\n`);
        return;
    }
    if (action === 'fingerprint-others') {
        if (args.length !== 1) throw new Error('usage_fingerprint_others_invalid');
        process.stdout.write(`${calculatePm2ExternalFingerprintV77H(entries, args[0])}\n`);
        return;
    }
    if (action === 'verify') {
        if (args.length !== 4) throw new Error('usage_verify_invalid');
        const [processName, overlayPath, candidateDir, expectedExternalFingerprint] = args;
        const overlayStat = fs.lstatSync(overlayPath);
        assertRootOnlyArtifactV77H({
            uid: overlayStat.uid,
            gid: overlayStat.gid,
            mode: overlayStat.mode,
            isSymbolicLink: overlayStat.isSymbolicLink()
        }, { mode: 0o400, label: 'canary_overlay' });
        const overlay = fs.readFileSync(overlayPath, 'utf8');
        const targets = entries.filter((entry) => clean(entry?.name) === clean(processName));
        const pid = Number(targets[0]?.pid || 0);
        const procCwd = pid > 0 ? fs.realpathSync(`/proc/${pid}/cwd`) : '';
        const result = verifyCandidatePm2CanaryV77H({
            entries,
            processName,
            overlay,
            candidateDir,
            procCwd,
            expectedExternalFingerprint
        });
        process.stdout.write(
            `PM2_V77_ENV=VALID\nPM2_TARGET_COUNT=1\nPM2_EXTERNAL_FINGERPRINT=${result.externalFingerprint}\n`
        );
        return;
    }
    throw new Error('action_invalid');
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        runCli();
    } catch (error) {
        process.stderr.write(`CANARY_PM2_V77H_FAIL=${error.message}\n`);
        process.exitCode = 1;
    }
}
