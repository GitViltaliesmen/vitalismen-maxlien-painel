import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/ecEngagementFreezeRuntimeGuardV40.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const panel = read('public/qr.html');
const policy = read('public/panel-intelligence/panel-global-new-messages-v44.js');
const testFile = read('tests/panel-global-new-messages-v44.test.mjs');
const freeze = read('docs/PANEL_GLOBAL_NEW_MESSAGES_FREEZE_V44_20260822.md');

assert.match(panel, /panel-global-new-messages-v44\.js/);
assert.match(panel, /setPanelMessageFilter\(button\.dataset\.chatFilter\)/);
assert.match(panel, /shouldApplyOperationalBucketFilter/);
assert.match(panel, /const commercialNewChats = visibleChats\.filter\(isNewMessagesChatForPanel\)/);
assert.match(panel, /state\.chatFilter === 'unread' && !isNewMessagesChatForPanel\(chat\)/);
assert.match(panel, /applyOperationalBucketFilter && chatConversationBucket\(chat\)/);
assert.doesNotMatch(panel, /!searchActive && state\.conversationBucketFilter && chatConversationBucket\(chat\)/);
assert.match(policy, /GLOBAL_NEW_MESSAGES_FILTER = 'unread'/);
assert.match(policy, /conversationBucketFilter: ''/);
assert.match(policy, /DEFAULT_OPERATIONAL_BUCKET = 'attendance'/);
assert.match(testFile, /alinha o clique e a renderização de Novas ao contador comercial global/);
assert.match(freeze, /lista usa o mesmo[\s\S]{0,120}predicado já empregado pelo contador/);
assert.doesNotMatch(panel, /chat\.lastMessage\.body[\s\S]{0,120}class="chat-preview/);

console.log('PANEL_GLOBAL_NEW_MESSAGES_V44_GUARD=OK');
