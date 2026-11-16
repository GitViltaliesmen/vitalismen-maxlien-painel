// PROJECT=VITALISMEN_EC. Partner URLs are message content only; no partner integration.
import { createHash, randomUUID } from 'node:crypto';
export const INVITE_GAP_V232 = 600000;
export const PARTNER_GAP_V232 = 43200000;
export const INVITE_SITE_V232 = 'https://taviazen.shop/vitpower_2026g';
export const PARTNER_FIRST_V232 = '🎁 ¡Tenemos kits en promoción con ofertas especiales! 🔥\n🌐 Visita nuestro sitio web asociado y descubre sus promociones: https://gira21x.com/\n\nSi no deseas recibir estas invitaciones, responde STOP.';
export const PARTNER_SECOND_V232 = 'Nace GIRAUP LATAM\nDespués de años acompañando preguntas, experiencias y diferentes caminos en salud y bienestar, damos un nuevo paso.\nCon la Dra. Maria Fernandes y otros especialistas invitados, nace un espacio para hablar de estudios, nuevas perspectivas y preguntas que todavía merecen ser investigadas.\nSi alguna vez te preguntaste por qué algo funciona para algunas personas y no de la misma manera para otras, este espacio es para ti.\n🎥 Mira nuestro primer video en YouTube:\nhttps://youtu.be/xguISlUDFVM\n🌐 Conoce GIRAUP LATAM:\nhttps://gira21x.com\n\nSi no deseas recibir estas invitaciones, responde STOP.';
const hash = value => createHash('sha256').update(value).digest('hex');
export const inviteKeyV232 = (phone, stage, orderId = '') => hash('VITALISMEN_EC:V232:' + phone + ':' + stage + ':' + orderId);
const stopText = value => /^(?:stop|baja|cancelar mensajes|no (?:me )?(?:escribas|contactes|env[ií]es)|no quiero (?:m[aá]s )?mensajes|parar|salir|unsubscribe)\b/i.test(String(value || '').trim());
const millis = value => Number.isFinite(+new Date(value || NaN)) ? +new Date(value) : 0;
export function inviteEligibilityV232(contact, now = Date.now()) {
  if (!contact || contact.countryCode !== 'EC' || !/^593[2-79]\d{8}$/.test(contact.phoneDigits || '') || contact.metadata?.testOnly || !contact.officialInboundVerified) return false;
  if (contact.blockedAutomatically || contact.metadata?.operatorNoAutoResend === true || contact.tags?.includes('manual:no_auto_resend')) return false;
  if (String(process.env.WHATSAPP_BLOCKED_RECIPIENTS || '').split(/[,\s]+/).some(value => value.replace(/\D/g, '') === contact.phoneDigits)) return false;
  if (contact.human?.mode === 'manual' || millis(contact.human?.pausedUntil) > now) return false;
  if (stopText(contact.lastInboundText) || contact.metadata?.optOut === true || contact.metadata?.doNotContact === true
      || (contact.tags || []).some(tag => /^(?:stop|opt.?out|no.?contact|bloqueado|do.?not.?contact|unsubscribed)$/i.test(tag))) return false;
  return true;
}
export function buildChatInviteV232({ name }) {
  const first = String(name || '').replace(/[\r\n\u0000-\u001f]/g, ' ').trim().split(/\s+/)[0].slice(0, 35);
  return 'Hola' + (first ? ', ' + first : '') + '. Soy Ana Lopez, del equipo Vitalismen Ecuador. 💬\n'
    + 'Ya puedes consultar el estado registrado de tu pedido en nuestro chat, además de resolver tus dudas sobre Vit Power.\n'
    + 'Abre el chat aquí:\n' + INVITE_SITE_V232 + '#consulta-pedido\n'
    + 'Elige Estado de mi pedido e introduce tu código privado. Si aún no lo tienes, solicítalo por este WhatsApp para verificar tu identidad. No compartas tu código.';
}
export function buildChatAccessInviteV236({ name } = {}) {
  const first = String(name || '').replace(/[\r\n\u0000-\u001f]/g, ' ').trim().split(/\s+/)[0].slice(0,35);
  return 'Hola' + (first ? ', ' + first : '') + '. Soy Ana Lopez, del equipo Vitalismen Ecuador. 💬\nAhora también puedes conversar con nosotros desde nuestra página y aclarar tus dudas sobre Vit Power.\nAbre aquí: ' + INVITE_SITE_V232 + '#chat\nToca Hablar con Ana y escribe tu pregunta. Para consultar un pedido, solicita tu código privado por este WhatsApp.\nSi no deseas recibir estas invitaciones, responde STOP.';
}
export async function runCustomerInviteV232({ repository, send, mirror, policy, now = Date.now(), clock = () => now, dryRun = true }) {
  if (!policy?.enabled) return { status: 'DISABLED', sent: 0, physicalOutboundCount: 0 };
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Guayaquil', hour: '2-digit', hourCycle: 'h23' }).format(now));
  if (hour < 8 || hour >= 19) return { status: 'OUTSIDE_EC_WINDOW', sent: 0, physicalOutboundCount: 0 };
  const rows = await repository.candidates(), seen = new Set();
  for await (const contact of rows) {
    const phone = contact.phoneDigits;
    if (seen.has(phone)) continue;
    seen.add(phone);
    if (await repository.stopped(phone) || !inviteEligibilityV232(contact, now)) continue;
    const order = contact.order;
    const stages = [];
    if (order && !contact.returned && !contact.deliveredVerified && order.productKey === 'vit_power_ec' && ['confirmed', 'processing', 'shipped'].includes(order.status)) stages.push({ stage: 'CHAT_ORDER', orderId: order.orderId });
    const lastActivity = Math.max(millis(contact.lastInboundAt), millis(contact.lastOutboundAt));
    if (policy.generalChat === true && !contact.returned && lastActivity > 0 && now - lastActivity >= INVITE_GAP_V232) stages.push({ stage: 'CHAT_ACCESS', orderId: '' });
    const absent = lastActivity > 0 && now - lastActivity >= PARTNER_GAP_V232;
    const delivered = (order?.status === 'delivered' || contact.deliveredVerified === true) && !contact.returned;
    if (!contact.returned && (delivered || absent)) {
      const first = await repository.entry(inviteKeyV232(phone, 'PARTNER_1'));
      if (!first) stages.push({ stage: 'PARTNER_1', orderId: '' });
      else if (first.state === 'sent' && millis(first.sentAt) + PARTNER_GAP_V232 <= now && absent) stages.push({ stage: 'PARTNER_2', orderId: '' });
    }
    for (const item of stages) {
      const key = inviteKeyV232(phone, item.stage, item.orderId);
      if (await repository.entry(key) || await repository.historyHas({ phone, key, ...item })) continue;
      if (dryRun) return { status: 'PASS_DRY_RUN', eligible: true, stage: item.stage, sent: 0, physicalOutboundCount: 0 };
      const lockToken = randomUUID();
      if (!await repository.claimGlobal({ now: clock(), lockToken, gap: INVITE_GAP_V232 })) return { status: 'WAIT_TEN_MINUTE_SLOT', sent: 0, physicalOutboundCount: 0 };
      if (!await repository.reserve({ key, phone, ...item, lockToken, now: clock() })) return { status: 'ALREADY_RESERVED', sent: 0, physicalOutboundCount: 0 };
      let attempted = false;
      try {
        const fresh = await repository.refresh(contact);
        if (!inviteEligibilityV232(fresh, clock()) || await repository.stopped(phone)) {
          await repository.finish(key, lockToken, { state: 'suppressed', reason: 'recipient_became_ineligible' });
          return { status: 'RECIPIENT_CHANGED', sent: 0, physicalOutboundCount: 0 };
        }
        const body = item.stage === 'CHAT_ACCESS' ? buildChatAccessInviteV236({ name: fresh.customerDraft?.name || fresh.name || order?.name })
          : item.stage === 'CHAT_ORDER' ? buildChatInviteV232({ name: order.name })
          : item.stage === 'PARTNER_1' ? PARTNER_FIRST_V232 : PARTNER_SECOND_V232;
        // Both the permanent reservation and attempt marker precede the external effect.
        await repository.markAttempt(key, lockToken, clock()); attempted = true;
        const response = await send({ phone, message: body, key, lockToken });
        const providerMessageId = String(response?.messageId || response?.id || response?.zaapId || '');
        if (!providerMessageId) throw Error('invite_provider_receipt_missing');
        await repository.finish(key, lockToken, { state: 'sent', sentAt: new Date(clock()), providerMessageId });
        // Bearer links never enter the panel history or model context.
        try { await mirror({ phone, body: body.replace(/#pedido=[a-f0-9]{64}/g, '#pedido=[acceso-privado]'), response, key, orderId: item.orderId }); } catch { /* The SENT reservation remains final even if the mirror is unavailable. */ }
        return { status: 'PASS_SENT_ONCE', stage: item.stage, sent: 1, physicalOutboundCount: 1 };
      } catch {
        await repository.finish(key, lockToken, { state: attempted ? 'ambiguous' : 'suppressed', reason: attempted ? 'no_automatic_retry_after_attempt' : 'pre_send_validation_failed' });
        return { status: attempted ? 'AMBIGUOUS_NO_RETRY' : 'SUPPRESSED_BEFORE_SEND', sent: 0, physicalOutboundCount: attempted ? 1 : 0 };
      }
    }
  }
  return { status: dryRun ? 'PASS_DRY_RUN' : 'NO_ELIGIBLE_RECIPIENT', sent: 0, physicalOutboundCount: 0 };
}

export async function processCustomerInvitesV232({ dryRun = true, now = new Date() } = {}) {
  const policy = globalThis.__VITALISMEN_EC_CUSTOMER_INVITES_V232?.readPolicy?.();
  if (!policy?.enabled) return { status: 'DISABLED', sent: 0, physicalOutboundCount: 0 };
  const [{ default: Ledger }, { default: Contacts }, { default: Orders }, { default: Messages }, { default: Shipments }, { sendZapiText }, { recordZapiOutboundMirror }, { withCustomerInviteDeliveryV232 }, { operatorNoAutoResendForTarget }, { giraOutboundAllowed }] = await Promise.all([
    import('../models/CustomerInviteDispatchV232.js'), import('../models/ContactState.js'), import('../models/Order.js'), import('../models/Message.js'), import('../models/Shipment.js'), import('./zapiClient.js'), import('./zapiOutboundMirrorService.js'), import('./customerInviteContextV232Service.js'), import('./operatorNoAutoResendService.js'), import('./gira21x/cohort.mjs')
  ]);
  const official = phone => Messages.exists({ peerPhone: phone, provider: 'zapi', sessionId: 'zapi', ownerPhoneDigits: '5531971862958', isFromMe: false });
  const repository = {
    async *candidates() {
      const rows = await Contacts.find({ countryCode: 'EC', phoneDigits: /^593[2-79]\d{8}$/, 'metadata.testOnly': { $ne: true } }).sort({ lastOutboundAt: 1, _id: 1 }).limit(1200).lean();
      for (const row of rows) {
        row.blockedAutomatically = await operatorNoAutoResendForTarget({ recipientDigits: row.phoneDigits });
        row.officialInboundVerified = !!await official(row.phoneDigits);
        if (!row.officialInboundVerified) continue;
        const order = await Orders.findOne({ country: 'EC', 'customer.phone': { $in: [row.phoneDigits, '+' + row.phoneDigits] } }).sort({ createdAt: -1 }).select('orderId customer.name status productKey tracking.productKey').lean();
        if (order) row.order = { orderId: order.orderId, name: order.customer?.name, status: order.status, productKey: order.tracking?.productKey || order.productKey };
        const shipment = await Shipments.findOne({ country: 'EC', 'client.phone': { $in: [row.phoneDigits, '+' + row.phoneDigits] }, ...(order?.orderId ? { orderId: order.orderId } : {}) }).sort({ createdAt: -1 }).select('outcomes logistics.status logistics.canonicalStatus review.manualOnly').lean();
        if (shipment?.review?.manualOnly === true) row.blockedAutomatically = true;
        const shipping = [shipment?.logistics?.status, shipment?.logistics?.canonicalStatus].map(value => String(value || '').toUpperCase());
        row.returned = ['returned', 'cancelled'].includes(order?.status) || shipment?.outcomes?.returned === true || shipping.some(value => ['RETURNED', 'DEVUELTO', 'CANCELLED', 'CANCELADO'].includes(value));
        row.deliveredVerified = !row.returned && (order?.status === 'delivered' || shipment?.outcomes?.delivered === true || shipment?.outcomes?.pickedUp === true || shipping.some(value => ['DELIVERED', 'ENTREGADO', 'PICKED_UP'].includes(value)));
        yield row;
      }
    },
    async refresh(row) { const value = await Contacts.findById(row._id).lean(); return value ? { ...value, blockedAutomatically: await operatorNoAutoResendForTarget({ recipientDigits: value.phoneDigits }), officialInboundVerified: !!await official(value.phoneDigits) } : null; },
    async stopped(phone) {
      if (await Ledger.exists({ _id: inviteKeyV232(phone, 'OPT_OUT') })) return true;
      const row = await Contacts.findOne({ phoneDigits: phone }).sort({ lastInboundAt: -1 }).select('lastInboundText metadata tags').lean();
      const historicStop = await Messages.exists({ peerPhone: phone, provider: 'zapi', sessionId: 'zapi', ownerPhoneDigits: '5531971862958', isFromMe: false, body: /^(?:stop|baja|cancelar mensajes|no (?:me )?(?:escribas|contactes|env[ií]es)|no quiero (?:m[aá]s )?mensajes|parar|salir|unsubscribe)\b/i });
      if (!stopText(row?.lastInboundText) && !historicStop) return false;
      if (!dryRun) await Ledger.updateOne({ _id: inviteKeyV232(phone, 'OPT_OUT') }, { $setOnInsert: { phone, stage: 'OPT_OUT', state: 'suppressed', reason: 'customer_stop' } }, { upsert: true });
      return true;
    },
    entry: key => Ledger.findById(key).lean(),
    async historyHas({ phone, key, stage, orderId }) {
      const match = stage === 'CHAT_ACCESS' ? { body: /https:\/\/taviazen\.shop\/vitpower_2026g(?:[#?\s]|$)/i }
        : stage === 'CHAT_ORDER' ? { $or: [{ dedupeKey: key }, { orderId, body: /Ya puedes consultar el estado registrado de tu pedido/ }] }
        : { body: stage === 'PARTNER_1' ? /gira21x\.com/i : /Nace GIRAUP LATAM|xguISlUDFVM/i };
      return !!await Messages.exists({ peerPhone: phone, isFromMe: true, ...match });
    },
    async claimGlobal({ now, lockToken, gap }) {
      try { await Ledger.updateOne({ _id: 'GLOBAL_EC_V232' }, { $setOnInsert: { state: 'global', stage: 'GLOBAL' } }, { upsert: true }); } catch (error) { if (error.code !== 11000) throw error; }
      return !!await Ledger.findOneAndUpdate({ _id: 'GLOBAL_EC_V232', $or: [{ lastAttemptAt: { $exists: false } }, { lastAttemptAt: { $lte: new Date(now - gap) } }] }, { $set: { lastAttemptAt: new Date(now), lockToken, lockedUntil: new Date(now + gap) } }, { new: true });
    },
    async reserve({ key, ...row }) {
      try { await Ledger.create({ _id: key, ...row, state: 'reserved', lockedUntil: new Date(row.now + 600000) }); return true; }
      catch (error) { if (error.code === 11000) return false; throw error; }
    },
    async markAttempt(key, lockToken, now) { const result = await Ledger.updateOne({ _id: key, lockToken, state: 'reserved' }, { $set: { state: 'attempted', attemptedAt: new Date(now) } }); if (result.modifiedCount !== 1) throw Error('invite_reservation_lost'); const quota = await Ledger.updateOne({ _id: 'GLOBAL_EC_V232', lockToken }, { $set: { lastAttemptAt: new Date(now), lockedUntil: new Date(now + 600000) } }); if (quota.matchedCount !== 1) throw Error('invite_global_slot_lost'); },
    async finish(key, lockToken, result) { await Ledger.updateOne({ _id: key, lockToken }, { $set: result }); }
  };
  return runCustomerInviteV232({ repository, policy, now: +now, clock: Date.now, dryRun, send: async args => {
      if (!globalThis.__VITALISMEN_EC_CUSTOMER_INVITES_V232?.readPolicy?.().enabled) throw Error('invite_policy_not_active');
      if (!await giraOutboundAllowed(args.phone + '@c.us', { provider: 'zapi', sessionId: 'zapi', recipientDigits: args.phone, country: 'EC' }, 'text')) throw Error('existing_recipient_cohort_guard_blocked');
      return withCustomerInviteDeliveryV232(args, () => sendZapiText({ phone: args.phone, message: args.message }));
    },
    mirror: async ({ phone, body, response, key, orderId }) => {
      const result = await recordZapiOutboundMirror({ phone, body, response });
      if (result?.id) await Messages.updateOne({ _id: result.id }, { $set: { dedupeKey: key, ...(orderId ? { orderId } : {}) } });
      await Contacts.updateOne({ phoneDigits: phone }, { $set: { lastOutboundAt: new Date() } });
    }
  });
}
