import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
assert.equal(process.argv.length, 3, 'R5_PRECOMMIT_EXACT_HISTORICAL_ROOT_REQUIRED');
const historical = fs.realpathSync(process.argv[2]);
assert.equal(process.platform, 'win32', 'R5_PRECOMMIT_LOCAL_WINDOWS_ONLY');
const preload = path.join(root, 'scripts/lib/unified-successor-v202-r5-precommit-context.mjs');
const npmCli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const result = spawnSync(process.execPath, [npmCli, 'run', 'senior:check'], {
    cwd: root,
    env: {
        ...process.env,
        NODE_OPTIONS: '--import=' + pathToFileURL(preload).href,
        VITALISMEN_R5_PRECOMMIT_ONLY: 'true',
        VITALISMEN_R5_HISTORICAL_ROOT: historical,
        V152_B_SHADOW_TEST_CONTEXT: 'true'
    },
    stdio: 'inherit',
    timeout: 300000
});
if (result.error) throw result.error;
assert.equal(result.status, 0, 'R5_PRECOMMIT_SENIOR_FAILED');
process.stdout.write('R5_PRECOMMIT_SENIOR_CHECK=PASS\n');
