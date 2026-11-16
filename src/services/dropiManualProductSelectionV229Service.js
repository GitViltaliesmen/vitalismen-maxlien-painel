// A historical keyword cannot undo a later authenticated choice for this order.
// This only resolves product evidence; authorization, price and duplicate guards remain separate.
const timestamp = value => value instanceof Date ? value.getTime()
  : typeof value === 'string' && value.trim() ? Date.parse(value) : Number.NaN;
export function currentManualDropiSelectionV229({ order, contact, productKey, conflictingMessage, now = new Date() } = {}) {
  const phone = String(order?.customer?.phone || '').replace(/\D/g, '');
  const lock = contact?.metadata?.productRouteLock || {};
  const draft = contact?.metadata?.customerDraft || {};
  const selectedAt = timestamp(lock.lockedAt);
  const confirmedAt = timestamp(order?.confirmedAt);
  const conflictAt = timestamp(conflictingMessage?.createdAt);
  return order?.country === 'EC' && order?.source === 'manual'
    && /^593[2-79]\d{8}$/.test(phone) && contact?.phoneDigits === phone
    && Boolean(order?.orderId) && draft.orderId === order.orderId
    && lock.active === true && lock.source === 'panel_customer_product_selection'
    && lock.reason === 'operator_selected_current_negotiation_product'
    && typeof lock.selectedBy === 'string' && Boolean(lock.selectedBy.trim())
    && ['vit_power_ec', 'tex_ultra_ec', 'nitrix_ec'].includes(productKey)
    && lock.productKey === productKey && draft.productKey === productKey
    && order.tracking?.productKey === productKey
    && Number.isFinite(selectedAt) && Number.isFinite(confirmedAt) && Number.isFinite(conflictAt)
    && conflictAt < selectedAt && selectedAt <= confirmedAt && confirmedAt <= +new Date(now);
}
