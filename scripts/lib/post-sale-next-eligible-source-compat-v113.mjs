import fs from 'node:fs';
import path from 'node:path';

import {
    assertPanelWarmupIsolationV118Manifest,
    PANEL_WARMUP_ISOLATION_V118_OVERRIDE_KEY
} from '../../src/services/panelWarmupIsolationV118ManifestService.js';
import {
    assertPostSaleTransactionalSafetyV116Manifest,
    POST_SALE_TRANSACTIONAL_SAFETY_V116_OVERRIDE_KEY
} from '../../src/services/postSaleTransactionalSafetyV116ManifestService.js';
import { assertEcPanelRuntimeRecoveryV115Manifest } from '../../src/services/ecPanelRuntimeRecoveryV115Service.js';

const v118 = assertPanelWarmupIsolationV118Manifest();
const v118InheritedOverrides = Array.isArray(globalThis[PANEL_WARMUP_ISOLATION_V118_OVERRIDE_KEY])
    ? globalThis[PANEL_WARMUP_ISOLATION_V118_OVERRIDE_KEY]
    : [];
globalThis[PANEL_WARMUP_ISOLATION_V118_OVERRIDE_KEY] = [
    ...new Set([...v118InheritedOverrides, ...v118.overrides])
];
const v116 = assertPostSaleTransactionalSafetyV116Manifest();
const inheritedOverrides = Array.isArray(globalThis[POST_SALE_TRANSACTIONAL_SAFETY_V116_OVERRIDE_KEY])
    ? globalThis[POST_SALE_TRANSACTIONAL_SAFETY_V116_OVERRIDE_KEY]
    : [];
globalThis[POST_SALE_TRANSACTIONAL_SAFETY_V116_OVERRIDE_KEY] = [...new Set([...inheritedOverrides, ...v116.overrides])];
const v115 = assertEcPanelRuntimeRecoveryV115Manifest();
globalThis[POST_SALE_TRANSACTIONAL_SAFETY_V116_OVERRIDE_KEY] = [
    ...new Set([...globalThis[POST_SALE_TRANSACTIONAL_SAFETY_V116_OVERRIDE_KEY], ...v115.overrides])
];
const {
    normalizeModernReleaseSourceV113,
    assertPostSaleNextEligibleSourceCompatibilityV113Manifest
} = await import('../../src/services/postSaleNextEligibleSourceCompatibilityV113Service.js');
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
