#!/usr/bin/env python3
"""Executor V263 isolado; não troca o bot PM2 nem seu release."""
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

STATE = pathlib.Path('/var/lib/vitalismen-deploy/post-sale-v263-r2')
AUTHORITY = STATE / 'authority.json'
CURRENT = pathlib.Path('/opt/vitalismen-automacao/current')
PRELOAD = pathlib.Path('/usr/local/lib/vitalismen-deploy/post-sale-v263-r2-preload.mjs')
LOCK = pathlib.Path('/var/lib/vitalismen-deploy/ec-postsale-v203.lock')
RECEIPTS = STATE / 'receipts'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def protected(path):
    info = path.lstat()
    assert path.is_file() and not path.is_symlink() and info.st_uid == 0
    assert info.st_gid == 0 and info.st_nlink == 1 and info.st_mode & 0o777 == 0o400
    return path.read_bytes()


def authority():
    raw = protected(AUTHORITY)
    assert sha(raw) == protected(STATE / 'authority.json.sha256').decode().strip()
    data = json.loads(raw)
    assert raw == (json.dumps(data, indent=2, ensure_ascii=False) + '\n').encode()
    assert data['purpose'] == 'EC_POST_SALE_V263_LIMITED'
    assert data['allowedStages'] == 'guide,in_transit,ready_for_pickup'
    return data


def run(args, **kwargs):
    return subprocess.run(args, capture_output=True, text=True, timeout=kwargs.pop('timeout', 30), **kwargs)


def check_source(data):
    release = pathlib.Path(data['release'])
    parent = pathlib.Path(data['parentRelease'])
    assert release.resolve() == release and parent.resolve() == parent
    assert CURRENT.resolve() == parent, 'BOT_RELEASE_CHANGED'
    assert release.parent == pathlib.Path('/opt/vitalismen-automacao/candidates')
    assert run(['git', '-C', str(release), 'rev-parse', 'HEAD']).stdout.strip() == data['commit']
    assert run(['git', '-C', str(release), 'rev-parse', 'HEAD^{tree}']).stdout.strip() == data['tree']
    assert run(['git', '-C', str(release), 'merge-base', data['parentCommit'], data['commit']]).stdout.strip() == data['parentCommit']
    delta = run(['git', '-C', str(release), 'diff', '--name-only', data['parentCommit'], data['commit']])
    assert delta.returncode == 0 and sorted(delta.stdout.splitlines()) == data['allowedDelta']
    assert run(['git', '-C', str(release), 'status', '--porcelain=v1']).stdout.strip() == '?? node_modules'
    assert (release / 'node_modules').resolve() == (parent / 'node_modules').resolve()
    assert sha(protected(STATE / 'overlay.env')) == data['overlaySha256']
    assert sha(protected(PRELOAD)) == data['preloadSha256']
    assert sha(protected(pathlib.Path('/var/lib/vitalismen-deploy/sealed-successors-v1') /
                         (data['parentCommit'] + '.json'))) == data['parentSeal']
    assert sha((release / 'scripts/post-sale-full-v188.mjs').read_bytes()) == data['executorSha256']
    assert sha(pathlib.Path(__file__).read_bytes()) == data['controllerSha256']
    return release, parent


def env_for_run(data, parent):
    response = run(['pm2', 'jlist'], env={**os.environ, 'NODE_OPTIONS': ''}, timeout=15)
    assert response.returncode == 0
    rows = [row for row in json.loads(response.stdout) if row.get('name') == 'vitalismen-automation']
    assert len(rows) == 1 and rows[0]['pm2_env']['status'] == 'online'
    assert pathlib.Path('/proc/%s/cwd' % rows[0]['pid']).resolve() == parent
    pm = rows[0]['pm2_env']
    env = {**os.environ, **{k: str(v) for k, v in pm.get('env', {}).items()
                          if isinstance(v, (str, int, float)) and not isinstance(v, bool)}}
    env.update({k: str(v) for k, v in pm.items()
                if isinstance(v, (str, int, float)) and not isinstance(v, bool)
                and (k.upper() == k or k in ('pm_exec_path', 'pm_cwd'))})
    for line in protected(STATE / 'overlay.env').decode().splitlines():
        key, value = line.split('=', 1)
        assert re.fullmatch(r'[A-Z][A-Z0-9_]*', key)
        env[key] = value
    assert env['POST_SALE_V263_ALLOWED_STAGES'] == data['allowedStages']
    env.update(NODE_OPTIONS='--import=file://' + str(PRELOAD),
               DOTENV_CONFIG_PATH=str(parent / '.env'),
               npm_config_node_options='', NPM_CONFIG_NODE_OPTIONS='')
    for key in ('NODE_CHANNEL_FD', 'NODE_CHANNEL_SERIALIZATION_MODE', 'NODE_UNIQUE_ID',
                'PM2_PROGRAMMATIC', 'PM2_JSON_PROCESSING'):
        env.pop(key, None)
    return env


def parse_report(output):
    decoder = json.JSONDecoder()
    reports = []
    for match in re.finditer(r'(?m)^\{', output):
        try:
            value, _ = decoder.raw_decode(output, match.start())
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict) and value.get('mode') in (
                'V263_LIMITED_DROPI_DRY_RUN', 'V188_OPERATIONAL_BATCH_ONE'):
            reports.append(value)
    assert len(reports) == 1, 'V263_REPORT_MISSING_OR_AMBIGUOUS'
    return reports[0]


def main(mode):
    assert os.getuid() == 0 and os.uname().nodename == 'srv1182009'
    assert mode in ('dry-run', 'run')
    data = authority()
    release, parent = check_source(data)
    RECEIPTS.mkdir(mode=0o700, exist_ok=True)
    with LOCK.open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        env = env_for_run(data, parent)
        result = run(['node', str(release / 'scripts/post-sale-full-v188.mjs'), mode],
                     env=env, cwd=release, timeout=420)
        nonce = uuid.uuid4().hex[:12]
        private = RECEIPTS / (mode + '-' + nonce + '.private.log')
        private.write_text(result.stdout + result.stderr)
        private.chmod(0o400)
        assert result.returncode == 0, 'V263_EXECUTOR_FAILED'
        report = parse_report(result.stdout)
        assert report['status'].startswith('PASS_')
        count = int(report.get('physicalOutboundCount', report.get('sendCount', 0)) or 0)
        assert count <= 1 and (mode != 'dry-run' or count == 0)
        receipt = {'status': report['status'], 'mode': mode,
                   'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   'physicalOutboundCount': count,
                   'selected': (report.get('statusDispatch') or {}).get('selected', 0)}
        target = RECEIPTS / (mode + '-' + nonce + '.json')
        target.write_text(json.dumps(receipt, indent=2) + '\n')
        target.chmod(0o400)
        print(json.dumps(receipt))


if __name__ == '__main__':
    assert len(sys.argv) == 2
    try:
        main(sys.argv[1])
    except Exception:
        if sys.argv[1] == 'run':
            subprocess.run(['systemctl', 'stop', 'vitalismen-postsale-full-v203.timer'],
                           capture_output=True, timeout=20)
        raise
