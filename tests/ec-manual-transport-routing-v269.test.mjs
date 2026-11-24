import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/routes/whatsapp.js', import.meta.url), 'utf8');
const start = source.indexOf('const shouldForceZapiForManualTestSend =');
const end = source.indexOf('\n\nconst scopedPanelPhones', start);
assert.ok(start >= 0 && end > start);
const declaration = source.slice(start, end);
const makeDecision = (mode) => new Function(
    'ecTransportMode', 'isBrazilPanelTestPhone', 'digitsOnly',
    `${declaration}\nreturn shouldForceZapiForManualTestSend;`
)(() => mode, (phone) => String(phone).replace(/\D/g, '') === '5515998038637', (phone) => String(phone).replace(/\D/g, ''));

test('manual QA and EC sends use the linked device after cutover', () => {
    const linked = makeDecision('baileys_text');
    assert.equal(linked('5515998038637', 'manual_panel'), false);
    assert.equal(linked('593999123456', 'manual_panel'), false);
    const legacy = makeDecision('zapi');
    assert.equal(legacy('5515998038637', 'manual_panel'), true);
    assert.equal(legacy('593999123456', 'manual_panel'), true);
});

test('only the authorized Brazilian QA phone can use EC manual media', () => {
    const start = source.indexOf('const manualMediaCountry =');
    const end = source.indexOf('\n        let storedMessageRecordId', start);
    assert.ok(start >= 0 && end > start);
    const decision = new Function(
        'country', 'phone', 'sendMode', 'req', 'isBrazilPanelTestPhone',
        `${source.slice(start, end)}\nreturn { manualMediaCountry, manualPanelMediaAuthorized };`
    );
    const allowed = (country, phone) => decision(
        country, phone, 'manual_panel', { user: { id: 'operator' } },
        (value) => String(value).replace(/\D/g, '') === '5515998038637'
    );
    assert.deepEqual(allowed('BR', '5515998038637'), { manualMediaCountry: 'EC', manualPanelMediaAuthorized: true });
    assert.deepEqual(allowed('BR', '5515999999999'), { manualMediaCountry: 'BR', manualPanelMediaAuthorized: false });
    assert.deepEqual(allowed('EC', '593999123456'), { manualMediaCountry: 'EC', manualPanelMediaAuthorized: true });
});
