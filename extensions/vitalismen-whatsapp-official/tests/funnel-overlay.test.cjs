const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const launcher = fs.readFileSync(path.join(root, 'whatsapp-funnel-launcher.js'), 'utf8');
const overlay = fs.readFileSync(path.join(root, 'funnel-overlay.js'), 'utf8');
const sidepanelHtml = fs.readFileSync(path.join(root, 'sidepanel.html'), 'utf8');
const sidepanel = fs.readFileSync(path.join(root, 'sidepanel.js'), 'utf8');
const contentScript = fs.readFileSync(path.join(root, 'content-script.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const mainBridge = fs.readFileSync(path.join(root, 'whatsapp-main-bridge.js'), 'utf8');

const whatsAppScripts = manifest.content_scripts
    .find((entry) => entry.matches.includes('https://web.whatsapp.com/*') && entry.world === 'ISOLATED')
    .js;

assert.equal(manifest.version, '0.13.3');
assert.ok(whatsAppScripts.includes('whatsapp-funnel-launcher.js'));
assert.ok(manifest.web_accessible_resources[0].resources.includes('funnel-overlay.html'));
assert.match(launcher, /document\.querySelector\('#main footer'\)/);
assert.match(launcher, /startDrag/);
assert.match(launcher, /startResize/);
assert.match(launcher, /overlay\.offsetHeight < MIN_HEIGHT/);
assert.match(launcher, /savedHeight >= MIN_HEIGHT/);
assert.match(launcher, /INSTALL_VERSION = '0\.13\.3'/);
assert.match(launcher, /previousButton\.cloneNode/);
assert.match(overlay, /\/api\/whatsapp\/templates\?country=EC/);
assert.match(overlay, /sendThroughWhatsAppWeb/);
assert.match(overlay, /label: 'Enviar'/);
assert.match(overlay, /label: 'Enviar completo'/);
assert.match(overlay, /sendLegacyBlock/);
assert.match(overlay, /button\.addEventListener\('click', async \(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);/);
assert.doesNotMatch(overlay, /\}, \{ capture: true \}\);/);
assert.match(overlay, /const activeSelection = await send\(\{ action: 'activeChatStatus' \}\)/);
assert.match(overlay, /const currentSelection = await send\(\{ action: 'activeChatStatus' \}\)/);
assert.match(overlay, /A conversa ativa mudou\. Envio interrompido/);
assert.match(overlay, /window\.confirm\(`Enviar o funil completo/);
assert.match(overlay, /document\.createElement\('audio'\)/);
assert.match(overlay, /sendThroughWpp/);
assert.doesNotMatch(overlay, /\/api\/whatsapp\/send/);
assert.doesNotMatch(overlay, /label: 'Copiar'|label: 'Baixar'/);
assert.match(mainBridge, /WPP\.chat\.sendTextMessage/);
assert.match(mainBridge, /WPP\.chat\.sendFileMessage/);
assert.match(mainBridge, /getActiveChat/);
assert.match(mainBridge, /isPtt = true/);
assert.ok(fs.existsSync(path.join(root, 'vendor', 'wppconnect-wa.js')));
assert.match(serviceWorker, /files: \['vendor\/wppconnect-wa\.js'\]/);
assert.match(serviceWorker, /document\.readyState !== 'complete'/);
assert.match(serviceWorker, /chrome\.tabs\.reload/);
assert.match(contentScript, /vitalismenWhatsAppLabelsV1/);
assert.match(contentScript, /cell-frame-title/);
assert.match(contentScript, /matches\.length === 1/);
assert.match(contentScript, /data-stale/);
assert.match(overlay, /saveContactLabel/);
assert.match(overlay, /\/api\/whatsapp\/chat-labels\//);
assert.match(launcher, /data-action="status-select"/);
assert.match(serviceWorker, /vitalismenOperationalLabelsSync/);
assert.match(sidepanelHtml, /id="googleContactsCard"/);
assert.match(sidepanel, /\/api\/integrations\/google-contacts\/status/);
assert.match(sidepanel, /action: 'sendWhatsAppText'/);
assert.doesNotMatch(sidepanel, /textContent = 'Copiar'/);
assert.equal(manifest.permissions.includes('clipboardWrite'), false);
assert.doesNotMatch(overlay, /execCommand\(['"]insertText/);
assert.match(contentScript, /__vitalismenContactSyncInstalled/);
assert.match(serviceWorker, /ensureWhatsAppContentScripts/);
assert.match(serviceWorker, /\/api\/whatsapp\/templates/);
assert.match(serviceWorker, /\/api\/shipments\/servientrega\/ec\/agencies/);
assert.match(sidepanelHtml, /<script src="agency-catalog\.js"><\/script>/);
assert.match(sidepanelHtml, /<script src="agency-batch\.js"><\/script>/);
assert.match(sidepanelHtml, /id="agencySuggestions"/);
assert.match(sidepanelHtml, /id="sendAgencyListBtn"/);
assert.match(sidepanel, /chrome\.runtime\.getURL\('agencia_LISTA\.json'\)/);
assert.match(sidepanel, /limit: 500/);
assert.match(sidepanel, /agencyIntroSentPhones\.has\(phone\)/);
assert.match(sidepanel, /startNumber: state\.agencySuggestionOffset \+ 1/);

const sidepanelIds = [...sidepanelHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(
    new Set(sidepanelIds).size,
    sidepanelIds.length,
    'a ficha moderna não deve repetir IDs/campos no HTML'
);

const selectionBlocks = sidepanel.match(/state\.productFunnelOpen = false;/g) || [];
assert.ok(selectionBlocks.length >= 3, 'funil lateral deve permanecer fechado nas trocas de cliente');

console.log('WhatsApp composer launcher and movable funnel overlay: OK');
