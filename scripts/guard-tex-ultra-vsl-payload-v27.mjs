import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/texUltraVslPayloadFreezeRuntimeGuardV27.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const funnel = read('src/services/texUltraFunnelService.js');
const index = read('src/index.js');
const packageJson = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/ec-panel-quality.yml');
const manifest = JSON.parse(read('docs/freeze/tex-ultra-vsl-payload-v27-20260818.json'));

assert.equal(manifest.publicationStatus, 'local_candidate_not_authorized');
assert.equal(manifest.operatorPublicationApproval.status, 'required_explicit');
assert.equal(manifest.operatorPublicationApproval.scope, 'controlled_deploy_v27_test_phone_5515998038637');
assert.match(index, /import '\.\/services\/texUltraVslPayloadFreezeRuntimeGuardV27\.js';/);
assert.doesNotMatch(index, /^import '.+FreezeRuntimeGuardV(?:17|18|19|20|21|22|23|24|25|26)\.js';/m);
assert.match(funnel, /texUltraVslPayloadData/);
assert.match(funnel, /mergeTexUltraVslPayloadDraft/);
assert.match(funnel, /texUltraNextDataCollectionStep/);
assert.match(funnel, /official_multiline_cta/);
assert.match(packageJson.scripts['senior:check'], /guard-tex-ultra-vsl-payload-v27\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tex-ultra-vsl-payload-v27\.test\.mjs/);
assert.match(packageJson.scripts['deploy:ec-safe'], /assert-tex-ultra-vsl-payload-approved-v27\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-tex-ultra-vsl-payload-approved-v27\.mjs/);
assert.match(workflow, /scripts\/guard-tex-ultra-vsl-payload-v27\.mjs/);
assert.match(workflow, /tests\/tex-ultra-vsl-payload-v27\.test\.mjs/);

console.log('TEX_ULTRA_VSL_PAYLOAD_V27_GUARD=OK');
