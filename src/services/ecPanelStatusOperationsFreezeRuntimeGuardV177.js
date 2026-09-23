import assert from 'node:assert/strict';

import '../../scripts/lib/ec-runtime-successor-v170-context.mjs';

const context = globalThis.__VITALISMEN_V177_PANEL_STATUS_CONTEXT;
assert.equal(context?.loaded, true, '[V177] successor_context_not_loaded');
assert.equal(context.freezeId, 'EC_PANEL_STATUS_OPERATIONS_V177_20260917');
assert.equal(context.parentCommit, '6f0fe637a226490e7fb3803370f10bdb86116765');
assert.equal(context.policy?.exactRouteCount, 4);
assert.deepEqual(context.policy?.orderWriteOperations, ['confirm-order', 'repurchase-new-cycle']);
assert.equal(context.policy?.localAdminSyncOnly, true);
assert.equal(context.policy?.externalEffectsChanged, false);

console.log(`EC_PANEL_STATUS_OPERATIONS_V177=PASS manifest_sha256=${context.manifestSha256}`);
