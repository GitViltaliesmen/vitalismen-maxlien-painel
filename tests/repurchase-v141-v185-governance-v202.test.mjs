import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { assertRepurchaseV141V185GovernanceV202 } from '../scripts/guard-repurchase-v141-v185-governance-v202.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const originalRead = relative => fs.readFileSync(path.join(root, relative));
const altered = (target, replacement) => relative => relative === target ? Buffer.from(replacement) : originalRead(relative);

test('1 página atual V185/V186 é o contrato aplicável', () => {
    const result = assertRepurchaseV141V185GovernanceV202();
    assert.equal(result.currentContract, 'V185/V186');
});

test('2 hash da página adulterado bloqueia', () => {
    assert.throws(() => assertRepurchaseV141V185GovernanceV202({
        read: altered('public/funnel-metrics.html', 'adulterado')
    }), /V202_CURRENT_PAGE_HASH_INVALID/);
});

test('3 contrato V185 ausente bloqueia', () => {
    assert.throws(() => assertRepurchaseV141V185GovernanceV202({
        read: relative => {
            if (relative === 'docs/freeze/v185-metrics-radar-readonly-20260918.json') throw new Error('V185_MISSING');
            return originalRead(relative);
        }
    }), /V185_MISSING/);
});

test('4 manifesto sucessor adulterado bloqueia', () => {
    const relative = 'docs/freeze/repurchase-v141-v185-governance-successor-v202-20260924.json';
    const text = originalRead(relative).toString('utf8');
    assert.throws(() => assertRepurchaseV141V185GovernanceV202({
        read: altered(relative, text.replace('V185/V186', 'V141'))
    }), /V202_MANIFEST_NOT_CANONICAL|AssertionError/);
});

test('5 V141 não pode ser usado como contrato atual', () => {
    assert.throws(() => assertRepurchaseV141V185GovernanceV202({ contract: 'V141' }), /V202_CURRENT_CONTRACT_INVALID/);
});

test('6 evidência histórica V141 permanece byte a byte', () => {
    assert.equal(assertRepurchaseV141V185GovernanceV202().historicalV141Preserved, true);
    assert.throws(() => assertRepurchaseV141V185GovernanceV202({
        read: altered('tests/meta-funnel-reconciliation-v141.test.mjs', 'adulterado')
    }), /V202_HISTORICAL_V141_CHANGED/);
});
