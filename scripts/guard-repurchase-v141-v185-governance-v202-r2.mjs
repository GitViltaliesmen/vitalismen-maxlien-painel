import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRELOAD = 'scripts/lib/repurchase-v141-v185-governance-v202-r2-context.mjs';
const MANIFEST = 'docs/freeze/repurchase-v141-v185-governance-successor-v202-r2-20260924.json';
const PRELOAD_SHA256 = '2277bf4934b4b653f8e9212fd8070e765222b146eee12db190bca90c6e0df57b';
const MANIFEST_SHA256 = '5c2c1990f2cc614e9367e210e3678f63944a6dadd36ddec3772cb74ffb060f0e';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

export const assertRepurchaseV202R2Successor = ({
    context = globalThis.__VITALISMEN_V202_R2_SUCCESSOR_CONTEXT,
    read = relative => fs.readFileSync(path.join(ROOT, relative))
} = {}) => {
    assert.equal(context?.loaded, true, 'V202_R2_SUCCESSOR_CONTEXT_REQUIRED');
    assert.equal(context.freezeId, 'REPURCHASE_V141_TO_V185_GOVERNANCE_V202_R2_20260924',
        'V202_R2_SUCCESSOR_CONTEXT_INVALID');
    assert.equal(context.preload, PRELOAD, 'V202_R2_WRONG_PRELOAD');
    assert.equal(context.manifestSha256, MANIFEST_SHA256, 'V202_R2_CONTEXT_MANIFEST_INVALID');
    assert.equal(sha256(read(MANIFEST)), MANIFEST_SHA256, 'V202_R2_MANIFEST_TAMPERED');
    assert.equal(sha256(read(PRELOAD)), PRELOAD_SHA256, 'V202_R2_PRELOAD_TAMPERED');
    assert.equal(context.policy.failClosed, true, 'V202_R2_FAIL_CLOSED_DISABLED');
    assert.equal(context.policy.noHistoricalGuardBypass, true, 'V202_R2_HISTORICAL_GUARD_BYPASS');
    assert.equal(context.historicalShipmentsSha256,
        '1be80bc61829c56060fd67d1c7248068983a7ac7ddd1d61b2b9e371bdbe49af0');
    assert.equal(context.successorShipmentsSha256,
        'c083862ea7123d854fd7260375632d1f4535451b26a53f1e9edf38d7b6ab0ef8');
    assert.equal(sha256(read('src/routes/shipments.js')), context.successorShipmentsSha256,
        'V202_R2_SUCCESSOR_SHIPMENTS_INVALID');
    const v183 = JSON.parse(read('docs/freeze/ec-panel-only-agency-city-scope-v183-20260918.json'));
    assert.equal(v183.protectedFiles['src/routes/shipments.js'], context.historicalShipmentsSha256,
        'V202_R2_HISTORICAL_SEMANTICS_CHANGED');
    assert.equal(globalThis.__VITALISMEN_V202_R1_GOVERNANCE_CONTEXT?.loaded, true,
        'V202_R2_PARENT_CONTEXT_MISSING');
    return Object.freeze({
        contract: 'V202-R2',
        historicalV183V186Preserved: true,
        successorShipmentsAccepted: true,
        preloadSha256: PRELOAD_SHA256,
        manifestSha256: MANIFEST_SHA256
    });
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    assertRepurchaseV202R2Successor();
    console.log('V202_R2_SUCCESSOR_GUARD=PASS');
}
