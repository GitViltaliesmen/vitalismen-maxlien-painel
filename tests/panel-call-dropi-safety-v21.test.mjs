import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('V21 sucede V20 sem publicar ou alterar producao', () => {
    const manifest = JSON.parse(read('docs/freeze/panel-call-dropi-safety-v21-20260817.json'));
    assert.equal(manifest.freezeId, 'panel-call-dropi-safety-v21-20260817');
    assert.equal(manifest.parentFreezeId, 'order-public-product-integrity-v20-20260817');
    assert.equal(manifest.publicationStatus, 'candidate_not_published');
    assert.equal(manifest.policy.productionChanged, false);
    assert.equal(manifest.policy.callAutoReplyDefaultEnabled, false);
    assert.equal(manifest.policy.dropiManualAuthorizationRequired, true);
    assert.equal(manifest.policy.pricesChanged, false);
});

test('guard de startup V21 e a unica entrada ativa da cadeia', () => {
    const index = read('src/index.js');
    assert.match(index, /panelCallDropiSafetyFreezeRuntimeGuardV21/);
    assert.doesNotMatch(index, /^import '.+FreezeRuntimeGuardV(?:17|18|19|20)\.js';/m);
});

test('politica operacional de chamada permanece desligada no exemplo', () => {
    const envExample = read('.env.example');
    assert.match(envExample, /^WHATSAPP_AUTO_REJECT_CALLS=false$/m);
    assert.match(envExample, /^WHATSAPP_CALL_AUTO_REPLY_ENABLED=false$/m);
    assert.match(envExample, /^WHATSAPP_CALL_CONTINUATION_MINUTES=15$/m);
});

test('nenhum envio Dropi perdeu a autorizacao humana existente', () => {
    const panel = read('public/qr.html');
    const routes = read('src/routes/shipments.js');
    assert.match(panel, /Confirmar envio deste pedido para a Dropi/);
    assert.match(routes, /dropiSubmitAuthorizedAt/);
    assert.match(routes, /authorizationRequired/);
});

test('workflow Node 20 e 22 protege e confere os arquivos V21', () => {
    const workflow = read('.github/workflows/ec-panel-quality.yml');
    assert.match(workflow, /matrix:[\s\S]*?node: \['20', '22'\]/);
    for (const relativePath of [
        'src/models/CallAutoReplyState.js',
        'src/routes/zapi.js',
        'src/services/callAutoReplySafetyService.js',
        'src/services/droppiEcuadorService.js',
        'src/services/panelCallDropiSafetyFreezeRuntimeGuardV21.js',
        'src/whatsapp/connection.js',
        'scripts/guard-panel-call-dropi-safety-v21.mjs',
        'tests/panel-call-dropi-safety.test.mjs',
        'tests/panel-call-dropi-safety-v21.test.mjs',
        'docs/freeze/panel-call-dropi-safety-v21-20260817.json'
    ]) {
        const occurrences = workflow.split(relativePath).length - 1;
        assert.ok(occurrences >= 3, `${relativePath} deve disparar PR, push e ser conferido pelo workflow`);
    }
});
