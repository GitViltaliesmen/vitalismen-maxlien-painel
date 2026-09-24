import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    assertCanonicalBuffer,
    assertHistoricalV202Files,
    assertManifestBytes
} from '../scripts/lib/repurchase-v141-v185-governance-v202-r1-context.mjs';
import { assertRepurchaseV141V185GovernanceV202 } from '../scripts/guard-repurchase-v141-v185-governance-v202.mjs';
import { assertRepurchaseV141V185GovernanceV202R1 } from '../scripts/guard-repurchase-v141-v185-governance-v202-r1.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V141 = 'tests/meta-funnel-reconciliation-v141.test.mjs';
const V185 = 'docs/freeze/v185-metrics-radar-readonly-20260918.json';
const V186 = 'docs/freeze/ec-v185-canonical-successor-v186-20260918.json';
const PAGE = 'public/funnel-metrics.html';
const MANIFEST = 'docs/freeze/repurchase-v141-v185-governance-successor-v202-r1-20260924.json';
const read = relative => fs.readFileSync(path.join(ROOT, relative));

test('V202-R1 preserves historical V141 and the current V185/V186 contract', () => {
    const result = assertRepurchaseV141V185GovernanceV202R1();
    assert.equal(result.historicalV141Preserved, true);
    assert.equal(result.currentContract, 'V185/V186');
    assert.equal(result.pageHash, '2231774777477240d46eae5021a2f2408ce3bffbf31d85a4807b84c5d7045b18');
});

test('canonical V141 Git blob identity is accepted without changing its working-tree bytes', async () => {
    const raw = await readFile(path.join(ROOT, V141));
    const canonical = assertCanonicalBuffer(V141, raw);
    assert.notDeepEqual(raw, canonical);
    assert.equal(assertHistoricalV202Files(), true);
});

test('wrong V141 content and mixed EOL are blocked', async () => {
    const raw = await readFile(path.join(ROOT, V141));
    const altered = Buffer.from(raw);
    altered[0] ^= 1;
    assert.throws(() => assertCanonicalBuffer(V141, altered), /V202_R1_CANONICAL_SHA_INVALID/);
    const canonical = assertCanonicalBuffer(V141, raw).toString('utf8');
    const mixed = Buffer.from(canonical.replace('\n', '\r\n'));
    assert.throws(() => assertCanonicalBuffer(V141, mixed), /V202_R1_MIXED_EOL_FORBIDDEN/);
});

test('wrong funnel-metrics content is blocked', async () => {
    const raw = await readFile(path.join(ROOT, PAGE));
    const altered = Buffer.from(raw);
    altered[0] ^= 1;
    assert.throws(() => assertCanonicalBuffer(PAGE, altered), /V202_R1_CANONICAL_SHA_INVALID/);
});

test('missing V185 and V186 contracts are blocked', () => {
    for (const missing of [V185, V186]) {
        assert.throws(() => assertRepurchaseV141V185GovernanceV202({
            read: relative => {
                if (relative === missing) throw new Error(`MISSING_CONTRACT:${missing}`);
                return read(relative);
            }
        }), new RegExp(`MISSING_CONTRACT:${missing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    }
});

test('tampered successor manifest is blocked', () => {
    const current = read(MANIFEST).toString('utf8');
    assert.throws(() => assertManifestBytes(Buffer.from(current.replace('V202-R1', 'V202-OTHER'))),
        /V202_R1_MANIFEST_INVALID/);
});

test('successor context is required before the guard runs', () => {
    const guard = path.join(ROOT, 'scripts/guard-repurchase-v141-v185-governance-v202-r1.mjs');
    const run = spawnSync(process.execPath, [guard], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '' }
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /V202_R1_CONTEXT_REQUIRED/);
});
