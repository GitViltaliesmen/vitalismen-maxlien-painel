import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { assertProtocoloGSuccessorGuardV101 } from '../src/services/protocoloGSuccessorGuardV101Service.js';

const sha256 = (relativePath) => crypto.createHash('sha256').update(fs.readFileSync(relativePath)).digest('hex');

test('V101 aceita as rotas atuais somente pelas identidades exatas congeladas nas sucessoras', () => {
    const v90 = JSON.parse(fs.readFileSync('docs/freeze/ec-vsl-dashboard-ingress-v90-20260830.json', 'utf8'));
    const v98 = JSON.parse(fs.readFileSync('docs/freeze/dropi-manual-bff-recovery-v98-20260902.json', 'utf8'));
    const v104 = JSON.parse(fs.readFileSync('docs/freeze/dropi-manual-transport-v104-20260902.json', 'utf8'));
    const v110 = JSON.parse(fs.readFileSync('docs/freeze/bot-qa-outbound-recovery-v110-20260903.json', 'utf8'));
    const v111 = JSON.parse(fs.readFileSync('docs/freeze/bot-qa-multiturn-recovery-v111-20260903.json', 'utf8'));
    assert.ok(v90.declaredAncestorOverrides.includes('src/routes/zapi.js'));
    assert.equal(
        v90.protectedFiles['src/routes/zapi.js'] === sha256('src/routes/zapi.js')
            || (v110.declaredAncestorOverrides.includes('src/routes/zapi.js')
                && v110.protectedFiles['src/routes/zapi.js'] === sha256('src/routes/zapi.js'))
            || (v111.declaredAncestorOverrides.includes('src/routes/zapi.js')
                && v111.protectedFiles['src/routes/zapi.js'] === sha256('src/routes/zapi.js')),
        true
    );
    assert.ok(v98.declaredAncestorOverrides.includes('src/services/droppiEcuadorBrowserService.js'));
    assert.equal(
        v98.protectedFiles['src/services/droppiEcuadorBrowserService.js'] === sha256('src/services/droppiEcuadorBrowserService.js')
            || (v104.declaredAncestorOverrides.includes('src/services/droppiEcuadorBrowserService.js')
                && v104.protectedFiles['src/services/droppiEcuadorBrowserService.js'] === sha256('src/services/droppiEcuadorBrowserService.js')),
        true
    );
});

test('V101 exige caminho declarado e hash exato nos três guards legados', () => {
    for (const relativePath of [
        'scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs',
        'scripts/guard-protocolo-g-conversion-v62.mjs',
        'scripts/guard-protocolo-g-ad-metrics-v63.mjs'
    ]) {
        const body = fs.readFileSync(relativePath, 'utf8');
        assert.match(body, /v90Manifest\.declaredAncestorOverrides\?\.includes\(relativePath\)/);
        assert.match(body, /v90Manifest\.protectedFiles\?\.\[relativePath\] === actualHash/);
        assert.match(body, /v98Manifest\.declaredAncestorOverrides\?\.includes\(relativePath\)/);
        assert.match(body, /v98Manifest\.protectedFiles\?\.\[relativePath\] === actualHash/);
    }
});

test('V101 valida manifesto, sucessão e ausência de efeitos operacionais', () => {
    const result = assertProtocoloGSuccessorGuardV101();
    assert.equal(result.ok, true);
    assert.equal(result.ready, true);
});
