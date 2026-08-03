import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('extensions/vitalismen-whatsapp-official/manifest.json'));
const statusService = read('src/services/operationalChatStatusService.js');
const googleService = read('src/services/googleContactsService.js');
const routes = read('src/routes/whatsapp.js');
const integrationRoutes = read('src/routes/integrations.js');
const nginxSnippet = read('ops/nginx/ec.maxlien.shop-api-integrations.conf');
const extensionWorker = read('extensions/vitalismen-whatsapp-official/service-worker.js');
const launcher = read('extensions/vitalismen-whatsapp-official/whatsapp-funnel-launcher.js');

assert.equal(manifest.version, '0.13.1');
for (const key of [
    'atendendo', 'comprar_depois', 'confirmado', 'enviado', 'em_rota',
    'na_agencia', 'entregue', 'devolvido', 'cancelado'
]) assert.match(statusService, new RegExp(`${key}:`), `status ausente: ${key}`);

assert.match(routes, /router\.get\('\/chat-labels'/);
assert.match(routes, /router\.patch\('\/chat-labels\/:phone'/);
assert.match(routes, /kind: 'whatsapp_label_override'/);
assert.match(integrationRoutes, /google-contacts\/callback/);
assert.match(integrationRoutes, /adminOnly/);
assert.match(nginxSnippet, /location \^~ \/api\/integrations\//);
assert.match(nginxSnippet, /proxy_pass http:\/\/127\.0\.0\.1:3001/);
assert.match(googleService, /createCipheriv\('aes-256-gcm'/);
assert.match(googleService, /confirmedAt: \{ \$gte: integration\.enabledAt \}/);
assert.match(googleService, /phoneDigits\.startsWith\('593'\)/);
assert.match(googleService, /status: 'conflict'/);
assert.match(googleService, /RETRY_MINUTES = \[1, 5, 30\]/);
assert.doesNotMatch(googleService, /sendText|sendAudio|sendImage|sendVideo|droppi|dropi/i);
assert.match(extensionWorker, /vitalismenOperationalLabelsSync/);
assert.match(extensionWorker, /periodInMinutes: 1/);
assert.match(launcher, /data-action="status-select"/);
assert.match(launcher, /Voltar ao automático/);

console.log('[WHATSAPP_STATUS_GOOGLE_CONTACTS] OK: camada isolada, auditada e sem disparos.');
