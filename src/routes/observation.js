import express from 'express';
import {
    readPerfectFunnelFile,
    readPerfectFunnelObserverReport,
    readPerfectFunnelSpreadsheet,
    readPassiveFunnelObserverReport,
    scanPerfectFunnelObserver,
    scanPassiveFunnelObserver,
    writePerfectFunnelObserverReport,
    writePassiveFunnelObserverReport
} from '../services/passiveFunnelObserverService.js';
import {
    readSalesHoursAnalyticsReport,
    readSalesHoursFile,
    readSalesHoursSpreadsheet,
    scanSalesHoursAnalytics
} from '../services/salesHoursAnalyticsService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Relatorios do observador incluem telefone, texto de cliente e resposta do bot.
// Mantemos a analise somente leitura, mas nunca publica na internet sem login.
router.use(authMiddleware);

const countryFromReq = (req) => String(req.query.country || req.body?.country || 'EC').toUpperCase();
const limitFromReq = (req, fallback = 80) => {
    const parsed = Number.parseInt(String(req.query.limit || req.body?.limit || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 120) : fallback;
};

const readonlyResponse = (res, action = 'blocked') => res.status(423).json({
    ok: false,
    action,
    mode: 'passive_read_only',
    message: 'Observador passivo: endpoint de alteracao bloqueado. Nada foi aplicado no funil, cliente, pedido ou Dropi.'
});

router.get(['/', '/status'], async (req, res) => {
    try {
        const [passive, perfect, salesHours] = await Promise.all([
            latestOrScan(req),
            latestPerfectOrScan(req),
            latestSalesHoursOrScan(req).catch(() => null)
        ]);
        res.json({
            ok: true,
            title: 'Bot Observador EC',
            country: countryFromReq(req),
            generatedAt: new Date().toISOString(),
            dashboard: '/painel-observacao.html',
            mode: 'passive_read_only',
            passive: {
                generatedAt: passive.generatedAt,
                summary: passive.summary,
                endpoint: '/api/observation/passive-funnel-report?country=EC&refresh=1'
            },
            perfect: {
                generatedAt: perfect.generatedAt,
                summary: perfect.summary,
                endpoint: '/api/observation/perfect-funnel-report?country=EC&refresh=1'
            },
            salesHours: salesHours ? {
                generatedAt: salesHours.generatedAt,
                summary: salesHours.summary,
                dashboard: '/observer-sales-hours.html'
            } : null,
            links: {
                actionables: '/api/observation/actionables?country=EC&refresh=1',
                falhasCsv: '/api/observation/perfect-funnel-spreadsheet/falhas?country=EC&refresh=1',
                planoProducao: '/api/observation/perfect-funnel-file/plano-producao-funil-perfeito.md?country=EC&refresh=1',
                horarios: '/observer-sales-hours.html'
            },
            readOnlyGuarantee: 'Nao envia mensagem, nao altera contato, nao muda prompt, nao cria pedido, nao envia Dropi.'
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'observer_status_failed' });
    }
});

const latestOrScan = async (req) => {
    const country = countryFromReq(req);
    const refresh = ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase());
    if (!refresh) {
        const latest = await readPassiveFunnelObserverReport();
        if (latest?.ok && (!latest.country || latest.country === country)) return latest;
    }
    const report = await scanPassiveFunnelObserver({
        country,
        lookbackMinutes: Number(req.query.lookbackMinutes || process.env.PASSIVE_FUNNEL_OBSERVER_LOOKBACK_MINUTES || 45),
        limit: Number(req.query.scanLimit || process.env.PASSIVE_FUNNEL_OBSERVER_LIMIT || 240)
    });
    await writePassiveFunnelObserverReport(report).catch(() => null);
    return report;
};

const latestPerfectOrScan = async (req) => {
    const country = countryFromReq(req);
    const refresh = ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase());
    if (!refresh) {
        const latest = await readPerfectFunnelObserverReport();
        if (latest?.ok && (!latest.country || latest.country === country)) return latest;
    }
    const report = await scanPerfectFunnelObserver({
        country,
        lookbackHours: Number(req.query.lookbackHours || process.env.PERFECT_FUNNEL_OBSERVER_LOOKBACK_HOURS || 24),
        limit: Number(req.query.scanLimit || process.env.PERFECT_FUNNEL_OBSERVER_LIMIT || 600)
    });
    await writePerfectFunnelObserverReport(report).catch(() => null);
    return report;
};

const latestSalesHoursOrScan = async (req) => {
    const country = countryFromReq(req);
    const refresh = ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase());
    if (!refresh) {
        const latest = await readSalesHoursAnalyticsReport();
        if (latest?.ok && (!latest.country || latest.country === country)) return latest;
    }
    return scanSalesHoursAnalytics({
        country,
        days: Number(req.query.days || process.env.SALES_HOURS_OBSERVER_DAYS || 14),
        limit: Number(req.query.scanLimit || process.env.SALES_HOURS_OBSERVER_LIMIT || 10000)
    });
};

router.get('/passive-funnel-report', async (req, res) => {
    try {
        const report = await latestOrScan(req);
        res.json(report);
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'observer_failed' });
    }
});

router.get('/perfect-funnel-report', async (req, res) => {
    try {
        const report = await latestPerfectOrScan(req);
        res.json(report);
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'perfect_observer_failed' });
    }
});

router.get('/sales-hours-analytics', async (req, res) => {
    try {
        const report = await latestSalesHoursOrScan(req);
        res.json(report);
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'sales_hours_observer_failed' });
    }
});

router.get('/sales-hours-spreadsheet/:kind', async (req, res) => {
    try {
        let csv = await readSalesHoursSpreadsheet(req.params.kind);
        if (!csv || ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase())) {
            await latestSalesHoursOrScan(req);
            csv = await readSalesHoursSpreadsheet(req.params.kind);
        }
        if (!csv) return res.status(404).json({ ok: false, error: 'spreadsheet_not_found' });
        const kind = String(req.params.kind || 'relatorio').replace(/[^a-z0-9_-]/gi, '');
        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="observador-horarios-${kind}-ec.csv"`,
            'Cache-Control': 'no-store'
        });
        res.send(csv);
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'sales_hours_spreadsheet_failed' });
    }
});

router.get('/sales-hours-file/:filename', async (req, res) => {
    try {
        let content = await readSalesHoursFile(req.params.filename);
        if (!content || ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase())) {
            await latestSalesHoursOrScan(req);
            content = await readSalesHoursFile(req.params.filename);
        }
        if (!content) return res.status(404).json({ ok: false, error: 'file_not_found' });
        res.set({
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': 'no-store'
        });
        res.send(content);
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'sales_hours_file_failed' });
    }
});

router.get('/perfect-funnel-spreadsheet/:kind', async (req, res) => {
    try {
        let csv = await readPerfectFunnelSpreadsheet(req.params.kind);
        if (!csv || ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase())) {
            await latestPerfectOrScan(req);
            csv = await readPerfectFunnelSpreadsheet(req.params.kind);
        }
        if (!csv) return res.status(404).json({ ok: false, error: 'spreadsheet_not_found' });
        const kind = String(req.params.kind || 'relatorio').replace(/[^a-z0-9_-]/gi, '');
        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="observador-${kind}-ec.csv"`,
            'Cache-Control': 'no-store'
        });
        res.send(csv);
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'spreadsheet_failed' });
    }
});

router.get('/perfect-funnel-file/:filename', async (req, res) => {
    try {
        let content = await readPerfectFunnelFile(req.params.filename);
        if (!content || ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase())) {
            await latestPerfectOrScan(req);
            content = await readPerfectFunnelFile(req.params.filename);
        }
        if (!content) return res.status(404).json({ ok: false, error: 'file_not_found' });
        res.set({
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': 'no-store'
        });
        res.send(content);
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'file_failed' });
    }
});

router.get('/actionables', async (req, res) => {
    try {
        const report = await latestOrScan(req);
        const limit = limitFromReq(req);
        res.json({
            ok: true,
            mode: 'passive_read_only',
            country: report.country,
            generatedAt: report.generatedAt,
            summary: report.summary,
            actionables: (report.items || []).slice(0, limit),
            items: (report.items || []).slice(0, limit),
            readOnlyGuarantee: report.readOnlyGuarantee
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'observer_failed' });
    }
});

router.get('/strategic-center', async (req, res) => {
    try {
        const report = await latestPerfectOrScan(req);
        res.json({
            ok: true,
            mode: 'perfect_observer_passive_read_only',
            title: 'Observador perfeito do funil EC',
            generatedAt: report.generatedAt,
            summary: report.summary,
            examples: (report.ideas || []).slice(0, limitFromReq(req, 12)),
            cards: [...(report.failures || []), ...(report.wins || [])].slice(0, limitFromReq(req, 12)).map((item) => ({
                id: item.id,
                severity: item.severity,
                title: item.title,
                detail: item.detail,
                recommendedAction: item.recommendedAction
            })),
            productionPlan: (report.productionPlan || []).slice(0, limitFromReq(req, 12)),
            spreadsheets: report.spreadsheets || []
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'observer_failed' });
    }
});

router.get('/intelligence-snapshots', async (req, res) => {
    try {
        const report = await latestPerfectOrScan(req);
        res.json({
            ok: true,
            mode: 'perfect_observer_passive_read_only',
            snapshots: [{
                id: 'perfect_funnel_latest',
                title: 'Ultima varredura do observador perfeito',
                generatedAt: report.generatedAt,
                summary: report.summary,
                readOnlyGuarantee: report.readOnlyGuarantee,
                productionPlan: report.productionPlan || [],
                spreadsheets: report.spreadsheets || []
            }]
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'observer_failed' });
    }
});

router.get('/best-attendances', async (req, res) => {
    try {
        const report = await latestPerfectOrScan(req);
        res.json({
            ok: true,
            mode: 'perfect_observer_passive_read_only',
            generatedAt: report.generatedAt,
            summary: report.summary,
            items: (report.wins || []).slice(0, limitFromReq(req, 12)),
            ideas: report.ideas || [],
            productionPlan: report.productionPlan || [],
            spreadsheets: report.spreadsheets || []
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'observer_failed' });
    }
});

router.post('/conversation-funnel', async (req, res) => {
    try {
        const report = await scanPerfectFunnelObserver({
            country: countryFromReq(req),
            lookbackHours: Number(req.body?.lookbackHours || process.env.PERFECT_FUNNEL_OBSERVER_LOOKBACK_HOURS || 24),
            limit: Number(req.body?.limit || 600)
        });
        res.json({
            ok: true,
            mode: 'perfect_observer_passive_read_only',
            summary: report.summary,
            failures: report.failures,
            wins: report.wins,
            ideas: report.ideas,
            productionPlan: report.productionPlan,
            spreadsheets: report.spreadsheets,
            readOnlyGuarantee: report.readOnlyGuarantee
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message || 'observer_failed' });
    }
});

router.post('/audio-score', (_req, res) => {
    res.json({
        ok: true,
        mode: 'passive_read_only',
        score: null,
        items: [],
        message: 'Score de audio individual nao altera funil. Use o relatorio passivo para alertas.'
    });
});

router.post('/attendance-score', (_req, res) => {
    res.json({
        ok: true,
        mode: 'passive_read_only',
        score: null,
        items: [],
        message: 'Score de atendimento individual nao altera funil. Use o relatorio passivo para alertas.'
    });
});

router.post('/attendance-score/save-skill', (_req, res) => readonlyResponse(res, 'save_skill_blocked'));
router.post('/actionables/:id/save-skill', (_req, res) => readonlyResponse(res, 'save_skill_blocked'));
router.post('/actionables/:id/feedback', (_req, res) => readonlyResponse(res, 'feedback_blocked'));
router.post('/actionables/:id/apply', (_req, res) => readonlyResponse(res, 'apply_blocked'));
router.post('/actionables/:id/discard', (_req, res) => readonlyResponse(res, 'discard_blocked'));

export default router;
