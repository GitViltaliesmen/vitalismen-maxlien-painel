import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
    assertBotReplyAuthorityValue,
    assertOnlyApprovedReplyHunk,
    BOT_REPLY_CHANGE_ALLOWLIST,
    BOT_REPLY_FREEZE_COMMIT,
    BOT_REPLY_FREEZE_FILE_SHA256,
    BOT_REPLY_PARENT_COMMIT,
    BOT_REPLY_PARENT_RELEASE,
    BOT_REPLY_PARENT_TREE,
    BOT_REPLY_RUNTIME_FILE
} from '../scripts/lib/bot-replies-successor-context.mjs';

const root = path.resolve(import.meta.dirname, '..');
const parentSource = execFileSync('git', ['-C', root, 'show',
    `${BOT_REPLY_PARENT_COMMIT}:${BOT_REPLY_RUNTIME_FILE}`], { encoding: 'utf8' });
const successorSource = fs.readFileSync(path.join(root, BOT_REPLY_RUNTIME_FILE), 'utf8');

test('governança: delta funcional é somente a resposta após nome confirmado', () => {
    assertOnlyApprovedReplyHunk(parentSource, successorSource);
    assert.throws(() => assertOnlyApprovedReplyHunk(parentSource,
        successorSource.replace('texUltraNextDataCollectionStep(draft)', 'texUltraNextDataCollectionStep({})')),
    /BOT_REPLY_UNAUTHORIZED_RUNTIME_DELTA/);
});

test('governança: autoridade exige parent R4, freeze e allowlist exatos', () => {
    const hashes = Object.fromEntries(BOT_REPLY_CHANGE_ALLOWLIST.map(relative => [relative, 'a'.repeat(64)]));
    const authority = {
        checkpointId: 'CHECKPOINT_R4_BOT_REPLIES_SUCCESSOR_AUTHORITY',
        status: 'FROZEN',
        project: 'MAXLIEN_EC_VITALISMEN_OFICIAL',
        parentCommit: BOT_REPLY_PARENT_COMMIT,
        parentTree: BOT_REPLY_PARENT_TREE,
        parentRelease: BOT_REPLY_PARENT_RELEASE,
        successorCommit: 'b'.repeat(40),
        successorTree: 'c'.repeat(40),
        freezeCommit: BOT_REPLY_FREEZE_COMMIT,
        freezeFileSha256: BOT_REPLY_FREEZE_FILE_SHA256,
        freezeCheckpointSha256: 'd'.repeat(64),
        botReplyAllowedFiles: hashes,
        ingressFreezeIntact: true,
        metaDatasetId: '920532663934291'
    };
    assert.equal(assertBotReplyAuthorityValue(authority), true);
    assert.throws(() => assertBotReplyAuthorityValue({ ...authority, ingressFreezeIntact: false }));
    assert.throws(() => assertBotReplyAuthorityValue({ ...authority,
        botReplyAllowedFiles: { ...hashes, 'src/routes/zapi.js': 'e'.repeat(64) } }));
});
