import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const manifestRelative = 'docs/freeze/ec-whatsapp-native-pairing-code-v152-e-r2-20260912.json';
const parentCommit = 'b785937ed8e31d8c2b767e4ef1645e080e2f4f93';
const functionalCommit = '85b34981861f9ba01dd591b2d0c77c3bbd1ea0fa';
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
    freezeId: 'EC_WHATSAPP_NATIVE_PAIRING_CODE_V152_E_R2_20260912',
    parentCommit,
    parentTree: execFileSync('git', ['rev-parse', `${parentCommit}^{tree}`], { cwd: root, encoding: 'utf8' }).trim(),
    functionalCommit,
    functionalTree: execFileSync('git', ['rev-parse', `${functionalCommit}^{tree}`], { cwd: root, encoding: 'utf8' }).trim(),
    policy: {
        basePhase: 'V152-E-R1_REAL_PAIRING_TEST_CHANNEL',
        pairingPatch: 'V152-E-R2_NATIVE_PAIRING_CODE',
        pairingMethod: 'PAIRING_CODE',
        testChannelPhone: '5531983002800',
        channelId: 'V152_TEST_WEB_01',
        sessionNamespace: 'V152_TEST_WEB_01',
        provider: 'WHATSAPP_WEB',
        allowedQaPeer: '5515998038637',
        productionPhone: '5531971862958',
        productionProvider: 'ZAPI',
        pairingCodePersistence: false,
        qrGeneratedForPairingCode: false,
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
        newApprovalRequiredBeforeCutover: true
    },
    overrides: files,
    protectedFiles: Object.fromEntries(files.map((file) => [file, sha256(file)]))
};
fs.mkdirSync(path.dirname(path.join(root, manifestRelative)), { recursive: true });
fs.writeFileSync(path.join(root, manifestRelative), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`V152_E_R2_MANIFEST_REFRESHED=YES files=${files.length}\n`);
