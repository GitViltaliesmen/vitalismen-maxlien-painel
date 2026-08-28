// Entrada de compatibilidade preservada para todos os guards anteriores.
// Entrada canônica: V73 protege a configuração Meta e termina validando V72 → runtime V71.
// A semântica operacional permanece V71 STRICT_READ_ONLY; V72 não cria runtime-chain-v72.
// Cadeia herdada: V73 → V72 → V71 → V70 → V69 → V68 → runtimeGuardChainFreezeRuntimeGuardV67.js → V66 e ancestrais.
await import('./metaPartnerDestinationRegistryFreezeRuntimeGuardV73.js');
