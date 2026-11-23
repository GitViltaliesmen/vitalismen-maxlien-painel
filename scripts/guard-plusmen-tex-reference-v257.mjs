import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const digest = value => createHash('sha256').update(value).digest('hex');
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('docs/freeze/plusmen-tex-reference-v257-20261123.json', root)));
const candidate = fs.readFileSync(new URL('ops/publications/tex-reference-v257/whatsapp-tex-v243.js', root));
const mode = process.argv[2];
assert.ok(['--expect-before', '--expect-after'].includes(mode));
assert.equal(manifest.project, 'VITALISMEN_EC');
assert.equal(manifest.version, 257);
assert.equal(manifest.officialUrl, 'https://plusmen.shop/tex');
assert.equal(manifest.target.path, '/var/www/plusmen-tex-vsl-v1/assets/whatsapp-tex-v243.js');
assert.equal(manifest.target.beforeSha256, 'c1a6e560b967601ead74ad23a9e1e017651c4b19007d37bc7722ab75063333dc');
assert.equal(manifest.parentV256Sha256, '831ff907a2e9db0fa3b72523ad5760e5df82ec1db83bb4d20506e9eaccb775b7');
assert.equal(digest(candidate), manifest.target.sha256);
let inverted = candidate.toString('utf8');
for (const patch of [...manifest.target.patches].reverse()) {
  assert.equal(inverted.split(patch.after).length, 2, 'inverse patch must occur exactly once');
  inverted = inverted.replace(patch.after, patch.before);
}
assert.equal(digest(inverted), manifest.target.beforeSha256, 'V256 preimage changed outside the approved patch');

const expected = mode === '--expect-before' ? manifest.target.beforeSha256 : manifest.target.sha256;
const paths = { ...manifest.preservedSha256, [manifest.target.path]: expected };
const remote = `import hashlib,json,pathlib,stat
paths=json.loads(${JSON.stringify(JSON.stringify(paths))})
target=${JSON.stringify(manifest.target.path)}
for name,expected in paths.items():
 p=pathlib.Path(name);s=p.lstat()
 assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_gid==0 and s.st_nlink==1 and (s.st_mode&0o777)==0o644,'metadata_changed: '+name
 assert hashlib.sha256(p.read_bytes()).hexdigest()==expected,'hash_changed: '+name
print('PLUSMEN TEX V257: PASS; approved single-file delta and preserved files verified')
`;
const result = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=12', 'vilaliemen-protocolo-g', 'python3 -'], {
  input: remote, encoding: 'utf8', timeout: 30000, windowsHide: true
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
assert.equal(result.status, 0, 'V257 origin unavailable or frozen file changed');
