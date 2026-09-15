import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const manifestRelative = 'docs/freeze/ec-whatsapp-controlled-real-pairing-v152-e-20260912.json';
const parentCommit = '6686adddfc615fcc4e8c899aefc737ebd93525b6';
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
    freezeId: 'EC_WHATSAPP_CONTROLLED_REAL_PAIRING_V152_E_20260912',
    parentCommit,
    parentTree: execFileSync('git', ['rev-parse', `${parentCommit}^{tree}`], { cwd: root, encoding: 'utf8' }).trim(),
    functionalCommit: '20c6b7d3ba287636780b139df4596776142984c8',
    policy: {
        publicationAllowed: true,
        pairingApproved: true,
        zapiPreserved: true,
        samePhoneDualProvider: 'FORBIDDEN',
        allowedQaPeer: '5515998038637',
        realPairing: 'CONTROLLED_SINGLE_CHANNEL',
        realInbound: 'CONTROLLED_QA_ONLY',
        realOutbound: 'CONTROLLED_QA_SINGLE_MESSAGE',
        customerMigration: false,
        customerRouting: false,
        realHandoff: false,
        realFailover: false,
        zapiShutdown: false,
        cutover: false,
        newApprovalRequiredBeforeCutover: true
    },
    overrides: files,
    protectedFiles: Object.fromEntries(files.map((file) => [file, sha256(file)]))
};
fs.mkdirSync(path.dirname(path.join(root, manifestRelative)), { recursive: true });
fs.writeFileSync(path.join(root, manifestRelative), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`V152_E_MANIFEST_REFRESHED=YES files=${files.length}\n`);
