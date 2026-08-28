// Entrada de compatibilidade preservada para todos os guards anteriores.
// Entrada canônica: V76 corrige o health de deploy e termina validando V75 → V74 → V73 → V72 → runtime V71.
// A semântica operacional permanece V71 STRICT_READ_ONLY; V72 não cria runtime-chain-v72.
// Cadeia herdada: V76 → V75 → V74 → V73 → V72 → V71 → V70 → V69 → V68 → runtimeGuardChainFreezeRuntimeGuardV67.js → V66 e ancestrais.
await import('./deployHealthBridgeSemanticsSafetyFreezeRuntimeGuardV76.js');
