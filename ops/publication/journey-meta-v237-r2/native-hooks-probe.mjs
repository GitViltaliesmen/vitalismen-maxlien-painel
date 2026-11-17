import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const R=process.env.CANDIDATE_RELEASE;
const mongoose=(await import('file://'+R+'/node_modules/mongoose/index.js')).default;
const VslVisit=(await import('file://'+R+'/src/models/VslVisit.js')).default;
const ContactState=(await import('file://'+R+'/src/models/ContactState.js')).default;
const Message=(await import('file://'+R+'/src/models/Message.js')).default;
process.env.ONLINE_ADMIN_PANEL_SYNC_ENABLED = 'false';
const now = new Date(), active = new Date(now.getTime() - 60000).toISOString();
const sourceUrl = 'https://taviazen.shop/vitpower_2026g', dataset = '28298613626504767';
const context = { origin: 'https://taviazen.shop', sourceUrl, privacyAllowed: true,
  trustedClientContext: true, ip: '198.51.100.25', userAgent: 'Synthetic hook browser' };
const apiCalls = [];
globalThis.fetch = async (url, request) => {
  assert.equal(url, `https://graph.facebook.com/v22.0/${dataset}/events`);
  const payload = JSON.parse(request.body); apiCalls.push(payload.data[0]);
  return { status: 200, json: async () => ({ events_received: 1 }) };
};
Object.defineProperty(globalThis, '__VITALISMEN_EC_MEASUREMENT_V213', { value: Object.freeze({
  kind: 'SEALED_VITPOWER_MEASUREMENT_V213', dataset,
  readPolicy: () => ({ collectionApproved: true, approved: true, credentialsVerified: true, dataset, activatedAt: active }),
  clientContext: () => context, token: () => 'OFFLINE_ONLY_NEVER_TRANSMITTED',
}) });
await mongoose.connect('mongodb://127.0.0.1:27119/v213_isolated_fixture', { serverSelectionTimeoutMS: 10000 });
const { captureVitPowerMeasurementV213, claimVitPowerReferenceV213, observeVitPowerDraftV213, observeVitPowerPendingV213, measurementMongoAllowedV213, measurementRateLimitKeyV213 } =
  await import('file://'+R+'/src/services/vitPowerMeasurementV213Application.js');
const Order = (await import('file://'+R+'/src/models/Order.js')).default;
await Promise.all([VslVisit.init(), ContactState.init(), Message.init(), Order.init()]);
for (const method of ['insertOne', 'insertMany', 'updateOne', 'findOneAndUpdate', 'deleteOne']) {
  const original = mongoose.Collection.prototype[method]; if (!original) continue;
  mongoose.Collection.prototype[method] = function (...args) {
    const name = String(this.name || this.collectionName || '').toLowerCase();
    if (['vslvisits', 'vitpower_measurement_v213'].includes(name) && !measurementMongoAllowedV213(name, method, args))
      throw new Error('ISOLATED_SCOPED_MONGO_WRITE_REJECTED');
    return original.apply(this, args);
  };
}
const visitId = '12345678-1234-4234-8234-123456789abc';
const body = { consent: true, visitId, visitorId: 'abcdef12-1234-4234-8234-123456789abc',
  fbp: 'fb.1.1794711599000.123456', fbclid: 'OFFLINE_HOOK_CLICK',
  events: [{ name: 'PageView', id: `vp213-page-${visitId}` },
    { name: 'ViewContent', id: `vp213-content-${visitId}` },
    { name: 'CtaClick', id: `vp213-cta-${visitId}` }, { name: 'Contact', id: `vp213-contact-${visitId}` }],
  contactPhone: '593900000001', entryMessage: 'Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?\nNombre: Carlos', variant: 'mobile_vsl' };
let response;
const res = { set() {}, status(code) { this.code = code; return this; }, json(payload) { response = payload; return this; } };
await captureVitPowerMeasurementV213({ body }, res);
assert.equal(res.code, 200); assert.equal(response.ok, true);
const phone = '593900000001', sourceMessageId = 'OFFLINE_HOOK_INBOUND_1';
const message = body.entryMessage;
assert(!message.includes('Visita:'));
const enrolled=await VslVisit.findOne({visitorKey:'vp213:'+visitId}).lean();
assert.equal(enrolled.customerPhone,'');assert.equal(enrolled.tracking.contactPhoneHashV237,createHash('sha256').update(phone).digest('hex'));
assert(!JSON.stringify(enrolled.tracking).includes(phone));
const denied=await claimVitPowerReferenceV213({phone,sourceMessageId:'MISSING',message,inboundAt:new Date()});assert.equal(denied.ok,false);
await Message.create({ _id: sourceMessageId, providerMessageId: sourceMessageId, provider: 'zapi',
  isFromMe: false, isBot: false, peerPhone: phone, from: phone + '@s.whatsapp.net', to: 'bot',
  sessionId: 'zapi', ownerPhoneDigits: '5531971862958', body: message });
const claim = await claimVitPowerReferenceV213({ phone, sourceMessageId, message, inboundAt: new Date() });
assert.equal(claim.claimed, true);
assert.equal(claim.tracking.attributionSource,'declared_site_phone_verified_zapi_v237');
assert.equal(claim.tracking.fbp,body.fbp);assert(claim.tracking.fbc.endsWith('.OFFLINE_HOOK_CLICK'));
const noPhone=await claimVitPowerReferenceV213({phone:'593900000002',sourceMessageId,message,inboundAt:new Date()});assert.equal(noPhone.ok,false);

const state = await ContactState.create({ phoneDigits: phone, chatId: phone + '@s.whatsapp.net', countryCode: 'EC',
  metadata: { productKey: 'vit_power_ec', vslSourceUrl: sourceUrl, tracking: claim.tracking,
    processingLock: { messageId: sourceMessageId },
    perAgentMemory: { vit_power_ec: { pendingCheckoutOrder: { quantity: '3', total: '95.99' } } },
    customerDraft: { productKey: 'vit_power_ec', phone, quantity: 0, total: 0 } } });
assert.equal(apiCalls.filter(x => x.event_name === 'InitiateCheckout').length, 1, 'central persisted-state hook must observe freeflow pending order without explicit legacy-engine callback');
await observeVitPowerPendingV213({ contactStateId: state._id, agentKey: 'vit_power_ec' });
assert.equal(apiCalls.filter(x => x.event_name === 'InitiateCheckout').length, 1);
await observeVitPowerPendingV213({ contactStateId: state._id, agentKey: 'tex_ultra_ec' });
assert.equal(apiCalls.filter(x => x.event_name === 'InitiateCheckout').length, 1);
await ContactState.updateOne({ _id: state._id }, { $set: { 'metadata.customerDraft.quantity': 3, 'metadata.customerDraft.total': 96 } });
await observeVitPowerDraftV213({ phone, sourceMessageId, contactStateId: state._id });
await observeVitPowerDraftV213({ phone, sourceMessageId, contactStateId: state._id });
assert.equal(apiCalls.filter(x => x.event_name === 'InitiateCheckout').length, 1);
const order = await Order.create({ country: 'EC', currency: 'USD', customer: { phone, name: 'Offline fixture' },
  source: 'whatsapp', package: { quantity: 3 }, total: 95.99, status: 'draft' });
assert.equal(order.tracking.measurementVersion, 213); assert.equal(order.tracking.ip, context.ip);
assert.equal(apiCalls.filter(x => x.event_name === 'InitiateCheckout').length, 1);
order.status = 'confirmed'; await order.save();
assert.equal(apiCalls.filter(x => x.event_name === 'Purchase').length, 1);
const {scopedPurchaseReceiptV237}=await import('file://'+R+'/src/services/vitPowerMeasurementV213Application.js');
const receipt=await scopedPurchaseReceiptV237(order);assert.equal(receipt.ok,true);assert.equal(receipt.datasetId,dataset);assert.equal(receipt.alreadyAccepted,true);
const {sendPurchaseEventForOrder}=await import('file://'+R+'/src/services/metaConversionsService.js');
const beforeLegacy=apiCalls.length;const legacyResult=await sendPurchaseEventForOrder(order);
assert.equal(legacyResult.ok,true,JSON.stringify(legacyResult));assert.equal(legacyResult.datasetId,dataset);assert.equal(apiCalls.length,beforeLegacy,'legacy entry point must reuse scoped acceptance without another transport');

await order.save();
assert.equal(apiCalls.filter(x => x.event_name === 'Purchase').length, 1);
const secondMessageId = 'OFFLINE_HOOK_INBOUND_2';
await Message.create({ _id: secondMessageId, providerMessageId: secondMessageId, provider: 'zapi',
  isFromMe: false, isBot: false, peerPhone: phone, from: phone + '@s.whatsapp.net', to: 'bot',
  sessionId: 'zapi', ownerPhoneDigits: '5531971862958', body: 'Quiero otra compra' });
await observeVitPowerDraftV213({ phone, sourceMessageId: secondMessageId, contactStateId: state._id });
assert.equal(apiCalls.filter(x => x.event_name === 'InitiateCheckout').length, 2);
const repurchase = await Order.create({ country: 'EC', currency: 'USD', customer: { phone },
  source: 'whatsapp', package: { quantity: 3 }, total: 95.99, status: 'draft', previousOrderId: order.orderId });
await Order.findOneAndUpdate({ _id: repurchase._id }, { $set: { status: 'confirmed', confirmedAt: new Date() } }, { new: true });
assert.equal(apiCalls.filter(x => x.event_name === 'Purchase').length, 2);
await Order.updateOne({ _id: repurchase._id }, { $set: { status: 'delivered' } });
assert.equal(apiCalls.filter(x => x.event_name === 'Purchase').length, 2);
assert.notEqual(apiCalls.filter(x => x.event_name === 'Purchase')[0].event_id, apiCalls.filter(x => x.event_name === 'Purchase')[1].event_id);
await Order.create({ country: 'EC', currency: 'USD', customer: { phone: '5515998038637' },
  package: { quantity: 3 }, total: 95.99, status: 'confirmed' });
assert.equal(apiCalls.filter(x => x.event_name === 'Purchase').length, 2);
assert.equal(await mongoose.models.VitPowerMeasurementV213.countDocuments({ state: 'accepted' }), 8);
await assert.rejects(() => mongoose.models.VitPowerMeasurementV213.create({ _id: 'FORGED', dataset, eventName: 'Purchase', state: 'sending' }));
await assert.rejects(() => VslVisit.deleteOne({ visitorKey: `vp213:${visitId}` }));
const request = { method: 'POST', originalUrl: '/api/meta-events/vitpower' };
const firstRateKey = measurementRateLimitKeyV213(request);
context.ip = '203.0.113.25'; const secondRateKey = measurementRateLimitKeyV213(request); context.ip = '198.51.100.25';
assert.notEqual(firstRateKey, secondRateKey); assert.equal(measurementRateLimitKeyV213({ ...request, originalUrl: '/api/orders' }), '');
assert(apiCalls.every(x=>x.event_source_url===sourceUrl&&x.user_data.fbp===body.fbp&&x.user_data.fbc.endsWith('.OFFLINE_HOOK_CLICK')));
assert(apiCalls.every(x=>!JSON.stringify(x).includes('Carlos')&&!JSON.stringify(x).includes('contactPhoneHashV237')));
const {createRuntime}=await import('file://'+R+'/src/services/vitPowerMeasurementV213Runtime.js');
const nativeRuntime=createRuntime({VisitModel:VslVisit,EventModel:mongoose.models.VitPowerMeasurementV213,policyProvider:()=>({collectionApproved:true,approved:true,credentialsVerified:true,dataset,activatedAt:active}),transport:async()=>{throw Error('UNEXPECTED_SEND');}});
const ambiguous={_id:enrolled._id,tracking:enrolled.tracking};
const fakeRuntime=createRuntime({VisitModel:{find:()=>({limit:()=>({lean:async()=>[ambiguous,ambiguous]})})},EventModel:{},policyProvider:()=>({collectionApproved:true,approved:true,credentialsVerified:true,dataset,activatedAt:active}),transport:async()=>{throw Error('UNEXPECTED_SEND');}});
assert.equal((await fakeRuntime.claimContactV237({phone,message,inboundAt:new Date(),providerVerified:true})).reason,'ambiguous_contact_enrollment');
assert.equal((await scopedPurchaseReceiptV237({...order.toObject(),orderId:'NEW_UNCONFIRMED',tracking:{...order.tracking.toObject(),attributionVisitorKey:''}})).ok,false);
console.log(JSON.stringify({candidateCommit:process.env.CANDIDATE_COMMIT, project: 'VITALISMEN_EC', pass: true, mode: 'ISOLATED_REAL_MONGOOSE_CANDIDATE_HOOKS',
  browserEvents: 4, checkoutEvents: 2, purchaseEvents: 2, models: ['VslVisit', 'ContactState', 'Message', 'Order', 'VitPowerMeasurementV213'],
  hooks: ['save', 'findOneAndUpdate', 'updateOne'], officialOrderSchema: true, syntheticMetaTransport: true,
  originalVisitorContextPersisted: true, deterministicPendingCheckoutExercised: true, generativeDraftSameCycleDeduplicated: true,
  scopedMongoGuardExercised: true, unscopedMutationRejected: true, rateLimitByVerifiedVisitor: true,
  realMetaRequests: 0, productionWrites: 0, whatsappSends: 0,
  sealedAuthoritySimulated: true, nginxProxyExercised: false, realBotFinalizerExercised: false }));
await mongoose.disconnect();
