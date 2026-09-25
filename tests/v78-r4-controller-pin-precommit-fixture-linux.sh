#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ "${EUID}" -eq 0 ]] || { echo 'FIXTURE_ROOT_REQUIRED' >&2; exit 1; }
fixture_root="${V78_R4_FIXTURE_ROOT:?fixture root ausente}"
[[ "$fixture_root" =~ ^/tmp/vitalismen-r4-controller-pin\.[A-Za-z0-9]+$ ]] || {
  echo 'FIXTURE_ROOT_INVALID' >&2; exit 1;
}
patch_tar="$fixture_root/patch.tar"
[[ -f "$patch_tar" && ! -L "$patch_tar" ]] || {
  echo 'FIXTURE_PATCH_ARCHIVE_INVALID' >&2; exit 1;
}
parent_release='/opt/vitalismen-automacao/releases/20260925T184129Z_production-20260925-8246101'
v201_release='/opt/vitalismen-automacao/releases/20260924T015646Z_production-20260924-641759b'
release_name='20260925T235959Z_production-20260925-abcdef0'
release="/opt/vitalismen-automacao/releases/$release_name"
[[ "$(readlink -f /opt/vitalismen-automacao/current)" == "$v201_release" ]] || {
  echo 'FIXTURE_PRODUCTION_CURRENT_CHANGED' >&2; exit 1;
}
[[ ! -e "$release" ]] || { echo 'FIXTURE_RELEASE_ALREADY_EXISTS' >&2; exit 1; }
[[ ! -e /var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_CONTROLLER_PIN_AUTHORITY.json ]] || {
  echo 'REAL_SUCCESSOR_CHECKPOINT_PREMATURE' >&2; exit 1;
}

mkdir -p "$fixture_root/base-upper" "$fixture_root/base-work" \
  "$fixture_root/state-upper" "$fixture_root/state-work"
mount -t overlay overlay -o \
  "lowerdir=/opt/vitalismen-automacao,upperdir=$fixture_root/base-upper,workdir=$fixture_root/base-work" \
  /opt/vitalismen-automacao
mount -t overlay overlay -o \
  "lowerdir=/var/lib/vitalismen-deploy,upperdir=$fixture_root/state-upper,workdir=$fixture_root/state-work" \
  /var/lib/vitalismen-deploy

cp -a --reflink=auto "$parent_release" "$release"
tar -xf "$patch_tar" -C "$release"
chmod 0755 "$release/ops/vitalismen-stage" "$release/ops/ec-bot-core-v78-successor-r4"
[[ ! -e "$release/.git" ]] || { echo 'FIXTURE_RUNTIME_GIT_PRESENT' >&2; exit 1; }

node --input-type=module - "$release" "$release_name" "$v201_release" <<'NODE'
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [root, releaseName, historical] = process.argv.slice(2);
const commit = 'abcdef0' + 'a'.repeat(33);
const tree = '1'.repeat(40);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const digest = relative => sha(fs.readFileSync(path.join(root, relative)));
const write = (file, value) => {
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o400 });
    fs.chmodSync(file, 0o400);
};
const sourceFile = path.join(root, '.release-source.json');
const source = JSON.parse(fs.readFileSync(sourceFile));
assert.equal(source.functionalCommit,
    '82461018bc7fd148732e440725cf62e299ee52e0');
source.sourceRefResolvedCommit = commit;
source.commit = commit;
source.functionalCommit = commit;
source.functionalTree = tree;
source.releaseName = releaseName;
write(sourceFile, source);
const excludedRoot = new Set(['.env', '.env.v66-safe-observation',
    '.env.v77-canary-qa', '.canary-v77-profile-attestation.json',
    '.release-source.json', '.staging-complete.json', '.release-publication.json',
    '.publication-complete.json', '.activation-complete.json',
    '.r4-operational-attestation.json']);
const payloadHash = crypto.createHash('sha256');
const visit = (directory, relative = '') => {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
        .filter(entry => !(relative === '' && excludedRoot.has(entry.name)))
        .filter(entry => entry.name !== '.git' && entry.name !== 'node_modules')
        .sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
        const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
        const child = path.join(directory, entry.name);
        const stat = fs.lstatSync(child);
        if (stat.isDirectory()) { visit(child, childRelative); continue; }
        payloadHash.update(childRelative, 'utf8');
        payloadHash.update('\0');
        if (stat.isSymbolicLink()) {
            payloadHash.update('symlink\0');
            payloadHash.update(fs.readlinkSync(child), 'utf8');
            payloadHash.update('\0');
            continue;
        }
        assert.ok(stat.isFile(), `FIXTURE_PAYLOAD_UNSAFE:${childRelative}`);
        payloadHash.update(`file:${(stat.mode & 0o111) !== 0 ? 'x' : '-'}\0`);
        payloadHash.update(fs.readFileSync(child));
        payloadHash.update('\0');
    }
};
visit(root);
const functionalPayloadSha256 = payloadHash.digest('hex');
const stagingFile = path.join(root, '.staging-complete.json');
const staging = JSON.parse(fs.readFileSync(stagingFile));
staging.releaseName = releaseName;
staging.sourceRefResolvedCommit = commit;
staging.commit = commit;
staging.functionalCommit = commit;
staging.functionalTree = tree;
staging.functionalPayloadSha256 = functionalPayloadSha256;
staging.releaseMetadataSha256 = sha(fs.readFileSync(sourceFile));
write(stagingFile, staging);
const tag = 'production-20260925-abcdef0';
const publicationFile = path.join(root, '.release-publication.json');
const publication = JSON.parse(fs.readFileSync(publicationFile));
publication.release = releaseName;
publication.functionalCommit = commit;
publication.functionalTree = tree;
publication.functionalPayloadSha256 = functionalPayloadSha256;
publication.publicationTag = tag;
publication.publicationTagResolvedCommit = commit;
publication.releaseMetadataSha256 = sha(fs.readFileSync(sourceFile));
publication.stagingCompleteSha256 = sha(fs.readFileSync(stagingFile));
write(publicationFile, publication);
const completeFile = path.join(root, '.publication-complete.json');
const complete = JSON.parse(fs.readFileSync(completeFile));
complete.release = releaseName;
complete.functionalCommit = commit;
complete.functionalTree = tree;
complete.functionalPayloadSha256 = functionalPayloadSha256;
complete.publicationTag = tag;
complete.publicationTagResolvedCommit = commit;
complete.releaseMetadataSha256 = sha(fs.readFileSync(sourceFile));
complete.stagingCompleteSha256 = sha(fs.readFileSync(stagingFile));
complete.publicationMetadataSha256 = sha(fs.readFileSync(publicationFile));
write(completeFile, complete);

const authorityFile = path.join(root,
    'scripts/lib/unified-successor-v202-r4-authority.mjs');
const authority = await import(pathToFileURL(authorityFile).href);
const parent = JSON.parse(fs.readFileSync(authority.R4_SUCCESSOR_CHECKPOINT_PATH));
assert.equal(sha(fs.readFileSync(authority.R4_SUCCESSOR_CHECKPOINT_PATH)),
    authority.R4_SUCCESSOR_CHECKPOINT_SHA256);
const manifestFile = path.join(root, authority.R4_CONTROLLER_PIN_MANIFEST_PATH);
const manifest = authority.validateR4Manifest(JSON.parse(fs.readFileSync(manifestFile)));
const checkpoint = authority.validateCheckpoint({
    checkpointId: 'CHECKPOINT_R4_V78_CONTROLLER_PIN_AUTHORITY',
    status: 'FROZEN', parentCheckpoint: parent.checkpointId,
    parentCheckpointSha256: authority.R4_SUCCESSOR_CHECKPOINT_SHA256,
    parentR4Commit: authority.R4_SUCCESSOR_COMMIT,
    parentR4Tree: authority.R4_SUCCESSOR_TREE,
    project: 'MAXLIEN EC — VITALISMEN OFICIAL',
    r4OperationalCommit: commit, r4OperationalTree: tree,
    r4OperationalManifestSha256: digest(authority.R4_CONTROLLER_PIN_MANIFEST_PATH),
    r4OperationalPreloadSha256: digest(authority.R4_PRELOAD_PATH),
    r4OperationalGuardSha256: digest(authority.R4_GUARD_PATH),
    r4OperationalRunnerSha256: digest(authority.R4_RUNNER_PATH),
    r4FreezeLockSuccessorSha256: digest(authority.R4_FREEZE_LOCK_SUCCESSOR_PATH),
    r4FinalValidatorSha256: digest(authority.R4_FINAL_VALIDATOR_PATH),
    r4AuthoritySha256: digest('scripts/lib/unified-successor-v202-r4-authority.mjs'),
    r4StageHelperSha256: digest('ops/vitalismen-stage'),
    r4WrapperSha256: digest('ops/ec-bot-core-v78-successor-r4'),
    r4ParentProtectionSha256: digest('scripts/lib/ec-bot-core-parent-protection-r4.mjs'),
    r4V78SelectorSha256: digest('src/services/ecBotCoreOperationalV78Service.js'),
    r4V78ContractSha256: digest('scripts/lib/ec-bot-core-operational-contract-v78.mjs'),
    r4Pm2ControllerSha256: digest('scripts/lib/pm2-target-env-restart-v78-r4.mjs'),
    r4RollbackExecutorSha256: digest('ops/vitalismen-rollback-v201-r4.mjs'),
    r4StageVerifierSha256: digest('scripts/verify-unified-successor-v202-r4-stage.mjs'),
    allowlistCount: 83,
    v201PublishedCommit: authority.V201_COMMIT,
    v201PublishedTree: authority.V201_TREE,
    v201ManifestSha256: authority.V201_MANIFEST_SHA256,
    shipmentsSha256: authority.SHIPMENTS_SHA256,
    v168bSha256: authority.V168B_SHA256,
    metaDatasetId: authority.META_DATASET_ID
});
authority.assertReleaseFileHashes(root, checkpoint, manifest);
write(authority.R4_CONTROLLER_PIN_CHECKPOINT_PATH, checkpoint);
const checkpointSha256 = sha(fs.readFileSync(authority.R4_CONTROLLER_PIN_CHECKPOINT_PATH));
const attestation = {
    attestationId: 'R4_OPERATIONAL_RELEASE_ATTESTATION',
    checkpointId: checkpoint.checkpointId,
    checkpointSha256,
    releaseName,
    commit,
    tree,
    manifestSha256: checkpoint.r4OperationalManifestSha256,
    preloadSha256: checkpoint.r4OperationalPreloadSha256,
    guardSha256: checkpoint.r4OperationalGuardSha256,
    runnerSha256: checkpoint.r4OperationalRunnerSha256,
    freezeLockSuccessorSha256: checkpoint.r4FreezeLockSuccessorSha256,
    finalValidatorSha256: checkpoint.r4FinalValidatorSha256,
    allowlistCount: 83,
    materializedFileHashes: manifest.allowlist.map(entry =>
        ({ path: entry.path, sha256: entry.canonicalSha256 })),
    externalEffectLocks: manifest.externalEffectLocks,
    v201ContextReleasePath: historical,
    gitValidatedBeforeRemoval: true
};
write(path.join(root, authority.R4_ATTESTATION_NAME), attestation);
assert.equal(authority.verifyMaterializedRelease(root).checkpointSha256,
    checkpointSha256);
console.log('PRECOMMIT_AUTHORITY_FIXTURE=PASS');
NODE

cd "$release"
node scripts/lib/ec-bot-core-parent-protection-r4.mjs "$release"
export NODE_OPTIONS="--import=file://$release/scripts/lib/unified-successor-v202-r4-preload.mjs"
node --input-type=module -e \
  'if(globalThis.__VITALISMEN_R4_OPERATIONAL_CONTEXT?.loaded!==true)process.exit(1);console.log("PRECOMMIT_PRELOAD=PASS")'
unset NODE_OPTIONS
export V78_R4_RELEASE_FIXTURE="$release"
export V78_R4_WRAPPER_FIXTURE="$release/ops/ec-bot-core-v78-successor-r4"
export V78_R4_PARENT_CONTRACT_FIXTURE="$release/scripts/lib/ec-bot-core-parent-protection-r4.mjs"
export V78_R4_EXPECTED_IDENTITY='R4_CONTROLLER_PIN'
node --test tests/r4-v78-control-plane-authority.test.mjs \
  tests/v201-automatic-rollback-r4.test.mjs \
  tests/v78-r4-parent-protection-negative-linux.test.mjs \
  tests/v78-r4-wrapper-full-fixture-linux.test.mjs \
  tests/repurchase-purchase-ordering-v202.test.mjs
