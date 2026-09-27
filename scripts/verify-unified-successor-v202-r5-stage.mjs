import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    R5_ATTESTATION_NAME,
    R5_PARENT_COMMIT,
    R5_PARENT_TREE,
    R5_PARENT_RELEASE,
    assertR5GitCandidate,
    classifyR5ReleasePreload,
    readCanonicalJson,
    readR5Manifest,
    readRootR5Checkpoint,
    sha256,
    verifyR5MaterializedRelease
} from './lib/unified-successor-v202-r5-authority.mjs';
import { verifyMaterializedRelease } from './lib/unified-successor-v202-r4-authority.mjs';

const self = fileURLToPath(import.meta.url);
const officialReleases = '/opt/vitalismen-automacao/releases';
const inputs = () => {
    assert.equal(process.argv.length, 4, 'R5_STAGE_EXACT_ARGS_REQUIRED');
    const [action, releaseRoot] = process.argv.slice(2);
    assert.ok(['select', 'attest', 'verify'].includes(action), 'R5_STAGE_ACTION_INVALID');
    const root = fs.realpathSync(releaseRoot);
    assert.equal(path.dirname(root), officialReleases, 'R5_STAGE_RELEASE_PATH_INVALID');
    return { action, root };
};
export function attestR5(root) {
    const manifest = readR5Manifest(root);
    const checkpoint = readRootR5Checkpoint(root);
    assertR5GitCandidate(root, checkpoint.value, manifest.value);
    const source = readCanonicalJson(path.join(root, '.release-source.json')).value;
    assert.equal(source.releaseName, path.basename(root), 'R5_STAGE_SOURCE_RELEASE');
    assert.equal(source.functionalCommit, checkpoint.value.commit, 'R5_STAGE_SOURCE_COMMIT');
    assert.equal(source.functionalTree, checkpoint.value.tree, 'R5_STAGE_SOURCE_TREE');
    const parent = verifyMaterializedRelease(path.join(officialReleases, R5_PARENT_RELEASE));
    assert.equal(parent.attestation.commit, R5_PARENT_COMMIT, 'R5_STAGE_PARENT_COMMIT');
    assert.equal(parent.attestation.tree, R5_PARENT_TREE, 'R5_STAGE_PARENT_TREE');
    const attestation = {
        attestationId: 'R5_OPERATIONAL_RELEASE_ATTESTATION',
        checkpointId: checkpoint.value.checkpointId,
        checkpointSha256: checkpoint.sha256,
        releaseName: source.releaseName,
        commit: checkpoint.value.commit,
        tree: checkpoint.value.tree,
        manifestSha256: manifest.sha256,
        changedFileHashes: Object.fromEntries(manifest.value.allowedDeltaPaths.map((relative) => {
            const file = path.join(root, relative);
            const stat = fs.lstatSync(file);
            assert.ok(stat.isFile() && !stat.isSymbolicLink(),
                'R5_STAGE_FILE_UNSAFE:' + relative);
            return [relative, sha256(fs.readFileSync(file))];
        })),
        parentRelease: R5_PARENT_RELEASE,
        gitValidatedBeforeRemoval: true
    };
    const target = path.join(root, R5_ATTESTATION_NAME);
    assert.equal(fs.existsSync(target), false, 'R5_STAGE_ATTESTATION_EXISTS');
    const temporary = path.join(root, '.' + R5_ATTESTATION_NAME + '.' + process.pid + '.tmp');
    const file = fs.openSync(temporary, 'wx', 0o400);
    try {
        fs.writeFileSync(file, JSON.stringify(attestation, null, 2) + '\n');
        fs.fsyncSync(file);
    } finally {
        fs.closeSync(file);
    }
    fs.renameSync(temporary, target);
    fs.chmodSync(target, 0o400);
    process.stdout.write('R5_GIT_IDENTITY=PASS\nR5_STAGE_ATTESTATION=PASS\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
    const { action, root } = inputs();
    if (action === 'select') {
        process.stdout.write((await classifyR5ReleasePreload(root,
            { requireAttestation: false })) + '\n');
    } else if (action === 'attest') {
        attestR5(root);
    } else {
        await verifyR5MaterializedRelease(root);
        process.stdout.write('R5_RELEASE_ATTESTATION=PASS\nR5_GIT_RUNTIME_DEPENDENCY=NO\n');
    }
}
