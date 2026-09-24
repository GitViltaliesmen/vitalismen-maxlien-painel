import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRepurchaseV141V185GovernanceV202 } from './guard-repurchase-v141-v185-governance-v202.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.deepEqual(process.argv.slice(2), [], 'V202_RUNNER_ARGUMENTS_FORBIDDEN');
assertRepurchaseV141V185GovernanceV202();

const run = (executable, args, options = {}) => {
    const result = spawnSync(executable, args, { cwd: root, stdio: 'inherit', ...options });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `V202_RUNNER_FAILED:${args.join(' ')}`);
};
run(process.execPath, [
    '--test',
    'tests/repurchase-v141-v185-governance-v202.test.mjs',
    'tests/creative-sales-metrics-v185.test.mjs',
    'tests/funnel-metrics-v185-route.test.mjs',
    'tests/funnel-metrics-v185.browser.test.mjs'
]);
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'test:funnel-metrics'], {
    shell: process.platform === 'win32'
});
console.log('V202_GOVERNANCE_RUNNER=PASS');
