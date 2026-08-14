import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'docs', 'freeze', 'tex-ultra-initial-cadence-v2.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const requiredBottle = 'public/media/sales/ec/tex_ultra.png';
const approvedBottleHash = '450122a3db3823d012770a20f25f311be66a564b8fb23d9d0d47f0207d3ce2f7';
const sha256 = (relativePath) => crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest('hex');

assert.equal(manifest.status, 'approved_frozen');
assert.equal(manifest.productKey, 'tex_ultra_ec');
assert.equal(manifest.timingMode, 'cumulative_between_steps');
assert.deepEqual(manifest.cumulativeMinimumOffsetsMs, [2000, 13000, 34000, 62000, 97000]);
assert.deepEqual(manifest.cumulativeMaximumOffsetsMs, [10000, 30000, 55000, 88000, 128000]);
assert.ok(fs.existsSync(path.join(root, requiredBottle)), `${requiredBottle} ausente; publicacao bloqueada.`);
assert.equal(
    sha256(requiredBottle),
    approvedBottleHash,
    `${requiredBottle} nao corresponde ao frasco aprovado; publicacao bloqueada.`
);

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles)) {
    assert.equal(
        sha256(relativePath),
        approvedHash,
        `${relativePath} mudou depois da aprovacao. Crie uma nova versao; nao altere o congelamento v2.`
    );
}

console.log(`OK: ${manifest.freezeId} permanece integro.`);
