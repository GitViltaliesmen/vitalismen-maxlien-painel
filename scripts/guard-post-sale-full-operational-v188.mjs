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

const BASE = 'e0cd23c7a18552c9c3c56daf788100bc87781dc3';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const changed = [...new Set([
    ...git('diff', '--name-only', BASE).split(/\r?\n/),
    ...git('ls-files', '--others', '--exclude-standard').split(/\r?\n/)
].filter(Boolean))];
const allowed = new Set([
    'src/services/postSaleFullOperationalV188Service.js',
    'src/services/postSaleFullExecutorV188Service.js',
    'src/services/postSaleRefillV188Service.js',
    'scripts/create-post-sale-v188-overlay.mjs',
    'scripts/post-sale-full-v188.mjs',
    'scripts/guard-post-sale-full-operational-v188.mjs',
    'scripts/lib/ec-runtime-successor-v188-context.mjs',
    'tests/post-sale-full-operational-v188.test.mjs',
    'ops/post-sale-v188',
    'ops/systemd/vitalismen-postsale-full-v188.service',
    'ops/systemd/vitalismen-postsale-full-v188.timer',
    'docs/POST_SALE_FULL_OPERATIONAL_FREEZE_V188_20260918.md',
    'docs/freeze/post-sale-full-operational-v188-20260918.json'
]);
assert.deepEqual(changed.filter((file) => !allowed.has(file)), [], 'V188 alterou arquivo fora do pós-venda autorizado');

const profile = buildPostSaleFullOperationalV188Overlay();
const resolved = resolvePostSaleFullOperationalV188Configuration(profile);
assert.equal(resolved.ready, true);
assert.equal(profile.VITALISMEN_EC_BOT_CORE_OPERATIONAL, 'true');
assert.equal(profile.VITALISMEN_STRICT_READ_ONLY, 'false');
assert.equal(profile.DISABLE_SCHEDULER, '1');
assert.equal(profile.SHIPMENT_STATUS_DISPATCH_DAILY_LIMIT, '1');
assert.equal(profile.DROPPI_EC_ACTIVE_SYNC_ENABLED, 'false');
assert.equal(profile.DROPPI_EC_ACTIVE_SYNC_MODE, 'REPORT_ONLY');
assert.equal(profile.DROPPI_PAYMENT_CLAIM_NOTIFY_ENABLED, 'false');
assert.equal(profile.DROPPI_PAYMENT_CLAIM_LIVE_CHECK_ENABLED, 'false');
assert.equal(profile.VITALISMEN_META_PURCHASE_ENABLED, 'false');
assert.equal(profile.META_RETRO_SEND, 'false');
assert.equal(profile.WHATSAPP_CONNECT_ENABLED, 'false');
assert.equal(profile.WHATSAPP_BACKLOG_RECOVERY_ENABLED, 'false');
assert.equal(POST_SALE_V188_STAGES.length, 15);
assert.equal(new Set(POST_SALE_V188_STAGES).size, 15);
assert.equal(POST_SALE_V188_ALLOWED_WRITE_CLASSES.includes('*'), false);

const messageSource = fs.readFileSync('src/services/postSaleFullExecutorV188Service.js', 'utf8');
for (const kind of ['day1', 'soft_day2', 'day3', 'soft_day4', 'day5', 'soft_day6']) {
    assert.match(messageSource, new RegExp(`kind: '${kind}'`));
}
assert.match(messageSource, /satisfied_by_soft_day2_single_message/);

const manifestText = fs.readFileSync('docs/freeze/post-sale-full-operational-v188-20260918.json', 'utf8');
const manifest = JSON.parse(manifestText);
assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, 'V188 manifest não canônico');
assert.equal(manifest.freezeId, 'POST_SALE_FULL_OPERATIONAL_V188_20260918');
assert.equal(manifest.parentCommit, BASE);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
for (const [relativePath, expected] of Object.entries(manifest.protectedFiles)) {
    assert.equal(
        crypto.createHash('sha256').update(fs.readFileSync(relativePath)).digest('hex'),
        expected,
        `V188 freeze divergente: ${relativePath}`
    );
}

const executor = fs.readFileSync('scripts/post-sale-full-v188.mjs', 'utf8');
assert.match(executor, /getZapiStatus/);
assert.match(executor, /outboundCount > 1/);
assert.match(executor, /isPostSaleV188SendWindowOpen/);
assert.doesNotMatch(executor, /startScheduler|sendMeta|META_RETRO_SEND|submit.*Dropi/i);

const operations = fs.readFileSync('ops/post-sale-v188', 'utf8');
assert.match(operations, /staging_overlay="\$\(mktemp/);
assert.match(operations, /NODE_OPTIONS="--import=\$candidate\/scripts\/lib\/ec-runtime-successor-v188-context\.mjs"/);
assert.match(operations, /node --test tests\/post-sale-full-operational-v188\.test\.mjs/);
assert.doesNotMatch(operations, /staging-check[\s\S]*current\/scripts\/lib\/ec-runtime-successor-v188-context\.mjs/);

const protectedGroups = {
    VSL_HASH_DIFF: ['public/protocolo-g', 'public/n', 'src/routes/vsl.js', 'src/services/vslPreleadPanelService.js'],
    BOT_SALES_CORE_HASH_DIFF: ['src/services/conversationEngine.js', 'src/services/agentRouter.js'],
    QR_PANEL_HASH_DIFF: ['public/qr.html'],
    FUNNEL_METRICS_HASH_DIFF: ['public/funnel-metrics.html', 'src/services/funnelMetricsService.js', 'src/routes/funnelMetrics.js']
};
for (const [label, paths] of Object.entries(protectedGroups)) {
    const diff = git('diff', '--name-only', BASE, '--', ...paths);
    assert.equal(diff, '', label);
    console.log(`${label}=0`);
}

const changedLower = changed.map((file) => file.toLowerCase());
assert.equal(changedLower.filter((file) => /(^|\/)(meta|capi)|pixel|purchase/.test(file)).length, 0, 'META_CAPI_HASH_DIFF');
assert.equal(changedLower.filter((file) => /price|preco|precio|productprofile/.test(file)).length, 0, 'PRODUCT_PRICE_HASH_DIFF');

const payloadHash = crypto.createHash('sha256').update(JSON.stringify({
    changed,
    stages: POST_SALE_V188_STAGES,
    writeClasses: POST_SALE_V188_ALLOWED_WRITE_CLASSES
})).digest('hex');

console.log('META_CAPI_HASH_DIFF=0');
console.log('PRODUCT_PRICE_HASH_DIFF=0');
console.log('BOT_CORE_PRESERVED=YES');
console.log('DROPI_APPLY=NO');
console.log('META_PURCHASE=NO');
console.log('BAILEYS=NO');
console.log('GLOBAL_BACKLOG_RECOVERY=NO');
console.log('GUARDS_BYPASSED=NO');
console.log(`V188_SCOPE_SHA256=${payloadHash}`);
console.log('POST_SALE_FULL_OPERATIONAL_V188_GUARD=PASS');
