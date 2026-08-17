import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import observationRoutes from '../src/routes/observation.js';
import whatsappRoutes from '../src/routes/whatsapp.js';
import zapiRoutes from '../src/routes/zapi.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const routeHandlers = (router, routePath, method = 'get') => {
    const layer = router.stack.find((item) => item.route?.path === routePath);
    assert.ok(layer, `rota ${method.toUpperCase()} ${routePath} nao encontrada`);
    assert.equal(layer.route.methods[method], true);
    return layer.route.stack.map((item) => item.handle.name);
};

test('status WhatsApp que pode conter QR exige login e preserva entradas publicas da VSL', () => {
    assert.deepEqual(routeHandlers(whatsappRoutes, '/status'), ['authMiddleware', '']);
    assert.deepEqual(routeHandlers(whatsappRoutes, '/vsl-seller-rotation'), ['']);
    assert.deepEqual(routeHandlers(whatsappRoutes, '/vsl-entry', 'post'), ['']);
});

test('status, aparelho e configuracao Z-API exigem login sem fechar link publico ou webhooks', () => {
    for (const routePath of ['/config', '/status', '/device']) {
        assert.deepEqual(routeHandlers(zapiRoutes, routePath), ['authMiddleware', '']);
    }
    assert.deepEqual(routeHandlers(zapiRoutes, '/whatsapp-link'), ['']);
    assert.deepEqual(routeHandlers(zapiRoutes, '/webhook', 'post'), ['']);
    assert.deepEqual(routeHandlers(zapiRoutes, '/webhook/delivery', 'post'), ['']);
    assert.deepEqual(routeHandlers(zapiRoutes, '/webhook/received', 'post'), ['']);
});

test('observador inteiro passa pela autenticacao antes de ler dados de clientes', () => {
    const authLayerIndex = observationRoutes.stack.findIndex((item) => item.name === 'authMiddleware');
    const firstRouteIndex = observationRoutes.stack.findIndex((item) => item.route);
    assert.ok(authLayerIndex >= 0, 'authMiddleware do observador nao encontrado');
    assert.ok(firstRouteIndex > authLayerIndex, 'autenticacao precisa executar antes de qualquer rota do observador');
});

test('painel envia Bearer tambem nas leituras de status e continua sem preview na lista esquerda', () => {
    const panel = fs.readFileSync(path.join(projectRoot, 'public', 'qr.html'), 'utf8');
    const helperStart = panel.indexOf('async function fetchPanelJson');
    const helperEnd = panel.indexOf('const zapiStatusGraceMs', helperStart);
    assert.ok(helperStart >= 0 && helperEnd > helperStart, 'helper de leitura do painel nao encontrado');
    const helper = panel.slice(helperStart, helperEnd);
    assert.match(helper, /Authorization: `Bearer \$\{state\.token\}`/);
    assert.match(helper, /headers\s*\n\s*\}\);/);
    assert.doesNotMatch(panel, /chat\.lastMessage\.body/);
    assert.doesNotMatch(panel, /chat-preview[\s\S]{0,300}class="meta"/);
});
