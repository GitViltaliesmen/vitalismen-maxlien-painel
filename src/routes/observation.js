import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
    generateObservationReport,
    getObservationReport,
    listObservationReports
} from '../services/observationReportService.js';

const router = express.Router();

router.use(authMiddleware);

const flagEnabled = (name, fallback = false) => {
    const raw = process.env[name];
    if (raw === undefined) return fallback;
    return String(raw).toLowerCase() === 'true' || raw === '1';
};

router.get('/status', async (_req, res) => {
    const latest = await listObservationReports({ limit: 1, country: 'ALL' });
    res.json({
        enabled: flagEnabled('OBSERVATION_REPORTS_ENABLED', false),
        mode: 'read_only',
        storesReports: true,
        sendsMessages: false,
        mutatesCustomers: false,
        latest: latest[0] || null
    });
});

router.get('/reports', async (req, res) => {
    const reports = await listObservationReports({
        limit: req.query.limit || 20,
        country: req.query.country || 'EC'
    });
    res.json({ reports });
});

router.get('/reports/:id', async (req, res) => {
    const report = await getObservationReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ report });
});

router.post('/reports/generate', async (req, res) => {
    const report = await generateObservationReport({
        country: req.body?.country || 'EC',
        hours: Number(req.body?.hours || process.env.OBSERVATION_LOOKBACK_HOURS || 24),
        limit: Number(req.body?.limit || process.env.OBSERVATION_MESSAGE_LIMIT || 800),
        mode: 'manual',
        generatedBy: req.user?.email || req.user?.name || 'operator'
    });
    res.status(201).json({ report });
});

export default router;
