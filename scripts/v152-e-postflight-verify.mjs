#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureSecureDirectory, writeJsonAtomic } from '../src/whatsapp/core/ControlledRealPairingV152E.js';

const PHASE = 'V152_E_CONTROLLED_REAL_PAIRING';
const OFFICIAL_CURRENT = '/opt/vitalismen-automacao/current';
const DEFAULT_EVIDENCE_ROOT = '/var/lib/vitalismen-v152-e-evidence';
const DEFAULT_HEALTH_URL = 'http://127.0.0.1:3001/api/health/';

const sha256File = async (target) => {
    const data = await fs.readFile(target);
    return crypto.createHash('sha256').update(data).digest('hex');
};

const currentFingerprints = async (baseline) => {
    const result = {};
    for (const [label, entry] of Object.entries(baseline)) {
        const target = String(entry?.path || '');
        if (!path.isAbsolute(target)) throw new Error(`v152_e_invalid_baseline_path_${label}`);
        result[label] = { path: target, sha256: await sha256File(target) };
    }
    return result;
};

const sanitizedPm2 = (releaseRoot) => {
    const processes = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
    const matches = processes.filter((entry) => entry?.name === 'vitalismen-automation');
    if (matches.length !== 1) throw new Error('v152_e_exactly_one_official_pm2_process_required');
    const entry = matches[0];
    const pmCwd = String(entry.pm2_env?.pm_cwd || '');
    const pmExecPath = String(entry.pm2_env?.pm_exec_path || '');
    if (entry.pm2_env?.status !== 'online') throw new Error('v152_e_official_pm2_not_online');
    if (path.resolve(fsSync.realpathSync(pmCwd)) !== path.resolve(releaseRoot)) {
        throw new Error('v152_e_pm2_cwd_not_active_release');
    }
    if (!path.resolve(fsSync.realpathSync(pmExecPath)).startsWith(`${path.resolve(releaseRoot)}${path.sep}`)) {
        throw new Error('v152_e_pm2_exec_not_active_release');
    }
    return {
        name: entry.name,
        status: entry.pm2_env.status,
        pid: Number(entry.pid || 0),
        pmCwd,
        pmExecPath
    };
};

const sanitizedHealth = async () => {
    const response = await fetch(String(process.env.V152_E_HEALTH_URL || DEFAULT_HEALTH_URL), {
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`v152_e_health_http_${response.status}`);
    const body = await response.json();
    const health = {
        http: response.status,
        status: String(body.status || ''),
        engine: String(body.whatsapp?.engine || body.engine || ''),
        zapiConnected: Boolean(body.whatsapp?.zapi?.connected ?? body.zapi?.connected ?? body.zapiConnected),
        degradedReasons: Array.isArray(body.degradedReasons) ? body.degradedReasons.map(String) : []
    };
    if (health.status !== 'online' || health.engine !== 'Z-API' || !health.zapiConnected) {
        throw new Error('v152_e_zapi_postflight_not_healthy');
    }
    return health;
};

if (process.platform !== 'linux') throw new Error('v152_e_postflight_linux_vps_required');
if (process.getuid?.() !== 0) throw new Error('v152_e_postflight_root_required');
if (String(process.env.V152_E_CONTROLLED_REAL_PAIRING_APPROVED || '') !== 'true') {
    throw new Error('v152_e_explicit_pairing_approval_required');
}

const evidenceRoot = path.resolve(String(process.env.V152_E_EVIDENCE_ROOT || DEFAULT_EVIDENCE_ROOT));
if (evidenceRoot === '/' || evidenceRoot.startsWith(`${OFFICIAL_CURRENT}/`)) {
    throw new Error('v152_e_evidence_root_invalid');
}

const baselinePath = path.join(evidenceRoot, 'pre-pairing-snapshot.json');
const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
if (baseline.phase !== PHASE || baseline.snapshotType !== 'PRE_PAIRING_BASELINE') {
    throw new Error('v152_e_preflight_snapshot_invalid');
}

const activeRelease = await fs.realpath(OFFICIAL_CURRENT);
if (activeRelease !== baseline.activeRelease || activeRelease !== baseline.rollbackRelease) {
    throw new Error('v152_e_active_release_changed');
}
const fingerprints = await currentFingerprints(baseline.frozenFingerprints);
const changedFingerprints = Object.keys(fingerprints).filter(
    (label) => fingerprints[label].sha256 !== baseline.frozenFingerprints[label]?.sha256
);
if (changedFingerprints.length > 0) throw new Error(`v152_e_frozen_fingerprints_changed_${changedFingerprints.join('_')}`);

const verification = {
    phase: PHASE,
    snapshotType: 'POST_PAIRING_VERIFICATION',
    capturedAt: new Date().toISOString(),
    preflightSnapshot: baselinePath,
    activeRelease,
    rollbackRelease: baseline.rollbackRelease,
    pm2: sanitizedPm2(activeRelease),
    health: await sanitizedHealth(),
    frozenFingerprints: fingerprints,
    changedFingerprints,
    invariants: {
        currentReleaseUnchanged: true,
        pm2StillOnCurrentRelease: true,
        zapiPreserved: true,
        vslChanged: false,
        pixelChanged: false,
        funnelMetricsChanged: false,
        botBusinessLogicChanged: false,
        panelCoreChanged: false,
        postSaleChanged: false,
        customerMigration: false,
        customerRouting: false,
        handoff: false,
        failover: false,
        zapiShutdown: false,
        cutover: false
    }
};

await ensureSecureDirectory(evidenceRoot);
const target = path.join(evidenceRoot, 'post-pairing-verification.json');
await writeJsonAtomic(target, verification);
process.stdout.write(`${JSON.stringify({
    phase: PHASE,
    event: 'POST_PAIRING_VERIFICATION_PASS',
    target,
    activeRelease,
    pm2Status: verification.pm2.status,
    healthStatus: verification.health.status,
    engine: verification.health.engine,
    zapiConnected: verification.health.zapiConnected,
    frozenFingerprints: Object.keys(fingerprints).length,
    changedFingerprints: changedFingerprints.length,
    secretsPrinted: false
})}\n`);
