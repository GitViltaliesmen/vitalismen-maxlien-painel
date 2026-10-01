import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { R6_CHECKPOINT, R6_MANIFEST, R6_ALLOWED, R6_PARENT_COMMIT,
    R6_PARENT_TREE, R6_PARENT_CHECKPOINT_SHA, sha, r6File } from './lib/exutra-r6-authority.mjs';

// Provision a new public, root-owned checkpoint. Never replace the R5
// authority or persist credentials. Approval is for this exact successor.
assert.equal(process.getuid?.(), 0, 'R6_CHECKPOINT_REQUIRES_ROOT');
assert.equal(process.env.EXUTRA_R6_APPROVAL,
    'AUTORIZO_EXPANSAO_CONTROLE_COMPARTILHADO_EXCLUSIVA_PARA_CORRECAO_EXUTRA_VSL');
const [rootRaw, expectedCommit, expectedTree] = process.argv.slice(2);
assert.equal(process.argv.length, 5);
const root = fs.realpathSync(rootRaw);
const git = (...args) => execFileSync('git', ['-C', root, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
assert.match(expectedCommit, /^[a-f0-9]{40}$/); assert.match(expectedTree, /^[a-f0-9]{40}$/);
assert.equal(git('rev-parse', 'HEAD'), expectedCommit);
assert.equal(git('rev-parse', 'HEAD^{tree}'), expectedTree);
assert.equal(git('merge-base', R6_PARENT_COMMIT, expectedCommit), R6_PARENT_COMMIT);
assert.equal(git('status', '--porcelain=v1', '--untracked-files=no'), '');
assert.deepEqual(git('diff', '--name-only', R6_PARENT_COMMIT, 'HEAD').split(/\r?\n/).filter(Boolean).sort(), R6_ALLOWED);
const hashes = {};
for (const file of git('ls-files').split(/\r?\n/).filter(Boolean)) {
    const actual = fs.readFileSync(r6File(root, file));
    const committed = execFileSync('git', ['-C', root, 'show', 'HEAD:' + file], { maxBuffer: 64 * 1024 * 1024 });
    assert.deepEqual(actual, committed); hashes[file] = sha(actual);
}
assert.equal(sha(fs.readFileSync('/var/lib/vitalismen-deploy/CHECKPOINT_R5_TEX_ULTRA_LOCALITY_ANTIREPEAT_AUTHORITY.json')),
    R6_PARENT_CHECKPOINT_SHA);
const rollbackHashes = {};
for (const name of ['ec-bot-core-v78.env', 'ec-bot-core-v78-attestation.json', 'ec-bot-core-v78-permit.consumed.json']) {
    const file = '/var/lib/vitalismen-deploy/' + name;
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 0 && (stat.mode & 0o077) === 0);
    rollbackHashes[name] = sha(fs.readFileSync(file));
}
const value = { rollbackHashes, checkpointId: 'EXUTRA_R6_CAPTURE_HOLD_ONLY', commit: expectedCommit,
    tree: expectedTree, parentCommit: R6_PARENT_COMMIT, parentTree: R6_PARENT_TREE,
    parentCheckpointSha256: R6_PARENT_CHECKPOINT_SHA,
    manifestSha256: sha(fs.readFileSync(path.join(root, R6_MANIFEST))), fileHashes: hashes,
    parentPid: JSON.parse(execFileSync('/usr/bin/pm2', ['jlist'], { encoding: 'utf8' }))
        .find(x => x.name === 'vitalismen-automation' && x.pm2_env?.status === 'online')?.pid };
assert.ok(Number.isInteger(value.parentPid) && value.parentPid > 0);
fs.writeFileSync(R6_CHECKPOINT, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o400 });
console.log('R6_CHECKPOINT_CREATED=YES');
