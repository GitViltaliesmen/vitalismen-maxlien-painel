import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    R4_ATTESTATION_NAME, R4_MANIFEST_PATH, readAuthorizedCheckpoint,
    readCanonicalJson, validateR4Manifest, assertReleaseFileHashes,
    validateV201ContextRoot, verifyMaterializedRelease, classifyReleasePreload, sha256
} from './lib/unified-successor-v202-r4-authority.mjs';

const git = (root, ...args) => execFileSync('/usr/bin/git', args, {
    cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' }
}).trim();
const gitBytes = (root, ...args) => execFileSync('/usr/bin/git', args, {
    cwd: root, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' }
});
const gitBlobOid = bytes => crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
const releasesRoot = '/opt/vitalismen-automacao/releases';
function findV201ContextRoot() {
    const matches = [];
    for (const entry of fs.readdirSync(releasesRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
        const candidate = path.join(releasesRoot, entry.name);
        try { matches.push(validateV201ContextRoot(candidate)); } catch { /* not V201 */ }
    }
    assert.equal(matches.length, 1, 'R4_V201_CONTEXT_NOT_UNIQUE');
    return matches[0];
}
const getInputs = () => {
    assert.equal(process.argv.length, 4, 'R4_STAGE_EXACT_ARGS_REQUIRED');
    const [action, releaseRoot] = process.argv.slice(2);
    assert.ok(['select', 'attest', 'verify'].includes(action), 'R4_STAGE_ACTION_INVALID');
    const root = fs.realpathSync(releaseRoot);
    assert.ok(root.startsWith('/opt/vitalismen-automacao/releases/'),
        'R4_STAGE_RELEASE_PATH_INVALID');
    return { action, root };
};
export function assertGitReleaseIdentity(root, checkpoint, manifest) {
    assert.equal(git(root, 'rev-parse', 'HEAD'), checkpoint.r4OperationalCommit,
        'R4_GIT_COMMIT_INVALID');
    assert.equal(git(root, 'rev-parse', 'HEAD^{tree}'), checkpoint.r4OperationalTree,
        'R4_GIT_TREE_INVALID');
    assert.equal(git(root, 'status', '--porcelain=v1', '--untracked-files=no'), '',
        'R4_GIT_TRACKED_DIFF');
    let count = 0;
    for (const entry of manifest.allowlist) {
        const oid = git(root, 'rev-parse', `HEAD:${entry.path}`);
        assert.equal(oid, entry.gitBlobOid, `R4_GIT_BLOB_OID_INVALID:${entry.path}`);
        const blob = gitBytes(root, 'cat-file', 'blob', oid);
        assert.equal(gitBlobOid(blob), oid, `R4_GIT_OBJECT_INVALID:${entry.path}`);
        assert.equal(sha256(blob), entry.canonicalSha256,
            `R4_GIT_BLOB_SHA_INVALID:${entry.path}`);
        assert.equal(sha256(fs.readFileSync(path.join(root, entry.path))),
            entry.canonicalSha256, `R4_MATERIALIZED_FILE_INVALID:${entry.path}`);
        count += 1;
    }
    assert.equal(count, 83);
    return true;
}
function attest(root) {
    const checkpoint = readAuthorizedCheckpoint();
    const manifest = validateR4Manifest(
        readCanonicalJson(path.join(root, R4_MANIFEST_PATH)).value);
    assertReleaseFileHashes(root, checkpoint.value, manifest);
    assertGitReleaseIdentity(root, checkpoint.value, manifest);
    const historical = findV201ContextRoot();
    const source = readCanonicalJson(path.join(root, '.release-source.json')).value;
    assert.equal(source.functionalCommit, checkpoint.value.r4OperationalCommit,
        'R4_STAGE_SOURCE_COMMIT_INVALID');
    assert.equal(source.functionalTree, checkpoint.value.r4OperationalTree,
        'R4_STAGE_SOURCE_TREE_INVALID');
    assert.equal(source.releaseName, path.basename(root), 'R4_STAGE_SOURCE_RELEASE_INVALID');
    const attestation = {
        attestationId: 'R4_OPERATIONAL_RELEASE_ATTESTATION',
        checkpointId: checkpoint.value.checkpointId,
        checkpointSha256: checkpoint.sha256,
        releaseName: source.releaseName,
        commit: checkpoint.value.r4OperationalCommit,
        tree: checkpoint.value.r4OperationalTree,
        manifestSha256: checkpoint.value.r4OperationalManifestSha256,
        preloadSha256: checkpoint.value.r4OperationalPreloadSha256,
        guardSha256: checkpoint.value.r4OperationalGuardSha256,
        runnerSha256: checkpoint.value.r4OperationalRunnerSha256,
        freezeLockSuccessorSha256: checkpoint.value.r4FreezeLockSuccessorSha256,
        finalValidatorSha256: checkpoint.value.r4FinalValidatorSha256,
        allowlistCount: 83,
        materializedFileHashes: manifest.allowlist.map(entry =>
            ({ path: entry.path, sha256: entry.canonicalSha256 })),
        externalEffectLocks: manifest.externalEffectLocks,
        v201ContextReleasePath: historical,
        gitValidatedBeforeRemoval: true
    };
    const target = path.join(root, R4_ATTESTATION_NAME);
    assert.ok(!fs.existsSync(target), 'R4_STAGE_ATTESTATION_ALREADY_EXISTS');
    const temporary = path.join(root, `.${R4_ATTESTATION_NAME}.${process.pid}.tmp`);
    const file = fs.openSync(temporary, 'wx', 0o400);
    try {
        fs.writeFileSync(file, `${JSON.stringify(attestation, null, 2)}\n`);
        fs.fsyncSync(file);
    } finally {
        fs.closeSync(file);
    }
    fs.renameSync(temporary, target);
    fs.chmodSync(target, 0o400);
    process.stdout.write('R4_GIT_OBJECTS=83/83_PASS\nR4_STAGE_ATTESTATION=PASS\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { action, root } = getInputs();
    if (action === 'select') {
        process.stdout.write(`${classifyReleasePreload(root, { requireAttestation: false })}\n`);
    } else if (action === 'attest') attest(root);
    else {
        verifyMaterializedRelease(root);
        process.stdout.write('R4_RELEASE_ATTESTATION=PASS\nR4_GIT_RUNTIME_DEPENDENCY=NO\n');
    }
}
