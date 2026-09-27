import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    assertFreezeLockEcMetaDynamicV74,
    loadFreezeLockEcMetaDynamicV74Workspace
} from './lib/freeze-lock-ec-meta-dynamic-v74-contract.mjs';
import { assertR5Successor } from './guard-unified-successor-v202-r5.mjs';
import { verifyMaterializedRelease } from './lib/unified-successor-v202-r4-authority.mjs';
import { R5_PARENT_RELEASE } from './lib/unified-successor-v202-r5-authority.mjs';
import { assertExternalLocks, assertRequiredContexts } from './guard-unified-successor-v202-r4.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function assertR5FreezeLock() {
    await assertR5Successor(root);
    const context = globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT;
    assert.equal(context?.loaded, true, 'R5_FREEZE_OPERATIONAL_CONTEXT_MISSING');
    assert.equal(context.parentR4Verified, true, 'R5_FREEZE_PARENT_R4_MISSING');
    assert.equal(context.v47SuccessorVerified, true, 'R5_FREEZE_V47_MISSING');
    assertRequiredContexts({
        v199: globalThis.__VITALISMEN_V199_EC_BOT_CORE_HEALTH_META_CONTEXT?.loaded,
        v146: globalThis.__VITALISMEN_V146_CONTEXT?.loaded
    });
    const parent = verifyMaterializedRelease(
        path.join('/opt/vitalismen-automacao/releases', R5_PARENT_RELEASE));
    assertExternalLocks(parent.manifest.externalEffectLocks, process.env);
    const result = assertFreezeLockEcMetaDynamicV74(
        loadFreezeLockEcMetaDynamicV74Workspace(root));
    assert.equal(result.legacyActiveRuleCount, 19, 'R5_FREEZE_ACTIVE_RULES_CHANGED');
    assert.equal(result.overridesApplied.length, 3, 'R5_FREEZE_V74_OVERRIDES_CHANGED');
    await import('./guard-meta-capi-routing-freeze-v61.mjs');
    console.log('R5_FREEZE_LOCK=PASS');
    return true;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await assertR5FreezeLock();
}
