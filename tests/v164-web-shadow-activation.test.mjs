import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('docs/freeze/ec-web-worker-shadow-activation-v164-20260915.json'));

test('V164 mantém current, bot principal e Z-API fora da ativação Web', () => {
    assert.equal(manifest.policy.currentChange, false);
    assert.equal(manifest.policy.pm2MainChange, false);
    assert.equal(manifest.policy.mainBotRestart, false);
    assert.equal(manifest.policy.zapiChange, false);
    assert.equal(manifest.policy.zapiShutdownAllowed, false);
    assert.equal(manifest.policy.zapiRemovalAllowed, false);
    assert.equal(manifest.policy.cutoverAllowed, false);
});

test('configuração V164 possui um único worker shadow e nenhum caminho de envio', () => {
    const ecosystemPath = new URL('../ops/ecosystem.v164-web-shadow.config.cjs', import.meta.url);
    const ecosystemFile = fileURLToPath(ecosystemPath);
    delete require.cache[ecosystemFile];
    const ecosystem = require(ecosystemFile);
    assert.equal(ecosystem.apps.length, 1);
    const app = ecosystem.apps[0];
    assert.equal(app.name, 'vitalismen-whatsapp-web-shadow-v164');
    assert.equal(app.exec_mode, 'fork');
    assert.equal(app.instances, 1);
    assert.equal(app.env.V152_E_SESSION_NAMESPACE, 'V152_TEST_WEB_01');
    assert.equal(app.env.V152_E_TEST_CHANNEL_PHONE, '5531983002800');
    const core = read('src/whatsapp/core/PersistentShadowWorkerV152ER4.js');
    const entrypoint = read('scripts/v152-e-r4-persistent-shadow-worker.mjs');
    assert.doesNotMatch(core, /sendMessage|requestPairingCode|setupDispatcher|models\/Order/i);
    assert.doesNotMatch(entrypoint, /sendMessage|requestPairingCode|QRCode|qrcode-terminal/i);
});
test('wrapper V164 limita ativação e rollback ao processo Web', () => {
    const wrapper = read('ops/web-shadow-v164');
    assert.match(wrapper, /V164_WEB_SHADOW_ACTIVATION_APPROVED/);
    assert.match(wrapper, /V164_WEB_SHADOW_RESTART_CHECK_APPROVED/);
    assert.match(wrapper, /CONFIRM_STOP_WEB_WORKER_ONLY_V164/);
    assert.match(wrapper, /pm2 start .*ecosystem\.v164-web-shadow\.config\.cjs/);
    assert.match(wrapper, /pm2 restart "\$process_web"/);
    assert.match(wrapper, /pm2 delete "\$process_web"/);
    assert.doesNotMatch(wrapper, /pm2 (?:restart|delete|stop) "\$process_main"/);
    assert.doesNotMatch(wrapper, /ln -s|current\.next|requestPairingCode|sendMessage/);
});

test('restart-check V164 exige PID novo e preserva o bot principal', () => {
    const wrapper = read('ops/web-shadow-v164');
    assert.match(wrapper, /SESSION_RESTORABLE_AFTER_RESTART=PASS/);
    assert.match(wrapper, /"\$pid" != "\$before_pid"/);
    assert.match(wrapper, /"\$restarts" -gt "\$before_restarts"/);
    assert.match(wrapper, /assert_main_unchanged "\$main_before" "\$current_before"/);
});

test('V164 prepara canário apenas para o telefone de QA autorizado', () => {
    assert.equal(manifest.policy.authorizedControlledTestPhone, '5515998038637');
    assert.equal(manifest.policy.customerRealRoutingAllowed, false);
    assert.equal(manifest.policy.webOutboundMessagesDuringActivation, 0);
    assert.equal(manifest.policy.doubleSendProtection, true);
    assert.equal(manifest.policy.outboundProviderExclusivity, true);
    assert.equal(manifest.policy.messageDedupe, true);
    assert.equal(manifest.policy.queueClaimExclusivity, true);
    assert.equal(manifest.policy.webWorkerRestartCheckSupported, true);
    assert.equal(manifest.policy.sessionRestorableAfterRestartRequired, true);
});
