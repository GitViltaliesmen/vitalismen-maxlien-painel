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
const v163SuccessorOverrides = new Set(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []);

const v162ManifestUrl = new URL('../../docs/freeze/ec-buy-later-operational-v162-20260915.json', import.meta.url);
let v162Overrides = new Set();
let v162ProtectedFiles = Object.freeze({});
if (fs.existsSync(v162ManifestUrl)) {
    const v162 = canonicalJson('docs/freeze/ec-buy-later-operational-v162-20260915.json');
    assert.equal(v162.value.freezeId, 'EC_BUY_LATER_OPERATIONAL_V162_20260915');
    assert.equal(v162.value.version, 162);
    assert.equal(v162.value.parentCommit, '7618001e34dff3c8e556d75849e5fa842d5b1fd6');
    assert.equal(v162.value.parentTree, '9f63a2b964e77e82b7e4b90044643c7c93f6378a');
    assert.equal(v162.value.parentManifestSha256, '2fcb1583446b3f53f2a36a675c8f9851cea34acacecc06fda43aff19ff36e481');
    assert.deepEqual([...v162.value.overrides].sort(), Object.keys(v162.value.protectedFiles || {}).sort());
    v162Overrides = new Set(v162.value.overrides || []);
    for (const [file, expected] of Object.entries(v162.value.protectedFiles || {})) {
        if (v163SuccessorOverrides.has(file)) continue;
        assert.equal(hashFile(file), expected, `[V162] ${file}`);
    }
    v162ProtectedFiles = Object.freeze(Object.fromEntries(
        Object.entries(v162.value.protectedFiles || {}).filter(([file]) => !v163SuccessorOverrides.has(file))
    ));
    globalThis.__VITALISMEN_V162_CONTEXT = Object.freeze({
        loaded: true,
        freezeId: v162.value.freezeId,
        manifestSha256: hashBuffer(v162.text),
        protectedFiles: v162ProtectedFiles
    });
    for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
        globalThis[key] = [...new Set([...(globalThis[key] || []), ...(v162.value.overrides || [])])];
    }
}

const v161ManifestUrl = new URL('../../docs/freeze/ec-negative-intent-buy-later-v161-20260914.json', import.meta.url);
let v161Overrides = new Set();
let v161ProtectedFiles = Object.freeze({});
if (fs.existsSync(v161ManifestUrl)) {
    const v161 = canonicalJson('docs/freeze/ec-negative-intent-buy-later-v161-20260914.json');
    assert.equal(v161.value.freezeId, 'EC_NEGATIVE_INTENT_BUY_LATER_V161_20260914');
    assert.equal(v161.value.version, 161);
    assert.equal(v161.value.parentCommit, '0902194ecd5454d0f720466c4bd2bc081cfd97a0');
    assert.equal(v161.value.parentTree, '462aaa34a289ca596bec28158985f42c0ad6322c');
    assert.equal(v161.value.parentManifestSha256, 'f0a0b247c813ff46c8bfb6be8250800f7f720b1614f3d5eb7e2eab95d2bb39eb');
    assert.deepEqual([...v161.value.overrides].sort(), Object.keys(v161.value.protectedFiles || {}).sort());
    v161Overrides = new Set([...(v161.value.overrides || []), ...v162Overrides]);
    for (const [file, expected] of Object.entries(v161.value.protectedFiles || {})) {
        if (v162Overrides.has(file) || v163SuccessorOverrides.has(file)) continue;
        assert.equal(hashFile(file), expected, `[V161] ${file}`);
    }
    v161ProtectedFiles = Object.freeze(Object.fromEntries(
        Object.entries(v161.value.protectedFiles || {}).filter(([file]) => !v162Overrides.has(file) && !v163SuccessorOverrides.has(file))
    ));
    globalThis.__VITALISMEN_V161_CONTEXT = Object.freeze({
        loaded: true,
        freezeId: v161.value.freezeId,
        manifestSha256: hashBuffer(v161.text),
        protectedFiles: v161ProtectedFiles
    });
    for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
        globalThis[key] = [...new Set([...(globalThis[key] || []), ...v161Overrides])];
    }
}

const v160ManifestUrl = new URL('../../docs/freeze/ec-panel-manual-attendant-v160-20260914.json', import.meta.url);
let v160Overrides = new Set();
let v160ProtectedFiles = Object.freeze({});
if (fs.existsSync(v160ManifestUrl)) {
    const v160 = canonicalJson('docs/freeze/ec-panel-manual-attendant-v160-20260914.json');
    assert.equal(v160.value.freezeId, 'EC_PANEL_MANUAL_ATTENDANT_V160_20260914');
    assert.equal(v160.value.version, 160);
    assert.equal(v160.value.parentCommit, 'ea98fbee0fd77bf81f30c30add796b008adf1d2f');
    assert.equal(v160.value.parentTree, '4591c35be71e39fb6185ef26fdca6fcfe42179ea');
    assert.equal(v160.value.parentManifestSha256, '5cad677f29fd8a90021e69fd480ea22b7f4891bf5ed0d1aa031c842a7a3692fc');
    assert.deepEqual([...v160.value.overrides].sort(), Object.keys(v160.value.protectedFiles || {}).sort());
    v160Overrides = new Set([...(v160.value.overrides || []), ...v161Overrides]);
    for (const [file, expected] of Object.entries(v160.value.protectedFiles || {})) {
        if (v161Overrides.has(file) || v163SuccessorOverrides.has(file)) continue;
        assert.equal(hashFile(file), expected, `[V160] ${file}`);
    }
    v160ProtectedFiles = Object.freeze(Object.fromEntries(
        Object.entries(v160.value.protectedFiles || {}).filter(([file]) => !v161Overrides.has(file) && !v163SuccessorOverrides.has(file))
    ));
    globalThis.__VITALISMEN_V160_CONTEXT = Object.freeze({
        loaded: true,
        freezeId: v160.value.freezeId,
        manifestSha256: hashBuffer(v160.text),
        protectedFiles: v160ProtectedFiles
    });
    for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
        globalThis[key] = [...new Set([...(globalThis[key] || []), ...(v160.value.overrides || [])])];
    }
}

const v159ManifestUrl = new URL('../../docs/freeze/ec-panel-confirmed-python-serialization-v159-20260914.json', import.meta.url);
let v159Overrides = new Set();
let v159ProtectedFiles = Object.freeze({});
if (fs.existsSync(v159ManifestUrl)) {
    const v159 = canonicalJson('docs/freeze/ec-panel-confirmed-python-serialization-v159-20260914.json');
    assert.equal(v159.value.freezeId, 'EC_PANEL_CONFIRMED_PYTHON_SERIALIZATION_V159_20260914');
    assert.equal(v159.value.version, 159);
    assert.equal(v159.value.parentCommit, '174c85c525bd2f803d81812118ca81fc4d988ce5');
    assert.equal(v159.value.parentTree, 'ede79efebe5e57f065bf13c3b4b85a301b8681a2');
    assert.equal(v159.value.parentManifestSha256, 'f37431da16e1c332f7daf931f757451bd35cb6b0d27e51ecf80193f2a4edbfcc');
    assert.deepEqual([...v159.value.overrides].sort(), Object.keys(v159.value.protectedFiles || {}).sort());
    v159Overrides = new Set(v159.value.overrides || []);
    for (const [file, expected] of Object.entries(v159.value.protectedFiles || {})) {
        if (v160Overrides.has(file) || v163SuccessorOverrides.has(file)) continue;
        assert.equal(hashFile(file), expected, `[V159] ${file}`);
    }
    v159ProtectedFiles = Object.freeze(Object.fromEntries(
        Object.entries(v159.value.protectedFiles || {}).filter(([file]) => !v160Overrides.has(file) && !v163SuccessorOverrides.has(file))
    ));
    globalThis.__VITALISMEN_V159_CONTEXT = Object.freeze({
        loaded: true,
        freezeId: v159.value.freezeId,
        manifestSha256: hashBuffer(v159.text),
        protectedFiles: v159ProtectedFiles
    });
    for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
        globalThis[key] = [...new Set([...(globalThis[key] || []), ...(v159.value.overrides || [])])];
    }
}

const v158ManifestUrl = new URL('../../docs/freeze/ec-panel-confirmed-persistence-v158-20260914.json', import.meta.url);
let v158Overrides = new Set();
let v158ProtectedFiles = Object.freeze({});
if (fs.existsSync(v158ManifestUrl)) {
    const v158 = canonicalJson('docs/freeze/ec-panel-confirmed-persistence-v158-20260914.json');
    assert.equal(v158.value.freezeId, 'EC_PANEL_CONFIRMED_PERSISTENCE_V158_20260914');
    assert.equal(v158.value.version, 158);
    assert.equal(v158.value.parentCommit, 'd5f898d5fb59be87307aaa36bfb02f03c688704b');
    assert.equal(v158.value.parentTree, '5a471e60c301c57d7de62dde5bcdd3c6c0de1a82');
    assert.equal(v158.value.parentManifestSha256, '5aecf61299ea77e9f1dabc67788a141c7c9c8ce88f0adf4895d3210d5a3cc960');
    assert.deepEqual([...v158.value.overrides].sort(), Object.keys(v158.value.protectedFiles || {}).sort());
    v158Overrides = new Set(v158.value.overrides || []);
    for (const [file, expected] of Object.entries(v158.value.protectedFiles || {})) {
        if (v159Overrides.has(file) || v160Overrides.has(file) || v163SuccessorOverrides.has(file)) continue;
        assert.equal(hashFile(file), expected, `[V158] ${file}`);
    }
    v158ProtectedFiles = Object.freeze(Object.fromEntries(
        Object.entries(v158.value.protectedFiles || {}).filter(([file]) => !v159Overrides.has(file) && !v160Overrides.has(file) && !v163SuccessorOverrides.has(file))
    ));
    globalThis.__VITALISMEN_V158_CONTEXT = Object.freeze({
        loaded: true,
        freezeId: v158.value.freezeId,
        manifestSha256: hashBuffer(v158.text),
        protectedFiles: v158ProtectedFiles
    });
    for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
        globalThis[key] = [...new Set([...(globalThis[key] || []), ...(v158.value.overrides || [])])];
    }
}

const v157ManifestUrl = new URL('../../docs/freeze/ec-dropi-preflight-repair-v157-20260913.json', import.meta.url);
let v157Overrides = new Set();
let v157ProtectedFiles = Object.freeze({});
if (fs.existsSync(v157ManifestUrl)) {
    const v157 = canonicalJson('docs/freeze/ec-dropi-preflight-repair-v157-20260913.json');
    assert.equal(v157.value.freezeId, 'EC_DROPI_PREFLIGHT_REPAIR_V157_20260913');
    assert.equal(v157.value.version, 157);
    assert.equal(v157.value.parentCommit, '398ea6cc233eea0b7dd1b641e0a99f303a9c79ec');
    assert.equal(v157.value.parentTree, 'f7e7f1fa2b445bb05fe3a77a07889c5252617b83');
    assert.equal(v157.value.parentManifestSha256, '2d1baf5011c0d5aebcd8498af6b6895a643e43a7e22947e70e27cce812bd55e2');
    assert.deepEqual([...v157.value.overrides].sort(), Object.keys(v157.value.protectedFiles || {}).sort());
    v157Overrides = new Set(v157.value.overrides || []);
    for (const [file, expected] of Object.entries(v157.value.protectedFiles || {})) {
        if (v158Overrides.has(file) || v159Overrides.has(file) || v160Overrides.has(file) || v163SuccessorOverrides.has(file)) continue;
        assert.equal(hashFile(file), expected, `[V157] ${file}`);
    }
    v157ProtectedFiles = Object.freeze(Object.fromEntries(
        Object.entries(v157.value.protectedFiles || {}).filter(([file]) => !v158Overrides.has(file) && !v159Overrides.has(file) && !v160Overrides.has(file) && !v163SuccessorOverrides.has(file))
    ));
    globalThis.__VITALISMEN_V157_CONTEXT = Object.freeze({
        loaded: true,
        freezeId: v157.value.freezeId,
        manifestSha256: hashBuffer(v157.text),
        protectedFiles: v157ProtectedFiles
    });
    for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
        globalThis[key] = [...new Set([...(globalThis[key] || []), ...(v157.value.overrides || [])])];
    }
}

const installV157ProtectedFilesBridge = (key) => {
    const v163ProtectedFiles = Object.freeze({ ...(globalThis.__VITALISMEN_V163_CONTEXT?.protectedFiles || {}) });
    let context = Object.freeze({ protectedFiles: Object.freeze({ ...v157ProtectedFiles, ...v163ProtectedFiles }) });
    Object.defineProperty(globalThis, key, {
        configurable: true,
        enumerable: true,
        get: () => context,
        set: (value) => {
            context = Object.freeze({
                ...(value && typeof value === 'object' ? value : {}),
                protectedFiles: Object.freeze({
                    ...(value?.protectedFiles || {}),
                    ...v157ProtectedFiles,
                    ...v163ProtectedFiles
                })
            });
        }
    });
};
if (v157Overrides.size) {
    for (const key of [
        '__VITALISMEN_V147_R5_CONTEXT',
        '__VITALISMEN_V147_R6_CONTEXT',
        '__VITALISMEN_V147_R6R2_CONTEXT',
        '__VITALISMEN_V148_CONTEXT'
    ]) installV157ProtectedFilesBridge(key);
}

const successorManifestUrl = new URL('../../docs/freeze/ec-panel-agency-compact-options-v156-20260913.json', import.meta.url);
let successorOverrides = new Set();
if (fs.existsSync(successorManifestUrl)) {
    const successor = canonicalJson('docs/freeze/ec-panel-agency-compact-options-v156-20260913.json');
    assert.equal(successor.value.freezeId, 'EC_PANEL_AGENCY_COMPACT_OPTIONS_V156_20260913');
    assert.equal(successor.value.version, 156);
    assert.equal(successor.value.parentCommit, '5508829f634b566e826e70e428eae1f9416a0e07');
    assert.equal(successor.value.parentTree, '23828e7151b54fb339e25808054f84b04c256db2');
    assert.equal(successor.value.parentManifestSha256, '0caaa7c79ddd3582b6736179c733513d2ec91c5e729997476ddd4cc6539bc844');
    assert.deepEqual([...successor.value.overrides].sort(), Object.keys(successor.value.protectedFiles || {}).sort());
    successorOverrides = new Set(successor.value.overrides || []);
    for (const [file, expected] of Object.entries(successor.value.protectedFiles || {})) {
        if (v157Overrides.has(file) || v158Overrides.has(file) || v159Overrides.has(file) || v160Overrides.has(file) || v163SuccessorOverrides.has(file)) continue;
        assert.equal(hashFile(file), expected, `[V156] ${file}`);
    }
    const effectiveV156ProtectedFiles = Object.freeze(Object.fromEntries(
        Object.entries(successor.value.protectedFiles || {}).filter(([file]) => !v157Overrides.has(file) && !v158Overrides.has(file) && !v159Overrides.has(file) && !v160Overrides.has(file) && !v163SuccessorOverrides.has(file))
    ));
    globalThis.__VITALISMEN_V156_CONTEXT = Object.freeze({
        loaded: true,
        freezeId: successor.value.freezeId,
        manifestSha256: hashBuffer(successor.text),
        protectedFiles: effectiveV156ProtectedFiles
    });
    for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
        globalThis[key] = [...new Set([...(globalThis[key] || []), ...(successor.value.overrides || [])])];
    }
}

const current = canonicalJson('docs/freeze/ec-zapi-callback-race-reconciliation-v155-20260913.json');
const manifest = current.value;
const overrides = new Set(manifest.overrides || []);
const parent = canonicalJson('docs/freeze/ec-panel-manual-usage-guide-catchup-v154-20260913.json');
assert.equal(parent.value.freezeId, 'EC_PANEL_MANUAL_USAGE_GUIDE_CATCHUP_V154_20260913');
assert.equal(hashBuffer(parent.text), 'd3ee32ea6296625a47fa1bf9bc00ca7c5fd29ee46d99f11cd9733614172c57b8');
for (const [file, expected] of Object.entries(parent.value.protectedFiles || {})) {
    if (overrides.has(file) || successorOverrides.has(file) || v157Overrides.has(file) || v158Overrides.has(file) || v159Overrides.has(file) || v160Overrides.has(file) || v163SuccessorOverrides.has(file)) continue;
    assert.equal(hashFile(file), expected, `[V155 parent V154] ${file}`);
}
assert.equal(manifest.freezeId, 'EC_ZAPI_CALLBACK_RACE_RECONCILIATION_V155_20260913');
assert.equal(manifest.version, 155);
assert.equal(manifest.parentCommit, '3379df2303dde775c5957d706d4685c8f9bdda36');
assert.equal(manifest.parentTree, '58f2062c0ecbe795666727b8c0b375c0b15cdc4c');
assert.equal(manifest.parentManifestSha256, 'd3ee32ea6296625a47fa1bf9bc00ca7c5fd29ee46d99f11cd9733614172c57b8');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles || {}).sort());
for (const [file, expected] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(file) || v157Overrides.has(file) || v158Overrides.has(file) || v159Overrides.has(file) || v160Overrides.has(file) || v163SuccessorOverrides.has(file)) continue;
    assert.equal(hashFile(file), expected, `[V155] ${file}`);
}

const effectiveProtectedFiles = Object.freeze(Object.fromEntries(
    Object.entries(manifest.protectedFiles || {}).filter(([file]) => (
        !successorOverrides.has(file) && !v157Overrides.has(file) && !v158Overrides.has(file) && !v159Overrides.has(file) && !v160Overrides.has(file) && !v163SuccessorOverrides.has(file)
    ))
));

globalThis.__VITALISMEN_V155_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    manifestSha256: hashBuffer(current.text),
    protectedFiles: Object.freeze({ ...effectiveProtectedFiles, ...v157ProtectedFiles, ...v158ProtectedFiles, ...v159ProtectedFiles, ...v160ProtectedFiles, ...v161ProtectedFiles, ...v162ProtectedFiles })
});
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...(manifest.overrides || [])])];
}
