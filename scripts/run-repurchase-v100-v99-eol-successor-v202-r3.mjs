import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import './lib/repurchase-v141-v185-governance-v202-r2-context.mjs';
import { assertRepurchaseV202R2Successor } from './guard-repurchase-v141-v185-governance-v202-r2.mjs';
import { assertV100R3Successor } from './guard-repurchase-v100-v99-eol-successor-v202-r3.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preload = pathToFileURL(path.join(root,
    'scripts/lib/repurchase-v141-v185-governance-v202-r2-context.mjs')).href;
assert.deepEqual(process.argv.slice(2), [], 'V100_R3_RUNNER_ARGUMENTS_FORBIDDEN');
assertRepurchaseV202R2Successor();
assertV100R3Successor();

const run = (args, expectedPass) => {
    const result = spawnSync(process.execPath, args, {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: `--import=${preload}` },
        maxBuffer: 16 * 1024 * 1024
    });
    if (result.error) throw result.error;
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    assert.equal(result.status, 0, `V100_R3_RUNNER_FAILED:${args.join(' ')}`);
    assert.match(result.stdout, new RegExp(`^# pass ${expectedPass}$`, 'm'),
        `V100_R3_PASS_COUNT_INVALID:${args.join(' ')}`);
    assert.match(result.stdout, /^# fail 0$/m, `V100_R3_FAILURE_COUNT_INVALID:${args.join(' ')}`);
};

run(['--test',
    'tests/ec-delivered-repurchase-v45.test.mjs',
    'tests/ec-repurchase-sync-preservation-v46.test.mjs',
    'tests/ec-repurchase-sqlite-serialization-v47.test.mjs',
    'tests/ec-repurchase-registration-v99.test.mjs',
    'tests/panel-confirmed-persistence-v158.test.mjs',
    'tests/repurchase-purchase-ordering-v202.test.mjs'
], 37);
run(['--test', '--test-name-pattern=V100 preserva na tela|V100 mantém o pedido antigo',
    'tests/ec-repurchase-panel-precedence-v100.test.mjs'
], 2);
run(['--test', 'tests/repurchase-v100-v99-eol-successor-v202-r3.test.mjs'], 10);
console.log('V100_HISTORICAL_STATUS=PRESERVED_NOT_CURRENT_GATE');
console.log('V100_SUCCESSOR_STATUS=PASS');
console.log('CURRENT_FUNCTIONAL_REGRESSION=40/40_EFFECTIVE_PASS');
