import assert from 'node:assert/strict';
import { verifyBotReplySuccessor } from './lib/bot-replies-successor-context.mjs';

const verified = verifyBotReplySuccessor();
const context = globalThis.__VITALISMEN_BOT_REPLIES_SUCCESSOR_CONTEXT;
assert.equal(context?.loaded, true, 'BOT_REPLY_SUCCESSOR_CONTEXT_MISSING');
assert.equal(context.successorCommit, verified.authority.successorCommit,
    'BOT_REPLY_SUCCESSOR_CONTEXT_COMMIT_INVALID');
assert.equal(context.successorTree, verified.authority.successorTree,
    'BOT_REPLY_SUCCESSOR_CONTEXT_TREE_INVALID');
assert.equal(context.authoritySha256, verified.authorityHash,
    'BOT_REPLY_SUCCESSOR_AUTHORITY_CHANGED');
assert.equal(context.ingressFreezeIntact, true, 'BOT_REPLY_INGRESS_FREEZE_NOT_PROVEN');
console.log('BOT_REPLY_SUCCESSOR_GUARD=PASS');
