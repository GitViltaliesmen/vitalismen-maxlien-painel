// Vit Power only. Persistent repository and existing router/senders are injected.
import { createHash, randomUUID } from 'node:crypto';
export const BURST_VERSION_V228 = 'vitpower-burst-v228';
export const BURST_QUIET_MS_V228 = 60000;
const hash = value => createHash('sha256').update(value).digest('hex');
export const burstDigestV228 = ids => hash(JSON.stringify(ids));
export function createVitPowerBurstV228({ repo, dispatch, policy, now = () => new Date() }) {
  if (!repo || typeof dispatch !== 'function' || typeof policy !== 'function') throw Error('burst_ports_required');
  let busy = false;
  async function enqueue(input) {
    const p = policy();
    if (!p.enabled || p.audience === 'QA_ONLY' && input.phone !== '5515998038637' || input.productKey !== 'vit_power_ec' || input.sessionId !== 'zapi') return { handled: false, reason: 'outside_scope' };
    if (input.initialEntry === true) return { handled: false, reason: 'greeting_first' };
    const verdict = await repo.eligible(input, p);
    if (!verdict.allowed) return { handled: verdict.terminal === true, reason: verdict.reason };
    const result = await repo.enqueue(input, now(), new Date(+now() + BURST_QUIET_MS_V228));
    return { handled: true, reason: result.duplicate ? 'duplicate' : 'quiet_window', dueAt: result.dueAt };
  }
  async function tick() {
    if (busy || !policy().enabled) return; busy = true;
    try {
      await repo.expire(now());
      for (const contactId of await repo.due(now())) {
        const token = randomUUID(), job = await repo.claim(contactId, token, now());
        if (!job) continue;
        const work = async () => {
          const current = await repo.check(contactId, job, policy(), now());
          if (!current.allowed) { await repo.block(contactId, token, current.reason); return; }
          const messages = await repo.messages(job);
          if (messages.length !== job.lockedIds.length || messages.some((m, i) => String(m._id) !== job.lockedIds[i])) {
            await repo.block(contactId, token, 'persisted_batch_mismatch'); return;
          }
          // Never replay an existing receipt after a worker restart or duplicate callback.
          const prior = await repo.history(job);
          if (prior) { await repo.finish(contactId, token, prior, now()); return; }
          const last = messages.at(-1);
          const message = { id: String(last._id), from: job.chatId, senderPn: job.phone, sessionId: 'zapi',
            body: messages.map(m => m.body).join('\n'), originalBodyV228: last.body, recovered: true,
            contactStateId: String(contactId), agent: 'vit_power_ec',
            vitPowerBurstV228: { version: BURST_VERSION_V228, token, digest: burstDigestV228(job.lockedIds), ids: [...job.lockedIds] } };
          await dispatch(message);
          const receipt = await repo.history(job);
          if (receipt) await repo.finish(contactId, token, receipt, now());
          else if (await repo.superseded(contactId, job)) await repo.defer(contactId, token);
          else await repo.uncertain(contactId, token, 'no_verified_reply_receipt');
        };
        try { await repo.withScope(contactId, token, work); }
        catch { await repo.safeUncertain(contactId, token, 'worker_or_provider_uncertain'); }
      }
    } finally { busy = false; }
  }
  return Object.freeze({ enqueue, tick });
}
export function assertBurstEnvelopeV228({ message, state, messages, now = new Date() }) {
  const envelope = message?.vitPowerBurstV228, job = state?.vitPowerBurstV228;
  if (!envelope || envelope.version !== BURST_VERSION_V228 || !job || job.version !== BURST_VERSION_V228
    || job.status !== 'processing' || job.lockToken !== envelope.token || +new Date(job.lockedUntil) <= +now
    || !Array.isArray(envelope.ids) || !envelope.ids.length || envelope.ids.length > 40
    || burstDigestV228(envelope.ids) !== envelope.digest || burstDigestV228(job.lockedIds) !== envelope.digest
    || state.phoneDigits !== String(message.senderPn) || message.sessionId !== 'zapi'
    || messages.length !== envelope.ids.length) throw Error('burst_envelope_invalid');
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (String(m._id) !== envelope.ids[i] || m.peerPhone !== state.phoneDigits || m.provider !== 'zapi'
      || m.sessionId !== 'zapi' || m.isFromMe !== false || m.ownerPhoneDigits !== '5531971862958'
      || typeof m.body !== 'string' || !m.body.trim()) throw Error('burst_persisted_input_invalid');
  }
  const last = messages.at(-1);
  if (String(last._id) !== String(message.id) || message.originalBodyV228 !== last.body
    || message.body !== messages.map(m => m.body).join('\n')) throw Error('burst_body_mismatch');
  return true;
}
