import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const index = read('src/index.js');
const panel = read('public/qr.html');
const helper = read('public/panel-intelligence/authenticated-media.js');
const manifest = JSON.parse(read('docs/freeze/panel-image-csp-blob-v33-20260821.json'));

test('V33 sucede exatamente V32 e registra a autorização limitada ao painel', () => {
    assert.equal(manifest.freezeId, 'panel-image-csp-blob-v33-20260821');
    assert.equal(manifest.parentFreezeId, 'official-whatsapp-phone-test-v32-20260821');
    assert.equal(manifest.parentManifestSha256, 'ac0ad90730931ec3f15fc6a0effe424044afffa88fc59b943901262f525d1e37');
    assert.equal(manifest.operatorApproval?.scope, 'fix_authenticated_inbound_images_in_panel_v33');
    assert.equal(manifest.policy?.cspChangeLimitedToImgBlob, true);
    assert.equal(manifest.policy?.commercialFlowChanged, false);
    assert.equal(manifest.realEffectsAtFreeze?.whatsappMessage, false);
});

test('V33 permite blob somente nas diretivas de imagem e mídia que precisam dele', () => {
    assert.match(index, /"img-src": \["'self'", "data:", "blob:", "https:"\]/);
    assert.match(index, /"media-src": \["'self'", "data:", "blob:", "https:"\]/);
    assert.match(index, /\.\.\.helmet\.contentSecurityPolicy\.getDefaultDirectives\(\)/);
    assert.match(index, /"script-src": \["'self'", "'unsafe-inline'"\]/);
    assert.doesNotMatch(index, /"default-src"\s*:\s*\[[^\]]*blob:/);
    assert.doesNotMatch(index, /"object-src"\s*:\s*\[[^\]]*blob:/);
});

test('imagem continua usando fetch autenticado e URL blob sem token na URL', () => {
    assert.match(helper, /Authorization: `Bearer \$\{token\}`/);
    assert.match(helper, /objectUrl: createObjectURL\(blob\)/);
    assert.match(panel, /data-auth-media-src/);
    assert.match(panel, /hydrateAuthenticatedMedia\(box\)/);
    assert.doesNotMatch(panel, /mediaToken=|access_token=.*media|[?&]token=.*authMedia/i);
});

test('V33 preserva o endpoint autenticado e não altera o telefone oficial', () => {
    assert.match(index, /protocoloGTexUltraFreezeRuntimeGuardV34/);
    assert.match(panel, /sessionId: '5515991418416'/);
    assert.match(panel, /allowedBrazilTestPhones = new Set\(\['5515991418416', '5515998038637'\]\)/);
});
