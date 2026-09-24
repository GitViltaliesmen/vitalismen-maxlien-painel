import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guard = path.join(root, 'scripts/guard-unified-successor-v202-r4.mjs');
const guardSha256 = 'e525232be9eca0342448da1f4368ee2b385d862fea9867756a8e0485d862ed0d';
const currentRoot = process.argv[2] && fs.realpathSync(process.argv[2]);
const historicalRoot = process.argv[3] && fs.realpathSync(process.argv[3]);
assert.equal(process.argv.length, 4, 'R4_EXACTLY_TWO_FIXTURES_REQUIRED');
assert.ok(currentRoot && historicalRoot && path.isAbsolute(currentRoot) &&
    path.isAbsolute(historicalRoot), 'R4_ABSOLUTE_FIXTURES_REQUIRED');
assert.notEqual(currentRoot, historicalRoot, 'R4_FIXTURES_MUST_BE_SEPARATE');
assert.notEqual(currentRoot, root, 'R4_CANONICAL_FIXTURE_NOT_CONTRACT_ROOT');
assert.notEqual(historicalRoot, root, 'R4_HISTORICAL_FIXTURE_NOT_CONTRACT_ROOT');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(guard)).digest('hex'),
    guardSha256, 'R4_GUARD_TAMPERED');

const run = (args, cwd, marker) => {
    const result = spawnSync(process.execPath, args, {
        cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, NODE_OPTIONS: '' }
    });
    if (result.error) throw result.error;
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    assert.equal(result.status, 0, `R4_CHILD_FAILED:${args.join(' ')}`);
    assert.match(result.stdout, marker, `R4_CHILD_MARKER_MISSING:${args.join(' ')}`);
};

run(['--test', 'tests/unified-successor-v202-r4.test.mjs'], root, /# pass 19\r?\n/);
const preload = pathToFileURL(path.join(root,
    'scripts/lib/unified-successor-v202-r4-preload.mjs')).href;
const code = `
    const before = Object.getOwnPropertyNames(globalThis).filter(x => x.startsWith('__VITALISMEN_'));
    const { runUnifiedSuccessor } = await import(process.argv[1]);
    const result = await runUnifiedSuccessor({ root: process.cwd(), historicalRoot: process.argv[2] });
    if (result.successorChainContract !== 'PASS' || result.chainGuardsCovered !== 33
        || result.canonicalIdentities !== 83) throw new Error('R4_CHAIN_RESULT_INVALID');
    const after = Object.getOwnPropertyNames(globalThis).filter(x => x.startsWith('__VITALISMEN_'));
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('R4_CONTEXT_LEAK');
    console.log('SUCCESSOR_CHAIN_CONTRACT=PASS');
    console.log('CHAIN_GUARDS_COVERED=33/33');
    console.log('CANONICAL_IDENTITIES=83/83');
    console.log('CONTEXT_RESTORED=YES');
`;
run(['--input-type=module', '-e', code, preload, historicalRoot], currentRoot,
    /SUCCESSOR_CHAIN_CONTRACT=PASS/);
console.log('NEGATIVE_TEST_MATRIX=18/18_PASS');
console.log('SENIOR_SUCCESSOR_GUARD=PASS');
console.log('SENIOR_SUCCESSOR_CHECK=PASS');
