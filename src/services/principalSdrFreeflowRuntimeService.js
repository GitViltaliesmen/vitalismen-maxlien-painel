// Bind the conversational candidate to existing models, router lease and sender.
// Ports are supplied by conversationEngine; this module creates no infrastructure.
import { createHash } from 'node:crypto';
import { createPrincipalSdrFreeflowAgent, createOpenAiFreeflowCompletion, PRINCIPAL_SDR_QA_PHONE } from './principalSdrFreeflowService.js';

import { shipmentHistoryRepeatKey } from './postSalePickupReconciliationPolicy.js';

const ROOT = 'metadata.perAgentMemory.vit_power_ec.principalSdrFreeflow';
const sha = text => createHash('sha256').update(text).digest('hex');
const same = (left, right) => String(left || '') === String(right || '');
const time = value => value instanceof Date ? value.getTime() : new Date(value || 0).getTime();
const contextFields = ['name', 'quantity', 'city', 'province', 'deliveryMode', 'address', 'reference', 'agencyQuery', 'agencyName', 'agencyId', 'agencyAddress', 'intent'];
const copyDraft = value => Object.fromEntries(contextFields
    .filter(key => value?.[key] !== undefined && value[key] !== '' && (key !== 'quantity' || [1, 2, 3, 6].includes(Number(value[key]))))
    .map(key => [key, key === 'quantity' ? Number(value[key]) : value[key]]));
const missing = draft => ['quantity', 'name', 'city', 'province', 'deliveryMode',
    ...(draft.deliveryMode === 'home' ? ['address'] : []), ...(draft.deliveryMode === 'agency' ? ['agencyName'] : [])].filter(key => !draft[key]);

export function createPrincipalSdrRuntime({ ContactState, Message, Order, OutboundDedupe, getOffer, resolveData,
    sendReply, transferHuman, registerExistingOrder, products, complete, onDraftSaved = async () => {},
    now = () => new Date(), qaReady = () => false, questionPriorityEnabled = false, productInformation = async () => ({ ok: false, unavailable: true }), salesPolicy = async () => ({ ok: false, unavailable: true }) }) {
    if (![ContactState, Message, Order, OutboundDedupe].every(Boolean)
        || ![getOffer, resolveData, sendReply, transferHuman, registerExistingOrder, qaReady].every(value => typeof value === 'function'))
        throw new Error('principal_sdr_runtime_ports_required');

    return Object.freeze({
        async handle({ message, contactStateId, phone, productKey }) {
            if (productKey !== 'vit_power_ec') return { handled: false, reason: 'other_product_preserved' };
            const inboundId = String(message?.id || '');
            if (!(phone === PRINCIPAL_SDR_QA_PHONE || /^593[2-79]\d{8}$/.test(phone))
                || !contactStateId || !/^[A-Za-z0-9_-]{8,128}$/.test(inboundId) || !message?.body || !message?.sessionId)
                throw new Error('principal_sdr_inbound_identity_required');
            const exact = { _id: contactStateId, phoneDigits: phone };
            const state = await ContactState.findOne(exact).lean();
            if (!state) throw new Error('principal_sdr_exact_contact_missing');
            const lease = state.metadata?.processingLock;
            if (!same(lease?.messageId, inboundId) || time(lease?.expiresAt) <= now().getTime())
                throw new Error('principal_sdr_router_lease_required');
            const inbound = await Message.find({ provider: 'zapi', isFromMe: false, peerPhone: phone,
                sessionId: message.sessionId, $or: [{ _id: inboundId }, { providerMessageId: inboundId }] }).limit(2).lean();
            if (inbound.length !== 1 || inbound[0].body !== message.body)
                throw new Error('principal_sdr_persisted_inbound_mismatch');
            if (state.human?.mode === 'manual' || time(state.human?.pausedUntil) > now().getTime())
                return { handled: true, send: false, reason: 'human_hold_preserved' };
            if (phone === PRINCIPAL_SDR_QA_PHONE && !qaReady(state, inboundId, now()))
                return { handled: true, send: false, reason: 'qa_window_not_ready' };
            const active = await Order.findOne({ country: 'EC', 'customer.phone': phone,
                status: { $in: ['confirmed', 'processing', 'shipped', 'returned'] } }).select('orderId status').lean();
            if (active) return { handled: true, send: false, reason: 'existing_active_order_preserved' };

            const key = 'principal-sdr-turn:' + sha(phone + ':' + inboundId);
            try {
                await OutboundDedupe.create({ key, phoneDigits: phone, jid: state.chatId, kind: 'text', fingerprint: sha(key),
                    label: 'Principal SDR inbound turn', sessionId: message.sessionId, status: 'reserved', retryAllowed: false,
                    firstReservedAt: now() });
            } catch (error) {
                if (error?.code === 11000) return { handled: true, send: false, duplicate: true };
                throw error;
            }
            const leaseQuery = { ...exact, 'metadata.processingLock.messageId': inboundId,
                'metadata.processingLock.expiresAt': { $gt: now() } };
            const save = async (values, allowManual = false) => {
                const result = await ContactState.updateOne(allowManual ? leaseQuery : { ...leaseQuery, 'human.mode': { $ne: 'manual' } }, { $set: values });
                if (result.matchedCount !== 1) throw new Error('freeflow_router_lease_lost');
            };
            const memory = state.metadata?.perAgentMemory?.vit_power_ec || {};
            const saved = memory.principalSdrFreeflow || {};
            const compatibleDraft = state.metadata?.customerDraft?.productKey === 'vit_power_ec' ? state.metadata.customerDraft : {};
            let draft = { ...copyDraft(compatibleDraft), ...copyDraft(memory.pendingCheckoutOrder), ...copyDraft(saved.draft) };
            let proposal = saved.pendingSummary || null;
            let registrationAttempt = saved.registrationAttempt || null;
            const history = (saved.history || []).filter(item => ['user', 'assistant'].includes(item.role)).slice(-24);
            // Read only the same official contact/session, matching the sender's 24-hour history guard.
            const recentOutbound = questionPriorityEnabled ? await Message.find({ peerPhone: phone, sessionId: message.sessionId,
                provider: 'zapi', isFromMe: true, ...(inbound[0].ownerPhoneDigits ? { ownerPhoneDigits: inbound[0].ownerPhoneDigits } : {}),
                $or: [{ createdAt: { $gte: new Date(now().getTime() - 24 * 60 * 60 * 1000) } }, { updatedAt: { $gte: new Date(now().getTime() - 24 * 60 * 60 * 1000) } }], body: { $type: 'string', $ne: '' }
            }).sort({ createdAt: -1 }).limit(40).select({ body: 1 }).lean() : [];
            const previousQuestionKeys = [...new Set(recentOutbound.map(row => shipmentHistoryRepeatKey(row.body)).filter(key => key.startsWith('ask_')))];
            const context = { project: 'VITALISMEN_EC', country: 'EC', phone, productKey: 'vit_power_ec', productName: 'Vit Power Ecuador',
                inboundId, inboundText: message.body, inboundPersisted: true, inboundProvider: 'zapi', inboundFromMe: false,
                transportVerified: true, humanMode: 'auto', testOnly: phone === PRINCIPAL_SDR_QA_PHONE,
                qaWindowReady: phone === PRINCIPAL_SDR_QA_PHONE ? qaReady(state, inboundId, now()) : false,
                draft, history, pendingSummary: proposal, missingFields: missing(draft), previousQuestionKeys,
                vslOrigin: { product: state.metadata?.vslProductKey || '', url: state.metadata?.vslSourceUrl || state.metadata?.vslPath || '' } };
            let handoffDone = false; let handoffHumanSnapshot = null; let outboundAttempted = false;
            let humanTakeover = false; let registrationAlreadyNotified = false;
            const official = {
                products: async () => ({ ok: true, verified: true, source: 'ecuadorProductService', products }),
                offer: async args => {
                    const offer = getOffer({ productKey: 'vit_power_ec', quantity: args.quantity, priceCatalog: 'normal' });
                    return offer ? { ...offer, ok: true, verified: true, currency: 'USD', source: 'ecuadorProductService', priceCatalog: 'normal' } : { ok: false };
                },
                policy: async args => questionPriorityEnabled ? salesPolicy(args) : ({ ok: false, unavailable: true }),
                productInformation: async args => questionPriorityEnabled ? productInformation(args) : ({ ok: false, unavailable: true }),
                stock: async () => ({ ok: false, unavailable: true }),
                saveDraft: async args => {
                    draft = copyDraft(args.draft);
                    const offer = getOffer({ productKey: 'vit_power_ec', quantity: draft.quantity, priceCatalog: 'normal' });
                    const panelDraft = { ...compatibleDraft, ...draft, productKey: 'vit_power_ec', productName: 'Vit Power Ecuador',
                        country: 'EC', phone, total: offer?.quantity === draft.quantity ? offer.total : 0,
                        source: 'principal_sdr_v212', updatedAt: now().toISOString() };
                    await save({ [ROOT + '.draft']: draft, 'metadata.customerDraft': panelDraft,
                        ...(args.evidence.field === 'name' ? { name: draft.name } : {}),
                        [ROOT + '.lastEvidence']: { inboundId, field: args.evidence.field, quote: args.evidence.quote } });
                    if (phone !== PRINCIPAL_SDR_QA_PHONE) await onDraftSaved(panelDraft);
                    return { ok: true, persisted: true };
                },
                previewOrder: async args => {
                    const candidate = { ...args.draft, productKey: 'vit_power_ec', country: 'EC', phone };
                    if (candidate.agencyQuery && !candidate.agencyName) candidate.agencyName = candidate.agencyQuery;
                    const resolution = resolveData({ draft: candidate, conversationPhone: phone, source: 'whatsapp', sourceMessageId: inboundId });
                    const offer = await official.offer({ quantity: candidate.quantity });
                    const gaps = missing(resolution.draft);
                    if (!resolution.resolution.orderDataReady || gaps.length || !offer.ok)
                        return { ok: false, missingFields: gaps.length ? gaps : resolution.resolution.blockedReasons };
                    const verified = resolution.draft;
                    return { ok: true, complete: true, offer, normalizedDraft: verified,
                        summary: `${verified.name}: ${candidate.quantity} frascos de Vit Power por USD ${offer.total.toFixed(2)}. ${verified.city}, ${verified.province}. Entrega: ${verified.deliveryMode === 'agency' ? verified.agencyName : verified.address}. Confirma estos datos y el pedido?` };
                },
                verifyConfirmation: async args => {
                    if (!/^(?:s[ií]|s[ií][, ]+confirmo|confirmo|confirmo el pedido|correcto|de acuerdo)[.!\s]*$/i.test(args.text.trim())
                        || !proposal?.summaryOutboundId || !same(proposal.proposedInMessageId, args.proposal.proposedInMessageId)) return { verified: false };
                    const outbound = await Message.findOne({ peerPhone: phone, sessionId: message.sessionId,
                        provider: 'zapi', providerMessageId: proposal.summaryOutboundId, isFromMe: true, isBot: true }).lean();
                    if (!outbound || !(outbound.ack >= 2 || ['delivered', 'read'].includes(outbound.deliveryStatus))
                        || time(inbound[0].createdAt) <= time(outbound.createdAt)) return { verified: false };
                    return { verified: true, phone, inboundId, snapshot: args.proposal.snapshot,
                        confirmationKind: 'explicit_current_summary', summaryOutboundId: proposal.summaryOutboundId };
                },
                registerOrder: async args => {
                    if (phone === PRINCIPAL_SDR_QA_PHONE) throw new Error('freeflow_qa_never_registers_order');
                    const currentOwner = await ContactState.findOne(leaseQuery).lean();
                    if (!currentOwner || currentOwner.human?.mode === 'manual') throw new Error('freeflow_human_takeover_before_order');
                    if (registrationAttempt) throw new Error('freeflow_order_attempt_requires_reconciliation');
                    const preview = await official.previewOrder(args);
                    if (!preview.ok) throw new Error('freeflow_order_data_not_ready');
                    registrationAttempt = { key: args.idempotencyKey, status: 'attempted', at: now(), inboundId };
                    await save({ [ROOT + '.registrationAttempt']: registrationAttempt });
                    const receipt = await registerExistingOrder({ draft: preview.normalizedDraft, offer: preview.offer, returnReceipt: true });
                    if (!receipt?.ok || !receipt.persisted || !receipt.orderId) throw new Error('freeflow_existing_order_receipt_missing');
                    const actual = await Order.findOne({ orderId: receipt.orderId, country: 'EC', 'customer.phone': phone,
                        status: 'confirmed', total: preview.offer.total, 'package.quantity': preview.offer.quantity }).lean();
                    if (!actual) throw new Error('freeflow_registered_order_verification_failed');
                    // The existing finalizer may already set a human hold; the exact router lease remains required.
                    await save({ [ROOT + '.registrationAttempt']: { ...registrationAttempt, status: 'registered', orderId: receipt.orderId } }, true);
                    registrationAlreadyNotified = true;
                    return { ...receipt, alreadyNotified: true };
                },
                handoff: async args => {
                    if (!handoffDone) {
                        const current = await ContactState.findOne(exact).lean();
                        if (current?.human?.mode === 'manual') { humanTakeover = true; handoffDone = true; return { ok: true, persisted: true }; }
                        const receipt = await transferHuman({ reason: args.reason });
                        if (!receipt?.ok || !receipt.persisted) throw new Error('freeflow_handoff_not_persisted');
                        handoffDone = true;
                        const held = await ContactState.findOne(exact).lean();
                        handoffHumanSnapshot = JSON.stringify(held?.human || {});
                    }
                    return { ok: true, persisted: true };
                }
            };
            const withTurn = async (scope, run) => run({
                loadContext: async () => context,
                saveSummary: async value => { proposal = value; await save({ [ROOT + '.pendingSummary']: value }); },
                finish: async result => {
                    if (!result.send || registrationAlreadyNotified) {
                        await OutboundDedupe.updateOne({ key }, { $set: { status: 'sent', sentAt: now(), retryAllowed: false } });
                        return { ...result, handled: true, send: false };
                    }
                    // A fresh human takeover or lease expiry cancels the send immediately.
                    const latest = await ContactState.findOne(leaseQuery).lean();
                    if (!latest || humanTakeover || latest.human?.mode === 'manual' && (!handoffDone || JSON.stringify(latest.human || {}) !== handoffHumanSnapshot))
                        throw new Error('freeflow_human_takeover_before_send');
                    if (outboundAttempted) throw new Error('freeflow_outbound_already_attempted');
                    outboundAttempted = true;
                    const receipt = await sendReply({ text: result.reply, idempotencyKey: key });
                    if (!receipt?.ok || receipt.provider !== 'zapi' || !receipt.providerMessageId)
                        throw new Error('freeflow_reply_receipt_missing');
                    const mirrored = await Message.findOne({ peerPhone: phone, provider: 'zapi',
                        providerMessageId: receipt.providerMessageId, isFromMe: true, isBot: true }).lean();
                    if (!mirrored) throw new Error('freeflow_reply_mirror_missing');
                    if (proposal?.proposedInMessageId === inboundId) proposal = { ...proposal, summaryOutboundId: receipt.providerMessageId };
                    await save({ [ROOT + '.history']: [...history, { role: 'user', content: message.body }, { role: 'assistant', content: result.reply }].slice(-24),
                        [ROOT + '.draft']: copyDraft(result.draft || draft), [ROOT + '.pendingSummary']: proposal,
                        [ROOT + '.lastInboundId']: inboundId, [ROOT + '.lastOutboundProviderId']: receipt.providerMessageId,
                        [ROOT + '.lastModelSucceeded']: !result.reason && !result.failureCode && result.handoffRequested === false,
                        ...(questionPriorityEnabled ? { [ROOT + '.lastQuestionPriorityVersion']: result.orderedQuestionVersion || 0 } : {}),
                        [ROOT + '.version']: 212,
                        ...(result.priceOptionsPresented === true ? {
                            'metadata.perAgentMemory.vit_power_ec.lastFunnelStage': 'package_selection',
                            'metadata.perAgentMemory.vit_power_ec.initialProductPresentationPriceSentAt': now()
                        } : {}) }, true);
                    await OutboundDedupe.updateOne({ key }, { $set: { status: 'sent', sentAt: now(), provider: 'zapi', providerMessageId: receipt.providerMessageId, retryAllowed: false } });
                    return { ...result, deliveredToProvider: true, providerMessageId: receipt.providerMessageId };
                }
            });
            try {
                const agent = createPrincipalSdrFreeflowAgent({ complete: complete || createOpenAiFreeflowCompletion({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL }), withTurn, official, questionPriorityEnabled });
                return await agent.handleTurn({ phone, messageId: inboundId, text: message.body });
            } catch {
                // An ambiguous provider outcome is terminal: no automatic repeat.
                await OutboundDedupe.updateOne({ key, status: 'reserved' }, { $set: { status: 'ambiguous', ambiguousAt: now(), retryAllowed: false, error: 'principal_sdr_turn_not_completed' } });
                await official.handoff({ reason: 'principal_sdr_runtime_failure' });
                return { handled: true, send: false, requiresHuman: true };
            }
        }
    });
}
