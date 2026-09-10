import Shipment from '../models/Shipment.js';
import Message from '../models/Message.js';
import { a07PlanV147R6R2, classifyA07ComponentV147R6R2, guardA07ComponentV147R6R2,
    finalizeA07ComponentV147R6R2, reconcileA07ShipmentV147R6R2 } from './postSaleA07ComponentsV147R6R2Service.js';
import { formatWhatsAppNumber } from '../utils/phone.js';
import { servientregaPostSaleCompletionEligibleV147 } from './canonicalLogisticsStatusV147Service.js';
import { decidePostSaleNotification, completePostSaleNotificationStage, failPostSaleNotificationStage } from './postSaleNotificationDecisionService.js';
import { classifyPostSaleContentV147R6, resolvePostSaleEventV147R6, reconcileDeliveredPostSaleSequenceV147R6,
    pickupPostSaleStageV147R6R2, reconcilePickupPostSaleSequenceV147R6R2, guardReservedPickupEventV147R6R2 } from './postSaleUnifiedEventV147R6Service.js';

// This adapter shares the decision/lock/finalizer with V116. It owns no transport or parallel ledger.
export const sendCanonicalPanelPostSaleV147R6 = async ({ request = {}, operator = '', sendFn, recordFn,
    shipmentModel = Shipment, messageModel = Message, decideFn = decidePostSaleNotification } = {}) => {
    if (request.sendMode !== 'manual_panel') return { handled: false };
    let content = classifyPostSaleContentV147R6({ isMedia: request.isMedia, message: request.message });
    const possibleA07 = String(request.message || '').includes('¡Su pedido ya está disponible para retiro en Servientrega!')
        || request.isMedia && /\.pdf(?:[?#]|$)|^data:application\/pdf;/.test(String(request.message || ''));
    if (!content && !possibleA07) return { handled: false };
    const recipient = formatWhatsAppNumber({ phone: request.phone, country: 'EC' });
    if (!recipient) return { handled: true, success: false, error: 'canonical_customer_missing' };
    const rows = await shipmentModel.find({ country: 'EC', 'client.phone': { $regex: recipient.slice(-9) + '$' } })
        .sort({ createdAt: -1 }).limit(20).lean();
    const matches = request.postSaleShipmentId ? rows.filter((row) => String(row._id) === String(request.postSaleShipmentId)) : rows;
    // Without explicit UI context, only the latest purchase can own a legacy panel template.
    // Equal creation timestamps are ambiguous and fail closed.
    if (!matches.length || (!request.postSaleShipmentId && matches.length > 1
        && String(matches[0].createdAt) === String(matches[1].createdAt))) {
        return { handled: true, success: false, error: 'canonical_shipment_missing_or_ambiguous' };
    }
    let shipment = matches[0];
    const a07Plan = content?.canonicalEvent === 'A07' || possibleA07 ? await a07PlanV147R6R2(shipment) : null;
    const component = a07Plan ? classifyA07ComponentV147R6R2({ isMedia: request.isMedia, message: request.message }, shipment, a07Plan) : '';
    if (!content && component) content = { canonicalEvent: 'A07', templateId: 'A07', product: '', stage: 'READY_FOR_PICKUP' };
    if (!content) return { handled: false };
    const pickup = pickupPostSaleStageV147R6R2(content.stage);
    if (!pickup && !servientregaPostSaleCompletionEligibleV147(shipment)) {
        return { handled: true, success: false, error: 'canonical_postsale_requires_delivered' };
    }
    shipment = pickup ? await reconcilePickupPostSaleSequenceV147R6R2(shipment, { shipmentModel, messageModel })
        : await reconcileDeliveredPostSaleSequenceV147R6(shipment, { shipmentModel, messageModel });
    const event = component ? a07Plan.components.find((e) => e.component === component)
        : await resolvePostSaleEventV147R6({ shipment, stage: content.stage });
    if (!event || event.templateId !== content.templateId || event.product !== content.product) {
        return { handled: true, success: false, error: 'canonical_postsale_product_conflict_or_unknown' };
    }
    const decision = await decideFn({ shipment, kind: event.stage, manualPanel: true, operator, shipmentModel, messageModel, a07Component: component });
    if (decision.decision !== 'SHOULD_SEND' || !decision.lockToken) {
        const satisfied = decision.satisfied === true || ['ALREADY_NOTIFIED_MANUALLY', 'ALREADY_NOTIFIED_STRUCTURED'].includes(decision.decision)
            && Boolean(shipment.automation?.[{ A07: 'readyForPickupNotifiedAt', A10: 'reminderDay3At', A19: 'reminderDay5At',
                P5: 'deliveredThankYouNotifiedAt', P6: 'bonusNotifiedAt', P7: 'usageNotifiedAt' }[event.canonicalEvent]]);
        return { handled: true, success: satisfied, sent: false, alreadySatisfied: satisfied,
            status: satisfied ? 'ALREADY_SATISFIED' : 'EVENT_RESERVED_OR_BLOCKED',
            error: satisfied ? undefined : decision.reason, providerMessageId: decision.providerMessageId || '', canonicalEvent: event };
    }
    // No retries: an intended event survives process death and ambiguous provider outcomes.
    try {
        if (pickup && !await (component ? guardA07ComponentV147R6R2 : guardReservedPickupEventV147R6R2)({ shipment, event, lockToken: decision.lockToken, shipmentModel })) {
            return { handled: true, success: false, sent: false, error: 'stale_pickup_event_cancelled_before_provider' };
        }
        const result = await sendFn({ event, shipment, beforeSend: component
            ? () => guardA07ComponentV147R6R2({ shipment, event, lockToken: decision.lockToken, shipmentModel }) : null });
        const accepted = result?.ok === true && Boolean(result.providerMessageId);
        if (!accepted) {
            if (component) {
                await finalizeA07ComponentV147R6R2({ shipment, event, lockToken: decision.lockToken, shipmentModel,
                    failure: result?.providerAttempted === false ? 'PENDING' : 'AMBIGUOUS' });
                return { handled: true, success: false, sent: false, error: 'manual_provider_acceptance_unconfirmed' };
            }
            await failPostSaleNotificationStage({ shipment, stage: event.stage, lockToken: decision.lockToken,
                terminal: true, terminalState: result?.providerAttempted === false ? 'FAILED_FINAL' : 'AMBIGUOUS',
                reason: result?.reason || result?.error || 'manual_provider_acceptance_unconfirmed', shipmentModel });
            return { handled: true, success: false, sent: false, error: 'manual_provider_acceptance_unconfirmed' };
        }
        // Commit the accepted provider ID before optional UI record/hold callbacks can fail.
        const finalized = component ? await finalizeA07ComponentV147R6R2({ shipment, event, lockToken: decision.lockToken, result, shipmentModel })
            : await completePostSaleNotificationStage({ shipment, stage: event.stage,
                lockToken: decision.lockToken, providerMessageId: result.providerMessageId, shipmentModel });
        const record = await recordFn?.({ result, event, shipment });
        if (record?._id) await messageModel.updateOne({ _id: record._id }, { $set: { postSaleEvent: event, orderId: event.orderId } }, { timestamps: false });
        if (component) await reconcileA07ShipmentV147R6R2(shipment, { shipmentModel, messageModel });
        return { handled: true, success: finalized.completed, sent: true, providerMessageId: result.providerMessageId,
            providerZaapId: result.providerZaapId || '', provider: result.provider || '', messageRecordId: record?._id || '',
            deliveryStatus: 'provider_accepted', canonicalEvent: event };
    } catch (error) {
        if (component) {
            await finalizeA07ComponentV147R6R2({ shipment, event, lockToken: decision.lockToken, shipmentModel, failure: 'AMBIGUOUS' });
            throw error;
        }
        await failPostSaleNotificationStage({ shipment, stage: event.stage, lockToken: decision.lockToken,
            terminal: true, terminalState: 'AMBIGUOUS', reason: 'manual_send_or_persistence_ambiguous', shipmentModel });
        throw error;
    }
};
