import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const BASELINE_COMMIT = 'c99aea3af2e723ec80a142e51f724f5dd8d850e0';
export const BASELINE_RELEASE = '20260917T140612Z_production-20260917-c99aea3';
export const BASELINE_TAG = 'production-20260917-c99aea3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V170_MANIFEST = 'docs/freeze/ec-pretraffic-final-restoration-v170-20260916.json';
const V171_MANIFEST = 'docs/freeze/ec-traffic-restoration-v171-20260917.json';

export const PROVIDER_ONLY_FILES = Object.freeze([
    'docs/EC_WHATSAPP_PROVIDER_PREPARATION_20260917.md',
    'docs/provider/ec-whatsapp-provider-cutover-manifest-20260917.json',
    'scripts/audit-ec-whatsapp-provider-boundary.mjs',
    'tests/ec-whatsapp-provider-boundary.test.mjs'
]);

export const ZAPI_DEPENDENCY_MATRIX = Object.freeze({
    'src/services/zapiClient.js': ['HEALTH', 'OUTBOUND', 'TEXT', 'AUDIO', 'IMAGE', 'MESSAGE_ID', 'SESSION_IDENTITY'],
    'src/routes/zapi.js': ['INBOUND', 'WEBHOOK', 'DELIVERY_ACK', 'READ_ACK', 'MESSAGE_ID', 'BOT_ROUTING'],
    'src/routes/health.js': ['HEALTH', 'SESSION_IDENTITY'],
    'src/routes/whatsapp.js': ['OUTBOUND', 'PANEL_STATUS', 'MESSAGE_ID'],
    'src/whatsapp/zapiOutboundRouting.js': ['OUTBOUND', 'SESSION_IDENTITY'],
    'src/whatsapp/sendText.js': ['OUTBOUND', 'TEXT', 'MESSAGE_ID'],
    'src/whatsapp/sendAudio.js': ['OUTBOUND', 'AUDIO', 'MESSAGE_ID'],
    'src/whatsapp/sendImage.js': ['OUTBOUND', 'IMAGE', 'MESSAGE_ID'],
    'src/services/zapiOutboundMirrorService.js': ['MESSAGE_ID', 'DELIVERY_ACK'],
    'src/services/zapiDeliveryCallbackReconciliationV155Service.js': ['DELIVERY_ACK', 'READ_ACK'],
    'public/qr.html': ['PANEL_STATUS']
});

export const REPLACEMENT_MATRIX = Object.freeze({
    INBOUND: { state: 'CONTRACT_ONLY', replacement: 'ProviderIndependentInboundOrchestrator + WhatsAppWebTransport.normalizeInbound' },
    OUTBOUND: { state: 'CONTRACT_ONLY', replacement: 'OutboundCoordinator + WhatsAppWebTransport' },
    TEXT: { state: 'CONTRACT_ONLY', replacement: 'WhatsAppWebTransport.sendText' },
    AUDIO: { state: 'CONTRACT_ONLY', replacement: 'WhatsAppWebTransport.sendAudio' },
    IMAGE: { state: 'CONTRACT_ONLY', replacement: 'WhatsAppWebTransport.sendMedia' },
    MESSAGE_ID: { state: 'CONTRACT_ONLY', replacement: 'UnifiedMessageLedger.providerMessageId' },
    DELIVERY_ACK: { state: 'NOT_IMPLEMENTED_LIVE', replacement: 'Baileys receipt event -> canonical delivery state' },
    READ_ACK: { state: 'NOT_IMPLEMENTED_LIVE', replacement: 'Baileys receipt event -> canonical read state' },
    WEBHOOK: { state: 'NOT_IMPLEMENTED_LIVE', replacement: 'Baileys socket event ingress' },
    HEALTH: { state: 'CONTRACT_ONLY', replacement: 'WhatsAppWebTransport.getHealth' },
    SESSION_IDENTITY: { state: 'CONTRACT_ONLY', replacement: 'SessionManager + ChannelRegistry' },
    PANEL_STATUS: { state: 'CONTRACT_ONLY', replacement: 'ChannelRegistry control-plane projection' },
    BOT_ROUTING: { state: 'CONTRACT_ONLY', replacement: 'ProviderIndependentInboundOrchestrator' }
});

const normalizePath = (value) => String(value || '').replaceAll('\\', '/').replace(/^\.\//, '');

const read = (relative) => fs.readFileSync(path.join(ROOT, relative));

const sha256 = (relative) => crypto.createHash('sha256').update(read(relative)).digest('hex');

const git = (...args) => execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
}).trim();

const listJavaScriptFiles = (directory) => fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true })
    .flatMap((entry) => {
        const relative = normalizePath(path.join(directory, entry.name));
        return entry.isDirectory() ? listJavaScriptFiles(relative) : (entry.name.endsWith('.js') ? [relative] : []);
    });

export const directZapiImportsInCanonicalCore = () => listJavaScriptFiles('src/whatsapp/core')
    .filter((relative) => /(?:zapiClient|zapiOutboundRouting|routes\/zapi|sendZapi)/i.test(read(relative).toString('utf8')));

export const validateBaselineLock = () => {
    const v170 = JSON.parse(read(V170_MANIFEST).toString('utf8'));
    const v171 = JSON.parse(read(V171_MANIFEST).toString('utf8'));
    assert.equal(v170.freezeId, 'EC_PRETRAFFIC_FINAL_RESTORATION_V170_20260916');
    assert.equal(v171.freezeId, 'EC_TRAFFIC_RESTORATION_V171_20260917');
    assert.equal(v170.policy.futureChangesRequireExplicitAuthorization, true);
    assert.equal(v171.policy.futureChangesRequireExplicitAuthorization, true);
    const protectedFiles = new Set([
        ...Object.keys(v170.protectedFiles),
        ...Object.keys(v171.protectedFiles)
    ]);
    for (const relative of protectedFiles) {
        const expected = v171.protectedFiles[relative] || v170.protectedFiles[relative];
        assert.equal(sha256(relative), expected, `commercial_baseline_hash_changed:${relative}`);
    }
    execFileSync('git', ['merge-base', '--is-ancestor', BASELINE_COMMIT, 'HEAD'], {
        cwd: ROOT,
        stdio: 'ignore'
    });
    return { protectedFiles: protectedFiles.size };
};

export const changedTrackedFilesSinceBaseline = () => {
    const sources = [
        git('diff', '--name-only', `${BASELINE_COMMIT}...HEAD`),
        git('diff', '--name-only'),
        git('diff', '--cached', '--name-only')
    ];
    return [...new Set(sources.flatMap((value) => value.split(/\r?\n/)).map(normalizePath).filter(Boolean))].sort();
};

export const validateProviderOnlyDiff = () => {
    const changed = changedTrackedFilesSinceBaseline();
    const unexpected = changed.filter((relative) => !PROVIDER_ONLY_FILES.includes(relative));
    if (unexpected.length > 0) {
        assert.ok(String(process.env.AUTHORIZATION_ID || '').trim(), `AUTHORIZATION_ID_REQUIRED:${unexpected.join(',')}`);
        assert.fail(`commercial_or_unscoped_change_forbidden_in_provider_mission:${unexpected.join(',')}`);
    }
    return changed;
};

export const runAudit = () => {
    const baseline = validateBaselineLock();
    const changed = validateProviderOnlyDiff();
    const directCoreImports = directZapiImportsInCanonicalCore();
    assert.deepEqual(directCoreImports, [], `canonical_core_has_direct_zapi_import:${directCoreImports.join(',')}`);

    for (const relative of Object.keys(ZAPI_DEPENDENCY_MATRIX)) {
        assert.equal(fs.existsSync(path.join(ROOT, relative)), true, `mapped_dependency_missing:${relative}`);
    }

    const result = Object.freeze({
        baselineCommit: BASELINE_COMMIT,
        baselineRelease: BASELINE_RELEASE,
        baselineTag: BASELINE_TAG,
        baselineLock: 'PASS',
        protectedCommercialFiles: baseline.protectedFiles,
        providerOnlyChangedFiles: changed,
        coreDirectZapiImports: directCoreImports.length,
        mappedZapiDependencyFiles: Object.keys(ZAPI_DEPENDENCY_MATRIX).length,
        liveReplacementGaps: Object.values(REPLACEMENT_MATRIX).filter((item) => item.state === 'NOT_IMPLEMENTED_LIVE').length
    });

    console.log(`BASELINE_COMMERCIAL_LOCK=${result.baselineLock}`);
    console.log(`CORE_DIRECT_ZAPI_IMPORTS=${result.coreDirectZapiImports}`);
    console.log(`MAPPED_ZAPI_DEPENDENCY_FILES=${result.mappedZapiDependencyFiles}`);
    console.log(`LIVE_REPLACEMENT_GAPS=${result.liveReplacementGaps}`);
    console.log(`PROVIDER_ONLY_CHANGED_FILES=${result.providerOnlyChangedFiles.join(',') || 'NONE'}`);
    return result;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runAudit();
}
