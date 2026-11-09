import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Fixed official verifier path; no request/env-selected code or approval file.
// A missing/unregistered evolution refuses commercial sends and preserves QA.
export async function readManualCommercialScope() {
    const root = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
    const engine = await import('file:///usr/local/lib/vitalismen-deploy/gira21x-sealed-successor-v1.mjs');
    if (typeof engine.authorizeCommercialManualScope !== 'function') return null;
    return engine.authorizeCommercialManualScope(root);
}
