import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const contract = JSON.parse(fs.readFileSync('docs/freeze/freeflow-priority-v219-contract.json', 'utf8'));
assert.equal(contract.project, 'VITALISMEN_EC');
assert.equal(contract.databaseMigrations, false);
assert.equal(contract.automaticReplay, false);
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const changed = git('diff', '--name-only', contract.parentCommit, 'HEAD').split('\n').filter(Boolean).sort();
assert.deepEqual(changed, [...contract.allowedDelta].sort(), 'V219_UNEXPECTED_DELTA');
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'V219_DIRTY_RELEASE');
const read = p => fs.readFileSync(p, 'utf8');
const engine = read('src/services/conversationEngine.js');
assert(engine.indexOf('const entry = await handleVitPowerB01InboundV216') < engine.indexOf('const questionPriorityEnabledV219'));
assert.match(engine, /!structuredOrderData && !quantityOnly/);
assert.match(engine, /__VITALISMEN_EC_FREEFLOW_V219\?\.canHandle/);
for (const product of ['NITRIX_AGENT_KEY', 'TEX_ULTRA_AGENT_KEY']) assert(engine.includes(product));
assert.match(read('src/services/principalSdrFreeflowService.js'), /questionPriorityEnabled = false/);
assert.match(read('src/services/principalSdrFreeflowService.js'), /answer_questions_before_order_confirmation/);
const runtime = read('src/services/principalSdrFreeflowRuntimeService.js');
for (const token of ['human_hold_preserved', 'existing_active_order_preserved', 'principal_sdr_router_lease_required', 'freeflow_reply_mirror_missing', "status: 'ambiguous'", 'retryAllowed: false']) assert(runtime.includes(token), token);
// Compare entire bytes of protected areas, rather than a few presence assertions.
for (const p of ['src/services/vitPowerB01CoreV216Service.js', 'src/services/vitPowerB01RuntimeV216Service.js', 'src/routes/zapi.js', 'src/models/ContactState.js', 'src/services/ecuadorProductService.js', 'src/services/agentRouter.js']) {
  const parent = execFileSync('git', ['show', contract.parentCommit + ':' + p]);
  assert(parent.equals(fs.readFileSync(p)), 'V219_PROTECTED_FILE_DRIFT:' + p);
}
if (process.argv.includes('--public-panel')) {
  const digest = createHash('sha256').update(fs.readFileSync(contract.publicPanelPath)).digest('hex');
  assert.equal(digest, contract.publicPanelSha256, 'V219_PUBLIC_PANEL_DRIFT');
}
console.log(JSON.stringify({ project: 'VITALISMEN_EC', status: 'PASS_NONREGRESSION_V219', allowedChangedFiles: changed.length, protectedFilesUnchanged: true }));
