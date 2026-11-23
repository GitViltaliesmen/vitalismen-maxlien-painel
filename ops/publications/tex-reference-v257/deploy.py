from pathlib import Path
import hashlib, json, os, stat, sys

ROOT = Path('/root/plusmen-tex-reference-v257-20261123')
MANIFEST_SHA256 = '2ceec9cc5fb937b24009ebffb5304ecc1f53d00d8e516e0cb36f22da68cb57b8'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def checked_file(name, expected):
    path = Path(name)
    info = path.lstat()
    assert stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_gid == 0
    assert info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == 0o644
    data = path.read_bytes()
    assert sha(data) == expected, 'hash_changed: ' + name
    return path, data

def atomic_replace(path, value, expected):
    assert sha(path.read_bytes()) == expected, 'concurrent_change'
    temporary = path.with_name(path.name + '.v257.tmp')
    with temporary.open('xb') as handle:
        handle.write(value)
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(temporary, 0o644)
    os.chown(temporary, 0, 0)
    assert sha(path.read_bytes()) == expected, 'concurrent_change'
    os.replace(temporary, path)
    directory = os.open(path.parent, os.O_RDONLY)
    os.fsync(directory)
    os.close(directory)

raw = (ROOT / 'manifest.json').read_bytes()
assert sha(raw) == MANIFEST_SHA256
manifest = json.loads(raw)
assert manifest['project'] == 'VITALISMEN_EC' and manifest['version'] == 257
target = manifest['target']
candidate = (ROOT / 'whatsapp-tex-v243.js').read_bytes()
assert sha(candidate) == target['sha256']
inverse = candidate.decode()
for patch in reversed(target['patches']):
    assert inverse.count(patch['after']) == 1
    inverse = inverse.replace(patch['after'], patch['before'], 1)
assert sha(inverse.encode()) == target['beforeSha256']
for name, expected in manifest['preservedSha256'].items():
    checked_file(name, expected)

mode = sys.argv[1]
path = Path(target['path'])
if mode == 'audit':
    current = path.read_bytes()
    print(json.dumps({'path': str(path), 'before': sha(current) == target['beforeSha256'],
                      'after': sha(current) == target['sha256']}))
elif mode == 'apply':
    _, before = checked_file(str(path), target['beforeSha256'])
    backup = ROOT / 'backup'
    backup.mkdir(mode=0o700, exist_ok=False)
    with (backup / path.name).open('xb') as handle:
        handle.write(before)
        handle.flush()
        os.fsync(handle.fileno())
    assert sha((backup / path.name).read_bytes()) == target['beforeSha256']
    atomic_replace(path, candidate, target['beforeSha256'])
    try:
        checked_file(str(path), target['sha256'])
        for name, expected in manifest['preservedSha256'].items():
            checked_file(name, expected)
    except BaseException:
        atomic_replace(path, before, target['sha256'])
        raise
    print(json.dumps({'applied': True, 'backup': str(backup), 'sha256': target['sha256']}))
elif mode == 'rollback':
    checked_file(str(path), target['sha256'])
    before = (ROOT / 'backup' / path.name).read_bytes()
    assert sha(before) == target['beforeSha256']
    atomic_replace(path, before, target['sha256'])
    checked_file(str(path), target['beforeSha256'])
    print(json.dumps({'rolledBack': True}))
else:
    raise ValueError(mode)
