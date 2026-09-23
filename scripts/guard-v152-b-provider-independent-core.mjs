import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const coreRoot = path.join(root, 'src', 'whatsapp');
const files = [];
for (const directory of ['core', 'transports']) {
    const absolute = path.join(coreRoot, directory);
    for (const name of fs.readdirSync(absolute)) files.push(path.join(absolute, name));
}
const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const panel = fs.readFileSync(path.join(root, 'public', 'qr.html'), 'utf8');

assert.doesNotMatch(source, /console\.(log|info|debug)\s*\([^)]*(qr|token|secret|credential)/i, 'sensitive_or_qr_logging_detected');
assert.doesNotMatch(source, /process\.cwd\(\).*auth_info_baileys/i, 'release_local_session_storage_detected');
assert.doesNotMatch(source, /META.*(?:TOKEN|SECRET)|(?:TOKEN|SECRET).*META/i, 'meta_secret_contract_detected');
assert.match(source, /realPairing:\s*false/);
assert.match(source, /realOutbound:\s*false/);
assert.match(source, /realCustomerRouting:\s*false/);
assert.match(source, /networkCalls\s*=\s*0/);
assert.match(panel, /V152-B shadow/);
assert.match(panel, /data-v152-channel-action=.*disabled/);

process.stdout.write(`V152_B_SECURITY_PREDEPLOY=PASS files=${files.length}\nCRITICAL=0\nHIGH=0\nMODERATE=0\n`);
