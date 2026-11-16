import { createOpenAiFreeflowCompletion } from './principalSdrFreeflowService.js';
import { getEcuadorOffer } from './ecuadorProductService.js';
import { createVitPowerWebAgentV220 } from './vitPowerWebAgentV220Service.js';
import { createVitPowerWebStoreV220 } from './vitPowerWebStoreV220Service.js';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { createWebVoiceV231, productionWebOrderAccessV231 } from './vitPowerWebVoiceStatusV231Service.js';
const PATH = '/api/web-chat/vitpower';
export function webChatRequestAllowedV220(req) {
  return req.method === 'POST' && String(req.originalUrl || req.path || '').split('?')[0] === PATH
    && globalThis.__VITALISMEN_EC_WEB_CHAT_V220?.requestAllowed?.(req) === true;
}
const cookieName = '__Host-vpchat-v220';
function tokenFrom(req) { const match = String(req.headers.cookie || '').match(/(?:^|;\s*)__Host-vpchat-v220=([a-f0-9]{64})(?:;|$)/); return match?.[1] || ''; }
const setCookie = (res, token, maxAge = 604800) => res.setHeader('Set-Cookie', cookieName + '=' + token + '; Path=/; Max-Age=' + maxAge + '; Secure; HttpOnly; SameSite=Lax');
export function createVitPowerWebChatHandlerV220({ authority = () => globalThis.__VITALISMEN_EC_WEB_CHAT_V220, store: providedStore, agent: providedAgent, now = () => Date.now() } = {}) {
  let store = providedStore, agent = providedAgent, active = 0;
  const voice = createWebVoiceV231({ apiKey: process.env.VITALISMEN_WEB_ELEVENLABS_API_KEY });
  const rates = new Map();
  return async function webChat(req, res) {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const cap = authority();
    if (!cap?.requestAllowed?.(req)) return res.status(403).json({ ok: false, error: 'chat_unavailable' });
    if (!req.is?.('application/json') || Number(req.headers['content-length'] || 0) > 4096) return res.status(415).json({ ok: false, error: 'invalid_request' });
    const body = req.body;
    if (!body || Array.isArray(body) || Object.keys(body).some(k => !['action', 'requestId', 'message', 'accessToken'].includes(k)) || !['start', 'message', 'clear', 'voice', 'order_status'].includes(body.action)) return res.status(400).json({ ok: false, error: 'invalid_request' });
    const ip = String(req.headers['x-vitalismen-chat-ip'] || '');
    if (!isIP(ip)) return res.status(403).json({ ok: false, error: 'invalid_request' });
    const key = createHash('sha256').update(ip).digest('hex'), window = Math.floor(now() / 600000);
    if (rates.size > 2000) for (const [k, v] of rates) if (v.window !== window) rates.delete(k);
    if (!rates.has(key) && rates.size >= 3000) { res.setHeader('Retry-After', '600'); return res.status(429).json({ ok: false, error: 'chat_busy', whatsappAvailable: true }); }
    const rate = rates.get(key)?.window === window ? rates.get(key) : { window, count: 0 };
    rate.count++; rates.set(key, rate);
    if (rate.count > 30 || rates.size > 3000) { res.setHeader('Retry-After', '600'); return res.status(429).json({ ok: false, error: 'chat_busy', whatsappAvailable: true }); }
    try {
      if (!store) store = createVitPowerWebStoreV220({ directory: cap.storeDirectory });
      if (body.action === 'clear') { await store.clear(tokenFrom(req)); setCookie(res, '', 0); return res.json({ ok: true, cleared: true }); }
      if (body.action === 'start') {
        const session = await store.open(tokenFrom(req)); setCookie(res, session.token);
        return res.json({ ok: true, version: 220, voiceReplyId: Object.entries(session.value.requests || {}).filter(([, row]) => row.status === 'done').at(-1)?.[0] || 'welcome_ana_lopez_v231', history: session.value.history, expiresAt: session.value.expiresAt, turnsRemaining: Math.max(0, 20 - session.value.turnCount) });
      }
      if (body.action === 'voice' || body.action === 'order_status') {
        const token = tokenFrom(req);
        if (!token) return res.status(401).json({ ok: false, error: 'session_expired' });
        const session = await store.open(token);
        if (session.fresh) return res.status(401).json({ ok: false, error: 'session_expired' });
        const sessionId = createHash('sha256').update(token).digest('hex');
        if (body.action === 'voice') {
          const audio = await voice({ sessionId, record: session.value, requestId: body.requestId });
          res.setHeader('Content-Type', 'audio/mpeg'); return res.send(audio);
        }
        if (typeof body.requestId !== 'string' || !/^[a-f0-9]{64}$/.test(body.accessToken || '')) return res.status(400).json({ ok: false, error: 'order_access_unavailable' });
        const result = await store.transact(token, body.requestId, 'Consultar estado de mi pedido', () => productionWebOrderAccessV231().read({ token: body.accessToken, sessionId }));
        return res.json(result);
      }
      if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 700 || typeof body.requestId !== 'string') return res.status(400).json({ ok: false, error: 'invalid_message' });
      if (active >= 2) { res.setHeader('Retry-After', '15'); return res.status(429).json({ ok: false, error: 'chat_busy', whatsappAvailable: true }); }
      active++;
      try {
      if (!agent) {
      const { EC_PRODUCT_INGREDIENTS } = await import('./ecProductIngredientsService.js');
      agent = createVitPowerWebAgentV220({
        complete: createOpenAiFreeflowCompletion({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL }),
        products: async () => ({ ok: true, verified: true, source: 'ecuadorProductService', products: [{ key: 'vit_power_ec', name: 'Vit Power Ecuador' }] }),
        offer: async quantity => { const v = getEcuadorOffer({ productKey: 'vit_power_ec', quantity, priceCatalog: 'normal' }); return v ? { ...v, ok: true, verified: true, source: 'ecuadorProductService', currency: 'USD' } : { ok: false }; },
        productInformation: async topic => topic === 'ingredients' ? { ok: true, verified: true, source: 'ecProductIngredientsService.EC_PRODUCT_INGREDIENTS.vit_power_ec', productKey: 'vit_power_ec', ingredients: [...EC_PRODUCT_INGREDIENTS.vit_power_ec.ingredients] } : { ok: false, unavailable: true },
        policy: async topic => topic === 'delivery' ? { ok: true, verified: true, source: 'existing-EC-delivery-modes-home-agency', text: 'Entrega: puede elegir domicilio o retiro en una agencia Servientrega. Validaremos ciudad y dirección o agencia antes de confirmar.' } : { ok: false, unavailable: true }
      });
      }
      const result = await store.transact(tokenFrom(req), body.requestId, body.message.trim(), context => agent.reply({ text: body.message.trim(), ...context })); return res.json(result); }
      finally { active--; }
    } catch (error) {
      const code = String(error?.message || '');
      if (/^voice_/.test(code)) return res.status(code === 'voice_busy' ? 429 : 503).json({ ok: false, error: code, textAvailable: true });
      if (/^order_access_/.test(code)) return res.status(403).json({ ok: false, error: 'order_access_unavailable', whatsappAvailable: true });
      if (/capacity|limit|busy/.test(code)) { res.setHeader('Retry-After', '60'); return res.status(429).json({ ok: false, error: 'chat_busy', whatsappAvailable: true }); }
      if (/session_required|session_expired/.test(code)) return res.status(401).json({ ok: false, error: 'session_expired', whatsappAvailable: true });
      if (/request_id|previous_outcome/.test(code)) return res.status(409).json({ ok: false, error: 'previous_request_not_repeated', whatsappAvailable: true });
      return res.status(503).json({ ok: false, error: 'chat_temporarily_unavailable', whatsappAvailable: true });
    }
  };
}
