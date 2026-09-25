import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BOT_REPLY_PARENT_COMMIT = 'fe32da042617335d11b9fcde2e5dc0d4519c9915';
export const BOT_REPLY_PARENT_TREE = 'fe3c34e7a47d3e291c1d4c349e493ebbc93c9b6c';
export const BOT_REPLY_PARENT_RELEASE =
    '/opt/vitalismen-automacao/releases/20260925T195542Z_production-20260925-fe32da0';
export const BOT_REPLY_FREEZE_COMMIT = '1f33d541fb3ad0efcc01b37e9d25d43433a527eb';
export const BOT_REPLY_FREEZE_FILE_SHA256 =
    '975a38ad4b8490e7bda5ba7115a482ba369f33100019b058c107b2125e41ce97';
export const BOT_REPLY_RUNTIME_FILE = 'src/services/texUltraFunnelService.js';
export const BOT_REPLY_CHANGE_ALLOWLIST = Object.freeze([
    'docs/BOT_REPLY_SUCCESSOR_SCOPE_20260925.md',
    'scripts/lib/bot-replies-successor-context.mjs',
    'scripts/guard-bot-replies-successor.mjs',
    'tests/bot-replies-successor-governance.test.mjs',
    'tests/tex-ultra-reply-continuity-successor.test.mjs',
    BOT_REPLY_RUNTIME_FILE
].sort());

const AUTHORITY_PATH =
    '/var/lib/vitalismen-deploy/CHECKPOINT_R4_BOT_REPLIES_SUCCESSOR_AUTHORITY.json';
const FREEZE_PATH =
    '/var/lib/vitalismen-deploy/CHECKPOINT_EC_PROTOCOLO_G_VSL_BOT_INGRESS_FROZEN.json';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
}).trim();
const gitRaw = (root, ...args) => execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
});
const exactKeys = (value, keys) => assert.deepEqual(Object.keys(value || {}).sort(), [...keys].sort());

const oldReply = [
    "        await sendFunnelText({ state, text: 'Gracias. ¿En que ciudad de Ecuador desea recibir o retirar el pedido?', context: 'tex_ultra_ask_city' });",
    "        await saveState(state, { memory, draft, stage: 'awaiting_city' });"
].join('\n');
const newReply = [
    '        const nextStep = texUltraNextDataCollectionStep(draft);',
    '        await sendFunnelText({',
    '            state,',
    "            text: nextStep.stage === 'awaiting_confirmation' ? texUltraConfirmationText(draft) : nextStep.text,",
    '            context: nextStep.context',
    '        });',
    '        await saveState(state, { memory, draft, stage: nextStep.stage });'
].join('\n');

export function assertOnlyApprovedReplyHunk(parentSource, successorSource) {
    assert.equal(parentSource.split(oldReply).length, 2, 'BOT_REPLY_PARENT_HUNK_INVALID');
    assert.equal(successorSource, parentSource.replace(oldReply, newReply),
        'BOT_REPLY_UNAUTHORIZED_RUNTIME_DELTA');
    return true;
}

export function assertBotReplyAuthorityValue(value) {
    exactKeys(value, ['checkpointId', 'status', 'project', 'parentCommit', 'parentTree',
        'parentRelease', 'successorCommit', 'successorTree', 'freezeCommit',
        'freezeFileSha256', 'freezeCheckpointSha256', 'botReplyAllowedFiles',
        'ingressFreezeIntact', 'metaDatasetId']);
    assert.equal(value.checkpointId, 'CHECKPOINT_R4_BOT_REPLIES_SUCCESSOR_AUTHORITY');
    assert.equal(value.status, 'FROZEN');
    assert.equal(value.project, 'MAXLIEN_EC_VITALISMEN_OFICIAL');
    assert.equal(value.parentCommit, BOT_REPLY_PARENT_COMMIT);
    assert.equal(value.parentTree, BOT_REPLY_PARENT_TREE);
    assert.equal(value.parentRelease, BOT_REPLY_PARENT_RELEASE);
    assert.match(value.successorCommit, SHA1);
    assert.match(value.successorTree, SHA1);
    assert.equal(value.freezeCommit, BOT_REPLY_FREEZE_COMMIT);
    assert.equal(value.freezeFileSha256, BOT_REPLY_FREEZE_FILE_SHA256);
    assert.match(value.freezeCheckpointSha256, SHA256);
    assert.equal(value.ingressFreezeIntact, true);
    assert.equal(value.metaDatasetId, '920532663934291');
    assert.deepEqual(Object.keys(value.botReplyAllowedFiles || {}).sort(),
        BOT_REPLY_CHANGE_ALLOWLIST);
    for (const hash of Object.values(value.botReplyAllowedFiles)) assert.match(hash, SHA256);
    return true;
}

const readStrictCanonicalRootJson = file => {
    for (const directory of ['/var', '/var/lib', '/var/lib/vitalismen-deploy']) {
        const stat = fs.lstatSync(directory);
        assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === 0
            && stat.gid === 0 && (stat.mode & 0o022) === 0, 'BOT_REPLY_PARENT_DIRECTORY_UNSAFE');
    }
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 0
        && stat.gid === 0 && (stat.mode & 0o777) === 0o400, 'BOT_REPLY_CHECKPOINT_UNSAFE');
    const bytes = fs.readFileSync(file);
    const value = JSON.parse(bytes.toString('utf8'));
    assert.equal(bytes.toString('utf8'), `${JSON.stringify(value, null, 2)}\n`,
        'BOT_REPLY_CHECKPOINT_NOT_CANONICAL');
    return { value, hash: sha256(bytes) };
};

export function verifyBotReplySuccessor(root = ROOT) {
    assert.equal(process.platform, 'linux', 'BOT_REPLY_FIXTURE_REQUIRES_LINUX');
    assert.equal(fs.realpathSync(root), fs.realpathSync(process.cwd()),
        'BOT_REPLY_FIXTURE_CWD_INVALID');
    assert.notEqual(fs.realpathSync(root), fs.realpathSync('/opt/vitalismen-automacao/current'),
        'BOT_REPLY_CURRENT_NOT_A_FIXTURE');
    const freeze = readStrictCanonicalRootJson(FREEZE_PATH);
    assert.equal(freeze.value.freezeCommit, BOT_REPLY_FREEZE_COMMIT);
    assert.equal(freeze.value.freezeFileSha256, BOT_REPLY_FREEZE_FILE_SHA256);
    assert.equal(freeze.value.activeVsl, 'https://vilaliemen.shop/protocolo-g');
    assert.equal(freeze.value.activeFunnel, 'PROTOCOLO_G');
    assert.equal(freeze.value.activeProduct, 'tex_ultra_ec');
    assert.equal(freeze.value.functionalFilesChanged, 0);

    const authority = readStrictCanonicalRootJson(AUTHORITY_PATH);
    assertBotReplyAuthorityValue(authority.value);
    assert.equal(authority.value.freezeCheckpointSha256, freeze.hash,
        'BOT_REPLY_FREEZE_CHECKPOINT_CHANGED');
    const activeRelease = fs.realpathSync('/opt/vitalismen-automacao/current');
    assert.equal(activeRelease, BOT_REPLY_PARENT_RELEASE, 'BOT_REPLY_PARENT_RELEASE_CHANGED');
    const parentAttestation = readStrictCanonicalRootJson(
        path.join(activeRelease, '.r4-operational-attestation.json'));
    assert.equal(parentAttestation.value.commit, BOT_REPLY_PARENT_COMMIT,
        'BOT_REPLY_PARENT_ATTESTATION_COMMIT_INVALID');
    assert.equal(parentAttestation.value.tree, BOT_REPLY_PARENT_TREE,
        'BOT_REPLY_PARENT_ATTESTATION_TREE_INVALID');

    assert.equal(git(root, 'rev-parse', 'HEAD'), authority.value.successorCommit,
        'BOT_REPLY_SUCCESSOR_COMMIT_MISMATCH');
    assert.equal(git(root, 'show', '-s', '--format=%T', 'HEAD'),
        authority.value.successorTree, 'BOT_REPLY_SUCCESSOR_TREE_MISMATCH');
    assert.equal(git(root, 'show', '-s', '--format=%P', 'HEAD'),
        BOT_REPLY_PARENT_COMMIT, 'BOT_REPLY_SUCCESSOR_PARENT_INVALID');
    assert.equal(git(root, 'show', '-s', '--format=%T', BOT_REPLY_PARENT_COMMIT),
        BOT_REPLY_PARENT_TREE, 'BOT_REPLY_PARENT_TREE_MISMATCH');
    assert.equal(git(root, 'status', '--porcelain'), '', 'BOT_REPLY_FIXTURE_DIRTY');
    const changed = git(root, 'diff', '--name-only', `${BOT_REPLY_PARENT_COMMIT}..HEAD`)
        .split('\n').filter(Boolean).sort();
    assert.deepEqual(changed, BOT_REPLY_CHANGE_ALLOWLIST, 'BOT_REPLY_CHANGED_PATHS_INVALID');
    for (const [relative, expected] of Object.entries(authority.value.botReplyAllowedFiles)) {
        assert.equal(sha256(fs.readFileSync(path.join(root, relative))), expected,
            `BOT_REPLY_SUCCESSOR_FILE_CHANGED:${relative}`);
    }
    const parentSource = gitRaw(root, 'show', `${BOT_REPLY_PARENT_COMMIT}:${BOT_REPLY_RUNTIME_FILE}`);
    const successorSource = fs.readFileSync(path.join(root, BOT_REPLY_RUNTIME_FILE), 'utf8');
    assertOnlyApprovedReplyHunk(parentSource, successorSource);
    return Object.freeze({ authorityHash: authority.hash, authority: authority.value });
}

export async function loadBotReplySuccessorContext(root = ROOT) {
    const verified = verifyBotReplySuccessor(root);
    const parentPreload = pathToFileURL(path.join(BOT_REPLY_PARENT_RELEASE,
        'scripts/lib/unified-successor-v202-r4-preload.mjs')).href;
    const { runOperationalR4Import } = await import(parentPreload);
    const parent = await runOperationalR4Import();
    assert.equal(parent.releaseCommit, BOT_REPLY_PARENT_COMMIT);
    assert.equal(parent.releaseTree, BOT_REPLY_PARENT_TREE);
    assert.ok((globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [])
        .includes(BOT_REPLY_RUNTIME_FILE), 'BOT_REPLY_PARENT_OVERRIDE_MISSING');
    globalThis.__VITALISMEN_BOT_REPLIES_SUCCESSOR_CONTEXT = Object.freeze({
        loaded: true,
        parentCommit: BOT_REPLY_PARENT_COMMIT,
        successorCommit: verified.authority.successorCommit,
        successorTree: verified.authority.successorTree,
        authoritySha256: verified.authorityHash,
        ingressFreezeIntact: true
    });
    return globalThis.__VITALISMEN_BOT_REPLIES_SUCCESSOR_CONTEXT;
}

const requestedAsPreload = [...process.execArgv, ...String(process.env.NODE_OPTIONS || '')
    .split(/\s+/).filter(Boolean)].some((argument, index, all) => {
    const specifier = argument.startsWith('--import=') ? argument.slice(9)
        : argument === '--import' ? all[index + 1] : '';
    return specifier && specifier === pathToFileURL(fileURLToPath(import.meta.url)).href;
});
if (requestedAsPreload) await loadBotReplySuccessorContext();
