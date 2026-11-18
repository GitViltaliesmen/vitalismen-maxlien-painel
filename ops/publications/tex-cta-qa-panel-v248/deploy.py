"""Two public files only. Hash-pinned compare-and-swap, backup, inverse proof."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import stat
import time

parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['audit', 'apply', 'rollback'])
parser.add_argument('role', choices=['origin', 'panel'])
args = parser.parse_args()
folder = Path(__file__).resolve().parent
m = json.loads((folder / 'manifest.json').read_bytes())
role = 'cta' if args.role == 'origin' else 'panel'
record = m[role]
expected = {
    'cta': ('/var/www/plusmen-tex-vsl-v1/assets/whatsapp-tex-v243.js',
            'de67f978c52f7676d666bb22f2175cf72baa283f13fa47f7424d3a5262c35fcd',
            'deeeb05d598b697762d352f1c47d91d0ed850e57a81a3f4ee70e37118bbdddc7'),
    'panel': ('/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html',
              'e2dcc2343466f69a9850fae787b4ea8c29a7cdfac2e8734ed0ac1951fab2e3a3',
              'ecfb29720492931c884b37814fb9dae3a4f5dcc12c7f3845f332f725d31a4e56')
}[role]
sha = lambda b: hashlib.sha256(b).hexdigest()
assert (record['path'], record['beforeSha256'], record['sha256']) == expected
assert m['project'] == 'VITALISMEN_EC' and m['version'] == 248
target = Path(expected[0])
st = target.lstat()
assert stat.S_ISREG(st.st_mode) and st.st_uid == 0 and st.st_gid == 0 and st.st_nlink == 1
assert stat.S_IMODE(st.st_mode) == 0o644
original = target.read_bytes()
candidate = (folder / ('whatsapp-tex-v243.js' if role == 'cta' else 'qr.html')).read_bytes()
assert sha(candidate) == expected[2]
if role == 'cta':
    suffix = base64.b64decode(record['addonBase64'], validate=True)
    assert sha(suffix) == record['addonSha256'] == '42f5867800295c7f5f593119fa98d612f3e652491b4761effa222730c82f846f'
    assert candidate.endswith(suffix)
    parent = candidate[:-len(suffix)]
else:
    patches = record['patches']
    assert sha(json.dumps(patches, separators=(',', ':')).encode()) == '40c5f13ee644bed438b741f0147d47b8098b51b129b03ac21b662c42dcf74b19'
    parent = candidate
    for p in reversed(patches):
        before = base64.b64decode(p['beforeBase64'], validate=True)
        after = base64.b64decode(p['afterBase64'], validate=True)
        assert parent.count(after) == 1
        parent = parent.replace(after, before, 1)
assert sha(parent) == expected[1]
report = {'project': 'VITALISMEN_EC', 'role': role, 'action': args.action,
          'time': time.time(), 'currentSha256': sha(original), 'path': str(target),
          'candidateSha256': sha(candidate), 'inverseExact': True}
if args.action != 'audit':
    replacing, replacement = (expected[1], candidate) if args.action == 'apply' else (expected[2], parent)
    assert sha(original) == replacing, 'CONCURRENT_CHANGE_OR_ALREADY_APPLIED_NO_RETRY'
    backup = folder / ('before-' + args.action + '.private')
    fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as f:
        f.write(original)
        f.flush()
        os.fsync(f.fileno())
    assert backup.read_bytes() == original
    pending = target.with_name(target.name + '.v248-pending')
    fd = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    with os.fdopen(fd, 'wb') as f:
        f.write(replacement)
        f.flush()
        os.fsync(f.fileno())
    os.chown(pending, 0, 0)
    os.chmod(pending, 0o644)
    assert target.read_bytes() == original
    os.replace(pending, target)
    fd = os.open(target.parent, os.O_RDONLY)
    os.fsync(fd)
    os.close(fd)
    assert target.read_bytes() == replacement
    report.update(publishedSha256=sha(replacement), backupVerified=True, restart=False)
with (folder / (args.action + '-' + role + '-' + str(time.time_ns()) + '.json')).open('x') as f:
    json.dump(report, f, indent=2)
print(json.dumps(report))
