import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/dropiAutomaticSubmitReliabilityFreezeRuntimeGuardV18.js');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/dropi-automatic-submit-reliability-v18-20260817.json'));
const index = read('src/index.js');
const packageJson = JSON.parse(read('package.json'));
const browser = read('src/services/droppiEcuadorBrowserService.js');
const successorPattern = /guard-dropi-automatic-submit-reliability-v18\.mjs/;

assert.equal(manifest.freezeId, 'dropi-automatic-submit-reliability-v18-20260817');
assert.equal(manifest.status, 'approved_frozen');
assert.equal(manifest.country, 'EC');
assert.equal(manifest.publicationStatus, 'approved_for_production');
assert.equal(manifest.policy.staleTokenAuthenticatesLoginScreen, false);
assert.equal(manifest.policy.citySuffixCollisionAccepted, false);
assert.equal(manifest.policy.pricesChanged, false);
assert.equal(manifest.policy.commercialFunnelChanged, false);
assert.equal(manifest.policy.externalSendsAdded, false);

assert.match(index, /import '\.\/services\/dropiAutomaticSubmitReliabilityFreezeRuntimeGuardV18\.js';/);
assert.doesNotMatch(index, /^import '\.\/services\/productionSecurityProductIntegrityFreezeRuntimeGuardV17\.js';/m);
assert.match(browser, /session expired while opening product; login required/);
assert.match(browser, /const storedAuthState = await inspectDropiPageAuthState\(page\)/);
assert.doesNotMatch(browser, /\(isLoginUrl\(page\.url\(\)\) \|\| await hasLoginPrompt\(page\)\) && !\(await hasDropiSessionToken\(page\)\)/);
assert.match(browser, /if \(!rowProduct\.key \|\| !shipmentProduct\.key\) return false/);

for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:operational-mode-zapi-health',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.match(packageJson.scripts[scriptName], successorPattern, `${scriptName} deve usar V18`);
}
assert.match(packageJson.scripts['senior:check'], /tests\/dropi-automatic-submit-regression\.test\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tests\/panel-sensitive-routes-auth\.test\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tests\/ecuador-product-unknown\.test\.mjs/);

console.log(`[DROPI-AUTOMATIC-SUBMIT-RELIABILITY-GUARD-V18] OK: ${manifest.freezeId}.`);
