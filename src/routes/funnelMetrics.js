import express from 'express';
import Order from '../models/Order.js';
import VslVisit from '../models/VslVisit.js';
import { adminOnly, authMiddleware } from '../middleware/auth.js';
import {
    buildFunnelMetricsSnapshot,
    clampFunnelMetricsDays,
    funnelMetricsMongoWindow
} from '../services/funnelMetricsService.js';

const router = express.Router();

const visitProjection = [
    'firstSeenAt',
    'visits',
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
    'tracking.fbc'
].join(' ');

export const createFunnelMetricsHandler = ({
    VisitModel = VslVisit,
    OrderModel = Order,
    clock = () => new Date(),
    pixelId = () => process.env.META_PIXEL_ID_EC || ''
} = {}) => async (req, res) => {
    try {
        const days = clampFunnelMetricsDays(req.query?.days);
        const now = clock();
        const { visitQuery, orderQuery } = funnelMetricsMongoWindow({ days, now });
        const [visits, orders] = await Promise.all([
            VisitModel.find(visitQuery).select(visitProjection).lean(),
            OrderModel.find(orderQuery).select(orderProjection).lean()
        ]);
        const snapshot = buildFunnelMetricsSnapshot({
            visits,
            orders,
            days,
            now,
            pixelId: pixelId()
        });
        res.set('Cache-Control', 'no-store');
        return res.json(snapshot);
    } catch (error) {
        console.error('[FUNNEL-METRICS] Falha ao montar metricas EC:', error.message);
        return res.status(500).json({ error: 'Nao foi possivel carregar as metricas do funil.' });
    }
};

router.get('/', authMiddleware, adminOnly, createFunnelMetricsHandler());

export default router;
