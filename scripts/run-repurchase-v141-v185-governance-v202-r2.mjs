import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import './lib/repurchase-v141-v185-governance-v202-r2-context.mjs';
import { assertRepurchaseV141V185GovernanceV202R1 } from './guard-repurchase-v141-v185-governance-v202-r1.mjs';
import { assertRepurchaseV202R2Successor } from './guard-repurchase-v141-v185-governance-v202-r2.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.deepEqual(process.argv.slice(2), [], 'V202_R2_RUNNER_ARGUMENTS_FORBIDDEN');
assertRepurchaseV141V185GovernanceV202R1();
assertRepurchaseV202R2Successor();

const preload = pathToFileURL(path.join(root,
    'scripts/lib/repurchase-v141-v185-governance-v202-r2-context.mjs')).href;
const run = (executable, args, options = {}) => {
    const result = spawnSync(executable, args, {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, NODE_OPTIONS: `--import=${preload}` },
        ...options
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `V202_R2_RUNNER_FAILED:${args.join(' ')}`);
};

run(process.execPath, [
    '--test',
    'tests/repurchase-v141-v185-governance-v202.test.mjs',
    'tests/repurchase-v141-v185-governance-v202-r1.test.mjs',
    'tests/repurchase-v141-v185-governance-v202-r2.test.mjs',
    'tests/creative-sales-metrics-v185.test.mjs',
    'tests/funnel-metrics-v185-route.test.mjs',
    'tests/funnel-metrics-v185.browser.test.mjs'
]);
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'test:funnel-metrics'], {
    shell: process.platform === 'win32'
});
console.log('V202_R2_SUCCESSOR_CANONICAL_SUITE=PASS');
