import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const changed = execFileSync('git', ['status', '--porcelain=v1'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/\\/g, '/'));
const allowed = new Set([
    'docs/V168A_R2_QA_CANARY_DEDUPE_WATCHDOG_FREEZE_20260916.md',
    'package.json',
    'scripts/guard-v168a-r2-qa-canary-dedupe-watchdog.mjs',
    'scripts/senior-guard.mjs',
    'src/routes/zapi.js',
    'src/services/ecBotCoreRuntimeIntegrationV78Service.js',
    'src/services/ecQaTestResetV78Service.js',
    'src/services/qaCanaryDedupeV168AR2Service.js',
    'src/services/texUltraInitialLayerService.js',
    'src/services/zapiFirstResponseWatchdogV168AR2Service.js',
    'tests/bot-qa-outbound-recovery-v110.test.mjs',
    'tests/v168a-r2-qa-canary-dedupe-watchdog.test.mjs'
]);
for (const file of changed) assert.ok(allowed.has(file), `arquivo fora do escopo V168A-R2: ${file}`);

const qa = read('src/services/qaCanaryDedupeV168AR2Service.js');
const reset = read('src/services/ecQaTestResetV78Service.js');
const integration = read('src/services/ecBotCoreRuntimeIntegrationV78Service.js');
const initial = read('src/services/texUltraInitialLayerService.js');
const watchdog = read('src/services/zapiFirstResponseWatchdogV168AR2Service.js');
const route = read('src/routes/zapi.js');

assert.match(qa, /phone !== EC_QA_TEST_PHONE_V78/);
assert.match(qa, /contactStateId:[\s\S]*permitId:[\s\S]*inboundMessageId:[\s\S]*stepKey:/);
assert.match(qa, /qa_old_inbound_message_reuse/);
assert.match(qa, /qa_consumed_message_mismatch/);
assert.match(reset, /priorProcessedMessageIds/);
assert.match(integration, /priorProcessedMessageIds.*\$ne: messageId/);
assert.match(integration, /qaCanaryV168AR2/);
assert.match(initial, /qaGeneration\.allowed \? qaGeneration\.identity : normalIdentity/);
assert.match(watchdog, /ZAPI_CHAT_WATCHDOG_ENABLED/);
assert.ok((watchdog.match(/zapiFirstResponseWatchdogEnabledV168AR2\(env\)/g) || []).length >= 2);
assert.match(watchdog, /provider_message_already_processed/);
assert.match(watchdog, /id: providerMessageId/);
assert.doesNotMatch(route, /_watchdog_\$\{Date\.now\(\)\}/);

const scope = [qa, reset, integration, initial, watchdog, route].join('\n');
assert.doesNotMatch(scope, /force\s*:\s*true|skipOutboundDedupe|allowTextDedupeBypass/);
assert.doesNotMatch(scope, /OutboundDedupe\.(?:deleteOne|deleteMany|updateOne|updateMany)/);
assert.equal(changed.some((file) => /(?:^|\/)public\/|whatsappWeb|dataset|pixel/i.test(file)), false);
assert.equal(changed.some((file) => /deploy|pm2|ecosystem|\.env/i.test(file)), false);

console.log('V168A_R2_QA_CANARY_DEDUPE_WATCHDOG_GUARD=PASS');
