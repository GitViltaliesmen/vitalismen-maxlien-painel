// Explicit candidate preload: no changes to any frozen V144 bootstrap or runtime.
import { assertIntegrationHealthV145 } from '../guard-integration-health-v145.mjs';
assertIntegrationHealthV145();
await import('./ec-runtime-successor-v144-context.mjs');
