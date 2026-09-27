import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    R5_PARENT_COMMIT,
    R5_PARENT_TREE,
    R5_PARENT_RELEASE,
    R5_PRELOAD_PATH,
    readR5Manifest,
    verifyR5MaterializedRelease
} from './lib/unified-successor-v202-r5-authority.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (rootPath, relative) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(rootPath, relative))).digest('hex');

export async function assertR5Successor(rootPath = root) {
    const rootResolved = fs.realpathSync(rootPath);
    const manifest = readR5Manifest(rootResolved).value;
    for (const [relative, expected] of Object.entries({
        ...manifest.functionalFiles, ...manifest.regressionFiles
    })) {
        assert.equal(sha256(rootResolved, relative), expected,
            'R5_PATCH_OR_TEST_CHANGED:' + relative);
    }
    assert.equal(sha256(rootResolved, '.github/workflows/ec-panel-quality.yml'),
        manifest.inheritedWorkflowSha256, 'R5_V47_WORKFLOW_SUCCESSOR_INVALID');
    const officialRelease = path.dirname(rootResolved) ===
        '/opt/vitalismen-automacao/releases';
    if (officialRelease) {
        const verified = await verifyR5MaterializedRelease(rootResolved);
        const context = globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT;
        assert.equal(context?.loaded, true, 'R5_OPERATIONAL_CONTEXT_MISSING');
        assert.equal(context.releaseCommit, verified.checkpoint.commit,
            'R5_OPERATIONAL_COMMIT_MISMATCH');
        assert.equal(context.releaseTree, verified.checkpoint.tree,
            'R5_OPERATIONAL_TREE_MISMATCH');
        assert.equal(context.checkpointSha256, verified.checkpointSha256,
            'R5_OPERATIONAL_CHECKPOINT_MISMATCH');
        assert.equal(context.parentR4Verified, true, 'R5_PARENT_R4_NOT_VERIFIED');
        assert.equal(context.v47SuccessorVerified, true, 'R5_V47_NOT_RECONCILED');
        assert.equal(verified.manifest.parent.commit, R5_PARENT_COMMIT);
        assert.equal(verified.manifest.parent.tree, R5_PARENT_TREE);
        assert.equal(verified.manifest.policy.rollbackRelease, R5_PARENT_RELEASE);
        assert.equal(verified.checkpoint.controlHashes[R5_PRELOAD_PATH],
            sha256(rootResolved, R5_PRELOAD_PATH), 'R5_PRELOAD_CHANGED');
    } else {
        assert.equal(process.env.VITALISMEN_R5_PRECOMMIT_ONLY, 'true',
            'R5_NONPRODUCTION_FIXTURE_NOT_AUTHORIZED');
        const context = globalThis.__VITALISMEN_R5_PRECOMMIT_CONTEXT;
        assert.equal(context?.loaded, true, 'R5_PRECOMMIT_CONTEXT_MISSING');
        assert.equal(context.parentCommit, R5_PARENT_COMMIT);
        assert.equal(context.functionalFileCount, 2);
        assert.equal(context.inheritedProtectedFiles, 83);
    }
    console.log('R5_SUCCESSOR_CONTROL=PASS');
    console.log('R5_FUNCTIONAL_FILES=2/2_PINNED');
    console.log('R5_V47_WORKFLOW_SUCCESSOR=PASS');
    return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await assertR5Successor();
}
