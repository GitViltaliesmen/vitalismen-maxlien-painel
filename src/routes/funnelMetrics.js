import express from 'express';
import Order from '../models/Order.js';
import VslVisit from '../models/VslVisit.js';
import MetaAttributionCorrelation from '../models/MetaAttributionCorrelation.js';
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
        res.set('Cache-Control', 'no-store');
        return res.json({ ...snapshot, metaAds });
    } catch (error) {
        console.error('[FUNNEL-METRICS] Falha ao montar metricas EC:', error.message);
        return res.status(500).json({ error: 'Nao foi possivel carregar as metricas do funil.' });
    }
};

router.get('/', authMiddleware, adminOnly, createFunnelMetricsHandler());

export default router;
