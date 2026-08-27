import assert from 'node:assert/strict';
import {
    assertRunProtectedContractV69,
    expectedRunProtectedLabelsV69
} from './deploy-stage-source-ref-contract-v69.mjs';

export const expectedRunProtectedLabelsV70 = expectedRunProtectedLabelsV69;

export function assertPublicationAttestationContractV70(source) {
    const contract = assertRunProtectedContractV69(source);

    assert.match(
        source,
        /v70-publish RELEASE SOURCE_REF EXPECTED_COMMIT EXPECTED_TREE EXPECTED_TAG/,
        'CLI de publicação V70 não exige identidade completa'
    );
    assert.match(source, /VITALISMEN_PUBLISH_AUTHORIZED_SOURCE_REF/, 'autorização exata da ref de publicação ausente');
    assert.match(source, /VITALISMEN_PUBLISH_AUTHORIZED_TAG/, 'autorização exata da tag de publicação ausente');
    assert.match(source, /\^production-\[0-9\]\{8\}-\[0-9a-f\]\{7\}\$/, 'formato fechado da tag de produção ausente');
    assert.match(source, /remote_required_production_tag_commit/, 'verificação obrigatória da tag remota ausente');
    assert.match(source, /git_cmd" ls-remote --tags/, 'leitura da tag no remoto real ausente');
    assert.match(source, /publication_metadata_name="\.release-publication\.json"/, 'metadata de publicação separada ausente');
    assert.match(source, /publication_complete_name="\.publication-complete\.json"/, 'attestation final separada ausente');
    assert.match(source, /validPublicationStatuses = new Set\(\['staged_candidate', 'production_published'\]\)/, 'enum fechado de publicação ausente');
    assert.match(source, /publicationStatus desconhecido/, 'estado de publicação desconhecido não falha fechado');
    assert.match(source, /release-source deve permanecer staged_candidate/, 'identidade staged imutável ausente');
    assert.match(source, /"guardChainVersion": 70/, 'guardChainVersion 70 não nasce no staging');
    assert.match(source, /"dataCompatibilityVersion": 66/, 'dataCompatibilityVersion 66 não nasce no staging');
    assert.match(source, /releaseMetadataSha256/, 'hash da release-source não está atestado');
    assert.match(source, /stagingCompleteSha256/, 'hash do staging-complete não está atestado');
    assert.match(source, /publicationMetadataSha256/, 'hash da metadata publicada não está atestado');
    assert.match(source, /safeOverlaySha256/, 'hash do overlay safe não está atestado');
    assert.match(source, /functionalPayloadSha256/, 'fingerprint funcional não está atestado');
    assert.match(source, /baseEnvSha256/, 'hash do .env não está atestado');
    assert.match(source, /nodeModulesSha256/, 'fingerprint de node_modules não está atestado');
    assert.match(source, /STAGED_PREFLIGHT_INVALIDATED=YES/, 'preflight staged não é invalidado');
    assert.match(source, /NEW_PREFLIGHT_REQUIRED=YES/, 'novo preflight pós-publicação não é obrigatório');
    assert.match(source, /v70-activation-validate/, 'validação integral de ativação sem efeitos ausente');

    const publishStart = source.indexOf('if [[ "$action" == "v70-publish" ]]');
    const planStart = source.indexOf('if [[ "$action" == "v66-plan" ]]');
    assert.ok(publishStart >= 0 && planStart > publishStart, 'bloco v70-publish ausente');
    const publishBlock = source.slice(publishStart, planStart);
    assert.match(publishBlock, /productionBranchChanged: false/);
    assert.match(publishBlock, /pm2Actions: 0/);
    assert.match(publishBlock, /outboundActions: 0/);
    assert.match(publishBlock, /dropiActions: 0/);
    assert.match(publishBlock, /bridgeExecuted: false/);
    assert.match(publishBlock, /mutationsEnabled: false/);
    assert.doesNotMatch(publishBlock, /safe_pm2|pm2_cmd" (?:start|stop|restart|reload|resurrect|delete)/);
    assert.doesNotMatch(publishBlock, /update-ref refs\/heads\/production|push .*production|checkout .*production/);
    assert.doesNotMatch(publishBlock, /DROPPI_EC_ACTIVE_SYNC_MODE=APPLY|BRIDGE_APPLY_APPROVED=true/);
    assert.doesNotMatch(publishBlock, /sendText|sendImage|sendDocument|sendAudio/);

    const activateStart = source.indexOf('if [[ "$action" == "v66-activate-safe" ]]');
    const containStart = source.indexOf('if [[ "$action" == "v66-contain" ]]');
    assert.ok(activateStart >= 0 && containStart > activateStart, 'bloco de ativação ausente');
    const activateBlock = source.slice(activateStart, containStart);
    assert.match(activateBlock, /validate_activation_prerequisites_v70/);
    assert.ok(
        activateBlock.indexOf('validate_activation_prerequisites_v70')
            < activateBlock.indexOf('switch_current_v66 "$candidate_dir"'),
        'attestation/publicação/preflight/permit devem preceder o switch'
    );

    const stageStart = source.indexOf('[[ "$action" == "stage" ]]');
    assert.ok(stageStart >= 0, 'stage V70 ausente');
    const stageBlock = source.slice(stageStart);
    assert.match(stageBlock, /functional_payload_at_checkout/);
    assert.match(stageBlock, /release_metadata_sha_at_creation/);
    assert.match(stageBlock, /release_metadata_sha_after_gates/);
    assert.match(stageBlock, /functional_payload_after_gates/);
    assert.match(stageBlock, /prepare_safe_overlay "\$release_dir"/);
    assert.match(stageBlock, /guard:predeploy-v70/);
    assert.doesNotMatch(stageBlock, /remote_required_production_tag_commit/);

    return contract;
}
