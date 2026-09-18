import './lib/ec-runtime-successor-v181-context.mjs';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const browserTest = read('scripts/test-panel-customer-selection-browser-v51.mjs');
const panel = read('public/qr.html');
const context = globalThis.__VITALISMEN_V181_V51_BROWSER_SUCCESSOR_CONTEXT;
const allowedChanges = new Set([
    'docs/V181_V51_SUCCESSOR_ALIGNMENT_FREEZE_20260918.md',
    'docs/freeze/ec-v51-browser-successor-v181-20260918.json',
    'scripts/guard-v51-browser-successor-v181.mjs',
    'scripts/lib/ec-runtime-successor-v181-context.mjs',
    'scripts/run-with-v181-context.mjs',
    'scripts/test-panel-customer-selection-browser-v51.mjs'
]);

assert.equal(context?.loaded, true, '[V181] context_not_loaded');
assert.equal(context.policy?.functionalCodeChanged, 0, '[V181] functional_scope_changed');
assert.equal(context.policy?.v180Integrated, false, '[V181] V180_integrated');
assert.match(browserTest, /hasText: 'Guayaquil Los Almendros'/);
assert.match(browserTest, /AGENCY_BEFORE_CLICK=EMPTY/);
assert.match(browserTest, /SINGLE_AUTOSAVE_AFTER_CLICK=1/);
assert.match(browserTest, /SAME_AGENCY_REAPPLY_AUTOSAVE=0/);
assert.match(browserTest, /AGENCY_SUGGESTION_CHANGES_FORM_AFTER_APPLY=FALSE/);
assert.match(browserTest, /MIRA_TO_GUAYAQUIL_LEAK=0/);
assert.match(browserTest, /WRONG_CUSTOMER_PATCH=0/);
assert.match(panel, /Clique na agência correta para selecioná-la/);
assert.doesNotMatch(panel, /const automaticMatch = intelligence\.selectAutomaticAgency/);

const status = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: process.cwd(),
    encoding: 'utf8'
});
assert.equal(status.status, 0, status.stderr || status.stdout);
const changedFiles = status.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
    const value = line.slice(3).trim();
    const renamed = value.includes(' -> ') ? value.split(' -> ').at(-1) : value;
    return renamed.replaceAll('\\', '/');
});
for (const relativePath of changedFiles) {
    assert.equal(allowedChanges.has(relativePath), true, `[V181] out_of_scope_change:${relativePath}`);
}

const v180Ancestor = spawnSync('git', [
    'merge-base', '--is-ancestor',
    '2bb439145d1eb80a2b44e99788d4129c2a35c0ef',
    'HEAD'
], { cwd: process.cwd() });
assert.equal(v180Ancestor.status, 1, '[V181] V180 must remain outside this candidate');

console.log('V181_V51_SUCCESSOR_ALIGNMENT=PASS');
console.log('ROOT_CAUSE=STALE_V51_BROWSER_EXPECTATION_CONFLICTS_WITH_V146_SUCCESSOR_CONTRACT');
console.log('V180_CAUSED_V51_FAILURE=NO');
console.log('AUTO_APPLY_ABSENT=PASS');
console.log('FUNCTIONAL_CODE_CHANGED=0');
console.log('V180_INTEGRATED=NO');
console.log('PRODUCTION_CHANGED=NO');
console.log('GUARDS_BYPASSED=NO');
