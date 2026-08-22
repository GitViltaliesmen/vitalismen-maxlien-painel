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

test('guard sucessor V36 e a unica entrada ativa da cadeia', () => {
    const index = read('src/index.js');
    assert.match(index, /ecAllProductsIngredientsFreezeRuntimeGuardV36/);
    assert.doesNotMatch(index, /^import '.+(?:logisticsCleanChatFreezeRuntimeGuardV29|FreezeRuntimeGuardV(?:17|18|19|20|21|22|23|24|25|26|27|28))\.js';/m);
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

test('workflow Node 20 e 22 preserva V21/V22 e protege os arquivos V23', () => {
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
        'docs/freeze/panel-call-dropi-safety-v21-20260817.json',
        'src/routes/whatsapp.js',
        'src/services/panelReadStateService.js',
        'src/services/texUltraEntryGreetingService.js',
        'src/services/texUltraEntryUnreadFreezeRuntimeGuardV22.js',
        'scripts/guard-tex-ultra-entry-unread-v22.mjs',
        'tests/tex-ultra-entry-unread-v22.test.mjs',
        'tests/whatsapp-chat-read-persistence-v22.test.mjs',
        'docs/freeze/tex-ultra-entry-unread-v22-20260818.json',
        'src/services/ecAnaIdentityFreezeRuntimeGuardV23.js',
        'scripts/guard-ec-ana-identity-v23.mjs',
        'tests/ec-ana-identity-v23.test.mjs',
        'docs/freeze/ec-ana-identity-v23-20260818.json',
        'src/services/buyLaterDateReminderFreezeRuntimeGuardV24.js',
        'scripts/guard-buy-later-date-reminder-v24.mjs',
        'tests/buy-later-date-reminder-v24.test.mjs',
        'docs/freeze/buy-later-date-reminder-v24-20260818.json',
        'src/services/texUltraEntryInterruptFreezeRuntimeGuardV25.js',
        'scripts/guard-tex-ultra-entry-interrupt-v25.mjs',
        'tests/tex-ultra-entry-interrupt-v25.test.mjs',
        'docs/freeze/tex-ultra-entry-interrupt-v25-20260818.json',
        'src/services/texUltraStrongIntentFreezeRuntimeGuardV26.js',
        'scripts/guard-tex-ultra-strong-intent-v26.mjs',
        'tests/tex-ultra-strong-intent-v26.test.mjs',
        'docs/freeze/tex-ultra-strong-intent-v26-20260818.json',
        'src/services/texUltraVslPayloadFreezeRuntimeGuardV27.js',
        'scripts/guard-tex-ultra-vsl-payload-v27.mjs',
        'tests/tex-ultra-vsl-payload-v27.test.mjs',
        'docs/freeze/tex-ultra-vsl-payload-v27-20260818.json',
        'src/services/customerDataResolutionFreezeRuntimeGuardV28.js',
        'scripts/guard-customer-data-resolution-v28.mjs',
        'tests/customer-data-resolution-v28.test.mjs',
        'docs/freeze/customer-data-resolution-v28-20260818.json'
    ]) {
        const occurrences = workflow.split(relativePath).length - 1;
        assert.ok(occurrences >= 3, `${relativePath} deve disparar PR, push e ser conferido pelo workflow`);
    }
});
