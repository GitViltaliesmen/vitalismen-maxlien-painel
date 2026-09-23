import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const manifestRelative = 'docs/freeze/ec-multi-channel-control-plane-v152-c0-20260912.json';
const parentCommit = '0b1055eb683ee1deb43d4f5c431abfd5e3274e12';
execFileSync('git', ['merge-base', '--is-ancestor', parentCommit, 'HEAD'], { cwd: root });
const committed = execFileSync('git', ['diff', '--name-only', parentCommit, 'HEAD'], { cwd: root, encoding: 'utf8' });
const working = execFileSync('git', ['ls-files', '--modified', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
const files = [...new Set(`${committed}\n${working}`.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))]
    .filter((item) => item !== manifestRelative)
    .filter((item) => !item.startsWith('docs/evidence/'))
    .sort();
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const manifest = {
    freezeId: 'EC_MULTI_CHANNEL_CONTROL_PLANE_V152_C0_20260912',
    parentCommit,
    parentTree: execFileSync('git', ['rev-parse', `${parentCommit}^{tree}`], { cwd: root, encoding: 'utf8' }).trim(),
    policy: {
        publicationAllowed: false,
        productionChanged: false,
        zapiBehaviorChanged: false,
        samePhoneDualProvider: 'FORBIDDEN',
        testChannelPhone: null,
        pairingState: 'PAIRING_PENDING_REAL_TEST_CHANNEL',
        realPairing: 0,
        realOutbound: 0,
        realCustomerRouting: 0,
        realHandoff: 0,
        metaCloudNetworkCalls: 0
    },
    protectedFiles: Object.fromEntries(files.map((file) => [file, sha256(file)]))
};
fs.mkdirSync(path.dirname(path.join(root, manifestRelative)), { recursive: true });
fs.writeFileSync(path.join(root, manifestRelative), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`V152_C0_MANIFEST_REFRESHED=YES files=${files.length}\n`);
