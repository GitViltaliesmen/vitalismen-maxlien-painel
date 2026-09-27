import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    readCanonicalJson,
    sha256,
    verifyR5MaterializedRelease
} from './lib/unified-successor-v202-r5-authority.mjs';
import {
    assertR4FinalStagingContract
} from './guard-final-release-validator-successor-v202-r4.mjs';
import { assertR5FreezeLock } from './guard-freeze-lock-successor-v202-r5.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRootFile = (release, relative, mode) => {
    const file = path.join(release, relative);
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink()
        && stat.uid === 0 && stat.gid === 0 && (stat.mode & 0o777) === mode,
    'R5_FINAL_FILE_UNSAFE:' + relative);
    return fs.readFileSync(file);
};

export async function assertR5FinalRelease(rootPath = root) {
    const verified = await verifyR5MaterializedRelease(rootPath);
    const context = globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT;
    assert.equal(context?.loaded, true, 'R5_FINAL_CONTEXT_MISSING');
    assert.equal(context.releaseCommit, verified.checkpoint.commit, 'R5_FINAL_COMMIT');
    assert.equal(context.releaseTree, verified.checkpoint.tree, 'R5_FINAL_TREE');
    assert.equal(context.checkpointSha256, verified.checkpointSha256,
        'R5_FINAL_CHECKPOINT');
    const release = verified.root;
    const sourceBytes = readRootFile(release, '.release-source.json', 0o400);
    const stagingBytes = readRootFile(release, '.staging-complete.json', 0o400);
    const overlayBytes = readRootFile(release, '.env.v66-safe-observation', 0o400);
    const envBytes = readRootFile(release, '.env', 0o600);
    const modules = fs.lstatSync(path.join(release, 'node_modules'));
    assert.ok(modules.isDirectory() && !modules.isSymbolicLink(),
        'R5_FINAL_NODE_MODULES_INVALID');
    const source = readCanonicalJson(path.join(release, '.release-source.json')).value;
    const staging = readCanonicalJson(path.join(release, '.staging-complete.json')).value;
    assertR4FinalStagingContract({
        source, staging,
        checkpoint: {
            r4OperationalCommit: verified.checkpoint.commit,
            r4OperationalTree: verified.checkpoint.tree
        },
        releaseName: path.basename(release),
        sourceSha256: sha256(sourceBytes),
        overlaySha256: sha256(overlayBytes),
        baseEnvSha256: sha256(envBytes)
    });
    assert.ok(sourceBytes.length > 0 && stagingBytes.length > 0);
    await assertR5FreezeLock();
    console.log('FINAL_RELEASE_VALIDATOR_R5=PASS');
    return Object.freeze({ verified, staging });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await assertR5FinalRelease();
}
