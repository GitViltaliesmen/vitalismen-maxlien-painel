import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guard = path.join(root, 'scripts/guard-unified-successor-v202-r4.mjs');
const guardSha256 = 'f371a7b1343213423a74af1a9d6b37a1d1a8e706e47107bb0a48fb1c518a1a44';
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(guard)).digest('hex'),
    guardSha256, 'R4_GUARD_TAMPERED');
const [mode, ...input] = process.argv.slice(2);
const run = (args, cwd, marker, nodeOptions = '') => {
    const result = spawnSync(process.execPath, args, {
        cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, NODE_OPTIONS: nodeOptions }, timeout: 180_000
    });
    if (result.error) throw result.error;
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    assert.equal(result.status, 0, `R4_CHILD_FAILED:${args.join(' ')}`);
    assert.match(result.stdout, marker, `R4_CHILD_MARKER_MISSING:${args.join(' ')}`);
};
run(['--test', 'tests/unified-successor-v202-r4-operational.test.mjs'],
    root, /(?:#|ℹ) pass 7\r?\n/);
if (mode === '--fixture') {
    assert.equal(input.length, 3, 'R4_FIXTURE_EXACT_ARGS_REQUIRED');
    const [currentRoot, historicalRoot, frozenRoot] = input.map(value => fs.realpathSync(value));
    assert.equal(new Set([root, currentRoot, historicalRoot, frozenRoot]).size, 4,
        'R4_FIXTURES_NOT_ISOLATED');
    run(['--test', 'tests/unified-successor-v202-r4.test.mjs'],
        frozenRoot, /(?:#|ℹ) pass 19\r?\n/);
    const preload = pathToFileURL(path.join(root,
        'scripts/lib/unified-successor-v202-r4-preload.mjs')).href;
    const code = `
        const before = Object.getOwnPropertyNames(globalThis).filter(x => x.startsWith('__VITALISMEN_'));
        const { runUnifiedSuccessor } = await import(process.argv[1]);
        const result = await runUnifiedSuccessor({
            root: process.cwd(), historicalRoot: process.argv[2]
        });
        if (result.successorChainContract !== 'PASS' || result.chainGuardsCovered !== 33
            || result.canonicalIdentities !== 83) throw new Error('R4_CHAIN_RESULT_INVALID');
        const after = Object.getOwnPropertyNames(globalThis).filter(x => x.startsWith('__VITALISMEN_'));
        if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('R4_CONTEXT_LEAK');
        console.log('UNIFIED_SUCCESSOR=PASS');
        console.log('CANONICAL_BLOBS=83/83_PASS');
        console.log('TEST_FIXTURE_CONTEXT_RESTORED=YES');
    `;
    run(['--input-type=module', '-e', code, preload, historicalRoot],
        currentRoot, /UNIFIED_SUCCESSOR=PASS/);
    process.stdout.write('NEGATIVE_GOVERNANCE=18/18_PASS\n');
    process.stdout.write('SENIOR_OPERATIONAL_CHECK=PASS\n');
} else if (mode === '--runtime') {
    assert.equal(input.length, 1, 'R4_RUNTIME_EXACT_ARGS_REQUIRED');
    const release = fs.realpathSync(input[0]);
    assert.equal(release, root, 'R4_RUNTIME_RUNNER_ROOT_MISMATCH');
    const preload = pathToFileURL(path.join(root,
        'scripts/lib/unified-successor-v202-r4-preload.mjs')).href;
    const probe = `
        const r4 = globalThis.__VITALISMEN_R4_OPERATIONAL_CONTEXT;
        if (r4?.loaded !== true || r4.allowlistCount !== 83
            || r4.releaseAttestationValidated !== true
            || r4.gitRuntimeDependency !== false
            || globalThis.__VITALISMEN_V199_EC_BOT_CORE_HEALTH_META_CONTEXT?.loaded !== true
            || globalThis.__VITALISMEN_V146_CONTEXT?.loaded !== true) {
            throw new Error('R4_RUNTIME_CONTEXT_INVALID');
        }
        console.log('NODE_IMPORT_R4=PASS');
        console.log('RELEASE_ATTESTATION=PASS');
        console.log('ALLOWLIST=83/83_PASS');
    `;
    run(['--input-type=module', '-e', probe], release,
        /NODE_IMPORT_R4=PASS/, `--import=${preload}`);
    process.stdout.write('SENIOR_OPERATIONAL_GUARD=PASS\n');
} else {
    throw new Error('R4_RUNNER_MODE_INVALID');
}
