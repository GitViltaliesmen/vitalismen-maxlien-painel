import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { buildTexUltraEntryBlockV242 } from '../../../../src/services/texUltraEntryBlockV242Service.js';
const root = new URL('../', import.meta.url), before = fs.readFileSync(new URL('official/panel.html', root), 'utf8'), after = fs.readFileSync(new URL('panel-candidate.html', root), 'utf8');
const patch = JSON.parse(fs.readFileSync(new URL('PANEL_PATCH.json', root), 'utf8'));
test('five exact popup edits preserve the entire original main WhatsApp panel and manual composer', () => {
  let reverted = after;
  for (const row of [...patch.patches].reverse()) { assert.equal(reverted.split(row.after).length, 2); reverted = reverted.replace(row.after, row.before); }
  assert.equal(reverted, before);
  assert.equal(createHash('sha256').update(after).digest('hex'), patch.afterSha256);
  for (const id of ['dashboardFloatingChatV224', 'webChatDashboardDialogV222', 'webChatDashboardTitleV222', 'webChatComposerV235', 'chatList', 'conversation']) assert.ok(after.includes('id="' + id + '"'));
  const pos = after.indexOf(' function appendTexEntryV242'), start = after.lastIndexOf('<script>', pos), end = after.indexOf('</script>', pos);
  new vm.Script(after.slice(start + 8, end));
  assert.equal(after.slice(0, start), before.slice(0, before.lastIndexOf('<script>', before.indexOf(' function renderConversation'))));
});
function renderer() {
  const rows = [], mediaCalls = [];
  const element = (tag, text, css) => ({ tagName: tag, textContent: text, className: css, dataset: {}, style: {}, children: [], append(...values) { this.children.push(...values); } });
  const first = after.indexOf(' function appendTexEntryV242'), last = after.indexOf(' function renderConversation', first);
  const context = { element, format: () => 'hora', thread: { append: row => rows.push(row) }, renderMessageMedia: data => { mediaCalls.push(data); return '<safe-authenticated-media>'; } };
  vm.runInNewContext(after.slice(first, last) + ';globalThis.render=appendTexEntryV242;', context);
  return { render: context.render, rows, mediaCalls };
}
test('Tex entry uses the existing authenticated media renderer in the approved five-step order', () => {
  const f = renderer(), block = buildTexUltraEntryBlockV242({ firstName: 'Juan' });
  assert.equal(f.render({ role: 'assistant', at: '2026-11-17', entryBlock: block }), true);
  assert.deepEqual(f.rows.map(x => x.dataset.texEntryStep), ['greeting', 'intro', 'proof', 'bottle', 'offer']);
  assert.deepEqual(f.mediaCalls.map(x => x.mediaUrl), ['/media/templates/EC/CONHECER_NECESSIDADES_CLIENTES.mp3', '/media/sales/shared/social_01.jpeg', '/media/sales/ec/tex_ultra.png']);
  assert.ok(after.includes('hydrateAuthenticatedMedia(thread);remember(conversation)'));
  assert.ok(after.includes('whatsappPhone(item)===conversation.verifiedWhatsApp'));
});
test('foreign or executable media and a user-supplied entry block cannot become popup media', () => {
  for (const mutate of [b => b.steps[1].src = 'javascript:alert(1)', b => b.steps[2].src = 'https://foreign.invalid/image', b => b.productKey = 'vit_power_ec']) {
    const f = renderer(), block = buildTexUltraEntryBlockV242(); mutate(block);
    assert.equal(f.render({ role: 'assistant', entryBlock: block }), false); assert.equal(f.rows.length, 0); assert.equal(f.mediaCalls.length, 0);
  }
  const f = renderer(); assert.equal(f.render({ role: 'user', entryBlock: buildTexUltraEntryBlockV242() }), false);
});
