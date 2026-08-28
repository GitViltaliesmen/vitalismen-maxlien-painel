import {
    assertFreezeLockEcMetaDynamicV74,
    loadFreezeLockEcMetaDynamicV74Workspace
} from './lib/freeze-lock-ec-meta-dynamic-v74-contract.mjs';

// O entrypoint histórico permanece obrigatório. A V74 não desativa o lock:
// ela executa todos os checks legados, exceto os três checks identificados
// byte a byte no contrato sucessor, e substitui somente esses três pela prova
// dinâmica V73 de maior rigor.
const result = assertFreezeLockEcMetaDynamicV74(loadFreezeLockEcMetaDynamicV74Workspace());

if (result.warnings.length) {
    console.warn('[FREEZE-LOCK-EC] Avisos:');
    for (const warning of result.warnings) console.warn(`- ${warning}`);
}

console.log(`[FREEZE-LOCK-EC] OK: ${result.legacyActiveRuleCount} regra(s) congelada(s) preservada(s); 3 checks sucedidos explicitamente pela V74.`);
console.log('[FREEZE-LOCK-EC] V73_DYNAMIC_META_CONTRACT=PASS');
