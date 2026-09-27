import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
    R5_PRELOAD_PATH,
    readRootR5Checkpoint,
    sha256
} from './lib/unified-successor-v202-r5-authority.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [mode, releasePath] = process.argv.slice(2);
assert.equal(process.argv.length, 4, 'R5_RUNNER_EXACT_ARGS_REQUIRED');
const release = fs.realpathSync(releasePath);
assert.equal(release, root, 'R5_RUNNER_ROOT_MISMATCH');
const checkpoint = readRootR5Checkpoint(root).value;
const relative = 'scripts/run-unified-successor-v202-r5.mjs';
assert.equal(sha256(fs.readFileSync(path.join(root, relative))),
    checkpoint.controlHashes[relative], 'R5_RUNNER_TAMPERED');
const preload = pathToFileURL(path.join(root, R5_PRELOAD_PATH)).href;
const commands = {
    '--runtime': ['--input-type=module', '-e',
        'const c=globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT; if(c?.loaded!==true || c.parentR4Verified!==true || c.v47SuccessorVerified!==true || c.releaseAttestationValidated!==true || c.gitRuntimeDependency!==false || globalThis.__VITALISMEN_V199_EC_BOT_CORE_HEALTH_META_CONTEXT?.loaded!==true || globalThis.__VITALISMEN_V146_CONTEXT?.loaded!==true) throw new Error("R5_RUNTIME_CONTEXT_INVALID"); const {assertR5Successor}=await import("./scripts/guard-unified-successor-v202-r5.mjs"); await assertR5Successor(); console.log("R5_RUNTIME=PASS");'],
    '--freeze-lock': ['scripts/guard-freeze-lock-successor-v202-r5.mjs'],
    '--final-release': ['scripts/guard-final-release-validator-successor-v202-r5.mjs']
};
assert.ok(Object.hasOwn(commands, mode), 'R5_RUNNER_MODE_INVALID');
const result = spawnSync(process.execPath, commands[mode], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 180000,
    env: { ...process.env, NODE_OPTIONS: '--import=' + preload }
});
if (result.error) throw result.error;
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
assert.equal(result.status, 0, 'R5_RUNNER_CHILD_FAILED:' + mode);
const marker = {
    '--runtime': 'R5_RUNTIME=PASS',
    '--freeze-lock': 'R5_FREEZE_LOCK=PASS',
    '--final-release': 'FINAL_RELEASE_VALIDATOR_R5=PASS'
}[mode];
assert.ok((result.stdout || '').includes(marker), 'R5_RUNNER_MARKER_MISSING:' + mode);
