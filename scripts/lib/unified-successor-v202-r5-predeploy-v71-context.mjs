import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Carrega a cadeia existente antes de declarar somente as duas identidades
// sucedidas. Nenhum manifesto ou guard histórico é alterado ou suprimido.
await import('./ec-runtime-successor-v168b-bootstrap-context.mjs');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const stagePath = 'ops/vitalismen-stage';
const shipmentsPath = 'src/routes/shipments.js';
const historicalStage = '803481d66f89b235e3d1451050dfe3d64764389f14aa6596bba65cf381e18f99';
const currentStage = '7d1f8c4737d36a97ec7c6ec8dc7d0881387f4a18ea999928891d6090bf71c5f0';
const historicalShipments = '1be80bc61829c56060fd67d1c7248068983a7ac7ddd1d61b2b9e371bdbe49af0';
const currentShipments = 'c083862ea7123d854fd7260375632d1f4535451b26a53f1e9edf38d7b6ab0ef8';
const sha256 = (relative) => {
    const file = path.join(root, relative);
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'R5_V71_FILE_UNSAFE:' + relative);
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
};

assert.equal(globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT?.loaded, true,
    'R5_V71_OPERATIONAL_AUTHORITY_MISSING');
assert.equal(globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT?.parentR4Verified, true,
    'R5_V71_PARENT_R4_MISSING');
assert.equal(globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT?.releaseAttestationValidated, true,
    'R5_V71_GIT_ATTESTATION_MISSING');
assert.equal(sha256(stagePath), currentStage, 'R5_V71_STAGE_IDENTITY_INVALID');
assert.equal(sha256(shipmentsPath), currentShipments, 'R5_V71_SHIPMENTS_IDENTITY_INVALID');

const r4 = JSON.parse(fs.readFileSync(path.join(root,
    'docs/freeze/unified-successor-v202-r4-v78-controller-pin-20260925.json'), 'utf8'));
assert.equal(r4.allowlist.find((item) => item.path === shipmentsPath)?.canonicalSha256,
    currentShipments, 'R5_V71_R4_SHIPMENTS_AUTHORITY_INVALID');
const v147 = JSON.parse(fs.readFileSync(path.join(root,
    'docs/freeze/ec-all-postsale-dedupe-v147-r6r2-20260910.json'), 'utf8'));
assert.equal(v147.preservedFiles[stagePath], historicalStage,
    'R5_V71_HISTORICAL_STAGE_CHANGED');
const v168b = JSON.parse(fs.readFileSync(path.join(root,
    'docs/freeze/ec-runtime-guard-baseline-bootstrap-v168b-20260916.json'), 'utf8'));
assert.equal(v168b.protectedFiles[stagePath], historicalStage,
    'R5_V71_HISTORICAL_V168B_STAGE_CHANGED');

const oldV170 = globalThis.__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT;
const oldV168b = globalThis.__VITALISMEN_V168B_BASELINE_BOOTSTRAP_CONTEXT;
assert.equal(oldV170?.loaded, true, 'R5_V71_V170_MISSING');
assert.equal(oldV170.protectedFiles?.[shipmentsPath], historicalShipments,
    'R5_V71_HISTORICAL_SHIPMENTS_CHANGED');
assert.equal(oldV168b?.loaded, true, 'R5_V71_V168B_MISSING');
assert.ok(oldV168b.protectedFiles?.[stagePath] === undefined
    || oldV168b.protectedFiles[stagePath] === historicalStage,
    'R5_V71_V168B_STAGE_CHANGED');

const reconcile = (context) => Object.freeze({
    ...context,
    protectedFiles: Object.freeze({
        ...(context?.protectedFiles || {}),
        [stagePath]: currentStage,
        [shipmentsPath]: currentShipments
    })
});
Object.defineProperty(globalThis, '__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT', {
    configurable: true, enumerable: true, value: reconcile(oldV170)
});
globalThis.__VITALISMEN_V168B_BASELINE_BOOTSTRAP_CONTEXT = reconcile(oldV168b);

// A V168B instala bridges que reintroduzem hashes ancestrais ao publicar
// os contextos V147. Cada bridge é preservada e somente as duas identidades
// exatas acima são sobrepostas depois da sua própria validação.
for (const key of [
    '__VITALISMEN_V147_R6R2_CONTEXT',
    '__VITALISMEN_V147_R6_CONTEXT',
    '__VITALISMEN_V147_R5_CONTEXT',
    '__VITALISMEN_V148_CONTEXT'
]) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    assert.ok(original?.configurable && typeof original.get === 'function'
        && typeof original.set === 'function', 'R5_V71_BRIDGE_MISSING:' + key);
    let current = reconcile(original.get.call(globalThis));
    Object.defineProperty(globalThis, key, {
        configurable: true,
        enumerable: original.enumerable,
        get: () => current,
        set(value) {
            original.set.call(globalThis, value);
            current = reconcile(original.get.call(globalThis));
        }
    });
}

globalThis.__VITALISMEN_R5_V71_EXACT_SUCCESSOR = Object.freeze({
    loaded: true,
    stageSha256: currentStage,
    shipmentsSha256: currentShipments,
    checkpointSha256: globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT.checkpointSha256
});
