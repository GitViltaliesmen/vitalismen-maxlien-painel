#!/usr/bin/env python3
"""Continuidade do executor de pós venda V254 no release EC V255."""
import datetime
import fcntl
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import uuid

RELEASE = pathlib.Path('/opt/vitalismen-automacao/releases/20261121T031500Z_production-20261121-02dccb3')
CURRENT = pathlib.Path('/opt/vitalismen-automacao/current')
STATE = pathlib.Path('/var/lib/vitalismen-deploy/ec-servientrega-ambato-v255-r1')
PREDECESSOR_BACKUP = pathlib.Path('/opt/vitalismen-automacao/backups/ec-dropi-meta-v254-20261119-r8')
RECEIPTS = STATE / 'post-sale-receipts'
COMMIT = '02dccb3ea4604732c23aec1c82c8766789ceb4e6'

def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()

def read(path):
    return json.loads(pathlib.Path(path).read_text())

def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def write_once(path, content, mode=0o400):
    handle = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, mode)
    with os.fdopen(handle, 'wb') as output:
        output.write(content)
        output.flush()
        os.fsync(output.fileno())

def run(args, *, env=None, cwd=None, timeout=300):
    return subprocess.run(args, env=env, cwd=cwd, capture_output=True, text=True, timeout=timeout)

def pm2_target():
    result = run(['pm2', 'jlist'], env={**os.environ, 'NODE_OPTIONS': '', 'npm_config_node_options': ''}, timeout=15)
    assert result.returncode == 0, 'PM2_UNAVAILABLE'
    rows = [row for row in json.loads(result.stdout) if row.get('name') == 'vitalismen-automation']
    assert len(rows) == 1, 'PM2_TARGET_INVALID'
    return rows[0]

def actual_env():
    p = pm2_target()['pm2_env']
    env = {**os.environ, **{k: str(v) for k, v in p.get('env', {}).items()
                         if isinstance(v, (str, int, float)) and not isinstance(v, bool)}}
    env.update({k: str(v) for k, v in p.items()
                if isinstance(v, (str, int, float)) and not isinstance(v, bool)
                and (k.upper() == k or k in ('pm_exec_path', 'pm_cwd'))})
    for key in ('NODE_CHANNEL_FD', 'NODE_CHANNEL_SERIALIZATION_MODE', 'NODE_UNIQUE_ID',
                'PM2_PROGRAMMATIC', 'PM2_JSON_PROCESSING'):
        env.pop(key, None)
    env['npm_config_node_options'] = ''
    env['NPM_CONFIG_NODE_OPTIONS'] = ''
    return env

def report_from(output):
    decoder = json.JSONDecoder()
    reports = []
    for match in re.finditer(r'(?m)^\{', output):
        try:
            value, _ = decoder.raw_decode(output, match.start())
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict) and value.get('mode') in (
            'V188_TOTAL_DRY_RUN', 'V188_OPERATIONAL_BATCH_ONE', 'V188_READ_ONLY_SNAPSHOT'
        ) and 'profile' in value and value.get('zapiConnected') is True:
            reports.append(value)
    assert len(reports) == 1, 'POSTSALE_ROOT_REPORT_MISSING_OR_AMBIGUOUS'
    return reports[0]

def main(mode):
    assert mode in ('snapshot', 'dry-run', 'run')
    assert os.getuid() == 0 and os.uname().nodename == 'srv1182009'
    assert CURRENT.resolve() == RELEASE, 'RELEASE_CHANGED'
    approval = read(STATE / 'approval.json')
    activation = read(STATE / 'activation.json')
    assert approval['commit'] == COMMIT and approval['release'] == str(RELEASE)
    assert activation['state'] == 'ACTIVE' and activation['runtimeAllowed'] is True
    assert activation['commit'] == COMMIT and activation['approvalSha256'] == sha(STATE / 'approval.json')
    assert sha(__file__) == (STATE / 'post-sale-controller.sha256').read_text().strip(), 'CONTROLLER_DRIFT'
    assert sha(RELEASE / '.release-source.json') == approval['sourceMetadataSha256']
    assert sha('/usr/local/lib/vitalismen-deploy/ec-servientrega-ambato-sealed-v255-r1.mjs') == approval['engineSha256']
    assert sha('/usr/local/lib/vitalismen-deploy/ec-servientrega-ambato-profile-v255-r1.mjs') == approval['helperSha256']
    assert pm2_target()['pm2_env']['status'] == 'online'
    RECEIPTS.mkdir(mode=0o700, exist_ok=True)
    lock = open('/var/lib/vitalismen-deploy/ec-postsale-v203.lock', 'a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    nonce = uuid.uuid4().hex[:10]
    env = actual_env()
    if mode == 'run':
        bindings = read(PREDECESSOR_BACKUP / 'BINDINGS.json')
        for name, digest in bindings['operationalFiles'].items():
            assert sha(PREDECESSOR_BACKUP / name) == digest, 'OPERATIONAL_SOURCE_DRIFT:' + name
        renewal = run(['python3', '-I', '-B', '-S',
                       '/opt/vitalismen-automacao/backups/ec-orders-dropi-postsale-v252-20261119-r11/renew-if-needed.py'],
                      env=env, timeout=240)
        assert renewal.returncode == 0, 'SESSION_RENEWAL_CHECK_FAILED'
        renewal_record = json.loads(renewal.stdout)
        write_once(RECEIPTS / ('SESSION_CHECK_' + nonce + '.json'),
                   (json.dumps(renewal_record, ensure_ascii=False, indent=2) + '\n').encode())
    env.update(approval['profiles']['postSaleLive'])
    env.pop('VITALISMEN_WEB_ELEVENLABS_API_KEY', None)
    result = run(['node', str(RELEASE / 'scripts/post-sale-full-v188.mjs'), mode],
                 env=env, cwd=RELEASE, timeout=300)
    write_once(RECEIPTS / ('POSTSALE_' + mode + '_' + nonce + '.private.log'),
               (result.stdout + result.stderr).encode())
    assert result.returncode == 0, 'POSTSALE_FAILED'
    report = report_from(result.stdout)
    assert str(report['status']).startswith('PASS_'), 'POSTSALE_REPORT_FAILED'
    if mode == 'dry-run':
        assert report.get('sendCount') == 0
    if mode == 'run':
        assert int(report.get('physicalOutboundCount', report.get('outboundCount', 0))) <= 1
    receipt = {'status': report['status'], 'mode': mode, 'at': stamp(),
               'sendCount': report.get('sendCount', 0),
               'physicalOutboundCount': report.get('physicalOutboundCount', report.get('outboundCount', 0)),
               'forwardOnlySince': approval['profiles']['postSaleLive'].get('POST_SALE_V194_FORWARD_ONLY_SINCE'),
               'report': report}
    write_once(RECEIPTS / ('POSTSALE_' + mode + '_' + nonce + '.json'),
               (json.dumps(receipt, ensure_ascii=False, indent=2) + '\n').encode())
    print(json.dumps({k: v for k, v in receipt.items() if k != 'report'}, ensure_ascii=False))

if __name__ == '__main__':
    assert len(sys.argv) == 2 and sys.argv[1] in ('snapshot', 'dry-run', 'run')
    main(sys.argv[1])
