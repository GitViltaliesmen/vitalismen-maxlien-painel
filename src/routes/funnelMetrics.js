import express from 'express';
import Order from '../models/Order.js';
import VslVisit from '../models/VslVisit.js';
import MetaAttributionCorrelation from '../models/MetaAttributionCorrelation.js';
import ContactState from '../models/ContactState.js';
import Shipment from '../models/Shipment.js';
import Message from '../models/Message.js';
import { buildProtocoloGCommercialMetrics } from '../services/protocoloGCommercialMetricsService.js';
import { buildFunnelOperationalMetricsV141 } from '../services/funnelOperationalMetricsV141Service.js';
import { applyIntegrationHealthV145 } from '../services/funnelIntegrationHealthV145Service.js';
import { readIntegrationHealthV145 } from '../services/funnelIntegrationHealthV145ReadService.js';
import { adminOnly, authMiddleware } from '../middleware/auth.js';
import { getMetaDatasetIdForOrder } from '../services/metaConversionsService.js';
import { loadMetaAdsInsights } from '../services/metaAdsInsightsService.js';
import {
    buildCreativeSalesMetricsV185,
    collectCreativeSalesFactsV185,
    loadCreativeMetaInsightsV185
} from '../services/creativeSalesMetricsV185Service.js';
import {
    buildFunnelMetricsSnapshot,
    clampFunnelMetricsDays,
    ecuadorDayKey,
    funnelMetricsMongoWindow,
    resolveFunnelMetricsRange,
    applyInvestmentRadarSafetyV141
} from '../services/funnelMetricsService.js';

const router = express.Router();
const CREATIVE_SALES_SCOPE = ['proto', 'colo-g'].join('');

const visitProjection = [
    'visitorKey',
    'visitorId',
    'externalId',
    'sourceUrl',
    'firstSeenAt',
    'visits',
    'country',
    'productKey',
    'productName',
    'funnel',
    'page',
    'path',
    'campaignId',
    'adsetId',
    'adId',
    'placement',
    'tracking.country',
    'tracking.productKey',
    'tracking.product',
    'tracking.funnel',
    'tracking.utm_source',
    'tracking.utm_campaign',
    'tracking.utm_content',
    'protocoloGStages',
    'attributionClaimedAt',
    'metaPageViewSentAt',
    'lastClickAt',
    'clickCount',
    'metaLeadSentAt'
].join(' ');

const orderProjection = [
    'confirmedAt',
    'orderId',
    'customer.name',
    'customer.phone',
    'country',
    'status',
    'total',
    'entryAt',
    'draftCreatedAt',
    'createdAt',
    'tracking.metaPurchaseSentAt',
    'tracking.metaPurchaseEventId',
    'tracking.metaPurchaseAttributedAt',
    'tracking.metaPurchaseInsightsVisibleAt',
    'tracking.metaPurchaseAttributionStatus',
    'tracking.metaPurchaseResponse',
    'tracking.fbclid',
    'tracking.fbp',
    'tracking.fbc',
    'tracking.external_id',
    'tracking.ext_id',
    'tracking.country',
    'tracking.productKey',
    'tracking.productName',
    'tracking.product',
    'tracking.funnel',
    'tracking.utm_source',
    'tracking.utm_medium',
    'tracking.utm_campaign',
    'tracking.utm_content',
    'tracking.utm_term',
    'tracking.campaign_id',
    'tracking.adset_id',
    'tracking.ad_id',
    'tracking.placement',
    'tracking.attributionCorrelationStatus',
    'tracking.attributionVisitorKey',
    'tracking.attributionMatchedAt',
    'tracking.sourceUrl',
    'tracking.attributionCorrelationReason',
    'tracking.metaPurchaseDatasetId',
    'tracking.metaPurchaseDatasetRoute'
].join(' ');

const correlationProjection = [
    'country',
    'status',
    'reason',
    'candidateCount',
    'visitorKey',
    'visitId',
    'productKey',
    'funnel',
    'inboundAt',
    'evaluatedAt'
].join(' ');

const creativeContactProjection = [
    '_id', 'countryCode', 'firstInboundAt', 'createdAt',
    'metadata.vslVisitId', 'metadata.vslSourceUrl', 'metadata.vslVariant',
    'metadata.vslEntryPanelLeadAt', 'metadata.metaAttributionBridge', 'metadata.tracking',
    'metadata.customerDraft.orderId', 'metadata.customerDraft.currentNegotiationOrderId'
].join(' ');

const creativeMessageProjection = [
    '_id', 'provider', 'providerPayload.vslVisitId', 'timestamp', 'createdAt'
].join(' ');

export const createFunnelMetricsHandler = ({
    VisitModel = VslVisit,
    OrderModel = Order,
    CorrelationModel = MetaAttributionCorrelation,
    ContactModel = ContactState,
    ShipmentModel = Shipment,
    MessageModel = Message,
    clock = () => new Date(),
    pixelId = () => process.env.META_PIXEL_ID_EC || '',
    datasetIdForOrder = (order) => getMetaDatasetIdForOrder(order),
    adsInsights = (options) => loadMetaAdsInsights(options),
    integrationHealth = (options) => readIntegrationHealthV145(options)
} = {}) => async (req, res) => {
    try {
        const days = clampFunnelMetricsDays(req.query?.days);
        const now = clock();
        const range = resolveFunnelMetricsRange({
            fromDay: req.query?.from,
            toDay: req.query?.to,
            days,
            now
        });
        const { visitQuery, orderQuery, correlationQuery } = funnelMetricsMongoWindow({ days, now, range });
        const startDay = ecuadorDayKey(range.startAt);
        const endDay = ecuadorDayKey(new Date(range.endAt.getTime() - 1));
        const [visits, orders, correlations, metaAds] = await Promise.all([
            VisitModel.find(visitQuery).select(visitProjection).lean(),
            OrderModel.find(orderQuery).select(orderProjection).lean(),
            CorrelationModel.find(correlationQuery).select(correlationProjection).lean(),
            adsInsights({ days: range.days, now, startDay, endDay })
        ]);
        const snapshot = buildFunnelMetricsSnapshot({
            visits,
            orders,
            correlations,
            days,
            now,
            range,
            pixelId: pixelId(),
            datasetIdForOrder
        });
        const between = { $gte: new Date(snapshot.startAt), $lt: new Date(snapshot.endAt) };
        const orderIds = orders.map(order => order.orderId).filter(Boolean);
        const visitorKeys = [...new Set(orders.map(order => order.tracking?.attributionVisitorKey).filter(Boolean))];
        const [contacts, shipments, linkedVisits, messages] = await Promise.all([
            ContactModel.find({ countryCode: 'EC', $or: [
                { 'metadata.vslVisitId': { $in: visits.map(visit => String(visit._id)) } },
                { 'metadata.customerDraft.orderId': { $in: orderIds } },
                { 'metadata.customerDraft.currentNegotiationOrderId': { $in: orderIds } },
                { firstInboundAt: between }, { 'metadata.vslEntryPanelLeadAt': between },
                { 'metadata.zapiCapturedAt': between }, { 'metadata.zapiInboundAt': between }
            ] }).select('_id countryCode phoneDigits firstInboundAt lastInboundAt lastOutboundAt createdAt tags human.mode conversationBucket.value conversationBucket.history metadata.vslVisitId metadata.vslSourceUrl metadata.vslVariant metadata.metaAttributionBridge metadata.tracking metadata.testOnly metadata.zapiCapturedAt metadata.zapiInboundAt metadata.vslEntryPanelLeadAt metadata.customerPhoneDigits metadata.customerDraft.phone metadata.customerDraft.orderId metadata.customerDraft.currentNegotiationOrderId').lean(),
            orderIds.length ? ShipmentModel.find({ country: 'EC', orderId: { $in: orderIds } })
                .select('orderId logistics.status automation.submittedToDroppiAt').lean() : [],
            visitorKeys.length ? VisitModel.find({ country: 'EC', visitorKey: { $in: visitorKeys } }).select(visitProjection).lean() : [],
            MessageModel.find({ $or: [
                { createdAt: between },
                { timestamp: { $gte: Math.floor(range.startAt.getTime() / 1000), $lt: Math.floor(range.endAt.getTime() / 1000) } },
                { timestamp: { $gte: range.startAt.getTime(), $lt: range.endAt.getTime() } }
            ] }).select('_id chatId peerPhone from to type hasMedia timestamp createdAt isFromMe isBot senderRole attendantId provider providerMessageId deliveryStatus deliveredAt ack sendError providerStatus').lean()
        ]);
        snapshot.protocoloG.commercial = buildProtocoloGCommercialMetrics({
            visits: [...visits, ...linkedVisits], orders, contacts, shipments,
            ads: snapshot.protocoloG.ads, startAt: snapshot.startAt, endAt: snapshot.endAt
        });
        const operational = buildFunnelOperationalMetricsV141({
            contacts,
            messages,
            orders,
            correlations,
            metaAds,
            startAt: snapshot.startAt,
            endAt: snapshot.endAt,
            computedAt: now
        });
        const evidence = await integrationHealth({ OrderModel, ShipmentModel, MessageModel, now });
        snapshot.operational = applyIntegrationHealthV145(operational, evidence, metaAds);
        snapshot.investmentRadar = applyInvestmentRadarSafetyV141(snapshot.investmentRadar, {
            metaAds,
            startDay,
            endDay
        });
        snapshot.window = {
            timezone: 'America/Guayaquil',
            fromDay: startDay,
            toDayExclusive: ecuadorDayKey(range.endAt),
            explicit: range.explicit === true
        };
        res.set('Cache-Control', 'no-store');
        return res.json({ ...snapshot, metaAds });
    } catch (error) {
        console.error('[FUNNEL-METRICS] Falha ao montar metricas EC:', error.message);
        return res.status(500).json({ error: 'Nao foi possivel carregar as metricas do funil.' });
    }
};

export const createCreativeSalesMetricsV185Handler = ({
    VisitModel = VslVisit,
    OrderModel = Order,
    CorrelationModel = MetaAttributionCorrelation,
    ContactModel = ContactState,
    MessageModel = Message,
    clock = () => new Date(),
    metaInsights = options => loadCreativeMetaInsightsV185(options)
} = {}) => async (req, res) => {
    if (String(req.query?.scope || '') !== CREATIVE_SALES_SCOPE) {
        return res.status(400).json({ error: 'scope canonico de creative-sales e obrigatorio.' });
    }
    try {
        const days = clampFunnelMetricsDays(req.query?.days);
        const now = clock();
        const range = resolveFunnelMetricsRange({
            fromDay: req.query?.from,
            toDay: req.query?.to,
            days,
            now
        });
        const { visitQuery, orderQuery, correlationQuery } = funnelMetricsMongoWindow({ days, now, range });
        const startDay = ecuadorDayKey(range.startAt);
        const endDay = ecuadorDayKey(new Date(range.endAt.getTime() - 1));
        const [visits, orders, correlations] = await Promise.all([
            VisitModel.find(visitQuery).select(visitProjection).lean(),
            OrderModel.find(orderQuery).select(orderProjection).lean(),
            CorrelationModel.find(correlationQuery).select(correlationProjection).lean()
        ]);
        const between = { $gte: range.startAt, $lt: range.endAt };
        const visitIds = visits.map(visit => String(visit._id)).filter(Boolean);
        const orderIds = orders.map(order => order.orderId).filter(Boolean);
        const visitorKeys = [...new Set(orders.map(order => order.tracking?.attributionVisitorKey).filter(Boolean))];
        const [contacts, messages, linkedVisits] = await Promise.all([
            ContactModel.find({ countryCode: 'EC', $or: [
                { 'metadata.vslVisitId': { $in: visitIds } },
                { 'metadata.customerDraft.orderId': { $in: orderIds } },
                { 'metadata.customerDraft.currentNegotiationOrderId': { $in: orderIds } },
                { firstInboundAt: between },
                { 'metadata.vslEntryPanelLeadAt': between }
            ] }).select(creativeContactProjection).lean(),
            MessageModel.find({ provider: 'vsl_entry', $or: [
                { 'providerPayload.vslVisitId': { $in: visitIds } },
                { createdAt: between }
            ] }).select(creativeMessageProjection).lean(),
            visitorKeys.length
                ? VisitModel.find({ country: 'EC', visitorKey: { $in: visitorKeys } }).select(visitProjection).lean()
                : []
        ]);
        const facts = collectCreativeSalesFactsV185({
            visits: [...visits, ...linkedVisits],
            orders,
            correlations,
            contacts,
            messages,
            startAt: range.startAt,
            endAt: range.endAt
        });
        const meta = await metaInsights({
            adIds: facts.discoveredAdIds,
            startDay,
            endDay,
            now,
            signal: req.signal
        });
        const snapshot = buildCreativeSalesMetricsV185({ facts, meta, startDay, endDay, computedAt: now });
        res.set('Cache-Control', 'no-store');
        return res.json(snapshot);
    } catch (error) {
        console.error('[FUNNEL-METRICS-V185] Falha na leitura por criativo:', error.message);
        return res.status(500).json({ error: 'Nao foi possivel carregar as metricas V185.' });
    }
};

router.get('/', authMiddleware, adminOnly, createFunnelMetricsHandler());
router.get('/creative-sales', authMiddleware, adminOnly, createCreativeSalesMetricsV185Handler());

export default router;
