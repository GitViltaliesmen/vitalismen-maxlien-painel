import fs from 'node:fs';
import path from 'node:path';

import {
    normalizeModernReleaseSourceV113,
    assertPostSaleNextEligibleSourceCompatibilityV113Manifest
} from '../../src/services/postSaleNextEligibleSourceCompatibilityV113Service.js';

assertPostSaleNextEligibleSourceCompatibilityV113Manifest();
const originalReadFileSync = fs.readFileSync.bind(fs);

fs.readFileSync = function postSaleV113ReadFileSync(file, options) {
    const original = originalReadFileSync(file, options);
    let resolved = '';
    try {
        resolved = path.resolve(String(file));
    } catch {
        return original;
    }
    if (path.basename(resolved) !== '.release-source.json') return original;

    const text = Buffer.isBuffer(original) ? original.toString('utf8') : String(original);
    let source;
    try {
        source = JSON.parse(text);
    } catch {
        return original;
    }
    const normalized = normalizeModernReleaseSourceV113(source);
    if (normalized === source) return original;

    const adapted = `${JSON.stringify(normalized, null, 2)}\n`;
    return Buffer.isBuffer(original) ? Buffer.from(adapted, 'utf8') : adapted;
};

globalThis.__VITALISMEN_POST_SALE_SOURCE_COMPAT_V113 = Object.freeze({
    version: 113,
    mode: 'READ_ONLY_FUNCTIONAL_TREE_ALIAS'
});
