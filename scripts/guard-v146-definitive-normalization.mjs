import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const manifestUrl = new URL('../docs/freeze/ec-definitive-normalization-v146-20260908.json', import.meta.url);
const manifestText = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(manifestText);

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, 'manifesto V146 não canônico');
assert.equal(manifest.freezeId, 'EC_DEFINITIVE_NORMALIZATION_V146_20260908');
assert.equal(manifest.layer, 'V146');
assert.equal(manifest.parentCommit, '55f8ef8e695ee8569f541f1dbe590647a0aac6c2');
assert.equal(manifest.parentTree, 'd53dc6a9504800f5589233bfe02bc3b4a5a959f3');
assert.equal(manifest.policy.productionChanged, false);
assert.equal(manifest.policy.activationAllowed, false);
assert.equal(manifest.policy.realMessagesSent, 0);
assert.equal(manifest.policy.realDropiCalls, 0);
assert.equal(manifest.policy.realPurchaseTestSend, 0);
assert.equal(manifest.policy.contaboCodeChanged, false);
assert.equal(manifest.policy.vps3Touched, false);
assert.equal(manifest.policy.officialPreload, 'scripts/lib/ec-runtime-successor-v146-context.mjs');

for (const [relativePath, expectedSha256] of Object.entries(manifest.protectedFiles || {})) {
    const bytes = fs.readFileSync(new URL(`../${relativePath}`, import.meta.url));
    assert.equal(
        crypto.createHash('sha256').update(bytes).digest('hex'),
        expectedSha256,
        `V146 divergente: ${relativePath}`
    );
}

assert.equal(globalThis.__VITALISMEN_V146_CONTEXT?.loaded, true, 'preload oficial V146 ausente');
console.log('EC_DEFINITIVE_NORMALIZATION_V146=PASS');
console.log(`V146_MANIFEST_SHA256=${crypto.createHash('sha256').update(manifestText).digest('hex')}`);
