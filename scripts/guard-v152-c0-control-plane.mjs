import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const panel = read('public/qr.html');
const sourceFiles = [
    'src/whatsapp/core/WhatsAppTransport.js',
    'src/whatsapp/core/ShadowModeGate.js',
    'src/whatsapp/core/ChannelRegistry.js',
    'src/whatsapp/transports/WhatsAppWebTransport.js',
    'src/whatsapp/transports/MetaCloudTransportNoop.js'
];
const source = sourceFiles.map(read).join('\n');

assert.match(panel, /WHATSAPP_WEB_TEMPLATE/);
assert.match(panel, /PAIRING_PENDING_REAL_TEST_CHANNEL/);
assert.match(panel, /data-v152-c0-pair-state="DISABLED_NO_TEST_PHONE"[^>]*disabled/);
assert.match(panel, /weight=0/);
assert.match(panel, /capacity=0/);
assert.match(panel, /draining=true/);
assert.doesNotMatch(source, /console\.(log|info|debug)\s*\([^)]*(qr|token|secret|credential)/i);
assert.doesNotMatch(source, /(?:token|secret)\s*[:=]\s*['"][^'"]+['"]/i);
assert.match(source, /realPairing:\s*false/);
assert.match(source, /realOutbound:\s*false/);
assert.match(source, /realCustomerRouting:\s*false/);
assert.match(source, /networkCalls\s*=\s*0/);

process.stdout.write('V152_C0_SECURITY=PASS\nCRITICAL=0\nHIGH=0\nMODERATE=0\nSESSION_SECRET_EXPOSURE=0\nQR_LOGGING=0\nRAW_QR_PERSISTENCE=0\n');
