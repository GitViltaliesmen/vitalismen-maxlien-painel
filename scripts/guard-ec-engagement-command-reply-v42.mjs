import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/ecEngagementFreezeRuntimeGuardV40.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const panel = read('public/qr.html');
const panelPolicy = read('public/panel-intelligence/ec-engagement-panel-v42.js');
const replyService = read('src/services/ecEngagementReplyService.js');
const routes = read('src/routes/whatsapp.js');
const testFile = read('tests/ec-engagement-command-reply-v42.test.mjs');
const freeze = read('docs/EC_ENGAGEMENT_COMMAND_REPLY_FREEZE_V42_20260822.md');
const parentGuard = read('scripts/guard-panel-client-search-v41.mjs');
const parentApproval = read('scripts/assert-panel-client-search-activation-approved-v41.mjs');
const parentTest = read('tests/panel-client-search-v41.test.mjs');

assert.match(panel, /ec-engagement-panel-v42\.js/);
assert.match(panel, /VitalismenEngagementPanelV42\?\.resolveConversationBucket/);
assert.match(panel, /VitalismenEngagementPanelV42\?\.dedupeVisibleLabels/);
assert.match(panelPolicy, /if \(VALID_BUCKETS\.has\(stored\)\) return stored/);
assert.match(panelPolicy, /dedupeVisibleLabels/);
assert.match(replyService, /manualPassiveAcknowledgementApproved/);
assert.match(replyService, /passive_acknowledgement/);
assert.match(replyService, /modelCalls:\s*0/);
assert.match(replyService, /manualPassiveTemplatesAskQuestions:\s*false/);
assert.match(replyService, /reply_cooldown/);
assert.match(replyService, /daily_reply_limit/);
assert.match(replyService, /newer_inbound_buffered/);
assert.match(routes, /handled:\s*'warmup_panel_command'/);
assert.match(routes, /sent:\s*false/);
assert.ok(routes.includes("const withoutTrailingHash = normalized.replace(/#+$/, '');"));
assert.match(testFile, /EC-ADMIN-2856/);
assert.match(testFile, /responde a gracias com template local curto/);
assert.match(freeze, /nenhum `Order` EC foi encontrado/);
assert.match(freeze, /custo de IA permanece zero/);
assert.match(packageJson.scripts['senior:check'], /guard-panel-client-search-v41\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-panel-client-search-activation-approved-v41\.mjs/);
assert.match(packageJson.scripts['deploy:ec-safe'], /assert-panel-client-search-activation-approved-v41\.mjs/);
assert.match(parentGuard, /guard-ec-engagement-command-reply-v42\.mjs/);
assert.match(parentApproval, /assert-ec-engagement-command-reply-activation-approved-v42\.mjs/);
assert.match(parentTest, /ec-engagement-command-reply-v42\.test\.mjs/);
assert.doesNotMatch(panel, /chat\.lastMessage\.body[\s\S]{0,120}class="chat-preview/);

console.log('EC_ENGAGEMENT_COMMAND_REPLY_V42_GUARD=OK');
