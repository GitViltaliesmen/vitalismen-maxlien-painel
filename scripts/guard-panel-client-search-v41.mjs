import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('./guard-ec-engagement-command-reply-v42.mjs');
await import('../src/services/ecEngagementFreezeRuntimeGuardV40.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const panel = read('public/qr.html');
const search = read('public/panel-intelligence/chat-search-v41.js');
const testFile = read('tests/panel-client-search-v41.test.mjs');
const freeze = read('docs/PANEL_CLIENT_SEARCH_FREEZE_V41_20260822.md');

assert.match(panel, /chat-search-v41\.js/);
assert.match(panel, /VitalismenChatSearchV41\?\.matchesChat/);
assert.match(panel, /!searchActive && state\.conversationBucketFilter/);
assert.match(panel, /!searchActive && state\.chatFilter === 'unread'/);
assert.doesNotMatch(panel, /const haystack = \[[\s\S]{0,300}chat\.lastMessage\?\.body/);
assert.match(search, /MIN_PHONE_QUERY_DIGITS = 3/);
assert.match(search, /candidateValue\.endsWith\(queryValue\)/);
assert.doesNotMatch(search, /lastMessage|orderId|chatTags|source\.badge/);
assert.match(testFile, /exclui coincidências de mensagem\/pedido/);
assert.match(freeze, /busca textual consulta somente os campos de identidade/i);
assert.match(packageJson.scripts['senior:check'], /guard-panel-client-search-v41\.mjs/);
assert.match(packageJson.scripts['senior:check'], /panel-client-search-v41\.test\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-panel-client-search-activation-approved-v41\.mjs/);
assert.match(packageJson.scripts['deploy:ec-safe'], /assert-panel-client-search-activation-approved-v41\.mjs/);

console.log('PANEL_CLIENT_SEARCH_V41_GUARD=OK');
