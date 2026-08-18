import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/buyLaterDateReminderFreezeRuntimeGuardV24.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const service = read('src/services/adminBuyLaterFollowupService.js');
const model = read('src/models/ContactState.js');
const route = read('src/routes/whatsapp.js');
const panel = read('public/qr.html');
const leadsPanel = read('public/leads-window.html');
const scheduler = read('src/services/schedulerService.js');
const packageJson = JSON.parse(read('package.json'));
const workflow = read('.github/workflows/ec-panel-quality.yml');
const index = read('src/index.js');

assert.match(index, /import '\.\/services\/buyLaterDateReminderFreezeRuntimeGuardV24\.js';/);
assert.match(service, /ContactState\.findOneAndUpdate/);
assert.match(service, /Message\.findOne/);
assert.match(service, /'buyLaterReminder\.lockUntil'/);
assert.match(service, /'buyLaterReminder\.sentAt'/);
assert.match(service, /'buyLaterReminder\.failedAt'/);
assert.match(service, /outboundContext: 'buy_later_date_reminder'/);
assert.doesNotMatch(service, /sendAudio|sendImage|sendVideo|sendDocument|sendPurchaseEvent/);
assert.match(model, /buyLaterReminder:/);
assert.match(model, /desiredOrderDate:/);
assert.match(route, /buy_later_date_required/);
assert.match(route, /applyBuyLaterReminderFromDraft/);
assert.match(panel, /id="customerBuyLaterDateInput" type="date"/);
assert.match(panel, /Nenhum pedido será criado automaticamente/);
assert.match(leadsPanel, /aviso unico sera enviado entre 4 e 3 dias antes/);
assert.match(leadsPanel, /:00-05:00/);
assert.match(scheduler, /flagEnabled\('ADMIN_BUY_LATER_FOLLOWUP_ENABLED', false\)/);
assert.match(packageJson.scripts['senior:check'], /guard-buy-later-date-reminder-v24\.mjs/);
assert.match(packageJson.scripts['senior:check'], /buy-later-date-reminder-v24\.test\.mjs/);
assert.match(workflow, /tests\/buy-later-date-reminder-v24\.test\.mjs/);
assert.match(workflow, /scripts\/guard-buy-later-date-reminder-v24\.mjs/);

console.log('BUY_LATER_DATE_REMINDER_V24_GUARD=OK');
