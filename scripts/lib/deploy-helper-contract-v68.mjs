import assert from 'node:assert/strict';

export const expectedRunProtectedLabelsV68 = Object.freeze([
    'clone',
    'fetch_tag',
    'npm_ci',
    'post_sale_data_compatibility_v66',
    'runtime_guard_chain_v68',
    'predeploy_v68',
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

const lineAt = (source, index) => source.slice(0, index).split('\n').length;

export function locateRunProtectedDefinition(source) {
    const definitions = [...source.matchAll(/^run_protected\(\)\s*\{/gm)];
    if (definitions.length !== 1) {
        return {
            definitions: definitions.length,
            definitionLine: definitions[0] ? lineAt(source, definitions[0].index) : null,
            definitionBody: ''
        };
    }

    const definition = definitions[0];
    const tail = source.slice(definition.index + definition[0].length);
    const closing = /^\}/m.exec(tail);
    assert.ok(closing, 'run_protected não possui fechamento de função identificável');
    const end = definition.index + definition[0].length + closing.index + closing[0].length;
    return {
        definitions: 1,
        definitionLine: lineAt(source, definition.index),
        definitionStart: definition.index,
        definitionEnd: end,
        definitionBody: source.slice(definition.index, end)
    };
}

export function analyzeRunProtectedContract(source) {
    const definition = locateRunProtectedDefinition(source);
    const calls = [...source.matchAll(/^run_protected\s+([^\s\\]+)/gm)].map((match) => ({
        label: match[1],
        line: lineAt(source, match.index)
    }));
    return {
        ...definition,
        calls,
        callCount: calls.length,
        firstCallLine: calls[0]?.line ?? null
    };
}

export function assertRunProtectedContract(
    source,
    { expectedLabels = expectedRunProtectedLabelsV68 } = {}
) {
    const contract = analyzeRunProtectedContract(source);
    assert.equal(contract.definitions, 1, 'run_protected definitions deve ser exatamente 1');
    assert.ok(contract.callCount >= 1, 'run_protected precisa possuir chamadas protegidas');
    assert.ok(
        contract.definitionLine < contract.firstCallLine,
        'run_protected deve ser definida antes da primeira chamada'
    );
    assert.deepEqual(
        contract.calls.map(({ label }) => label),
        [...expectedLabels],
        'sites protegidos ou ordem das operações divergentes'
    );

    const body = contract.definitionBody;
    assert.match(body, /\[\[ "\$#" -ge 2 \]\]/, 'contrato LABEL + COMMAND ausente');
    assert.match(body, /\[\[ -n "\$raw_label" \]\]/, 'rejeição de label vazio ausente');
    assert.match(body, /command -v "\$executable"/, 'validação de comando no PATH ausente');
    assert.match(body, /-f "\$executable" && -x "\$executable"/, 'validação de binário executável ausente');
    assert.match(body, /if "\$@" >"\$output_file" 2>&1; then/, 'argumentos não são executados como array Bash');
    assert.match(body, /return "\$exit_status"/, 'status de falha não é preservado');
    assert.match(body, /vitalismen-stage-operations\.jsonl/, 'audit log sanitizado ausente');
    assert.match(body, /startedAt/, 'timestamp inicial não auditado');
    assert.match(body, /finishedAt/, 'timestamp final não auditado');
    assert.match(body, /exitStatus/, 'exit status não auditado');
    assert.doesNotMatch(body, /\beval\b/, 'eval proibido em run_protected');
    assert.doesNotMatch(body, /\b(?:ba)?sh\s+-c\b/, 'reconstrução de shell proibida em run_protected');
    assert.doesNotMatch(body, /set\s+\+e/, 'run_protected não pode desabilitar fail-closed');

    return contract;
}

export function removeRunProtectedDefinition(source) {
    const contract = analyzeRunProtectedContract(source);
    assert.equal(contract.definitions, 1, 'fixture exige uma definição de run_protected');
    return `${source.slice(0, contract.definitionStart)}${source.slice(contract.definitionEnd).replace(/^\r?\n/, '')}`;
}
