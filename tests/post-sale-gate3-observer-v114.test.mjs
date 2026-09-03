import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(file, 'utf8');

test('V114 separa o observador read-only do gatilho transacional V112 run', () => {
    const helper = read('ops/post-sale-next-eligible-v114');
    const service = read('ops/systemd/vitalismen-postsale-next-eligible-v114.service');

    assert.match(service, /ExecStart=.*post-sale-next-eligible-v114 observe/);
    assert.doesNotMatch(service, /post-sale-next-eligible-v11[23] run/);
    assert.match(helper, /post-sale-next-eligible-v112" check "\$release"/);
    assert.match(helper, /TRANSACTIONAL_SCHEDULER=OFF_PENDING_GATE3/);
    assert.match(helper, /PROVIDER_CALLS_ALLOWED=0/);
    assert.match(helper, /MONGO_MUTATIONS_ALLOWED=0/);
    assert.match(helper, /PERMIT_CONSUMPTION_ALLOWED=0/);
    assert.doesNotMatch(helper, /post-sale-v105|batch-run|authorize|activate|mv -T|permit\.triggered/);
});

test('V114 reutiliza somente a varredura V112 protegida por interlocks read-only', () => {
    const helper = read('ops/post-sale-next-eligible-v114');
    const monitor = read('scripts/post-sale-next-eligible-monitor-v112.mjs');
    const detector = read('src/services/postSaleNextEligibleMonitorV112Service.js');

    assert.match(helper, /post-sale-next-eligible-source-compat-v113\.mjs/);
    assert.match(monitor, /installStrictReadOnlyMongooseGuard/);
    assert.match(monitor, /POSTSALE_V112_READ_ONLY_PROVIDER_INTERLOCK/);
    assert.match(detector, /acquireLock: false/);
    assert.doesNotMatch(monitor, /sendZapi|sendText|sendImage|sendAudio/);
});

test('timer V114 conserva intervalo de cinco minutos e aponta apenas para o observer', () => {
    const timer = read('ops/systemd/vitalismen-postsale-next-eligible-v114.timer');

    assert.match(timer, /OnUnitActiveSec=5min/);
    assert.match(timer, /Unit=vitalismen-postsale-next-eligible-v114\.service/);
    assert.doesNotMatch(timer, /vitalismen-postsale-next-eligible-v11[23]\.service/);
});
