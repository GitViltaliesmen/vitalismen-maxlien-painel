import { bootstrapNpmLifecycleStageEnvelopeV81 } from '../../src/services/npmLifecycleStageEnvelopeCompatibilityV81Service.js';

await bootstrapNpmLifecycleStageEnvelopeV81({ preloadUrl: import.meta.url });
