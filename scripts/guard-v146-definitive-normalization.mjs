import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const manifestUrl = new URL('../docs/freeze/ec-definitive-normalization-v146-20260908.json', import.meta.url);
const manifestText = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(manifestText);

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, 'manifesto V146 não canônico');
assert.equal(manifest.freezeId, 'EC_DEFINITIVE_NORMALIZATION_V146_20260908');
assert.equal(manifest.layer, 'V146-R2');
assert.equal(manifest.revision, 'official_preload_repurchase_guard');
assert.equal(manifest.parentCommit, '55f8ef8e695ee8569f541f1dbe590647a0aac6c2');
assert.equal(manifest.parentTree, 'd53dc6a9504800f5589233bfe02bc3b4a5a959f3');
assert.equal(manifest.policy.productionChanged, false);
assert.equal(manifest.policy.activationAllowed, false);
assert.equal(manifest.policy.realMessagesSent, 0);
assert.equal(manifest.policy.realDropiCalls, 0);
assert.equal(manifest.policy.realPurchaseTestSend, 0);
assert.equal(manifest.policy.contaboCodeChanged, false);
assert.equal(manifest.policy.vps3Touched, false);
assert.equal(manifest.policy.officialPreload, 'scripts/lib/ec-runtime-successor-v97-context.mjs');

for (const [relativePath, expectedSha256] of Object.entries(manifest.protectedFiles || {})) {
    const bytes = fs.readFileSync(new URL(`../${relativePath}`, import.meta.url));
    assert.equal(
        crypto.createHash('sha256').update(bytes).digest('hex'),
        expectedSha256,
        `V146 divergente: ${relativePath}`
    );
}

assert.equal(globalThis.__VITALISMEN_V146_CONTEXT?.loaded, true, 'preload oficial V146 ausente');
assert.equal(globalThis.__VITALISMEN_V145_R2_CONTEXT?.loaded, true, 'contexto V145 ausente da cadeia oficial');
const registeredOverrides = new Set(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []);
for (const relativePath of manifest.overrides) {
    assert.equal(registeredOverrides.has(relativePath), true, `override V146 não registrado: ${relativePath}`);
}
const v97 = fs.readFileSync(new URL('./lib/ec-runtime-successor-v97-context.mjs', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('./lib/ec-runtime-successor-v144-bootstrap-context.mjs', import.meta.url), 'utf8');
const v146Context = fs.readFileSync(new URL('./lib/ec-runtime-successor-v146-context.mjs', import.meta.url), 'utf8');
assert.match(v97, /^import '\.\/ec-runtime-successor-v144-bootstrap-context\.mjs';/);
assert.match(bootstrap, /import '\.\/ec-runtime-successor-v146-context\.mjs';\nimport '\.\/ec-runtime-successor-v145-context\.mjs';/);
assert.doesNotMatch(v146Context, /import\(['"]\.\/ec-runtime-successor-v97-context\.mjs['"]\)/);
console.log('EC_DEFINITIVE_NORMALIZATION_V146=PASS');
console.log(`V146_MANIFEST_SHA256=${crypto.createHash('sha256').update(manifestText).digest('hex')}`);
