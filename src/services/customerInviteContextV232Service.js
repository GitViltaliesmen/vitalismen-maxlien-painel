import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
const context = new AsyncLocalStorage();
const digits = value => String(value || '').replace(/\D/g, '');
const active = () => globalThis.__VITALISMEN_EC_CUSTOMER_INVITES_V232?.readPolicy?.().enabled === true;
export function customerInviteRecipientAllowedV232(value) {
  const scope = context.getStore(), phone = digits(value);
  if (!scope || scope.used || scope.phone !== phone || scope.until <= Date.now() || !active()) return false;
  scope.used = true;
  return true;
}
export async function withCustomerInviteDeliveryV232({ phone, key, lockToken }, work) {
  if (!active() || !/^593[2-79]\d{8}$/.test(phone || '') || !/^[a-f0-9]{64}$/.test(key || '') || !lockToken) throw Error('invite_dispatch_not_authorized');
  const [{ default: Ledger }, { default: Contact }, { default: Message }] = await Promise.all([import('../models/CustomerInviteDispatchV232.js'), import('../models/ContactState.js'), import('../models/Message.js')]);
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Guayaquil', hour: '2-digit', hourCycle: 'h23' }).format(now));
  if (hour < 8 || hour >= 19) throw Error('invite_outside_ec_send_window');
  const numbers = key => String(process.env[key] || '').split(/[,\s]+/).map(digits).filter(Boolean);
  if (numbers('WHATSAPP_BLOCKED_RECIPIENTS').includes(phone) || numbers('WHATSAPP_BLOCKED_SESSION_IDS').includes('5531971862958')) throw Error('invite_existing_outbound_block');
  const job = await Ledger.findOne({ _id: key, phone, lockToken, state: 'attempted', lockedUntil: { $gt: now }, dispatchClaimedAt: { $exists: false } }).lean();
  if (!job || !['CHAT_ORDER', 'CHAT_ACCESS', 'PARTNER_1', 'PARTNER_2'].includes(job.stage)) throw Error('invite_exact_attempt_required');
  const expected = createHash('sha256').update('VITALISMEN_EC:V232:' + phone + ':' + job.stage + ':' + (job.orderId || '')).digest('hex');
  if (expected !== key || !await Ledger.exists({ _id: 'GLOBAL_EC_V232', lockToken, lockedUntil: { $gt: now } })) throw Error('invite_global_reservation_required');
  const recipient = await Contact.findOne({ phoneDigits: phone, countryCode: 'EC', 'metadata.testOnly': { $ne: true } }).lean();
  if (!recipient || recipient.human?.mode === 'manual' || +new Date(recipient.human?.pausedUntil || 0) > +now) throw Error('invite_recipient_not_automatic');
  const { operatorNoAutoResendForTarget } = await import('./operatorNoAutoResendService.js');
  if (await operatorNoAutoResendForTarget({ recipientDigits: phone })) throw Error('invite_operator_no_auto_resend');
  if (await Ledger.exists({ _id: createHash('sha256').update('VITALISMEN_EC:V232:' + phone + ':OPT_OUT:').digest('hex') })) throw Error('invite_customer_stopped');
  if (!await Message.exists({ peerPhone: phone, provider: 'zapi', sessionId: 'zapi', ownerPhoneDigits: '5531971862958', isFromMe: false })) throw Error('invite_official_inbound_required');
  const claim = await Ledger.updateOne({ _id: key, phone, lockToken, state: 'attempted', dispatchClaimedAt: { $exists: false } }, { $set: { dispatchClaimedAt: now } });
  if (claim.modifiedCount !== 1) throw Error('invite_dispatch_already_claimed');
  return context.run({ phone, used: false, until: Math.min(+job.lockedUntil, +now + 60000) }, work);
}
