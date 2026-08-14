import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'docs', 'freeze', 'tex-ultra-initial-concurrency-v3.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const sha256 = (relativePath) => {
    const filePath = path.join(root, relativePath);
    const content = relativePath.endsWith('.png')
        ? fs.readFileSync(filePath)
        : Buffer.from(fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n'));
    return crypto.createHash('sha256').update(content).digest('hex');
};

assert.equal(manifest.status, 'approved_frozen');
assert.equal(manifest.productKey, 'tex_ultra_ec');
assert.equal(manifest.scope, 'initial_layer_only');
assert.deepEqual(manifest.operatorApproximateOffsetsSeconds, [20, 29, 50, 82, 116]);
assert.deepEqual(manifest.observedDeliveredOffsetsSeconds, [18, 29, 50, 80, 114]);
assert.deepEqual(manifest.sequence, ['intro01', 'intro02', 'proof', 'bottle', 'offer']);
assert.equal(manifest.concurrency.perContactTimers, true);
assert.equal(manifest.concurrency.fullSequenceQueueing, false);
assert.equal(manifest.concurrency.globalQueueScope, 'provider_send_only');
assert.equal(manifest.concurrency.waveJoinMs, 20000);
assert.equal(manifest.concurrency.simulatedBatchMaximumMs, 148000);
assert.equal(manifest.concurrency.forbiddenSequentialBatchMs, 6400000);

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles)) {
    assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} ausente; publicacao bloqueada.`);
    assert.equal(
        sha256(relativePath),
        approvedHash,
        `${relativePath} mudou depois da aprovacao; publicacao bloqueada.`
    );
}

console.log(`OK: ${manifest.freezeId} permanece integro e concorrente por contato.`);
