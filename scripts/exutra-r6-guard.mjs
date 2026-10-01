import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { R6_PARENT_RELEASE, verifyR6Release } from './lib/exutra-r6-authority.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verified = verifyR6Release(root);
// Ancestral guards run on their immutable R5 release, not against invented
// R5 identities. Every unchanged child file is also compared to that parent.
const parent = '/opt/vitalismen-automacao/releases/' + R6_PARENT_RELEASE;
const { default: dotenv } = await import('dotenv');
const guardEnv = { ...process.env, ...dotenv.parse(fs.readFileSync(parent + '/.env')),
    ...dotenv.parse(fs.readFileSync('/var/lib/vitalismen-deploy/ec-bot-core-v78.env')),
    NODE_OPTIONS: '', npm_config_node_options: '' };
// The historical preload itself only permits its historical current release.
// Run its executables before the switch; after the switch the same immutable
// parent authority is reverified by verifyR6Release above, without impersonating
// the child as an R5 release or changing the historical preload.
for (const mode of fs.realpathSync('/opt/vitalismen-automacao/current') === parent
    ? ['--runtime', '--freeze-lock', '--final-release'] : []) {
    const result = spawnSync(process.execPath, [parent + '/scripts/run-unified-successor-v202-r5.mjs', mode, parent],
        { cwd: parent, encoding: 'utf8', timeout: 180000,
            env: guardEnv });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, 'R6_PARENT_GUARD_FAILED:' + mode);
}
if (fs.realpathSync('/opt/vitalismen-automacao/current') === parent) {
    const result = spawnSync('/usr/bin/npm', ['run', 'guard:predeploy-v71'], { cwd: parent,
        encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024, env: { ...guardEnv,
            NODE_OPTIONS: '--import=file://' + parent + '/scripts/lib/unified-successor-v202-r5-preload.mjs' } });
    assert.equal(result.status, 0, 'R6_PARENT_PREDEPLOY_GUARD_FAILED');
}
assert.equal(verified.manifest.policy.humanHoldPreserved, true);
assert.equal(fs.existsSync(root + '/.git'), false);
console.log('R6_ANCESTRY_AND_EXACT_HASH_GUARDS=PASS');
