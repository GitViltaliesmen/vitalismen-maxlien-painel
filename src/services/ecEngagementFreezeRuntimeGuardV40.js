// Entrada de compatibilidade preservada para todos os guards anteriores.
// Entrada canônica: V72 protege a materialização/deploy e termina validando o runtime V71.
// A semântica operacional permanece V71 STRICT_READ_ONLY; V72 não cria runtime-chain-v72.
// Cadeia herdada: V71 → V70 → V69 → V68 → runtimeGuardChainFreezeRuntimeGuardV67.js → V66 e ancestrais.
await import('./deployHelperV71ChainAlignmentSafetyFreezeGuardV72.js');
