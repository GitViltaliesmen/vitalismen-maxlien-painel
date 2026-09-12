#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
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

const fingerprintFiles = async (releaseRoot) => {
    const files = {
        publicVsl: '/var/www/ec.maxlien.shop/n/index.html',
        publicFunnelMetrics: '/var/www/ec.maxlien.shop/funnel-metrics.html',
        panelCore: path.join(releaseRoot, 'public/qr.html'),
        whatsappBusinessRoute: path.join(releaseRoot, 'src/routes/whatsapp.js'),
        pixelCapi: path.join(releaseRoot, 'src/services/metaConversionsService.js'),
        postSaleDecision: path.join(releaseRoot, 'src/services/postSaleNotificationDecisionService.js'),
        postSaleUnifiedEvent: path.join(releaseRoot, 'src/services/postSaleUnifiedEventV147R6Service.js')
    };
    const hashes = {};
    for (const [label, target] of Object.entries(files)) {
        hashes[label] = { path: target, sha256: await sha256File(target) };
    }
    return hashes;
};

const sanitizedPm2 = (releaseRoot) => {
    const processes = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
    const matches = processes.filter((entry) => entry?.name === 'vitalismen-automation');
    if (matches.length !== 1) throw new Error('v152_e_exactly_one_official_pm2_process_required');
    const entry = matches[0];
    const pmCwd = String(entry.pm2_env?.pm_cwd || '');
    const pmExecPath = String(entry.pm2_env?.pm_exec_path || '');
    if (entry.pm2_env?.status !== 'online') throw new Error('v152_e_official_pm2_not_online');
    if (path.resolve(pmCwd) !== path.resolve(releaseRoot)) throw new Error('v152_e_pm2_cwd_not_active_release');
    if (!path.resolve(pmExecPath).startsWith(`${path.resolve(releaseRoot)}${path.sep}`)) {
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
    const healthUrl = String(process.env.V152_E_HEALTH_URL || DEFAULT_HEALTH_URL);
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`v152_e_health_http_${response.status}`);
    const body = await response.json();
    const status = String(body.status || '');
    const engine = String(body.whatsapp?.engine || body.engine || '');
    const zapiConnected = Boolean(body.whatsapp?.zapi?.connected ?? body.zapi?.connected ?? body.zapiConnected);
    if (status !== 'online' || engine !== 'Z-API' || !zapiConnected) {
        throw new Error('v152_e_zapi_baseline_not_healthy');
    }
    return {
        http: response.status,
        status,
        engine,
        zapiConnected,
        degradedReasons: Array.isArray(body.degradedReasons) ? body.degradedReasons.map(String) : []
    };
};

if (process.platform !== 'linux') throw new Error('v152_e_preflight_linux_vps_required');
if (process.getuid?.() !== 0) throw new Error('v152_e_preflight_root_required');
if (String(process.env.V152_E_CONTROLLED_REAL_PAIRING_APPROVED || '') !== 'true') {
    throw new Error('v152_e_explicit_pairing_approval_required');
}

const evidenceRoot = path.resolve(String(process.env.V152_E_EVIDENCE_ROOT || DEFAULT_EVIDENCE_ROOT));
if (evidenceRoot === '/' || evidenceRoot.startsWith(`${OFFICIAL_CURRENT}/`)) {
    throw new Error('v152_e_evidence_root_invalid');
}

const releaseRoot = await fs.realpath(OFFICIAL_CURRENT);
const releasePublication = JSON.parse(await fs.readFile(path.join(releaseRoot, '.release-publication.json'), 'utf8'));
const snapshot = {
    phase: PHASE,
    snapshotType: 'PRE_PAIRING_BASELINE',
    capturedAt: new Date().toISOString(),
    activeRelease: releaseRoot,
    rollbackRelease: releaseRoot,
    publication: {
        state: String(releasePublication.state || releasePublication.status || ''),
        sourceCommit: String(releasePublication.sourceCommit || releasePublication.commit || ''),
        sourceTree: String(releasePublication.sourceTree || releasePublication.tree || '')
    },
    pm2: sanitizedPm2(releaseRoot),
    health: await sanitizedHealth(),
    frozenFingerprints: await fingerprintFiles(releaseRoot),
    invariants: {
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
const target = path.join(evidenceRoot, 'pre-pairing-snapshot.json');
await writeJsonAtomic(target, snapshot);
process.stdout.write(`${JSON.stringify({
    phase: PHASE,
    event: 'PRE_PAIRING_SNAPSHOT_PASS',
    target,
    activeRelease: snapshot.activeRelease,
    pm2Status: snapshot.pm2.status,
    healthStatus: snapshot.health.status,
    engine: snapshot.health.engine,
    zapiConnected: snapshot.health.zapiConnected,
    frozenFingerprints: Object.keys(snapshot.frozenFingerprints).length,
    secretsPrinted: false
})}\n`);
