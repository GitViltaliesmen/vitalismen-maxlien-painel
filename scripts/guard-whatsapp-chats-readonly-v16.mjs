import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/whatsappChatsReadonlyFreezeRuntimeGuardV16.js');
await import('./guard-customer-current-context-panel-v16.mjs');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/whatsapp-chats-readonly-hardening-v16-20260816.json'));
const v16Manifest = JSON.parse(read('docs/freeze/customer-current-context-v16-20260816.json'));
const service = read('src/services/customerCurrentContextService.js');
const customerContextRoute = read('src/routes/customerContext.js');
const whatsappRoute = read('src/routes/whatsapp.js');
const panel = read('public/qr.html');
const index = read('src/index.js');
const testSource = read('tests/whatsapp-chats-readonly.test.mjs');
const packageJson = JSON.parse(read('package.json'));
const successorGuardPattern = /guard-whatsapp-chats-readonly-v16\.mjs/;
const previousTopGuardPattern = /guard-customer-current-context-v16\.mjs/;
const forbiddenMutation = /\.(?:save|updateOne|updateMany|findOneAndUpdate|insertOne|create|deleteOne|deleteMany|bulkWrite)\s*\(/;
const forbiddenExternalImport = /from\s+['"][^'"]*(?:droppi|dropi|metaConversions|sendText|sendAudio|openai|scheduler|conversationEngine|botHandler)[^'"]*['"]/i;
const requiredProtectedFiles = [
    'package.json',
    'src/index.js',
    'src/routes/whatsapp.js',
    'src/services/whatsappChatsReadonlyFreezeRuntimeGuardV16.js',
    'scripts/guard-whatsapp-chats-readonly-v16.mjs',
    'tests/whatsapp-chats-readonly.test.mjs',
    'docs/WHATSAPP_CHATS_READONLY_HARDENING_FREEZE_V16_20260816.md',
    'docs/freeze/customer-current-context-v16-20260816.json'
];

assert.equal(manifest.freezeId, 'whatsapp-chats-readonly-hardening-v16-20260816');
assert.equal(manifest.status, 'implementation_candidate_locked');
assert.equal(manifest.country, 'EC');
assert.equal(manifest.parentFreezeId, v16Manifest.freezeId);
assert.equal(manifest.publicationStatus, 'not_published');
assert.equal(manifest.productionUnchanged, true);
assert.equal(manifest.requiresWrittenAuthorizationToChange, true);
assert.deepEqual(manifest.supersededParentProtectedFiles, ['package.json', 'src/index.js']);
assert.deepEqual(Object.keys(manifest.protectedFiles).sort(), requiredProtectedFiles.slice().sort());
assert.equal(manifest.policy.route, 'GET /api/whatsapp/chats');
assert.equal(manifest.policy.readOnly, true);
assert.equal(manifest.policy.databaseWritesAllowed, false);
assert.equal(manifest.policy.responseContractChanged, false);
assert.equal(manifest.policy.markReadChanged, false);
assert.equal(manifest.policy.externalCallsAdded, false);
assert.equal(manifest.policy.productionUnchanged, true);
assert.equal(manifest.policy.fastReadOnly, true);
assert.equal(manifest.policy.enrichedReadOnly, true);
assert.equal(manifest.policy.productCalculationPreserved, true);
assert.equal(manifest.policy.persistenceRequiresExplicitOptIn, true);
assert.equal(manifest.policy.profileCachePersistenceOnGet, false);
assert.equal(manifest.policy.customerContextV16Changed, false);

assert.equal(v16Manifest.status, 'implementation_candidate_locked');
assert.equal(v16Manifest.country, 'EC');
assert.equal(v16Manifest.publicationStatus, 'not_published');
assert.equal(v16Manifest.productionUnchanged, true);
assert.equal(v16Manifest.policy.readOnly, true);
assert.equal(v16Manifest.policy.applicationAllowed, false);
assert.equal(v16Manifest.policy.databaseSchemaChanged, false);
assert.equal(v16Manifest.policy.externalCallsAllowed, false);
assert.equal(v16Manifest.policy.route, 'GET /api/customer-context/:phone');
assert.equal(v16Manifest.policy.schemaVersion, 'v16.customer-current-context.readonly.1');
assert.equal(v16Manifest.policy.interfaceReadOnly, true);
assert.deepEqual(v16Manifest.policy.interfaceMethodsAllowed, ['GET']);
assert.equal(v16Manifest.policy.interfaceApplicationAllowed, false);

assert.match(service, /ContactStateModel[\s\S]*MessageModel[\s\S]*OrderModel[\s\S]*ShipmentModel[\s\S]*VslVisitModel/);
assert.match(service, /\.lean\(\)/);
assert.doesNotMatch(service, forbiddenMutation);
assert.doesNotMatch(service, forbiddenExternalImport);
assert.match(customerContextRoute, /router\.get\('\/:phone', authMiddleware,/);
assert.doesNotMatch(customerContextRoute, /router\.(?:post|put|patch|delete)\s*\(/);
assert.doesNotMatch(customerContextRoute, forbiddenMutation);
assert.match(index, /import '\.\/services\/whatsappChatsReadonlyFreezeRuntimeGuardV16\.js';/);
assert.doesNotMatch(index, /import '\.\/services\/customerCurrentContextFreezeRuntimeGuardV16\.js';/);
assert.deepEqual(
    [...index.matchAll(/^import '\.\/services\/([^']*FreezeRuntimeGuard[^']*)';$/gm)].map((match) => match[1]),
    ['whatsappChatsReadonlyFreezeRuntimeGuardV16.js']
);
assert.match(index, /app\.use\('\/api\/customer-context', customerContextRoutes\)/);

for (const scriptName of ['senior:check', 'guard:tex-ultra-approved', 'guard:ec-product-funnel-isolation', 'deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], successorGuardPattern, `${scriptName} deve usar o guard sucessor`);
    assert.doesNotMatch(packageJson.scripts[scriptName], previousTopGuardPattern, `${scriptName} nao pode encadear o guard V16 anterior`);
}
assert.equal(packageJson.scripts['guard:whatsapp-chats-readonly'], 'node scripts/guard-whatsapp-chats-readonly-v16.mjs');
assert.match(packageJson.scripts['senior:check'], /tests\/whatsapp-chats-readonly\.test\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tests\/customer-current-context\.test\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tests\/customer-current-context-route\.test\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tests\/customer-current-context-panel\.test\.mjs/);

const getChatsStart = whatsappRoute.indexOf("router.get('/chats'");
const getChatsEnd = whatsappRoute.indexOf("router.get('/media-proxy'", getChatsStart);
assert.ok(getChatsStart >= 0 && getChatsEnd > getChatsStart, 'bloco GET /chats nao localizado');
const getChatsSource = whatsappRoute.slice(getChatsStart, getChatsEnd);
const enrichedMarker = getChatsSource.indexOf('// Enrich chats with Order data');
const productCalls = [...getChatsSource.matchAll(/panelProductContextForChat\(\{([\s\S]*?)\}\)/g)];
const profileCalls = [...getChatsSource.matchAll(/resolveProfilePictureUrl\(\{([\s\S]*?)\}\)/g)];

assert.ok(enrichedMarker > 0, 'marcador do caminho enriched nao localizado');
assert.equal(productCalls.length, 2, 'fast e enriched devem ser os dois callers do contexto de produto');
assert.ok(productCalls[0].index < enrichedMarker, 'primeiro caller deve pertencer ao caminho fast');
assert.ok(productCalls[1].index > enrichedMarker, 'segundo caller deve pertencer ao caminho enriched');
assert.match(productCalls[0][1], /persistChanges:\s*false/);
assert.match(productCalls[1][1], /persistChanges:\s*false/);
assert.equal(profileCalls.length, 1, 'somente o caminho enriched resolve foto durante GET /chats');
assert.ok(profileCalls[0].index > enrichedMarker, 'resolucao de foto deve permanecer no caminho enriched');
assert.match(profileCalls[0][1], /persistCache:\s*false/);
assert.doesNotMatch(getChatsSource, /\b(?:ContactState|Message|Order|Shipment)\.(?:updateOne|updateMany|findOneAndUpdate|bulkWrite|create|insertOne|deleteOne|deleteMany)\s*\(/);
assert.match(whatsappRoute, /export const panelProductContextForChat = async \(\{[\s\S]*persistChanges = true/);
assert.match(whatsappRoute, /if \(persistChanges\) \{\s*await ContactState\.updateOne/);
assert.match(whatsappRoute, /export const resolveProfilePictureUrl = async \(\{[\s\S]*persistCache = true/);
assert.match(whatsappRoute, /if \(persistCache && contactState\?\._id\) \{/);

assert.match(panel, /async function selectChat\(chatId, \{ markRead = false \} = \{\}\)/);
assert.match(panel, /if \(markRead\) markSelectedChatRead\(\);/);
assert.match(panel, /const markSelectedChatRead = \(\) => \{/);
assert.match(panel, /api\('\/api\/whatsapp\/chats\/read', \{/);
assert.match(panel, /selectChat\(button\.dataset\.chatId, \{ markRead: true \}\)/);
assert.match(whatsappRoute, /router\.post\('\/chats\/read', async \(req, res\) => \{/);
assert.match(whatsappRoute, /'metadata\.panelLastReadAt': new Date\(\)/);

assert.equal([...testSource.matchAll(/\btest\('/g)].length, 2);
assert.match(testSource, /caminhos fast e enriched preservam resposta e nao alteram modelos nem timestamps/);
assert.match(testSource, /const writeMethods = \[/);
assert.match(testSource, /assert\.deepEqual\(state, stateBefore/);
assert.match(testSource, /responseContractKeys/);
assert.match(testSource, /persistChanges: false/);
assert.match(testSource, /persistCache: false/);

console.log(`[WHATSAPP-CHATS-READONLY-GUARD-V16] OK: ${manifest.freezeId} preserva V16 e bloqueia persistencia no GET de conversas.`);
