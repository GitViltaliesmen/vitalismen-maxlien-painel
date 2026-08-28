import {
    assertFreezeLockEcMetaDynamicV74,
    loadFreezeLockEcMetaDynamicV74Workspace
} from './lib/freeze-lock-ec-meta-dynamic-v74-contract.mjs';

const result = assertFreezeLockEcMetaDynamicV74(loadFreezeLockEcMetaDynamicV74Workspace());

for (const warning of result.warnings) console.warn(`[FREEZE-LOCK-EC-META-DYNAMIC-V74] aviso: ${warning}`);
console.log('FREEZE_LOCK_EC_META_DYNAMIC_V74_STATIC=OK');
console.log(`LEGACY_ACTIVE_RULES=${result.legacyActiveRuleCount}`);
console.log(`AUTHORIZED_OVERRIDES=${result.overridesApplied.length}`);
console.log('V73_DYNAMIC_META_CONTRACT=PASS');
console.log('BROWSER_CAPI_DATASET_EQUALITY=REQUIRED');
console.log('DUPLICATE_PURCHASE_PATHS=0');
console.log('TOKEN_BROWSER_EXPOSURE=0');
