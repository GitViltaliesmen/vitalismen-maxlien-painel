import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { requireSealedRelease } from '/usr/local/lib/vitalismen-deploy/ec-order-v254-validation-sealed-v256-r1.mjs';

const state = '/var/lib/vitalismen-deploy/post-sale-v263';
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
assert.equal(requireSealedRelease(parent).authority.SUCCESSOR_COMMIT, authority.parentCommit,
    'V263_PARENT_RELEASE_INVALID');
assert.equal(sha(regular(path.join(state, 'overlay.env'))), authority.overlaySha256, 'V263_OVERLAY_SEAL');
assert.equal(sha(regular('/usr/local/lib/vitalismen-deploy/post-sale-v263-preload.mjs')),
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
