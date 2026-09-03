import assert from 'node:assert/strict';
import { assertRunProtectedContract } from './deploy-helper-contract-v68.mjs';

export const FREEZE_VERSION_V72 = 72;
export const DEPLOY_HELPER_CONTRACT_VERSION_V72 = 72;
export const RUNTIME_GUARD_CHAIN_VERSION_V72 = 71;
export const DATA_COMPATIBILITY_VERSION_V72 = 66;
export const PREDEPLOY_VERSION_V72 = 'v71';

export const expectedRunProtectedLabelsV72 = Object.freeze([
    'init_repository',
    'fetch_authorized_source',
    'checkout_approved_commit',
    'npm_ci',
    'post_sale_data_compatibility_v66',
    'runtime_guard_chain_v71',
    'predeploy_v71',
    'post_sale_safety_guard_v66',
    'official_state_audit',
    'freeze_lock_pre',
    'senior_check',
    'product_micro_layer',
    'dropi_catalog',
    'pickup_notifications',
    'whatsapp_status_contacts',
    'operational_labels',
    'pickup_notification_tests',
    'freeze_lock'
]);

const assertStrictFields = (value, label) => {
    assert.equal(value?.strictReadOnly, true, `${label}: strictReadOnly divergente`);
    assert.equal(value?.safeObservationPolicy, 'STRICT_READ_ONLY', `${label}: safeObservationPolicy divergente`);
    assert.deepEqual(value?.allowedWriteClasses, [], `${label}: allowedWriteClasses divergente`);
};

export function assertVersionEnvelopeV72(value, {
    label = 'envelope',
    requireFreeze = false,
    requireDeployHelper = true,
    requirePredeploy = true
} = {}) {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label}: envelope ausente`);
    if (requireFreeze) assert.equal(Number(value.freezeVersion), FREEZE_VERSION_V72, `${label}: freezeVersion divergente`);
    if (requireDeployHelper) {
        assert.equal(
            Number(value.deployHelperContractVersion),
            DEPLOY_HELPER_CONTRACT_VERSION_V72,
            `${label}: deployHelperContractVersion divergente`
        );
    }
    assert.equal(
        Number(value.guardChainVersion),
        RUNTIME_GUARD_CHAIN_VERSION_V72,
        `${label}: guardChainVersion divergente`
    );
    assert.equal(
        Number(value.runtimeGuardChainValidated),
        RUNTIME_GUARD_CHAIN_VERSION_V72,
        `${label}: runtimeGuardChainValidated divergente`
    );
    if (requirePredeploy) {
        assert.equal(value.predeployValidated, PREDEPLOY_VERSION_V72, `${label}: predeployValidated divergente`);
    }
    assert.equal(
        Number(value.dataCompatibilityVersion),
        DATA_COMPATIBILITY_VERSION_V72,
        `${label}: dataCompatibilityVersion divergente`
    );
    assertStrictFields(value, label);
    return true;
}

export function assertFullSyntheticFlowV72({
    releaseSource,
    stagingComplete,
    publication,
    publishedPreflight
} = {}) {
    assertVersionEnvelopeV72(releaseSource, { label: 'release-source', requireFreeze: true });
    assertVersionEnvelopeV72(stagingComplete, { label: 'staging-complete', requireFreeze: true });
    assertVersionEnvelopeV72(publication, { label: 'publication' });
    assertVersionEnvelopeV72(publishedPreflight, { label: 'published-preflight', requireFreeze: true });
    assert.equal(stagingComplete.releaseMetadataSha256, releaseSource.sha256, 'hash release-source divergente');
    assert.equal(publication.stagingCompleteSha256, stagingComplete.sha256, 'hash staging-complete divergente');
    assert.equal(publishedPreflight.publicationMetadataSha256, publication.sha256, 'hash publication divergente');
    assert.equal(publication.publicationTagResolvedCommit, releaseSource.functionalCommit, 'tag target divergente');
    assert.equal(stagingComplete.functionalCommit, releaseSource.functionalCommit, 'commit do staging divergente');
    assert.equal(stagingComplete.functionalTree, releaseSource.functionalTree, 'tree do staging divergente');
    assert.equal(stagingComplete.sourceRef, releaseSource.sourceRef, 'sourceRef do staging divergente');
    return true;
}

export function classifyHelperV70ReferencesV72(source) {
    const lines = String(source || '').split(/\r?\n/);
    const historicalPatterns = [
        /v70-publish/,
        /v70-activation-validate/,
        /vitalismen-stage-v70-publication-audit/,
        /V70_PUBLICATION/,
        /V70_ACTIVATION_VALIDATION/
    ];
    const activeForbiddenPatterns = [
        /runtime_guard_chain_version=70/,
        /deploy_helper_contract_version=70/,
        /"guardChainVersion"\s*:\s*70/,
        /guard:predeploy-v70/,
        /run_protected\s+runtime_guard_chain_v(?:69|70)\b/,
        /run_protected\s+predeploy_v(?:69|70)\b/,
        /deployPublicationAttestationSafetyFreezeRuntimeGuardV70\.js/
    ];
    const occurrences = [];
    lines.forEach((line, index) => {
        if (!line.includes('70')) return;
        const classification = activeForbiddenPatterns.some((pattern) => pattern.test(line))
            ? 'ACTIVE_FORBIDDEN'
            : historicalPatterns.some((pattern) => pattern.test(line))
                ? 'HISTORICAL_ALLOWED'
                : 'NON_CONTRACT_NUMERIC';
        occurrences.push(Object.freeze({ line: index + 1, text: line.trim(), classification }));
    });
    return occurrences;
}

export function assertDeployHelperV71ChainAlignmentContractV72(source) {
    const contract = assertRunProtectedContract(source, { expectedLabels: expectedRunProtectedLabelsV72 });
    assert.match(source, /^freeze_version=72$/m, 'freeze version V72 ausente');
    assert.match(source, /^deploy_helper_contract_version=72$/m, 'deploy helper contract V72 ausente');
    assert.match(source, /^runtime_guard_chain_version=71$/m, 'runtime guard chain 71 ausente');
    assert.match(source, /^data_compatibility_version=66$/m, 'data compatibility 66 ausente');
    assert.match(source, /^runtime_predeploy_version="v71"$/m, 'predeploy v71 ausente');
    assert.match(source, /npm_cmd" run guard:runtime-chain-v71/, 'stage não valida runtime-chain-v71');
    assert.match(source, /npm_cmd" run guard:predeploy-v71/, 'stage não executa predeploy-v71');
    assert.match(source, /"freezeVersion": \$freeze_version/, 'release-source não materializa freeze V72');
    assert.ok((source.match(/"guardChainVersion": \$runtime_guard_chain_version/g) || []).length >= 2, 'stage não materializa guard chain 71 nos dois envelopes');
    assert.ok((source.match(/runtimeGuardChainValidated/g) || []).length >= 8, 'attestation runtime 71 incompleta');
    assert.ok((source.match(/predeployValidated/g) || []).length >= 8, 'attestation de predeploy v71 incompleta');
    assert.ok((source.match(/safeObservationPolicy/g) || []).length >= 8, 'política strict incompleta nos envelopes');
    assert.match(source, /versão da publicação divergente/, 'publish não valida versão');
    assert.match(source, /versão do preflight divergente/, 'preflight não valida versão');
    assert.match(source, /STAGE_ATTESTATION_VERSION=\$runtime_guard_chain_version/, 'activation não reporta stage 71');
    assert.match(source, /PUBLICATION_ATTESTATION_VERSION=\$runtime_guard_chain_version/, 'activation não reporta publication 71');
    assert.match(source, /PUBLISHED_PREFLIGHT_VERSION=\$runtime_guard_chain_version/, 'activation não reporta preflight 71');
    assert.match(source, /validPublicationStatuses = new Set\(\['staged_candidate', 'production_published'\]\)/, 'enum fechado V70 não preservado');
    assert.match(source, /remote_required_production_tag_commit/, 'verificação remota da tag não preservada');
    assert.match(source, /releaseMetadataSha256/, 'hash da metadata não preservado');
    assert.match(source, /publicationMetadataSha256/, 'envelope de publicação não preservado');
    assert.match(source, /marker expirado/, 'TTL do preflight não preservado');
    assert.match(source, /singleUse/, 'permit single-use não preservado');
    assert.match(source, /productionBranchChanged: false/, 'independência de production não preservada');
    assert.doesNotMatch(source, /^runtime_guard_chain_version=70$/m);
    assert.doesNotMatch(source, /"guardChainVersion"\s*:\s*70/);
    assert.doesNotMatch(source, /guard:predeploy-v70/);
    const staleActive = classifyHelperV70ReferencesV72(source)
        .filter((entry) => entry.classification === 'ACTIVE_FORBIDDEN');
    assert.deepEqual(staleActive, [], `referências V70 ativas: ${JSON.stringify(staleActive)}`);
    return Object.freeze({
        ...contract,
        staleActive,
        historicalReferences: classifyHelperV70ReferencesV72(source)
            .filter((entry) => entry.classification === 'HISTORICAL_ALLOWED')
    });
}
