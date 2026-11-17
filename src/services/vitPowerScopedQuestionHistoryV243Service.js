// Only known receipts from this contact's official B01/SDR may explain an ownerless legacy mirror.
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 4000;
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 256;
export function vitPowerQuestionHistoryQueryV243({ state, saved = {}, phone, sessionId, ownerPhoneDigits, now }) {
  const query = { peerPhone: phone, sessionId, provider: 'zapi', isFromMe: true,
    $or: [{ createdAt: { $gte: new Date(+now - 86400000) } }, { updatedAt: { $gte: new Date(+now - 86400000) } }],
    body: { $type: 'string', $ne: '' } };
  // Preserve the old unowned-inbound case; real public inputs carry a verified owner.
  if (!ownerPhoneDigits) return query;
  const pairs = [], add = (providerMessageId, body) => {
    if (id(providerMessageId) && text(body)) pairs.push({ providerMessageId, body,
      $or: [{ ownerPhoneDigits: '' }, { ownerPhoneDigits: null }, { ownerPhoneDigits: { $exists: false } }] });
  };
  if (state?.phoneDigits === phone) {
    const job = state.vitPowerB01;
    if (job?.version === 'vit-power-b01-v216' && job.phone === phone && job.sessionId === sessionId
      && +new Date(job.startedAt) >= +now - 86400000 && +new Date(job.startedAt) <= +now) {
      for (const step of (job.steps || []).slice(0, 5)) if (step.kind === 'text' && step.status === 'accepted') add(step.providerMessageId, step.text);
    }
    const history = (saved.history || []).slice(-24).filter(row => row.role === 'assistant');
    for (const row of history) if (row.sessionId === sessionId && row.ownerPhoneDigits === ownerPhoneDigits) add(row.providerMessageId, row.sentBody ?? row.content);
    const last = history.at(-1);
    if (last && !Object.hasOwn(last, 'providerMessageId')) add(saved.lastOutboundProviderId, last.content);
  }
  query.$and = [{ $or: [{ ownerPhoneDigits }, ...pairs] }];
  return query;
}
