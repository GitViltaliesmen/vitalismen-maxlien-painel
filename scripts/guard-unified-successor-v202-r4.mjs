import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST_PATH = 'docs/freeze/unified-successor-v202-r4-v78-controller-pin-20260925.json';
export const PRELOAD_PATH = 'scripts/lib/unified-successor-v202-r4-preload.mjs';
export const MANIFEST_SHA256 = '5db4769b20956ae9aba52293e1699b8fdbf4999aaa9ed8f62d74a8e9c7c9c349';
export const PRELOAD_SHA256 = '994408c3739587b0a53967bf4ce52deae238f4f9ce7bd3ec325919706e59a3d7';
export const LOCAL_CHECKPOINT_HEAD = '040969f90a92a8121c9e6eb723e0b0c6c9e390ae';
export const LOCAL_CHECKPOINT_TREE = '1bf75f613c6befece285e3ce9a71dc41bfffaa20';
export const BASE_HEAD = '790a5079b7cd4693127f84d933809042dfc018be';
export const BASE_TREE = '92fab5b70d2f028293661bbc2393be6c08afb740';
export const V199_HEAD = 'e4f0f3b4afa075b9fcaf421eda8689b5a3cfd8e9';
export const V199_TREE = '84f9eca9cc956de9ef5d8aa90bb7b6a456927173';
export const SHA = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blobOid = bytes => crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const gitBytes = (root, ...args) => execFileSync('git', args, { cwd: root });

export function assertBaseIdentity({ baseHead, baseTree, headIsDescendant }) {
    assert.equal(baseHead, BASE_HEAD, 'R4_BASE_HEAD_CHANGED');
    assert.equal(baseTree, BASE_TREE, 'R4_BASE_TREE_CHANGED');
    assert.equal(headIsDescendant, true, 'R4_HEAD_NOT_DESCENDANT');
    return true;
}

export function assertRequiredContexts({ v199, v146 }) {
    assert.equal(v199, true, 'R4_V199_CONTEXT_MISSING');
    assert.equal(v146, true, 'R4_V146_CONTEXT_MISSING');
    return true;
}

export function assertUnifiedManifest(bytes, preloadBytes, expectedManifestSha = MANIFEST_SHA256,
    expectedPreloadSha = PRELOAD_SHA256) {
    assert.equal(SHA(bytes), expectedManifestSha, 'R4_MANIFEST_TAMPERED');
    assert.equal(SHA(preloadBytes), expectedPreloadSha, 'R4_PRELOAD_TAMPERED');
    const text = bytes.toString('utf8');
    const manifest = JSON.parse(text);
    const controllerPin = manifest.successorId ===
        'MAXLIEN_EC_V47_V77H2_UNIFIED_SUCCESSOR_V202_R4_V78_CONTROLLER_PIN_20260925';
    assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`, 'R4_MANIFEST_NOT_CANONICAL');
    assert.ok(controllerPin || manifest.successorId ===
        'MAXLIEN_EC_V47_V77H2_UNIFIED_SUCCESSOR_V202_R4_V78_CONTROL_PLANE_20260925');
    assert.equal(manifest.version, 'V202-R4');
    assert.equal(manifest.operationalRevision, controllerPin
        ? 'R4_V78_CONTROLLER_PIN_SUCCESSOR'
        : 'R4_V78_CONTROL_PLANE_AUTHORITY_SUCCESSOR');
    assert.equal(manifest.parentControlPlaneCommit,
        controllerPin ? '82461018bc7fd148732e440725cf62e299ee52e0'
            : 'da2983faac199b7bc9fe11c4ba47539b5baa6674');
    assert.equal(manifest.parentControlPlaneTree,
        controllerPin ? 'b665b1f4c37a1a3609d2947ec38ef74a5555bd18'
            : '6a20e48807cae3f1c2b4cd6b18e7e46df76a0a59');
    assert.equal(manifest.parentAuthoritySha256,
        controllerPin ? '77e100d51a78d070d7f6f2a2d25e5d7f29644fce50aaf37465b797088b35492e'
            : '8ba9fd21befdb6a73698d726aea7e340dce0dc93cbb4f0ff91d3b3c507f5be6d');
    assert.equal(manifest.parentManifestSha256,
        controllerPin ? '868cd7170995d35fdb26820709ba101d79c7e43d66b4eeb3f5fb77c03fce93af'
            : '9acfab5aebf315ffc3451074d225a7f95a8f2789cac86eae6cbb2075249154a0');
    assert.equal(manifest.baseHead, BASE_HEAD, 'R4_BASE_HEAD_INVALID');
    assert.equal(manifest.baseTree, BASE_TREE, 'R4_BASE_TREE_INVALID');
    assert.equal(manifest.functionalCommit, 'd333c9b3bdeb57644ce78b7f0575301fd9a102dd');
    assert.equal(manifest.policyCommit, BASE_HEAD);
    assert.equal(manifest.historicalV199.head, V199_HEAD);
    assert.equal(manifest.historicalV199.tree, V199_TREE);
    assert.equal(manifest.historicalV199.preload, 'scripts/lib/ec-runtime-successor-v199-context.mjs');
    assert.equal(manifest.currentEntrypoint,
        'src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js');
    assert.deepEqual(manifest.ancestralChain,
        [...Array.from({ length: 31 }, (_, i) => `V${i + 47}`), 'V77H', 'V77H2']);
    assert.deepEqual(manifest.requiredContexts, ['V199', 'V146']);
    assert.equal(manifest.allowlistCount, 83);
    assert.equal(manifest.allowlist.length, 83);
    assert.equal(new Set(manifest.allowlist.map(item => item.path)).size, 83, 'R4_ALLOWLIST_DUPLICATE');
    assert.equal(manifest.allowlist.filter(item => item.authority === 'OPERATOR_DECISION').length, 2);
    assert.equal(manifest.allowlist.filter(item => item.authority === 'FREEZE_SUCCESSOR_EVIDENCE').length, 81);
    const stage = manifest.allowlist.find(item => item.path === 'ops/vitalismen-stage');
    assert.equal(stage?.canonicalSha256,
        controllerPin ? 'c0307f56acc20aedf790d97ba64203830b1a647d74380c78ec9d57487f4b8804'
            : '8786027df77ac1988a450c72f06b2c202b5de0fd68e2100766ddfc706e6e9e8d');
    assert.equal(stage?.evidence, controllerPin
        ? 'CHECKPOINT_R4_V78_CONTROLLER_PIN_AUTHORITY'
        : 'CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY');
    assert.equal(manifest.policy.failClosed, true);
    assert.equal(manifest.policy.canonicalBlobSource, 'GIT_OBJECT_DATABASE');
    assert.equal(manifest.policy.historicalGuardsUnchanged, true);
    assert.equal(manifest.policy.noPermanentGlobalOverride, false);
    assert.equal(manifest.policy.testFixtureRestoresContext, true);
    assert.equal(manifest.policy.operationalImportKeepsValidatedContext, true);
    assert.equal(manifest.policy.runtimeGitDependency, false);
    assert.deepEqual(manifest.externalEffectLocks, {
        dropiRealBlocked: true, purchaseRealBlocked: true, productionMutationBlocked: true
    });
    return manifest;
}

export function assertCanonicalEntry(entry, oid, blob, worktree) {
    assert.match(entry.path, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.\-/]+$/);
    assert.match(entry.gitBlobOid, /^[a-f0-9]{40}$/);
    assert.match(entry.canonicalSha256, /^[a-f0-9]{64}$/);
    assert.ok(Buffer.isBuffer(blob), `R4_BLOB_MISSING:${entry.path}`);
    assert.ok(Buffer.isBuffer(worktree), `R4_WORKTREE_MISSING:${entry.path}`);
    assert.equal(oid, entry.gitBlobOid, `R4_BLOB_OID_CHANGED:${entry.path}`);
    assert.equal(blobOid(blob), entry.gitBlobOid, `R4_GIT_OBJECT_INVALID:${entry.path}`);
    assert.equal(SHA(blob), entry.canonicalSha256, `R4_BLOB_SHA_CHANGED:${entry.path}`);
    const source = worktree.toString('utf8');
    assert.deepEqual(Buffer.from(source, 'utf8'), worktree, `R4_WORKTREE_NOT_UTF8:${entry.path}`);
    assert.ok(!/\r(?!\n)/.test(source), `R4_BARE_CR:${entry.path}`);
    assert.deepEqual(Buffer.from(source.replace(/\r\n/g, '\n'), 'utf8'),
        Buffer.from(blob.toString('utf8').replace(/\r\n/g, '\n'), 'utf8'),
        `R4_SEMANTIC_DIFF:${entry.path}`);
    return true;
}

export function assertExternalLocks(locks, env = {}, { allowBotOperational = false } = {}) {
    assert.deepEqual(locks, {
        dropiRealBlocked: true, purchaseRealBlocked: true, productionMutationBlocked: true
    }, 'R4_EFFECT_LOCKS_INVALID');
    const keys = ['DROPPI_EC_ACTIVE_SYNC_ENABLED', 'VITALISMEN_META_PURCHASE_ENABLED'];
    if (!allowBotOperational) keys.push('VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED');
    for (const key of keys) {
        assert.notEqual(String(env[key] ?? '').toLowerCase(), 'true', `R4_EXTERNAL_EFFECT_ENABLED:${key}`);
    }
    if (allowBotOperational) {
        assert.equal(String(env.DROPPI_EC_ACTIVE_SYNC_MODE ?? 'REPORT_ONLY').toUpperCase(),
            'REPORT_ONLY', 'R4_DROPI_MODE_NOT_REPORT_ONLY');
    }
    return true;
}

export function assertRestored(before, after) {
    assert.deepEqual(after, before, 'R4_CONTEXT_LEAK');
    return true;
}

export function assertSpecialIdentities(manifest) {
    const official = manifest.allowlist.find(item => item.path === 'scripts/assert-official-root.mjs');
    assert.equal(official?.canonicalSha256,
        'bac94d9d80009b0a251cc6bdf3d024040c47ec4f2cc92e84faaa865887c3fb57',
        'R4_OFFICIAL_ROOT_UNAUTHORIZED');
    assert.equal(official?.authority, 'OPERATOR_DECISION');
    const shipments = manifest.allowlist.find(item => item.path === 'src/routes/shipments.js');
    assert.equal(shipments?.canonicalSha256,
        'c083862ea7123d854fd7260375632d1f4535451b26a53f1e9edf38d7b6ab0ef8',
        'R4_SHIPMENTS_UNAUTHORIZED');
    return true;
}

export function assertUnifiedSuccessor({
    root = ROOT,
    historicalRoot,
    contractRoot = ROOT,
    manifestBytes = fs.readFileSync(path.join(contractRoot, MANIFEST_PATH)),
    preloadBytes = fs.readFileSync(path.join(contractRoot, PRELOAD_PATH)),
    env = process.env
} = {}) {
    assert.ok(historicalRoot && path.isAbsolute(historicalRoot), 'R4_HISTORICAL_ROOT_REQUIRED');
    const manifest = assertUnifiedManifest(manifestBytes, preloadBytes);
    assert.equal(git(root, 'cat-file', '-t', BASE_HEAD), 'commit', 'R4_BASE_COMMIT_MISSING');
    const head = git(root, 'rev-parse', 'HEAD');
    assertBaseIdentity({ baseHead: BASE_HEAD,
        baseTree: git(root, 'rev-parse', `${BASE_HEAD}^{tree}`),
        headIsDescendant: git(root, 'merge-base', BASE_HEAD, head) === BASE_HEAD });
    assert.equal(git(root, 'rev-parse', `${LOCAL_CHECKPOINT_HEAD}^{tree}`),
        LOCAL_CHECKPOINT_TREE, 'R4_LOCAL_CHECKPOINT_TREE_CHANGED');
    assert.equal(git(root, 'merge-base', LOCAL_CHECKPOINT_HEAD, head),
        LOCAL_CHECKPOINT_HEAD, 'R4_LOCAL_CHECKPOINT_NOT_ANCESTOR');
    assert.equal(git(historicalRoot, 'rev-parse', 'HEAD'), V199_HEAD, 'R4_V199_HEAD_CHANGED');
    assert.equal(git(historicalRoot, 'rev-parse', 'HEAD^{tree}'), V199_TREE, 'R4_V199_TREE_CHANGED');
    assert.equal(git(root, 'status', '--porcelain', '--untracked-files=no'), '',
        'R4_CURRENT_FIXTURE_TRACKED_DIFF');
    assert.equal(git(historicalRoot, 'status', '--porcelain', '--untracked-files=no'), '',
        'R4_HISTORICAL_FIXTURE_TRACKED_DIFF');
    assert.ok(fs.existsSync(path.join(historicalRoot, manifest.historicalV199.preload)),
        'R4_V199_MISSING');
    assert.ok(fs.existsSync(path.join(historicalRoot,
        'scripts/lib/ec-runtime-successor-v146-context.mjs')), 'R4_V146_MISSING');
    assertExternalLocks(manifest.externalEffectLocks, env);
    for (const entry of manifest.allowlist) {
        const oid = git(root, 'rev-parse', `HEAD:${entry.path}`);
        assertCanonicalEntry(entry, oid, gitBytes(root, 'cat-file', 'blob', oid),
            fs.readFileSync(path.join(root, entry.path)));
    }
    assertSpecialIdentities(manifest);
    return Object.freeze({ manifest, head, baseHead: BASE_HEAD, baseTree: BASE_TREE,
        canonicalIdentities: 83, historicalRoot, currentRoot: root });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const historicalRoot = process.argv[2];
    assertUnifiedSuccessor({ historicalRoot });
    console.log('SENIOR_SUCCESSOR_GUARD=PASS');
}
