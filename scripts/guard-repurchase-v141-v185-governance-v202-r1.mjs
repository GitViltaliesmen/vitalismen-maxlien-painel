import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRepurchaseV141V185GovernanceV202 } from './guard-repurchase-v141-v185-governance-v202.mjs';

export const assertRepurchaseV141V185GovernanceV202R1 = () => {
    const context = globalThis.__VITALISMEN_V202_R1_GOVERNANCE_CONTEXT;
    assert.equal(context?.loaded, true, 'V202_R1_CONTEXT_REQUIRED');
    assert.equal(context.freezeId, 'REPURCHASE_V141_TO_V185_GOVERNANCE_V202_R1_20260924',
        'V202_R1_CONTEXT_INVALID');
    assert.equal(fs.readFileSync, context.bridgeReadFileSync, 'V202_R1_READ_BRIDGE_MISSING');
    const result = assertRepurchaseV141V185GovernanceV202();
    assert.equal(result.historicalV141Preserved, true);
    assert.equal(result.currentContract, 'V185/V186');
    return result;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    assertRepurchaseV141V185GovernanceV202R1();
    console.log('V202_R1_GOVERNANCE_GUARD=PASS');
}
