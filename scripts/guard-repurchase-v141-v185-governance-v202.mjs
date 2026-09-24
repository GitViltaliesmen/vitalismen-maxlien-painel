import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = 'docs/freeze/repurchase-v141-v185-governance-successor-v202-20260924.json';
const HISTORICAL = 'tests/meta-funnel-reconciliation-v141.test.mjs';
const PAGE = 'public/funnel-metrics.html';
const V185 = 'docs/freeze/v185-metrics-radar-readonly-20260918.json';
const V186 = 'docs/freeze/ec-v185-canonical-successor-v186-20260918.json';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const canonical = value => `${JSON.stringify(value, null, 2)}\n`;

export const assertRepurchaseV141V185GovernanceV202 = ({
    contract = 'V185/V186',
    read = relative => fs.readFileSync(path.join(ROOT, relative))
} = {}) => {
    assert.equal(contract, 'V185/V186', 'V202_CURRENT_CONTRACT_INVALID');
    const manifestText = read(MANIFEST).toString('utf8');
    const manifest = JSON.parse(manifestText);
    assert.equal(manifestText, canonical(manifest), 'V202_MANIFEST_NOT_CANONICAL');
    assert.equal(manifest.freezeId, 'REPURCHASE_V141_TO_V185_GOVERNANCE_V202_20260924');
    assert.equal(manifest.baseCommit, '641759b160c2b91e95a3f1df371ad372a74d72e1');
    assert.equal(manifest.historicalContract, 'V141_EVIDENCE_ONLY');
    assert.equal(manifest.currentContract, 'V185/V186');
    assert.equal(manifest.policy.failClosed, true);
    assert.equal(manifest.policy.functionalPageChanged, false);
    assert.equal(manifest.policy.historicalTestChanged, false);
    assert.equal(manifest.policy.realDropiOrPurchaseAllowed, false);
    assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());

    const historical = read(HISTORICAL);
    assert.equal(sha256(historical), manifest.historicalV141Sha256, 'V202_HISTORICAL_V141_CHANGED');
    assert.match(historical.toString('utf8'), /Dados insuficientes ou desatualizados/);
    const v185Text = read(V185).toString('utf8');
    const v186Text = read(V186).toString('utf8');
    assert.equal(sha256(v185Text), manifest.v185ManifestSha256, 'V202_V185_MANIFEST_CHANGED');
    assert.equal(sha256(v186Text), manifest.v186ManifestSha256, 'V202_V186_MANIFEST_CHANGED');
    const v185 = JSON.parse(v185Text);
    const v186 = JSON.parse(v186Text);
    assert.equal(v185.freezeId, 'V185_METRICS_RADAR_READONLY_20260918');
    assert.equal(v186.freezeId, 'EC_V185_CANONICAL_SUCCESSOR_V186_20260918');
    assert.equal(v185.policy.analyticsReadOnly, true);
    assert.equal(v185.policy.metaMutationCount, 0);
    assert.equal(v185.protectedFiles[PAGE], manifest.currentPageSha256);
    assert.equal(v186.protectedFiles[PAGE], manifest.currentPageSha256);

    const page = read(PAGE);
    assert.equal(sha256(page), manifest.currentPageSha256, 'V202_CURRENT_PAGE_HASH_INVALID');
    const pageText = page.toString('utf8');
    assert.doesNotMatch(pageText, /Dados insuficientes ou desatualizados/);
    assert.match(pageText, /Amostra insuficiente para sugerir verba/);
    assert.match(pageText, /radar\.state === 'READY'/);
    assert.match(pageText, /Leitura analítica somente/);
    assert.doesNotMatch(pageText, /Recomendação IA/);

    for (const [relative, expected] of Object.entries(manifest.protectedFiles)) {
        assert.equal(sha256(read(relative)), expected, `V202_PROTECTED_FILE_INVALID:${relative}`);
    }
    return { historicalV141Preserved: true, currentContract: manifest.currentContract, pageHash: manifest.currentPageSha256 };
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    assertRepurchaseV141V185GovernanceV202();
    console.log('V202_GOVERNANCE_GUARD=PASS');
}
