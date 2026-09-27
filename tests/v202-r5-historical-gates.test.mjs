import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

const sha256 = (relative) => crypto.createHash('sha256')
    .update(fs.readFileSync(relative)).digest('hex');
const json = (relative) => JSON.parse(fs.readFileSync(relative, 'utf8'));
const parent = 'fe32da042617335d11b9fcde2e5dc0d4519c9915';
const r4 = json('docs/freeze/unified-successor-v202-r4-v78-controller-pin-20260925.json');
const r4Hash = (relative) => r4.allowlist.find((entry) => entry.path === relative)?.canonicalSha256;
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

test('V47 histórico e workflow sucessor R4 mantêm identidades distintas e exatas', () => {
    const v28 = json('docs/freeze/customer-data-resolution-v28-20260818.json');
    const workflow = '.github/workflows/ec-panel-quality.yml';
    assert.equal(v28.protectedFiles[workflow],
        '2748a7157e4f6e7918561dbc162d1969f110a35da065797cabe9f28b9b962ded');
    assert.equal(r4Hash(workflow), sha256(workflow));
    assert.notEqual(v28.protectedFiles[workflow], sha256(workflow));
});

test('V101 rota Z-API é histórica; a sucessão R4 autentica a rota atual', () => {
    const relative = 'src/routes/zapi.js';
    const v90 = json('docs/freeze/ec-vsl-dashboard-ingress-v90-20260830.json');
    const v110 = json('docs/freeze/bot-qa-outbound-recovery-v110-20260903.json');
    const v111 = json('docs/freeze/bot-qa-multiturn-recovery-v111-20260903.json');
    assert.ok([v90, v110, v111].every((manifest) =>
        manifest.protectedFiles[relative] !== sha256(relative)));
    assert.equal(r4Hash(relative), sha256(relative));
});

test('V101 janela de leads V100 foi sucedida pela identidade V158', () => {
    const relative = 'public/leads-window.html';
    const v100 = json('docs/freeze/ec-repurchase-panel-precedence-v100-20260902.json');
    const v158 = json('docs/freeze/ec-panel-confirmed-persistence-v158-20260914.json');
    assert.notEqual(v100.protectedFiles[relative], sha256(relative));
    assert.equal(v158.protectedFiles[relative], sha256(relative));
});

test('provider-only V171 foi sucedido por R4 e o diff funcional atual permanece nos dois patches', () => {
    const qr = 'public/qr.html';
    const v171 = json('docs/freeze/ec-traffic-restoration-v171-20260917.json');
    assert.notEqual(v171.protectedFiles[qr], sha256(qr));
    assert.equal(r4Hash(qr), sha256(qr));
    assert.equal(git('merge-base', parent, 'HEAD'), parent);
    const sources = [
        git('diff', '--name-only', parent + '..HEAD'),
        git('diff', '--name-only'),
        git('diff', '--cached', '--name-only')
    ];
    const changed = [...new Set(sources.flatMap((value) => value.split(/\r?\n/))
        .map((value) => value.trim()).filter(Boolean))];
    const functional = changed.filter((value) => (value.startsWith('src/')
        || value.startsWith('public/'))
        && value !== 'src/services/ecBotCoreOperationalV78Service.js');
    assert.ok(changed.includes('src/services/ecBotCoreOperationalV78Service.js'));
    assert.deepEqual(functional.sort(), [
        'src/services/servientregaEcuadorAgencyService.js',
        'src/whatsapp/sendText.js'
    ]);
});
