import './lib/ec-runtime-successor-v97-context.mjs';

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const PARENT = 'dde9475953806696ae752359f47073ac950f05ee';
const allowedChanges = new Set([
    'docs/EC_V185_CANONICAL_SUCCESSOR_FREEZE_V186_20260918.md',
    'docs/EC_V185_CANONICAL_SUCCESSOR_REPORT_V186_20260918.md',
    'docs/freeze/ec-v181-v183-canonical-successor-v184-20260918.json',
    'docs/freeze/ec-v185-canonical-successor-v186-20260918.json',
    'scripts/guard-v185-canonical-successor-v186.mjs',
    'scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs',
    'scripts/lib/ec-runtime-successor-v186-context.mjs',
    'tests/v185-canonical-successor-v186.test.mjs'
]);
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const hash = relativePath => crypto.createHash('sha256').update(fs.readFileSync(relativePath)).digest('hex');
const read = relativePath => fs.readFileSync(relativePath, 'utf8');
const changed = git(['diff', '--name-only', PARENT, '--']).split(/\r?\n/).filter(Boolean);
const untracked = git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/).filter(Boolean);
const unexpected = [...new Set([...changed, ...untracked])].filter(file => !allowedChanges.has(file));
assert.deepEqual(unexpected, [], `[V186] arquivo_fora_do_escopo:${unexpected.join(',')}`);

const manifest = JSON.parse(read('docs/freeze/ec-v185-canonical-successor-v186-20260918.json'));
const v184 = JSON.parse(read('docs/freeze/ec-v181-v183-canonical-successor-v184-20260918.json'));
const v185 = JSON.parse(read('docs/freeze/v185-metrics-radar-readonly-20260918.json'));
const v170 = globalThis.__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT;
const v168b = globalThis.__VITALISMEN_V168B_PRELOAD_CONTEXT;
const context = globalThis.__VITALISMEN_V186_CANONICAL_METRICS_SUCCESSOR_CONTEXT;

assert.equal(context?.loaded, true, '[V186] context_not_loaded');
assert.equal(context?.loadedBeforeV168B, true, '[V186] context_order_not_attested');
assert.equal(context?.predecessorDescriptorPreserved, true, '[V186] v184_descriptor_not_preserved');
assert.equal(v168b?.loaded, true, '[V186] v168b_context_not_loaded');
assert.equal(v168b.authorizedFiles.includes('public/funnel-metrics.html'), true, '[V186] v168b_page_override_missing');
assert.equal(v168b.authorizedFiles.includes('src/routes/funnelMetrics.js'), true, '[V186] v168b_route_override_missing');
for (const file of v184.overrides) assert.equal(v170.authorizedFiles.includes(file), true, `[V186] predecessor_authorization_lost:${file}`);
for (const file of v185.overrides) assert.equal(v170.authorizedFiles.includes(file), true, `[V186] v185_authorization_missing:${file}`);
for (const [file, expected] of Object.entries(v185.protectedFiles)) assert.equal(hash(file), expected, `[V186] v185_changed:${file}`);
for (const [file, expected] of Object.entries(manifest.protectedFiles)) assert.equal(hash(file), expected, `[V186] protected_file_invalid:${file}`);

const bootstrap = read('scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs');
const v184Index = bootstrap.indexOf("import './ec-runtime-successor-v184-context.mjs';");
const v186Index = bootstrap.indexOf("import './ec-runtime-successor-v186-context.mjs';");
const v168bIndex = bootstrap.indexOf("import './ec-runtime-successor-v168b-preload-context.mjs';");
assert.ok(v184Index !== -1 && v184Index < v186Index && v186Index < v168bIndex, '[V186] canonical_order_invalid');
assert.deepEqual(manifest.ancestorProtectedIntersection, ['public/funnel-metrics.html', 'src/routes/funnelMetrics.js']);
assert.equal(manifest.overrides.some(file => /[*?\[\]]/.test(file)), false);

const v185Functional = new Set(v185.functionalFiles);
for (const file of v185Functional) {
    assert.equal(git(['hash-object', file]), git(['rev-parse', `${PARENT}:${file}`]), `[V186] v185_functional_changed:${file}`);
}
for (const file of [
    'public/qr.html',
    'src/routes/whatsapp.js',
    'src/routes/zapi.js',
    'src/routes/shipments.js',
    'src/services/conversationEngine.js',
    'src/services/agentRouter.js',
    'src/services/observerAttentiveReaderService.js',
    'src/services/metaConversionsService.js',
    'src/services/servientregaEcuadorAgencyService.js',
    'scripts/lib/ec-runtime-successor-v168b-preload-context.mjs',
    'docs/freeze/ec-runtime-guard-baseline-bootstrap-v168b-20260916.json',
    'src/services/strictReadOnlyObservationSafetyFreezeRuntimeGuardV71.js'
]) {
    assert.equal(git(['hash-object', file]), git(['rev-parse', `${PARENT}:${file}`]), `[V186] proibido_alterado:${file}`);
}

console.log('EC_V185_CANONICAL_SUCCESSOR_V186=PASS');
console.log('V186_CONTEXT_LOADED_BEFORE_V168B=YES');
console.log('V168B_PUBLIC_FUNNEL_METRICS_OVERRIDE_RECOGNIZED=YES');
console.log('V185_FUNCTIONAL_FILES_CHANGED_BY_V186=0');
console.log('VSL_HASH_DIFF=0');
console.log('BOT_HASH_DIFF=0');
console.log('QR_PANEL_HASH_DIFF=0');
console.log('GUARDS_BYPASSED=NO');
