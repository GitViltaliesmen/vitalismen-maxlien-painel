import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = '596441983a7d05e0cd002200372aa1bd0077214b';
const allowed = new Set([
    'public/funnel-metrics.html',
    'src/routes/funnelMetrics.js',
    'src/services/creativeSalesMetricsV185Service.js',
    'tests/creative-sales-metrics-v185.test.mjs',
    'tests/funnel-metrics-v185-route.test.mjs',
    'tests/funnel-metrics-v185.browser.test.mjs',
    'scripts/guard-v185-metrics-radar-readonly.mjs',
    'scripts/lib/ec-runtime-successor-v185-context.mjs',
    'scripts/run-with-v185-context.mjs',
    'docs/V185_METRICS_RADAR_READONLY_FREEZE_20260918.md',
    'docs/V185_METRICS_RADAR_READONLY_REPORT_20260918.md',
    'docs/freeze/v185-metrics-radar-readonly-20260918.json'
]);
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const changed = git(['diff', '--name-only', BASE, '--']).split(/\r?\n/).filter(Boolean);
const untracked = git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
const touched = [...new Set([...changed, ...untracked])];
const unexpected = touched.filter(file => !allowed.has(file));
assert.deepEqual(unexpected, [], `[V185] arquivo_fora_do_escopo:${unexpected.join(',')}`);

const service = fs.readFileSync(new URL('../src/services/creativeSalesMetricsV185Service.js', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../src/routes/funnelMetrics.js', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../public/funnel-metrics.html', import.meta.url), 'utf8');
assert.match(route, /router\.get\('\/creative-sales', authMiddleware, adminOnly/);
assert.doesNotMatch(route, /\.(?:save|deleteOne|deleteMany|updateOne|updateMany|findOneAndUpdate|insertMany|bulkWrite)\s*\(/);
assert.match(service, /method:\s*'GET'/);
assert.doesNotMatch(service, /method:\s*'(?:POST|PUT|PATCH|DELETE)'/);
assert.doesNotMatch(service, /(?:writeFile|appendFile|createWriteStream|\.save\s*\(|updateOne\s*\(|deleteOne\s*\()/);
assert.match(service, /CACHE_TTL_MS\s*=\s*5 \* 60 \* 1000/);
assert.match(service, /DEFAULT_TIMEOUT_MS\s*=\s*8_000/);
assert.match(page, /Campanhas e criativos detectados — Protocolo G/);
assert.match(page, /Leitura analítica somente/);
assert.doesNotMatch(page, /Recomendação IA/);
assert.doesNotMatch(page, /querySelectorAll\('\[data-radar-action\]'\)[\s\S]{0,300}addEventListener/);
assert.ok(page.indexOf('id="metaAdsMetrics"') < page.indexOf('id="creativeSalesPanel"'));
assert.ok(page.indexOf('id="creativeSalesPanel"') < page.indexOf('id="investmentRadarPanel"'));
assert.ok(page.indexOf('id="investmentRadarPanel"') < page.indexOf('id="status"'));

for (const protectedPath of [
    'public/qr.html',
    'src/routes/whatsapp.js',
    'src/routes/shipments.js',
    'src/services/conversationEngine.js',
    'src/services/observerAttentiveReaderService.js',
    'src/services/metaConversionsService.js',
    'src/services/servientregaEcuadorAgencyService.js'
]) {
    const currentHash = git(['hash-object', protectedPath]);
    const baseHash = git(['rev-parse', `${BASE}:${protectedPath}`]);
    assert.equal(currentHash, baseHash, `[V185] protegido_alterado:${protectedPath}`);
}

console.log('V185_SCOPE=PASS');
console.log('V185_READ_ONLY=PASS');
console.log('V185_META_MUTATION_REQUESTS=0');
console.log('VSL_FILES_CHANGED=0');
console.log('BOT_FILES_CHANGED=0');
console.log('PANEL_QR_CHANGED=0');
console.log('GUARDS_BYPASSED=NO');
