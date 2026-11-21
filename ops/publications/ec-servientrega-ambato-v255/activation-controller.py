#!/usr/bin/env python3
"""Ativação escopada do catálogo EC V255, com retorno ao V254 em falha."""
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
STATE = pathlib.Path('/var/lib/vitalismen-deploy/ec-servientrega-ambato-v255-r1')
APPROVAL = STATE / 'approval.json'
ACTIVATION = STATE / 'activation.json'
EXPECTED_PARENT = pathlib.Path('/opt/vitalismen-automacao/releases/20261119T224814Z_production-20261119-05f23b1')
EXPECTED_NEW = pathlib.Path('/opt/vitalismen-automacao/releases/20261121T031500Z_production-20261121-02dccb3')
COMMIT = '02dccb3ea4604732c23aec1c82c8766789ceb4e6'
AGENCIES = ('Huachi Solis 1', 'La Atahualpa', 'Letamendi', 'Martinez', 'Mercado Sur', 'UTA')

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
    temporary = path.with_name(path.name + '.v255-' + uuid.uuid4().hex)
    temporary.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    os.chmod(temporary, 0o400)
    os.replace(temporary, path)

def switch(release):
    temporary = CURRENT.with_name('current.v255-' + uuid.uuid4().hex)
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
    assert digest('/usr/local/lib/vitalismen-deploy/ec-servientrega-ambato-sealed-v255-r1.mjs') == approval['engineSha256']
    assert digest('/usr/local/lib/vitalismen-deploy/ec-servientrega-ambato-profile-v255-r1.mjs') == approval['helperSha256']
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
    if os.environ.get('V255_PREFLIGHT_ONLY') == '1':
        print(json.dumps({'status': 'PASS_PREFLIGHT_V255', 'commit': COMMIT,
                          'parentPid': app_before['pid'], 'inboundPending': 0,
                          'postSaleTimer': 'active'}))
        return
    switched = False
    try:
        active = {**activation_before, 'state': 'ACTIVE', 'runtimeAllowed': True, 'activatedAt': stamp()}
        atomic_json(ACTIVATION, active)
        switch(EXPECTED_NEW)
        switched = True
        restart(EXPECTED_NEW, desired)
        app_after = wait_for(EXPECTED_NEW, app_before['pid'])
        assert app_after['pm2_env']['restart_time'] == app_before['pm2_env']['restart_time'] + 1
        for key, value in approval['profiles']['botLive'].items():
            assert app_after['pm2_env'].get(key) == value, 'PROFILE_DRIFT:' + key
        found = {}
        for name in AGENCIES:
            result = agency_search(name)
            assert result.get('success') is True
            matches = [entry for entry in result.get('agencies', [])
                       if name.casefold() in entry.get('name', '').casefold()]
            assert matches, 'AGENCY_NOT_VISIBLE:' + name
            found[name] = matches[0]['name']
        save = run(['pm2', 'save'], env={**os.environ, 'NODE_OPTIONS': '', 'npm_config_node_options': ''}, timeout=20)
        assert save.returncode == 0, 'PM2_SAVE_FAILED'
        print(json.dumps({'status': 'PASS_ACTIVE_V255', 'commit': COMMIT,
                          'pidBefore': app_before['pid'], 'pidAfter': app_after['pid'],
                          'agencyMatches': found, 'health': 'online', 'postSaleTimer': 'active'}))
    except BaseException as error:
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
        print(json.dumps({'status': 'FAIL_RESTORED_V254' if rollback_error is None else 'FAIL_ROLLBACK_NEEDS_OPERATOR',
                          'reason': type(error).__name__ + ':' + str(error)[:400],
                          'rollbackError': rollback_error}))
        raise

if __name__ == '__main__':
    main()
