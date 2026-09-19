import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    assertV192LineageHash,
    assertV192OverrideAllowlist
} from '../scripts/lib/ec-runtime-successor-v192-context.mjs';
import { auditNxV192Source } from '../scripts/audit-ec-nx-funnel-click-path-v192.mjs';
import {
    assertV192ChangedFilesAllowed,
    assertV192HashLock
} from '../scripts/guard-v192-successor-alignment.mjs';

const vsl = fs.readFileSync('public/n/index.html', 'utf8');
const freeze = JSON.parse(fs.readFileSync('docs/freeze/guard-successor-alignment-v192-20260919.json', 'utf8'));
const lineage = Object.fromEntries(freeze.authorizedOverrides.map((entry) => [entry.path, entry]));

test('1. contexto V192 aceita somente os três overrides finitos autorizados', () => {
    assert.deepEqual(assertV192OverrideAllowlist(Object.keys(lineage)), [
        '.github/workflows/ec-panel-quality.yml',
        'src/routes/whatsapp.js',
        'src/routes/zapi.js'
    ]);
});

test('2. workflow com hash diferente do V171 falha fechado', () => {
    assert.throws(() => assertV192LineageHash({ path: '.github/workflows/ec-panel-quality.yml', actualSha256: '0'.repeat(64), expectedSha256: lineage['.github/workflows/ec-panel-quality.yml'].currentSha256 }));
});

test('3. zapi.js com hash diferente do V171 falha fechado', () => {
    assert.throws(() => assertV192LineageHash({ path: 'src/routes/zapi.js', actualSha256: '0'.repeat(64), expectedSha256: lineage['src/routes/zapi.js'].currentSha256 }));
});

test('4. whatsapp.js com hash não registrado pelo V185 falha fechado', () => {
    assert.throws(() => assertV192LineageHash({ path: 'src/routes/whatsapp.js', actualSha256: '0'.repeat(64), expectedSha256: lineage['src/routes/whatsapp.js'].currentSha256 }));
});

test('5. VSL alterada reprova o hash lock', () => {
    assert.throws(() => assertV192HashLock('VSL', freeze.hashLocks.VSL.sha256, '0'.repeat(64)));
});

test('6. CTA sem chamada ao destino WhatsApp reprova o auditor', () => {
    assert.throws(() => auditNxV192Source(vsl.replace('openWhatsAppNow(message, sellerPhone);', 'void sellerPhone;')));
});

test('7. URL HTTPS do WhatsApp removida reprova o auditor', () => {
    assert.throws(() => auditNxV192Source(vsl.replace('https://api.whatsapp.com/send?phone=', 'https://example.invalid/send?phone=')));
});

test('8. wildcard de override reprova o contexto', () => {
    assert.throws(() => assertV192OverrideAllowlist(['*', ...Object.keys(lineage)]));
    assert.throws(() => assertV192OverrideAllowlist(['src/**', ...Object.keys(lineage)]));
});

test('9. arquivo fora da allowlist reprova o guard', () => {
    assert.throws(() => assertV192ChangedFilesAllowed([{ status: 'M', file: 'src/routes/zapi.js' }]));
});

test('10. contrato funcional vigente da CTA passa sem texto visual histórico', () => {
    const result = auditNxV192Source(vsl);
    assert.equal(result.finalCtaOperational, true);
    assert.equal(result.whatsappDestination, true);
    assert.equal(result.historicalVisualTextRequired, false);
});
