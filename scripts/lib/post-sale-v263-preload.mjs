import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const state = '/var/lib/vitalismen-deploy/post-sale-v263-r2';
const authorityPath = path.join(state, 'authority.json');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const regular = file => {
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 0 && stat.gid === 0
        && stat.nlink === 1 && (stat.mode & 0o777) === 0o400, 'V263_ROOT_FILE_INVALID');
    return fs.readFileSync(file);
};
const authorityBytes = regular(authorityPath);
assert.equal(sha(authorityBytes), regular(`${authorityPath}.sha256`).toString().trim(), 'V263_AUTHORITY_SEAL');
const authority = JSON.parse(authorityBytes);
assert.equal(authorityBytes.toString(), `${JSON.stringify(authority, null, 2)}\n`, 'V263_AUTHORITY_CANONICAL');
assert.equal(authority.purpose, 'EC_POST_SALE_V263_LIMITED');
assert.equal(authority.allowedStages, 'guide,in_transit,ready_for_pickup');
const release = fs.realpathSync(authority.release);
const parent = fs.realpathSync(authority.parentRelease);
assert.equal(release, authority.release);
assert.equal(parent, authority.parentRelease);
assert.equal(fs.realpathSync('/opt/vitalismen-automacao/current'), parent, 'V263_BOT_RELEASE_CHANGED');
assert.equal(process.argv[1], `${release}/scripts/post-sale-full-v188.mjs`, 'V263_SCRIPT_INVALID');
assert.ok(['snapshot', 'dry-run', 'run'].includes(process.argv[2]), 'V263_ACTION_INVALID');
assert.equal(process.env.POST_SALE_V263_ALLOWED_STAGES, authority.allowedStages, 'V263_PROFILE_INVALID');
assert.equal(sha(regular('/var/lib/vitalismen-deploy/sealed-successors-v1/' + authority.parentCommit + '.json')),
    authority.parentSeal, 'V263_PARENT_SEAL');
const parentApproval = JSON.parse(regular('/var/lib/vitalismen-deploy/ec-order-v254-validation-v256-r1/approval.json'));
const parentActivation = JSON.parse(regular('/var/lib/vitalismen-deploy/ec-order-v254-validation-v256-r1/activation.json'));
const parentSource = JSON.parse(fs.readFileSync(path.join(parent, '.release-source.json')));
assert.equal(parentApproval.commit, authority.parentCommit, 'V263_PARENT_APPROVAL_INVALID');
assert.equal(parentApproval.release, parent, 'V263_PARENT_APPROVAL_RELEASE_INVALID');
assert.equal(parentActivation.state, 'ACTIVE', 'V263_PARENT_INACTIVE');
assert.equal(parentActivation.runtimeAllowed, true, 'V263_PARENT_RUNTIME_DISABLED');
assert.equal(parentActivation.approvalSha256,
    sha(regular('/var/lib/vitalismen-deploy/ec-order-v254-validation-v256-r1/approval.json')),
    'V263_PARENT_ACTIVATION_INVALID');
assert.equal(parentSource.functionalCommit, authority.parentCommit, 'V263_PARENT_SOURCE_INVALID');
assert.equal(sha(regular(path.join(state, 'overlay.env'))), authority.overlaySha256, 'V263_OVERLAY_SEAL');
assert.equal(sha(regular('/usr/local/lib/vitalismen-deploy/post-sale-v263-r2-preload.mjs')),
    authority.preloadSha256, 'V263_PRELOAD_SEAL');
const git = (...args) => execFileSync('git', ['-C', release, ...args], { encoding: 'utf8' }).trim();
assert.equal(git('rev-parse', 'HEAD'), authority.commit, 'V263_COMMIT_INVALID');
assert.equal(git('rev-parse', 'HEAD^{tree}'), authority.tree, 'V263_TREE_INVALID');
assert.equal(git('merge-base', authority.parentCommit, authority.commit), authority.parentCommit,
    'V263_PARENT_ANCESTRY_INVALID');
assert.deepEqual(git('diff', '--name-only', authority.parentCommit, authority.commit).split('\n').sort(),
    authority.allowedDelta, 'V263_DELTA_INVALID');
assert.equal(git('status', '--porcelain=v1'), '?? node_modules', 'V263_CHECKOUT_DIRTY');
assert.equal(fs.realpathSync(path.join(release, 'node_modules')),
    fs.realpathSync(path.join(parent, 'node_modules')), 'V263_DEPS_INVALID');

// This capability is only a read-only Dropi GET. The reader validates the
// exact order ID, account session, URL, method and response independently.
globalThis.__VITALISMEN_EC_POSTSALE_TRACKING_V210 = Object.freeze({
    isCurrent: () => {
        try {
            return fs.realpathSync('/opt/vitalismen-automacao/current') === parent
                && process.env.POST_SALE_V263_ALLOWED_STAGES === authority.allowedStages;
        } catch { return false; }
    }
});
