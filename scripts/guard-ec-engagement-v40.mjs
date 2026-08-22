import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/ecEngagementFreezeRuntimeGuardV40.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const model = read('src/models/ContactState.js');
const classifier = read('src/services/ecConversationBucketService.js');
const replies = read('src/services/ecEngagementReplyService.js');
const zapi = read('src/routes/zapi.js');
const whatsapp = read('src/routes/whatsapp.js');
const panel = read('public/qr.html');
const freeze = read('docs/EC_ENGAGEMENT_INTERNAL_BUCKET_FREEZE_V40_20260822.md');
const testFile = read('tests/ec-engagement-buckets-v40.test.mjs');
const successor = 'node src/services/ecEngagementFreezeRuntimeGuardV40.js';

for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:logistics-clean-chat-v29',
    'guard:deploy-integration-v29-1',
    'guard:operational-mode-zapi-health',
    'guard:media-durability-v30',
    'guard:tex-ultra-how-to-use-v31',
    'guard:official-whatsapp-phone-v32',
    'guard:panel-image-csp-v33',
    'guard:protocolo-g-tex-ultra-v34',
    'guard:ec-product-ingredients-v35',
    'guard:ec-all-products-ingredients-v36',
    'guard:panel-zapi-auth-status-v37',
    'guard:inbound-media-path-portability-v38',
    'guard:ec-direct-product-name-postsale-v39',
    'guard:ec-engagement-v40',
    'guard:ec-nitrix',
    'guard:ec-identity',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.equal(String(packageJson.scripts[scriptName] || '').startsWith(successor), true, `${scriptName} não usa V40`);
}

assert.match(index, /import '\.\/services\/ecEngagementFreezeRuntimeGuardV40\.js';/);
assert.equal((index.match(/ecEngagementFreezeRuntimeGuardV40\.js/g) || []).length, 1);
assert.match(model, /conversationBucket/);
assert.match(model, /replyLockUntil/);
assert.match(model, /replyHistory/);
assert.match(model, /localDecisionCount/);
assert.match(model, /modelCallCount/);
assert.match(classifier, /EC_CONVERSATION_BUCKETS/);
assert.match(classifier, /safety_risk/);
assert.match(classifier, /active_order_obligation/);
assert.match(classifier, /commercial_intent/);
assert.match(classifier, /setEcConversationBucketManually/);
assert.doesNotMatch(classifier, /169\.58\.51\.100|\/opt\/melhor-aquecimento-whatsapp|New project 4/i);
assert.match(replies, /EC_ENGAGEMENT_AUTO_REPLY_ENABLED/);
assert.match(replies, /noOutboundInitiation:\s*true/);
assert.match(replies, /noBulkDispatch:\s*true/);
assert.match(replies, /modelCallsPerDecision:\s*0/);
assert.match(replies, /daily_reply_limit|daily_reply_limit/i);
assert.match(replies, /reply_cooldown/);
assert.match(replies, /replyHistory\.inboundMessageId/);
assert.doesNotMatch(replies, /openai|chat\.completions|responses\.create/i);
assert.match(zapi, /classifyAndPersistEcConversation/);
assert.match(zapi, /scheduleClassifiedEngagementReply/);
assert.match(zapi, /conversationBucket !== EC_CONVERSATION_BUCKETS\.ENGAGEMENT/);
assert.match(zapi, /conversationBucket !== EC_CONVERSATION_BUCKETS\.REVIEW/);
assert.match(whatsapp, /handled:\s*'warmup_panel_command'/);
assert.match(whatsapp, /router\.post\('\/chats\/bucket'/);
assert.match(whatsapp, /router\.get\('\/engagement\/audit'/);
assert.match(panel, /data-operational-bucket="attendance"/);
assert.match(panel, /data-operational-bucket="engagement"/);
assert.match(panel, /data-operational-bucket="orders"/);
assert.match(panel, /data-operational-bucket="review"/);
assert.match(panel, /id="conversationBucketSelect"/);
assert.doesNotMatch(panel, /chat\.lastMessage\.body[\s\S]{0,120}class="chat-preview/);
assert.match(freeze, /nenhuma conversa artificial/i);
assert.match(freeze, /n[aã]o inicia conversa/i);
assert.match(testFile, /conteudo sexual explicito recebe REVISAR\/RISCO/);
assert.match(packageJson.scripts['senior:check'], /ec-engagement-buckets-v40\.test\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-ec-engagement-activation-approved-v40\.mjs/);

console.log('EC_ENGAGEMENT_INTERNAL_BUCKET_V40_GUARD=OK');
