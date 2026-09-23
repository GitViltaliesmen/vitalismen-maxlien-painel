import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';

const hashBuffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => hashBuffer(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)));
const canonicalJson = (relative) => {
    const text = fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`);
    return { text, value };
};

const current = canonicalJson('docs/freeze/ec-panel-manual-usage-guide-catchup-v154-20260913.json');
const manifest = current.value;
const v154Overrides = new Set(manifest.overrides || []);
const v155SuccessorOverrides = new Set(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []);
const parent = canonicalJson('docs/freeze/ec-audio-postsale-recovery-v153-20260913.json');
assert.equal(parent.value.freezeId, 'EC_AUDIO_POSTSALE_RECOVERY_V153_20260913');
assert.equal(hashBuffer(parent.text), '2a18a61ab95b4302a1a1302273a4e32184a4b1dcfdd7f1d166dff9ddb33a87b6');
for (const [file, expected] of Object.entries(parent.value.protectedFiles || {})) {
    if (v154Overrides.has(file) || v155SuccessorOverrides.has(file)) continue;
    assert.equal(hashFile(file), expected, `[V154 parent V153] ${file}`);
}
assert.equal(manifest.freezeId, 'EC_PANEL_MANUAL_USAGE_GUIDE_CATCHUP_V154_20260913');
assert.equal(manifest.version, 154);
assert.equal(manifest.parentCommit, '3321216fbc75e51636883766860524c050a88d39');
assert.equal(manifest.parentTree, '85063ae8d370ce8328dc0ef3df33c473e69c3df7');
assert.equal(manifest.parentManifestSha256, '2a18a61ab95b4302a1a1302273a4e32184a4b1dcfdd7f1d166dff9ddb33a87b6');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());
assert.equal(manifest.policy.manualLibraryP7RequiresAuthenticatedPanel, true);
assert.equal(manifest.policy.manualLibraryP7CreatesFakeShipment, false);
assert.equal(manifest.policy.pickupBypassAllowed, false);
assert.equal(manifest.policy.historicalBurstAllowed, false);
assert.equal(manifest.policy.productionWhatsAppNumberChanged, false);
assert.equal(manifest.policy.dropiOrderCreationChanged, false);
assert.equal(manifest.policy.metaCapiChanged, false);
for (const [file, expected] of Object.entries(manifest.protectedFiles || {})) {
    if (v155SuccessorOverrides.has(file)) continue;
    assert.equal(hashFile(file), expected, `[V154] ${file}`);
}

const effectiveProtectedFiles = Object.freeze(Object.fromEntries(
    Object.entries(manifest.protectedFiles || {}).filter(([file]) => !v155SuccessorOverrides.has(file))
));

const mergeV148 = (value) => {
    if (!value || typeof value !== 'object') return value;
    const inherited = Object.fromEntries(
        Object.entries(value.protectedFiles || {}).filter(([file]) => !v155SuccessorOverrides.has(file))
    );
    return Object.freeze({
        ...value,
        protectedFiles: Object.freeze({
            ...inherited,
            ...effectiveProtectedFiles,
            ...(globalThis.__VITALISMEN_V155_CONTEXT?.protectedFiles || {})
        })
    });
};
let v148Context = mergeV148(globalThis.__VITALISMEN_V148_CONTEXT);
Object.defineProperty(globalThis, '__VITALISMEN_V148_CONTEXT', {
    configurable: true,
    enumerable: true,
    get: () => v148Context,
    set: (value) => { v148Context = mergeV148(value); }
});

globalThis.__VITALISMEN_V154_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: hashBuffer(current.text),
    protectedFiles: effectiveProtectedFiles
});
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...(manifest.overrides || [])])];
}
