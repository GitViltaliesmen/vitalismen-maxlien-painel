import express from 'express';
import Order from '../models/Order.js';
import VslVisit from '../models/VslVisit.js';
import MetaAttributionCorrelation from '../models/MetaAttributionCorrelation.js';
import ContactState from '../models/ContactState.js';
import Shipment from '../models/Shipment.js';
import { buildProtocoloGCommercialMetrics } from '../services/protocoloGCommercialMetricsService.js';
import { adminOnly, authMiddleware } from '../middleware/auth.js';
import { getMetaDatasetIdForOrder } from '../services/metaConversionsService.js';
import { loadMetaAdsInsights } from '../services/metaAdsInsightsService.js';
import {
    buildFunnelMetricsSnapshot,
    clampFunnelMetricsDays,
    funnelMetricsMongoWindow
} from '../services/funnelMetricsService.js';

const router = express.Router();

const visitProjection = [
    'visitorKey',
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
    'metaLeadSentAt'
].join(' ');

const orderProjection = [
    'confirmedAt',
    'orderId',
    'customer.name',
    'country',
    'status',
    'total',
    'entryAt',
    'draftCreatedAt',
    'createdAt',
    'tracking.metaPurchaseSentAt',
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
    'status',
    'reason',
    'candidateCount',
    'evaluatedAt'
].join(' ');

export const createFunnelMetricsHandler = ({
    VisitModel = VslVisit,
    OrderModel = Order,
    CorrelationModel = MetaAttributionCorrelation,
    ContactModel = ContactState,
    ShipmentModel = Shipment,
    clock = () => new Date(),
    pixelId = () => process.env.META_PIXEL_ID_EC || '',
    datasetIdForOrder = (order) => getMetaDatasetIdForOrder(order),
    adsInsights = (options) => loadMetaAdsInsights(options)
} = {}) => async (req, res) => {
    try {
        const days = clampFunnelMetricsDays(req.query?.days);
        const now = clock();
        const { visitQuery, orderQuery, correlationQuery } = funnelMetricsMongoWindow({ days, now });
        const [visits, orders, correlations, metaAds] = await Promise.all([
            VisitModel.find(visitQuery).select(visitProjection).lean(),
            OrderModel.find(orderQuery).select(orderProjection).lean(),
            CorrelationModel.find(correlationQuery).select(correlationProjection).lean(),
            adsInsights({ days, now })
        ]);
        const snapshot = buildFunnelMetricsSnapshot({
            visits,
            orders,
            correlations,
            days,
            now,
            pixelId: pixelId(),
            datasetIdForOrder
        });
        const between = { $gte: new Date(snapshot.startAt), $lte: new Date(snapshot.endAt) };
        const orderIds = orders.map(order => order.orderId).filter(Boolean);
        const visitorKeys = [...new Set(orders.map(order => order.tracking?.attributionVisitorKey).filter(Boolean))];
        const [contacts, shipments, linkedVisits] = await Promise.all([
            ContactModel.find({ countryCode: 'EC', $or: [
                { 'metadata.vslVisitId': { $in: visits.map(visit => String(visit._id)) } },
                { 'metadata.customerDraft.orderId': { $in: orderIds } },
                { 'metadata.customerDraft.currentNegotiationOrderId': { $in: orderIds } },
                { firstInboundAt: between }, { 'metadata.vslEntryPanelLeadAt': between }
            ] }).select('_id countryCode phoneDigits firstInboundAt lastInboundAt createdAt conversationBucket.value metadata.vslVisitId metadata.vslSourceUrl metadata.vslVariant metadata.metaAttributionBridge metadata.tracking metadata.testOnly metadata.customerDraft.orderId metadata.customerDraft.currentNegotiationOrderId').lean(),
            orderIds.length ? ShipmentModel.find({ country: 'EC', orderId: { $in: orderIds } })
                .select('orderId logistics.status automation.submittedToDroppiAt').lean() : [],
            visitorKeys.length ? VisitModel.find({ country: 'EC', visitorKey: { $in: visitorKeys } }).select(visitProjection).lean() : []
        ]);
        snapshot.protocoloG.commercial = buildProtocoloGCommercialMetrics({
            visits: [...visits, ...linkedVisits], orders, contacts, shipments,
            ads: snapshot.protocoloG.ads, startAt: snapshot.startAt, endAt: snapshot.endAt
        });
        res.set('Cache-Control', 'no-store');
        return res.json({ ...snapshot, metaAds });
    } catch (error) {
        console.error('[FUNNEL-METRICS] Falha ao montar metricas EC:', error.message);
        return res.status(500).json({ error: 'Nao foi possivel carregar as metricas do funil.' });
    }
};

router.get('/', authMiddleware, adminOnly, createFunnelMetricsHandler());

export default router;
