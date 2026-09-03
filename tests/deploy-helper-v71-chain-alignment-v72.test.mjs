import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    assertDeployHelperV71ChainAlignmentContractV72,
    assertFullSyntheticFlowV72,
    assertVersionEnvelopeV72,
    classifyHelperV70ReferencesV72
} from '../scripts/lib/deploy-helper-v71-chain-alignment-contract-v72.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperSource = fs.readFileSync(path.join(root, 'ops', 'vitalismen-stage'), 'utf8');
const commit = 'a'.repeat(40);
const tree = 'b'.repeat(40);
const sourceRef = 'refs/heads/codex/candidate-v72';

const strictEnvelope = (overrides = {}) => ({
    deployHelperContractVersion: 72,
    guardChainVersion: 71,
    runtimeGuardChainValidated: 71,
    predeployValidated: 'v71',
    dataCompatibilityVersion: 66,
    strictReadOnly: true,
    safeObservationPolicy: 'STRICT_READ_ONLY',
    allowedWriteClasses: [],
    ...overrides
});

const fullFlow = () => ({
    releaseSource: strictEnvelope({
        freezeVersion: 72,
        sha256: '1'.repeat(64),
        functionalCommit: commit,
        functionalTree: tree,
        sourceRef
    }),
    stagingComplete: strictEnvelope({
        freezeVersion: 72,
        sha256: '2'.repeat(64),
        releaseMetadataSha256: '1'.repeat(64),
        functionalCommit: commit,
        functionalTree: tree,
        sourceRef
    }),
    publication: strictEnvelope({
        sha256: '3'.repeat(64),
        stagingCompleteSha256: '2'.repeat(64),
        publicationTagResolvedCommit: commit
    }),
    publishedPreflight: strictEnvelope({
        freezeVersion: 72,
        publicationMetadataSha256: '3'.repeat(64)
    })
});

test('helper V72 declara runtime V71 sem contrato V70 ativo', () => {
    const contract = assertDeployHelperV71ChainAlignmentContractV72(helperSource);
    assert.equal(contract.callCount, 18);
    assert.deepEqual(contract.staleActive, []);
    assert.ok(contract.historicalReferences.length > 0);
    assert.deepEqual(
        classifyHelperV70ReferencesV72(helperSource)
            .filter(({ classification }) => classification === 'ACTIVE_FORBIDDEN'),
        []
    );
});

test('helper fixture com runtime/guardChainVersion 70 falha fechado', () => {
    const wrongRuntime = helperSource.replace(
        'runtime_guard_chain_version=71',
        'runtime_guard_chain_version=70'
    );
    assert.throws(
        () => assertDeployHelperV71ChainAlignmentContractV72(wrongRuntime),
        /runtime guard chain 71 ausente|referências V70 ativas/
    );

    const wrongEmission = helperSource.replace(
        '"guardChainVersion": $runtime_guard_chain_version',
        '"guardChainVersion": 70'
    );
    assert.throws(
        () => assertDeployHelperV71ChainAlignmentContractV72(wrongEmission),
        /stage não materializa guard chain 71|referências V70 ativas/
    );
});

test('helper fixture chamando predeploy-v70 falha fechado', () => {
    const wrongPredeploy = helperSource.replace(
        '"$npm_cmd" run guard:predeploy-v71',
        '"$npm_cmd" run guard:predeploy-v70'
    );
    assert.throws(
        () => assertDeployHelperV71ChainAlignmentContractV72(wrongPredeploy),
        /stage não executa predeploy-v71|guard:predeploy-v70/
    );
});

test('release-source ou staging-complete com 70 falha fechado, inclusive versões mistas', () => {
    const releaseSource70 = strictEnvelope({ freezeVersion: 72, guardChainVersion: 70 });
    const staging70 = strictEnvelope({ freezeVersion: 72, guardChainVersion: 70 });
    assert.throws(
        () => assertVersionEnvelopeV72(releaseSource70, { label: 'release-source', requireFreeze: true }),
        /release-source: guardChainVersion divergente/
    );
    assert.throws(
        () => assertVersionEnvelopeV72(staging70, { label: 'staging-complete', requireFreeze: true }),
        /staging-complete: guardChainVersion divergente/
    );

    const leftMixed = fullFlow();
    leftMixed.stagingComplete.guardChainVersion = 70;
    assert.throws(() => assertFullSyntheticFlowV72(leftMixed), /staging-complete: guardChainVersion divergente/);

    const rightMixed = fullFlow();
    rightMixed.releaseSource.guardChainVersion = 70;
    assert.throws(() => assertFullSyntheticFlowV72(rightMixed), /release-source: guardChainVersion divergente/);
});

test('publication e preflight com 70 falham fechados', () => {
    const wrongPublication = fullFlow();
    wrongPublication.publication.runtimeGuardChainValidated = 70;
    assert.throws(
        () => assertFullSyntheticFlowV72(wrongPublication),
        /publication: runtimeGuardChainValidated divergente/
    );

    const wrongPreflight = fullFlow();
    wrongPreflight.publishedPreflight.guardChainVersion = 70;
    assert.throws(
        () => assertFullSyntheticFlowV72(wrongPreflight),
        /published-preflight: guardChainVersion divergente/
    );
});

test('fluxo sintético integral V72/V71/V66 passa com hashes e identidade vinculados', () => {
    assert.equal(assertFullSyntheticFlowV72(fullFlow()), true);
});
