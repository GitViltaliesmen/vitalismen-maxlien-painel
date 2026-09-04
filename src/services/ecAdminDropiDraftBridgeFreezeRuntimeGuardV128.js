import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const read = (file) => fs.readFileSync(new URL(file, root));
const fileHash = (file) => hash(read(file));
export const EC_ADMIN_DROPI_V128_OVERRIDES = Object.freeze([
    '.github/workflows/ec-panel-quality.yml',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/routes/shipments.js'
]);
const protectedFiles = [...EC_ADMIN_DROPI_V128_OVERRIDES,
    'docs/EC_ADMIN_DROPI_DRAFT_BRIDGE_V128_20260904.md',
    'src/services/ecAdminDropiDraftBridgeV128Service.js',
    'src/services/ecAdminDropiDraftBridgeFreezeRuntimeGuardV128.js',
    'tests/ec-admin-dropi-draft-bridge-v128.test.mjs'
].sort();
const policy = {
    country: 'EC',
    savedExplicitProductRequired: true,
    samePhoneAndDestinationRequired: true,
    validatedCustomerDataRequired: true,
    existingOrdersChanged: false,
    transportChanged: false,
    authorizationPerOrderRequired: true,
    automaticSubmitAllowed: false,
    priceChangesAllowed: false,
    vslAttributionChanged: false,
    whatsappOrMetaEffectsAllowed: false
};
export const assertEcAdminDropiDraftBridgeV128Manifest = () => {
    const parentPath = 'docs/freeze/ec-auth-login-v78-pass-through-v127-20260904.json';
    assert.equal(fileHash(parentPath), 'b483ad91cde2befe4901ee69d88827a1c47ac5c24f202a130a68872d050f6675');
    const manifest = JSON.parse(read('docs/freeze/ec-admin-dropi-draft-bridge-v128-20260904.json'));
    assert.equal(manifest.version, 128);
    assert.equal(manifest.freezeId, 'ec-admin-dropi-draft-bridge-v128');
    assert.equal(manifest.parentCommit, 'e8a4eb2034efa8fc1ffc7017917b011fb79aec1a');
    assert.deepEqual(manifest.policy, policy);
    assert.deepEqual(manifest.declaredAncestorOverrides, EC_ADMIN_DROPI_V128_OVERRIDES);
    assert.deepEqual(Object.keys(manifest.protectedFiles).sort(), protectedFiles);
    const successors = new Set(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []);
    for (const [file, expected] of Object.entries(JSON.parse(read(parentPath)).protectedFiles)) {
        if (!EC_ADMIN_DROPI_V128_OVERRIDES.includes(file) && !successors.has(file)) assert.equal(fileHash(file), expected, file);
    }
    for (const file of protectedFiles) {
        if (!successors.has(file)) assert.equal(fileHash(file), manifest.protectedFiles[file], file);
    }
    assert.equal(manifest.logicalBundle.sha256, hash(protectedFiles.map(file => `${file}\0${manifest.protectedFiles[file]}\n`).join('')));
    return { ready: true, overrides: EC_ADMIN_DROPI_V128_OVERRIDES, manifest };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    assertEcAdminDropiDraftBridgeV128Manifest();
    console.log('EC_ADMIN_DROPI_DRAFT_BRIDGE_V128=PASS');
}
