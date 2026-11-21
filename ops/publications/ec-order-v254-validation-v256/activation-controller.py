#!/usr/bin/env python3
"""Ativação escopada do schema EC V256, com retorno ao V255 em falha."""
import datetime
import hashlib
import json
import os
import pathlib
import subprocess
import time
import urllib.parse
import urllib.request
import uuid

ROOT = pathlib.Path('/opt/vitalismen-automacao')
CURRENT = ROOT / 'current'
STATE = pathlib.Path('/var/lib/vitalismen-deploy/ec-order-v254-validation-v256-r1')
APPROVAL = STATE / 'approval.json'
ACTIVATION = STATE / 'activation.json'
EXPECTED_PARENT = pathlib.Path('/opt/vitalismen-automacao/releases/20261121T031500Z_production-20261121-02dccb3')
EXPECTED_NEW = pathlib.Path('/opt/vitalismen-automacao/releases/20261121T172300Z_production-20261121-d6a815d')
COMMIT = 'd6a815da7166d54e365a31131dac4a169f7a4964'
DROPIN = pathlib.Path('/etc/systemd/system/vitalismen-postsale-full-v203.service.d/' + 'z' * 180 + '-ec-order-v254-validation-v256.conf')

def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def digest(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()

def run(args, *, env=None, cwd=None, timeout=120):
    return subprocess.run(args, env=env, cwd=cwd, capture_output=True, text=True, timeout=timeout)

def pm2():
    response = run(['pm2', 'jlist'], env={**os.environ, 'NODE_OPTIONS': '', 'npm_config_node_options': ''}, timeout=15)
    assert response.returncode == 0, 'PM2_LIST_FAILED'
    rows = [item for item in json.loads(response.stdout) if item.get('name') == 'vitalismen-automation']
    assert len(rows) == 1, 'PM2_TARGET_COUNT_INVALID'
    return rows[0]

def process_env(pid):
    raw = pathlib.Path(f'/proc/{pid}/environ').read_bytes().split(b'\0')
    return {key.decode(): val.decode(errors='surrogateescape') for entry in raw if b'=' in entry
            for key, val in [entry.split(b'=', 1)]}

def health():
    with urllib.request.urlopen('http://127.0.0.1:3001/api/health', timeout=5) as response:
        assert response.status == 200
        return json.load(response)

def agency_search(term):
    url = 'http://127.0.0.1:3001/api/shipments/servientrega/ec/agencies?' + urllib.parse.urlencode(
        {'city': 'Ambato', 'q': term, 'limit': '10'})
    with urllib.request.urlopen(url, timeout=5) as response:
        assert response.status == 200
        return json.load(response)

def atomic_json(path, data):
    temporary = path.with_name(path.name + '.v256-' + uuid.uuid4().hex)
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    os.chmod(temporary, 0o400)
    os.replace(temporary, path)

def switch(release):
    temporary = CURRENT.with_name('current.v256-' + uuid.uuid4().hex)
    os.symlink(release, temporary)
    os.replace(temporary, CURRENT)

def restart(release, desired):
    options = desired['NODE_OPTIONS']
    invocation = {**desired, 'NODE_OPTIONS': '', 'npm_config_node_options': '', 'NPM_CONFIG_NODE_OPTIONS': '',
                  'HOME': '/root', 'PM2_HOME': '/root/.pm2'}
    for key in ('NODE_CHANNEL_FD', 'NODE_CHANNEL_SERIALIZATION_MODE', 'NODE_UNIQUE_ID',
                'PM2_PROGRAMMATIC', 'PM2_JSON_PROCESSING'):
        invocation.pop(key, None)
    helper = release / 'scripts/lib/pm2-target-env-restart-v78-r4.mjs'
    response = run(['node', str(helper), '/usr/lib/node_modules/pm2', 'vitalismen-automation', options, str(release)],
                   env=invocation, timeout=100)
    assert response.returncode == 0, 'PM2_RESTART_FAILED:' + (response.stderr or response.stdout)[-400:]

def wait_for(release, old_pid):
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            app = pm2()
            if (app['pid'] != old_pid and app['pm2_env']['status'] == 'online'
                and pathlib.Path(f"/proc/{app['pid']}/cwd").resolve() == release
                and pathlib.Path(app['pm2_env']['pm_cwd']).resolve() == release
                and pathlib.Path(app['pm2_env']['pm_exec_path']).resolve() == release / 'src/index.js'
                and health().get('status') == 'online'):
                return app
        except Exception:
            pass
        time.sleep(0.5)
    raise RuntimeError('ACTIVATION_HEALTH_TIMEOUT')

def main():
    approval = json.loads(APPROVAL.read_text())
    assert approval['commit'] == COMMIT and approval['release'] == str(EXPECTED_NEW)
    assert approval['parentRelease'] == str(EXPECTED_PARENT)
    assert CURRENT.resolve() == EXPECTED_PARENT, 'PARENT_RELEASE_CHANGED'
    assert json.loads(ACTIVATION.read_text())['state'] == 'PREPARED'
    assert len(approval['hashes']) == 3
    assert all(digest(EXPECTED_NEW / name) == value for name, value in approval['hashes'].items())
    assert digest(EXPECTED_NEW / '.release-source.json') == approval['sourceMetadataSha256']
    assert digest('/usr/local/lib/vitalismen-deploy/ec-order-v254-validation-sealed-v256-r1.mjs') == approval['engineSha256']
    assert digest('/usr/local/lib/vitalismen-deploy/ec-order-v254-validation-profile-v256-r1.mjs') == approval['helperSha256']
    source = run(['git', 'ls-remote', '--heads', 'origin', approval['sourceRef']],
                 env={**os.environ, 'NODE_OPTIONS': ''}, cwd=EXPECTED_NEW, timeout=20)
    assert source.returncode == 0 and source.stdout.split()[0] == COMMIT, 'SOURCE_REF_DRIFT'
    app_before = pm2()
    assert app_before['pm2_env']['status'] == 'online'
    assert pathlib.Path(f"/proc/{app_before['pid']}/cwd").resolve() == EXPECTED_PARENT
    h = health()
    assert h.get('status') == 'online' and h.get('bot_inbound_queue', {}).get('pendingTasks') == 0
    timer = run(['systemctl', 'is-active', 'vitalismen-postsale-full-v203.timer'])
    service = run(['systemctl', 'show', 'vitalismen-postsale-full-v203.service', '-p', 'MainPID', '--value'])
    assert timer.stdout.strip() == 'active' and service.stdout.strip() == '0', 'POSTSALE_NOT_IDLE'
    original = process_env(app_before['pid'])
    assert original.get('NODE_OPTIONS') == approval['profiles']['botLive']['NODE_OPTIONS']
    desired = {**original, **approval['profiles']['botLive']}
    activation_before = json.loads(ACTIVATION.read_text())
    if os.environ.get('V256_PREFLIGHT_ONLY') == '1':
        print(json.dumps({'status': 'PASS_PREFLIGHT_V256', 'commit': COMMIT,
                          'parentPid': app_before['pid'], 'inboundPending': 0,
                          'postSaleTimer': 'active'}))
        return
    switched = False
    dropin_installed = False
    timer_stopped = False
    try:
        stopped = run(['systemctl', 'stop', 'vitalismen-postsale-full-v203.timer'], timeout=20)
        assert stopped.returncode == 0, 'POSTSALE_TIMER_STOP_FAILED'
        timer_stopped = True
        active = {**activation_before, 'state': 'ACTIVE', 'runtimeAllowed': True, 'postSaleApproved': True, 'activatedAt': stamp()}
        atomic_json(ACTIVATION, active)
        switch(EXPECTED_NEW)
        switched = True
        restart(EXPECTED_NEW, desired)
        app_after = wait_for(EXPECTED_NEW, app_before['pid'])
        assert app_after['pm2_env']['restart_time'] == app_before['pm2_env']['restart_time'] + 1
        for key, value in approval['profiles']['botLive'].items():
            assert app_after['pm2_env'].get(key) == value, 'PROFILE_DRIFT:' + key
        probe = run(['node', '--input-type=module', '-e',
            "import Order from './src/models/Order.js'; const o=new Order({country:'EC',currency:'USD',customer:{name:'Cliente Exemplo',phone:'+593900000001'},dropiDispatchV252:{version:254,status:'review',reason:'awaiting_customer_data_v254',attempts:0}}); await o.validate(); console.log('ORDER_V254_SCHEMA_PASS');"],
            env={**os.environ, 'NODE_OPTIONS': '', 'npm_config_node_options': '',
                 'NPM_CONFIG_NODE_OPTIONS': ''}, cwd=EXPECTED_NEW, timeout=20)
        assert probe.returncode == 0 and 'ORDER_V254_SCHEMA_PASS' in probe.stdout, (
            'ORDER_SCHEMA_PROBE_FAILED:' + str(probe.returncode) + ':'
            + probe.stdout[-300:] + ':' + probe.stderr[-300:])
        source = STATE / 'post-sale-v256.conf'
        assert not DROPIN.exists(), 'POSTSALE_DROPIN_EXISTS'
        assert digest(STATE / 'post-sale-controller.py') == (STATE / 'post-sale-controller.sha256').read_text().strip()
        DROPIN.write_bytes(source.read_bytes())
        os.chmod(DROPIN, 0o644)
        dropin_installed = True
        reload = run(['systemctl', 'daemon-reload'], timeout=20)
        assert reload.returncode == 0, 'POSTSALE_RELOAD_FAILED'
        timer_start = run(['systemctl', 'start', 'vitalismen-postsale-full-v203.timer'], timeout=20)
        assert timer_start.returncode == 0, 'POSTSALE_TIMER_START_FAILED'
        timer_stopped = False
        assert run(['systemctl', 'is-active', 'vitalismen-postsale-full-v203.timer']).stdout.strip() == 'active'
        dry = run(['python3','-I','-B','-S',str(STATE/'post-sale-controller.py'),'dry-run'],
                  env={**os.environ,'HOME':'/root','PM2_HOME':'/root/.pm2','NODE_OPTIONS':''}, timeout=330)
        assert dry.returncode == 0, 'POSTSALE_DRY_RUN_FAILED:' + (dry.stderr or dry.stdout)[-300:]
        save = run(['pm2', 'save'], env={**os.environ, 'NODE_OPTIONS': '', 'npm_config_node_options': ''}, timeout=20)
        assert save.returncode == 0, 'PM2_SAVE_FAILED'
        print(json.dumps({'status': 'PASS_ACTIVE_V256', 'commit': COMMIT,
                          'pidBefore': app_before['pid'], 'pidAfter': app_after['pid'],
                          'orderSchema': 'ORDER_V254_SCHEMA_PASS', 'health': 'online', 'postSaleTimer': 'active'}))
    except BaseException as error:
        if dropin_installed:
            DROPIN.unlink(missing_ok=True)
            run(['systemctl','daemon-reload'],timeout=20)
        if switched:
            switch(EXPECTED_PARENT)
        atomic_json(ACTIVATION, activation_before)
        rollback_error = None
        try:
            if switched and pm2()['pid'] != app_before['pid']:
                restart(EXPECTED_PARENT, original)
                wait_for(EXPECTED_PARENT, app_before['pid'])
        except BaseException as rollback:
            rollback_error = type(rollback).__name__ + ':' + str(rollback)[:300]
        if timer_stopped or dropin_installed:
            run(['systemctl','start','vitalismen-postsale-full-v203.timer'],timeout=20)
        print(json.dumps({'status': 'FAIL_RESTORED_V255' if rollback_error is None else 'FAIL_ROLLBACK_NEEDS_OPERATOR',
                          'reason': type(error).__name__ + ':' + str(error)[:400],
                          'rollbackError': rollback_error}))
        raise

if __name__ == '__main__':
    main()
