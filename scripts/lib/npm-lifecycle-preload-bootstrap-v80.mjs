import { bootstrapNpmLifecyclePreloadV80 } from '../../src/services/npmLifecyclePreloadBootstrapV80Service.js';

await bootstrapNpmLifecyclePreloadV80({ preloadUrl: import.meta.url });
