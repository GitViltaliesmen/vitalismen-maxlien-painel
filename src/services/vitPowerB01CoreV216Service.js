import { createHash, randomUUID } from 'node:crypto';

export const B01_VERSION = 'vit-power-b01-v216';
export const B01_MEDIA = Object.freeze([
  { kind: 'audio', label: 'Inicio universal 01', asset: '/media/templates/EC/01_B_Buenos_dias.ogg' },
  { kind: 'audio', label: 'Inicio universal 02', asset: '/media/templates/EC/01_C_Buenos_tardes.ogg' },
  { kind: 'image', label: 'Prova 1', asset: '/media/sales/shared/social_01.jpeg' },
  { kind: 'image', label: 'Frasco Vit Power', asset: '/media/sales/ec/vit_power.jpeg' }
]);
const clean = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
export function firstName(text = '') {
  const match = String(text).match(/(?:^|\n)\s*(?:nombre|nome)\s*:\s*([^\n]{1,80})/i);
  const name = (match?.[1] || '').trim().split(/\s+/)[0];
  return name && /^[\p{L}][\p{L}'’-]{0,39}$/u.test(name) ? name : '';
}
export function isB01GenericEntry(text = '') {
  const body = String(text).replace(/(?:^|\n)\s*(?:nombre|nome)\s*:[^\n]*/gi, '').trim();
  const normalized = clean(body);
  if (/^(hola|holaa|buenas|buenos dias|buenas tardes|buenas noches|saludos)$/.test(normalized)) return true;
  // Exact public CTA and a small set of generic intentions; specific questions keep priority.
  return normalized === clean('Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?')
    || /^(hola )?(quiero|deseo|necesito) (informacion|info|conocer) (sobre |de |del )?(vit power|producto|tratamiento)$/.test(normalized);
}
export function b01Greeting(name, date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Guayaquil', hour: '2-digit', hourCycle: 'h23' }).format(date));
  const greeting = hour >= 5 && hour < 12 ? '¡Buenos días' : hour >= 12 && hour < 19 ? '¡Buenas tardes' : '¡Buenas noches';
  return `${greeting}${name ? ', ' + name : ''}! Soy Ana Lopez, del equipo de la Dra. María Fernandes. Gracias por tu interés en Vit Power. Estoy aquí para ayudarte y aclarar tus dudas. Te comparto una breve presentación y seguimos conversando.`;
}
export function createB01({ repo, send, policy, now = () => new Date(), random = Math.random }) {
  const delay = (min, max) => min + Math.floor(Math.min(.999999, Math.max(0, random())) * (max - min + 1));
  async function start(input) {
    const existing = await repo.get(input.contactId);
    if (existing) {
      if (input.origin === 'manual') return { handled: true, job: existing, reason: 'existing_progress' };
      if (existing.inboundId === input.inboundId) return { handled: true, reason: 'same_inbound', job: existing };
      await repo.interrupt(input.contactId, 'new_inbound');
      return { handled: false, reason: 'new_inbound' };
    }
    const p = policy();
    if (!p.enabled || input.productKey !== 'vit_power_ec' || input.sessionId !== 'zapi'
      || !/^(?:593[2-79]\d{8}|5515998038637)$/.test(input.phone)) return { handled: false, reason: 'outside_scope' };
    if (input.origin !== 'manual' && !isB01GenericEntry(input.text)) return { handled: false, reason: 'intent_priority' };
    const eligibility = await repo.eligible(input, p);
    if (!eligibility.allowed) return { handled: false, reason: eligibility.reason };
    const startedAt = now();
    const customerName = firstName(input.text) || firstName('Nombre: ' + (eligibility.name || ''));
    const greeting = { kind: 'text', label: 'Saudacao personalizada', text: b01Greeting(customerName, startedAt) };
    const job = { version: B01_VERSION, status: 'pending', origin: input.origin || 'automatic', phone: input.phone,
      chatId: input.chatId, sessionId: 'zapi', inboundId: input.inboundId, startedAt,
      manualStamp: eligibility.manualStamp || '', customerName, nextAt: new Date(+startedAt + delay(3000, 5000)), cursor: 0,
      steps: [greeting, ...B01_MEDIA].map(s => ({ ...s, status: 'pending' })) };
    const saved = await repo.start(input.contactId, job);
    // A lost start race belongs to the same presentation, never fall through to a second responder.
    return { handled: true, job: saved || await repo.get(input.contactId), reason: saved ? 'queued' : 'concurrent_start' };
  }
  async function tick() {
    if (!policy().enabled) return;
    await repo.expire(now()); // A crashed attempt is uncertain, never retried.
    async function dispatch(id) {
      const token = randomUUID();
      const job = await repo.claim(id, now(), token);
      if (!job) return;
      try {
        const verdict = await repo.check(id, job, policy());
        if (!verdict.allowed) { await repo.stop(id, token, 'interrupted', verdict.reason); return; }
        const step = job.steps[job.cursor];
        if (!step || step.status !== 'pending') { await repo.stop(id, token, 'ambiguous', 'invalid_step'); return; }
        const history = await repo.history(job, step);
        if (history) { await repo.stop(id, token, 'review', 'existing_media_history'); return; }
        const key = createHash('sha256').update(`${B01_VERSION}:${job.phone}:${job.cursor}`).digest('hex');
        if (!await repo.reserve(id, token, job.cursor, key, now())) return;
        // Check interruption and policy again after persistent reservation, immediately before transport.
        const fresh = await repo.check(id, job, policy());
        if (!fresh.allowed) { await repo.stop(id, token, 'interrupted', fresh.reason); return; }
        const result = await send(job, step, key);
        if (result?.ok !== true || result.provider !== 'zapi' || !result.providerMessageId) {
          await repo.stop(id, token, 'ambiguous', 'provider_result_unconfirmed'); return;
        }
        const nextAt = job.cursor === job.steps.length - 1 ? null : new Date(+now() + delay(18000, 30000));
        await repo.accept(id, token, job.cursor, result.providerMessageId, now(), nextAt);
      } catch {
        await repo.stop(id, token, 'ambiguous', 'attempt_requires_review');
      }
    }
    for (const id of await repo.due(now())) {
      if (repo.withScope) await repo.withScope(id, () => dispatch(id));
      else await dispatch(id);
    }
  }
  return Object.freeze({ start, tick });
}
