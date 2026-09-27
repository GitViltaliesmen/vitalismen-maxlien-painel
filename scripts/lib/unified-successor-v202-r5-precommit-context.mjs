import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { R5_CONTROL_PATHS, readR5Manifest } from './unified-successor-v202-r5-authority.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const historicalRoot = fs.realpathSync(process.env.VITALISMEN_R5_HISTORICAL_ROOT || '');
const parentCommit = 'fe32da042617335d11b9fcde2e5dc0d4519c9915';
const historicalCommit = '641759b160c2b91e95a3f1df371ad372a74d72e1';
const r4ManifestPath = 'docs/freeze/unified-successor-v202-r4-v78-controller-pin-20260925.json';
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const read = (relative) => fs.readFileSync(path.join(root, relative));

assert.equal(process.env.VITALISMEN_R5_PRECOMMIT_ONLY, 'true', 'R5_FIXTURE_NOT_REQUESTED');
assert.notEqual(root.replaceAll('\\', '/').startsWith('/opt/vitalismen-automacao/'), true,
    'R5_FIXTURE_FORBIDDEN_IN_RELEASE');
assert.equal(git(historicalRoot, 'rev-parse', 'HEAD'), historicalCommit, 'R5_HISTORICAL_COMMIT_INVALID');
assert.equal(git(root, 'merge-base', parentCommit, 'HEAD'), parentCommit, 'R5_PARENT_NOT_ANCESTOR');
assert.equal(sha256(read(r4ManifestPath)),
    '5db4769b20956ae9aba52293e1699b8fdbf4999aaa9ed8f62d74a8e9c7c9c349',
    'R5_R4_MANIFEST_CHANGED');
const r4Manifest = JSON.parse(read(r4ManifestPath).toString('utf8'));
const successors = new Map([
    ['src/whatsapp/sendText.js',
        '81fa2aef922bc0e71cdd30ad3a9d45f5c2aaac2fdbc250bebcbdbe3cd1da09fb'],
    ['src/services/servientregaEcuadorAgencyService.js',
        'f1628d2a4f25fb1abbb552b2a3d8fa86bb4a6fae99761236d9189a11faefa027']
]);
const controls = new Set(R5_CONTROL_PATHS);
const r5Manifest = readR5Manifest(root).value;
assert.deepEqual(Object.fromEntries(successors), r5Manifest.functionalFiles,
    'R5_PRECOMMIT_FUNCTIONAL_SCOPE_INVALID');
for (const entry of r4Manifest.allowlist) {
    const digest = sha256(read(entry.path));
    if (controls.has(entry.path)) {
        assert.match(digest, /^[a-f0-9]{64}$/, 'R5_CONTROL_FILE_INVALID:' + entry.path);
    } else {
        assert.equal(digest, successors.get(entry.path) || entry.canonicalSha256,
            'R5_PROTECTED_FILE_CHANGED:' + entry.path);
    }
}
for (const [relative, expected] of [
    ['tests/send-text-history-phone-scope.test.mjs',
        'c6372c5f9d76b87a90483533e78167670a3973d864b1ad42fe901996582e9c0e'],
    ['tests/servientrega-locality-scope.test.mjs',
        '4af36ae082f93aac95c87695730d7dda2db9b51ab75aae53975d065d28f4145e']
]) {
    assert.equal(sha256(read(relative)), expected, 'R5_REGRESSION_CHANGED:' + relative);
}
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = Object.freeze(
    [...new Set(r4Manifest.allowlist.map((entry) => entry.path).concat([...successors.keys()]))]
);
await import(pathToFileURL(path.join(historicalRoot,
    'scripts/lib/ec-runtime-successor-v199-context.mjs')).href);
assert.equal(globalThis.__VITALISMEN_V199_EC_BOT_CORE_HEALTH_META_CONTEXT?.loaded, true,
    'R5_HISTORICAL_V199_MISSING');
assert.equal(globalThis.__VITALISMEN_V146_CONTEXT?.loaded, true, 'R5_HISTORICAL_V146_MISSING');
await import(pathToFileURL(path.join(root,
    'src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js')).href);
globalThis.__VITALISMEN_R5_PRECOMMIT_CONTEXT = Object.freeze({
    loaded: true, parentCommit, historicalCommit, functionalFileCount: successors.size,
    inheritedProtectedFiles: r4Manifest.allowlist.length
});
