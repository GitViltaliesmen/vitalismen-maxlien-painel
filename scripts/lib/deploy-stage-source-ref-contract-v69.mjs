import assert from 'node:assert/strict';
import { assertRunProtectedContract } from './deploy-helper-contract-v68.mjs';

export const expectedRunProtectedLabelsV69 = Object.freeze([
    'init_repository',
    'fetch_authorized_source',
    'checkout_approved_commit',
    'npm_ci',
    'post_sale_data_compatibility_v66',
    'runtime_guard_chain_v69',
    'predeploy_v69',
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

export function assertRunProtectedContractV69(source) {
    const contract = assertRunProtectedContract(source, {
        expectedLabels: expectedRunProtectedLabelsV69
    });

    assert.match(
        source,
        /stage SOURCE_REF EXPECTED_COMMIT EXPECTED_TREE RELEASE/,
        'CLI V69 não exige identidade completa da candidata'
    );
    assert.match(source, /VITALISMEN_STAGE_AUTHORIZED_SOURCE_REF/, 'autorização exata da ref ausente');
    assert.match(
        source,
        /"\$requested_ref" == "\$authorized_ref"/,
        'source ref não é comparada com a autorização exata'
    );
    assert.match(
        source,
        /\^refs\/heads\/codex\//,
        'namespace fechado refs/heads/codex ausente'
    );
    assert.match(source, /check-ref-format/, 'validação nativa de ref Git ausente');
    assert.match(
        source,
        /fetch --no-tags --force "\$repo_url" "\$\{source_ref\}:\$\{fetched_ref\}"/,
        'fetch exato sem tags ausente'
    );
    assert.match(source, /rev-parse "\$\{fetched_ref\}\^\{commit\}"/, 'resolução do objeto fetched ausente');
    assert.match(source, /checkout --detach --force "\$resolved_source_commit"/, 'checkout detached do commit exato ausente');
    assert.match(source, /rev-parse "HEAD\^\{tree\}"/, 'verificação do tree funcional ausente');
    assert.match(source, /remote_production_head/, 'fotografia de origin\/production ausente');
    assert.match(
        source,
        /"\$production_branch_after" == "\$production_branch_before"/,
        'comparação before/after de production ausente'
    );
    assert.match(source, /"sourceRef": "\$source_ref"/, 'metadata sourceRef ausente');
    assert.match(source, /"functionalCommit": "\$expected_commit"/, 'metadata functionalCommit ausente');
    assert.match(source, /"functionalTree": "\$functional_tree"/, 'metadata functionalTree ausente');
    assert.match(source, /"productionBranchChanged": false/, 'metadata de preservação de production ausente');
    assert.match(source, /"productionTagRequiredForStaging": false/, 'separação de tag de produção ausente');
    assert.doesNotMatch(
        source.slice(source.indexOf('[[ "$action" == "stage" ]]')),
        /clone --single-branch --branch production|fetch_tag/,
        'contrato legado production/tag reapareceu no stage V69'
    );

    return contract;
}
