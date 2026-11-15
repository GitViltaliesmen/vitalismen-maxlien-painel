// PROJECT=VITALISMEN_EC. Pure intent/fact formatting; no network or persistence.
const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const patterns = [
  ['payment', /\b(?:pago|pagos|pagar|paga|tarjeta|transferencia|efectivo|contra[_ ]entrega)\b/g],
  ['price', /\b(?:precios?|cuanto (?:cuestan?|valen?|salen?|son|es|pago)|cuesta|valor|costo|total|oferta|promocion)\b/g],
  ['delivery', /\b(?:entrega|envio|enviar|recibir|recibe|domicilio|servientrega|agencia|llega|demora|tarda)\b/g],
  ['delivery_cost', /consulta_envio/g],
  ['guarantee', /\b(?:garantia|devolucion|reembolso)\b/g],
  ['stock', /\b(?:stock|disponible|disponibilidad|unidades|existencias)\b/g],
  ['ingredients', /\b(?:ingredientes?|composicion|formula|componentes?|que contiene|que trae)\b/g],
  ['usage', /\b(?:como (?:se )?(?:toma|usa)|modo de uso|dosis)\b/g],
  ['safety', /\b(?:diabetes|diabetico|presion|hipertension|corazon|medicamento|medicina|contraindicacion|alergia|renal|higado|embarazo)\b/g]
];
export function questionPlanV219(text) {
  const raw = String(text || '').slice(0, 6000);
  if ([...raw.matchAll(/^(?:nombre|ciudad|provincia|direccion|agencia|cantidad)\s*:/gim)].length >= 2) return [];
  const hasQuestion = /[?¿]/.test(raw) || /\b(?:cuanto|como|cual|donde|cuando|que contiene|hay|tienen|aceptan|se puede)\b/.test(norm(raw));
  if (!hasQuestion) return [];
  const marked = [...raw.matchAll(/¿([^¿?]+)\??/g)].map(m => m[1]);
  let body = norm(marked.length ? marked.join('\n') : raw);
  body = body.replace(/contra entrega/g, 'contra_entrega').replace(/(?:cuanto cuesta|precio|costo|valor)(?: el| del| de)? (?:envio|flete)/g, 'consulta_envio');
  const found = [];
  for (const [topic, pattern] of patterns) {
    pattern.lastIndex = 0;
    const m = pattern.exec(body);
    if (m) found.push({ topic, position: m.index });
  }
  return found.sort((a, b) => a.position - b.position);
}
export function prioritizeFreeflowV219({ productKey, enabled, text }) {
  return enabled === true && productKey === 'vit_power_ec' && questionPlanV219(text).length > 0;
}
export const verifiedQuestionFactV219 = value => value?.ok === true && value.verified === true && typeof value.source === 'string' && value.source.trim().length > 0;
export function formatQuestionAnswerV219(topic, result) {
  if (!verifiedQuestionFactV219(result)) {
    const labels = { payment: 'Forma de pago', guarantee: 'Garantía', stock: 'Disponibilidad', delivery: 'Entrega', delivery_cost: 'Costo de envío', ingredients: 'Composición', usage: 'Modo de uso', safety: 'Consulta de salud', price: 'Precio' };
    return `${labels[topic] || 'Su consulta'}: necesito que una persona del equipo confirme esta información; no quiero darle una condición incorrecta.`;
  }
  if (topic === 'price') {
    const offers = result.offers || [result];
    if (!offers.length || offers.some(o => !verifiedQuestionFactV219(o) || o.productKey !== 'vit_power_ec' || ![1, 2, 3, 6].includes(o.quantity) || o.currency !== 'USD' || !Number.isFinite(o.total) || o.total <= 0)) throw Error('v219_unverified_price');
    return 'Precio: ' + offers.map(o => `${o.quantity} frasco${o.quantity > 1 ? 's' : ''}: USD ${o.total.toFixed(2)}`).join('; ') + '.';
  }
  if (topic === 'ingredients') {
    if (result.productKey !== 'vit_power_ec' || !Array.isArray(result.ingredients) || !result.ingredients.length || result.ingredients.some(x => typeof x !== 'string' || x.length > 80)) throw Error('v219_unverified_ingredients');
    return 'Composición de Vit Power: ' + result.ingredients.join(', ') + '.';
  }
  if (topic === 'stock') {
    if (typeof result.available !== 'boolean') throw Error('v219_unverified_stock');
    return result.available ? 'Disponibilidad: la fuente oficial consultada indica existencias.' : 'Disponibilidad: la fuente oficial consultada indica que no hay existencias.';
  }
  if (typeof result.text !== 'string' || !result.text.trim() || result.text.length > 700 || /https?:|<script|\[ENVIAR_/i.test(result.text)) throw Error('v219_unverified_policy');
  return result.text.trim();
}

export function allQuestionsMappedV219(text) {
  const segments = [...String(text || '').matchAll(/¿([^¿?]+)\??/g)].map(m => m[1]);
  return segments.length < 2 || segments.every(segment => questionPlanV219('¿' + segment + '?').length > 0);
}
