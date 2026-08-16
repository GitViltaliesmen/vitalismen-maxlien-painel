import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/customerCurrentContextFreezeRuntimeGuardV16.js');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/customer-current-context-v16-20260816.json'));
const service = read('src/services/customerCurrentContextService.js');
const route = read('src/routes/customerContext.js');
const index = read('src/index.js');
const packageJson = JSON.parse(read('package.json'));
const forbiddenMutation = /\.(?:save|updateOne|updateMany|findOneAndUpdate|insertOne|create|deleteOne|deleteMany|bulkWrite)\s*\(/;
const forbiddenExternalImport = /from\s+['"][^'"]*(?:droppi|dropi|metaConversions|sendText|sendAudio|openai|scheduler|conversationEngine|botHandler)[^'"]*['"]/i;
const requiredProtectedFiles = [
    'package.json',
    'src/index.js',
    'src/routes/customerContext.js',
    'src/services/customerCurrentContextService.js',
    'src/services/customerCurrentContextFreezeRuntimeGuardV16.js',
    'scripts/guard-customer-current-context-v16.mjs',
    'tests/customer-current-context.test.mjs',
    'tests/customer-current-context-route.test.mjs',
    'docs/ESPECIFICACAO_V16_CONTEXTO_ATUAL_CLIENTE.md',
    'docs/CUSTOMER_CURRENT_CONTEXT_FREEZE_V16_20260816.md',
    'docs/freeze/customer-data-intelligence-v15-20260815.json'
];

assert.equal(manifest.status, 'implementation_candidate_locked');
assert.equal(manifest.country, 'EC');
assert.equal(manifest.publicationStatus, 'not_published');
assert.equal(manifest.productionUnchanged, true);
assert.equal(manifest.policy.readOnly, true);
assert.equal(manifest.policy.applicationAllowed, false);
assert.equal(manifest.policy.databaseSchemaChanged, false);
assert.equal(manifest.policy.externalCallsAllowed, false);
assert.equal(manifest.policy.route, 'GET /api/customer-context/:phone');
assert.deepEqual(manifest.supersededParentProtectedFiles, ['package.json', 'src/index.js']);
assert.deepEqual(Object.keys(manifest.protectedFiles).sort(), requiredProtectedFiles.slice().sort());

assert.match(service, /ContactStateModel[\s\S]*MessageModel[\s\S]*OrderModel[\s\S]*ShipmentModel[\s\S]*VslVisitModel/);
assert.match(service, /\.lean\(\)/);
assert.doesNotMatch(service, forbiddenMutation);
assert.doesNotMatch(service, forbiddenExternalImport);
assert.match(route, /router\.get\('\/:phone', authMiddleware,/);
assert.doesNotMatch(route, /router\.(?:post|put|patch|delete)\s*\(/);
assert.doesNotMatch(route, forbiddenMutation);
assert.match(index, /customerCurrentContextFreezeRuntimeGuardV16\.js/);
assert.match(index, /app\.use\('\/api\/customer-context', customerContextRoutes\)/);

for (const scriptName of ['senior:check', 'guard:tex-ultra-approved', 'guard:ec-product-funnel-isolation', 'deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], /guard-customer-current-context-v16\.mjs/);
}
assert.match(packageJson.scripts['senior:check'], /tests\/customer-current-context\.test\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tests\/customer-current-context-route\.test\.mjs/);

console.log(`OK: ${manifest.freezeId} herda V15 e bloqueia escrita ou integracao externa na fatia backend.`);
