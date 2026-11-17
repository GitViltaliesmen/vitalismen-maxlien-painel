// PROJECT=VITALISMEN_EC. Existing Tex entry block; no WhatsApp/order/Meta writer.
import { buildTexUltraEntryGreeting } from './texUltraEntryGreetingService.js';
import { TEX_ULTRA_EC_PRODUCT_PROFILE, texUltraPublicOfferText } from './texUltraProductProfile.js';

export const TEX_ULTRA_ENTRY_V242 = Object.freeze({
  id: 'tex_ultra_inicio_completo', version: 242, productKey: 'tex_ultra_ec',
  keys: Object.freeze(['greeting', 'intro', 'proof', 'bottle', 'offer']),
  assets: Object.freeze({
    intro: '/tex-assets/tex-entry-v242/intro.mp3',
    proof: '/tex-assets/tex-entry-v242/proof.jpeg',
    bottle: '/tex-assets/tex-entry-v242/bottle.png'
  })
});

// A preferred first name is not a legal/customer-order name or verified identity.
export function texUltraPreferredNameV242(value = '') {
  if (typeof value !== 'string') throw Error('tex_entry_name_invalid');
  const clean = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length > 60 || !/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(clean)) throw Error('tex_entry_name_invalid');
  const first = clean.split(' ')[0];
  if (first.length < 2 || first.length > 30 || /^(?:cliente|customer|desconocido|desconocida|unknown|null|undefined|hola|precio|stop)$/i.test(first)) throw Error('tex_entry_name_invalid');
  return first;
}

export function buildTexUltraEntryBlockV242({ firstName = '', date = new Date() } = {}) {
  const name = texUltraPreferredNameV242(firstName);
  const profile = TEX_ULTRA_EC_PRODUCT_PROFILE;
  if (profile.key !== 'tex_ultra_ec' || profile.entry.universalAudioName !== 'CONHECER_NECESSIDADES_CLIENTES'
    || profile.bottle.media !== '/media/sales/ec/tex_ultra.png') throw Error('tex_entry_source_unavailable');
  const greeting = buildTexUltraEntryGreeting({ name, date });
  const offer = 'Hoy tenemos estas opciones de Tex Ultra:\n' + texUltraPublicOfferText() + '\n\n¿Cuantos frascos desea?';
  return {
    id: TEX_ULTRA_ENTRY_V242.id, version: 242, productKey: profile.key,
    steps: [
      { key: 'greeting', type: 'text', text: greeting },
      { key: 'intro', type: 'audio', src: TEX_ULTRA_ENTRY_V242.assets.intro, text: 'Inicio universal Tex Ultra' },
      { key: 'proof', type: 'image', src: TEX_ULTRA_ENTRY_V242.assets.proof, text: 'Le comparto una experiencia de clientes de nuestra atencion en Ecuador.' },
      { key: 'bottle', type: 'image', src: TEX_ULTRA_ENTRY_V242.assets.bottle, text: profile.bottle.caption },
      { key: 'offer', type: 'text', text: offer }
    ]
  };
}

export function validateTexUltraEntryBlockV242(block) {
  if (!block || block.id !== TEX_ULTRA_ENTRY_V242.id || block.version !== 242 || block.productKey !== 'tex_ultra_ec'
    || !Array.isArray(block.steps) || block.steps.length !== 5) throw Error('tex_entry_block_invalid');
  for (let i = 0; i < 5; i++) {
    const step = block.steps[i], key = TEX_ULTRA_ENTRY_V242.keys[i];
    const type = key === 'intro' ? 'audio' : ['proof', 'bottle'].includes(key) ? 'image' : 'text';
    if (!step || step.key !== key || step.type !== type || typeof step.text !== 'string' || !step.text || step.text.length > 1200
      || Object.keys(step).some(name => !['key', 'type', 'text', 'src'].includes(name))) throw Error('tex_entry_block_invalid');
    if (type === 'text' ? Object.hasOwn(step, 'src') : step.src !== TEX_ULTRA_ENTRY_V242.assets[key]) throw Error('tex_entry_block_invalid');
  }
  return structuredClone(block);
}

export function startTexUltraEntryV242({ firstName = '', draft = {}, history = [], date = new Date() } = {}) {
  if (draft.texUltraEntryV242?.started === true) return {
    reply: 'El inicio de Tex Ultra ya está en esta conversación. Continuamos desde donde quedamos, sin repetirlo.',
    draft: { ...draft }, handoff: false, modelUsed: false
  };
  if (history.length || ['opted_out', 'human_requested', 'whatsapp_ready'].includes(draft.texUltraStage)) return {
    reply: 'Esta conversación ya comenzó. Continuamos desde donde quedamos, sin reiniciar el bloque de presentación.',
    draft: { ...draft }, handoff: draft.texUltraStage === 'human_requested' || draft.texUltraStage === 'whatsapp_ready', modelUsed: false
  };
  const name = texUltraPreferredNameV242(firstName);
  const block = buildTexUltraEntryBlockV242({ firstName: name, date });
  return {
    reply: block.steps[0].text + '\n\n' + block.steps[4].text,
    entryBlock: validateTexUltraEntryBlockV242(block),
    draft: { ...draft, ...(name ? { ...(!draft.name ? { name } : {}), preferredFirstName: name } : {}),
      texUltraEntryV242: { started: true, channel: 'web', startedAt: date.toISOString() },
      texUltraStage: draft.quantity ? 'quantity_selected' : 'awaiting_quantity' },
    handoff: false, modelUsed: false
  };
}

// The model may use the preferred name, never the server's verified phone or identity controls.
export async function withTexModelContextV242(run, input) {
  const protectedKeys = ['verifiedWhatsApp', 'firstContactChannel', 'texUltraEntryV242'];
  const safeDraft = { ...input.draft };
  for (const key of protectedKeys) delete safeDraft[key];
  const result = await run({ ...input, draft: safeDraft });
  const next = { ...input.draft, ...result.draft };
  for (const key of protectedKeys) {
    if (Object.hasOwn(input.draft, key)) next[key] = input.draft[key];
    else delete next[key];
  }
  return { ...result, draft: next };
}
