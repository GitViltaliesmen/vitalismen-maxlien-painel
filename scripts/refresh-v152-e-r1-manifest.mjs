import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const manifestRelative = 'docs/freeze/ec-whatsapp-real-pairing-test-channel-v152-e-r1-20260912.json';
const parentCommit = '0f254a0abc84abc052c08bde1e150b7789673680';
execFileSync('git', ['merge-base', '--is-ancestor', parentCommit, 'HEAD'], { cwd: root });
const committed = execFileSync('git', ['diff', '--name-only', parentCommit, 'HEAD'], { cwd: root, encoding: 'utf8' });
const working = execFileSync('git', ['ls-files', '--modified', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' });
const files = [...new Set(`${committed}\n${working}`.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))]
    .filter((item) => item !== manifestRelative)
    .filter((item) => !item.startsWith('.audit/'))
    .filter((item) => !item.startsWith('.codex-audit/'))
    .filter((item) => !item.startsWith('.wt-v126/'))
    .filter((item) => !item.startsWith('docs/evidence/'))
    .sort();
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const manifest = {
    freezeId: 'EC_WHATSAPP_REAL_PAIRING_TEST_CHANNEL_V152_E_R1_20260912',
    parentCommit,
    parentTree: execFileSync('git', ['rev-parse', `${parentCommit}^{tree}`], { cwd: root, encoding: 'utf8' }).trim(),
    functionalCommit: '087193fdcbadfa4cc885cf3ba347db2e7492f424',
    policy: {
        phase: 'V152-E-R1_REAL_PAIRING_TEST_CHANNEL',
        testChannelPhone: '5531983002800',
        channelId: 'V152_TEST_WEB_01',
        sessionNamespace: 'V152_TEST_WEB_01',
        provider: 'WHATSAPP_WEB',
        allowedQaPeer: '5515998038637',
        productionPhone: '5531971862958',
        productionProvider: 'ZAPI',
        shadow: true,
        draining: true,
        weight: 0,
        capacity: 0,
        customerRouting: false,
        handoff: false,
        failover: false,
        zapiDrain: false,
        zapiShutdown: false,
        cutover: false,
        newApprovalRequired: true
    },
    overrides: files,
    protectedFiles: Object.fromEntries(files.map((file) => [file, sha256(file)]))
};
fs.mkdirSync(path.dirname(path.join(root, manifestRelative)), { recursive: true });
fs.writeFileSync(path.join(root, manifestRelative), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`V152_E_R1_MANIFEST_REFRESHED=YES files=${files.length}\n`);
