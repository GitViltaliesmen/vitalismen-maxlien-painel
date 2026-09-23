import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

import {
    POST_SALE_V188_ALLOWED_WRITE_CLASSES,
    POST_SALE_V188_STAGES,
    buildPostSaleFullOperationalV188Overlay,
    resolvePostSaleFullOperationalV188Configuration
} from '../src/services/postSaleFullOperationalV188Service.js';
import { POST_SALE_DROPI_TRACKING_V194_STATES } from '../src/services/postSaleDropiTrackingReconcilerV194Service.js';

const BASE = '33876d4901ffbe25224d0ee9dd753ccf6f487ed6';
const MANIFEST = 'docs/freeze/post-sale-dropi-reconciler-v194-20260920.json';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const changed = git('diff', '--name-only', BASE).split(/\r?\n/).filter(Boolean);
const allowed = new Set([
    'docs/POST_SALE_DROPI_RECONCILER_V194_20260920.md',
    MANIFEST,
    'ops/post-sale-v188',
    'scripts/guard-post-sale-dropi-reconciler-v194.mjs',
    'scripts/lib/ec-runtime-successor-v168b-preload-context.mjs',
    'scripts/lib/ec-runtime-successor-v170-context.mjs',
    'scripts/lib/ec-runtime-successor-v184-context.mjs',
    'scripts/lib/ec-runtime-successor-v193-context.mjs',
    'scripts/lib/ec-runtime-successor-v194-context.mjs',
    'scripts/post-sale-full-v188.mjs',
    'scripts/post-sale-v188-qa-canary.mjs',
    'src/services/postSaleDropiTrackingReconcilerV194Service.js',
    'src/services/postSaleForwardOnlyV194Service.js',
    'src/services/postSaleFullExecutorV188Service.js',
    'src/services/postSaleFullOperationalV188Service.js',
    'src/services/postSaleRefillV188Service.js',
    'src/services/shipmentMessageService.js',
    'tests/post-sale-dropi-tracking-v194.test.mjs'
]);
assert.deepEqual(changed.filter((file) => !allowed.has(file)), [], 'V194 alterou arquivo rastreado fora do escopo autorizado');
for (const file of allowed) assert.equal(fs.existsSync(file), true, `V194 arquivo ausente: ${file}`);

const manifestText = fs.readFileSync(MANIFEST, 'utf8');
const manifest = JSON.parse(manifestText);
assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, 'V194 manifesto não canônico');
assert.equal(manifest.freezeId, 'POST_SALE_DROPI_RECONCILER_V194_20260920');
assert.equal(manifest.version, 'V194');
assert.equal(manifest.baseCommit, BASE);
assert.equal(manifest.policy?.dropiReadOnly, true);
assert.equal(manifest.policy?.dropiOrderMutationAllowed, false);
assert.equal(manifest.policy?.historicalReplayAllowed, false);
assert.equal(manifest.policy?.physicalBatchMax, 1);
assert.equal(manifest.policy?.qaPhone, '5515998038637');
assert.equal(manifest.policy?.guardsBypassed, false);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
for (const [file, expected] of Object.entries(manifest.protectedFiles)) {
    assert.equal(sha256(file), expected, `V194 freeze divergente: ${file}`);
}

const overlay = buildPostSaleFullOperationalV188Overlay({ forwardOnlySince: '2026-09-20T00:00:00.000Z' });
assert.equal(resolvePostSaleFullOperationalV188Configuration(overlay).ready, true);
assert.equal(overlay.POST_SALE_V194_FORWARD_ONLY_ENABLED, 'true');
assert.equal(overlay.POST_SALE_DROPI_TRACKING_RECONCILER_V194_ENABLED, 'true');
assert.equal(overlay.POST_SALE_DROPI_TRACKING_BATCH_LIMIT, '8');
assert.equal(overlay.POST_SALE_DROPI_TRACKING_DAILY_LIMIT, '12');
assert.equal(overlay.DROPPI_EC_ACTIVE_SYNC_MODE, 'REPORT_ONLY');
assert.equal(overlay.VITALISMEN_META_PURCHASE_ENABLED, 'false');
assert.equal(overlay.META_RETRO_SEND, 'false');
assert.equal(overlay.WHATSAPP_CONNECT_ENABLED, 'false');
assert.equal(POST_SALE_V188_STAGES.length, 15);
assert.equal(new Set(POST_SALE_V188_STAGES).size, 15);
assert.equal(POST_SALE_V188_ALLOWED_WRITE_CLASSES.includes('*'), false);

assert.deepEqual(Object.values(POST_SALE_DROPI_TRACKING_V194_STATES).sort(), [
    'AMBIGUOUS_LINK',
    'DROPI_STILL_WITHOUT_TRACKING',
    'MANUAL_REVIEW',
    'ORDER_NOT_FOUND',
    'TRACKING_FOUND'
]);

const reconciler = fs.readFileSync('src/services/postSaleDropiTrackingReconcilerV194Service.js', 'utf8');
assert.match(reconciler, /fetchDroppiEcuadorOrdersApiReadOnly/);
assert.match(reconciler, /BACKOFF_MINUTES = Object\.freeze\(\[15, 30, 60\]\)/);
assert.match(reconciler, /MAX_DAILY_ATTEMPTS = 12/);
assert.match(reconciler, /historicalNoReplay/);
assert.doesNotMatch(reconciler, /createDroppi|submitDroppi|updateDroppi|send.*Dropi|Enviar para Dropi/i);

const runner = fs.readFileSync('scripts/post-sale-full-v188.mjs', 'utf8');
assert.match(runner, /physicalOutboundCount: outboundCount/);
assert.match(runner, /maxPhysicalSends: 1/);
assert.match(runner, /processForwardLogisticsStageV194/);
assert.doesNotMatch(runner, /processShipmentStatusDispatch/);
assert.match(runner, /outboundCount > 1/);

const messages = fs.readFileSync('src/services/shipmentMessageService.js', 'utf8');
assert.match(messages, /notifyReadyForPickup = async \(shipment, \{ force = false, maxComponents = Infinity \}/);
assert.match(messages, /notifyTreatmentRefillReminder = async \(shipment, \{ maxPhysicalSends = Infinity \}/);
assert.match(messages, /physical_send_limit_reached/);

const canary = fs.readFileSync('scripts/post-sale-v188-qa-canary.mjs', 'utf8');
assert.match(canary, /EC_QA_TEST_PHONE_V78 !== '5515998038637'/);
assert.match(canary, /CANARY_VERSION = 194/);
assert.match(canary, /orderCreated: false/);
assert.match(canary, /shipmentCreated: false/);
assert.match(canary, /state: 'INTENDED'/);
assert.match(canary, /state: 'SENT'/);
assert.match(canary, /PASS_QA_CANARY_15_STAGES_DEDUPED/);

const ops = fs.readFileSync('ops/post-sale-v188', 'utf8');
assert.match(ops, /vitalismen-postsale-transactional-v116\.timer/);
assert.match(ops, /systemctl disable --now vitalismen-postsale-transactional-v116\.timer/);
assert.match(ops, /MUTATING_EXECUTOR_COUNT=\$mutating_count/);
assert.match(ops, /ec-runtime-successor-v194-context\.mjs/);
assert.match(ops, /POST_SALE_V194_UPGRADE=PASS/);

const protectedGroups = {
    VSL_HASH_DIFF: ['public/protocolo-g', 'public/n', 'src/routes/vsl.js', 'src/services/vslPreleadPanelService.js'],
    BOT_SALES_CORE_HASH_DIFF: ['src/services/conversationEngine.js', 'src/services/agentRouter.js'],
    QR_PANEL_HASH_DIFF: ['public/qr.html'],
    FUNNEL_METRICS_HASH_DIFF: ['public/funnel-metrics.html', 'src/services/funnelMetricsService.js', 'src/routes/funnelMetrics.js'],
    META_CAPI_HASH_DIFF: ['src/services/metaAttributionBridgeService.js', 'src/services/metaConversionsApiService.js'],
    PRODUCT_PRICE_HASH_DIFF: ['src/config/products.js', 'src/config/ecuadorProductProfiles.js', 'public/checkout.html']
};
for (const [label, paths] of Object.entries(protectedGroups)) {
    assert.equal(git('diff', '--name-only', BASE, '--', ...paths), '', label);
    console.log(`${label}=0`);
}

console.log('DROPI_ORDER_MUTATION=NO');
console.log('HISTORICAL_REPLAY=NO');
console.log('PHYSICAL_BATCH_MAX=1');
console.log('QA_PHONE=5515998038637');
console.log('GUARDS_BYPASSED=NO');
console.log('POST_SALE_DROPI_RECONCILER_V194_GUARD=PASS');
